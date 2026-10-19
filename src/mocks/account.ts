// Simule une requête asynchrone (export, import, écritures pas encore branchées sur SQLite).
export const fakeRequest = (ms = 1200) => new Promise<void>((resolve) => setTimeout(resolve, ms));
