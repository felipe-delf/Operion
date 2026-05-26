import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, KeyRound, ShieldAlert, X, Pencil, CheckCircle, XCircle, ShieldCheck, FolderPlus } from 'lucide-react';

const API = `http://${window.location.hostname}:8080`;

export default function Team() {
  const [usuarios, setUsuarios] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [scriptsPublicados, setScriptsPublicados] = useState([]);

  // Modal de Permissões de Scripts (por Usuário)
  const [modalPermissoesAberto, setModalPermissoesAberto] = useState(false);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [permissoesAtuais, setPermissoesAtuais] = useState([]);

  // Modal de Edição de Perfil/Status de Usuário
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [edicaoGrupoId, setEdicaoGrupoId] = useState('');
  const [edicaoAtivo, setEdicaoAtivo] = useState(true);

  // Modal de Edição de Grupo Dinâmico
  const [modalGrupoAberto, setModalGrupoAberto] = useState(false);
  const [grupoSelecionado, setGrupoSelecionado] = useState(null);
  const [nomeGrupoEdicao, setNomeGrupoEdicao] = useState('');
  const [descricaoGrupoEdicao, setDescricaoGrupoEdicao] = useState('');
  const [permissoesGrupoEdicao, setPermissoesGrupoEdicao] = useState([]);

  // Formulário novo usuário
  const [novoEmail, setNovoEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [grupoIdSelecionado, setGrupoIdSelecionado] = useState('');

  // Formulário novo grupo
  const [novoGrupoNome, setNovoGrupoNome] = useState('');
  const [novoGrupoDescricao, setNovoGrupoDescricao] = useState('');
  const [novoGrupoPermissoes, setNovoGrupoPermissoes] = useState([]);

  const navigate = useNavigate();
  const token = () => localStorage.getItem('token');

  // 7 Permissões Nativas do Sistema
  const SISTEM_PERMISSIONS = [
    { key: 'VER_DASHBOARD', label: 'Painel Central', desc: 'Visualizar Dashboard' },
    { key: 'EXECUTAR_SCRIPT', label: 'Executar Scripts', desc: 'Rodar scripts SQL pontuais nas lojas individualmente' },
    { key: 'GERENCIAR_COFRE', label: 'Gerenciar Cofre SQL', desc: 'Criar, editar e excluir scripts' },
    { key: 'GERENCIAR_AUDITORIA', label: 'Gerenciar Auditoria', desc: 'Criar e alterar regras fiscais' },
    { key: 'VER_LOGS', label: 'Visualizar Logs', desc: 'Ver histórico completo de auditoria de disparos' },
    { key: 'EXECUTAR_BROADCAST', label: 'Disparar Broadcast', desc: 'Executar scripts em lote em todas as lojas' },
    { key: 'GERENCIAR_EQUIPE', label: 'Gerenciar Equipe e RBAC', desc: 'Criar usuários e editar grupos' }
  ];

  const loadData = () => {
    const authHeaders = { Authorization: `Bearer ${token()}` };

    // 1. Carrega Usuários
    fetch(`${API}/api/usuarios/`, { headers: authHeaders })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUsuarios(data);
        } else {
          setUsuarios([]);
        }
      })
      .catch(err => {
        console.error(err);
        setUsuarios([]);
      });

    // 2. Carrega Grupos Dinâmicos
    fetch(`${API}/api/usuarios/grupos/`, { headers: authHeaders })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setGrupos(data);
          if (data.length > 0 && !grupoIdSelecionado) {
            setGrupoIdSelecionado(data[0].id);
          }
        } else {
          setGrupos([]);
        }
      })
      .catch(err => {
        console.error(err);
        setGrupos([]);
      });

    // 3. Carrega Scripts para permissões
    fetch(`${API}/api/scripts/?apenas_publicados=true`, { headers: authHeaders })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setScriptsPublicados(data);
        } else {
          setScriptsPublicados([]);
        }
      })
      .catch(err => {
        console.error(err);
        setScriptsPublicados([]);
      });
  };

  useEffect(() => {
    const activeRole = localStorage.getItem('role');
    const permissions = localStorage.getItem('permissions') || '';
    
    if (activeRole !== 'TI' && activeRole !== 'Administradores' && activeRole !== 'Admin' && !permissions.includes('GERENCIAR_EQUIPE')) {
      alert('Acesso Negado: Apenas Administradores podem gerenciar equipe.');
      navigate('/dashboard');
      return;
    }
    loadData();
  }, [navigate]);

  // ── Criar usuário ──────────────────────────────────────────────────────────
  const handleCreateUser = async (e) => {
    e.preventDefault();
    const gId = parseInt(grupoIdSelecionado);
    const grupoEncontrado = Array.isArray(grupos) ? grupos.find(g => g.id === gId) : null;
    const userRole = grupoEncontrado ? grupoEncontrado.nome : 'Suporte';

    const res = await fetch(`${API}/api/usuarios/`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token()}`
      },
      body: JSON.stringify({ 
        email: novoEmail, 
        senha: novaSenha, 
        role: userRole, 
        grupo_id: gId 
      }),
    });

    if (res.ok) {
      alert('Membro criado com sucesso!');
      setNovoEmail(''); setNovoSenha('');
      loadData();
    } else {
      const data = await res.json();
      alert('Erro ao cadastrar: ' + data.detail);
    }
  };

  // ── Criar Grupo ────────────────────────────────────────────────────────────
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!novoGrupoNome.trim()) return;

    const res = await fetch(`${API}/api/usuarios/grupos/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token()}`
      },
      body: JSON.stringify({
        nome: novoGrupoNome.trim(),
        descricao: novoGrupoDescricao.trim(),
        permissoes: novoGrupoPermissoes.join(',')
      })
    });

    if (res.ok) {
      alert('Grupo de Acesso criado com sucesso!');
      setNovoGrupoNome('');
      setNovoGrupoDescricao('');
      setNovoGrupoPermissoes([]);
      loadData();
    } else {
      const data = await res.json();
      alert('Erro ao criar grupo: ' + data.detail);
    }
  };

  // ── Deletar Grupo ──────────────────────────────────────────────────────────
  const handleDeleteGroup = async (id, nome) => {
    if (nome === 'TI' || nome === 'Administradores') {
      alert('O grupo raiz Administradores não pode ser excluído.');
      return;
    }
    if (!window.confirm(`Tem certeza que deseja excluir o grupo "${nome}"?`)) return;

    const res = await fetch(`${API}/api/usuarios/grupos/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}` }
    });

    if (res.ok) {
      alert('Grupo excluído!');
      loadData();
    } else {
      const data = await res.json();
      alert('Erro: ' + data.detail);
    }
  };

  // ── Resetar senha ──────────────────────────────────────────────────────────
  const handleResetPassword = async (id, email) => {
    if (!window.confirm(`Redefinir a senha de ${email} para 'mudar123'?`)) return;
    const res = await fetch(`${API}/api/usuarios/${id}/resetar_senha`, { 
      method: 'PUT',
      headers: { Authorization: `Bearer ${token()}` }
    });
    if (res.ok) {
      alert('Senha redefinida! No próximo login ele será obrigado a trocar.');
      loadData();
    }
  };

  // ── Modal de Edição de Usuário ─────────────────────────────────────────────
  const abrirModalEdicao = (user) => {
    setUsuarioSelecionado(user);
    setEdicaoGrupoId(user.grupo_id || '');
    setEdicaoAtivo(user.ativo);
    setModalEdicaoAberto(true);
  };

  const salvarEdicaoUsuario = async () => {
    if (!edicaoGrupoId) {
      alert('Por favor, selecione um grupo para o usuário.');
      return;
    }
    const gId = parseInt(edicaoGrupoId);
    const grupoEncontrado = Array.isArray(grupos) ? grupos.find(g => g.id === gId) : null;
    const userRole = grupoEncontrado ? grupoEncontrado.nome : 'Suporte';

    const res = await fetch(`${API}/api/usuarios/${usuarioSelecionado.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ 
        role: userRole, 
        grupo_id: gId, 
        ativo: edicaoAtivo 
      }),
    });

    if (res.ok) {
      alert('Membro atualizado!');
      setModalEdicaoAberto(false);
      loadData();
    } else {
      const data = await res.json();
      alert('Erro ao salvar: ' + data.detail);
    }
  };

  // ── Modal de Edição de Grupo ───────────────────────────────────────────────
  const abrirModalGrupo = (grupo) => {
    setGrupoSelecionado(grupo);
    setNomeGrupoEdicao(grupo.nome);
    setDescricaoGrupoEdicao(grupo.descricao || '');
    setPermissoesGrupoEdicao(grupo.permissoes ? grupo.permissoes.split(',') : []);
    setModalGrupoAberto(true);
  };

  const toggleEdicaoPermissaoGrupo = (key) => {
    setPermissoesGrupoEdicao(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  const toggleNovoPermissaoGrupo = (key) => {
    setNovoGrupoPermissoes(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  const salvarEdicaoGrupo = async () => {
    const res = await fetch(`${API}/api/usuarios/grupos/${grupoSelecionado.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({
        nome: nomeGrupoEdicao.trim(),
        descricao: descricaoGrupoEdicao.trim(),
        permissoes: permissoesGrupoEdicao.join(',')
      })
    });

    if (res.ok) {
      alert('Grupo atualizado com sucesso!');
      setModalGrupoAberto(false);
      loadData();
    } else {
      const data = await res.json();
      alert('Erro ao salvar grupo: ' + data.detail);
    }
  };

  // ── Modal de Permissões de Scripts ─────────────────────────────────────────
  const abrirModalPermissoes = async (user) => {
    setUsuarioSelecionado(user);
    try {
      const res = await fetch(`${API}/api/usuarios/${user.id}/permissoes`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      setPermissoesAtuais(Array.isArray(data) ? data : []);
      setModalPermissoesAberto(true);
    } catch {
      alert('Erro ao buscar permissões.');
    }
  };

  const togglePermissaoScript = (scriptId) => {
    setPermissoesAtuais(prev =>
      prev.includes(scriptId) ? prev.filter(id => id !== scriptId) : [...prev, scriptId]
    );
  };

  const salvarPermissoesScripts = async () => {
    const res = await fetch(`${API}/api/usuarios/${usuarioSelecionado.id}/permissoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ script_ids: permissoesAtuais }),
    });
    if (res.ok) { alert('Permissões salvas!'); setModalPermissoesAberto(false); }
  };

  // ── Helpers visuais ───────────────────────────────────────────────────────
  const getBadgeColors = (groupName) => {
    const nome = String(groupName).toUpperCase();
    if (nome.includes('TI') || nome.includes('ADMIN')) {
      return { bg: 'rgba(139, 92, 246, 0.2)', text: '#c084fc', border: '#a78bfa' };
    }
    if (nome.includes('DEV') || nome.includes('DESENVOLV')) {
      return { bg: 'rgba(6, 182, 212, 0.2)', text: '#22d3ee', border: '#06b6d4' };
    }
    if (nome.includes('N2')) {
      return { bg: 'rgba(16, 185, 129, 0.2)', text: '#34d399', border: '#10b981' };
    }
    if (nome.includes('N1')) {
      return { bg: 'rgba(148, 163, 184, 0.2)', text: '#94a3b8', border: '#475569' };
    }
    // Outros grupos
    return { bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8', border: '#4f46e5' };
  };

  const inputStyle = {
    width: '100%', padding: '10px 12px', marginTop: '6px', borderRadius: '8px',
    background: 'rgba(0,0,0,0.3)', color: 'white',
    border: '1px solid rgba(255,255,255,0.15)', outline: 'none', boxSizing: 'border-box',
    fontSize: '13px'
  };

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Users size={32} color="#818cf8" />
          <div>
            <h2 style={{ margin: 0 }}>Gestão de Equipe e Permissões</h2>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Crie colaboradores, controle status de acesso e defina grupos de permissões dinâmicos (RBAC).
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
       #  SEÇÃO 1: GESTÃO DE MEMBROS E USUÁRIOS
       # ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: '4rem' }}>
        <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem', marginBottom: '1.5rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', fontWeight: 600 }}>
          <Users size={20} /> Membros da Equipe
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
          
          {/* Formulário Novo Membro */}
          <div className="glass-panel" style={{ padding: '2rem', height: 'fit-content' }}>
            <h4 style={{ marginTop: 0, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', color: '#cbd5e1' }}>
              <UserPlus size={18} color="#818cf8" /> Novo Membro
            </h4>
            <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '13px', fontWeight: 500 }}>E-mail corporativo</label>
                <input type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} required style={inputStyle} placeholder="Ex: usuario@empresa.com" />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '13px', fontWeight: 500 }}>Senha Provisória</label>
                <input type="text" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} required style={inputStyle} placeholder="Ex: Senha@123" />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '13px', fontWeight: 500 }}>Grupo de Permissão</label>
                <select value={grupoIdSelecionado} onChange={e => setGrupoIdSelecionado(e.target.value)} style={inputStyle}>
                  {Array.isArray(grupos) && grupos.map(g => (
                    <option key={g.id} value={g.id} style={{ background: '#1e293b', color: 'white' }}>{g.nome}</option>
                  ))}
                  {(!Array.isArray(grupos) || grupos.length === 0) && (
                    <option value="" disabled style={{ background: '#1e293b', color: 'white' }}>Nenhum grupo carregado</option>
                  )}
                </select>
              </div>
              <button className="btn" type="submit" style={{ width: '100%', justifyContent: 'center' }}>
                Cadastrar Usuário
              </button>
            </form>
          </div>

          {/* Lista de Usuários */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h4 style={{ marginTop: 0, marginBottom: '1.25rem', fontSize: '1rem', color: '#cbd5e1' }}>Membros Cadastrados</h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#64748b', fontSize: '13px' }}>
                    <th style={{ padding: '12px 10px' }}>Membro</th>
                    <th style={{ padding: '12px 10px' }}>Grupo / Perfil</th>
                    <th style={{ padding: '12px 10px' }}>Status</th>
                    <th style={{ padding: '12px 10px', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(usuarios) && usuarios.map(u => {
                    const grupoUser = Array.isArray(grupos) ? grupos.find(g => g.id === u.grupo_id) : null;
                    const grupoNome = grupoUser ? grupoUser.nome : (u.role === 'Admin' ? 'Administradores' : 'Suporte');
                    const badge = getBadgeColors(grupoNome);

                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: u.ativo ? 1 : 0.5 }}>
                        <td style={{ padding: '14px 10px', verticalAlign: 'middle' }}>
                          <span style={{ fontWeight: 500, color: u.ativo ? 'white' : '#94a3b8', display: 'block' }}>{u.email}</span>
                        </td>
                        <td style={{ padding: '14px 10px', verticalAlign: 'middle' }}>
                          <span style={{
                            background: badge.bg,
                            color: badge.text,
                            border: `1px solid ${badge.border}`,
                            padding: '3px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700
                          }}>
                            {grupoNome}
                          </span>
                        </td>
                        <td style={{ padding: '14px 10px', verticalAlign: 'middle' }}>
                          {u.ativo
                            ? <span style={{ color: '#34d399', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}><CheckCircle size={13} /> Ativo</span>
                            : <span style={{ color: '#ef4444', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}><XCircle size={13} /> Inativo</span>
                          }
                          {u.exige_troca_senha && u.ativo && (
                            <span style={{ color: '#fbbf24', fontSize: '10px', display: 'block', marginTop: '3px' }}>
                              ⚠️ Exige troca de senha
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 10px', verticalAlign: 'middle', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button onClick={() => abrirModalEdicao(u)} className="btn"
                              style={{ padding: '6px 10px', fontSize: '0.78rem', background: '#2563eb' }} title="Editar Perfil">
                              <Pencil size={13} /> Editar
                            </button>
                            <button onClick={() => abrirModalPermissoes(u)} className="btn"
                              style={{ padding: '6px 10px', fontSize: '0.78rem', background: '#7c3aed' }} title="Permissões de Scripts">
                              <ShieldCheck size={13} /> Scripts
                            </button>
                            <button onClick={() => handleResetPassword(u.id, u.email)} className="btn"
                              style={{ padding: '6px 10px', fontSize: '0.78rem', background: '#475569' }} title="Resetar Senha">
                              <KeyRound size={13} /> Senha
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
       #  SEÇÃO 2: GRUPOS DE ACESSO E PERMISSÕES (RBAC)
       # ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: '3rem' }}>
        <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem', marginBottom: '1.5rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', fontWeight: 600 }}>
          <ShieldCheck size={20} color="#10b981" /> Grupos de Acesso (RBAC)
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '2rem' }}>
          
          {/* Formulário Novo Grupo */}
          <div className="glass-panel" style={{ padding: '2rem', height: 'fit-content' }}>
            <h4 style={{ marginTop: 0, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', color: '#cbd5e1' }}>
              <FolderPlus size={18} color="#10b981" /> Novo Grupo
            </h4>
            <form onSubmit={handleCreateGroup}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '13px', fontWeight: 500 }}>Nome do Setor / Grupo</label>
                <input type="text" value={novoGrupoNome} onChange={e => setNovoGrupoNome(e.target.value)} required style={inputStyle} placeholder="Ex: Financeiro" />
              </div>
              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ fontSize: '13px', fontWeight: 500 }}>Descrição / Função</label>
                <input type="text" value={novoGrupoDescricao} onChange={e => setNovoGrupoDescricao(e.target.value)} style={inputStyle} placeholder="Ex: Acesso a relatórios e regras" />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Chaves de Acesso (Permissões)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
                  {SISTEM_PERMISSIONS.map(p => (
                    <div key={p.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '4px 0' }}>
                      <input 
                        type="checkbox" 
                        id={`new_g_${p.key}`} 
                        checked={novoGrupoPermissoes.includes(p.key)}
                        onChange={() => toggleNovoPermissaoGrupo(p.key)}
                        style={{ width: '16px', height: '16px', marginTop: '2px', cursor: 'pointer' }} 
                      />
                      <label htmlFor={`new_g_${p.key}`} style={{ cursor: 'pointer', fontSize: '12px' }}>
                        <strong style={{ display: 'block', color: 'white' }}>{p.label}</strong>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>{p.desc}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <button className="btn" type="submit" style={{ width: '100%', justifyContent: 'center', background: '#10b981' }}>
                Criar Grupo de Acesso
              </button>
            </form>
          </div>

          {/* Tabela de Grupos */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h4 style={{ marginTop: 0, marginBottom: '1.25rem', fontSize: '1rem', color: '#cbd5e1' }}>Grupos de Acesso Ativos</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {Array.isArray(grupos) && grupos.map(g => (
                <div key={g.id} style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  padding: '1.2rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '15px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h5 style={{ margin: 0, fontSize: '15px', color: '#cbd5e1' }}>{g.nome}</h5>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>({g.permissoes ? g.permissoes.split(',').length : 0} permissões)</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>{g.descricao || 'Sem descrição cadastrada.'}</p>
                    
                    {/* Lista visual de badges de permissões ativas */}
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {g.permissoes ? g.permissoes.split(',').map(p => (
                        <span key={p} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px 6px', fontSize: '9px', color: '#94a3b8', fontFamily: 'monospace' }}>
                          {p}
                        </span>
                      )) : <span style={{ fontSize: '10px', color: '#ef4444' }}>Nenhuma permissão associada</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
                    <button className="btn" onClick={() => abrirModalGrupo(g)} style={{ padding: '6px 12px', fontSize: '0.8rem', background: '#3b82f6', justifyContent: 'center' }}>
                      Editar Permissões
                    </button>
                    {g.nome !== 'TI' && g.nome !== 'Administradores' && (
                      <button className="btn" onClick={() => handleDeleteGroup(g.id, g.nome)} style={{ padding: '6px 12px', fontSize: '0.8rem', background: '#ef4444', justifyContent: 'center' }}>
                        Excluir Grupo
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══ Modal de Edição de Perfil/Status de Usuário ══════════════════════ */}
      {modalEdicaoAberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel modal-panel" style={{ padding: '2rem', width: '420px', position: 'relative' }}>
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
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Grupo de Acesso</label>
              <select value={edicaoGrupoId} onChange={e => setEdicaoGrupoId(e.target.value)} style={inputStyle}>
                <option value="" disabled style={{ background: '#1e293b', color: '#94a3b8' }}>-- Selecione um Grupo --</option>
                {Array.isArray(grupos) && grupos.map(g => (
                  <option key={g.id} value={g.id} style={{ background: '#1e293b', color: 'white' }}>{g.nome}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem', fontWeight: 500 }}>Status do Usuário</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
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
                  type="button"
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

            <button className="btn" onClick={salvarEdicaoUsuario} style={{ width: '100%', justifyContent: 'center', background: '#3b82f6' }}>
              Salvar Alterações
            </button>
          </div>
        </div>
      )}

      {/* ══ Modal de Edição de Grupo Dinâmico ══════════════════════════════════ */}
      {modalGrupoAberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel modal-panel" style={{ padding: '2rem', width: '480px', position: 'relative' }}>
            <button onClick={() => setModalGrupoAberto(false)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={20} color="#3b82f6" /> Configurar Grupo: {grupoSelecionado?.nome}
            </h3>
            
            <div style={{ marginBottom: '1rem', marginTop: '1rem' }}>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>Nome do Grupo</label>
              <input 
                type="text" 
                value={nomeGrupoEdicao} 
                onChange={e => setNomeGrupoEdicao(e.target.value)} 
                disabled={grupoSelecionado?.nome === 'TI' || grupoSelecionado?.nome === 'Administradores'}
                required 
                style={inputStyle} 
              />
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>Descrição / Setor</label>
              <input 
                type="text" 
                value={descricaoGrupoEdicao} 
                onChange={e => setDescricaoGrupoEdicao(e.target.value)} 
                style={inputStyle} 
              />
            </div>

            <div style={{ marginBottom: '1.8rem' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Configurar Permissões</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
                {SISTEM_PERMISSIONS.map(p => (
                  <div key={p.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '4px 0' }}>
                    <input 
                      type="checkbox" 
                      id={`edit_g_${p.key}`} 
                      checked={permissoesGrupoEdicao.includes(p.key)}
                      onChange={() => toggleEdicaoPermissaoGrupo(p.key)}
                      disabled={grupoSelecionado?.nome === 'TI' || grupoSelecionado?.nome === 'Administradores'} // Administradores raiz sempre tem tudo
                      style={{ width: '16px', height: '16px', marginTop: '2px', cursor: 'pointer' }} 
                    />
                    <label htmlFor={`edit_g_${p.key}`} style={{ cursor: 'pointer', fontSize: '12px' }}>
                      <strong style={{ display: 'block', color: 'white' }}>{p.label}</strong>
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>{p.desc}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <button className="btn" onClick={salvarEdicaoGrupo} style={{ width: '100%', justifyContent: 'center', background: '#3b82f6' }}>
              Salvar Configuração do Grupo
            </button>
          </div>
        </div>
      )}

      {/* ══ Modal de Permissões de Scripts ══════════════════════════════════════ */}
      {modalPermissoesAberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel modal-panel" style={{ padding: '2rem', width: '450px', position: 'relative' }}>
            <button onClick={() => setModalPermissoesAberto(false)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ marginTop: 0 }}>Permissões de {usuarioSelecionado?.email}</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Selecione os scripts homologados específicos do cofre que este usuário tem autorização para rodar nas lojas.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '2rem', maxHeight: '300px', overflowY: 'auto' }}>
              {Array.isArray(scriptsPublicados) && scriptsPublicados.map(script => (
                <div key={script.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                  <input type="checkbox" checked={permissoesAtuais.includes(script.id)}
                    onChange={() => togglePermissaoScript(script.id)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                  <label style={{ fontSize: '13px' }}>
                    <strong style={{ display: 'block', color: 'white' }}>{script.nome}</strong>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{script.descricao || 'Sem descrição'}</span>
                  </label>
                </div>
              ))}
              {(!Array.isArray(scriptsPublicados) || scriptsPublicados.length === 0) && <p style={{ color: '#94a3b8' }}>Nenhum script publicado encontrado.</p>}
            </div>
            <button className="btn" onClick={salvarPermissoesScripts} style={{ width: '100%', justifyContent: 'center', background: '#10b981' }}>
              Salvar Permissões de Script
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
