import { Schema } from 'mongoose';

export const LOAN_APPLICATION_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
] as const;

export type LoanApplicationStatus = (typeof LOAN_APPLICATION_STATUSES)[number];

export interface LoanApplication {
  borrowerName: string;
  amount: number;
  status: LoanApplicationStatus;
}

export const LOAN_APPLICATION_MODEL = 'LoanApplication';

export const loanApplicationSchema = new Schema<LoanApplication>(
  {
    borrowerName: { type: String, required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: LOAN_APPLICATION_STATUSES,
      default: 'PENDING',
    },
  },
  { collection: 'loanApplications', timestamps: true },
);
