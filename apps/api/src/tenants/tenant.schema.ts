import { Schema } from 'mongoose';

export const TENANT_STATUSES = ['active', 'inactive'] as const;

export type TenantStatus = (typeof TENANT_STATUSES)[number];

export interface Tenant {
  tenantId: string;
  clerkOrgId: string;
  name: string;
  status: TenantStatus;
}

export const TENANT_MODEL = 'Tenant';

export const tenantSchema = new Schema<Tenant>(
  {
    tenantId: { type: String, required: true, unique: true },
    clerkOrgId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    status: { type: String, enum: TENANT_STATUSES, default: 'active' },
  },
  { collection: 'tenants', timestamps: true },
);
