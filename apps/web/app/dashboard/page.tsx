import {
  OrganizationList,
  OrganizationSwitcher,
  UserButton,
} from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { apiFetch } from '@/lib/api';
import { LoanForm } from './loan-form';

export default async function DashboardPage() {
  await connection();
  const { userId, orgId, getToken } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  if (!orgId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-sm text-zinc-500">
          Pick an organization to resolve your tenant.
        </p>
        <OrganizationList hidePersonal />
      </main>
    );
  }

  const token = await getToken();

  if (!token) {
    redirect('/sign-in');
  }

  const [loanApplications, me] = await Promise.all([
    apiFetch<unknown[]>('/loan-applications', token),
    apiFetch<Record<string, unknown>>('/users/me', token),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Multi-tenant PoC</h1>
          <p className="text-sm text-zinc-500">
            Clerk org <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">{orgId}</code>{' '}
            resolved by the API into the tenant database via the verified JWT claim
          </p>
        </div>
        <div className="flex items-center gap-3">
          <OrganizationSwitcher hidePersonal />
          <UserButton />
        </div>
      </header>

      <section>
        <h2 className="mb-2 font-semibold">
          GET /users/me (platform.users, global namespace) · status {me.status}
        </h2>
        <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-4 text-xs dark:bg-zinc-900">
          {JSON.stringify(me.body, null, 2)}
        </pre>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">New loan application</h2>
        <LoanForm />
      </section>

      <section>
        <h2 className="mb-2 font-semibold">
          GET /loan-applications (tenant database) · no tenant field, no tenant
          filter · status {loanApplications.status}
        </h2>
        <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-4 text-xs dark:bg-zinc-900">
          {JSON.stringify(loanApplications.body, null, 2)}
        </pre>
      </section>
    </main>
  );
}
