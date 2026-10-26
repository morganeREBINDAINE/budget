import { displayAmount } from '@/lib/format';
import { normalizeName } from '@/lib/text';
import type { Category, Transaction } from '@/types/budget';

// Libellé de catégorie d'une ligne : « Entrée » pour un revenu, sinon nom de la catégorie.
export function transactionLabel(transaction: Transaction, category: Category | undefined): string {
  if (transaction.type === 'income') return 'Entrée';
  return category?.name ?? 'Sans catégorie';
}

// Espaces (dont insécables) ignorés pour chercher un montant : « 2 500 » = « 2500 ».
const SPACES = /\s/g;
const DIGITS_ONLY = /^\d+$/;

/**
 * Recherche de la liste « Détail » : note, libellé de catégorie (casse et accents ignorés) ou
 * montant affiché (DA, ou euros arrondis en vue « Voir en euro »). Requête vide : liste entière.
 */
export function filterTransactions(
  transactions: Transaction[],
  query: string,
  categoriesById: Map<string, Category>,
  eurRate: number | null = null,
): Transaction[] {
  const text = normalizeName(query);
  if (text === '') return transactions;
  const digits = text.replace(SPACES, '');
  const searchAmount = DIGITS_ONLY.test(digits);

  return transactions.filter((t) => {
    const category = t.categoryId ? categoriesById.get(t.categoryId) : undefined;
    const words = normalizeName(`${t.note ?? ''} ${transactionLabel(t, category)}`);
    if (words.includes(text)) return true;
    return searchAmount && String(displayAmount(t.amountDa, eurRate).value).includes(digits);
  });
}
