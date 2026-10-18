import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, type ListRenderItem } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Card,
  Fab,
  FAB_AREA_HEIGHT,
  screenPadding,
  ScreenHeader,
  Stack,
  Text,
  useTheme,
} from '@/design-system';
import { mockCategories } from '@/mocks/budget';
import { mockNextDueDates, mockRecurringPayments } from '@/mocks/recurring';
import type { RecurringPayment } from '@/types/budget';

import { RecurringRow } from './components/RecurringRow';

const openPayment = (id: string) => router.push({ pathname: '/recurring/[id]', params: { id } });
const addPayment = () => router.push('/recurring/new');

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

// Liste des paiements réguliers (virtualisée : le nombre peut grandir).
export function RecurringListScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  // TODO(phase 3) : requête SQLite réactive + calcul des échéances (lib/recurring.ts).
  const payments = useMemo(() => sortPayments(mockRecurringPayments), []);
  const categoriesById = useMemo(() => new Map(mockCategories.map((c) => [c.id, c])), []);

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
        <ScreenHeader title="Paiements réguliers" onBack={() => router.back()} />
      </Stack>
      <FlatList
        data={payments}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        ListHeaderComponent={
          payments.length > 0 ? (
            <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.sm }}>
              À l&apos;échéance, un encart rouge s&apos;affiche sur l&apos;accueil jusqu&apos;à ce
              que tu confirmes le paiement.
            </Text>
          ) : null
        }
        ListEmptyComponent={EmptyRecurring}
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
