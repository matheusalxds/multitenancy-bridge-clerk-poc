import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { exportSPKI, generateKeyPair, SignJWT } from 'jose';
import type { Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MONGO_CONNECTION } from '../src/database/database.module.js';

const TENANTS = [
  {
    tenantId: 'acme',
    clerkOrgId: 'org_test_acme',
    name: 'Acme Mortgage',
    status: 'active',
  },
  {
    tenantId: 'xyz',
    clerkOrgId: 'org_test_xyz',
    name: 'XYZ Lending',
    status: 'active',
  },
];

const USERS = [
  {
    clerkUserId: 'user_test_acme',
    tenantId: 'acme',
    email: 'alice@acme.com',
    name: 'Alice Anderson',
    role: 'member',
  },
  {
    clerkUserId: 'user_test_xyz',
    tenantId: 'xyz',
    email: 'xavier@xyz.com',
    name: 'Xavier Xu',
    role: 'member',
  },
];

describe('Loan applications multi-tenancy with Clerk claims (e2e)', () => {
  let app: INestApplication<App>;
  let connection: Connection;
  let signingKey: CryptoKey;

  async function signToken(
    orgId: string | undefined,
    sub = orgId === 'org_test_xyz' ? 'user_test_xyz' : 'user_test_acme',
  ): Promise<string> {
    const jwt = new SignJWT(orgId ? { o: { id: orgId } } : {})
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject(sub)
      .setIssuedAt()
      .setIssuer('https://test-instance.clerk.accounts.dev')
      .setNotBefore(0)
      .setExpirationTime('1h');

    return jwt.sign(signingKey);
  }

  function api() {
    return request(app.getHttpServer());
  }

  async function createLoanApplication(token: string, borrowerName: string) {
    return api()
      .post('/loan-applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ borrowerName, amount: 100_000 })
      .expect(201);
  }

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    signingKey = privateKey;
    process.env.CLERK_JWT_KEY = await exportSPKI(publicKey);

    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    connection = app.get<Connection>(MONGO_CONNECTION);
  });

  beforeEach(async () => {
    await connection.useDb('test_tenant_acme').dropDatabase();
    await connection.useDb('test_tenant_xyz').dropDatabase();

    const platformDb = connection.useDb('platform_test', { useCache: true });
    await platformDb.collection('tenants').deleteMany({});
    await platformDb.collection('tenants').insertMany(structuredClone(TENANTS));
    await platformDb.collection('users').deleteMany({});
    await platformDb.collection('users').insertMany(structuredClone(USERS));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authentication', () => {
    it('should return 401 when no token is sent', async () => {
      const response = await api().get('/loan-applications').expect(401);

      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should return 401 when the token signature is tampered', async () => {
      const token = await signToken('org_test_acme');
      const tampered = `${token.slice(0, -4)}AAAA`;

      const response = await api()
        .get('/loan-applications')
        .set('Authorization', `Bearer ${tampered}`)
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should return 401 when the token is expired', async () => {
      const expired = await new SignJWT({ o: { id: 'org_test_acme' } })
        .setProtectedHeader({ alg: 'RS256' })
        .setSubject('user_test_1')
        .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
        .setIssuer('https://test-instance.clerk.accounts.dev')
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
        .sign(signingKey);

      await api()
        .get('/loan-applications')
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);
    });

    it('should return 401 when the token has no organization claim', async () => {
      const token = await signToken(undefined);

      await api()
        .get('/loan-applications')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('should return 403 when the org is not registered as a tenant', async () => {
      const token = await signToken('org_test_ghost');

      const response = await api()
        .get('/loan-applications')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.error.code).toBe('TENANT_NOT_REGISTERED');
    });
  });

  describe('user provisioning', () => {
    it('should return 403 when the user has no document in platform.users', async () => {
      const token = await signToken('org_test_acme', 'user_test_ghost');

      const response = await api()
        .get('/loan-applications')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.error.code).toBe('USER_NOT_PROVISIONED');
    });

    it('should return 403 when the user document belongs to another tenant', async () => {
      const token = await signToken('org_test_acme', 'user_test_xyz');

      const response = await api()
        .get('/loan-applications')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.error.code).toBe('USER_NOT_PROVISIONED');
    });
  });

  describe('claim as the only tenant authority', () => {
    it('should return 403 when a header declares a tenant different from the claim', async () => {
      const token = await signToken('org_test_acme');

      const response = await api()
        .get('/loan-applications')
        .set('Authorization', `Bearer ${token}`)
        .set('x-tenant-id', 'xyz')
        .expect(403);

      expect(response.body.error.code).toBe('TENANT_MISMATCH');
    });

    it('should return 403 when a query param declares a tenant different from the claim', async () => {
      const token = await signToken('org_test_acme');

      await api()
        .get('/loan-applications?tenantId=xyz')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('should serve the claim tenant data when the declared tenant matches', async () => {
      const token = await signToken('org_test_acme');
      await createLoanApplication(token, 'ACME Alice');

      const response = await api()
        .get('/loan-applications')
        .set('Authorization', `Bearer ${token}`)
        .set('x-tenant-id', 'acme')
        .expect(200);

      expect(response.body).toHaveLength(1);
    });
  });

  describe('structural isolation', () => {
    it('should return only the loan applications of the claim tenant', async () => {
      const acmeToken = await signToken('org_test_acme');
      const xyzToken = await signToken('org_test_xyz');
      await createLoanApplication(acmeToken, 'ACME Alice');
      await createLoanApplication(acmeToken, 'ACME Aaron');
      await createLoanApplication(xyzToken, 'XYZ Xavier');

      const acmeResponse = await api()
        .get('/loan-applications')
        .set('Authorization', `Bearer ${acmeToken}`)
        .expect(200);
      const xyzResponse = await api()
        .get('/loan-applications')
        .set('Authorization', `Bearer ${xyzToken}`)
        .expect(200);

      expect(acmeResponse.body).toHaveLength(2);
      expect(
        acmeResponse.body.every((doc: { borrowerName: string }) =>
          doc.borrowerName.startsWith('ACME'),
        ),
      ).toBe(true);
      expect(xyzResponse.body).toHaveLength(1);
      expect(xyzResponse.body[0].borrowerName).toBe('XYZ Xavier');
    });

    it('should return 404 (not 403) when tenant B fetches a loan application of tenant A by id', async () => {
      const acmeToken = await signToken('org_test_acme');
      const xyzToken = await signToken('org_test_xyz');
      const created = await createLoanApplication(acmeToken, 'ACME Alice');
      const id = created.body._id;

      await api()
        .get(`/loan-applications/${id}`)
        .set('Authorization', `Bearer ${acmeToken}`)
        .expect(200);

      const crossTenantResponse = await api()
        .get(`/loan-applications/${id}`)
        .set('Authorization', `Bearer ${xyzToken}`)
        .expect(404);

      expect(crossTenantResponse.body.error.code).toBe('ENTITY_NOT_FOUND');
    });

    it('should store loan application documents without any tenant field', async () => {
      const token = await signToken('org_test_acme');
      await createLoanApplication(token, 'ACME Alice');

      const rawDocument = await connection
        .useDb('test_tenant_acme')
        .collection('loanApplications')
        .findOne({});

      expect(rawDocument).not.toBeNull();
      expect(rawDocument).not.toHaveProperty('tenantId');
    });
  });

  describe('concurrency safety', () => {
    it('should never leak data across tenants under interleaved parallel requests', async () => {
      const acmeToken = await signToken('org_test_acme');
      const xyzToken = await signToken('org_test_xyz');
      await createLoanApplication(acmeToken, 'ACME Alice');
      await createLoanApplication(acmeToken, 'ACME Aaron');
      await createLoanApplication(xyzToken, 'XYZ Xavier');

      const tenants = Array.from({ length: 40 }, (_, index) =>
        index % 2 === 0
          ? { prefix: 'ACME', token: acmeToken }
          : { prefix: 'XYZ', token: xyzToken },
      );

      const responses = await Promise.all(
        tenants.map(({ token }) =>
          api()
            .get('/loan-applications')
            .set('Authorization', `Bearer ${token}`)
            .expect(200),
        ),
      );

      for (const [index, response] of responses.entries()) {
        const documents = response.body as { borrowerName: string }[];

        expect(documents.length).toBeGreaterThan(0);
        expect(
          documents.every((doc) =>
            doc.borrowerName.startsWith(tenants[index].prefix),
          ),
        ).toBe(true);
      }
    });
  });
});
