import { categoryRainbow } from '@/design-system';
import type { Category } from '@/types/budget';

// Données factices (phase 2) : encore utilisées par les paiements réguliers et les dettes,
// remplacées par SQLite dans leurs tâches de la phase 6.
export const mockCategories: Category[] = [
  { id: 'cat-voiture', name: 'Voiture', color: categoryRainbow[0], icon: 'car', position: 1 },
  {
    id: 'cat-factures',
    name: 'Factures',
    color: categoryRainbow[1],
    icon: 'file-document-outline',
    position: 2,
  },
  {
    id: 'cat-maison',
    name: 'Maison',
    color: categoryRainbow[2],
    icon: 'home-outline',
    position: 3,
  },
  {
    id: 'cat-hanout',
    name: 'Hanout',
    color: categoryRainbow[3],
    icon: 'cart-outline',
    position: 4,
  },
  { id: 'cat-khaddar', name: 'Khaddar', color: categoryRainbow[4], icon: 'carrot', position: 5 },
  {
    id: 'cat-boucherie',
    name: 'Boucherie',
    color: categoryRainbow[5],
    icon: 'food-steak',
    position: 6,
  },
  {
    id: 'cat-neyla',
    name: 'Neyla',
    color: categoryRainbow[6],
    icon: 'baby-face-outline',
    position: 7,
  },
  {
    id: 'cat-assya',
    name: 'Assya',
    color: categoryRainbow[7],
    icon: 'face-woman-outline',
    position: 8,
  },
  {
    id: 'cat-loisirs',
    name: 'Loisirs',
    color: categoryRainbow[8],
    icon: 'gamepad-variant-outline',
    position: 9,
  },
];

// Dernier taux DA/EUR utilisé (préremplit le champ « Taux du jour »).
export const MOCK_EUR_RATE = 250;
