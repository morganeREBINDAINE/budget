import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { screenPadding, Stack, useTheme } from '@/design-system';
import { currentYearMonth, shiftMonth, type YearMonth } from '@/lib/format';

import { AppHeader } from './components/AppHeader';
import { FabGroup } from './components/FabGroup';
import { MonthPager } from './components/MonthPager';
import { MonthSelector } from './components/MonthSelector';
import { MonthPage } from './MonthPage';

export function HomeScreen() {
  const { colors } = useTheme();
  const [month, setMonth] = useState(currentYearMonth);

  const addIncome = useCallback(
    () => router.push({ pathname: '/transaction/new', params: { type: 'income' } }),
    [],
  );
  const addExpense = useCallback(
    () => router.push({ pathname: '/transaction/new', params: { type: 'expense' } }),
    [],
  );
  const openTransaction = useCallback(
    (id: string) => router.push({ pathname: '/transaction/[id]', params: { id } }),
    [],
  );
  // TODO(phase 7) : export JSON.
  const exportData = useCallback(() => {}, []);

  const renderPage = useCallback(
    (m: YearMonth) => <MonthPage month={m} onOpenTransaction={openTransaction} />,
    [openTransaction],
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* En-tête et sélecteur de mois fixes : seul le contenu du mois glisse. */}
      <Stack gap="xl" style={{ paddingHorizontal: screenPadding }}>
        <AppHeader onExport={exportData} />
        <MonthSelector
          value={month}
          onPrevious={() => setMonth((m) => shiftMonth(m, -1))}
          onNext={() => setMonth((m) => shiftMonth(m, 1))}
        />
      </Stack>
      <MonthPager month={month} onChange={setMonth} renderPage={renderPage} />
      <FabGroup onAddIncome={addIncome} onAddExpense={addExpense} />
    </SafeAreaView>
  );
}
