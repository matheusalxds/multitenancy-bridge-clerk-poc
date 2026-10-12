import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TenantsModule } from '../tenants/tenants.module.js';
import { UsersModule } from '../users/users.module.js';
import { ClerkAuthGuard } from './clerk-auth.guard.js';
import { TokenVerifierService } from './token-verifier.service.js';

@Module({
  imports: [TenantsModule, UsersModule],
  providers: [
    TokenVerifierService,
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
  ],
})
export class AuthModule {}
