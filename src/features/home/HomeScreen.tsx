import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { screenPadding, Stack, useTheme } from '@/design-system';
import { useCategories } from '@/features/categories/useCategories';
import { AppHeader } from '@/features/navigation/AppHeader';
import { PayDueDialog } from '@/features/recurring/components/PayDueDialog';
import { useInitialPull } from '@/features/sync/useInitialPull';
import { DeleteTransactionDialog } from '@/features/transaction/components/DeleteTransactionDialog';
import { currentYearMonth, shiftMonth, type YearMonth } from '@/lib/format';
import { mockDuePayments } from '@/mocks/recurring';
import type { DuePayment, Transaction } from '@/types/budget';

import { FabGroup } from './components/FabGroup';
import { HomeSkeleton } from './components/HomeSkeleton';
import { MonthPager } from './components/MonthPager';
import { MonthSelector } from './components/MonthSelector';
import { MonthPage } from './MonthPage';

export function HomeScreen() {
  const { colors } = useTheme();
  const [month, setMonth] = useState(currentYearMonth);
  // TODO(phase 3) : échéances dues calculées par lib/recurring.ts.
  const [duePayments, setDuePayments] = useState<DuePayment[]>(mockDuePayments);
  const [paying, setPaying] = useState<DuePayment | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const categories = useCategories();
  // Pendant le pull initial : skeletons, et actions bloquées par un garde dans chaque handler.
  const { ready, failed } = useInitialPull();

  const addIncome = useCallback(() => {
    if (!ready) return;
    router.push({ pathname: '/transaction/new', params: { type: 'income' } });
  }, [ready]);
  const addExpense = useCallback(() => {
    if (!ready) return;
    router.push({ pathname: '/transaction/new', params: { type: 'expense' } });
  }, [ready]);
  const openTransaction = useCallback(
    (id: string) => router.push({ pathname: '/transaction/[id]', params: { id } }),
    [],
  );
  const closeDelete = useCallback(() => setDeleting(null), []);
  // TODO(phase 7) : export JSON.
  const exportData = useCallback(() => {
    if (!ready) return;
  }, [ready]);

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
        categories={categories}
        duePayments={duePayments}
        onPayDue={setPaying}
        onOpenTransaction={openTransaction}
        onDeleteTransaction={setDeleting}
      />
    ),
    [categories, duePayments, openTransaction],
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
      {ready ? (
        <MonthPager month={month} onChange={setMonth} renderPage={renderPage} />
      ) : (
        <HomeSkeleton month={month} failed={failed} />
      )}
      <FabGroup onAddIncome={addIncome} onAddExpense={addExpense} />
      <PayDueDialog
        key={paying ? `${paying.payment.id}-${paying.dueDate}` : 'closed'}
        due={paying}
        onCancel={() => setPaying(null)}
        onPaid={markPaid}
      />
      <DeleteTransactionDialog
        key={deleting?.id ?? 'closed'}
        transaction={deleting}
        onCancel={closeDelete}
        onDeleted={closeDelete}
      />
    </SafeAreaView>
  );
}
