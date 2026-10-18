import { useLocalSearchParams } from 'expo-router';

import { Sheet } from '@/design-system';
import { closeSheet } from '@/features/transaction/closeSheet';
import { TransactionForm } from '@/features/transaction/TransactionForm';
import { TransactionNotFound } from '@/features/transaction/TransactionNotFound';
import { mockTransactions } from '@/mocks/budget';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const transaction = mockTransactions.find((t) => t.id === id);
  return (
    <Sheet onClose={closeSheet}>
      {transaction ? (
        <TransactionForm mode="edit" transaction={transaction} />
      ) : (
        <TransactionNotFound />
      )}
    </Sheet>
  );
}
