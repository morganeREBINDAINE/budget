import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View } from 'react-native';

import { useTheme } from '@/design-system';

import type { CategoryIconName } from '../allowedCategoryIcons';

type Size = 'sm' | 'md' | 'lg';

type Props = {
  // Nom Material Community Icons (inconnu → icône de repli).
  icon: string;
  // Fond de la tuile : couleur de la catégorie, ou voile `overlayOnColor` sur fond coloré.
  color: string;
  size?: Size;
};

const sizes: Record<Size, { tile: number; icon: number }> = {
  sm: { tile: 36, icon: 20 },
  md: { tile: 48, icon: 24 },
  lg: { tile: 72, icon: 36 },
};

const FALLBACK_ICON: CategoryIconName = 'shape-outline';

const isIconName = (name: string): name is CategoryIconName =>
  name in MaterialCommunityIcons.glyphMap;

// Tuile d'une catégorie : icône blanche sur fond de couleur.
export function CategoryIcon({ icon, color, size = 'md' }: Props) {
  const { colors, radius } = useTheme();
  const s = sizes[size];
  return (
    <View
      style={{
        width: s.tile,
        height: s.tile,
        borderRadius: size === 'lg' ? radius.lg : radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: color,
      }}
    >
      <MaterialCommunityIcons
        name={isIconName(icon) ? icon : FALLBACK_ICON}
        size={s.icon}
        color={colors.textOnColor}
      />
    </View>
  );
}
