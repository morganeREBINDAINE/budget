import { useLocalSearchParams } from 'expo-router';

import { Sheet } from '@/design-system';
import { NewRepaymentSheetContent } from '@/features/debts/RepaymentSheetContent';
import { closeSheet } from '@/features/transaction/closeSheet';

export default function Screen() {
  const { debtId } = useLocalSearchParams<{ debtId?: string }>();
  return (
    <Sheet onClose={closeSheet}>
      <NewRepaymentSheetContent debtId={debtId ?? ''} />
    </Sheet>
  );
}
