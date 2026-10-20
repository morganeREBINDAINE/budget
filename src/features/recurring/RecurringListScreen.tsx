import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, type ListRenderItem } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Fab, FAB_AREA_HEIGHT, screenPadding, Stack, Text, useTheme } from '@/design-system';
import { AppHeader } from '@/features/navigation/AppHeader';
import { InitialPullError } from '@/features/sync/components/InitialPullError';
import { LoadingRegion, RowSkeletonList } from '@/features/sync/components/Skeletons';
import { useInitialPull } from '@/features/sync/useInitialPull';
import { mockCategories } from '@/mocks/budget';
import { mockNextDueDates, mockRecurringPayments } from '@/mocks/recurring';
import type { RecurringPayment } from '@/types/budget';

import { RecurringRow } from './components/RecurringRow';

const openPayment = (id: string) => router.push({ pathname: '/recurring/[id]', params: { id } });

const NO_DUE_DATE = '9999-12-31';

// Actifs d'abord, triés par prochaine échéance ; inactifs ensuite, par nom.
function sortPayments(payments: RecurringPayment[]): RecurringPayment[] {
  const due = (p: RecurringPayment) => mockNextDueDates[p.id] ?? NO_DUE_DATE;
  return [...payments].sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      (a.active ? due(a).localeCompare(due(b)) : 0) ||
      a.name.localeCompare(b.name, 'fr'),
  );
}

// Écran principal (menu burger) : liste des paiements réguliers, virtualisée car le nombre peut grandir.
export function RecurringListScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  // TODO(phase 3) : requête SQLite réactive + calcul des échéances (lib/recurring.ts).
  const payments = useMemo(() => sortPayments(mockRecurringPayments), []);
  const categoriesById = useMemo(() => new Map(mockCategories.map((c) => [c.id, c])), []);
  // Pendant le pull initial : skeletons, et actions bloquées par un garde dans chaque handler.
  const { status, ready, retry } = useInitialPull();
  const addPayment = () => {
    if (!ready) return;
    router.push('/recurring/new');
  };
  // TODO(phase 7) : export JSON.
  const exportData = () => {
    if (!ready) return;
  };

  const renderItem: ListRenderItem<RecurringPayment> = useCallback(
    ({ item }) => (
      <RecurringRow
        payment={item}
        category={categoriesById.get(item.categoryId)}
        nextDueDate={mockNextDueDates[item.id] ?? null}
        onPress={openPayment}
      />
    ),
    [categoriesById],
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack style={{ paddingHorizontal: screenPadding }}>
        <AppHeader onExport={exportData} />
      </Stack>
      <FlatList
        data={ready ? payments : []}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <Stack gap="xs" style={{ marginBottom: spacing.sm }}>
            <Text variant="title">Paiements réguliers</Text>
            {ready && payments.length > 0 ? (
              <Text variant="bodySmall" color="textSecondary">
                À l&apos;échéance, un encart rouge s&apos;affiche sur l&apos;accueil jusqu&apos;à ce
                que tu confirmes le paiement.
              </Text>
            ) : null}
          </Stack>
        }
        ListEmptyComponent={
          status === 'error' ? (
            <InitialPullError onRetry={retry} />
          ) : !ready ? (
            <LoadingRegion>
              <RowSkeletonList />
            </LoadingRegion>
          ) : (
            <EmptyRecurring />
          )
        }
        ItemSeparatorComponent={Separator}
        contentContainerStyle={{
          paddingHorizontal: screenPadding,
          paddingTop: spacing.lg,
          paddingBottom: FAB_AREA_HEIGHT + insets.bottom + spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      />
      <Fab
        icon="plus"
        label="Ajouter un paiement régulier"
        onPress={addPayment}
        style={{ position: 'absolute', right: screenPadding, bottom: insets.bottom + spacing.xl }}
      />
    </SafeAreaView>
  );
}

function EmptyRecurring() {
  const { colors } = useTheme();
  return (
    <Card radius="xl" padding="xxl" align="center" gap="sm" variant="flat">
      <MaterialCommunityIcons name="calendar-sync-outline" size={36} color={colors.textMuted} />
      <Text variant="heading">Aucun paiement régulier</Text>
      <Text variant="bodySmall" color="textSecondary" align="center">
        Ajoute ton loyer ou tes abonnements avec « + ».
      </Text>
    </Card>
  );
}

function Separator() {
  const { spacing } = useTheme();
  return <Stack style={{ height: spacing.md }} />;
}
