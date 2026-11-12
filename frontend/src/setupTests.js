import '@testing-library/jest-dom';

// O ambiente de teste do Vitest pode não expor localStorage dependendo da
// versão do jsdom/Node. O login precisa apenas da API de armazenamento.
if (!globalThis.localStorage) {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
    clear: () => storage.clear(),
  };
}
