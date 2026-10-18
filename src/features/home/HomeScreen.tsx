import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { screenPadding, Stack, useTheme } from '@/design-system';
import { AppHeader } from '@/features/navigation/AppHeader';
import { PayDueDialog } from '@/features/recurring/components/PayDueDialog';
import { currentYearMonth, shiftMonth, type YearMonth } from '@/lib/format';
import { mockDuePayments } from '@/mocks/recurring';
import type { DuePayment } from '@/types/budget';

import { FabGroup } from './components/FabGroup';
import { MonthPager } from './components/MonthPager';
import { MonthSelector } from './components/MonthSelector';
import { MonthPage } from './MonthPage';

export function HomeScreen() {
  const { colors } = useTheme();
  const [month, setMonth] = useState(currentYearMonth);
  // TODO(phase 3) : échéances dues calculées par lib/recurring.ts.
  const [duePayments, setDuePayments] = useState<DuePayment[]>(mockDuePayments);
  const [paying, setPaying] = useState<DuePayment | null>(null);

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

  const markPaid = useCallback((paid: DuePayment) => {
    setDuePayments((list) =>
      list.filter((d) => !(d.payment.id === paid.payment.id && d.dueDate === paid.dueDate)),
    );
    setPaying(null);
  }, []);

  const renderPage = useCallback(
    (m: YearMonth) => (
      <MonthPage
        month={m}
        duePayments={duePayments}
        onPayDue={setPaying}
        onOpenTransaction={openTransaction}
      />
    ),
    [duePayments, openTransaction],
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
      <PayDueDialog
        key={paying ? `${paying.payment.id}-${paying.dueDate}` : 'closed'}
        due={paying}
        onCancel={() => setPaying(null)}
        onPaid={markPaid}
      />
    </SafeAreaView>
  );
}
