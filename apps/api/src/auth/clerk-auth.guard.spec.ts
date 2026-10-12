import type { ExecutionContext } from '@nestjs/common';
import type { HttpArgumentsHost } from '@nestjs/common/interfaces/features/arguments-host.interface.js';
import type { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import {
  TenantMismatchError,
  TenantNotRegisteredError,
  UnauthenticatedError,
  UserNotProvisionedError,
} from '../common/domain-errors.js';
import type { TenantsService } from '../tenants/tenants.service.js';
import type { UsersService } from '../users/users.service.js';
import type { AuthenticatedRequest } from './authenticated-request.js';
import { ClerkAuthGuard } from './clerk-auth.guard.js';
import type { TokenVerifierService } from './token-verifier.service.js';

function makeContext(
  headers: Record<string, string> = {},
  query: Record<string, string> = {},
) {
  const request = { headers, query } as unknown as AuthenticatedRequest;
  const httpHost = mock<HttpArgumentsHost>();
  httpHost.getRequest.mockReturnValue(request);
  const context = mock<ExecutionContext>();
  context.switchToHttp.mockReturnValue(httpHost);

  return { context, request };
}

function makeTenantParams() {
  return {
    tenantId: 'acme',
    clerkOrgId: 'org_acme',
    name: 'Acme Mortgage',
    status: 'active' as const,
  };
}

function makeUserParams() {
  return {
    clerkUserId: 'user_1',
    tenantId: 'acme',
    email: 'alice@acme.com',
    name: 'Alice Anderson',
    role: 'member' as const,
  };
}

describe('ClerkAuthGuard', () => {
  let reflector: MockProxy<Reflector>;
  let tokenVerifier: MockProxy<TokenVerifierService>;
  let tenantsService: MockProxy<TenantsService>;
  let usersService: MockProxy<UsersService>;
  let guard: ClerkAuthGuard;

  beforeEach(() => {
    reflector = mock<Reflector>();
    reflector.getAllAndOverride.mockReturnValue(false);
    tokenVerifier = mock<TokenVerifierService>();
    tenantsService = mock<TenantsService>();
    usersService = mock<UsersService>();
    usersService.findByClerkUserId.mockResolvedValue(makeUserParams());
    guard = new ClerkAuthGuard(
      reflector,
      tokenVerifier,
      tenantsService,
      usersService,
    );
  });

  it('should allow public routes without a token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { context } = makeContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(tokenVerifier.verify).not.toHaveBeenCalled();
  });

  it('should throw UnauthenticatedError when the Bearer token is missing', async () => {
    const { context } = makeContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it('should throw UnauthenticatedError when verification fails', async () => {
    tokenVerifier.verify.mockRejectedValue(new Error('bad signature'));
    const { context } = makeContext({ authorization: 'Bearer tampered' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it('should throw UnauthenticatedError when the token has no organization claim', async () => {
    tokenVerifier.verify.mockResolvedValue({ sub: 'user_1' });
    const { context } = makeContext({ authorization: 'Bearer valid' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it('should throw TenantNotRegisteredError when the org has no tenant', async () => {
    tokenVerifier.verify.mockResolvedValue({
      sub: 'user_1',
      o: { id: 'org_ghost' },
    });
    tenantsService.findByClerkOrgId.mockResolvedValue(null);
    const { context } = makeContext({ authorization: 'Bearer valid' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      TenantNotRegisteredError,
    );
  });

  it('should throw TenantMismatchError when a client header declares another tenant', async () => {
    tokenVerifier.verify.mockResolvedValue({
      sub: 'user_1',
      o: { id: 'org_acme' },
    });
    tenantsService.findByClerkOrgId.mockResolvedValue(makeTenantParams());
    const { context } = makeContext({
      authorization: 'Bearer valid',
      'x-tenant-id': 'xyz',
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      TenantMismatchError,
    );
  });

  it('should throw TenantMismatchError when a query param declares another tenant', async () => {
    tokenVerifier.verify.mockResolvedValue({
      sub: 'user_1',
      o: { id: 'org_acme' },
    });
    tenantsService.findByClerkOrgId.mockResolvedValue(makeTenantParams());
    const { context } = makeContext(
      { authorization: 'Bearer valid' },
      { tenantId: 'xyz' },
    );

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      TenantMismatchError,
    );
  });

  it('should throw UserNotProvisionedError when the user has no platform document', async () => {
    tokenVerifier.verify.mockResolvedValue({
      sub: 'user_1',
      o: { id: 'org_acme' },
    });
    tenantsService.findByClerkOrgId.mockResolvedValue(makeTenantParams());
    usersService.findByClerkUserId.mockResolvedValue(null);
    const { context } = makeContext({ authorization: 'Bearer valid' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UserNotProvisionedError,
    );
  });

  it('should throw UserNotProvisionedError when the user belongs to another tenant', async () => {
    tokenVerifier.verify.mockResolvedValue({
      sub: 'user_1',
      o: { id: 'org_acme' },
    });
    tenantsService.findByClerkOrgId.mockResolvedValue(makeTenantParams());
    usersService.findByClerkUserId.mockResolvedValue({
      ...makeUserParams(),
      tenantId: 'xyz',
    });
    const { context } = makeContext({ authorization: 'Bearer valid' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UserNotProvisionedError,
    );
  });

  it('should attach tenantId and userId from the verified claim', async () => {
    tokenVerifier.verify.mockResolvedValue({
      sub: 'user_1',
      o: { id: 'org_acme' },
    });
    tenantsService.findByClerkOrgId.mockResolvedValue(makeTenantParams());
    const { context, request } = makeContext({ authorization: 'Bearer valid' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.tenantId).toBe('acme');
    expect(request.userId).toBe('user_1');
  });

  it('should accept a matching client-declared tenant as a selector', async () => {
    tokenVerifier.verify.mockResolvedValue({
      sub: 'user_1',
      o: { id: 'org_acme' },
    });
    tenantsService.findByClerkOrgId.mockResolvedValue(makeTenantParams());
    const { context } = makeContext({
      authorization: 'Bearer valid',
      'x-tenant-id': 'acme',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
