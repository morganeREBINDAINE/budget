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
import { useCallback } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { DatabaseProvider } from '@/db/DatabaseProvider';
import { ThemeProvider, useTheme } from '@/design-system';
import { MockSessionProvider, useSession } from '@/features/auth/MockSession';
import { SupabaseAutoRefresh } from '@/features/auth/SupabaseAutoRefresh';
import { DatabaseErrorScreen } from '@/features/db/DatabaseErrorScreen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // Le splash reste affiché jusqu'à ce que la base soit prête (ou en erreur).
  const hideSplash = useCallback(() => {
    void SplashScreen.hideAsync();
  }, []);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SupabaseAutoRefresh />
      <KeyboardProvider>
        <ThemeProvider>
          <DatabaseProvider onSettled={hideSplash} ErrorScreen={DatabaseErrorScreen}>
            <MockSessionProvider>
              <RootStack />
            </MockSessionProvider>
          </DatabaseProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const { colors } = useTheme();
  const { signedIn } = useSession();
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
