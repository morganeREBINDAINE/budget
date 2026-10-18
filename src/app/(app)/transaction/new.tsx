import { useLocalSearchParams } from 'expo-router';

import { TransactionForm } from '@/features/transaction/TransactionForm';

export default function Screen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  return <TransactionForm mode="new" type={type === 'income' ? 'income' : 'expense'} />;
}
