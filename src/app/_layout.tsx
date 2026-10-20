import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { DatabaseProvider } from '@/db/DatabaseProvider';
import { ThemeProvider, useTheme } from '@/design-system';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { SupabaseAutoRefresh } from '@/features/auth/SupabaseAutoRefresh';
import { DatabaseErrorScreen } from '@/features/db/DatabaseErrorScreen';
import { ToastHost } from '@/features/feedback/ToastHost';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // Le splash reste affiché jusqu'à ce que la base soit prête (ou en erreur) et le compte local lu.
  const [dbSettled, setDbSettled] = useState(false);
  const markDbSettled = useCallback(() => setDbSettled(true), []);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SupabaseAutoRefresh />
      <KeyboardProvider>
        <ThemeProvider>
          <AuthProvider>
            <SplashGate dbSettled={dbSettled} />
            <DatabaseProvider onSettled={markDbSettled} ErrorScreen={DatabaseErrorScreen}>
              <RootStack />
            </DatabaseProvider>
            <ToastHost />
          </AuthProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function SplashGate({ dbSettled }: { dbSettled: boolean }) {
  const { status } = useAuth();
  const ready = dbSettled && status !== 'loading';
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  return null;
}

// Garde de route : connecté = compte local présent (docs/STORAGE.md §4), même hors ligne.
function RootStack() {
  const { colors } = useTheme();
  const { status } = useAuth();
  if (status === 'loading') return null;
  const signedIn = status === 'signedIn';
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
