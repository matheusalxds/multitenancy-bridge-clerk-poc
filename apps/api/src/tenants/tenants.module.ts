import { Module } from '@nestjs/common';
import { AdminTokenGuard } from '../auth/admin-token.guard.js';
import { TenantsController } from './tenants.controller.js';
import { TenantsService } from './tenants.service.js';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, AdminTokenGuard],
  exports: [TenantsService],
})
export class TenantsModule {}
