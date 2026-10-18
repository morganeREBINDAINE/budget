import { useCallback, useState } from 'react';
import { FlatList, type ListRenderItem } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Row, screenPadding, Stack, Text, useTheme } from '@/design-system';
import { currentYearMonth, formatMonth, shiftMonth } from '@/lib/format';
import type { Transaction } from '@/types/budget';

import { AppHeader } from './components/AppHeader';
import { CategoryChart } from './components/CategoryChart';
import { EmptyState } from './components/EmptyState';
import { FAB_AREA_HEIGHT, FabGroup } from './components/FabGroup';
import { MonthSelector } from './components/MonthSelector';
import { TotalCard } from './components/TotalCard';
import { TransactionRow } from './components/TransactionRow';
import { useMonthSummary } from './useMonthSummary';
import { useMonthSwipe } from './useMonthSwipe';

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

export function HomeScreen() {
  const { colors, spacing } = useTheme();
  const [month, setMonth] = useState(currentYearMonth);
  const summary = useMonthSummary(month);
  const shift = useCallback((delta: 1 | -1) => setMonth((m) => shiftMonth(m, delta)), []);
  const swipe = useMonthSwipe(month, shift);

  // TODO(phase 2, tâche Transaction) : ouvrir /transaction/new?type=…
  const addIncome = useCallback(() => {}, []);
  const addExpense = useCallback(() => {}, []);
  // TODO(phase 7) : export JSON.
  const exportData = useCallback(() => {}, []);

  const renderItem: ListRenderItem<Transaction> = useCallback(
    ({ item }) => (
      <TransactionRow
        transaction={item}
        category={item.categoryId ? summary.categoriesById.get(item.categoryId) : undefined}
      />
    ),
    [summary.categoriesById],
  );

  const header = (
    <Stack gap="xl" style={{ marginBottom: spacing.lg }}>
      <AppHeader onExport={exportData} />
      <MonthSelector value={month} onPrevious={() => shift(-1)} onNext={() => shift(1)} />
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
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <GestureDetector gesture={swipe.gesture}>
        <Animated.View style={[{ flex: 1 }, swipe.animatedStyle]}>
          <FlatList
            data={summary.transactions}
            keyExtractor={(t) => t.id}
            renderItem={renderItem}
            ListHeaderComponent={header}
            ListEmptyComponent={EmptyState}
            ItemSeparatorComponent={Separator}
            contentContainerStyle={{
              paddingHorizontal: screenPadding,
              paddingBottom: FAB_AREA_HEIGHT + spacing.xl,
            }}
            showsVerticalScrollIndicator={false}
          />
        </Animated.View>
      </GestureDetector>
      <FabGroup onAddIncome={addIncome} onAddExpense={addExpense} />
    </SafeAreaView>
  );
}

function Separator() {
  const { spacing } = useTheme();
  return <Stack style={{ height: spacing.md }} />;
}
