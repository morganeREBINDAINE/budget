import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDatabase } from '@/db/DatabaseProvider';
import { Button, screenPadding, Stack, Text, useTheme } from '@/design-system';
import { AppLogo } from '@/features/brand/AppLogo';
import { startInitialPull } from '@/sync/initialPull';

import { useAuth } from './AuthProvider';
import { GoogleLogo } from './GoogleLogo';

export function LoginScreen() {
  const { colors, spacing } = useTheme();
  const { signInWithGoogle } = useAuth();
  const db = useDatabase();
  const [error, setError] = useState<string | null>(null);

  // Données du compte récupérées depuis Supabase une fois dans l'app (skeletons pendant le pull).
  const pullAccount = useCallback((userId: string) => void startInitialPull(db, userId), [db]);

  // Promise renvoyée à Button : spinner et garde contre les doubles appuis.
  // En cas de succès, la garde de route (_layout) mène à l'accueil.
  const handleSignIn = async () => {
    setError(null);
    const result = await signInWithGoogle(pullAccount);
    if (result.type === 'error') setError(result.message);
  };

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
      <Stack gap="sm">
        {error ? (
          <Text variant="bodySmall" color="danger" align="center" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button
          label="Continuer avec Google"
          variant="outline"
          size="lg"
          fullWidth
          leftIcon={<GoogleLogo />}
          onPress={handleSignIn}
        />
      </Stack>
    </SafeAreaView>
  );
}
