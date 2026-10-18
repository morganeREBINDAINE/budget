import { categoryColors } from '@/design-system';
import type { Category, Transaction } from '@/types/budget';

// Données factices (phase 2) : remplacées par SQLite en phase 3.
export const mockCategories: Category[] = [
  { id: 'cat-voiture', name: 'Voiture', color: categoryColors.transport, icon: 'car', position: 1 },
  {
    id: 'cat-factures',
    name: 'Factures',
    color: categoryColors.bills,
    icon: 'file-document-outline',
    position: 2,
  },
  {
    id: 'cat-maison',
    name: 'Maison',
    color: categoryColors.subscriptions,
    icon: 'home-outline',
    position: 3,
  },
  {
    id: 'cat-hanout',
    name: 'Hanout',
    color: categoryColors.groceries,
    icon: 'cart-outline',
    position: 4,
  },
  { id: 'cat-khaddar', name: 'Khaddar', color: categoryColors.income, icon: 'carrot', position: 5 },
  {
    id: 'cat-boucherie',
    name: 'Boucherie',
    color: categoryColors.health,
    icon: 'food-steak',
    position: 6,
  },
  {
    id: 'cat-neyla',
    name: 'Neyla',
    color: categoryColors.education,
    icon: 'baby-face-outline',
    position: 7,
  },
  {
    id: 'cat-assya',
    name: 'Assya',
    color: categoryColors.leisure,
    icon: 'face-woman-outline',
    position: 8,
  },
  {
    id: 'cat-loisirs',
    name: 'Loisirs',
    color: categoryColors.restaurants,
    icon: 'gamepad-variant-outline',
    position: 9,
  },
];

const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

let seq = 0;
const tx = (
  type: Transaction['type'],
  amountDa: number,
  daysAgo: number,
  categoryId: string | null,
  note: string | null,
  currency: Transaction['currency'] = 'DZD',
): Transaction => {
  seq += 1;
  const date = isoDaysAgo(daysAgo);
  const hour = String(8 + (seq % 12)).padStart(2, '0');
  return {
    id: `tx-${seq}`,
    type,
    amountDa,
    currency,
    categoryId,
    note,
    date,
    createdAt: `${date}T${hour}:00:00`,
  };
};

export const mockTransactions: Transaction[] = [
  tx('expense', 14200, 0, 'cat-hanout', 'Supermarché Uno'),
  tx('income', 280000, 1, null, 'Salaire'),
  tx('expense', 4800, 2, 'cat-boucherie', 'Boucherie du marché'),
  tx('expense', 3500, 3, 'cat-voiture', 'Plein carburant'),
  tx('expense', 2600, 4, 'cat-factures', 'Idoom'),
  tx('income', 40000, 5, null, 'Remboursement', 'EUR'),
  tx('expense', 6200, 6, 'cat-khaddar', null),
  tx('expense', 12000, 8, 'cat-neyla', 'Crèche'),
  tx('expense', 8500, 10, 'cat-assya', 'Vêtements'),
  tx('expense', 25000, 12, 'cat-maison', 'Loyer'),
  tx('expense', 3000, 14, 'cat-loisirs', 'Cinéma'),
  tx('expense', 9800, 35, 'cat-hanout', 'Courses'),
  tx('income', 280000, 32, null, 'Salaire'),
  tx('expense', 18000, 40, 'cat-voiture', 'Vidange'),
];
