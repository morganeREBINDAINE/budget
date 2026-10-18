import { memo, useCallback } from 'react';
import { FlatList, type ListRenderItem } from 'react-native';

import { Row, screenPadding, Stack, Text, useTheme } from '@/design-system';
import { formatMonth, type YearMonth } from '@/lib/format';
import type { Transaction } from '@/types/budget';

import { CategoryChart } from './components/CategoryChart';
import { EmptyState } from './components/EmptyState';
import { FAB_AREA_HEIGHT } from './components/FabGroup';
import { TotalCard } from './components/TotalCard';
import { TransactionRow } from './components/TransactionRow';
import { useMonthSummary } from './useMonthSummary';

type Props = {
  month: YearMonth;
  onOpenTransaction: (id: string) => void;
};

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

// Contenu défilant d'un mois : cartes Entrées / Dépenses, graphique, liste « Détail ».
export const MonthPage = memo(function MonthPage({ month, onOpenTransaction }: Props) {
  const { spacing } = useTheme();
  const summary = useMonthSummary(month);

  const renderItem: ListRenderItem<Transaction> = useCallback(
    ({ item }) => (
      <TransactionRow
        transaction={item}
        category={item.categoryId ? summary.categoriesById.get(item.categoryId) : undefined}
        onPress={onOpenTransaction}
      />
    ),
    [summary.categoriesById, onOpenTransaction],
  );

  const header = (
    <Stack gap="xl" style={{ marginBottom: spacing.lg }}>
      <Row gap="md" align="stretch">
        <TotalCard
          kind="income"
          amountDa={summary.incomeDa}
          subtitle={plural(summary.incomeCount, 'versement')}
        />
        <TotalCard
          kind="expense"
          amountDa={summary.expenseDa}
          subtitle={plural(summary.expenseCount, 'dépense')}
        />
      </Row>
      {summary.expenseDa > 0 && (
        <CategoryChart totals={summary.byCategory} totalDa={summary.expenseDa} />
      )}
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
});

function Separator() {
  const { spacing } = useTheme();
  return <Stack style={{ height: spacing.md }} />;
}
