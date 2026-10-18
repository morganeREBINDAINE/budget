import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Stack, Text, useTheme } from '@/design-system';

type Props = { onRetry: () => Promise<void> };

// Démarrage impossible : la base locale n'a pas pu être ouverte ou migrée.
export function DatabaseErrorScreen({ onRetry }: Props) {
  const { colors } = useTheme();
  const [failedAgain, setFailedAgain] = useState(false);

  // Le bouton affiche un spinner et bloque les appuis tant que la tentative est en cours.
  const retry = async () => {
    setFailedAgain(false);
    try {
      await onRetry();
    } catch {
      setFailedAgain(true);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack flex={1} align="center" justify="center" gap="lg" padding="xxl">
        <MaterialCommunityIcons name="database-alert-outline" size={48} color={colors.danger} />
        <Text variant="title" align="center">
          Impossible de préparer tes données
        </Text>
        <Text variant="body" color="textSecondary" align="center" accessibilityLiveRegion="polite">
          La base locale n&apos;a pas pu être ouverte. Réessaie ; si le problème continue, ferme
          puis relance l&apos;application.
        </Text>
        {failedAgain ? (
          <Text variant="bodySmall" color="danger" align="center" accessibilityLiveRegion="polite">
            Nouvel échec. Ferme complètement l&apos;application puis relance-la.
          </Text>
        ) : null}
        <Button label="Réessayer" variant="secondary" size="lg" onPress={retry} />
      </Stack>
    </SafeAreaView>
  );
}
