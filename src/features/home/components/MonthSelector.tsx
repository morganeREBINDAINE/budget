import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { minTouchTarget, Row, Text, useTheme } from '@/design-system';
import { formatMonthYear, type YearMonth } from '@/lib/format';

const PILL_MIN_WIDTH = 168;

type Props = {
  value: YearMonth;
  onPrevious: () => void;
  onNext: () => void;
};

// Sélecteur ‹ Mois Année ›.
export function MonthSelector({ value, onPrevious, onNext }: Props) {
  const { colors, radius, shadows } = useTheme();

  const arrow = (icon: 'chevron-left' | 'chevron-right', label: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: minTouchTarget,
        height: minTouchTarget,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        ...shadows.xs,
      })}
    >
      <MaterialCommunityIcons name={icon} size={24} color={colors.text} />
    </Pressable>
  );

  return (
    <Row justify="center" gap="md">
      {arrow('chevron-left', 'Mois précédent', onPrevious)}
      <PeriodPill label={formatMonthYear(value)} />
      {arrow('chevron-right', 'Mois suivant', onNext)}
    </Row>
  );
}

// Pastille de la période affichée ; seule (sans flèches) en vue à l'année.
export function PeriodPill({ label }: { label: string }) {
  return (
    <Row
      gap="sm"
      justify="center"
      bg="surface"
      borderColor="borderSubtle"
      radius="full"
      shadow="xs"
      paddingX="lg"
      style={{ height: minTouchTarget, minWidth: PILL_MIN_WIDTH, alignSelf: 'center' }}
    >
      <Text variant="body" weight="semibold" numberOfLines={1}>
        {label}
      </Text>
    </Row>
  );
}
