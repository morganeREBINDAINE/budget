import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Row, useTheme } from '@/design-system';

type Props = { onAddIncome: () => void; onAddExpense: () => void };

const SIZE = 64;

// Boutons flottants « − » (dépense) et « + » (entrée), centrés en bas de l'écran.
export function FabGroup({ onAddIncome, onAddExpense }: Props) {
  const { colors, radius, shadows, spacing, motion } = useTheme();
  const insets = useSafeAreaInsets();

  const fab = (
    icon: 'plus' | 'minus',
    label: string,
    bg: string,
    bgPressed: string,
    fg: string,
    shadow: Pick<ViewStyle, 'boxShadow'>,
    onPress: () => void,
  ) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: SIZE,
        height: SIZE,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? bgPressed : bg,
        transform: [{ scale: pressed ? motion.pressScale : 1 }],
        ...shadow,
      })}
    >
      <MaterialCommunityIcons name={icon} size={32} color={fg} />
    </Pressable>
  );

  return (
    <Row
      justify="center"
      gap="xxl"
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + spacing.xl }}
    >
      {fab(
        'minus',
        'Ajouter une dépense',
        colors.neutralStrong,
        colors.neutralStrongPressed,
        colors.textOnColor,
        shadows.sm,
        onAddExpense,
      )}
      {fab(
        'plus',
        'Ajouter une entrée',
        colors.accent,
        colors.accentPressed,
        colors.onAccent,
        shadows.floatAccent,
        onAddIncome,
      )}
    </Row>
  );
}

// Hauteur à réserver en bas de la liste pour ne pas masquer le dernier élément.
export const FAB_AREA_HEIGHT = SIZE + 40;
