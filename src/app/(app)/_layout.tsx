import { Stack } from 'expo-router';
import type { ComponentProps } from 'react';

import { useTheme } from '@/design-system';

// Feuille native ouverte aux 2/3 de l'écran.
const SHEET_DETENT = 0.66;

export default function AppLayout() {
  const { colors, radius } = useTheme();
  const sheet: ComponentProps<typeof Stack.Screen>['options'] = {
    presentation: 'formSheet',
    sheetAllowedDetents: [SHEET_DETENT],
    sheetGrabberVisible: true,
    sheetCornerRadius: radius.xxl,
    contentStyle: { backgroundColor: colors.surface },
  };
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Screen name="transaction/new" options={sheet} />
      <Stack.Screen name="transaction/[id]" options={sheet} />
    </Stack>
  );
}
