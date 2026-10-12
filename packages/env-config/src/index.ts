import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['local', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().startsWith('mongodb'),
  PLATFORM_DB_NAME: z.string().min(1),
  TENANT_DB_PREFIX: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

export const apiEnvSchema = envSchema
  .extend({
    CLERK_SECRET_KEY: z.string().min(1).optional(),
    CLERK_JWT_KEY: z.string().min(1).optional(),
    ADMIN_TOKEN: z.string().min(16).optional(),
  })
  .superRefine((env, ctx) => {
    if (!env.CLERK_SECRET_KEY && !env.CLERK_JWT_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['CLERK_SECRET_KEY'],
        message:
          'Either CLERK_SECRET_KEY or CLERK_JWT_KEY is required to verify Clerk tokens',
      });
    }
  });

export type ApiEnv = z.infer<typeof apiEnvSchema>;

function parseOrThrow<T>(schema: z.ZodType<T>, config: Record<string, unknown>): T {
  const result = schema.safeParse(config);

  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}

export function validateEnv(config: Record<string, unknown>): Env {
  return parseOrThrow(envSchema, config);
}

export function validateApiEnv(config: Record<string, unknown>): ApiEnv {
  return parseOrThrow(apiEnvSchema, config);
}
