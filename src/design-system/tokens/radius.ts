export const radius = {
  none: 0,
  sm: 8,
  md: 12, // rounded-xl : champs, pastilles d'émoji
  lg: 16, // rounded-2xl : cartes, boutons, tuiles
  xl: 24, // rounded-3xl : grande carte (donut)
  xxl: 32, // rounded-t-[32px] : bottom sheet
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radius;
