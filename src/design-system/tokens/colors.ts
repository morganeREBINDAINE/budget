// Palette brute (DESIGN.md + maquette assets/maquettes/accueil/code.html).
// Ne pas utiliser directement dans les écrans : passer par le thème (useTheme().colors).
export const palette = {
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',

  indigo50: '#EEF2FF',
  indigo500: '#6366F1',
  indigo600: '#4F46E5',
  indigo700: '#4338CA',

  emerald50: '#ECFDF5',
  emerald500: '#10B981',
  emerald600: '#059669',
  emerald700: '#047857',

  rose50: '#FFF1F2',
  rose500: '#F43F5E',
  rose600: '#E11D48',

  yellow300: '#FDE047',
  yellow400: '#FACC15',

  orange600: '#EA580C',
  blue600: '#2563EB',
  violet600: '#7C3AED',
  cyan600: '#0891B2',
  amber600: '#D97706',
  fuchsia600: '#C026D3',

  backdrop: 'rgba(15, 23, 42, 0.65)',
  whiteTranslucent: 'rgba(255, 255, 255, 0.2)',
} as const;

// Couleurs des catégories : nuancier arc-en-ciel vif, dans l'ordre du spectre.
// Les catégories (position 1 → 9) les reçoivent dans cet ordre.
export const categoryColors = {
  red: '#EF4444',
  orange: '#F97316',
  amber: '#F59E0B',
  lime: '#84CC16',
  green: '#22C55E',
  cyan: '#06B6D4',
  blue: '#3B82F6',
  violet: '#8B5CF6',
  pink: '#EC4899',
} as const;

export const categoryRainbow = Object.values(categoryColors);

// Couleurs de marque imposées par des chartes externes (logo Google officiel).
export const brandColors = {
  googleBlue: '#4285F4',
  googleRed: '#EA4335',
  googleYellow: '#FBBC05',
  googleGreen: '#34A853',
} as const;

export type PaletteColor = keyof typeof palette;
export type CategoryColor = keyof typeof categoryColors;
