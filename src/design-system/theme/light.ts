import { categoryColors, palette } from '../tokens/colors';
import { motion } from '../tokens/motion';
import { radius } from '../tokens/radius';
import { shadows } from '../tokens/shadows';
import { spacing } from '../tokens/spacing';
import { typography } from '../tokens/typography';

// Couleurs sémantiques (DESIGN.md §2.1 et §2.2).
const colors = {
  background: palette.slate50,
  surface: palette.white,
  surfaceMuted: palette.slate100,
  border: palette.slate200,
  borderSubtle: palette.slate100,
  backdrop: palette.backdrop,

  text: palette.slate900,
  textStrong: palette.slate800,
  textSecondary: palette.slate500,
  textMuted: palette.slate400,
  textOnColor: palette.white,

  primary: palette.indigo700,
  primarySoft: palette.indigo50,
  onPrimary: palette.white,

  success: palette.emerald600,
  successStrong: palette.emerald700,
  successSoft: palette.emerald50,

  // Accent vif (bouton « + »), distinct de l'ambre de la catégorie Maison.
  accent: palette.yellow400,
  accentPressed: palette.yellow300,
  onAccent: palette.slate900,

  danger: palette.rose600,
  dangerSoft: palette.rose50,

  neutralStrong: palette.slate900,
  neutralStrongPressed: palette.slate800,

  transparent: palette.transparent,
} as const;

export type ThemeColors = { [K in keyof typeof colors]: string };
export type ThemeColor = keyof ThemeColors;

export type Theme = {
  scheme: 'light' | 'dark';
  colors: ThemeColors;
  categoryColors: { [K in keyof typeof categoryColors]: string };
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  shadows: typeof shadows;
  motion: typeof motion;
};

export const lightTheme: Theme = {
  scheme: 'light',
  colors,
  categoryColors,
  spacing,
  radius,
  typography,
  shadows,
  motion,
};
