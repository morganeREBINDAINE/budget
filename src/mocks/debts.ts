import { toIsoDate } from '@/lib/format';
import type { Currency, Debt, DebtPerson, DebtRepayment } from '@/types/budget';

// Données factices (phase 2) : remplacées par SQLite en phase 3.

export const mockDebtPeople: DebtPerson[] = [
  { id: 'person-karim', name: 'Karim' },
  { id: 'person-samia', name: 'Samia' },
  { id: 'person-rachid', name: 'Tonton Rachid' },
  { id: 'person-lina', name: 'Lina' },
  { id: 'person-amel', name: 'Amel Haddad' },
];

const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toIsoDate(d);
};

type Money = {
  amountDa: number;
  currency: Currency;
  originalAmountCents: number | null;
  eurRate: number | null;
};

const da = (amountDa: number): Money => ({
  amountDa,
  currency: 'DZD',
  originalAmountCents: null,
  eurRate: null,
});

const eur = (amountEur: number, rate: number): Money => ({
  amountDa: Math.round(amountEur * rate),
  currency: 'EUR',
  originalAmountCents: Math.round(amountEur * 100),
  eurRate: rate,
});

const debt = (
  id: string,
  direction: Debt['direction'],
  personId: string,
  money: Money,
  daysAgo: number,
  note: string | null,
): Debt => {
  const date = isoDaysAgo(daysAgo);
  return { id, direction, personId, ...money, date, note, createdAt: `${date}T10:00:00` };
};

const repayment = (
  id: string,
  debtId: string,
  money: Money,
  daysAgo: number,
  note: string | null = null,
): DebtRepayment => {
  const date = isoDaysAgo(daysAgo);
  return { id, debtId, ...money, date, note, createdAt: `${date}T18:00:00` };
};

export const mockDebts: Debt[] = [
  debt('debt-1', 'i_owe', 'person-karim', da(50000), 40, 'Avance réparation voiture'),
  debt('debt-2', 'i_owe', 'person-rachid', eur(300, 250), 90, "Billet d'avion"),
  debt('debt-3', 'i_owe', 'person-samia', da(8000), 120, null),
  debt('debt-4', 'owed_to_me', 'person-lina', da(15000), 10, 'Courses du mois'),
  debt('debt-5', 'owed_to_me', 'person-karim', da(30000), 60, null),
  debt('debt-6', 'owed_to_me', 'person-amel', eur(100, 240), 200, 'Parfum'),
];

export const mockDebtRepayments: DebtRepayment[] = [
  repayment('rep-1', 'debt-1', da(20000), 25),
  repayment('rep-2', 'debt-1', da(10000), 5, 'Virement CCP'),
  repayment('rep-3', 'debt-2', eur(100, 250), 30),
  repayment('rep-4', 'debt-3', da(8000), 100),
  repayment('rep-5', 'debt-5', da(10000), 20),
  repayment('rep-6', 'debt-6', da(12000), 150),
  repayment('rep-7', 'debt-6', da(12000), 120, 'Solde'),
];
