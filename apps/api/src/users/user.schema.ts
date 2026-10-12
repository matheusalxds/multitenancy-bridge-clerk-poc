import { Schema } from 'mongoose';

export const USER_ROLES = ['admin', 'member'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface PlatformUser {
  clerkUserId: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
}

export const USER_MODEL = 'User';

export const userSchema = new Schema<PlatformUser>(
  {
    clerkUserId: { type: String, required: true, unique: true },
    tenantId: { type: String, required: true },
    email: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, default: 'member' },
  },
  { collection: 'users', timestamps: true },
);
