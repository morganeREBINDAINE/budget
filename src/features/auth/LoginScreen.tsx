import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, screenPadding, Stack, Text, useTheme } from '@/design-system';
import { AppLogo } from '@/features/brand/AppLogo';

import { GoogleLogo } from './GoogleLogo';
import { useSession } from './MockSession';

export function LoginScreen() {
  const { colors, spacing } = useTheme();
  const { signIn } = useSession();

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: screenPadding,
        paddingBottom: spacing.xxl,
      }}
    >
      <Stack flex={1} align="center" justify="center" gap="lg">
        <AppLogo size={88} />
        <Text variant="display">Budget</Text>
        <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
          Suivez votre budget, même hors ligne
        </Text>
      </Stack>
      {/* TODO(phase 5) : connexion Google native → signInWithIdToken. */}
      <Button
        label="Continuer avec Google"
        variant="outline"
        size="lg"
        fullWidth
        leftIcon={<GoogleLogo />}
        onPress={signIn}
      />
    </SafeAreaView>
  );
}
