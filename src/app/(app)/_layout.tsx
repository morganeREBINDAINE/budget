import { Stack } from 'expo-router';
import type { ComponentProps } from 'react';

import { useTheme } from '@/design-system';
import { MenuProvider } from '@/features/navigation/MenuProvider';

// L'accueil reste la première route de la pile : sans ça, la première route déclarée
// ci-dessous (transaction/new) deviendrait l'écran initial après connexion.
export const unstable_settings = { initialRouteName: 'index' };

export default function AppLayout() {
  const { colors } = useTheme();
  // La feuille (fond assombri + animation) est dessinée par <Sheet> dans l'écran lui-même.
  const sheet: ComponentProps<typeof Stack.Screen>['options'] = {
    presentation: 'transparentModal',
    animation: 'none',
    gestureEnabled: false,
    contentStyle: { backgroundColor: colors.transparent },
  };
  return (
    <MenuProvider>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="transaction/new" options={sheet} />
        <Stack.Screen name="transaction/[id]" options={sheet} />
        <Stack.Screen name="repayment/new" options={sheet} />
        <Stack.Screen name="repayment/[id]" options={sheet} />
      </Stack>
    </MenuProvider>
  );
}
