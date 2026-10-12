import { z } from 'zod';

export const loanInputSchema = z.object({
  borrowerName: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
});

export type LoanInput = z.infer<typeof loanInputSchema>;
