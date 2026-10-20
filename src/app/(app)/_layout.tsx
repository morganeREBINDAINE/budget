import { Stack } from 'expo-router';
import { useEffect, type ComponentProps } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { useTheme } from '@/design-system';
import { useUserId } from '@/features/auth/AuthProvider';
import { MenuProvider } from '@/features/navigation/MenuProvider';
import { resumeInitialPull } from '@/sync/initialPull';

// L'accueil reste la première route de la pile : sans ça, la première route déclarée
// ci-dessous (transaction/new) deviendrait l'écran initial après connexion.
export const unstable_settings = { initialRouteName: 'index' };

export default function AppLayout() {
  const { colors } = useTheme();
  const db = useDatabase();
  const userId = useUserId();
  // Compte jamais récupéré sur ce téléphone (ex. échec du pull puis app fermée) : on relance.
  useEffect(() => resumeInitialPull(db, userId), [db, userId]);
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
