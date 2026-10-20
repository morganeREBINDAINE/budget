import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import {
  Badge,
  Box,
  Button,
  Card,
  Row,
  Skeleton,
  Stack,
  Text,
  useTheme,
  type BadgeVariant,
  type ThemeColor,
} from '@/design-system';
import { GoogleLogo } from '@/features/auth/GoogleLogo';
import { formatDateTime, formatTime } from '@/lib/format';
import type { SyncStatus } from '@/types/sync';

type Props = {
  // `null` : état pas encore connu (pull initial, lecture de la file) → skeletons.
  status: SyncStatus | null;
  // Promise : spinner et garde du bouton jusqu'à la fin de la synchronisation.
  onSync: () => Promise<unknown>;
  // État `reauth` : reconnexion Google puis synchronisation (Promise : spinner et garde).
  onReconnect: () => Promise<unknown>;
  // Erreur de la dernière reconnexion, affichée au-dessus du bouton.
  reconnectError: string | null;
};

type StateStyle = {
  label: string;
  badge: BadgeVariant;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  fg: ThemeColor;
  bg: ThemeColor;
};

const STATES: Record<SyncStatus['state'], StateStyle> = {
  pending: {
    label: 'En attente',
    badge: 'primary',
    icon: 'cloud-upload-outline',
    fg: 'primary',
    bg: 'primarySoft',
  },
  syncing: {
    label: 'En cours',
    badge: 'primary',
    icon: 'cloud-sync-outline',
    fg: 'primary',
    bg: 'primarySoft',
  },
  synced: {
    label: 'À jour',
    badge: 'success',
    icon: 'cloud-check-outline',
    fg: 'success',
    bg: 'successSoft',
  },
  reauth: {
    label: 'Reconnexion',
    badge: 'danger',
    icon: 'account-alert-outline',
    fg: 'danger',
    bg: 'dangerSoft',
  },
  error: {
    label: 'Erreur',
    badge: 'danger',
    icon: 'cloud-alert-outline',
    fg: 'danger',
    bg: 'dangerSoft',
  },
};

const ICON_BOX = 44;

const pendingText = (count: number) =>
  count === 1 ? '1 élément en attente' : `${count} éléments en attente`;

const lastSyncText = (iso: string | null) =>
  iso ? `Dernière synchro : ${formatDateTime(iso)}` : 'Jamais synchronisé';

// Carte d'état de la synchronisation avec Supabase. Le bouton reste visible même « À jour » :
// la synchronisation récupère aussi les changements faits ailleurs (pull).
export function SyncStatusCard({ status, onSync, onReconnect, reconnectError }: Props) {
  const { colors, radius } = useTheme();
  if (!status) return <SyncStatusCardSkeleton />;
  const s = STATES[status.state];

  return (
    <Card gap="lg">
      <Row gap="md">
        <Row
          justify="center"
          style={{
            width: ICON_BOX,
            height: ICON_BOX,
            borderRadius: radius.md,
            backgroundColor: colors[s.bg],
          }}
        >
          <MaterialCommunityIcons name={s.icon} size={24} color={colors[s.fg]} />
        </Row>
        <Stack flex={1} gap="xxs">
          <Text variant="heading">Synchronisation</Text>
          <Text variant="bodySmall" color="textSecondary">
            {status.state === 'synced'
              ? lastSyncText(status.lastSyncedAt)
              : pendingText(status.pendingCount)}
          </Text>
        </Stack>
        <Badge label={s.label} variant={s.badge} />
      </Row>

      <SyncDetail status={status} />

      {status.state === 'reauth' ? (
        <Stack gap="sm">
          {reconnectError ? (
            <Text variant="bodySmall" color="danger" accessibilityLiveRegion="polite">
              {reconnectError}
            </Text>
          ) : null}
          <Button
            label="Se reconnecter avec Google"
            variant="outline"
            leftIcon={<GoogleLogo />}
            onPress={onReconnect}
            fullWidth
          />
        </Stack>
      ) : (
        <Button
          label={status.state === 'error' ? 'Réessayer' : 'Synchroniser'}
          variant="secondary"
          loading={status.state === 'syncing'}
          onPress={onSync}
          fullWidth
        />
      )}
    </Card>
  );
}

// Pendant le pull initial : textes et badge remplacés, bouton masqué.
function SyncStatusCardSkeleton() {
  return (
    <Card gap="lg" accessible accessibilityRole="progressbar" accessibilityLabel="Chargement">
      <Row gap="md">
        <Skeleton width={ICON_BOX} height={ICON_BOX} radius="md" />
        <Stack flex={1} gap="xxs">
          <Text variant="heading">Synchronisation</Text>
          <Skeleton text="bodySmall" width="60%" />
        </Stack>
        <Skeleton width={72} height={24} radius="full" />
      </Row>
    </Card>
  );
}

function SyncDetail({ status }: { status: SyncStatus }) {
  switch (status.state) {
    case 'syncing':
      return <ProgressBar progress={status.progress} />;
    case 'error':
      return (
        <Stack gap="xs">
          <Text variant="bodySmall" color="danger">
            {status.message}
          </Text>
          {status.nextRetryAt ? (
            <Text variant="bodySmall" color="textSecondary">
              Nouvel essai automatique vers {formatTime(status.nextRetryAt)}
            </Text>
          ) : null}
          <Text variant="bodySmall" color="textMuted">
            {lastSyncText(status.lastSyncedAt)}
          </Text>
        </Stack>
      );
    case 'reauth':
      return (
        <Stack gap="xs">
          <Text variant="bodySmall" color="danger">
            Ta session a expiré. Reconnecte-toi avec le même compte Google
            {status.email ? ` (${status.email})` : ''} pour reprendre la synchronisation. Tes
            données restent sur ce téléphone.
          </Text>
          <Text variant="bodySmall" color="textMuted">
            {lastSyncText(status.lastSyncedAt)}
          </Text>
        </Stack>
      );
    case 'pending':
      return (
        <Text variant="bodySmall" color="textMuted">
          {lastSyncText(status.lastSyncedAt)}
        </Text>
      );
    case 'synced':
      return null;
  }
}

function ProgressBar({ progress }: { progress: number }) {
  const { spacing } = useTheme();
  const percent = Math.round(Math.min(Math.max(progress, 0), 1) * 100);
  return (
    <Stack gap="xs">
      <Box
        bg="surfaceMuted"
        radius="full"
        style={{ height: spacing.sm, overflow: 'hidden' }}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
      >
        <Box bg="primary" radius="full" style={{ height: '100%', width: `${percent}%` }} />
      </Box>
      <Text variant="caption" color="textSecondary" tabular>
        {percent} %
      </Text>
    </Stack>
  );
}
