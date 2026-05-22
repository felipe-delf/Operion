import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Play, AlertTriangle, X, Search, CheckCircle, XCircle, WifiOff, RefreshCw, HelpCircle, ArrowLeft } from 'lucide-react';

const API = 'http://127.0.0.1:8080/api';

export default function MassExecution() {
  const navigate = useNavigate();
  const role = localStorage.getItem('role');

  const [scripts, setScripts] = useState([]);
  const [scriptSelecionado, setScriptSelecionado] = useState(null);
  const [alvo, setAlvo] = useState('AMBOS');
  const [parametros, setParametros] = useState({});

  // Filtros de Lojas Destino para o Broadcast
  const [tipoSelecao, setTipoSelecao] = useState('TODAS'); // 'TODAS', 'INTERVALO', 'LISTA'
  const [lojaDe, setLojaDe] = useState('');
  const [lojaAte, setLojaAte] = useState('');
  const [lojasIds, setLojasIds] = useState('');

  const [executando, setExecutando] = useState(false);
  const [monitoramentoAberto, setMonitoramentoAberto] = useState(false);
  const [jobStatus, setJobStatus] = useState(null);
  const [buscaLoja, setBuscaLoja] = useState('');

  const pollRef = useRef(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  // Redireciona se não for Admin
  useEffect(() => {
    if (role !== 'Admin') {
      navigate('/dashboard');
    }
  }, [role, navigate]);

  // Carrega scripts publicados
  useEffect(() => {
    fetch(`${API}/scripts/?apenas_publicados=true`, { headers })
      .then(r => r.json())
      .then(data => {
        setScripts(data);
      })
      .catch(console.error);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Quando o script muda, reseta os parâmetros
  const handleScriptChange = (e) => {
    const sId = parseInt(e.target.value);
    const selected = scripts.find(s => s.id === sId) || null;
    setScriptSelecionado(selected);
    setParametros({});

    if (selected) {
      if (selected.alvo_fixo) {
        setAlvo(selected.alvo_fixo);
      } else {
        setAlvo('AMBOS');
      }
    }
  };

  const handleParamChange = (nome, valor) => {
    setParametros(prev => ({
      ...prev,
      [nome]: valor
    }));
  };

  const handleExecute = async (e) => {
    e.preventDefault();
    if (!scriptSelecionado) return;

    let msgFiltro = "em TODAS as lojas ativas";
    if (tipoSelecao === 'INTERVALO') {
      msgFiltro = `nas lojas do intervalo do número ${lojaDe} até ${lojaAte}`;
    } else if (tipoSelecao === 'LISTA') {
      msgFiltro = `nas lojas específicas: ${lojasIds}`;
    }

    if (!window.confirm(`⚠️ CONFIRMAÇÃO CRÍTICA:\n\nVocê tem certeza que deseja executar o script "${scriptSelecionado.nome}" ${msgFiltro}?\nEsta ação não pode ser desfeita.`)) {
      return;
    }

    setExecutando(true);
    const payload = {
      script_id: scriptSelecionado.id,
      alvo,
      parametros,
      tipo_selecao: tipoSelecao,
      loja_de: lojaDe,
      loja_ate: lojaAte,
      lojas_ids: lojasIds
    };

    try {
      const res = await fetch(`${API}/broadcast/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setJobStatus(null);
        setMonitoramentoAberto(true);
        iniciarPolling(data.job_id);
      } else {
        const err = await res.json();
        alert(err.detail || 'Erro ao disparar broadcast.');
      }
    } catch (e) {
      alert('Erro de conexão com o servidor.');
    } finally {
      setExecutando(false);
    }
  };

  const iniciarPolling = (idJob) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/execucoes/${idJob}/status`, { headers });
        if (res.ok) {
          const data = await res.json();
          setJobStatus(data);
          if (data.status === 'concluido' || data.status === 'erro') {
            clearInterval(pollRef.current);
          }
        }
      } catch (err) {
        console.error("Erro no polling do broadcast:", err);
      }
    }, 1500);
  };

  // Cálculos de progresso do broadcast
  const totalLojas = jobStatus?.total_lojas || 0;
  const etapas = jobStatus?.etapas || [];
  const concluidas = etapas.filter(e => e.status === 'sucesso').length;
  const falhas = etapas.filter(e => e.status === 'erro').length;
  const emAndamento = etapas.filter(e => e.status === 'rodando').length;
  const processadas = concluidas + falhas;
  const progressoPct = totalLojas > 0 ? Math.round((processadas / totalLojas) * 100) : 0;

  // Filtragem da lista do Radar
  const etapasFiltradas = etapas.filter(e => 
    e.nome.toLowerCase().includes(buscaLoja.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '3rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button className="btn" onClick={() => navigate('/dashboard')} style={{ background: 'transparent', padding: '8px' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Radio size={24} color="#ef4444" /> Execução em Massa (Broadcast)
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Dispare scripts SQL consolidados em todos os Servidores e Caixas da rede de lojas.
          </p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <form onSubmit={handleExecute}>
          
          {/* Seleção do Script */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>Selecionar Script para Disparo</label>
            <select 
              required
              onChange={handleScriptChange}
              defaultValue=""
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(0,0,0,0.3)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            >
              <option value="" disabled>Escolha um script publicado...</option>
              {scripts.map(s => (
                <option key={s.id} value={s.id}>{s.nome} ({s.descricao || 'Sem descrição'})</option>
              ))}
            </select>
          </div>

          {scriptSelecionado && (
            <>
              {/* Filtro de Lojas do Broadcast */}
              <div style={{ 
                marginBottom: '1.8rem', 
                padding: '1.2rem', 
                background: 'rgba(255,255,255,0.02)', 
                border: '1px solid rgba(255,255,255,0.08)', 
                borderRadius: '8px' 
              }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '10px' }}>🎯 Seleção de Lojas Destino</label>
                
                <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
                  <button 
                    type="button"
                    onClick={() => setTipoSelecao('TODAS')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: tipoSelecao === 'TODAS' ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.3)',
                      color: tipoSelecao === 'TODAS' ? '#818cf8' : '#cbd5e1',
                      border: `1px solid ${tipoSelecao === 'TODAS' ? '#818cf8' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '13px',
                      transition: 'all 0.2s'
                    }}
                  >
                    Todas as Lojas
                  </button>
                  <button 
                    type="button"
                    onClick={() => setTipoSelecao('INTERVALO')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: tipoSelecao === 'INTERVALO' ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.3)',
                      color: tipoSelecao === 'INTERVALO' ? '#818cf8' : '#cbd5e1',
                      border: `1px solid ${tipoSelecao === 'INTERVALO' ? '#818cf8' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '13px',
                      transition: 'all 0.2s'
                    }}
                  >
                    Intervalo de Lojas
                  </button>
                  <button 
                    type="button"
                    onClick={() => setTipoSelecao('LISTA')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: tipoSelecao === 'LISTA' ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.3)',
                      color: tipoSelecao === 'LISTA' ? '#818cf8' : '#cbd5e1',
                      border: `1px solid ${tipoSelecao === 'LISTA' ? '#818cf8' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '13px',
                      transition: 'all 0.2s'
                    }}
                  >
                    Lista Específica
                  </button>
                </div>

                {tipoSelecao === 'INTERVALO' && (
                  <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Loja Inicial</label>
                      <input 
                        type="number" 
                        required
                        min="1"
                        placeholder="Ex: 50"
                        value={lojaDe}
                        onChange={e => setLojaDe(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          background: 'rgba(0,0,0,0.2)',
                          color: 'white',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Loja Final</label>
                      <input 
                        type="number" 
                        required
                        min="1"
                        placeholder="Ex: 90"
                        value={lojaAte}
                        onChange={e => setLojaAte(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          background: 'rgba(0,0,0,0.2)',
                          color: 'white',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                      />
                    </div>
                  </div>
                )}

                {tipoSelecao === 'LISTA' && (
                  <div style={{ marginTop: '10px' }}>
                    <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>IDs das Lojas (Separados por vírgula)</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: 50, 60, 70"
                      value={lojasIds}
                      onChange={e => setLojasIds(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: 'rgba(0,0,0,0.2)',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '6px',
                        fontSize: '13px'
                      }}
                    />
                    <small style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                      Digite os códigos das lojas destinos separados por vírgula. Ex: 50, 60, 70
                    </small>
                  </div>
                )}
              </div>
              {/* Alvo do Disparo */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>Alvo do Disparo</label>
                {scriptSelecionado.alvo_fixo ? (
                  <div style={{
                    padding: '12px',
                    background: 'rgba(99,102,241,0.1)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#818cf8',
                    fontWeight: 500
                  }}>
                    {scriptSelecionado.alvo_fixo === 'SERVIDOR' && '🔒 Fixado: Apenas no Servidor da Loja (Banco LOJA)'}
                    {scriptSelecionado.alvo_fixo === 'TODOS_PDVS' && '🔒 Fixado: Apenas em Todos os Caixas de cada loja (Banco PDV)'}
                    {scriptSelecionado.alvo_fixo === 'SERVIDOR_PDV' && '🔒 Fixado: No Servidor da Loja direcionado ao Banco PDV'}
                    {scriptSelecionado.alvo_fixo === 'AMBOS' && '🔒 Fixado: Servidores (LOJA) e Todos os Caixas (PDV)'}
                    {scriptSelecionado.alvo_fixo === 'PDV_ESPECIFICO' && '🔒 Convertido: Rodar em todos os Caixas da loja'}
                  </div>
                ) : (
                  <select 
                    value={alvo} 
                    onChange={e => setAlvo(e.target.value)} 
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'rgba(0,0,0,0.3)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="AMBOS">Todos os Servidores e Todos os Caixas</option>
                    <option value="TODOS_PDVS">Apenas Todos os Caixas</option>
                    <option value="SERVIDOR">Apenas os Servidores (LOJA)</option>
                    <option value="SERVIDOR_PDV">Servidores (PDV)</option>
                  </select>
                )}
              </div>

              {/* Parâmetros Dinâmicos */}
              {scriptSelecionado.parametros_exigidos && scriptSelecionado.parametros_exigidos.filter(p => p !== 'caixa' && p !== 'loja' && p !== 'loja_id').length > 0 && (
                <div style={{
                  marginBottom: '1.5rem',
                  padding: '1.2rem',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px'
                }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '14px', color: '#cbd5e1' }}>Parâmetros do Script</h4>
                  {scriptSelecionado.parametros_exigidos.filter(p => p !== 'caixa' && p !== 'loja' && p !== 'loja_id').map(p => (
                    <div key={p} style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px', textTransform: 'capitalize' }}>
                        {p}
                      </label>
                      <input 
                        type="text" 
                        required
                        value={parametros[p] || ''} 
                        onChange={e => handleParamChange(p, e.target.value)} 
                        style={{
                          width: '100%',
                          padding: '10px',
                          background: 'rgba(0,0,0,0.2)',
                          color: 'white',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}
                        placeholder={`Digite o valor de {${p}}`}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Caixa Alert */}
              {scriptSelecionado.parametros_exigidos.includes('caixa') && (
                <div style={{
                  marginBottom: '1.5rem',
                  padding: '12px',
                  background: 'rgba(245,158,11,0.15)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  color: '#f59e0b',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <span>
                    Atenção: Este script utiliza a variável <strong>{"{caixa}"}</strong>. No envio em massa, o robô injetará automaticamente o número correspondente de cada caixa/PDV que for processado.
                  </span>
                </div>
              )}

              {/* Warning Box */}
              <div style={{
                marginBottom: '2rem',
                padding: '1.2rem',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px',
                color: '#f87171',
                fontSize: '0.9rem',
                display: 'flex',
                gap: '10px'
              }}>
                <AlertTriangle size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ display: 'block', marginBottom: '4px', fontSize: '0.95rem' }}>⚠️ ALERTA DE SEGURANÇA CRÍTICO</strong>
                  Você está prestes a realizar um disparo global. Verifique se o SQL foi homologado anteriormente.
                  Máquinas ativas, servidores de loja e PDVs serão modificados concorrentemente.
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                className="btn" 
                disabled={executando} 
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  background: '#ef4444',
                  padding: '14px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 12px rgba(239,68,68,0.2)'
                }}
              >
                {executando ? (
                  <>
                    <RefreshCw size={18} className="spin" style={{ animation: 'spin 1s linear infinite', marginRight: '8px' }} />
                    Disparando robôs na Retaguarda...
                  </>
                ) : (
                  <>
                    <Play size={18} style={{ marginRight: '8px' }} />
                    Confirmar e Iniciar Robô Global
                  </>
                )}
              </button>
            </>
          )}

        </form>
      </div>

      {/* ── MODAL RADAR AO VIVO GLOBAL (BROADCAST MONITOR) ── */}
      {monitoramentoAberto && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1.5rem'
        }}>
          <div className="glass-panel" style={{
            padding: '2rem',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }}>
            
            <h3 style={{
              marginTop: 0,
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              paddingBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Radio size={22} color="#ef4444" className="blink" />
                Radar Ao Vivo: Transmissão Global
              </span>
              {(jobStatus?.status === 'concluido' || jobStatus?.status === 'erro') && (
                <button 
                  onClick={() => setMonitoramentoAberto(false)} 
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              )}
            </h3>

            {jobStatus ? (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', gap: '15px' }}>
                
                {/* Stats Panel & Progress */}
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  padding: '1.2rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}>
                  
                  {/* Grid de Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '15px', textAlign: 'center' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Total Lojas</span>
                      <strong style={{ fontSize: '20px', color: '#cbd5e1' }}>{totalLojas}</strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '10px', color: '#34d399', textTransform: 'uppercase', fontWeight: 600 }}>Sucesso</span>
                      <strong style={{ fontSize: '20px', color: '#34d399' }}>{concluidas}</strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '10px', color: '#f87171', textTransform: 'uppercase', fontWeight: 600 }}>Falha</span>
                      <strong style={{ fontSize: '20px', color: '#f87171' }}>{falhas}</strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '10px', color: '#fbbf24', textTransform: 'uppercase', fontWeight: 600 }}>Rodando</span>
                      <strong style={{ fontSize: '20px', color: '#fbbf24' }}>{emAndamento}</strong>
                    </div>
                  </div>

                  {/* Barra de Progresso */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '5px' }}>
                      <span>Status da Transmissão: {jobStatus.status === 'rodando' ? '📡 Enviando comando...' : '🏁 Concluído'}</span>
                      <strong style={{ color: '#818cf8' }}>{progressoPct}%</strong>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${progressoPct}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #6366f1 0%, #ef4444 100%)',
                        transition: 'width 0.4s ease'
                      }} />
                    </div>
                  </div>

                </div>

                {/* Filtro de Lojas no Radar */}
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input 
                    type="text"
                    value={buscaLoja}
                    onChange={e => setBuscaLoja(e.target.value)}
                    placeholder="Filtrar lojas no radar..."
                    style={{
                      width: '100%',
                      padding: '10px 10px 10px 35px',
                      background: 'rgba(0,0,0,0.2)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      fontSize: '13px'
                    }}
                  />
                  {buscaLoja && (
                    <button 
                      onClick={() => setBuscaLoja('')}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Lista de Lojas em Tempo Real */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.05)',
                  padding: '10px'
                }}>
                  {etapasFiltradas.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      Nenhuma loja encontrada para o filtro.
                    </div>
                  ) : (
                    etapasFiltradas.map((etapa, idx) => {
                      const isOffline = etapa.status === 'erro' && etapa.detalhe &&
                        (etapa.detalhe.toLowerCase().includes('offline') || etapa.detalhe.toLowerCase().includes('porta 1433'));
                      
                      const borderColor = etapa.status === 'rodando' ? '#fbbf24'
                        : etapa.status === 'sucesso' ? '#34d399'
                        : isOffline ? '#f97316'
                        : etapa.status === 'erro' ? '#ef4444'
                        : '#475569';

                      return (
                        <div key={idx} style={{
                          background: 'rgba(0,0,0,0.2)',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          borderLeft: `3px solid ${borderColor}`,
                          marginBottom: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: 500 }}>{etapa.nome}</span>
                            <span style={{ fontSize: '12px' }}>
                              {etapa.status === 'rodando' && (
                                <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <RefreshCw size={12} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Conectando
                                </span>
                              )}
                              {etapa.status === 'sucesso' && <span style={{ color: '#34d399', fontWeight: 600 }}>✅ Sucesso</span>}
                              {etapa.status === 'erro' && isOffline && (
                                <span style={{ color: '#f97316', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                                  <WifiOff size={13} /> Offline
                                </span>
                              )}
                              {etapa.status === 'erro' && !isOffline && (
                                <span style={{ color: '#ef4444', fontWeight: 600 }}>❌ Falha</span>
                              )}
                            </span>
                          </div>

                          {etapa.status === 'erro' && etapa.detalhe && (
                            <div style={{
                              fontSize: '11px',
                              color: isOffline ? '#fed7aa' : '#fca5a5',
                              background: isOffline ? 'rgba(249,115,22,0.08)' : 'rgba(239,68,68,0.08)',
                              borderRadius: '4px',
                              padding: '5px 8px',
                              fontFamily: 'monospace',
                              wordBreak: 'break-all',
                              maxHeight: '60px',
                              overflowY: 'auto'
                            }}>
                              {etapa.detalhe}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Final Status Indicator */}
                {jobStatus.status === 'concluido' && (
                  <div style={{
                    textAlign: 'center',
                    color: '#34d399',
                    fontWeight: 'bold',
                    fontSize: '15px',
                    padding: '8px',
                    background: 'rgba(52,211,153,0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(52,211,153,0.2)'
                  }}>
                    🎉 Missão Cumprida! Script transmitido com sucesso.
                  </div>
                )}
                {jobStatus.status === 'erro' && (
                  <div style={{
                    textAlign: 'center',
                    color: '#ef4444',
                    fontWeight: 'bold',
                    fontSize: '15px',
                    padding: '8px',
                    background: 'rgba(239,68,68,0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(239,68,68,0.2)'
                  }}>
                    ⚠️ Concluído com falha em algumas lojas da transmissão.
                  </div>
                )}

                {/* Close Button */}
                {(jobStatus.status === 'concluido' || jobStatus.status === 'erro') && (
                  <button 
                    className="btn" 
                    onClick={() => setMonitoramentoAberto(false)} 
                    style={{ background: '#475569', width: '100%', justifyContent: 'center' }}
                  >
                    Fechar Radar de Transmissão
                  </button>
                )}

              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <p style={{ margin: '0 0 10px 0' }}>Conectando à Retaguarda para iniciar o Broadcast...</p>
                <RefreshCw size={24} className="spin" style={{ animation: 'spin 1.2s linear infinite', color: '#ef4444' }} />
              </div>
            )}

          </div>
        </div>
      )}

      {/* Estilo para animação spin */}
      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .blink {
          animation: blink 1.5s infinite;
        }
        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
