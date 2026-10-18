import type { Debt, DebtRepayment } from '@/types/budget';

// Total déjà remboursé sur une dette.
export function repaidDa(debtId: string, repayments: DebtRepayment[]): number {
  return repayments.filter((r) => r.debtId === debtId).reduce((acc, r) => acc + r.amountDa, 0);
}

// Reste dû = montant − Σ remboursements (jamais négatif).
export function remainingDa(debt: Debt, repayments: DebtRepayment[]): number {
  return Math.max(0, debt.amountDa - repaidDa(debt.id, repayments));
}

export const isSettled = (debt: Debt, repayments: DebtRepayment[]) =>
  remainingDa(debt, repayments) === 0;
