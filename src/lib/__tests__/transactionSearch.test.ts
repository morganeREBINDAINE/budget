import { filterTransactions, transactionLabel } from '@/lib/transactionSearch';
import type { Category, Transaction } from '@/types/budget';

const sante: Category = { id: 'sante', name: 'Santé', color: '#EF4444', icon: 'pill', position: 1 };
const categoriesById = new Map([[sante.id, sante]]);

const tx = (
  id: string,
  type: Transaction['type'],
  amountDa: number,
  categoryId: string | null,
  note: string | null,
): Transaction => ({
  id,
  type,
  amountDa,
  currency: 'DZD',
  originalAmountCents: null,
  eurRate: null,
  categoryId,
  note,
  date: '2026-10-01',
  createdAt: '2026-10-01T10:00:00.000Z',
});

const pharmacie = tx('pharmacie', 'expense', 12500, 'sante', 'Pharmacie du centre');
const salaire = tx('salaire', 'income', 250000, null, 'Salaire octobre');
const orpheline = tx('orpheline', 'expense', 900, 'disparue', null);
const all = [pharmacie, salaire, orpheline];

const ids = (query: string, eurRate: number | null = null) =>
  filterTransactions(all, query, categoriesById, eurRate).map((t) => t.id);

describe('transactionLabel', () => {
  it('nomme les entrées, les catégories et les catégories introuvables', () => {
    expect(transactionLabel(salaire, undefined)).toBe('Entrée');
    expect(transactionLabel(pharmacie, sante)).toBe('Santé');
    expect(transactionLabel(orpheline, undefined)).toBe('Sans catégorie');
  });
});

describe('filterTransactions', () => {
  it('rend la liste entière pour une requête vide ou blanche', () => {
    expect(ids('')).toEqual(['pharmacie', 'salaire', 'orpheline']);
    expect(ids('   ')).toEqual(['pharmacie', 'salaire', 'orpheline']);
  });

  it('cherche dans la note sans tenir compte de la casse ni des accents', () => {
    expect(ids('PHARMA')).toEqual(['pharmacie']);
    expect(ids('salaire oct')).toEqual(['salaire']);
  });

  it('cherche dans le libellé de catégorie', () => {
    expect(ids('sante')).toEqual(['pharmacie']);
    expect(ids('entrée')).toEqual(['salaire']);
    expect(ids('sans cat')).toEqual(['orpheline']);
  });

  it('cherche dans le montant, espaces ignorés', () => {
    expect(ids('12500')).toEqual(['pharmacie']);
    expect(ids('12 500')).toEqual(['pharmacie']);
    expect(ids('900')).toEqual(['orpheline']);
    expect(ids('250 000')).toEqual(['salaire']);
    expect(ids('250')).toEqual(['pharmacie', 'salaire']);
  });

  it('cherche dans le montant en euros en vue « Voir en euro »', () => {
    // 12 500 DA → 50 €, 250 000 DA → 1 000 €, 900 DA → 4 € au taux de 250 DA / €.
    expect(ids('1000', 250)).toEqual(['salaire']);
    expect(ids('12500', 250)).toEqual([]);
  });

  it('ne rend rien sans correspondance', () => {
    expect(ids('loyer')).toEqual([]);
  });
});
