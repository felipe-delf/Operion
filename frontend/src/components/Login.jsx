import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ShieldCheck, Mail } from 'lucide-react';
import { API } from '../config';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [retryAfter, setRetryAfter] = useState(() => {
    const bloqueioAte = Number(localStorage.getItem('login_block_until') || 0);
    return Math.max(0, Math.ceil((bloqueioAte - Date.now()) / 1000));
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading || retryAfter > 0) return;
    setErro('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });

      const data = await res.json();

      if (res.ok) {
        if (data.require_password_change) {
          navigate('/change-password', { state: { userId: data.user_id } });
        } else {
          localStorage.setItem('token', data.access_token);
          localStorage.setItem('role', data.role);
          localStorage.setItem('permissions', data.permissions || '');
          localStorage.removeItem('login_block_until');
          navigate('/dashboard');
        }
      } else if (res.status === 429 || res.headers.get('Retry-After')) {
        const seconds = Number(res.headers.get('Retry-After')) || data.retry_after || 180;
        setRetryAfter(seconds);
        localStorage.setItem('login_block_until', String(Date.now() + (seconds * 1000)));
        setErro(data.detail || 'Muitas tentativas. Aguarde antes de tentar novamente.');
      } else {
        setErro('Não foi possível autenticar. Verifique suas credenciais.');
      }
    } catch (error) {
      setErro('Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (retryAfter <= 0) {
      localStorage.removeItem('login_block_until');
      return undefined;
    }
    const timer = window.setInterval(() => {
      const bloqueioAte = Number(localStorage.getItem('login_block_until') || 0);
      setRetryAfter(Math.max(0, Math.ceil((bloqueioAte - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAfter]);

  return (
    <div className="login-shell">
      <form onSubmit={handleLogin} className="login-card">
        <div className="login-brand"><ShieldCheck size={22} /> <span>Operion</span></div>
        <h2>Entrar no Operion</h2>
        <p className="login-subtitle">Acesse sua conta corporativa</p>

        {erro && <div className="login-error" role="alert">{erro}{retryAfter > 0 && ` (${retryAfter}s)`}</div>}

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>E-mail</label>
          <div style={{ position: 'relative' }}>
            <Mail size={18} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-muted)' }} />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="form-input login-input"
              placeholder="seu@email.com"
              required
            />
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Senha</label>
          <input
            type="password"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            className="form-input login-input"
            required
          />
        </div>

        <button type="submit" className="btn login-submit" disabled={loading || retryAfter > 0}>
          <KeyRound size={18} />
          {loading ? 'Validando...' : retryAfter > 0 ? 'Aguarde...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
