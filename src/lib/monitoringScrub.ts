// Nettoyage des événements Sentry (docs/STORAGE.md §5 : ni montant ni note dans Sentry).
// Les erreurs Postgres renvoyées par Supabase recopient les valeurs refusées dans leur détail
// (« Failing row contains (…) », « Key (…)=(…) already exists ») : montants, notes, noms de
// personnes. Ces valeurs sont masquées partout dans l'événement (message, exceptions, extras).

const FILTERED = '[filtré]';
const MAX_DEPTH = 12;

const SENSITIVE_PATTERNS: [RegExp, string][] = [
  // Violation de CHECK / NOT NULL : la ligne entière est recopiée.
  [/Failing row contains \([\s\S]*\)/g, `Failing row contains (${FILTERED})`],
  // Violation d'unicité ou de clé étrangère : les valeurs de la clé sont recopiées.
  [
    /(Key \([\s\S]*?\))=\([\s\S]*?\)(?= (?:already exists|is not present|is still referenced|conflicts with))/g,
    `$1=(${FILTERED})`,
  ],
];

export function redactSensitiveText(text: string): string {
  return SENSITIVE_PATTERNS.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    text,
  );
}

/** Copie de `value` dont toutes les chaînes sont nettoyées (objets et tableaux parcourus). */
export function redactSensitive<T>(value: T, depth = 0): T {
  if (typeof value === 'string') return redactSensitiveText(value) as T;
  if (depth >= MAX_DEPTH || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, depth + 1)) as T;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) result[key] = redactSensitive(item, depth + 1);
  return result as T;
}

type BreadcrumbLike = { category?: string };

/**
 * Breadcrumbs `console` écartés : les journaux de l'app recopient les erreurs techniques
 * (objets d'erreur complets) ; les autres sont nettoyés.
 */
export function scrubBreadcrumb<B extends BreadcrumbLike>(breadcrumb: B): B | null {
  if (breadcrumb.category === 'console') return null;
  return redactSensitive(breadcrumb);
}
