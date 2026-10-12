import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { exportSPKI, generateKeyPair } from 'jose';
import type { Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MONGO_CONNECTION } from '../src/database/database.module.js';

const ADMIN_TOKEN = 'e2e-admin-token-0123456789';

function makeTenantParams() {
  return {
    tenantId: 'newco',
    clerkOrgId: 'org_test_newco',
    name: 'NewCo Lending',
  };
}

describe('Tenants admin surface (e2e)', () => {
  let app: INestApplication<App>;
  let connection: Connection;

  function api() {
    return request(app.getHttpServer());
  }

  beforeAll(async () => {
    const { publicKey } = await generateKeyPair('RS256');
    process.env.CLERK_JWT_KEY = await exportSPKI(publicKey);
    process.env.ADMIN_TOKEN = ADMIN_TOKEN;

    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    connection = app.get<Connection>(MONGO_CONNECTION);
  });

  beforeEach(async () => {
    const platformDb = connection.useDb('platform_test', { useCache: true });
    await platformDb.collection('tenants').deleteMany({});
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 401 when no admin token is sent', async () => {
    const response = await api()
      .post('/tenants')
      .send(makeTenantParams())
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('should return 401 when the admin token is wrong', async () => {
    await api()
      .post('/tenants')
      .set('x-admin-token', 'wrong-token-0123456789')
      .send(makeTenantParams())
      .expect(401);
  });

  it('should return 401 when listing tenants without the admin token', async () => {
    await api().get('/tenants').expect(401);
  });

  it('should create, list, update and delete a tenant with the admin token', async () => {
    const created = await api()
      .post('/tenants')
      .set('x-admin-token', ADMIN_TOKEN)
      .send(makeTenantParams())
      .expect(201);

    expect(created.body.tenantId).toBe('newco');

    const listed = await api()
      .get('/tenants')
      .set('x-admin-token', ADMIN_TOKEN)
      .expect(200);

    expect(listed.body).toHaveLength(1);

    const updated = await api()
      .patch('/tenants/newco')
      .set('x-admin-token', ADMIN_TOKEN)
      .send({ status: 'inactive' })
      .expect(200);

    expect(updated.body.status).toBe('inactive');

    await api()
      .delete('/tenants/newco')
      .set('x-admin-token', ADMIN_TOKEN)
      .expect(204);
  });
});
