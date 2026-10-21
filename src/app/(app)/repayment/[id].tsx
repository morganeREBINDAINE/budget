import { useLocalSearchParams } from 'expo-router';

import { Sheet } from '@/design-system';
import { EditRepaymentSheetContent } from '@/features/debts/RepaymentSheetContent';
import { closeSheet } from '@/features/transaction/closeSheet';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Sheet onClose={closeSheet}>
      <EditRepaymentSheetContent id={id} />
    </Sheet>
  );
}
