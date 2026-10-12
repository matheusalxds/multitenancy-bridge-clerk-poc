import { SignIn } from '@clerk/nextjs';
import { connection } from 'next/server';

export const instant = false;

export default async function SignInPage() {
  await connection();

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <SignIn />
    </main>
  );
}
