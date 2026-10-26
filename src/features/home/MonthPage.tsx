import { memo, useCallback } from 'react';
import { FlatList, type ListRenderItem } from 'react-native';

import { FAB_AREA_HEIGHT, Row, screenPadding, Stack, Text, useTheme } from '@/design-system';
import type { LiveData } from '@/db/liveData';
import { DuePaymentsCarousel } from '@/features/recurring/components/DuePaymentsCarousel';
import type { MonthSummary } from '@/lib/budget';
import type { YearMonth } from '@/lib/format';
import type { Category, DuePayment, Transaction } from '@/types/budget';

import { CategoryChart } from './components/CategoryChart';
import { EmptyState } from './components/EmptyState';
import { HomeSkeleton } from './components/HomeSkeleton';
import { MonthBalanceCard } from './components/MonthBalanceCard';
import { OrphanExpensesNotice } from './components/OrphanExpensesNotice';
import { TransactionRow } from './components/TransactionRow';
import { type HomeView, periodLabels } from './homeView';
import { useMonthSummary } from './useMonthSummary';

export type PeriodPageProps = {
  // Mois affiché ; en vue à l'année, dernier des 12 mois.
  month: YearMonth;
  // Catégories du compte, lues une seule fois par l'accueil pour les 3 pages du carrousel.
  categories: LiveData<Category[]>;
  // Échéances non payées : affichées sur tous les mois, sous le graphique.
  duePayments: DuePayment[];
  onPayDue: (due: DuePayment) => void;
  onOpenTransaction: (id: string) => void;
  onDeleteTransaction: (transaction: Transaction) => void;
};

type ContentProps = Omit<PeriodPageProps, 'categories'> & { view: HomeView; summary: MonthSummary };

// Page d'un mois : skeletons au premier chargement, bloc d'erreur si la lecture locale échoue.
export const MonthPage = memo(function MonthPage({ categories, ...rest }: PeriodPageProps) {
  const summary = useMonthSummary(rest.month, categories);
  if (summary.status === 'loading') return <HomeSkeleton month={rest.month} />;
  if (summary.status === 'error') return <HomeSkeleton month={rest.month} readError />;
  return <PeriodContent view="month" summary={summary.data} {...rest} />;
});

// Contenu défilant d'une période (mois ou 12 mois) : graphique, échéances dues, bilan,
// liste « Détail ».
export function PeriodContent({
  month,
  view,
  summary,
  duePayments,
  onPayDue,
  onOpenTransaction,
  onDeleteTransaction,
}: ContentProps) {
  const { spacing } = useTheme();
  const labels = periodLabels(view, month);

  const renderItem: ListRenderItem<Transaction> = useCallback(
    ({ item }) => (
      <TransactionRow
        transaction={item}
        category={item.categoryId ? summary.categoriesById.get(item.categoryId) : undefined}
        onPress={onOpenTransaction}
        onLongPress={onDeleteTransaction}
      />
    ),
    [summary.categoriesById, onOpenTransaction, onDeleteTransaction],
  );

  const header = (
    <Stack gap="xl" style={{ marginBottom: spacing.lg }}>
      {summary.byCategory.length > 0 && (
        <CategoryChart totals={summary.byCategory} totalDa={summary.expenseDa} />
      )}
      {summary.orphanExpenses.length > 0 && (
        <OrphanExpensesNotice expenses={summary.orphanExpenses} />
      )}
      {duePayments.length > 0 && <DuePaymentsCarousel dues={duePayments} onPay={onPayDue} />}
      <MonthBalanceCard amounts={summary} label={labels.balance} />
      <Row gap="sm" align="baseline">
        <Text variant="title">Détail</Text>
        <Text variant="body" color="textMuted">
          {labels.detail}
        </Text>
      </Row>
    </Stack>
  );

  return (
    <FlatList
      data={summary.transactions}
      keyExtractor={(t) => t.id}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ListEmptyComponent={EmptyState}
      ItemSeparatorComponent={Separator}
      contentContainerStyle={{
        paddingHorizontal: screenPadding,
        paddingTop: spacing.xl,
        paddingBottom: FAB_AREA_HEIGHT + spacing.xl,
      }}
      showsVerticalScrollIndicator={false}
    />
  );
}

function Separator() {
  const { spacing } = useTheme();
  return <Stack style={{ height: spacing.md }} />;
}
