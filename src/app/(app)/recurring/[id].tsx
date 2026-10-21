import { useLocalSearchParams } from 'expo-router';

import { RecurringEditorScreen } from '@/features/recurring/RecurringEditorScreen';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RecurringEditorScreen mode="edit" id={id} />;
}
