// Règles de la reconnexion (docs/STORAGE.md §4) : acceptée uniquement pour le compte local.

/** Même adresse email, sans tenir compte de la casse ni des espaces autour. */
export function isSameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Message affiché quand un autre compte Google est choisi. */
export function wrongAccountMessage(email: string | null): string {
  return email
    ? `Ce n’est pas le bon compte. Choisis ${email}.`
    : 'Ce n’est pas le compte de ce téléphone. Choisis le compte utilisé à la première connexion.';
}
