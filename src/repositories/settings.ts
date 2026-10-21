import { and, eq } from 'drizzle-orm';

import type { Database } from '@/db/client';
import { settings, type SettingKey } from '@/db/schema';

// Réglages clé/valeur propres à chaque compte (table locale, jamais synchronisée).

/** Valeur d'un réglage du compte, `null` si absent. */
export function getSetting(db: Database, userId: string, key: SettingKey): string | null {
  const row = db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.userId, userId), eq(settings.key, key)))
    .get();
  return row?.value ?? null;
}

/** Crée ou remplace un réglage du compte. */
export function setSetting(db: Database, userId: string, key: SettingKey, value: string): void {
  db.insert(settings)
    .values({ userId, key, value })
    .onConflictDoUpdate({ target: [settings.userId, settings.key], set: { value } })
    .run();
}

/** Dernier taux DA/EUR saisi (transactions, dettes, remboursements), `null` si jamais saisi. */
export function getLastEurRate(db: Database, userId: string): number | null {
  const value = getSetting(db, userId, 'last_eur_rate');
  const rate = value === null ? NaN : Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** Mémorise le dernier taux saisi (préremplit le champ « Taux du jour »). */
export function saveLastEurRate(db: Database, userId: string, rate: number): void {
  setSetting(db, userId, 'last_eur_rate', String(rate));
}
