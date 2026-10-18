import { SafeAreaView } from 'react-native-safe-area-context';

import { Stack, Text, useTheme } from '@/design-system';

type Props = { title: string };

// Écran vide temporaire (phase 1), remplacé par le vrai écran en phase 2.
export function PlaceholderScreen({ title }: Props) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack flex={1} align="center" justify="center" gap="sm">
        <Text variant="title">{title}</Text>
        <Text variant="body" color="textSecondary">
          À venir
        </Text>
      </Stack>
    </SafeAreaView>
  );
}
