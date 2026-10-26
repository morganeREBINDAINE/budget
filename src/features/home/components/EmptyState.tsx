import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card, Text, useTheme } from '@/design-system';

// Mois sans transaction.
export function EmptyState() {
  const { colors } = useTheme();
  return (
    <Card radius="xl" padding="xxl" align="center" gap="sm" variant="flat">
      <MaterialCommunityIcons name="calendar-blank-outline" size={36} color={colors.textMuted} />
      <Text variant="heading">Aucune transaction</Text>
      <Text variant="bodySmall" color="textSecondary" align="center">
        Ajoute une entrée avec « + » ou une dépense avec « − ».
      </Text>
    </Card>
  );
}

// Recherche sans résultat dans la période affichée.
export function NoResults() {
  const { colors } = useTheme();
  return (
    <Card radius="xl" padding="xxl" align="center" gap="sm" variant="flat">
      <MaterialCommunityIcons name="magnify-close" size={36} color={colors.textMuted} />
      <Text variant="heading">Aucun résultat</Text>
      <Text variant="bodySmall" color="textSecondary" align="center">
        Aucune transaction de cette période ne correspond à la recherche.
      </Text>
    </Card>
  );
}
