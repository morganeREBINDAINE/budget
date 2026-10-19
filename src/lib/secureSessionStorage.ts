import { aesDecryptAsync, aesEncryptAsync, AESEncryptionKey, AESSealedData } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { SQLiteStorage } from 'expo-sqlite/kv-store';

// Stockage de la session Supabase : la session (souvent > 2 Ko, limite de SecureStore) est
// chiffrée en AES-GCM et rangée dans un kv-store SQLite dédié ; la clé AES, régénérée à
// chaque écriture, est rangée dans SecureStore (Keystore Android).
// Clé absente ou déchiffrement impossible (réinstallation, Keystore réinitialisé) → pas de session.
// Les opérations sont sérialisées : une écriture se fait en deux temps (session chiffrée puis clé),
// une lecture concurrente verrait sinon une session et une clé de versions différentes, jugerait la
// session illisible et la supprimerait (ex. rafraîchissement au retour de la modale Google).

const encryptedStore = new SQLiteStorage('auth-session.db');

// UTF-8 → ASCII (encodeURIComponent) pour passer en octets sans dépendre de TextEncoder/TextDecoder.
const toBytes = (value: string) =>
  Uint8Array.from(encodeURIComponent(value), (char) => char.charCodeAt(0));
const fromBytes = (bytes: Uint8Array) =>
  decodeURIComponent(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));

let queue: Promise<unknown> = Promise.resolve();

// Exécute `task` après la fin de l'opération précédente, qu'elle ait réussi ou échoué.
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function removeItemNow(key: string): Promise<void> {
  await Promise.all([encryptedStore.removeItem(key), SecureStore.deleteItemAsync(key)]);
}

async function getItemNow(key: string): Promise<string | null> {
  const [encrypted, hexKey] = await Promise.all([
    encryptedStore.getItem(key),
    SecureStore.getItemAsync(key),
  ]);
  if (!encrypted || !hexKey) return null;
  try {
    const aesKey = await AESEncryptionKey.import(hexKey, 'hex');
    // Le module natif Android n'accepte que des octets pour fromCombined (pas de base64).
    const sealedBytes = Uint8Array.from(atob(encrypted), (char) => char.charCodeAt(0));
    const bytes = await aesDecryptAsync(AESSealedData.fromCombined(sealedBytes), aesKey);
    return fromBytes(bytes);
  } catch (e) {
    console.warn('[auth] session illisible, supprimée', e);
    await removeItemNow(key);
    return null;
  }
}

async function setItemNow(key: string, value: string): Promise<void> {
  const aesKey = await AESEncryptionKey.generate();
  const sealed = await aesEncryptAsync(toBytes(value), aesKey);
  await encryptedStore.setItem(key, await sealed.combined('base64'));
  await SecureStore.setItemAsync(key, await aesKey.encoded('hex'));
}

export const secureSessionStorage = {
  getItem: (key: string) => serialized(() => getItemNow(key)),
  setItem: (key: string, value: string) => serialized(() => setItemNow(key, value)),
  removeItem: (key: string) => serialized(() => removeItemNow(key)),
};
