import type { Database } from '@/db/client';
import { getLastEurRate, saveLastEurRate } from '@/repositories/settings';

// Dernier taux DA/EUR saisi (transactions, dettes, remboursements) : sert seulement à préremplir
// le champ « Taux du jour ». Un échec de lecture ou d'écriture est journalisé, jamais bloquant.

export function readLastEurRate(db: Database, userId: string): number | null {
  try {
    return getLastEurRate(db, userId);
  } catch (error) {
    console.error('[db] Lecture du dernier taux impossible', error);
    return null;
  }
}

export function rememberEurRate(db: Database, userId: string, rate: number | null): void {
  if (rate === null) return;
  try {
    saveLastEurRate(db, userId, rate);
  } catch (error) {
    console.error('[db] Dernier taux non mémorisé', error);
  }
}
