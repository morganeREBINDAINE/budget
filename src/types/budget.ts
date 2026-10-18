export type TransactionType = 'income' | 'expense';
export type Currency = 'DZD' | 'EUR';

export type Category = {
  id: string;
  name: string;
  color: string;
  // Nom d'icône Material Community Icons (ex. « cart-outline »).
  icon: string;
  position: number;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  amountDa: number;
  currency: Currency;
  // Montant EUR saisi (centimes) et taux DA/EUR appliqué, si currency = EUR.
  originalAmountCents: number | null;
  eurRate: number | null;
  categoryId: string | null;
  note: string | null;
  // YYYY-MM-DD
  date: string;
  createdAt: string;
};
