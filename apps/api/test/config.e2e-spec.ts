import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

describe('environment validation (e2e)', () => {
  it('should fail the boot with a clear Zod error when the env is incomplete', async () => {
    process.env.NODE_ENV = 'nonexistent-env';
    delete process.env.MONGODB_URI;
    delete process.env.PLATFORM_DB_NAME;
    delete process.env.TENANT_DB_PREFIX;

    const boot = async () => {
      const { AppModule } = await import('../src/app.module.js');
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      const app = moduleRef.createNestApplication();
      await app.init();
      await app.close();
    };

    await expect(boot()).rejects.toThrow(/Invalid environment configuration/);
    await expect(boot()).rejects.toThrow(/MONGODB_URI/);
  });
});
