import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, type ListRenderItem } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Fab, FAB_AREA_HEIGHT, screenPadding, Stack, Text, useTheme } from '@/design-system';
import { CategoriesReadError } from '@/features/categories/components/CategoriesReadError';
import { useCategories } from '@/features/categories/useCategories';
import { ReadErrorCard } from '@/features/db/ReadErrorCard';
import { AppHeader } from '@/features/navigation/AppHeader';
import { InitialPullError } from '@/features/sync/components/InitialPullError';
import { LoadingRegion, RowSkeletonList } from '@/features/sync/components/Skeletons';
import { useInitialPull } from '@/features/sync/useInitialPull';
import { toIsoDate } from '@/lib/format';
import { nextDueDate } from '@/lib/recurring';
import type { RecurringPayment } from '@/types/budget';

import { RecurringRow } from './components/RecurringRow';
import { usePaidDueDates, useRecurringPayments } from './useRecurring';

type Item = { payment: RecurringPayment; nextDueDate: string | null };

const openPayment = (id: string) => router.push({ pathname: '/recurring/[id]', params: { id } });

const NO_DUE_DATE = '9999-12-31';

// Actifs d'abord, triés par prochaine échéance ; inactifs ensuite, par nom.
function toSortedItems(
  payments: RecurringPayment[],
  paid: ReadonlyMap<string, readonly string[]>,
  today: string,
): Item[] {
  const items = payments.map((payment) => ({
    payment,
    nextDueDate: nextDueDate(payment, paid.get(payment.id) ?? [], today),
  }));
  const due = (i: Item) => i.nextDueDate ?? NO_DUE_DATE;
  return items.sort(
    (a, b) =>
      Number(b.payment.active) - Number(a.payment.active) ||
      (a.payment.active ? due(a).localeCompare(due(b)) : 0) ||
      a.payment.name.localeCompare(b.payment.name, 'fr'),
  );
}

// Écran principal (menu burger) : liste des paiements réguliers, virtualisée car le nombre peut grandir.
export function RecurringListScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const payments = useRecurringPayments();
  const paid = usePaidDueDates();
  const categories = useCategories();
  const today = toIsoDate(new Date());
  const items = useMemo(
    () =>
      payments.status === 'ready' && paid.status === 'ready'
        ? toSortedItems(payments.data, paid.data, today)
        : [],
    [payments, paid, today],
  );
  const categoriesById = useMemo(
    () => new Map(categories.status === 'ready' ? categories.data.map((c) => [c.id, c]) : []),
    [categories],
  );
  // Pendant le pull initial ou la lecture : skeletons, et actions bloquées par un garde.
  const { ready: pulled, failed } = useInitialPull();
  const readError =
    payments.status === 'error' || paid.status === 'error' || categories.status === 'error';
  const ready =
    pulled &&
    payments.status === 'ready' &&
    paid.status === 'ready' &&
    categories.status === 'ready';
  const addPayment = () => {
    if (!ready) return;
    router.push('/recurring/new');
  };
  // TODO(phase 7) : export JSON.
  const exportData = () => {
    if (!ready) return;
  };

  const renderItem: ListRenderItem<Item> = useCallback(
    ({ item }) => (
      <RecurringRow
        payment={item.payment}
        category={categoriesById.get(item.payment.categoryId)}
        nextDueDate={item.nextDueDate}
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
        data={ready ? items : []}
        keyExtractor={(i) => i.payment.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <Stack gap="xs" style={{ marginBottom: spacing.sm }}>
            <Text variant="title">Paiements réguliers</Text>
            {ready && items.length > 0 ? (
              <Text variant="bodySmall" color="textSecondary">
                À l&apos;échéance, un encart rouge s&apos;affiche sur l&apos;accueil jusqu&apos;à ce
                que tu confirmes le paiement.
              </Text>
            ) : null}
          </Stack>
        }
        ListEmptyComponent={
          failed ? (
            <InitialPullError />
          ) : readError ? (
            categories.status === 'error' ? (
              <CategoriesReadError />
            ) : (
              <ReadErrorCard
                title="Paiements indisponibles"
                message="Impossible de lire les paiements réguliers enregistrés sur le téléphone. Ferme puis rouvre l'application."
              />
            )
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
