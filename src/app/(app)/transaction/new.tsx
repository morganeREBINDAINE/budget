import { useLocalSearchParams } from 'expo-router';

import { ScreenPlaceholder } from '@/components/screen-placeholder';

export default function NewTransactionScreen() {
  const { type } = useLocalSearchParams<{ type?: 'income' | 'expense' }>();
  return <ScreenPlaceholder title={type === 'income' ? 'Nouvelle entrée' : 'Nouvelle dépense'} />;
}
