import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, KeyRound, ShieldAlert, X } from 'lucide-react';

export default function Team() {
  const [usuarios, setUsuarios] = useState([]);
  const [scriptsPublicados, setScriptsPublicados] = useState([]);
  const [modalPermissoesAberto, setModalPermissoesAberto] = useState(false);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [permissoesAtuais, setPermissoesAtuais] = useState([]);

  const [novoEmail, setNovoEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [role, setRole] = useState('Suporte');
  const navigate = useNavigate();

  const loadUsuarios = () => {
    const token = localStorage.getItem('token');
    fetch('http://127.0.0.1:8080/api/usuarios/')
      .then(res => res.json())
      .then(data => setUsuarios(data))
      .catch(err => console.error(err));

    fetch('http://127.0.0.1:8080/api/scripts/?apenas_publicados=true', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setScriptsPublicados(data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    if (localStorage.getItem('role') !== 'Admin') {
      alert('Acesso Negado: Apenas Administradores.');
      navigate('/dashboard');
      return;
    }
    loadUsuarios();
  }, [navigate]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const res = await fetch('http://127.0.0.1:8080/api/usuarios/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: novoEmail, senha: novaSenha, role })
    });
    if (res.ok) {
      alert("Usuário criado com sucesso!");
      setNovoEmail('');
      setNovaSenha('');
      loadUsuarios();
    } else {
      const data = await res.json();
      alert("Erro: " + data.detail);
    }
  };

  const handleReset = async (id, email) => {
    if(!window.confirm(`Tem certeza que deseja redefinir a senha de ${email} para 'mudar123'?`)) return;
    
    const res = await fetch(`http://127.0.0.1:8080/api/usuarios/${id}/resetar_senha`, {
      method: 'PUT'
    });
    if (res.ok) {
      alert("Senha redefinida! No próximo login ele será obrigado a trocar.");
      loadUsuarios();
    }
  };

  const abrirModalPermissoes = async (user) => {
    setUsuarioSelecionado(user);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://127.0.0.1:8080/api/usuarios/${user.id}/permissoes`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setPermissoesAtuais(data || []);
      setModalPermissoesAberto(true);
    } catch(err) {
      alert("Erro ao buscar permissões.");
    }
  };

  const togglePermissao = (scriptId) => {
    if (permissoesAtuais.includes(scriptId)) {
      setPermissoesAtuais(permissoesAtuais.filter(id => id !== scriptId));
    } else {
      setPermissoesAtuais([...permissoesAtuais, scriptId]);
    }
  };

  const salvarPermissoes = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`http://127.0.0.1:8080/api/usuarios/${usuarioSelecionado.id}/permissoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ script_ids: permissoesAtuais })
    });
    if (res.ok) {
      alert("Permissões salvas!");
      setModalPermissoesAberto(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Users size={32} color="#818cf8" />
        <h2 style={{ margin: 0 }}>Gestão de Equipe</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        {/* Formulário de Criação */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UserPlus size={20} /> Novo Membro
          </h3>
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: '1rem' }}>
              <label>E-mail</label>
              <input type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>Senha Provisória</label>
              <input type="text" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '5px' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>Perfil</label>
              <select value={role} onChange={e => setRole(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '5px' }}>
                <option value="Suporte">Suporte</option>
                <option value="Admin">Administrador</option>
              </select>
            </div>
            <button className="btn" type="submit" style={{ width: '100%', justifyContent: 'center' }}>Cadastrar Usuário</button>
          </form>
        </div>

        {/* Lista de Usuários */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginTop: 0 }}>Usuários Cadastrados</h3>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '10px' }}>E-mail</th>
                <th style={{ padding: '10px' }}>Perfil</th>
                <th style={{ padding: '10px' }}>Status</th>
                <th style={{ padding: '10px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '10px' }}>{u.email}</td>
                  <td style={{ padding: '10px' }}><span className="tag">{u.role}</span></td>
                  <td style={{ padding: '10px' }}>
                    {u.exige_troca_senha ? <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>Pendente Troca</span> : <span style={{ color: '#34d399', fontSize: '0.8rem' }}>Ativo</span>}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button onClick={() => abrirModalPermissoes(u)} className="btn" style={{ padding: '5px 10px', fontSize: '0.8rem', background: '#8b5cf6' }}>
                        <ShieldAlert size={14} /> Permissões
                      </button>
                      <button onClick={() => handleReset(u.id, u.email)} className="btn" style={{ padding: '5px 10px', fontSize: '0.8rem', background: '#475569' }}>
                        <KeyRound size={14} /> Resetar Senha
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Permissões */}
      {modalPermissoesAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ padding: '2rem', width: '450px', position: 'relative' }}>
            <button onClick={() => setModalPermissoesAberto(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ marginTop: 0 }}>Permissões de {usuarioSelecionado?.email}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Selecione os scripts que este usuário pode executar.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '2rem', maxHeight: '300px', overflowY: 'auto' }}>
              {scriptsPublicados.map(script => (
                <div key={script.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                  <input 
                    type="checkbox" 
                    checked={permissoesAtuais.includes(script.id)} 
                    onChange={() => togglePermissao(script.id)}
                    style={{ width: '20px', height: '20px' }} 
                  />
                  <label>{script.nome}</label>
                </div>
              ))}
              {scriptsPublicados.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Nenhum script publicado encontrado.</p>}
            </div>

            <button className="btn" onClick={salvarPermissoes} style={{ width: '100%', justifyContent: 'center', background: '#34d399' }}>
              Salvar Permissões
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
