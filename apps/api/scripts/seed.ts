import { createClerkClient } from '@clerk/backend';
import { validateEnv } from '@poc/env-config';
import mongoose from 'mongoose';

const nodeEnv = process.env.NODE_ENV ?? 'local';

try {
  process.loadEnvFile(`.env.${nodeEnv}`);
} catch {}

try {
  process.loadEnvFile('.env');
} catch {}

const env = validateEnv(process.env);
const secretKey = process.env.CLERK_SECRET_KEY;

if (!secretKey || secretKey.includes('REPLACE_ME')) {
  console.error(
    '[seed] CLERK_SECRET_KEY is missing or a placeholder. Set the real dev-instance secret key in apps/api/.env and re-run.',
  );
  process.exit(1);
}

const clerk = createClerkClient({ secretKey });

const desiredTenants = [
  { tenantId: 'acme', name: 'Acme Mortgage' },
  { tenantId: 'xyz', name: 'XYZ Lending' },
];

const desiredUsers = [
  {
    tenantId: 'acme',
    email: 'alice@acme.com',
    firstName: 'Alice',
    lastName: 'Anderson',
  },
  {
    tenantId: 'xyz',
    email: 'xavier@xyz.com',
    firstName: 'Xavier',
    lastName: 'Xu',
  },
];

const TEST_USER_PASSWORD = 'Poc-Bridge-2026-Strong!';

const seedLoanApplications: Record<string, object[]> = {
  acme: [
    { borrowerName: 'ACME Alice Anderson', amount: 350_000, status: 'PENDING' },
    { borrowerName: 'ACME Aaron Avery', amount: 520_000, status: 'APPROVED' },
    { borrowerName: 'ACME Amanda Adams', amount: 275_000, status: 'PENDING' },
  ],
  xyz: [
    { borrowerName: 'XYZ Xavier Xu', amount: 410_000, status: 'APPROVED' },
    { borrowerName: 'XYZ Ximena Xiong', amount: 190_000, status: 'REJECTED' },
  ],
};

async function ensureOrganization(name: string) {
  const organizations = await clerk.organizations.getOrganizationList({
    query: name,
    limit: 10,
  });
  const existing = organizations.data.find(
    (organization) => organization.name === name,
  );

  if (existing) {
    console.log(`[seed] clerk org "${name}" exists (${existing.id})`);
    return existing;
  }

  const organization = await clerk.organizations.createOrganization({ name });
  console.log(`[seed] clerk org "${name}" created (${organization.id})`);
  return organization;
}

async function ensureUser(email: string, firstName: string, lastName: string) {
  const existing = await clerk.users.getUserList({ emailAddress: [email] });

  if (existing.data.length > 0) {
    console.log(`[seed] clerk user ${email} exists (${existing.data[0].id})`);
    return existing.data[0];
  }

  const user = await clerk.users.createUser({
    emailAddress: [email],
    password: TEST_USER_PASSWORD,
    firstName,
    lastName,
  });
  console.log(`[seed] clerk user ${email} created (${user.id})`);
  return user;
}

async function ensureMembership(organizationId: string, userId: string) {
  const memberships = await clerk.organizations.getOrganizationMembershipList({
    organizationId,
    limit: 100,
  });
  const isMember = memberships.data.some(
    (membership) => membership.publicUserData?.userId === userId,
  );

  if (isMember) {
    return;
  }

  await clerk.organizations.createOrganizationMembership({
    organizationId,
    userId,
    role: 'org:admin',
  });
  console.log(`[seed] linked user ${userId} to org ${organizationId}`);
}

const organizationsByTenantId = new Map<string, string>();

for (const tenant of desiredTenants) {
  const organization = await ensureOrganization(tenant.name);
  organizationsByTenantId.set(tenant.tenantId, organization.id);
}

const usersByTenantId = new Map<
  string,
  { clerkUserId: string; email: string; name: string }
>();

for (const desiredUser of desiredUsers) {
  const user = await ensureUser(
    desiredUser.email,
    desiredUser.firstName,
    desiredUser.lastName,
  );
  const organizationId = organizationsByTenantId.get(desiredUser.tenantId);

  if (organizationId) {
    await ensureMembership(organizationId, user.id);
  }

  usersByTenantId.set(desiredUser.tenantId, {
    clerkUserId: user.id,
    email: desiredUser.email,
    name: `${desiredUser.firstName} ${desiredUser.lastName}`,
  });
}

const connection = await mongoose.createConnection(env.MONGODB_URI).asPromise();
const platformDb = connection.useDb(env.PLATFORM_DB_NAME, { useCache: true });

await platformDb.collection('tenants').deleteMany({});
await platformDb
  .collection('tenants')
  .createIndex({ clerkOrgId: 1 }, { unique: true });
await platformDb.collection('tenants').insertMany(
  desiredTenants.map(({ tenantId, name }) => ({
    tenantId,
    clerkOrgId: organizationsByTenantId.get(tenantId),
    name,
    status: 'active',
  })),
);
console.log(
  `[seed] ${env.PLATFORM_DB_NAME}.tenants: ${desiredTenants.length} tenants`,
);

await platformDb.collection('users').deleteMany({});
await platformDb
  .collection('users')
  .createIndex({ clerkUserId: 1 }, { unique: true });
await platformDb.collection('users').insertMany(
  [...usersByTenantId.entries()].map(([tenantId, user]) => ({
    clerkUserId: user.clerkUserId,
    tenantId,
    email: user.email,
    name: user.name,
    role: 'admin',
  })),
);
console.log(
  `[seed] ${env.PLATFORM_DB_NAME}.users: ${usersByTenantId.size} users`,
);

for (const [tenantId, loanApplications] of Object.entries(
  seedLoanApplications,
)) {
  const tenantDb = connection.useDb(`${env.TENANT_DB_PREFIX}${tenantId}`, {
    useCache: true,
  });
  await tenantDb.collection('loanApplications').deleteMany({});
  await tenantDb.collection('loanApplications').insertMany(loanApplications);
  console.log(
    `[seed] ${env.TENANT_DB_PREFIX}${tenantId}.loanApplications: ${loanApplications.length} documents`,
  );
}

await connection.close();
console.log('[seed] done');
console.log(
  `[seed] web test logins: ${desiredUsers.map((user) => user.email).join(', ')} / password: ${TEST_USER_PASSWORD}`,
);
