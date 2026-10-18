import { memo, useCallback } from 'react';
import { FlatList, type ListRenderItem } from 'react-native';

import { FAB_AREA_HEIGHT, Row, screenPadding, Stack, Text, useTheme } from '@/design-system';
import { DuePaymentBanner } from '@/features/recurring/components/DuePaymentBanner';
import { formatMonth, type YearMonth } from '@/lib/format';
import type { DuePayment, Transaction } from '@/types/budget';

import { CategoryChart } from './components/CategoryChart';
import { EmptyState } from './components/EmptyState';
import { TotalCard } from './components/TotalCard';
import { TransactionRow } from './components/TransactionRow';
import { useMonthSummary } from './useMonthSummary';

type Props = {
  month: YearMonth;
  // Échéances non payées : affichées sur tous les mois, sous le graphique.
  duePayments: DuePayment[];
  onPayDue: (due: DuePayment) => void;
  onOpenTransaction: (id: string) => void;
};

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

// Contenu défilant d'un mois : cartes Entrées / Dépenses, graphique, échéances dues, liste « Détail ».
export const MonthPage = memo(function MonthPage({
  month,
  duePayments,
  onPayDue,
  onOpenTransaction,
}: Props) {
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
      {duePayments.length > 0 && (
        <Stack gap="md">
          {/* Quelques encarts au plus : rendus dans l'en-tête de la liste virtualisée. */}
          {duePayments.map((due) => (
            <DuePaymentBanner key={`${due.payment.id}-${due.dueDate}`} due={due} onPay={onPayDue} />
          ))}
        </Stack>
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
