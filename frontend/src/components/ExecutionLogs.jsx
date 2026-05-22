import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Search, X, RefreshCw, User, Building2, Calendar, Target, Hash } from 'lucide-react';

const API = 'http://127.0.0.1:8080/api';

const ALVO_LABEL = {
  AMBOS:           'Servidor + Todos Caixas',
  SERVIDOR:        'Servidor',
  TODOS_PDVS:      'Todos os Caixas',
  PDV_ESPECIFICO:  'Caixa Específico',
  SERVIDOR_PDV:    'Servidor (banco PDV)',
};

const STATUS_STYLE = {
  pendente:  { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', label: '⏳ Pendente' },
  concluido: { bg: 'rgba(52,211,153,0.15)',  color: '#34d399', label: '✅ Concluído' },
  erro:      { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444', label: '❌ Erro' },
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function ExecutionLogs() {
  const navigate  = useNavigate();
  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [busca, setBusca]       = useState('');
  const [filtroScript, setFiltroScript] = useState('');
  const [filtroLoja, setFiltroLoja]     = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  const token = localStorage.getItem('token');
  const role  = localStorage.getItem('role');

  useEffect(() => {
    if (role !== 'Admin') {
      alert('Acesso negado. Apenas administradores podem ver os logs.');
      navigate('/dashboard');
      return;
    }
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/execucoes/logs/?limit=500`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Acesso negado');
      setLogs(await res.json());
    } catch (e) {
      console.error(e);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // Scripts únicos para filtro
  const scriptsUnicos = [...new Set(logs.map(l => l.script_nome).filter(Boolean))].sort();
  const lojasUnicas   = [...new Set(logs.map(l => l.loja_id).filter(Boolean))].sort((a,b) => Number(a) - Number(b));

  const logsFiltrados = logs.filter(l => {
    const texto = busca.toLowerCase();
    const matchBusca = !busca || [
      l.usuario_email, l.script_nome, l.loja_id, l.alvo, l.job_id
    ].some(v => v?.toLowerCase().includes(texto));
    const matchScript = !filtroScript || l.script_nome === filtroScript;
    const matchLoja   = !filtroLoja   || l.loja_id === filtroLoja;
    const matchStatus = !filtroStatus || l.status_final === filtroStatus;
    return matchBusca && matchScript && matchLoja && matchStatus;
  });

  const limparFiltros = () => { setBusca(''); setFiltroScript(''); setFiltroLoja(''); setFiltroStatus(''); };
  const temFiltro = busca || filtroScript || filtroLoja || filtroStatus;

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(239,68,68,0.15)', borderRadius: '10px', padding: '10px', display: 'flex' }}>
            <ClipboardList size={28} color="#f87171" />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Log de Execuções</h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              🔒 Área restrita — apenas Administradores · {logs.length} registros
            </p>
          </div>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)',
            borderRadius: '8px', color: '#818cf8', padding: '8px 16px',
            cursor: loading ? 'default' : 'pointer', fontSize: '13px', fontWeight: 600
          }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1.2s linear infinite' : 'none' }} />
          {loading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>

      {/* ── Filtros ── */}
      <div className="glass-panel" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
          {/* Busca livre */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Busca livre</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Usuário, script, loja, job ID..."
                style={{
                  width: '100%', padding: '8px 10px 8px 32px', borderRadius: '6px',
                  background: 'rgba(0,0,0,0.3)', color: 'white',
                  border: '1px solid rgba(255,255,255,0.1)', fontSize: '13px', boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
          {/* Filtro script */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Script</label>
            <select value={filtroScript} onChange={e => setFiltroScript(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', fontSize: '13px' }}>
              <option value="">Todos</option>
              {scriptsUnicos.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {/* Filtro loja */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Loja</label>
            <select value={filtroLoja} onChange={e => setFiltroLoja(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', fontSize: '13px' }}>
              <option value="">Todas</option>
              {lojasUnicas.map(id => <option key={id} value={id}>Loja {id}</option>)}
            </select>
          </div>
          {/* Filtro status */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', fontSize: '13px' }}>
              <option value="">Todos</option>
              <option value="pendente">⏳ Pendente</option>
              <option value="concluido">✅ Concluído</option>
              <option value="erro">❌ Erro</option>
            </select>
          </div>
          {/* Botão limpar */}
          <button
            onClick={limparFiltros}
            disabled={!temFiltro}
            title="Limpar filtros"
            style={{
              padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)',
              background: temFiltro ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)',
              color: temFiltro ? '#f87171' : '#475569', cursor: temFiltro ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            <X size={14} /> Limpar
          </button>
        </div>
        {temFiltro && (
          <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#818cf8' }}>
            Mostrando {logsFiltrados.length} de {logs.length} registros
          </p>
        )}
      </div>

      {/* ── Tabela ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <RefreshCw size={32} style={{ animation: 'spin 1.2s linear infinite', marginBottom: '1rem' }} />
          <p>Carregando logs...</p>
        </div>
      ) : logsFiltrados.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <ClipboardList size={40} style={{ marginBottom: '1rem', opacity: 0.4 }} />
          <p>{logs.length === 0 ? 'Nenhuma execução registrada ainda.' : 'Nenhum resultado para os filtros aplicados.'}</p>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {[
                    [Hash, '#'],
                    [Calendar, 'Data / Hora'],
                    [User, 'Usuário'],
                    [Building2, 'Loja'],
                    [ClipboardList, 'Script'],
                    [Target, 'Alvo'],
                    [null, 'Parâmetros'],
                    [null, 'Status'],
                  ].map(([Icon, label], i) => (
                    <th key={i} style={{
                      padding: '12px 16px', textAlign: 'left', fontWeight: 600,
                      color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase',
                      letterSpacing: '0.06em', whiteSpace: 'nowrap'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {Icon && <Icon size={12} />} {label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logsFiltrados.map((log, idx) => {
                  const st = STATUS_STYLE[log.status_final] || STATUS_STYLE.pendente;
                  const isEven = idx % 2 === 0;
                  const params = log.parametros && Object.keys(log.parametros).length > 0
                    ? Object.entries(log.parametros)
                        .filter(([k]) => k !== 'loja' && k !== 'loja_id')
                        .map(([k,v]) => `${k}: ${v}`)
                        .join(', ')
                    : '—';
                  return (
                    <tr key={log.id} style={{
                      background: isEven ? 'rgba(255,255,255,0.01)' : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = isEven ? 'rgba(255,255,255,0.01)' : 'transparent'}
                    >
                      <td style={{ padding: '11px 16px', color: '#475569', fontFamily: 'monospace', fontSize: '12px' }}>#{log.id}</td>
                      <td style={{ padding: '11px 16px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{formatDate(log.executado_em)}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{log.usuario_email || '—'}</div>
                        <div style={{ fontSize: '11px', color: log.usuario_role === 'Admin' ? '#818cf8' : '#64748b' }}>{log.usuario_role}</div>
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{
                          background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                          borderRadius: '6px', padding: '3px 8px', fontWeight: 700, fontSize: '12px'
                        }}>
                          Loja {log.loja_id}
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px', fontWeight: 500, color: '#cbd5e1', maxWidth: '200px' }}>
                        <span title={log.script_nome} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.script_nome || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px', color: '#94a3b8', whiteSpace: 'nowrap', fontSize: '12px' }}>
                        {ALVO_LABEL[log.alvo] || log.alvo || '—'}
                      </td>
                      <td style={{ padding: '11px 16px', color: '#64748b', fontFamily: 'monospace', fontSize: '11px' }}>
                        {params}
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{
                          background: st.bg, color: st.color,
                          borderRadius: '6px', padding: '4px 10px',
                          fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap'
                        }}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
