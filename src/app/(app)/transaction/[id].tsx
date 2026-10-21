import { useLocalSearchParams } from 'expo-router';

import { Sheet } from '@/design-system';
import { closeSheet } from '@/features/transaction/closeSheet';
import { TransactionSheetContent } from '@/features/transaction/TransactionSheetContent';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Sheet onClose={closeSheet}>
      <TransactionSheetContent id={id} />
    </Sheet>
  );
}
