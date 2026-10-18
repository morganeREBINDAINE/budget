import { useLocalSearchParams } from 'expo-router';

import { DebtEditorScreen } from '@/features/debts/DebtEditorScreen';
import { parseDirection } from '@/features/debts/direction';

export default function Screen() {
  const { direction } = useLocalSearchParams<{ direction?: string }>();
  return <DebtEditorScreen mode="new" direction={parseDirection(direction)} />;
}
