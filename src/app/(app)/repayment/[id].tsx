import { useLocalSearchParams } from 'expo-router';

import { Sheet } from '@/design-system';
import { RepaymentForm } from '@/features/debts/RepaymentForm';
import { closeSheet } from '@/features/transaction/closeSheet';
import { TransactionNotFound } from '@/features/transaction/TransactionNotFound';
import { mockDebtRepayments, mockDebts } from '@/mocks/debts';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const repayment = mockDebtRepayments.find((r) => r.id === id);
  const debt = repayment && mockDebts.find((d) => d.id === repayment.debtId);
  return (
    <Sheet onClose={closeSheet}>
      {repayment && debt ? (
        <RepaymentForm debt={debt} repayment={repayment} />
      ) : (
        <TransactionNotFound
          title="Remboursement introuvable"
          message="Il a peut-être été supprimé."
        />
      )}
    </Sheet>
  );
}
