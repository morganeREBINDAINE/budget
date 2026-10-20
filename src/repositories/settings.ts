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
