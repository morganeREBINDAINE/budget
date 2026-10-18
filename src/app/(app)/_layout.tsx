import { Stack } from 'expo-router';

import { useTheme } from '@/design-system';

export default function AppLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
