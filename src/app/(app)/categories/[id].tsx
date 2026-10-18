import { useLocalSearchParams } from 'expo-router';

import { CategoryEditorScreen } from '@/features/categories/CategoryEditorScreen';
import { mockCategories } from '@/mocks/budget';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CategoryEditorScreen category={mockCategories.find((c) => c.id === id)} />;
}
