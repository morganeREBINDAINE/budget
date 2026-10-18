export type TransactionType = 'income' | 'expense';
export type Currency = 'DZD' | 'EUR';

export type Category = {
  id: string;
  name: string;
  color: string;
  icon: string;
  position: number;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  amountDa: number;
  currency: Currency;
  categoryId: string | null;
  note: string | null;
  // YYYY-MM-DD
  date: string;
  createdAt: string;
};
