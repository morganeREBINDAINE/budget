import { useLocalSearchParams } from 'expo-router';

import { Sheet } from '@/design-system';
import { RepaymentForm } from '@/features/debts/RepaymentForm';
import { closeSheet } from '@/features/transaction/closeSheet';
import { TransactionNotFound } from '@/features/transaction/TransactionNotFound';
import { mockDebts } from '@/mocks/debts';

export default function Screen() {
  const { debtId } = useLocalSearchParams<{ debtId?: string }>();
  const debt = mockDebts.find((d) => d.id === debtId);
  return (
    <Sheet onClose={closeSheet}>
      {debt ? (
        <RepaymentForm debt={debt} />
      ) : (
        <TransactionNotFound title="Dette introuvable" message="Elle a peut-être été supprimée." />
      )}
    </Sheet>
  );
}
