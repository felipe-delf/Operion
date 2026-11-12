// No desenvolvimento, o Vite acessa o backend local diretamente.
// No Docker, a API usa o mesmo domínio do frontend e o Nginx encaminha
// as requisições /api para o container backend.
const configuredApi = import.meta.env.VITE_API_URL;
export const API = (configuredApi ?? (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '')).replace(/\/$/, '');
