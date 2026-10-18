import { useLocalSearchParams } from 'expo-router';

import { DebtEditorScreen } from '@/features/debts/DebtEditorScreen';
import { mockDebts } from '@/mocks/debts';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DebtEditorScreen mode="edit" debt={mockDebts.find((d) => d.id === id)} />;
}
