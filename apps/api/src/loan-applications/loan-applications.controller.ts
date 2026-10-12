import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CreateLoanApplicationDto } from './dto/create-loan-application.dto.js';
import type { LoanApplication } from './loan-application.schema.js';
import { LoanApplicationsService } from './loan-applications.service.js';

@Controller('loan-applications')
export class LoanApplicationsController {
  constructor(
    private readonly loanApplicationsService: LoanApplicationsService,
  ) {}

  @Get()
  findAll(): Promise<LoanApplication[]> {
    return this.loanApplicationsService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string): Promise<LoanApplication> {
    return this.loanApplicationsService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateLoanApplicationDto): Promise<LoanApplication> {
    return this.loanApplicationsService.create(dto);
  }
}
