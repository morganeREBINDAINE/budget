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

export type RecurringFrequency = 'monthly' | 'yearly';

export type RecurringPayment = {
  id: string;
  name: string;
  amountDa: number;
  categoryId: string;
  frequency: RecurringFrequency;
  // 1–31 ; mois plus court → dernier jour du mois.
  dayOfMonth: number;
  // 1–12 si yearly, null si monthly.
  month: number | null;
  // YYYY-MM-DD : première échéance possible.
  startDate: string;
  active: boolean;
  note: string | null;
};

// Échéance arrivée et non payée (encart rouge de l'accueil).
export type DuePayment = {
  payment: RecurringPayment;
  // YYYY-MM-DD
  dueDate: string;
};

// Dettes : indépendantes du budget (aucune transaction créée).
export type DebtDirection = 'i_owe' | 'owed_to_me';

export type DebtPerson = {
  id: string;
  name: string;
};

export type Debt = {
  id: string;
  direction: DebtDirection;
  personId: string;
  amountDa: number;
  currency: Currency;
  // Montant EUR saisi (centimes) et taux DA/EUR du jour, si currency = EUR.
  originalAmountCents: number | null;
  eurRate: number | null;
  // YYYY-MM-DD
  date: string;
  note: string | null;
  createdAt: string;
};

export type DebtRepayment = {
  id: string;
  debtId: string;
  amountDa: number;
  currency: Currency;
  originalAmountCents: number | null;
  eurRate: number | null;
  // YYYY-MM-DD
  date: string;
  note: string | null;
  createdAt: string;
};
