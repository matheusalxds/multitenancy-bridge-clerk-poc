import { Inject, Injectable } from '@nestjs/common';
import type { Connection, Model } from 'mongoose';
import {
  BusinessRuleViolationError,
  EntityNotFoundError,
} from '../common/domain-errors.js';
import { MONGO_CONNECTION } from '../database/database.module.js';
import { EnvService } from '../env/env.service.js';
import type { CreateTenantDto, UpdateTenantDto } from './dto/create-tenant.dto.js';
import { TENANT_MODEL, type Tenant, tenantSchema } from './tenant.schema.js';

const ORG_CACHE_TTL_MS = 60_000;

interface CachedTenant {
  tenant: Tenant;
  expiresAt: number;
}

@Injectable()
export class TenantsService {
  private readonly tenantModel: Model<Tenant>;
  private readonly orgCache = new Map<string, CachedTenant>();

  constructor(
    @Inject(MONGO_CONNECTION) connection: Connection,
    env: EnvService,
  ) {
    const platformDb = connection.useDb(env.platformDbName, {
      useCache: true,
    });

    this.tenantModel =
      (platformDb.models[TENANT_MODEL] as Model<Tenant> | undefined) ??
      platformDb.model<Tenant>(TENANT_MODEL, tenantSchema);
  }

  findAll(): Promise<Tenant[]> {
    return this.tenantModel.find().sort({ tenantId: 1 }).lean().exec();
  }

  async findByTenantId(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenantModel.findOne({ tenantId }).lean().exec();

    if (!tenant) {
      throw new EntityNotFoundError('Tenant', tenantId);
    }

    return tenant;
  }

  async findByClerkOrgId(clerkOrgId: string): Promise<Tenant | null> {
    const cached = this.orgCache.get(clerkOrgId);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.tenant;
    }

    const tenant = await this.tenantModel
      .findOne({ clerkOrgId, status: 'active' })
      .lean()
      .exec();

    if (tenant) {
      this.orgCache.set(clerkOrgId, {
        tenant,
        expiresAt: Date.now() + ORG_CACHE_TTL_MS,
      });
    }

    return tenant;
  }

  async create(dto: CreateTenantDto): Promise<Tenant> {
    const existing = await this.tenantModel
      .findOne({ $or: [{ tenantId: dto.tenantId }, { clerkOrgId: dto.clerkOrgId }] })
      .lean()
      .exec();

    if (existing) {
      throw new BusinessRuleViolationError(
        `Tenant "${dto.tenantId}" or organization "${dto.clerkOrgId}" already registered`,
        'TENANT_ALREADY_EXISTS',
      );
    }

    const created = await this.tenantModel.create(dto);
    this.orgCache.clear();
    return created.toObject();
  }

  async update(tenantId: string, dto: UpdateTenantDto): Promise<Tenant> {
    const updated = await this.tenantModel
      .findOneAndUpdate({ tenantId }, { $set: dto }, { new: true })
      .lean()
      .exec();

    if (!updated) {
      throw new EntityNotFoundError('Tenant', tenantId);
    }

    this.orgCache.clear();
    return updated;
  }

  async remove(tenantId: string): Promise<void> {
    const deleted = await this.tenantModel
      .findOneAndDelete({ tenantId })
      .lean()
      .exec();

    if (!deleted) {
      throw new EntityNotFoundError('Tenant', tenantId);
    }

    this.orgCache.clear();
  }
}
