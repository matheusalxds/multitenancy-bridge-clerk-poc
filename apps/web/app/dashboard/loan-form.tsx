'use client';

import { useActionState } from 'react';
import { createLoanAction, type CreateLoanState } from './actions';

const initialState: CreateLoanState = {};

export function LoanForm() {
  const [state, formAction, pending] = useActionState(
    createLoanAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        Borrower name
        <input
          type="text"
          name="borrowerName"
          required
          placeholder="John Doe"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Amount
        <input
          type="number"
          name="amount"
          required
          min="1"
          step="1000"
          placeholder="250000"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Create loan application'}
      </button>

      {state.error ? (
        <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
