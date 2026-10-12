import { describe, expect, it } from 'vitest';
import { loanInputSchema } from './loan-input';

function makeLoanInputParams() {
  return {
    borrowerName: 'ACME Alice Anderson',
    amount: '350000',
  };
}

describe('loanInputSchema', () => {
  it('should coerce the amount from form data string to number', () => {
    const input = makeLoanInputParams();

    const result = loanInputSchema.parse(input);

    expect(result.amount).toBe(350_000);
    expect(result.borrowerName).toBe('ACME Alice Anderson');
  });

  it('should reject an empty borrower name', () => {
    const input = { ...makeLoanInputParams(), borrowerName: '   ' };

    expect(loanInputSchema.safeParse(input).success).toBe(false);
  });

  it('should reject a non-positive amount', () => {
    const input = { ...makeLoanInputParams(), amount: '-100' };

    expect(loanInputSchema.safeParse(input).success).toBe(false);
  });
});
