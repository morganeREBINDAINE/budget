import { SafeAreaView } from 'react-native-safe-area-context';

import { screenPadding, Stack, Text, useTheme } from '@/design-system';
import { AppHeader } from '@/features/navigation/AppHeader';

// withAppHeader : écran principal (accessible depuis le menu burger).
type Props = { title: string; withAppHeader?: boolean };

// Écran vide temporaire (phase 1), remplacé par le vrai écran en phase 2.
export function PlaceholderScreen({ title, withAppHeader = false }: Props) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {withAppHeader && (
        <Stack style={{ paddingHorizontal: screenPadding }}>
          {/* TODO(phase 7) : export JSON. */}
          <AppHeader onExport={() => {}} />
        </Stack>
      )}
      <Stack flex={1} align="center" justify="center" gap="sm">
        <Text variant="title">{title}</Text>
        <Text variant="body" color="textSecondary">
          À venir
        </Text>
      </Stack>
    </SafeAreaView>
  );
}
