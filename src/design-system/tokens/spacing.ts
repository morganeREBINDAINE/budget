// Échelle d'espacement (px), alignée sur les valeurs Tailwind de la maquette.
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// Marge latérale d'écran (px-5 dans la maquette).
export const screenPadding = spacing.xl;

// Cible tactile minimale (DESIGN.md §6).
export const minTouchTarget = 48;

export type SpacingToken = keyof typeof spacing;
