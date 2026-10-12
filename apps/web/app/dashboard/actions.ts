'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { apiFetch, type ApiError } from '@/lib/api';
import { loanInputSchema } from '@/lib/loan-input';

export interface CreateLoanState {
  error?: string;
}

export async function createLoanAction(
  _previousState: CreateLoanState,
  formData: FormData,
): Promise<CreateLoanState> {
  const { userId, getToken } = await auth();
  const token = userId ? await getToken() : null;

  if (!token) {
    return { error: 'Session expired. Sign in again.' };
  }

  const parsed = loanInputSchema.safeParse({
    borrowerName: formData.get('borrowerName'),
    amount: formData.get('amount'),
  });

  if (!parsed.success) {
    return { error: 'Fill in a borrower name and a positive amount.' };
  }

  const { status, body } = await apiFetch<unknown>('/loan-applications', token, {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });

  if (status !== 201) {
    const message =
      (body as ApiError).error?.message ?? 'The API rejected the request.';
    return { error: `${status}: ${message}` };
  }

  revalidatePath('/dashboard');
  return {};
}
