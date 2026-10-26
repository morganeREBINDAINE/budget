import { useMemo } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { type LiveData, useReportReadError } from '@/db/liveData';
import { useLiveQuery } from '@/db/useLiveQuery';
import { useUserId } from '@/features/auth/AuthProvider';
import type { YearMonth } from '@/lib/format';
import { monthTransactionsQuery, transactionQuery } from '@/repositories/transactions';
import type { Transaction } from '@/types/budget';

const READ_ERROR = 'Impossible de lire les transactions.';

/** Transactions du mois pour le compte connecté (date desc puis création desc), en direct. */
export function useMonthTransactions(month: YearMonth): LiveData<Transaction[]> {
  const db = useDatabase();
  const userId = useUserId();
  const { year, month: m } = month;
  const query = useMemo(
    () => monthTransactionsQuery(db, userId, { year, month: m }),
    [db, userId, year, m],
  );
  const { data, error, updatedAt } = useLiveQuery(query, [query]);
  useReportReadError(error, READ_ERROR);

  return useMemo(() => {
    if (error) return { status: 'error' };
    if (!updatedAt) return { status: 'loading' };
    return { status: 'ready', data };
  }, [data, error, updatedAt]);
}

/** Une transaction du compte connecté (`undefined` si introuvable ou supprimée), en direct. */
export function useTransaction(id: string): LiveData<Transaction | undefined> {
  const db = useDatabase();
  const userId = useUserId();
  const query = useMemo(() => transactionQuery(db, userId, id), [db, userId, id]);
  const { data, error, updatedAt } = useLiveQuery(query, [query]);
  useReportReadError(error, READ_ERROR);

  return useMemo(() => {
    if (error) return { status: 'error' };
    if (!updatedAt) return { status: 'loading' };
    return { status: 'ready', data: data[0] };
  }, [data, error, updatedAt]);
}
