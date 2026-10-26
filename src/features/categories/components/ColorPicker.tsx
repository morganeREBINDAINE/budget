import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { categoryColors, minTouchTarget, Row, Stack, Text, useTheme } from '@/design-system';

type Props = {
  value: string;
  onChange: (color: string) => void;
};

const colorNames: Record<keyof typeof categoryColors, string> = {
  red: 'Rouge',
  orange: 'Orange',
  amber: 'Ambre',
  yellow: 'Jaune',
  lime: 'Citron vert',
  green: 'Vert',
  teal: 'Bleu-vert',
  cyan: 'Cyan',
  blue: 'Bleu',
  indigo: 'Indigo',
  violet: 'Violet',
  pink: 'Rose',
};

const COLUMNS = 6;
const SWATCH = minTouchTarget - 8;

const swatches = Object.entries(categoryColors) as [keyof typeof categoryColors, string][];

// Nuancier arc-en-ciel des catégories (12 couleurs fixes : pas de virtualisation).
export function ColorPicker({ value, onChange }: Props) {
  const { colors, radius, spacing, motion } = useTheme();
  return (
    <Stack gap="sm">
      <Text variant="label" color="textSecondary">
        Couleur
      </Text>
      <Row wrap style={{ rowGap: spacing.md }} accessibilityRole="radiogroup">
        {swatches.map(([key, hex]) => {
          const selected = hex.toLowerCase() === value.toLowerCase();
          return (
            <Stack key={key} align="center" style={{ width: `${100 / COLUMNS}%` }}>
              <Pressable
                onPress={() => onChange(hex)}
                accessibilityRole="radio"
                accessibilityLabel={colorNames[key]}
                accessibilityState={{ selected }}
                hitSlop={4}
                style={({ pressed }) => ({
                  width: SWATCH,
                  height: SWATCH,
                  borderRadius: radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: hex,
                  borderWidth: selected ? 3 : 0,
                  borderColor: colors.surface,
                  outlineWidth: selected ? 2 : 0,
                  outlineColor: hex,
                  transform: [{ scale: pressed ? motion.pressScale : 1 }],
                })}
              >
                {selected && (
                  <MaterialCommunityIcons name="check" size={18} color={colors.textOnColor} />
                )}
              </Pressable>
            </Stack>
          );
        })}
      </Row>
    </Stack>
  );
}
