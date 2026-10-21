import { fetchWithTimeout, getRequestTimeoutCount } from '@/lib/fetchWithTimeout';

// `fetch` qui ne répond jamais : rejette comme React Native quand son signal est (ou était) annulé.
function hangingFetch() {
  return jest.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const abort = () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        if (init?.signal?.aborted) abort();
        else init?.signal?.addEventListener('abort', abort);
      }),
  );
}

const originalFetch = global.fetch;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  global.fetch = originalFetch;
});

describe('fetchWithTimeout', () => {
  it('annule une requête restée sans réponse après le délai et la compte', async () => {
    global.fetch = hangingFetch();
    const before = getRequestTimeoutCount();
    const request = fetchWithTimeout('https://example.test', {}, 1000);
    const settled = expect(request).rejects.toMatchObject({ name: 'AbortError' });

    jest.advanceTimersByTime(999);
    expect(getRequestTimeoutCount()).toBe(before);
    jest.advanceTimersByTime(1);
    await settled;
    expect(getRequestTimeoutCount()).toBe(before + 1);
  });

  it('renvoie la réponse et supprime le minuteur', async () => {
    const response = { ok: true } as Response;
    global.fetch = jest.fn(async () => response);
    const before = getRequestTimeoutCount();

    await expect(fetchWithTimeout('https://example.test', { method: 'POST' }, 1000)).resolves.toBe(
      response,
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.test',
      expect.objectContaining({ method: 'POST', signal: expect.any(AbortSignal) }),
    );
    expect(jest.getTimerCount()).toBe(0);
    expect(getRequestTimeoutCount()).toBe(before);
  });

  it("respecte une annulation demandée par l'appelant, sans la compter comme un délai dépassé", async () => {
    global.fetch = hangingFetch();
    const before = getRequestTimeoutCount();
    const caller = new AbortController();
    const request = fetchWithTimeout('https://example.test', { signal: caller.signal }, 1000);

    caller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(jest.getTimerCount()).toBe(0);
    expect(getRequestTimeoutCount()).toBe(before);
  });

  it("annule tout de suite si le signal de l'appelant l'est déjà", async () => {
    global.fetch = hangingFetch();
    const caller = new AbortController();
    caller.abort();

    await expect(
      fetchWithTimeout('https://example.test', { signal: caller.signal }, 1000),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
