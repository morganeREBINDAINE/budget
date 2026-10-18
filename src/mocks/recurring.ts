import { toIsoDate } from '@/lib/format';
import type { DuePayment, RecurringPayment } from '@/types/budget';

// Données factices (phase 2) : remplacées par SQLite et lib/recurring.ts en phase 3.

const daysFromToday = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

const isoInMonths = (months: number, day: number) => {
  const d = new Date();
  return toIsoDate(new Date(d.getFullYear(), d.getMonth() + months, day));
};

const today = daysFromToday(0);
const threeDaysAgo = daysFromToday(-3);

export const mockRecurringPayments: RecurringPayment[] = [
  {
    id: 'rec-loyer',
    name: 'Loyer',
    amountDa: 25000,
    categoryId: 'cat-maison',
    frequency: 'monthly',
    dayOfMonth: today.getDate(),
    month: null,
    startDate: toIsoDate(daysFromToday(-200)),
    active: true,
    note: null,
  },
  {
    id: 'rec-idoom',
    name: 'Idoom fibre',
    amountDa: 2600,
    categoryId: 'cat-factures',
    frequency: 'monthly',
    dayOfMonth: threeDaysAgo.getDate(),
    month: null,
    startDate: toIsoDate(daysFromToday(-120)),
    active: true,
    note: 'Abonnement 50 Mb',
  },
  {
    id: 'rec-creche',
    name: 'Crèche',
    amountDa: 12000,
    categoryId: 'cat-neyla',
    frequency: 'monthly',
    dayOfMonth: 1,
    month: null,
    startDate: toIsoDate(daysFromToday(-60)),
    active: true,
    note: null,
  },
  {
    id: 'rec-assurance',
    name: 'Assurance voiture',
    amountDa: 18000,
    categoryId: 'cat-voiture',
    frequency: 'yearly',
    dayOfMonth: 15,
    month: 3,
    startDate: toIsoDate(daysFromToday(-300)),
    active: true,
    note: null,
  },
  {
    id: 'rec-salle',
    name: 'Salle de sport',
    amountDa: 3000,
    categoryId: 'cat-loisirs',
    frequency: 'monthly',
    dayOfMonth: 31,
    month: null,
    startDate: toIsoDate(daysFromToday(-400)),
    active: false,
    note: 'En pause',
  },
];

const nextMarch15 = () => {
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), 2, 15);
  return toIsoDate(
    thisYear >= daysFromToday(0) ? thisYear : new Date(now.getFullYear() + 1, 2, 15),
  );
};

// Prochaine échéance (factice) ; null si inactif. Une échéance passée = en retard.
export const mockNextDueDates: Record<string, string | null> = {
  'rec-loyer': toIsoDate(today),
  'rec-idoom': toIsoDate(threeDaysAgo),
  'rec-creche': isoInMonths(1, 1),
  'rec-assurance': nextMarch15(),
  'rec-salle': null,
};

const byId = (id: string) => mockRecurringPayments.find((p) => p.id === id)!;

// Encarts rouges de l'accueil : un dû aujourd'hui, un en retard.
export const mockDuePayments: DuePayment[] = [
  { payment: byId('rec-idoom'), dueDate: toIsoDate(threeDaysAgo) },
  { payment: byId('rec-loyer'), dueDate: toIsoDate(today) },
];
