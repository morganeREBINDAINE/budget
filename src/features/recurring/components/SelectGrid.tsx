import { Pressable } from 'react-native';

import { minTouchTarget, Row, Stack, Text, useTheme } from '@/design-system';

export type SelectGridItem = { value: number; label: string; accessibilityLabel?: string };

type Props = {
  label: string;
  items: SelectGridItem[];
  columns: number;
  value: number | null;
  onChange: (value: number) => void;
  hint?: string;
  error?: string;
};

// Grille de choix exclusif (jours du mois, mois) ; sélection en noir.
export function SelectGrid({ label, items, columns, value, onChange, hint, error }: Props) {
  const { colors, radius, spacing, motion } = useTheme();
  return (
    <Stack gap="xs">
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <Row
        wrap
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={{ marginHorizontal: -spacing.xxs }}
      >
        {items.map((item) => {
          const selected = item.value === value;
          return (
            <Stack key={item.value} style={{ width: `${100 / columns}%`, padding: spacing.xxs }}>
              <Pressable
                onPress={() => onChange(item.value)}
                accessibilityRole="radio"
                accessibilityLabel={item.accessibilityLabel ?? item.label}
                accessibilityState={{ selected }}
                style={({ pressed }) => ({
                  minHeight: minTouchTarget - spacing.xs,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: selected
                    ? colors.neutralStrong
                    : error
                      ? colors.danger
                      : colors.borderSubtle,
                  backgroundColor: selected
                    ? colors.neutralStrong
                    : pressed
                      ? colors.surfaceMuted
                      : colors.surface,
                  transform: [{ scale: pressed ? motion.pressScale : 1 }],
                })}
              >
                <Text
                  variant="bodyCompact"
                  weight="bold"
                  color={selected ? 'textOnColor' : 'textStrong'}
                  tabular
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </Pressable>
            </Stack>
          );
        })}
      </Row>
      {error ? (
        <Text variant="bodySmall" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="bodySmall" color="textSecondary">
          {hint}
        </Text>
      ) : null}
    </Stack>
  );
}
