import { describe, expect, it } from 'vitest';
import { validateEnv } from './index.js';

function makeEnvParams() {
  return {
    NODE_ENV: 'test',
    PORT: '3001',
    MONGODB_URI: 'mongodb://localhost:27017',
    PLATFORM_DB_NAME: 'platform_test',
    TENANT_DB_PREFIX: 'test_tenant_',
  };
}

describe('validateEnv', () => {
  it('should return a typed env with coerced PORT when config is valid', () => {
    const config = makeEnvParams();

    const env = validateEnv(config);

    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('test');
  });

  it('should apply the default PORT when it is omitted', () => {
    const config: Partial<ReturnType<typeof makeEnvParams>> = makeEnvParams();
    delete config.PORT;

    const env = validateEnv(config);

    expect(env.PORT).toBe(3000);
  });

  it('should throw naming the missing variable when MONGODB_URI is absent', () => {
    const config: Partial<ReturnType<typeof makeEnvParams>> = makeEnvParams();
    delete config.MONGODB_URI;

    expect(() => validateEnv(config)).toThrow(/MONGODB_URI/);
  });

  it('should throw when NODE_ENV is not one of the known environments', () => {
    const config = { ...makeEnvParams(), NODE_ENV: 'staging' };

    expect(() => validateEnv(config)).toThrow(/NODE_ENV/);
  });

  it('should throw when MONGODB_URI does not use a mongodb scheme', () => {
    const config = { ...makeEnvParams(), MONGODB_URI: 'http://localhost:27017' };

    expect(() => validateEnv(config)).toThrow(/MONGODB_URI/);
  });
});
