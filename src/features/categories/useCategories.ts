import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useMemo } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { useUserId } from '@/features/auth/AuthProvider';
import { reportError } from '@/lib/errors';
import { categoriesQuery, categoryQuery } from '@/repositories/categories';
import type { Category } from '@/types/budget';

type LiveData<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error' };

const READ_ERROR = 'Impossible de lire les catégories.';

function useReportReadError(error: Error | undefined) {
  useEffect(() => {
    if (error) reportError({ scope: 'db', message: READ_ERROR, error });
  }, [error]);
}

/** Catégories du compte connecté triées par position, mises à jour en direct. */
export function useCategories(): LiveData<Category[]> {
  const db = useDatabase();
  const userId = useUserId();
  const query = useMemo(() => categoriesQuery(db, userId), [db, userId]);
  const { data, error, updatedAt } = useLiveQuery(query, [query]);
  useReportReadError(error);

  if (error) return { status: 'error' };
  if (!updatedAt) return { status: 'loading' };
  return { status: 'ready', data };
}

/** Une catégorie du compte connecté (`undefined` si introuvable ou supprimée), en direct. */
export function useCategory(id: string): LiveData<Category | undefined> {
  const db = useDatabase();
  const userId = useUserId();
  const query = useMemo(() => categoryQuery(db, userId, id), [db, userId, id]);
  const { data, error, updatedAt } = useLiveQuery(query, [query]);
  useReportReadError(error);

  if (error) return { status: 'error' };
  if (!updatedAt) return { status: 'loading' };
  return { status: 'ready', data: data[0] };
}
