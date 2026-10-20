import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button, Card, Text, useTheme } from '@/design-system';

type Props = { onRetry: () => Promise<void> };

// Remplace les parties variables d'un écran quand le pull initial a échoué.
export function InitialPullError({ onRetry }: Props) {
  const { colors, spacing } = useTheme();
  return (
    <Card radius="xl" padding="xxl" align="center" gap="sm" variant="flat">
      <MaterialCommunityIcons name="cloud-off-outline" size={36} color={colors.danger} />
      <Text variant="heading" align="center" accessibilityRole="alert">
        Données indisponibles
      </Text>
      <Text variant="bodySmall" color="textSecondary" align="center">
        Impossible de récupérer tes données. Vérifie ta connexion et réessaie.
      </Text>
      <Button
        label="Réessayer"
        variant="secondary"
        onPress={onRetry}
        style={{ marginTop: spacing.sm }}
      />
    </Card>
  );
}
