import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card, Text, useTheme } from '@/design-system';

type Props = { title: string; message: string };

// Remplace des données dont la lecture dans la base locale a échoué (toast déjà affiché).
export function ReadErrorCard({ title, message }: Props) {
  const { colors } = useTheme();
  return (
    <Card radius="xl" padding="xxl" align="center" gap="sm" variant="flat">
      <MaterialCommunityIcons name="database-alert-outline" size={36} color={colors.danger} />
      <Text variant="heading" align="center" accessibilityRole="alert">
        {title}
      </Text>
      <Text variant="bodySmall" color="textSecondary" align="center">
        {message}
      </Text>
    </Card>
  );
}
