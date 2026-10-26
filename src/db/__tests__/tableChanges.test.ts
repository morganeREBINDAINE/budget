import { addDatabaseChangeListener } from 'expo-sqlite';

import { COALESCE_DELAY_MS, COALESCE_MAX_WAIT_MS, subscribeTableChanges } from '@/db/tableChanges';

jest.mock('expo-sqlite', () => ({ addDatabaseChangeListener: jest.fn() }));

const addListener = jest.mocked(addDatabaseChangeListener);
const remove = jest.fn();
let emit: (tableName: string) => void;

beforeEach(() => {
  jest.useFakeTimers();
  addListener.mockReset();
  remove.mockReset();
  addListener.mockImplementation((listener) => {
    emit = (tableName) =>
      listener({ databaseName: 'main', databaseFilePath: '', tableName, rowId: 1 });
    return { remove } as unknown as ReturnType<typeof addDatabaseChangeListener>;
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('subscribeTableChanges', () => {
  it('prévient une seule fois pour une rafale de modifications', () => {
    const callback = jest.fn();
    const unsubscribe = subscribeTableChanges('transactions', callback);
    for (let i = 0; i < 4000; i++) emit('transactions');
    expect(callback).not.toHaveBeenCalled();
    jest.advanceTimersByTime(COALESCE_DELAY_MS);
    expect(callback).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('ignore les tables non observées', () => {
    const callback = jest.fn();
    const unsubscribe = subscribeTableChanges('categories', callback);
    emit('sync_queue');
    jest.advanceTimersByTime(COALESCE_MAX_WAIT_MS);
    expect(callback).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('prévient chaque table modifiée de la rafale', () => {
    const onTransactions = jest.fn();
    const onQueue = jest.fn();
    const onCategories = jest.fn();
    const unsubscribers = [
      subscribeTableChanges('transactions', onTransactions),
      subscribeTableChanges('sync_queue', onQueue),
      subscribeTableChanges('categories', onCategories),
    ];
    emit('transactions');
    emit('sync_queue');
    emit('transactions');
    jest.advanceTimersByTime(COALESCE_DELAY_MS);
    expect(onTransactions).toHaveBeenCalledTimes(1);
    expect(onQueue).toHaveBeenCalledTimes(1);
    expect(onCategories).not.toHaveBeenCalled();
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  });

  it('prévient au plus tard après l’attente maximale si les modifications continuent', () => {
    const callback = jest.fn();
    const unsubscribe = subscribeTableChanges('sync_queue', callback);
    for (let t = 0; t < COALESCE_MAX_WAIT_MS; t += 10) {
      emit('sync_queue');
      jest.advanceTimersByTime(10);
    }
    expect(callback).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('partage un seul écouteur SQLite et le retire après le dernier désabonnement', () => {
    const first = subscribeTableChanges('transactions', jest.fn());
    const second = subscribeTableChanges('categories', jest.fn());
    expect(addListener).toHaveBeenCalledTimes(1);
    first();
    expect(remove).not.toHaveBeenCalled();
    second();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('ne prévient plus un abonné désabonné pendant la rafale', () => {
    const callback = jest.fn();
    const keep = subscribeTableChanges('transactions', jest.fn());
    const unsubscribe = subscribeTableChanges('transactions', callback);
    emit('transactions');
    unsubscribe();
    jest.advanceTimersByTime(COALESCE_DELAY_MS);
    expect(callback).not.toHaveBeenCalled();
    keep();
  });
});
