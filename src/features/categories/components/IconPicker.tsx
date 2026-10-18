import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { Row, Stack, Text, useTheme } from '@/design-system';

import { allowedCategoryIcons } from '../allowedCategoryIcons';

type Props = {
  value: string;
  // Couleur de la catégorie : fond des tuiles.
  color: string;
  onChange: (icon: string) => void;
};

const COLUMNS = 6;

// Grille des icônes autorisées, blanches sur la couleur de la catégorie.
// Liste fixe d'une quarantaine d'icônes : pas de virtualisation.
export function IconPicker({ value, color, onChange }: Props) {
  const { colors, radius, spacing, motion } = useTheme();
  return (
    <Stack gap="sm">
      <Text variant="label" color="textSecondary">
        Icône
      </Text>
      <Row wrap style={{ marginHorizontal: -spacing.xs }} accessibilityRole="radiogroup">
        {allowedCategoryIcons.map((name) => {
          const selected = name === value;
          return (
            <Stack key={name} style={{ width: `${100 / COLUMNS}%`, padding: spacing.xs }}>
              <Pressable
                onPress={() => onChange(name)}
                accessibilityRole="radio"
                accessibilityLabel={name}
                accessibilityState={{ selected }}
                style={({ pressed }) => ({
                  aspectRatio: 1,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? color : colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: selected ? color : colors.borderSubtle,
                  transform: [{ scale: pressed ? motion.pressScale : 1 }],
                })}
              >
                <MaterialCommunityIcons
                  name={name}
                  size={22}
                  color={selected ? colors.textOnColor : color}
                />
              </Pressable>
            </Stack>
          );
        })}
      </Row>
    </Stack>
  );
}
