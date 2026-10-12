import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { UnauthenticatedError } from '../common/domain-errors.js';
import { EnvService } from '../env/env.service.js';

@Injectable()
export class AdminTokenGuard implements CanActivate {
  constructor(private readonly env: EnvService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedToken = this.env.adminToken;
    const request = context.switchToHttp().getRequest<Request>();
    const providedToken = request.headers['x-admin-token'];

    if (!expectedToken || typeof providedToken !== 'string') {
      throw new UnauthenticatedError('Missing or invalid admin token');
    }

    const expected = Buffer.from(expectedToken);
    const provided = Buffer.from(providedToken);

    if (
      expected.length !== provided.length ||
      !timingSafeEqual(expected, provided)
    ) {
      throw new UnauthenticatedError('Missing or invalid admin token');
    }

    return true;
  }
}
