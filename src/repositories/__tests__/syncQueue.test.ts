import { asc, eq } from 'drizzle-orm';

import type { Database } from '@/db/client';
import { syncQueue } from '@/db/schema';
import {
  markQueueFailure,
  pendingSyncCount,
  readQueueBatch,
  rejectedSyncCountQuery,
  rejectQueueEntries,
  removeQueueEntries,
  removeRejectedEntriesForRows,
  requeueRejectedEntries,
  sendableSyncCount,
} from '@/repositories/syncQueue';
import { insertRow, updateRow } from '@/repositories/write';
import { createTestDatabase } from '@/test/testDatabase';

jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
}));

const USER = 'user-a';
const OTHER_USER = 'user-b';
const AT = '2026-10-21T10:00:00.000Z';

let db: Database;
let close: () => void;

beforeEach(() => {
  ({ db, close } = createTestDatabase());
});

afterEach(() => close());

/** Ajoute une personne (une entrée de file) et renvoie l'id de la ligne. */
const addPerson = (name: string, userId = USER) =>
  insertRow(db, 'debt_people', userId, { name }).id;

/** Entrées du compte dans l'ordre d'écriture. */
const entries = (userId = USER) =>
  db
    .select()
    .from(syncQueue)
    .where(eq(syncQueue.userId, userId))
    .orderBy(asc(syncQueue.createdAt))
    .all();

const rejectedCount = (userId = USER) => rejectedSyncCountQuery(db, userId).get()?.value ?? 0;

describe('compteurs', () => {
  it('en attente compte les entrées mises de côté, envoyables non', () => {
    addPerson('A');
    addPerson('B');
    addPerson('C');
    const [first] = entries();
    rejectQueueEntries(db, USER, [first.id], 'refus', AT);

    expect(pendingSyncCount(db, USER)).toBe(3);
    expect(sendableSyncCount(db, USER)).toBe(2);
    expect(rejectedCount()).toBe(1);
  });

  it('chaque compte ne voit que ses entrées', () => {
    addPerson('A');
    addPerson('B', OTHER_USER);
    addPerson('C', OTHER_USER);
    rejectQueueEntries(db, OTHER_USER, [entries(OTHER_USER)[0].id], 'refus', AT);

    expect(pendingSyncCount(db, USER)).toBe(1);
    expect(sendableSyncCount(db, USER)).toBe(1);
    expect(rejectedCount()).toBe(0);
    expect(pendingSyncCount(db, OTHER_USER)).toBe(2);
    expect(rejectedCount(OTHER_USER)).toBe(1);
  });

  it('file vide : zéro', () => {
    expect(pendingSyncCount(db, USER)).toBe(0);
    expect(sendableSyncCount(db, USER)).toBe(0);
    expect(rejectedCount()).toBe(0);
  });
});

describe('readQueueBatch', () => {
  it('renvoie les plus anciennes entrées dans l’ordre d’écriture, dans la limite', () => {
    const ids = ['A', 'B', 'C', 'D'].map((name) => addPerson(name));
    expect(readQueueBatch(db, USER, 3).map((e) => e.rowId)).toEqual(ids.slice(0, 3));
  });

  it('ignore les entrées mises de côté et celles d’un autre compte', () => {
    const a = addPerson('A');
    addPerson('B', OTHER_USER);
    const c = addPerson('C');
    rejectQueueEntries(db, USER, [entries()[0].id], 'refus', AT);
    expect(readQueueBatch(db, USER, 10).map((e) => e.rowId)).toEqual([c]);
    expect(readQueueBatch(db, USER, 10).map((e) => e.rowId)).not.toContain(a);
  });
});

describe('retrait', () => {
  it('removeQueueEntries ne retire que les entrées données du compte', () => {
    addPerson('A');
    addPerson('B');
    addPerson('C', OTHER_USER);
    const [first, second] = entries();
    // Un id d'entrée d'un autre compte n'est pas retiré.
    removeQueueEntries(db, USER, [first.id, entries(OTHER_USER)[0].id]);

    expect(entries().map((e) => e.id)).toEqual([second.id]);
    expect(entries(OTHER_USER)).toHaveLength(1);
  });

  it('removeQueueEntries sans id : rien', () => {
    addPerson('A');
    removeQueueEntries(db, USER, []);
    expect(entries()).toHaveLength(1);
  });

  it('removeRejectedEntriesForRows ne retire que les entrées mises de côté des lignes données', () => {
    const a = addPerson('A');
    updateRow(db, 'debt_people', USER, a, { name: 'A2' });
    const b = addPerson('B');
    const [aFirst, aSecond, bEntry] = entries();
    rejectQueueEntries(db, USER, [aFirst.id, bEntry.id], 'refus', AT);

    removeRejectedEntriesForRows(db, USER, 'debt_people', [a]);
    // L'entrée envoyable de A et l'entrée mise de côté de B restent.
    expect(entries().map((e) => e.id)).toEqual([aSecond.id, bEntry.id]);
    expect(entries().find((e) => e.rowId === b)?.rejectedAt).toBe(AT);
  });

  it('removeRejectedEntriesForRows ne touche ni une autre table ni un autre compte', () => {
    const a = addPerson('A');
    rejectQueueEntries(db, USER, [entries()[0].id], 'refus', AT);
    removeRejectedEntriesForRows(db, USER, 'categories', [a]);
    removeRejectedEntriesForRows(db, OTHER_USER, 'debt_people', [a]);
    expect(entries()).toHaveLength(1);
  });
});

describe('échecs et mise de côté', () => {
  it('markQueueFailure incrémente attempts et garde le dernier message, sans mettre de côté', () => {
    addPerson('A');
    addPerson('B');
    const [first, second] = entries();
    markQueueFailure(db, USER, [first.id], 'Réseau coupé');
    markQueueFailure(db, USER, [first.id], 'Le serveur ne répond pas');

    const [a, b] = entries();
    expect(a).toMatchObject({
      attempts: 2,
      lastError: 'Le serveur ne répond pas',
      rejectedAt: null,
    });
    expect(b).toMatchObject({ id: second.id, attempts: 0, lastError: null });
  });

  it('rejectQueueEntries met de côté avec attempts, message et date', () => {
    addPerson('A');
    rejectQueueEntries(db, USER, [entries()[0].id], 'Valeur invalide (23514)', AT);
    expect(entries()[0]).toMatchObject({
      attempts: 1,
      lastError: 'Valeur invalide (23514)',
      rejectedAt: AT,
    });
  });

  it('les écritures sur les entrées d’un autre compte sont sans effet', () => {
    addPerson('A', OTHER_USER);
    const [other] = entries(OTHER_USER);
    markQueueFailure(db, USER, [other.id], 'x');
    rejectQueueEntries(db, USER, [other.id], 'x', AT);
    expect(entries(OTHER_USER)[0]).toMatchObject({
      attempts: 0,
      lastError: null,
      rejectedAt: null,
    });
  });

  it('requeueRejectedEntries remet les entrées du compte à leur place d’origine', () => {
    const ids = ['A', 'B', 'C'].map((name) => addPerson(name));
    addPerson('D', OTHER_USER);
    const [first] = entries();
    rejectQueueEntries(db, USER, [first.id], 'refus', AT);
    rejectQueueEntries(db, OTHER_USER, [entries(OTHER_USER)[0].id], 'refus', AT);

    requeueRejectedEntries(db, USER);
    expect(readQueueBatch(db, USER, 10).map((e) => e.rowId)).toEqual(ids);
    // L'historique de l'échec est gardé, l'autre compte reste mis de côté.
    expect(entries()[0]).toMatchObject({ attempts: 1, lastError: 'refus', rejectedAt: null });
    expect(rejectedCount(OTHER_USER)).toBe(1);
  });
});
