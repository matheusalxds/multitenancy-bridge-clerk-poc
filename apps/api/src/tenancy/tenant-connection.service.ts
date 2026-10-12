import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Connection, Model, Schema } from 'mongoose';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { TenantContextMissingError } from '../common/domain-errors.js';
import { MONGO_CONNECTION } from '../database/database.module.js';
import { EnvService } from '../env/env.service.js';

@Injectable({ scope: Scope.REQUEST })
export class TenantConnectionService {
  constructor(
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
    @Inject(MONGO_CONNECTION) private readonly connection: Connection,
    private readonly env: EnvService,
  ) {}

  getTenantDb(): Connection {
    const { tenantId } = this.request;

    if (!tenantId) {
      throw new TenantContextMissingError();
    }

    return this.connection.useDb(`${this.env.tenantDbPrefix}${tenantId}`, {
      useCache: true,
    });
  }

  getModel<T>(name: string, schema: Schema<T>): Model<T> {
    const tenantDb = this.getTenantDb();

    return (
      (tenantDb.models[name] as Model<T> | undefined) ??
      tenantDb.model<T>(name, schema)
    );
  }
}
