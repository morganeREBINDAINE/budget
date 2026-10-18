import { Pressable } from 'react-native';

import { Row } from '../primitives/Row';
import { Stack } from '../primitives/Stack';
import { Text } from '../primitives/Text';
import { useTheme } from '../theme/ThemeProvider';
import { minTouchTarget } from '../tokens/spacing';

export type SegmentedOption<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  // Libellé uppercase au-dessus (comme Input).
  label?: string;
};

// Choix exclusif entre 2 ou 3 options (ex. Mensuel / Annuel, onglets).
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps<T>) {
  const { colors, radius, spacing, shadows, motion } = useTheme();
  return (
    <Stack gap="xs">
      {label ? (
        <Text variant="label" color="textSecondary">
          {label}
        </Text>
      ) : null}
      <Row
        bg="surfaceMuted"
        radius="lg"
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={{ padding: spacing.xxs, minHeight: minTouchTarget }}
      >
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ selected }}
              style={({ pressed }) => ({
                flex: 1,
                alignSelf: 'stretch',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: spacing.md,
                borderRadius: radius.md,
                backgroundColor: selected ? colors.surface : colors.transparent,
                transform: [{ scale: pressed && !selected ? motion.pressScale : 1 }],
                ...(selected ? shadows.xs : shadows.none),
              })}
            >
              <Text
                variant="body"
                weight="bold"
                color={selected ? 'textStrong' : 'textSecondary'}
                numberOfLines={1}
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </Row>
    </Stack>
  );
}
