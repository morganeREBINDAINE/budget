import {
  getCurrentToast,
  resetToasts,
  showToast,
  subscribeToasts,
  TOAST_DISPLAY_MS,
  TOAST_ENTER_MS,
  TOAST_EXIT_MS,
} from '../toast';

const VISIBLE_MS = TOAST_ENTER_MS + TOAST_DISPLAY_MS;

beforeEach(() => {
  jest.useFakeTimers();
  resetToasts();
});

afterEach(() => {
  resetToasts();
  jest.useRealTimers();
});

describe('toast', () => {
  it('affiche le message 3 s après son entrée, puis le retire', () => {
    showToast({ message: 'Erreur réseau' });
    expect(getCurrentToast()).toMatchObject({
      message: 'Erreur réseau',
      variant: 'error',
      phase: 'visible',
    });

    jest.advanceTimersByTime(VISIBLE_MS - 1);
    expect(getCurrentToast()?.phase).toBe('visible');

    jest.advanceTimersByTime(1);
    expect(getCurrentToast()?.phase).toBe('leaving');

    jest.advanceTimersByTime(TOAST_EXIT_MS);
    expect(getCurrentToast()).toBeNull();
  });

  it('affiche les messages différents l’un après l’autre', () => {
    showToast({ message: 'A' });
    showToast({ message: 'B', variant: 'info' });
    expect(getCurrentToast()?.message).toBe('A');

    jest.advanceTimersByTime(VISIBLE_MS + TOAST_EXIT_MS);
    expect(getCurrentToast()).toMatchObject({ message: 'B', variant: 'info', phase: 'visible' });

    jest.advanceTimersByTime(VISIBLE_MS + TOAST_EXIT_MS);
    expect(getCurrentToast()).toBeNull();
  });

  it('ignore un doublon affiché ou en attente', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToasts(listener);

    showToast({ message: 'A' });
    showToast({ message: 'B' });
    showToast({ message: 'A' });
    showToast({ message: 'B' });
    expect(listener).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(VISIBLE_MS + TOAST_EXIT_MS);
    expect(getCurrentToast()?.message).toBe('B');
    jest.advanceTimersByTime(VISIBLE_MS + TOAST_EXIT_MS);
    expect(getCurrentToast()).toBeNull();
    unsubscribe();
  });

  it('ignore un doublon pendant sa sortie', () => {
    showToast({ message: 'A' });
    jest.advanceTimersByTime(VISIBLE_MS);
    showToast({ message: 'A' });
    jest.advanceTimersByTime(TOAST_EXIT_MS);
    expect(getCurrentToast()).toBeNull();
  });

  it('réaffiche la même erreur une fois disparue', () => {
    showToast({ message: 'A' });
    jest.advanceTimersByTime(VISIBLE_MS + TOAST_EXIT_MS);
    showToast({ message: 'A' });
    expect(getCurrentToast()).toMatchObject({ message: 'A', phase: 'visible' });
  });

  it('déduplique par clé quand elle est fournie', () => {
    showToast({ message: 'Synchro impossible (1)', key: 'sync' });
    showToast({ message: 'Synchro impossible (2)', key: 'sync' });
    jest.advanceTimersByTime(VISIBLE_MS + TOAST_EXIT_MS);
    expect(getCurrentToast()).toBeNull();
  });
});
