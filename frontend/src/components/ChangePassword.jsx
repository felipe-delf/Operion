import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, Key } from 'lucide-react';
import { API } from '../config';

export default function ChangePassword() {
  const [senha, setSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [erro, setErro] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const userId = location.state?.userId;

  if (!userId) {
    navigate('/');
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (senha !== confirmaSenha) {
      setErro('As senhas não conferem!');
      return;
    }

    try {
      const res = await fetch(`${API}/api/auth/mudar_senha/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nova_senha: senha })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('role', data.role);
        localStorage.setItem('permissions', data.permissions || '');
        navigate('/dashboard');
      } else {
        setErro(data.detail || 'Erro ao redefinir senha');
      }
    } catch (error) {
      setErro('Erro de conexão com o servidor');
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '3rem', width: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <ShieldAlert size={64} color="#ef4444" />
        </div>
        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Ação Necessária</h2>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: '2rem', fontSize: '0.9rem' }}>
          Para sua segurança, é obrigatório redefinir sua senha padrão antes de acessar o painel.
        </p>
        
        {erro && <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '10px', borderRadius: '8px', marginBottom: '1rem', textAlign: 'center' }}>{erro}</div>}

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Nova Senha</label>
          <input 
            type="password" 
            value={senha}
            onChange={e => setSenha(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            required
          />
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Confirme a Nova Senha</label>
          <input 
            type="password" 
            value={confirmaSenha}
            onChange={e => setConfirmaSenha(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            required
          />
        </div>
        
        <button type="submit" className="btn" style={{ width: '100%', justifyContent: 'center' }}>
          <Key size={18} /> Salvar Nova Senha
        </button>
      </form>
    </div>
  );
}
