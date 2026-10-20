// Toast global (docs/STORAGE.md §5) : store sans React, appelable depuis n'importe quelle couche
// (synchro, import, repositories). Un seul toast à la fois, les suivants attendent en file.

export type ToastVariant = 'error' | 'info';

export type ToastInput = {
  message: string;
  variant?: ToastVariant;
  // Clé anti-doublon (défaut : le message).
  key?: string;
};

// `visible` : entrée puis affichage plein ; `leaving` : animation de sortie.
export type ToastPhase = 'visible' | 'leaving';

export type ActiveToast = {
  id: number;
  key: string;
  message: string;
  variant: ToastVariant;
  phase: ToastPhase;
};

// Durées (ms) : les 3 s d'affichage commencent une fois l'entrée terminée.
export const TOAST_ENTER_MS = 250;
export const TOAST_DISPLAY_MS = 3000;
export const TOAST_EXIT_MS = 150;

type QueuedToast = Omit<ActiveToast, 'phase'>;

let current: ActiveToast | null = null;
let queue: QueuedToast[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function schedule(ms: number, run: () => void) {
  timer = setTimeout(() => {
    timer = null;
    run();
  }, ms);
}

function showNext() {
  const next = queue.shift();
  current = next ? { ...next, phase: 'visible' } : null;
  emit();
  if (!next) return;
  schedule(TOAST_ENTER_MS + TOAST_DISPLAY_MS, () => {
    if (!current) return;
    current = { ...current, phase: 'leaving' };
    emit();
    schedule(TOAST_EXIT_MS, showNext);
  });
}

/** Affiche un message pendant 3 s ; ignoré si la même clé est déjà affichée ou en attente. */
export function showToast({ message, variant = 'error', key = message }: ToastInput): void {
  if (current?.key === key || queue.some((t) => t.key === key)) return;
  queue.push({ id: nextId++, key, message, variant });
  if (!current) showNext();
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Toast à l'écran (référence stable entre deux changements, pour `useSyncExternalStore`). */
export function getCurrentToast(): ActiveToast | null {
  return current;
}

/** Vide le toast courant et la file (tests). */
export function resetToasts(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  current = null;
  queue = [];
  emit();
}
