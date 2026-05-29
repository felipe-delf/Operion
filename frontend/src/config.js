const getApiUrl = () => {
  const hostname = window.location.hostname;
  // Se o usuário está desenvolvendo localmente em localhost, força o IPv4 127.0.0.1
  // para evitar colisões com WSL relay ou portas presas no [::1] (IPv6)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://127.0.0.1:8080';
  }
  // Para outros administradores acessando via IP de rede ou domínio,
  // usa o hostname do navegador de forma dinâmica
  return `http://${hostname}:8080`;
};

export const API = getApiUrl();
