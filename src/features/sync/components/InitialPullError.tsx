import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button, Card, Stack, Text, useTheme } from '@/design-system';
import { useAuth } from '@/features/auth/AuthProvider';
import { GoogleLogo } from '@/features/auth/GoogleLogo';

import { useInitialPull } from '../useInitialPull';
import { useReconnect } from '../useReconnect';

// Remplace les parties variables d'un écran quand le pull initial a échoué : « Réessayer », ou
// « Se reconnecter avec Google » si la session a été refusée (un nouvel essai échouerait).
export function InitialPullError() {
  const { colors, spacing } = useTheme();
  const { status, retry } = useInitialPull();
  const { account } = useAuth();
  const { reconnect, error } = useReconnect();

  if (status === 'reauth') {
    const who = account?.email ? `avec ${account.email}` : 'avec ton compte Google';
    return (
      <Card radius="xl" padding="xxl" align="center" gap="sm" variant="flat">
        <MaterialCommunityIcons name="account-alert-outline" size={36} color={colors.danger} />
        <Text variant="heading" align="center" accessibilityRole="alert">
          Reconnexion requise
        </Text>
        <Text variant="bodySmall" color="textSecondary" align="center">
          {`Ta session a expiré. Reconnecte-toi ${who} pour récupérer tes données.`}
        </Text>
        <Stack gap="sm" style={{ marginTop: spacing.sm, alignSelf: 'stretch' }}>
          {error ? (
            <Text
              variant="bodySmall"
              color="danger"
              align="center"
              accessibilityLiveRegion="polite"
            >
              {error}
            </Text>
          ) : null}
          <Button
            label="Se reconnecter avec Google"
            variant="outline"
            leftIcon={<GoogleLogo />}
            onPress={reconnect}
            fullWidth
          />
        </Stack>
      </Card>
    );
  }

  return (
    <Card radius="xl" padding="xxl" align="center" gap="sm" variant="flat">
      <MaterialCommunityIcons name="cloud-off-outline" size={36} color={colors.danger} />
      <Text variant="heading" align="center" accessibilityRole="alert">
        Données indisponibles
      </Text>
      <Text variant="bodySmall" color="textSecondary" align="center">
        Impossible de récupérer tes données. Vérifie ta connexion et réessaie.
      </Text>
      <Button
        label="Réessayer"
        variant="secondary"
        onPress={retry}
        style={{ marginTop: spacing.sm }}
      />
    </Card>
  );
}
