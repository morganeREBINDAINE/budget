import type { TextStyle } from 'react-native';

// Noms des polices chargées dans src/app/_layout.tsx.
export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export type FontWeightToken = keyof typeof fontFamily;

type TypographyStyle = Pick<
  TextStyle,
  'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing' | 'textTransform'
>;

// Variantes sémantiques (DESIGN.md §3).
export const typography = {
  display: { fontFamily: fontFamily.extrabold, fontSize: 32, lineHeight: 40, letterSpacing: -0.5 },
  title: { fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 26, letterSpacing: -0.3 },
  heading: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20 },
  bodyCompact: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 18 },
  bodySmall: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16 },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  caption: { fontFamily: fontFamily.semibold, fontSize: 11, lineHeight: 14 },
} as const satisfies Record<string, TypographyStyle>;

export type TypographyVariant = keyof typeof typography;
