import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Save, Trash2, PlusCircle, Server, Monitor, Pencil,
  X, FolderPlus, Layers, Database, TextCursor
} from 'lucide-react';
import { API } from '../config';

const inputStyle = {
  width: '100%', padding: '9px 12px', marginTop: '6px', borderRadius: '8px',
  background: 'rgba(0,0,0,0.25)', color: 'white',
  border: '1px solid rgba(255,255,255,0.12)', outline: 'none', boxSizing: 'border-box',
};
const monoStyle = {
  ...inputStyle, fontFamily: 'monospace', background: '#0f172a',
  border: '1px solid #334155', color: '#e2e8f0', resize: 'vertical',
};

const ALVO_OPTIONS = [
  { value: 'PDV', label: 'Apenas PDV' },
  { value: 'SERVIDOR', label: 'Apenas Servidor' },
  { value: 'AMBOS', label: 'Ambos' },
];

const regraVazia = () => ({
  nome: '', sql_query: '', valor_esperado: '',
  valor_esperado_is_query: false, tipo_alvo: 'PDV', grupo_id: null,
});

export default function AuditRules() {
  const [aba, setAba] = useState('regras'); // 'regras' | 'grupos'
  const [regras, setRegras] = useState([]);
  const [grupos, setGrupos] = useState([]);

  // Formulário nova regra / edição
  const [form, setForm] = useState(regraVazia());
  const [editandoRegra, setEditandoRegra] = useState(null); // null = criando

  // Modal edição de grupo
  const [modalGrupoAberto, setModalGrupoAberto] = useState(false);
  const [editandoGrupo, setEditandoGrupo] = useState(null);
  const [grupoForm, setGrupoForm] = useState({ nome: '', descricao: '' });

  const navigate = useNavigate();
  const token = () => localStorage.getItem('token');
  const authHeader = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

  // ── Carregamento ────────────────────────────────────────────────────────
  const carregarTudo = () => {
    fetch(`${API}/api/auditoria/grupos/`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setGrupos(d); });

    fetch(`${API}/api/auditoria/`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setRegras(d); });
  };

  useEffect(() => {
    const activeRole = localStorage.getItem('role');
    const permissions = localStorage.getItem('permissions') || '';

    if (activeRole !== 'TI' && activeRole !== 'Administradores' && activeRole !== 'Admin' && !permissions.includes('GERENCIAR_AUDITORIA')) {
      alert('Acesso Negado: Você não tem permissão para gerenciar a auditoria.');
      navigate('/dashboard');
      return;
    }
    carregarTudo();
  }, [navigate]);

  // ── Regras ───────────────────────────────────────────────────────────────
  const setF = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmitRegra = async (e) => {
    e.preventDefault();
    const url = editandoRegra
      ? `${API}/api/auditoria/${editandoRegra.id}`
      : `${API}/api/auditoria/`;
    const method = editandoRegra ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method, headers: authHeader(),
      body: JSON.stringify({ ...form, grupo_id: form.grupo_id || null }),
    });
    if (res.ok) {
      setForm(regraVazia()); setEditandoRegra(null); carregarTudo();
    } else {
      const d = await res.json(); alert('Erro: ' + d.detail);
    }
  };

  const iniciarEdicaoRegra = (r) => {
    setEditandoRegra(r);
    setForm({
      nome: r.nome, sql_query: r.sql_query,
      valor_esperado: r.valor_esperado,
      valor_esperado_is_query: r.valor_esperado_is_query,
      tipo_alvo: r.tipo_alvo,
      grupo_id: r.grupo_id,
    });
    setAba('regras');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicaoRegra = () => { setForm(regraVazia()); setEditandoRegra(null); };

  const deletarRegra = async (id) => {
    if (!window.confirm('Deletar esta regra?')) return;
    await fetch(`${API}/api/auditoria/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token()}` },
    });
    carregarTudo();
  };

  // ── Grupos ───────────────────────────────────────────────────────────────
  const abrirModalGrupo = (g = null) => {
    setEditandoGrupo(g);
    setGrupoForm(g ? { nome: g.nome, descricao: g.descricao || '' } : { nome: '', descricao: '' });
    setModalGrupoAberto(true);
  };

  const salvarGrupo = async () => {
    const url = editandoGrupo ? `${API}/api/auditoria/grupos/${editandoGrupo.id}` : `${API}/api/auditoria/grupos/`;
    const method = editandoGrupo ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: authHeader(), body: JSON.stringify(grupoForm) });
    if (res.ok) { setModalGrupoAberto(false); carregarTudo(); }
    else { const d = await res.json(); alert('Erro: ' + d.detail); }
  };

  const deletarGrupo = async (g) => {
    if (!window.confirm(`Deletar o grupo "${g.nome}" e TODAS as suas regras?`)) return;
    await fetch(`${API}/api/auditoria/grupos/${g.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token()}` },
    });
    carregarTudo();
  };

  // ── Agrupamento das regras na listagem ──────────────────────────────────
  const regrasPorGrupo = () => {
    const agrupado = {};
    regras.forEach(r => {
      const chave = r.grupo_nome || '(Sem Grupo)';
      if (!agrupado[chave]) agrupado[chave] = [];
      agrupado[chave].push(r);
    });
    return agrupado;
  };

  // ── Badges ───────────────────────────────────────────────────────────────
  const tagAlvo = (tipo) => {
    const map = { PDV: '#3b82f6', SERVIDOR: '#f59e0b', AMBOS: '#8b5cf6' };
    return (
      <span style={{
        background: `${map[tipo]}22`, color: map[tipo],
        padding: '2px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', gap: '4px',
      }}>
        {tipo === 'SERVIDOR' ? <Server size={11} /> : <Monitor size={11} />} {tipo}
      </span>
    );
  };

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <ShieldCheck size={32} color="#f43f5e" />
        <h2 style={{ margin: 0 }}>Padrões de Auditoria</h2>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '2rem' }}>
        {[{ id: 'regras', label: '⚡ Regras' }, { id: 'grupos', label: '📁 Grupos' }].map(t => (
          <button key={t.id} onClick={() => setAba(t.id)} style={{
            padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600,
            background: aba === t.id ? '#f43f5e' : 'rgba(255,255,255,0.07)',
            color: aba === t.id ? 'white' : '#94a3b8',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ══ ABA: REGRAS ═════════════════════════════════════════════════════ */}
      {aba === 'regras' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '2rem' }}>

          {/* Formulário */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {editandoRegra ? <><Pencil size={18} color="#f59e0b" /> Editar Regra</> : <><PlusCircle size={18} /> Nova Regra</>}
            </h3>
            {editandoRegra && (
              <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '1rem', fontSize: '0.85rem', color: '#f59e0b' }}>
                ✏️ Editando: <strong>{editandoRegra.nome}</strong>
                <button onClick={cancelarEdicaoRegra} style={{ float: 'right', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>Cancelar</button>
              </div>
            )}
            <form onSubmit={handleSubmitRegra}>
              <div style={{ marginBottom: '1rem' }}>
                <label>Nome da Regra</label>
                <input value={form.nome} onChange={e => setF('nome', e.target.value)} required
                  placeholder="Ex: Verifica ePharma ativo" style={inputStyle} />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label>Grupo</label>
                <select value={form.grupo_id || ''} onChange={e => setF('grupo_id', e.target.value ? Number(e.target.value) : null)} style={inputStyle}>
                  <option value="">— Sem grupo —</option>
                  {grupos.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label>Onde testar?</label>
                <select value={form.tipo_alvo} onChange={e => setF('tipo_alvo', e.target.value)} style={inputStyle}>
                  {ALVO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label>Query SQL de Validação (retorna 1 coluna)</label>
                <textarea value={form.sql_query} onChange={e => setF('sql_query', e.target.value)} required rows={3}
                  placeholder="SELECT VALOR FROM PARAMETROS WHERE NOME = 'VAREJO'" style={monoStyle} />
              </div>

              {/* ── Flag de Query ── */}
              <div style={{ marginBottom: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px 14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={form.valor_esperado_is_query}
                    onChange={e => setF('valor_esperado_is_query', e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#f43f5e' }} />
                  <span style={{ fontSize: '0.9rem' }}>
                    <strong style={{ color: '#f43f5e' }}>Valor esperado é uma Query SQL</strong>
                    <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.78rem' }}>
                      Executa a query abaixo na retaguarda para obter o valor de comparação
                    </span>
                  </span>
                </label>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                {form.valor_esperado_is_query ? (
                  <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Database size={14} color="#f43f5e" /> Query da Retaguarda (Valor Esperado)
                    </label>
                    <textarea value={form.valor_esperado} onChange={e => setF('valor_esperado', e.target.value)}
                      required rows={3}
                      placeholder="SELECT TOP 1 VALOR FROM TABELA_REF WHERE CHAVE = 'X' AND LOJA = {loja}"
                      style={{ ...monoStyle, marginTop: '6px', border: '1px solid rgba(244,63,94,0.4)' }} />
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
                      Dica: Use <strong>{'{loja}'}</strong> na query para injetar automaticamente o número da loja atual.
                    </span>
                  </>
                ) : (
                  <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <TextCursor size={14} color="#34d399" /> Valor Esperado (texto estático)
                    </label>
                    <input value={form.valor_esperado} onChange={e => setF('valor_esperado', e.target.value)}
                      required placeholder="Ex: S, 1, ATIVO"
                      style={{ ...inputStyle, border: '1px solid rgba(52,211,153,0.3)' }} />
                  </>
                )}
              </div>

              <button type="submit" className="btn"
                style={{ width: '100%', justifyContent: 'center', background: editandoRegra ? '#f59e0b' : '#f43f5e' }}>
                <Save size={16} /> {editandoRegra ? 'Salvar Edição' : 'Adicionar ao Scanner'}
              </button>
            </form>
          </div>

          {/* Listagem agrupada */}
          <div className="glass-panel" style={{ padding: '2rem', overflowY: 'auto', maxHeight: '80vh' }}>
            <h3 style={{ marginTop: 0 }}>Regras Ativas ({regras.length})</h3>
            {Object.entries(regrasPorGrupo()).map(([grupo, lista]) => (
              <div key={grupo} style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Layers size={15} color="#818cf8" />
                  <span style={{ fontWeight: 700, color: '#818cf8', fontSize: '0.9rem' }}>{grupo}</span>
                  <span style={{ color: '#475569', fontSize: '0.78rem' }}>({lista.length} regra{lista.length !== 1 ? 's' : ''})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {lista.map(r => (
                    <div key={r.id} style={{
                      background: 'rgba(0,0,0,0.22)', padding: '13px 15px',
                      borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600 }}>{r.nome}</span>
                          {tagAlvo(r.tipo_alvo)}
                          {r.valor_esperado_is_query && (
                            <span style={{ background: 'rgba(244,63,94,0.15)', color: '#f43f5e', padding: '1px 7px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600 }}>
                              🔍 Query
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => iniciarEdicaoRegra(r)} title="Editar"
                            style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', cursor: 'pointer', borderRadius: '6px', padding: '4px 8px' }}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => deletarRegra(r.id)} title="Deletar"
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', cursor: 'pointer', borderRadius: '6px', padding: '4px 8px' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#94a3b8', background: 'rgba(0,0,0,0.3)', padding: '5px 8px', borderRadius: '5px', marginBottom: '5px' }}>
                        {r.sql_query}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: r.valor_esperado_is_query ? '#f43f5e' : '#34d399' }}>
                        {r.valor_esperado_is_query ? '🔍 Retaguarda:' : '✅ Espera:'}{' '}
                        <span style={{ fontFamily: 'monospace' }}>"{r.valor_esperado}"</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {regras.length === 0 && <p style={{ color: '#94a3b8' }}>Nenhuma regra cadastrada.</p>}
          </div>
        </div>
      )}

      {/* ══ ABA: GRUPOS ═════════════════════════════════════════════════════ */}
      {aba === 'grupos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <p style={{ color: '#94a3b8', margin: 0 }}>
              Grupos organizam as regras por sistema/módulo (ex: Epharma, Funcional Card).
            </p>
            <button className="btn" onClick={() => abrirModalGrupo()}
              style={{ background: '#f43f5e', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FolderPlus size={16} /> Novo Grupo
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {grupos.map(g => {
              const qtd = regras.filter(r => r.grupo_id === g.id).length;
              return (
                <div key={g.id} className="glass-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <Layers size={18} color="#818cf8" />
                        <strong style={{ fontSize: '1rem' }}>{g.nome}</strong>
                      </div>
                      {g.descricao && <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 8px' }}>{g.descricao}</p>}
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{qtd} regra{qtd !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => abrirModalGrupo(g)} title="Editar grupo"
                        style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', cursor: 'pointer', borderRadius: '6px', padding: '5px 9px' }}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => deletarGrupo(g)} title="Deletar grupo"
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', cursor: 'pointer', borderRadius: '6px', padding: '5px 9px' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {grupos.length === 0 && <p style={{ color: '#94a3b8' }}>Nenhum grupo cadastrado ainda.</p>}
          </div>
        </div>
      )}

      {/* ══ Modal Grupo ═════════════════════════════════════════════════════ */}
      {modalGrupoAberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel modal-panel" style={{ padding: '2rem', width: '420px', position: 'relative' }}>
            <button onClick={() => setModalGrupoAberto(false)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {editandoGrupo ? <><Pencil size={17} color="#f59e0b" /> Editar Grupo</> : <><FolderPlus size={17} color="#f43f5e" /> Novo Grupo</>}
            </h3>
            <div style={{ marginBottom: '1rem' }}>
              <label>Nome do Grupo</label>
              <input value={grupoForm.nome} onChange={e => setGrupoForm(p => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Epharma, Funcional Card" style={inputStyle} />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label>Descrição (opcional)</label>
              <input value={grupoForm.descricao} onChange={e => setGrupoForm(p => ({ ...p, descricao: e.target.value }))}
                placeholder="Descreva o propósito deste grupo" style={inputStyle} />
            </div>
            <button className="btn" onClick={salvarGrupo}
              style={{ width: '100%', justifyContent: 'center', background: editandoGrupo ? '#f59e0b' : '#f43f5e' }}>
              <Save size={16} /> {editandoGrupo ? 'Salvar Edição' : 'Criar Grupo'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
