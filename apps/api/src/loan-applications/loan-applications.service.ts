import { Injectable } from '@nestjs/common';
import { isValidObjectId, type Model } from 'mongoose';
import { EntityNotFoundError } from '../common/domain-errors.js';
import { TenantConnectionService } from '../tenancy/tenant-connection.service.js';
import type { CreateLoanApplicationDto } from './dto/create-loan-application.dto.js';
import {
  LOAN_APPLICATION_MODEL,
  type LoanApplication,
  loanApplicationSchema,
} from './loan-application.schema.js';

@Injectable()
export class LoanApplicationsService {
  constructor(
    private readonly tenantConnectionService: TenantConnectionService,
  ) {}

  private get loanApplicationModel(): Model<LoanApplication> {
    return this.tenantConnectionService.getModel<LoanApplication>(
      LOAN_APPLICATION_MODEL,
      loanApplicationSchema,
    );
  }

  findAll(): Promise<LoanApplication[]> {
    return this.loanApplicationModel.find().lean().exec();
  }

  async findById(id: string): Promise<LoanApplication> {
    if (!isValidObjectId(id)) {
      throw new EntityNotFoundError('LoanApplication', id);
    }

    const loanApplication = await this.loanApplicationModel
      .findById(id)
      .lean()
      .exec();

    if (!loanApplication) {
      throw new EntityNotFoundError('LoanApplication', id);
    }

    return loanApplication;
  }

  async create(dto: CreateLoanApplicationDto): Promise<LoanApplication> {
    const created = await this.loanApplicationModel.create(dto);
    return created.toObject();
  }
}
