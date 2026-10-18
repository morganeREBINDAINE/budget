import { useLocalSearchParams } from 'expo-router';

import { RecurringEditorScreen } from '@/features/recurring/RecurringEditorScreen';
import { mockRecurringPayments } from '@/mocks/recurring';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RecurringEditorScreen mode="edit" payment={mockRecurringPayments.find((p) => p.id === id)} />
  );
}
