import { is } from 'drizzle-orm';
import type { AnySQLiteSelect } from 'drizzle-orm/sqlite-core';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { useEffect, useState } from 'react';

import { subscribeTableChanges } from './tableChanges';

type LiveQuery = Pick<AnySQLiteSelect, '_' | 'then'>;

/** Nom de la table lue par la requête (table principale, comme `useLiveQuery` de Drizzle). */
export function tableNameOf(query: LiveQuery): string | null {
  const table = (query as unknown as { config?: { table?: unknown } }).config?.table;
  return is(table, SQLiteTable) ? getTableConfig(table).name : null;
}

/**
 * Lecture réactive d'une requête Drizzle (même contrat que `useLiveQuery` de
 * `drizzle-orm/expo-sqlite`) : relue une seule fois par rafale de modifications de sa table
 * (`src/db/tableChanges.ts`), jamais deux lectures en même temps (une seule relance en attente).
 */
export function useLiveQuery<T extends LiveQuery>(query: T, deps: unknown[] = []) {
  const [data, setData] = useState<Awaited<T>>([] as Awaited<T>);
  const [error, setError] = useState<Error | undefined>();
  const [updatedAt, setUpdatedAt] = useState<Date | undefined>();

  useEffect(() => {
    let active = true;
    let running = false;
    let again = false;

    const read = () => {
      if (running) {
        again = true;
        return;
      }
      running = true;
      Promise.resolve(query)
        .then((result) => {
          if (!active) return;
          setData(result as Awaited<T>);
          setUpdatedAt(new Date());
        })
        .catch((e: unknown) => {
          if (active) setError(e instanceof Error ? e : new Error(String(e)));
        })
        .finally(() => {
          running = false;
          if (active && again) {
            again = false;
            read();
          }
        });
    };

    read();
    const table = tableNameOf(query);
    const unsubscribe = table ? subscribeTableChanges(table, read) : undefined;
    return () => {
      active = false;
      unsubscribe?.();
    };
    // Mêmes dépendances explicites que le hook de Drizzle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, updatedAt } as const;
}
