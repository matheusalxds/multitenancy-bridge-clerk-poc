import { Module } from '@nestjs/common';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { LoanApplicationsController } from './loan-applications.controller.js';
import { LoanApplicationsService } from './loan-applications.service.js';

@Module({
  imports: [TenancyModule],
  controllers: [LoanApplicationsController],
  providers: [LoanApplicationsService],
})
export class LoanApplicationsModule {}
