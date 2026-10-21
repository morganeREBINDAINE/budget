import { useLocalSearchParams } from 'expo-router';

import { DebtEditorScreen } from '@/features/debts/DebtEditorScreen';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DebtEditorScreen mode="edit" id={id} />;
}
