import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState, type ComponentProps } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Card,
  ConfirmDialog,
  ListItem,
  screenPadding,
  Stack,
  Text,
  useTheme,
} from '@/design-system';
import { useDatabase } from '@/db/DatabaseProvider';
import { useAuth, useUserId } from '@/features/auth/AuthProvider';
import { useExportData } from '@/features/backup/useExportData';
import { useImportData } from '@/features/backup/useImportData';
import { AppHeader } from '@/features/navigation/AppHeader';
import { useInitialPull } from '@/features/sync/useInitialPull';
import { formatShortDate, toIsoDate } from '@/lib/format';
import { pendingSyncCount } from '@/repositories/syncQueue';
import type { BackupSummary } from '@/backup/format';
import { syncNow } from '@/sync/syncNow';

import { ProfileCard } from './components/ProfileCard';
import { SyncStatusCard } from './components/SyncStatusCard';
import { usePendingSyncCount } from './usePendingSyncCount';
import { useSyncStatus } from './useSyncStatus';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type PendingSyncCount = ReturnType<typeof usePendingSyncCount>;

// Avertissement de la modale de déconnexion (docs/STORAGE.md §4) : les éléments non envoyés
// restent sur le téléphone et partiront à la prochaine connexion avec ce compte.
function logoutMessage(pending: PendingSyncCount): string {
  switch (pending.status) {
    case 'loading':
      return 'Vérification des éléments en attente…';
    case 'error':
      return 'Impossible de vérifier les éléments en attente. Tes données restent sur ce téléphone.';
    case 'ready': {
      const n = pending.count;
      if (n === 0) return 'Toutes tes données sont synchronisées.';
      return n > 1
        ? `${n} éléments pas encore synchronisés. Ils restent sur ce téléphone et seront envoyés à ta prochaine connexion avec ce compte.`
        : '1 élément pas encore synchronisé. Il reste sur ce téléphone et sera envoyé à ta prochaine connexion avec ce compte.';
    }
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

// Modale d'import : contenu du fichier choisi, puis avertissement (toutes les données écrasées).
function importMessage(summary: BackupSummary): string {
  const date = formatShortDate(toIsoDate(new Date(summary.exportedAt)));
  const content = [
    plural(summary.transactions, 'entrée ou dépense', 'entrées et dépenses'),
    plural(summary.recurringPayments, 'paiement régulier', 'paiements réguliers'),
    plural(summary.debts, 'dette', 'dettes'),
  ].join(', ');
  return `Sauvegarde du ${date} : ${content}.

Toutes les données actuelles de ce compte seront écrasées par celles du fichier. Cette action est irréversible.`;
}

export function AccountScreen() {
  const { colors, spacing } = useTheme();
  const { account, signOut } = useAuth();
  const pendingSync = usePendingSyncCount();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  // Après un envoi incomplet avant déconnexion : raison affichée, second appui = déconnexion.
  const [logoutBlocked, setLogoutBlocked] = useState<string | null>(null);
  // Synchronisation, export et import bloqués pendant le pull initial (garde dans les handlers).
  // Session refusée pendant le pull : la carte passe en « Reconnexion requise ».
  const { status: pullStatus, ready } = useInitialPull();
  const pullNeedsReauth = pullStatus === 'reauth';
  const db = useDatabase();
  const userId = useUserId();
  const { status: syncStatus, sync, reconnect, reconnectError } = useSyncStatus();
  // Une seule instance pour l'icône de la barre haute et la ligne « Exporter » (garde partagée).
  const { exportData, exporting, error: exportError } = useExportData({ errorDisplay: 'inline' });
  const backupImport = useImportData();

  const syncData = useCallback(async () => {
    if (!ready) return;
    await sync();
  }, [ready, sync]);

  const reconnectAccount = useCallback(async () => {
    if (!ready && !pullNeedsReauth) return;
    await reconnect();
  }, [ready, pullNeedsReauth, reconnect]);

  // Déconnexion (docs/STORAGE.md §4) : premier appui = envoi de la file si elle n'est pas vide
  // (hors ligne : aucun appel). S'il reste des éléments, la modale reste ouverte avec la raison et
  // le nombre restant ; le second appui déconnecte sans rien supprimer.
  const confirmLogout = useCallback(async () => {
    setLogoutError(null);
    if (logoutBlocked === null && pendingSyncCount(db, userId) > 0) {
      const result = await syncNow(db, userId, { pull: false });
      if (pendingSyncCount(db, userId) > 0) {
        setLogoutBlocked(
          result.ok
            ? 'L’envoi n’a pas abouti.'
            : {
                offline: 'Hors ligne : envoi impossible.',
                session: 'Session expirée : envoi impossible.',
                failed: 'L’envoi n’a pas abouti.',
              }[result.reason],
        );
        return;
      }
    }
    try {
      await signOut();
    } catch (e) {
      console.error('[auth] déconnexion impossible', e);
      setLogoutError('La déconnexion a échoué. Réessaie.');
    }
  }, [db, userId, logoutBlocked, signOut]);

  const icon = (name: IconName, color = colors.primary) => (
    <MaterialCommunityIcons name={name} size={22} color={color} />
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack style={{ paddingHorizontal: screenPadding }}>
        <AppHeader onExport={exportData} exporting={exporting} />
      </Stack>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: screenPadding,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxxl,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <ProfileCard name={account?.name ?? null} email={account?.email ?? null} />
        <SyncStatusCard
          status={ready || pullNeedsReauth ? syncStatus : null}
          onSync={syncData}
          onReconnect={reconnectAccount}
          reconnectError={reconnectError}
        />

        <Stack gap="sm">
          <Text variant="label" color="textSecondary">
            Données
          </Text>
          <Card padding="xs">
            <ListItem
              label="Catégories"
              description="Nom, couleur et icône des 12 catégories"
              icon={icon('shape-outline')}
              onPress={() => router.push('/categories')}
            />
            <ListItem
              label="Exporter"
              description="Sauvegarde JSON complète"
              icon={icon('tray-arrow-down')}
              onPress={exportData}
              showChevron={false}
              disabled={!ready}
            />
            <ListItem
              label="Importer"
              description="Remplace toutes les données"
              icon={icon('tray-arrow-up')}
              onPress={backupImport.pickFile}
              showChevron={false}
              disabled={!ready}
            />
          </Card>
          {[exportError, backupImport.pickError].map((error) =>
            error ? (
              <Text key={error} variant="bodySmall" color="danger" accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null,
          )}
        </Stack>

        <Card padding="xs">
          <ListItem
            label="Déconnexion"
            variant="danger"
            icon={icon('logout', colors.danger)}
            onPress={() => setLogoutOpen(true)}
            showChevron={false}
          />
        </Card>
      </ScrollView>

      <ConfirmDialog
        visible={backupImport.summary !== null}
        title="Remplacer toutes les données ?"
        message={backupImport.summary ? importMessage(backupImport.summary) : undefined}
        confirmLabel="Remplacer mes données"
        variant="danger"
        onConfirm={backupImport.confirmImport}
        onCancel={backupImport.cancel}
        error={backupImport.importError}
      />
      <ConfirmDialog
        visible={logoutOpen}
        title="Se déconnecter ?"
        message={
          logoutBlocked
            ? `${logoutBlocked} ${logoutMessage(pendingSync)}`
            : logoutMessage(pendingSync)
        }
        confirmLabel={logoutBlocked ? 'Se déconnecter quand même' : 'Se déconnecter'}
        variant="danger"
        onConfirm={confirmLogout}
        onCancel={() => {
          setLogoutOpen(false);
          setLogoutError(null);
          setLogoutBlocked(null);
        }}
        error={logoutError}
      />
    </SafeAreaView>
  );
}
