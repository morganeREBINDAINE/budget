import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable } from 'react-native';

import {
  Badge,
  Box,
  Button,
  Card,
  Row,
  Stack,
  Text,
  useTheme,
  type BadgeVariant,
  type ThemeColor,
} from '@/design-system';
import { formatDateTime } from '@/lib/format';
import type { SyncStatus } from '@/types/sync';

type Props = {
  status: SyncStatus;
  onSync: () => Promise<unknown>;
  // Phase 2 : un appui sur la carte passe à l'état factice suivant.
  onPress?: () => void;
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

// Carte d'état de la synchronisation avec Supabase.
export function SyncStatusCard({ status, onSync, onPress }: Props) {
  const { colors, radius } = useTheme();
  const s = STATES[status.state];

  return (
    <Pressable onPress={onPress} accessibilityHint="Affiche l'état de synchro suivant">
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

        {status.state !== 'synced' ? (
          <Button
            label={status.state === 'error' ? 'Réessayer' : 'Synchroniser'}
            variant="secondary"
            loading={status.state === 'syncing'}
            onPress={onSync}
            fullWidth
          />
        ) : null}
      </Card>
    </Pressable>
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
