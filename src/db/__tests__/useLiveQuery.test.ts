import { tableNameOf } from '@/db/useLiveQuery';
import { categoriesQuery } from '@/repositories/categories';
import { pendingSyncCountQuery } from '@/repositories/syncQueue';
import { monthTransactionsQuery } from '@/repositories/transactions';
import { createTestDatabase } from '@/test/testDatabase';

jest.mock('expo-sqlite', () => ({ addDatabaseChangeListener: jest.fn() }));

describe('tableNameOf', () => {
  it('renvoie la table lue par les requêtes réactives', () => {
    const { db, close } = createTestDatabase();
    expect(tableNameOf(categoriesQuery(db, 'user'))).toBe('categories');
    expect(tableNameOf(pendingSyncCountQuery(db, 'user'))).toBe('sync_queue');
    expect(tableNameOf(monthTransactionsQuery(db, 'user', { year: 2026, month: 10 }))).toBe(
      'transactions',
    );
    close();
  });
});
