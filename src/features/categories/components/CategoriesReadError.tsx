import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card, Text, useTheme } from '@/design-system';

// Remplace les catégories quand leur lecture dans la base locale a échoué (toast déjà affiché).
export function CategoriesReadError() {
  const { colors } = useTheme();
  return (
    <Card radius="xl" padding="xxl" align="center" gap="sm" variant="flat">
      <MaterialCommunityIcons name="database-alert-outline" size={36} color={colors.danger} />
      <Text variant="heading" align="center" accessibilityRole="alert">
        Catégories indisponibles
      </Text>
      <Text variant="bodySmall" color="textSecondary" align="center">
        Impossible de lire les catégories enregistrées sur le téléphone. Ferme puis rouvre
        l&apos;application.
      </Text>
    </Card>
  );
}
