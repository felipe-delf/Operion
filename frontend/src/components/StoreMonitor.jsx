import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Server, Monitor, Play, ArrowLeft, X } from 'lucide-react';

export default function StoreMonitor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [scripts, setScripts] = useState([]);
  const [executando, setExecutando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [scriptSelecionado, setScriptSelecionado] = useState(null);
  const [alvo, setAlvo] = useState('TODOS_PDVS');
  const [caixaId, setCaixaId] = useState('');
  
  // Estados do Radar
  const [monitoramentoAberto, setMonitoramentoAberto] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    fetch(`http://127.0.0.1:8080/api/lojas/${id}/status`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setStatus(data))
      .catch(err => console.error(err));

    fetch('http://127.0.0.1:8080/api/scripts/?apenas_publicados=true', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setScripts(data))
      .catch(err => console.error(err));
  }, [id]);

  const abrirModal = (script) => {
    setScriptSelecionado(script);
    setAlvo('TODOS_PDVS');
    setCaixaId('');
    setModalAberto(true);
  };

  const handleExecute = async (e) => {
    e.preventDefault();
    setExecutando(true);
    
    // Preparando o payload para o Backend
    const payload = {
      script_id: scriptSelecionado.id,
      loja_id: id,
      alvo,
      parametros: scriptSelecionado.parametros_exigidos.includes('caixa') ? { caixa: caixaId } : {}
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://127.0.0.1:8080/api/execucoes/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if(res.ok) {
        const data = await res.json();
        setModalAberto(false);
        setJobId(data.job_id);
        setJobStatus(null);
        setMonitoramentoAberto(true);
        iniciarPolling(data.job_id);
      } else {
        alert("Erro ao executar script.");
      }
    } catch(err) {
      alert("Erro de conexão");
    } finally {
      setExecutando(false);
    }
  }

  const iniciarPolling = (idJob) => {
    const token = localStorage.getItem('token');
    const intervalo = setInterval(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8080/api/execucoes/${idJob}/status`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setJobStatus(data);
          
          if (data.status === 'concluido' || data.status === 'erro') {
            clearInterval(intervalo);
          }
        }
      } catch (e) {
        console.error("Erro no polling", e);
      }
    }, 1000);
  };

  if (!status) return (
    <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
      <Monitor size={48} color="#64748b" style={{ marginBottom: '1rem' }} />
      <h3>Iniciando Scanner da Loja {id}...</h3>
      <p>O robô está conectando no Servidor e em todos os Caixas para validar os padrões de auditoria.</p>
      <p style={{ fontSize: '2rem' }}>⏳</p>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button className="btn" onClick={() => navigate('/dashboard')} style={{ background: 'transparent', padding: '8px' }}>
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ margin: 0 }}>Monitoramento: Loja {id}</h2>
      </div>

      <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>Ações Disponíveis</h3>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {scripts.map(s => (
          <button key={s.id} className="btn" onClick={() => abrirModal(s)}>
            <Play size={18} /> {s.nome}
          </button>
        ))}
        {scripts.length === 0 && <span style={{ color: 'var(--text-muted)' }}>Nenhum script publicado pelo Admin.</span>}
      </div>

      <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>Servidor</h3>
      <div className="pc-grid" style={{ marginBottom: '2rem' }}>
        <div className={`glass-panel pc-card ${status.servidor.status === 'online' ? 'pc-online' : 'pc-offline'}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <Server size={24} color={status.servidor.status === 'online' ? "#34d399" : "#94a3b8"} />
              <span style={{ fontWeight: 'bold' }}>Servidor Principal</span>
            </div>
            <span className={`status-badge status-${status.servidor.status}`}>
              {status.servidor.status.toUpperCase()}
            </span>
          </div>
          <div className="tag-list" style={{ marginTop: '10px' }}>
            {status.servidor.parametros?.map(p => <span key={p} className="tag" style={{ background: 'rgba(52, 211, 153, 0.2)', color: '#34d399' }}>✅ {p}</span>)}
            {status.servidor.erros?.map(e => <span key={e} className="tag" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>❌ {e}</span>)}
          </div>
        </div>
      </div>

      <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>Caixas (PDVs)</h3>
      <div className="pc-grid">
        {status.pdvs.map(pdv => (
          <div key={pdv.id} className={`glass-panel pc-card ${pdv.status === 'online' ? 'pc-online' : 'pc-offline'}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <Monitor size={24} color={pdv.status === 'online' ? "#818cf8" : "#94a3b8"} />
                <span style={{ fontWeight: 'bold' }}>PDV {String(pdv.id).padStart(2, '0')}</span>
              </div>
              <span className={`status-badge status-${pdv.status}`}>
                {pdv.status.toUpperCase()}
              </span>
            </div>
            {pdv.status === 'offline' && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '5px 0' }}>Computador inativo ou sem rede</p>}
            {(pdv.parametros?.length > 0 || pdv.erros?.length > 0) && (
              <div className="tag-list" style={{ marginTop: '10px' }}>
                {pdv.parametros?.map(p => <span key={p} className="tag" style={{ background: 'rgba(52, 211, 153, 0.2)', color: '#34d399' }}>✅ {p}</span>)}
                {pdv.erros?.map(e => <span key={e} className="tag" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>❌ {e}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* MODAL DE EXECUÇÃO */}
      {modalAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ padding: '2rem', width: '450px', position: 'relative' }}>
            <button onClick={() => setModalAberto(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ marginTop: 0 }}>Executar: {scriptSelecionado?.nome}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{scriptSelecionado?.descricao}</p>
            
            <form onSubmit={handleExecute}>
              <div style={{ marginBottom: '1rem' }}>
                <label>Onde deseja rodar este script?</label>
                <select value={alvo} onChange={e => setAlvo(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px' }}>
                  <option value="TODOS_PDVS">Em todos os Bancos de PDV</option>
                  <option value="SERVIDOR">Somente no Banco da Loja</option>
                  <option value="PDV_ESPECIFICO">Em um Banco de PDV Específico</option>
                </select>
              </div>

              {alvo === 'PDV_ESPECIFICO' && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label>Número do Caixa</label>
                  <input type="number" required value={caixaId} onChange={e => setCaixaId(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px' }} placeholder="Ex: 1" />
                </div>
              )}

              {scriptSelecionado?.parametros_exigidos.includes('caixa') && alvo !== 'PDV_ESPECIFICO' && (
                 <div style={{ marginBottom: '1.5rem', padding: '10px', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', borderRadius: '6px', fontSize: '0.85rem' }}>
                   Atenção: Este script exige um número de Caixa. Selecione "Caixa Específico" no Alvo.
                 </div>
              )}

              <button type="submit" className="btn" disabled={executando} style={{ width: '100%', justifyContent: 'center', background: '#34d399' }}>
                {executando ? 'Iniciando Robô...' : 'Confirmar e Disparar Script'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE RADAR (MONITORAMENTO AO VIVO) */}
      {monitoramentoAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ padding: '2rem', width: '500px', position: 'relative' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Monitor size={20} color="#60a5fa" /> Radar de Execução Ao Vivo
            </h3>
            
            {jobStatus ? (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                  {jobStatus.etapas.map((etapa, idx) => (
                     <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', borderLeft: etapa.status === 'rodando' ? '3px solid #f59e0b' : etapa.status === 'sucesso' ? '3px solid #34d399' : etapa.status === 'erro' ? '3px solid #ef4444' : '3px solid transparent' }}>
                        <span style={{ fontWeight: 500 }}>{etapa.nome}</span>
                        <span>
                           {etapa.status === 'pendente' && <span style={{ color: 'var(--text-muted)' }}>Aguardando...</span>}
                           {etapa.status === 'rodando' && <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '5px' }}>⏳ Conectando</span>}
                           {etapa.status === 'sucesso' && <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '5px' }}>✅ Finalizado</span>}
                           {etapa.status === 'erro' && <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '5px' }}>❌ Falha</span>}
                        </span>
                     </div>
                  ))}
                  
                  {jobStatus.status === 'concluido' && (
                     <div style={{ marginTop: '20px', textAlign: 'center', color: '#34d399', fontWeight: 'bold', fontSize: '1.1rem' }}>
                        🎉 Missão Cumprida! Script executado em todos os alvos.
                     </div>
                  )}
                  {jobStatus.status === 'erro' && (
                     <div style={{ marginTop: '20px', textAlign: 'center', color: '#ef4444', fontWeight: 'bold', fontSize: '1.1rem' }}>
                        ⚠️ A Execução encontrou um erro grave.
                     </div>
                  )}

                  {(jobStatus.status === 'concluido' || jobStatus.status === 'erro') && (
                     <button className="btn" onClick={() => setMonitoramentoAberto(false)} style={{ marginTop: '20px', justifyContent: 'center', background: '#475569', width: '100%' }}>Fechar Radar</button>
                  )}
               </div>
            ) : (
               <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                 <p>Acordando o robô na Retaguarda...</p>
                 <p style={{ fontSize: '2rem' }}>⏳</p>
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
