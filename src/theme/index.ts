// Tokens issus du design Stitch « Suivi Budget Hors-Ligne » (palette Tailwind slate / emerald).
export const colors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  primary: '#0F172A',
  onPrimary: '#FFFFFF',
  income: '#059669',
  expense: '#0F172A',
  danger: '#DC2626',
  chart: ['#4338CA', '#10B981', '#F59E0B', '#F97316', '#06B6D4', '#CBD5E1'],
} as const;

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const fontSizes = { xs: 12, sm: 14, md: 16, lg: 18, xl: 24, xxl: 32 } as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { md: 12, lg: 16, xl: 24, full: 9999 } as const;
