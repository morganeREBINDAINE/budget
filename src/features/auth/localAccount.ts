import * as SecureStore from 'expo-secure-store';

// Compte local persistant (docs/STORAGE.md §4) : l'état « connecté » de l'app repose sur lui,
// pas sur la validité du token Supabase. Seule la déconnexion manuelle le supprime.
// Petit JSON (< 2 Ko) : rangé directement dans SecureStore (Keystore Android).

export type LocalAccount = {
  id: string;
  email: string | null;
  name: string | null;
};

const ACCOUNT_KEY = 'budget-local-account';

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

function parseAccount(raw: string): LocalAccount | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { id, email, name } = value as Record<string, unknown>;
    if (typeof id !== 'string' || !id || !isNullableString(email) || !isNullableString(name)) {
      return null;
    }
    return { id, email, name };
  } catch {
    return null;
  }
}

export async function loadLocalAccount(): Promise<LocalAccount | null> {
  const raw = await SecureStore.getItemAsync(ACCOUNT_KEY);
  if (!raw) return null;
  const account = parseAccount(raw);
  if (!account) console.warn('[auth] compte local illisible, ignoré');
  return account;
}

export async function saveLocalAccount(account: LocalAccount): Promise<void> {
  await SecureStore.setItemAsync(ACCOUNT_KEY, JSON.stringify(account));
}

export async function clearLocalAccount(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCOUNT_KEY);
}
