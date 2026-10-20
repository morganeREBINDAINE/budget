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
import { AppHeader } from '@/features/navigation/AppHeader';
import { useInitialPull } from '@/features/sync/useInitialPull';
import { fakeRequest } from '@/mocks/account';
import { pendingSyncCount } from '@/repositories/syncQueue';
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

export function AccountScreen() {
  const { colors, spacing } = useTheme();
  const { account, signOut } = useAuth();
  const pendingSync = usePendingSyncCount();
  const [actionError, setActionError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  // Après un envoi incomplet avant déconnexion : raison affichée, second appui = déconnexion.
  const [logoutBlocked, setLogoutBlocked] = useState<string | null>(null);
  // Synchronisation, export et import bloqués pendant le pull initial (garde dans les handlers).
  const { ready } = useInitialPull();
  const db = useDatabase();
  const userId = useUserId();
  const { status: syncStatus, sync } = useSyncStatus();

  const syncData = useCallback(async () => {
    if (!ready) return;
    await sync();
  }, [ready, sync]);

  // Déconnexion (docs/STORAGE.md §4) : premier appui = envoi de la file si elle n'est pas vide
  // (hors ligne : aucun appel). S'il reste des éléments, la modale reste ouverte avec la raison et
  // le nombre restant ; le second appui déconnecte sans rien supprimer.
  const confirmLogout = useCallback(async () => {
    setLogoutError(null);
    if (logoutBlocked === null && pendingSyncCount(db, userId) > 0) {
      const result = await syncNow(db, userId, { pull: false });
      if (pendingSyncCount(db, userId) > 0) {
        setLogoutBlocked(
          !result.ok && result.reason === 'offline'
            ? 'Hors ligne : envoi impossible.'
            : 'L’envoi n’a pas abouti.',
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

  // TODO(phase 7) : écrire le fichier JSON puis ouvrir la feuille de partage.
  const exportData = useCallback(async () => {
    if (!ready) return;
    setActionError(null);
    try {
      await fakeRequest();
    } catch {
      setActionError("L'export a échoué. Réessaie.");
    }
  }, [ready]);

  // TODO(phase 7) : choisir le fichier, valider, remplacer les données locales.
  const importData = useCallback(async () => {
    setImportError(null);
    try {
      await fakeRequest();
      setImportOpen(false);
    } catch {
      setImportError("L'import a échoué : fichier illisible ou invalide.");
    }
  }, []);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack style={{ paddingHorizontal: screenPadding }}>
        <AppHeader onExport={exportData} />
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
        <SyncStatusCard status={ready ? syncStatus : null} onSync={syncData} />

        <Stack gap="sm">
          <Text variant="label" color="textSecondary">
            Données
          </Text>
          <Card padding="xs">
            <ListItem
              label="Catégories"
              description="Nom, couleur et icône des 9 catégories"
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
              onPress={() => {
                if (!ready) return;
                setImportError(null);
                setImportOpen(true);
              }}
              showChevron={false}
              disabled={!ready}
            />
          </Card>
          {actionError ? (
            <Text variant="bodySmall" color="danger" accessibilityLiveRegion="polite">
              {actionError}
            </Text>
          ) : null}
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
        visible={importOpen}
        title="Importer une sauvegarde ?"
        message="Toutes les données actuelles seront remplacées par celles du fichier."
        confirmLabel="Choisir le fichier"
        variant="danger"
        onConfirm={importData}
        onCancel={() => setImportOpen(false)}
        error={importError}
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
