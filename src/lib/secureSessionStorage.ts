import { aesDecryptAsync, aesEncryptAsync, AESEncryptionKey, AESSealedData } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { SQLiteStorage } from 'expo-sqlite/kv-store';

// Stockage de la session Supabase : la session (souvent > 2 Ko, limite de SecureStore) est
// chiffrée en AES-GCM et rangée dans un kv-store SQLite dédié ; la clé AES, régénérée à
// chaque écriture, est rangée dans SecureStore (Keystore Android).
// Clé absente ou déchiffrement impossible (réinstallation, Keystore réinitialisé) → pas de session.

const encryptedStore = new SQLiteStorage('auth-session.db');

// UTF-8 → ASCII (encodeURIComponent) pour passer en octets sans dépendre de TextEncoder/TextDecoder.
const toBytes = (value: string) =>
  Uint8Array.from(encodeURIComponent(value), (char) => char.charCodeAt(0));
const fromBytes = (bytes: Uint8Array) =>
  decodeURIComponent(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));

async function removeItem(key: string): Promise<void> {
  await Promise.all([encryptedStore.removeItem(key), SecureStore.deleteItemAsync(key)]);
}

async function getItem(key: string): Promise<string | null> {
  const [encrypted, hexKey] = await Promise.all([
    encryptedStore.getItem(key),
    SecureStore.getItemAsync(key),
  ]);
  if (!encrypted || !hexKey) return null;
  try {
    const aesKey = await AESEncryptionKey.import(hexKey, 'hex');
    const bytes = await aesDecryptAsync(AESSealedData.fromCombined(encrypted), aesKey);
    return fromBytes(bytes);
  } catch (e) {
    console.warn('[auth] session illisible, supprimée', e);
    await removeItem(key);
    return null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  const aesKey = await AESEncryptionKey.generate();
  const sealed = await aesEncryptAsync(toBytes(value), aesKey);
  await encryptedStore.setItem(key, await sealed.combined('base64'));
  await SecureStore.setItemAsync(key, await aesKey.encoded('hex'));
}

export const secureSessionStorage = { getItem, setItem, removeItem };
