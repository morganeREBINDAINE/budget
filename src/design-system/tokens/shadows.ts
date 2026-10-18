import type { ViewStyle } from 'react-native';

// Ombres de la maquette, en `boxShadow` (New Architecture, ombres multiples).
export const shadows = {
  none: { boxShadow: 'none' },
  xs: { boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' },
  sm: { boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)' },
  card: { boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)' },
  soft: { boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)' },
  float: { boxShadow: '0 12px 36px -4px rgba(79, 70, 229, 0.35)' },
  floatGreen: { boxShadow: '0 10px 25px -3px rgba(16, 185, 129, 0.3)' },
} as const satisfies Record<string, Pick<ViewStyle, 'boxShadow'>>;

export type ShadowToken = keyof typeof shadows;
