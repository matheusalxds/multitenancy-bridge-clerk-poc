import { Module } from '@nestjs/common';
import { TenantConnectionService } from './tenant-connection.service.js';

@Module({
  providers: [TenantConnectionService],
  exports: [TenantConnectionService],
})
export class TenancyModule {}
