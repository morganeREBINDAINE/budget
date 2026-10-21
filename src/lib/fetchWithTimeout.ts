// Sur Android, React Native n'impose aucun délai d'expiration aux requêtes (OkHttp : connect, read et
// write à 0). Une requête partie sur une connexion morte (ex. ouverte avant un passage en mode
// avion) attendrait sans fin et bloquerait la synchronisation. Ce `fetch`, passé au client
// Supabase, annule toute requête sans réponse après `REQUEST_TIMEOUT_MS` : elle échoue
// (`AbortError`) et suit le circuit des erreurs passagères (relance automatique).

/** Délai maximal d'une requête : large pour nos lots (200 lignes envoyées, pages de 1000 reçues). */
export const REQUEST_TIMEOUT_MS = 30_000;

let timeoutCount = 0;

/** Nombre de requêtes annulées faute de réponse depuis le lancement (message dédié de la synchro). */
export function getRequestTimeoutCount(): number {
  return timeoutCount;
}

/** `fetch` annulé après `timeoutMs` sans réponse ; une annulation demandée par l'appelant est respectée. */
export function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const callerSignal = init.signal;
  const abortFromCaller = () => controller.abort();
  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener('abort', abortFromCaller);

  const timer = setTimeout(() => {
    timeoutCount += 1;
    controller.abort();
  }, timeoutMs);

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  });
}
