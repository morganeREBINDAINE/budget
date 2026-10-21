import { parseAmount, type StoredAmount } from '@/lib/money';
import type { Currency, Transaction, TransactionType } from '@/types/budget';

export const NOTE_MAX_LENGTH = 100;

/** Saisie brute du formulaire d'entrée / de dépense. */
export type TransactionInput = {
  type: TransactionType;
  amount: string;
  currency: Currency;
  rate: string;
  // YYYY-MM-DD
  date: string;
  categoryId: string | null;
  note: string;
};

/** Valeurs prêtes à enregistrer (colonnes de `transactions` hors champs gérés par l'outil d'écriture). */
export type TransactionValues = StoredAmount & {
  type: TransactionType;
  categoryId: string | null;
  note: string | null;
  date: string;
};

export type TransactionErrors = Partial<Record<'amount' | 'rate' | 'date' | 'category', string>>;

type Context = {
  // Date du jour (YYYY-MM-DD) : pas de transaction dans le futur.
  today: string;
  // Catégories existantes du compte : une dépense doit en référencer une.
  categoryIds: ReadonlySet<string>;
};

/** Valide la saisie : montant (cf. `parseAmount`), date ≤ aujourd'hui, catégorie existante pour une dépense. */
export function validateTransaction(
  input: TransactionInput,
  { today, categoryIds }: Context,
): { ok: true; values: TransactionValues } | { ok: false; errors: TransactionErrors } {
  const amount = parseAmount(input.amount, input.currency, input.rate);
  const errors: TransactionErrors = amount.ok ? {} : { ...amount.errors };
  if (input.date > today) errors.date = 'La date ne peut pas être dans le futur.';
  const isExpense = input.type === 'expense';
  if (isExpense && (!input.categoryId || !categoryIds.has(input.categoryId)))
    errors.category = 'Choisis une catégorie.';
  if (!amount.ok || Object.keys(errors).length > 0) return { ok: false, errors };

  const note = input.note.trim().slice(0, NOTE_MAX_LENGTH);
  return {
    ok: true,
    values: {
      ...amount.value,
      type: input.type,
      categoryId: isExpense ? input.categoryId : null,
      note: note === '' ? null : note,
      date: input.date,
    },
  };
}

/** Vrai si les valeurs validées sont identiques à la transaction enregistrée (aucune écriture utile). */
export function isUnchanged(existing: Transaction, values: TransactionValues): boolean {
  return (
    existing.type === values.type &&
    existing.amountDa === values.amountDa &&
    existing.currency === values.currency &&
    existing.originalAmountCents === values.originalAmountCents &&
    existing.eurRate === values.eurRate &&
    existing.categoryId === values.categoryId &&
    existing.note === values.note &&
    existing.date === values.date
  );
}
