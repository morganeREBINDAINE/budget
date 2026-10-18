import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { Row, Stack, Text, useTheme } from '@/design-system';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import type { Category } from '@/types/budget';

type Props = {
  categories: Category[];
  value: string | null;
  onChange: (id: string) => void;
  error?: string;
};

const COLUMNS = 3;
const CHECK_SIZE = 16;

// Grille 3×3 des catégories (9 au maximum : pas de virtualisation).
export function CategoryGrid({ categories, value, onChange, error }: Props) {
  const { colors, radius, spacing, shadows, motion } = useTheme();

  return (
    <Stack gap="sm">
      <Text variant="label" color="textSecondary">
        Sélectionner une catégorie
      </Text>
      <Row wrap style={{ marginHorizontal: -spacing.xs }} accessibilityRole="radiogroup">
        {categories.map((c) => {
          const selected = c.id === value;
          return (
            <Stack key={c.id} style={{ width: `${100 / COLUMNS}%`, padding: spacing.xs }}>
              <Pressable
                onPress={() => onChange(c.id)}
                accessibilityRole="radio"
                accessibilityLabel={c.name}
                accessibilityState={{ selected }}
                style={({ pressed }) => ({
                  aspectRatio: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.xs,
                  padding: spacing.sm,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: selected ? c.color : colors.borderSubtle,
                  backgroundColor: selected ? c.color : colors.surface,
                  transform: [{ scale: pressed ? motion.pressScale : 1 }],
                  ...(selected ? shadows.sm : shadows.xs),
                })}
              >
                {selected && (
                  <Stack
                    align="center"
                    justify="center"
                    style={{
                      position: 'absolute',
                      top: spacing.sm,
                      right: spacing.sm,
                      width: CHECK_SIZE,
                      height: CHECK_SIZE,
                      borderRadius: radius.full,
                      backgroundColor: colors.overlayOnColor,
                    }}
                  >
                    <MaterialCommunityIcons name="check" size={12} color={colors.textOnColor} />
                  </Stack>
                )}
                <CategoryIcon
                  icon={c.icon}
                  color={selected ? colors.overlayOnColor : c.color}
                  size="sm"
                />
                <Text
                  variant="bodyCompact"
                  weight="bold"
                  color={selected ? 'textOnColor' : 'textStrong'}
                  numberOfLines={1}
                >
                  {c.name}
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
      ) : null}
    </Stack>
  );
}
