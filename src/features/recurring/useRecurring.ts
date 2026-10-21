import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { type LiveData, useReportReadError } from '@/db/liveData';
import { useUserId } from '@/features/auth/AuthProvider';
import { toIsoDate } from '@/lib/format';
import { duePaymentsOf } from '@/lib/recurring';
import {
  groupPaidDueDates,
  paidOccurrencesQuery,
  recurringPaymentQuery,
  recurringPaymentsQuery,
} from '@/repositories/recurring';
import type { DuePayment, RecurringPayment } from '@/types/budget';

const READ_ERROR = 'Impossible de lire les paiements réguliers.';

/** Paiements réguliers du compte connecté (par nom), en direct. */
export function useRecurringPayments(): LiveData<RecurringPayment[]> {
  const db = useDatabase();
  const userId = useUserId();
  const query = useMemo(() => recurringPaymentsQuery(db, userId), [db, userId]);
  const { data, error, updatedAt } = useLiveQuery(query, [query]);
  useReportReadError(error, READ_ERROR);

  return useMemo(() => {
    if (error) return { status: 'error' };
    if (!updatedAt) return { status: 'loading' };
    return { status: 'ready', data };
  }, [data, error, updatedAt]);
}

/** Un paiement régulier du compte connecté (`undefined` si introuvable ou supprimé), en direct. */
export function useRecurringPayment(id: string): LiveData<RecurringPayment | undefined> {
  const db = useDatabase();
  const userId = useUserId();
  const query = useMemo(() => recurringPaymentQuery(db, userId, id), [db, userId, id]);
  const { data, error, updatedAt } = useLiveQuery(query, [query]);
  useReportReadError(error, READ_ERROR);

  return useMemo(() => {
    if (error) return { status: 'error' };
    if (!updatedAt) return { status: 'loading' };
    return { status: 'ready', data: data[0] };
  }, [data, error, updatedAt]);
}

/** Dates d'échéance payées, par paiement, en direct. */
export function usePaidDueDates(): LiveData<Map<string, string[]>> {
  const db = useDatabase();
  const userId = useUserId();
  const query = useMemo(() => paidOccurrencesQuery(db, userId), [db, userId]);
  const { data, error, updatedAt } = useLiveQuery(query, [query]);
  useReportReadError(error, READ_ERROR);

  return useMemo(() => {
    if (error) return { status: 'error' };
    if (!updatedAt) return { status: 'loading' };
    return { status: 'ready', data: groupPaidDueDates(data) };
  }, [data, error, updatedAt]);
}

/** Échéances arrivées et non payées (encart de l'accueil), de la plus ancienne à la plus récente. */
export function useDuePayments(): LiveData<DuePayment[]> {
  const payments = useRecurringPayments();
  const paid = usePaidDueDates();
  // Recalculé à chaque rendu d'un nouveau jour (retour au premier plan, nouvelle donnée).
  const today = toIsoDate(new Date());

  return useMemo(() => {
    if (payments.status === 'error' || paid.status === 'error') return { status: 'error' };
    if (payments.status === 'loading' || paid.status === 'loading') return { status: 'loading' };
    return { status: 'ready', data: duePaymentsOf(payments.data, paid.data, today) };
  }, [payments, paid, today]);
}
