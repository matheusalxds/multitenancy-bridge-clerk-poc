import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApiEnv } from '@poc/env-config';

@Injectable()
export class EnvService {
  constructor(private readonly configService: ConfigService<ApiEnv, true>) {}

  get nodeEnv(): ApiEnv['NODE_ENV'] {
    return this.configService.get('NODE_ENV', { infer: true });
  }

  get port(): number {
    return this.configService.get('PORT', { infer: true });
  }

  get mongodbUri(): string {
    return this.configService.get('MONGODB_URI', { infer: true });
  }

  get platformDbName(): string {
    return this.configService.get('PLATFORM_DB_NAME', { infer: true });
  }

  get tenantDbPrefix(): string {
    return this.configService.get('TENANT_DB_PREFIX', { infer: true });
  }

  get clerkSecretKey(): string | undefined {
    return this.configService.get('CLERK_SECRET_KEY', { infer: true });
  }

  get clerkJwtKey(): string | undefined {
    return this.configService.get('CLERK_JWT_KEY', { infer: true });
  }
}
