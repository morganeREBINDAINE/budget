import { useMemo } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { type LiveData, useReportReadError } from '@/db/liveData';
import { useLiveQuery } from '@/db/useLiveQuery';
import { useUserId } from '@/features/auth/AuthProvider';
import { categoriesQuery, categoryQuery } from '@/repositories/categories';
import type { Category } from '@/types/budget';

const READ_ERROR = 'Impossible de lire les catégories.';

/** Catégories du compte connecté triées par position, mises à jour en direct. */
export function useCategories(): LiveData<Category[]> {
  const db = useDatabase();
  const userId = useUserId();
  const query = useMemo(() => categoriesQuery(db, userId), [db, userId]);
  const { data, error, updatedAt } = useLiveQuery(query, [query]);
  useReportReadError(error, READ_ERROR);

  return useMemo(() => {
    if (error) return { status: 'error' };
    if (!updatedAt) return { status: 'loading' };
    return { status: 'ready', data };
  }, [data, error, updatedAt]);
}

/** Une catégorie du compte connecté (`undefined` si introuvable ou supprimée), en direct. */
export function useCategory(id: string): LiveData<Category | undefined> {
  const db = useDatabase();
  const userId = useUserId();
  const query = useMemo(() => categoryQuery(db, userId, id), [db, userId, id]);
  const { data, error, updatedAt } = useLiveQuery(query, [query]);
  useReportReadError(error, READ_ERROR);

  return useMemo(() => {
    if (error) return { status: 'error' };
    if (!updatedAt) return { status: 'loading' };
    return { status: 'ready', data: data[0] };
  }, [data, error, updatedAt]);
}
