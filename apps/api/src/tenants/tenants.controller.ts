import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminTokenGuard } from '../auth/admin-token.guard.js';
import { Public } from '../auth/public.decorator.js';
import { CreateTenantDto, UpdateTenantDto } from './dto/create-tenant.dto.js';
import type { Tenant } from './tenant.schema.js';
import { TenantsService } from './tenants.service.js';

@Controller('tenants')
@Public()
@UseGuards(AdminTokenGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  findAll(): Promise<Tenant[]> {
    return this.tenantsService.findAll();
  }

  @Get(':tenantId')
  findByTenantId(@Param('tenantId') tenantId: string): Promise<Tenant> {
    return this.tenantsService.findByTenantId(tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTenantDto): Promise<Tenant> {
    return this.tenantsService.create(dto);
  }

  @Patch(':tenantId')
  update(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantDto,
  ): Promise<Tenant> {
    return this.tenantsService.update(tenantId, dto);
  }

  @Delete(':tenantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('tenantId') tenantId: string): Promise<void> {
    return this.tenantsService.remove(tenantId);
  }
}
