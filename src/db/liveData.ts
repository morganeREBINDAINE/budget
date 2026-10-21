import { useEffect } from 'react';

import { reportError } from '@/lib/errors';

/** État d'une lecture réactive SQLite (`useLiveQuery`) exposé aux écrans. */
export type LiveData<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error' };

/** Journalise et affiche (toast) l'échec d'une lecture locale ; doublons ignorés par le toast. */
export function useReportReadError(error: Error | undefined, message: string) {
  useEffect(() => {
    if (error) reportError({ scope: 'db', message, error });
  }, [error, message]);
}
