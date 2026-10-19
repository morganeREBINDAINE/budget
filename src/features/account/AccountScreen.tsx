import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useRef, useState, type ComponentProps } from 'react';
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
import { useAuth } from '@/features/auth/AuthProvider';
import { AppHeader } from '@/features/navigation/AppHeader';
import { fakeRequest, mockProfile, mockSyncStatuses } from '@/mocks/account';
import type { SyncStatus } from '@/types/sync';

import { ProfileCard } from './components/ProfileCard';
import { SyncStatusCard } from './components/SyncStatusCard';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const pendingCountOf = (status: SyncStatus) =>
  status.state === 'synced' ? 0 : status.pendingCount;

export function AccountScreen() {
  const { colors, spacing } = useTheme();
  const { signOut } = useAuth();
  const [statusIndex, setStatusIndex] = useState(0);
  const [syncOverride, setSyncOverride] = useState<SyncStatus | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const syncing = useRef(false);

  const status = syncOverride ?? mockSyncStatuses[statusIndex];
  const pendingCount = pendingCountOf(status);

  const icon = (name: IconName, color = colors.primary) => (
    <MaterialCommunityIcons name={name} size={22} color={color} />
  );

  // Phase 2 : un appui sur la carte affiche l'état factice suivant.
  const nextStatus = useCallback(() => {
    if (syncing.current) return;
    setSyncOverride(null);
    setStatusIndex((i) => (i + 1) % mockSyncStatuses.length);
  }, []);

  // TODO(phase 6) : vraie synchro.
  const sync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    setSyncOverride({ state: 'syncing', progress: 0.6, pendingCount });
    try {
      await fakeRequest(1500);
      setSyncOverride({ state: 'synced', lastSyncedAt: new Date().toISOString() });
    } catch {
      setSyncOverride({
        state: 'error',
        message: 'La synchronisation a échoué. Réessaie plus tard.',
        pendingCount,
        lastSyncedAt: null,
      });
    } finally {
      syncing.current = false;
    }
  }, [pendingCount]);

  // TODO(phase 7) : écrire le fichier JSON puis ouvrir la feuille de partage.
  const exportData = useCallback(async () => {
    setActionError(null);
    try {
      await fakeRequest();
    } catch {
      setActionError("L'export a échoué. Réessaie.");
    }
  }, []);

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
        <ProfileCard name={mockProfile.name} email={mockProfile.email} />
        <SyncStatusCard status={status} onSync={sync} onPress={nextStatus} />

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
            />
            <ListItem
              label="Importer"
              description="Remplace toutes les données"
              icon={icon('tray-arrow-up')}
              onPress={() => {
                setImportError(null);
                setImportOpen(true);
              }}
              showChevron={false}
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
          pendingCount > 0
            ? `${pendingCount} élément${pendingCount > 1 ? 's' : ''} pas encore synchronisé${pendingCount > 1 ? 's' : ''}. ${pendingCount > 1 ? 'Ils restent' : 'Il reste'} sur ce téléphone et ${pendingCount > 1 ? 'seront envoyés' : 'sera envoyé'} à ta prochaine connexion avec ce compte.`
            : 'Toutes tes données sont synchronisées.'
        }
        confirmLabel="Se déconnecter"
        variant="danger"
        // TODO(phase 6) : synchro tentée avant la déconnexion si en ligne, vrai nombre en attente.
        onConfirm={async () => {
          setLogoutError(null);
          try {
            await signOut();
          } catch (e) {
            console.error('[auth] déconnexion impossible', e);
            setLogoutError('La déconnexion a échoué. Réessaie.');
          }
        }}
        onCancel={() => {
          setLogoutOpen(false);
          setLogoutError(null);
        }}
        error={logoutError}
      />
    </SafeAreaView>
  );
}
