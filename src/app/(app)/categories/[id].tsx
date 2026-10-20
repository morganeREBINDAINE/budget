import { useLocalSearchParams } from 'expo-router';

import { CategoryEditorScreen } from '@/features/categories/CategoryEditorScreen';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CategoryEditorScreen id={id} />;
}
