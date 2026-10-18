import { useLocalSearchParams } from 'expo-router';

import { Sheet } from '@/design-system';
import { closeSheet } from '@/features/transaction/closeSheet';
import { TransactionForm } from '@/features/transaction/TransactionForm';

export default function Screen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  return (
    <Sheet onClose={closeSheet}>
      <TransactionForm mode="new" type={type === 'income' ? 'income' : 'expense'} />
    </Sheet>
  );
}
