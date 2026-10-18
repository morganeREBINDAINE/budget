import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { useDrizzleStudio } from 'expo-drizzle-studio-plugin';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';

import { prepareDatabase, type Database } from './client';
import migrations from './migrations/migrations';

type Connection = { sqlite: SQLiteDatabase; db: Database };

type State =
  { status: 'pending' } | { status: 'ready'; connection: Connection } | { status: 'error' };

const DatabaseContext = createContext<Database | null>(null);

type Props = {
  children: ReactNode;
  // Appelé dès que la base est prête ou en erreur (ex. masquer le splash).
  onSettled?: () => void;
  // Écran affiché si l'ouverture ou la migration échoue ; `onRetry` relance la préparation.
  ErrorScreen: ComponentType<{ onRetry: () => Promise<void> }>;
};

const runMigrations = (db: Database) => migrate(db, migrations);

/**
 * Ouvre la base SQLite et applique les migrations au démarrage.
 * Rien n'est rendu pendant la préparation (le splash reste affiché) ; en cas d'échec,
 * écran d'erreur avec « Réessayer ».
 */
export function DatabaseProvider({ children, onSettled, ErrorScreen }: Props) {
  const [state, setState] = useState<State>({ status: 'pending' });
  // Ref : un nouveau callback du parent ne relance pas la préparation.
  const onSettledRef = useRef(onSettled);
  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);

  useEffect(() => {
    let cancelled = false;
    prepareDatabase(runMigrations)
      .then(
        (connection) => {
          if (!cancelled) setState({ status: 'ready', connection });
        },
        (e: unknown) => {
          console.error('[db] ouverture ou migration impossible', e);
          if (!cancelled) setState({ status: 'error' });
        },
      )
      .finally(() => onSettledRef.current?.());
    return () => {
      cancelled = true;
    };
  }, []);

  // Relance la préparation ; en cas de nouvel échec, la Promise rejetée est remontée à l'écran.
  const retry = useCallback(async () => {
    try {
      const connection = await prepareDatabase(runMigrations);
      setState({ status: 'ready', connection });
    } catch (e) {
      console.error('[db] nouvelle tentative impossible', e);
      throw e;
    }
  }, []);

  if (state.status === 'pending') return null;
  if (state.status === 'error') return <ErrorScreen onRetry={retry} />;

  return (
    <DatabaseContext.Provider value={state.connection.db}>
      {__DEV__ && <DrizzleStudio sqlite={state.connection.sqlite} />}
      {children}
    </DatabaseContext.Provider>
  );
}

// Drizzle Studio (développement uniquement) : Shift + M dans le terminal Expo.
function DrizzleStudio({ sqlite }: { sqlite: SQLiteDatabase }) {
  useDrizzleStudio(sqlite);
  return null;
}

export function useDatabase(): Database {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error('useDatabase doit être utilisé dans DatabaseProvider');
  return db;
}
