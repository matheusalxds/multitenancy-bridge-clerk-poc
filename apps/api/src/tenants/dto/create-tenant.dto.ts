import { IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { TENANT_STATUSES, type TenantStatus } from '../tenant.schema.js';

export class CreateTenantDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  tenantId!: string;

  @IsString()
  @IsNotEmpty()
  clerkOrgId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsIn(TENANT_STATUSES)
  status?: TenantStatus;
}

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsIn(TENANT_STATUSES)
  status?: TenantStatus;
}
