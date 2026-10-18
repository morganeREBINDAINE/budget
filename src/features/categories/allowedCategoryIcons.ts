import type { MaterialCommunityIcons } from '@expo/vector-icons';

export type CategoryIconName = keyof typeof MaterialCommunityIcons.glyphMap;

// Sélection autorisée pour les catégories (colonne `icon`), regroupée par thème.
export const allowedCategoryIcons: readonly CategoryIconName[] = [
  // Transport
  'car',
  'gas-station',
  'bus',
  'taxi',
  'airplane',
  // Maison et factures
  'home-outline',
  'file-document-outline',
  'lightning-bolt-outline',
  'water-outline',
  'wifi',
  'cellphone',
  'tools',
  // Alimentation
  'cart-outline',
  'basket-outline',
  'carrot',
  'food-steak',
  'fish',
  'bread-slice-outline',
  'food-apple-outline',
  'coffee-outline',
  'silverware-fork-knife',
  // Famille
  'baby-face-outline',
  'face-woman-outline',
  'face-man-outline',
  'human-male-female-child',
  'school-outline',
  'paw',
  // Santé et soin
  'medical-bag',
  'pill',
  'hanger',
  'tshirt-crew-outline',
  'lipstick',
  // Loisirs
  'gamepad-variant-outline',
  'movie-open-outline',
  'soccer',
  'beach',
  'gift-outline',
  'book-open-variant',
  // Divers
  'shopping-outline',
  'cash-multiple',
  'piggy-bank-outline',
  'hand-heart-outline',
];
