export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class EntityNotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity} "${id}" not found`, 'ENTITY_NOT_FOUND');
  }
}

export class TenantContextMissingError extends DomainError {
  constructor() {
    super(
      'tenant context was not resolved before data access (auth guard did not run)',
      'TENANT_CONTEXT_MISSING',
    );
  }
}

export class BusinessRuleViolationError extends DomainError {}

export class UnauthenticatedError extends DomainError {
  constructor(message = 'Missing or invalid credentials') {
    super(message, 'UNAUTHENTICATED');
  }
}

export class TenantMismatchError extends DomainError {
  constructor() {
    super(
      'Client-declared tenant does not match the authenticated organization',
      'TENANT_MISMATCH',
    );
  }
}

export class UserNotProvisionedError extends DomainError {
  constructor(clerkUserId: string) {
    super(
      `User "${clerkUserId}" is not provisioned for this tenant`,
      'USER_NOT_PROVISIONED',
    );
  }
}

export class TenantNotRegisteredError extends DomainError {
  constructor(clerkOrgId: string) {
    super(
      `Organization "${clerkOrgId}" is not registered as a tenant`,
      'TENANT_NOT_REGISTERED',
    );
  }
}
