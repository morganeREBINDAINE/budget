import { Stack } from 'expo-router';

import { fontFamily, useTheme } from '@/design-system';

export default function AppLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: fontFamily.bold, color: colors.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="transaction/new" options={{ title: 'Nouvelle transaction' }} />
      <Stack.Screen name="transaction/[id]" options={{ title: 'Modifier' }} />
      <Stack.Screen name="account" options={{ title: 'Compte' }} />
      <Stack.Screen name="categories/index" options={{ title: 'Catégories' }} />
      <Stack.Screen name="categories/[id]" options={{ title: 'Catégorie' }} />
    </Stack>
  );
}
