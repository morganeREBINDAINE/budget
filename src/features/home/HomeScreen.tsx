import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Menu, screenPadding, Stack, useTheme } from '@/design-system';
import { useCategories } from '@/features/categories/useCategories';
import { AppHeader, HeaderButton } from '@/features/navigation/AppHeader';
import { PayDueDialog } from '@/features/recurring/components/PayDueDialog';
import { useDuePayments } from '@/features/recurring/useRecurring';
import { useExportData } from '@/features/backup/useExportData';
import { useInitialPull } from '@/features/sync/useInitialPull';
import { DeleteTransactionDialog } from '@/features/transaction/components/DeleteTransactionDialog';
import { currentYearMonth, formatYearWindow, shiftMonth, type YearMonth } from '@/lib/format';
import type { DuePayment, Transaction } from '@/types/budget';

import { EurRateDialog } from './components/EurRateDialog';
import { FabGroup } from './components/FabGroup';
import { HomeSkeleton } from './components/HomeSkeleton';
import { MonthPager } from './components/MonthPager';
import { MonthSelector, PeriodPill } from './components/MonthSelector';
import { HOME_VIEW_ITEMS, type HomeView } from './homeView';
import { MonthPage } from './MonthPage';
import { YearPage } from './YearPage';

const NO_DUES: DuePayment[] = [];

export function HomeScreen() {
  const { colors } = useTheme();
  const [month, setMonth] = useState(currentYearMonth);
  // Vue à l'année : 12 mois finissant à `month`, page fixe ; « Vue par mois » revient sur `month`.
  // Gardée pendant la session seulement.
  const [view, setView] = useState<HomeView>('month');
  // Vue « Voir en euro » : taux appliqué au mois affiché, en mémoire seulement. Annulée au
  // changement de mois ou de vue, et dès que l'accueil n'est plus à l'écran.
  const [eurRate, setEurRate] = useState<number | null>(null);
  const [askingRate, setAskingRate] = useState(false);
  // Échéances dues de tous les paiements (affichées sur tous les mois) ; en lecture ou en échec
  // de lecture (toast déjà affiché), aucun encart.
  const dues = useDuePayments();
  const duePayments = dues.status === 'ready' ? dues.data : NO_DUES;
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
  const { exportData, exporting } = useExportData({ errorDisplay: 'toast' });

  const payDue = useCallback(
    (due: DuePayment) => {
      if (!ready) return;
      setPaying(due);
    },
    [ready],
  );
  const closePay = useCallback(() => setPaying(null), []);

  const changeMonth = useCallback((next: YearMonth) => {
    setMonth(next);
    setEurRate(null);
  }, []);
  const shiftBy = (delta: number) => {
    setMonth((m) => shiftMonth(m, delta));
    setEurRate(null);
  };
  const selectView = (next: HomeView) => {
    setView(next);
    setEurRate(null);
  };
  // Nettoyage au départ de l'écran (autre écran poussé, onglet quitté) : retour aux dinars.
  useFocusEffect(useCallback(() => () => setEurRate(null), []));

  const toggleEur = useCallback(() => {
    if (!ready) return;
    if (eurRate !== null) setEurRate(null);
    else setAskingRate(true);
  }, [ready, eurRate]);
  const closeRate = useCallback(() => setAskingRate(false), []);
  const applyRate = useCallback((rate: number) => {
    setEurRate(rate);
    setAskingRate(false);
  }, []);

  const renderPage = useCallback(
    (m: YearMonth) => (
      <MonthPage
        month={m}
        categories={categories}
        duePayments={duePayments}
        onPayDue={payDue}
        onOpenTransaction={openTransaction}
        onDeleteTransaction={setDeleting}
        // Les mois voisins du carrousel restent en dinars.
        eurRate={m.year === month.year && m.month === month.month ? eurRate : null}
        onToggleEur={toggleEur}
      />
    ),
    [categories, duePayments, payDue, openTransaction, month, eurRate, toggleEur],
  );

  let content;
  if (!ready) content = <HomeSkeleton month={month} view={view} failed={failed} />;
  else if (view === 'year')
    content = (
      <YearPage
        month={month}
        categories={categories}
        duePayments={duePayments}
        onPayDue={payDue}
        onOpenTransaction={openTransaction}
        onDeleteTransaction={setDeleting}
      />
    );
  else content = <MonthPager month={month} onChange={changeMonth} renderPage={renderPage} />;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* En-tête et sélecteur de mois fixes : seul le contenu du mois glisse. */}
      <Stack gap="xl" style={{ paddingHorizontal: screenPadding }}>
        <AppHeader
          onExport={exportData}
          exporting={exporting}
          trailing={
            <Menu
              items={HOME_VIEW_ITEMS}
              value={view}
              onSelect={selectView}
              label="Vue de l'accueil"
              renderTrigger={(open) => (
                <HeaderButton icon="eye-outline" label="Changer de vue" onPress={open} />
              )}
            />
          }
        />
        {view === 'year' ? (
          <PeriodPill label={formatYearWindow(month)} />
        ) : (
          <MonthSelector value={month} onPrevious={() => shiftBy(-1)} onNext={() => shiftBy(1)} />
        )}
      </Stack>
      {content}
      <FabGroup onAddIncome={addIncome} onAddExpense={addExpense} />
      <PayDueDialog
        key={paying ? `pay-${paying.payment.id}-${paying.dueDate}` : 'pay-closed'}
        due={paying}
        onCancel={closePay}
        onPaid={closePay}
      />
      <EurRateDialog
        key={askingRate ? 'eur-open' : 'eur-closed'}
        visible={askingRate}
        onCancel={closeRate}
        onConfirm={applyRate}
      />
      <DeleteTransactionDialog
        key={`delete-${deleting?.id ?? 'closed'}`}
        transaction={deleting}
        onCancel={closeDelete}
        onDeleted={closeDelete}
      />
    </SafeAreaView>
  );
}
