import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import type { ThemeColor } from '../theme/light';
import { useTheme } from '../theme/ThemeProvider';
import type { ShadowToken } from '../tokens/shadows';

export type FabVariant = 'neutral' | 'accent';

export type FabProps = {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  // Libellé d'accessibilité (le bouton n'affiche que l'icône).
  label: string;
  onPress: () => void;
  variant?: FabVariant;
  // Positionnement (absolu) laissé à l'appelant.
  style?: StyleProp<ViewStyle>;
};

const SIZE = 64;

const variants: Record<
  FabVariant,
  { bg: ThemeColor; bgPressed: ThemeColor; fg: ThemeColor; shadow: ShadowToken }
> = {
  neutral: {
    bg: 'neutralStrong',
    bgPressed: 'neutralStrongPressed',
    fg: 'textOnColor',
    shadow: 'sm',
  },
  accent: { bg: 'accent', bgPressed: 'accentPressed', fg: 'textOnColor', shadow: 'floatAccent' },
};

// Bouton rond flottant de 64px (icône seule).
export function Fab({ icon, label, onPress, variant = 'neutral', style }: FabProps) {
  const { colors, radius, shadows, motion } = useTheme();
  const v = variants[variant];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          width: SIZE,
          height: SIZE,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors[pressed ? v.bgPressed : v.bg],
          transform: [{ scale: pressed ? motion.pressScale : 1 }],
          ...shadows[v.shadow],
        },
        style,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={32} color={colors[v.fg]} />
    </Pressable>
  );
}

// Hauteur à réserver en bas d'une liste pour ne pas masquer le dernier élément sous un Fab.
export const FAB_AREA_HEIGHT = SIZE + 40;
