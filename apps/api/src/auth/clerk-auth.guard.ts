import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  TenantMismatchError,
  TenantNotRegisteredError,
  UnauthenticatedError,
  UserNotProvisionedError,
} from '../common/domain-errors.js';
import { TenantsService } from '../tenants/tenants.service.js';
import { UsersService } from '../users/users.service.js';
import type { AuthenticatedRequest } from './authenticated-request.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { TokenVerifierService } from './token-verifier.service.js';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenVerifier: TokenVerifierService,
    private readonly tenantsService: TenantsService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthenticatedError('Missing Bearer token');
    }

    let claims;
    try {
      claims = await this.tokenVerifier.verify(authorization.slice(7));
    } catch {
      throw new UnauthenticatedError('Invalid or expired token');
    }

    const orgId = claims.o?.id;

    if (!orgId) {
      throw new UnauthenticatedError('Token carries no organization claim');
    }

    const tenant = await this.tenantsService.findByClerkOrgId(orgId);

    if (!tenant) {
      throw new TenantNotRegisteredError(orgId);
    }

    this.rejectClientDeclaredTenantMismatch(request, tenant.tenantId);

    const user = await this.usersService.findByClerkUserId(claims.sub);

    if (!user || user.tenantId !== tenant.tenantId) {
      throw new UserNotProvisionedError(claims.sub);
    }

    request.tenantId = tenant.tenantId;
    request.userId = claims.sub;
    return true;
  }

  private rejectClientDeclaredTenantMismatch(
    request: AuthenticatedRequest,
    tenantId: string,
  ): void {
    const declaredValues = [
      request.headers['x-tenant-id'],
      request.query.tenantId,
    ];

    for (const declared of declaredValues) {
      if (typeof declared === 'string' && declared !== tenantId) {
        throw new TenantMismatchError();
      }
    }
  }
}
