import type { Connection } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { MissingTenantHeaderError } from '../common/domain-errors.js';
import type { EnvService } from '../env/env.service.js';
import { TenantConnectionService } from './tenant-connection.service.js';

function makeService(tenantId?: string) {
  const request = { tenantId } as AuthenticatedRequest;
  const connection = mock<Connection>();
  connection.useDb.mockReturnValue({ models: {} } as unknown as Connection);
  const env = { tenantDbPrefix: 'test_tenant_' } as EnvService;

  return {
    service: new TenantConnectionService(request, connection, env),
    connection,
  };
}

describe('TenantConnectionService', () => {
  describe('getTenantDb', () => {
    it('should select the tenant database derived from the request tenantId', () => {
      const { service, connection } = makeService('acme');

      service.getTenantDb();

      expect(connection.useDb).toHaveBeenCalledWith('test_tenant_acme', {
        useCache: true,
      });
    });

    it('should throw MissingTenantHeaderError when the request has no tenantId', () => {
      const { service, connection } = makeService();

      expect(() => service.getTenantDb()).toThrow(MissingTenantHeaderError);
      expect(connection.useDb).not.toHaveBeenCalled();
    });
  });
});
