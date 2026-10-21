import { memo, useCallback } from 'react';
import { FlatList, type ListRenderItem } from 'react-native';

import { FAB_AREA_HEIGHT, Row, screenPadding, Stack, Text, useTheme } from '@/design-system';
import type { LiveData } from '@/db/liveData';
import { DuePaymentsCarousel } from '@/features/recurring/components/DuePaymentsCarousel';
import type { MonthSummary } from '@/lib/budget';
import { formatMonth, type YearMonth } from '@/lib/format';
import type { Category, DuePayment, Transaction } from '@/types/budget';

import { CategoryChart } from './components/CategoryChart';
import { EmptyState } from './components/EmptyState';
import { HomeSkeleton } from './components/HomeSkeleton';
import { MonthBalanceCard } from './components/MonthBalanceCard';
import { OrphanExpensesNotice } from './components/OrphanExpensesNotice';
import { TransactionRow } from './components/TransactionRow';
import { useMonthSummary } from './useMonthSummary';

type Props = {
  month: YearMonth;
  // Catégories du compte, lues une seule fois par l'accueil pour les 3 pages du carrousel.
  categories: LiveData<Category[]>;
  // Échéances non payées : affichées sur tous les mois, sous le graphique.
  duePayments: DuePayment[];
  onPayDue: (due: DuePayment) => void;
  onOpenTransaction: (id: string) => void;
  onDeleteTransaction: (transaction: Transaction) => void;
};

type ContentProps = Omit<Props, 'categories'> & { summary: MonthSummary };

// Page d'un mois : skeletons au premier chargement, bloc d'erreur si la lecture locale échoue.
export const MonthPage = memo(function MonthPage({ categories, ...rest }: Props) {
  const summary = useMonthSummary(rest.month, categories);
  if (summary.status === 'loading') return <HomeSkeleton month={rest.month} />;
  if (summary.status === 'error') return <HomeSkeleton month={rest.month} readError />;
  return <MonthContent summary={summary.data} {...rest} />;
});

// Contenu défilant d'un mois : bilan du mois, graphique, échéances dues, liste « Détail ».
function MonthContent({
  month,
  summary,
  duePayments,
  onPayDue,
  onOpenTransaction,
  onDeleteTransaction,
}: ContentProps) {
  const { spacing } = useTheme();

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
      <MonthBalanceCard amounts={summary} />
      <Row gap="sm" align="baseline">
        <Text variant="title">Détail</Text>
        <Text variant="body" color="textMuted">
          {formatMonth(month)}
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
