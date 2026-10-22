// Mock global de Sentry pour Jest (module natif) : les tests vérifient les appels de captureError.
export const init = jest.fn();
export const captureException = jest.fn();
export const setUser = jest.fn();
export const wrap = <T>(component: T): T => component;
