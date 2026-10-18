import { useLocalSearchParams } from 'expo-router';

import { TransactionForm } from '@/features/transaction/TransactionForm';
import { TransactionNotFound } from '@/features/transaction/TransactionNotFound';
import { mockTransactions } from '@/mocks/budget';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const transaction = mockTransactions.find((t) => t.id === id);
  if (!transaction) return <TransactionNotFound />;
  return <TransactionForm mode="edit" transaction={transaction} />;
}
