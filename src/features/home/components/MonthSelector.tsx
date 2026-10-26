import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import { minTouchTarget, Row, Text, useTheme } from '@/design-system';
import { formatMonthYear, type YearMonth } from '@/lib/format';

const PILL_MIN_WIDTH = 168;

type Props = {
  value: YearMonth;
  onPrevious: () => void;
  onNext: () => void;
  // Action à droite du sélecteur (ex. choix de la vue) : la pastille s'étire sur la place restante.
  trailing?: ReactNode;
};

// Sélecteur ‹ Mois Année ›.
export function MonthSelector({ value, onPrevious, onNext, trailing }: Props) {
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
    <Row justify="center" gap={trailing ? 'sm' : 'md'}>
      {arrow('chevron-left', 'Mois précédent', onPrevious)}
      <PeriodPill label={formatMonthYear(value)} stretch={trailing !== undefined} />
      {arrow('chevron-right', 'Mois suivant', onNext)}
      {trailing}
    </Row>
  );
}

// Pastille de la période affichée ; seule (sans flèches) en vue à l'année.
// `stretch` : occupe la place restante de la ligne (sans largeur minimale).
export function PeriodPill({ label, stretch = false }: { label: string; stretch?: boolean }) {
  return (
    <Row
      gap="sm"
      justify="center"
      bg="surface"
      borderColor="borderSubtle"
      radius="full"
      shadow="xs"
      paddingX="lg"
      style={[
        { height: minTouchTarget, alignSelf: 'center' },
        stretch ? { flex: 1 } : { minWidth: PILL_MIN_WIDTH },
      ]}
    >
      <Text variant="body" weight="semibold" numberOfLines={1}>
        {label}
      </Text>
    </Row>
  );
}
