import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, KeyRound, ShieldAlert, X, Pencil, CheckCircle, XCircle } from 'lucide-react';

const API = 'http://127.0.0.1:8080';

export default function Team() {
  const [usuarios, setUsuarios] = useState([]);
  const [scriptsPublicados, setScriptsPublicados] = useState([]);

  // Modal de Permissões
  const [modalPermissoesAberto, setModalPermissoesAberto] = useState(false);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [permissoesAtuais, setPermissoesAtuais] = useState([]);

  // Modal de Edição de Perfil/Status
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [edicaoRole, setEdicaoRole] = useState('Suporte');
  const [edicaoAtivo, setEdicaoAtivo] = useState(true);

  // Formulário novo usuário
  const [novoEmail, setNovoEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [role, setRole] = useState('Suporte');

  const navigate = useNavigate();

  const token = () => localStorage.getItem('token');

  const loadUsuarios = () => {
    fetch(`${API}/api/usuarios/`)
      .then(res => res.json())
      .then(data => setUsuarios(data))
      .catch(err => console.error(err));

    fetch(`${API}/api/scripts/?apenas_publicados=true`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
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

  // ── Criar usuário ──────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API}/api/usuarios/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: novoEmail, senha: novaSenha, role }),
    });
    if (res.ok) {
      alert('Usuário criado com sucesso!');
      setNovoEmail(''); setNovaSenha('');
      loadUsuarios();
    } else {
      const data = await res.json();
      alert('Erro: ' + data.detail);
    }
  };

  // ── Resetar senha ──────────────────────────────────────────────────────────
  const handleReset = async (id, email) => {
    if (!window.confirm(`Redefinir a senha de ${email} para 'mudar123'?`)) return;
    const res = await fetch(`${API}/api/usuarios/${id}/resetar_senha`, { method: 'PUT' });
    if (res.ok) {
      alert('Senha redefinida! No próximo login ele será obrigado a trocar.');
      loadUsuarios();
    }
  };

  // ── Modal de Permissões ───────────────────────────────────────────────────
  const abrirModalPermissoes = async (user) => {
    setUsuarioSelecionado(user);
    try {
      const res = await fetch(`${API}/api/usuarios/${user.id}/permissoes`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      setPermissoesAtuais(data || []);
      setModalPermissoesAberto(true);
    } catch {
      alert('Erro ao buscar permissões.');
    }
  };

  const togglePermissao = (scriptId) => {
    setPermissoesAtuais(prev =>
      prev.includes(scriptId) ? prev.filter(id => id !== scriptId) : [...prev, scriptId]
    );
  };

  const salvarPermissoes = async () => {
    const res = await fetch(`${API}/api/usuarios/${usuarioSelecionado.id}/permissoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ script_ids: permissoesAtuais }),
    });
    if (res.ok) { alert('Permissões salvas!'); setModalPermissoesAberto(false); }
  };

  // ── Modal de Edição de Perfil/Status ─────────────────────────────────────
  const abrirModalEdicao = (user) => {
    setUsuarioSelecionado(user);
    setEdicaoRole(user.role);
    setEdicaoAtivo(user.ativo);
    setModalEdicaoAberto(true);
  };

  const salvarEdicao = async () => {
    const res = await fetch(`${API}/api/usuarios/${usuarioSelecionado.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ role: edicaoRole, ativo: edicaoAtivo }),
    });
    if (res.ok) {
      alert('Usuário atualizado com sucesso!');
      setModalEdicaoAberto(false);
      loadUsuarios();
    } else {
      const data = await res.json();
      alert('Erro: ' + data.detail);
    }
  };

  // ── Helpers visuais ───────────────────────────────────────────────────────
  const badgeRole = (role) => ({
    background: role === 'Admin' ? 'rgba(139, 92, 246, 0.25)' : 'rgba(100, 116, 139, 0.25)',
    color: role === 'Admin' ? '#a78bfa' : '#94a3b8',
    padding: '2px 10px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600,
  });

  const inputStyle = {
    width: '100%', padding: '9px 12px', marginTop: '6px', borderRadius: '8px',
    background: 'rgba(0,0,0,0.25)', color: 'white',
    border: '1px solid rgba(255,255,255,0.12)', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Users size={32} color="#818cf8" />
        <h2 style={{ margin: 0 }}>Gestão de Equipe</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>

        {/* ── Formulário de Criação ─────────────────────────────────────── */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UserPlus size={20} /> Novo Membro
          </h3>
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: '1rem' }}>
              <label>E-mail</label>
              <input type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>Senha Provisória</label>
              <input type="text" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label>Perfil</label>
              <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
                <option value="Suporte">Suporte</option>
                <option value="Admin">Administrador</option>
              </select>
            </div>
            <button className="btn" type="submit" style={{ width: '100%', justifyContent: 'center' }}>
              Cadastrar Usuário
            </button>
          </form>
        </div>

        {/* ── Lista de Usuários ─────────────────────────────────────────── */}
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
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: u.ativo ? 1 : 0.5 }}>
                  <td style={{ padding: '10px', color: u.ativo ? 'white' : '#94a3b8' }}>{u.email}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={badgeRole(u.role)}>{u.role}</span>
                  </td>
                  <td style={{ padding: '10px' }}>
                    {u.ativo
                      ? <span style={{ color: '#34d399', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={13} /> Ativo</span>
                      : <span style={{ color: '#ef4444', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}><XCircle size={13} /> Inativo</span>
                    }
                    {u.exige_troca_senha && u.ativo && (
                      <span style={{ color: '#f59e0b', fontSize: '0.75rem', display: 'block', marginTop: '2px' }}>
                        ⏳ Troca pendente
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      <button onClick={() => abrirModalEdicao(u)} className="btn"
                        style={{ padding: '5px 10px', fontSize: '0.78rem', background: '#3b82f6' }} title="Editar perfil e status">
                        <Pencil size={13} /> Editar
                      </button>
                      <button onClick={() => abrirModalPermissoes(u)} className="btn"
                        style={{ padding: '5px 10px', fontSize: '0.78rem', background: '#8b5cf6' }} title="Permissões de scripts">
                        <ShieldAlert size={13} /> Permissões
                      </button>
                      <button onClick={() => handleReset(u.id, u.email)} className="btn"
                        style={{ padding: '5px 10px', fontSize: '0.78rem', background: '#475569' }} title="Resetar senha">
                        <KeyRound size={13} /> Senha
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ Modal de Edição de Perfil/Status ════════════════════════════════ */}
      {modalEdicaoAberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ padding: '2rem', width: '420px', position: 'relative' }}>
            <button onClick={() => setModalEdicaoAberto(false)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Pencil size={18} color="#3b82f6" /> Editar Usuário
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              {usuarioSelecionado?.email}
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem' }}>Perfil</label>
              <select value={edicaoRole} onChange={e => setEdicaoRole(e.target.value)} style={inputStyle}>
                <option value="Suporte">Suporte</option>
                <option value="Admin">Administrador</option>
              </select>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem' }}>Status do Usuário</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setEdicaoAtivo(true)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '10px', border: '2px solid',
                    borderColor: edicaoAtivo ? '#34d399' : 'rgba(255,255,255,0.1)',
                    background: edicaoAtivo ? 'rgba(52, 211, 153, 0.15)' : 'rgba(0,0,0,0.2)',
                    color: edicaoAtivo ? '#34d399' : '#94a3b8',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 600,
                  }}>
                  <CheckCircle size={16} /> Ativo
                </button>
                <button
                  onClick={() => setEdicaoAtivo(false)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '10px', border: '2px solid',
                    borderColor: !edicaoAtivo ? '#ef4444' : 'rgba(255,255,255,0.1)',
                    background: !edicaoAtivo ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0,0,0,0.2)',
                    color: !edicaoAtivo ? '#ef4444' : '#94a3b8',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 600,
                  }}>
                  <XCircle size={16} /> Inativo
                </button>
              </div>
            </div>

            <button className="btn" onClick={salvarEdicao} style={{ width: '100%', justifyContent: 'center', background: '#3b82f6' }}>
              Salvar Alterações
            </button>
          </div>
        </div>
      )}

      {/* ══ Modal de Permissões ══════════════════════════════════════════════ */}
      {modalPermissoesAberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ padding: '2rem', width: '450px', position: 'relative' }}>
            <button onClick={() => setModalPermissoesAberto(false)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ marginTop: 0 }}>Permissões de {usuarioSelecionado?.email}</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Selecione os scripts que este usuário pode executar.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '2rem', maxHeight: '300px', overflowY: 'auto' }}>
              {scriptsPublicados.map(script => (
                <div key={script.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                  <input type="checkbox" checked={permissoesAtuais.includes(script.id)}
                    onChange={() => togglePermissao(script.id)} style={{ width: '18px', height: '18px' }} />
                  <label>{script.nome}</label>
                </div>
              ))}
              {scriptsPublicados.length === 0 && <p style={{ color: '#94a3b8' }}>Nenhum script publicado encontrado.</p>}
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
