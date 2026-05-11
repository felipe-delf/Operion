import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Save, Trash2, PlusCircle, Server, Monitor } from 'lucide-react';

export default function AuditRules() {
  const [regras, setRegras] = useState([]);
  const [nome, setNome] = useState('');
  const [sqlQuery, setSqlQuery] = useState('');
  const [valorEsperado, setValorEsperado] = useState('');
  const [tipoAlvo, setTipoAlvo] = useState('PDV');
  const navigate = useNavigate();

  const carregarRegras = () => {
    const token = localStorage.getItem('token');
    fetch('http://127.0.0.1:8080/api/auditoria/', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setRegras(data);
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    if (localStorage.getItem('role') !== 'Admin') {
      alert('Acesso Negado: Apenas Administradores.');
      navigate('/dashboard');
      return;
    }
    carregarRegras();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const res = await fetch('http://127.0.0.1:8080/api/auditoria/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        nome,
        sql_query: sqlQuery,
        valor_esperado: valorEsperado,
        tipo_alvo: tipoAlvo
      })
    });

    if (res.ok) {
      alert("Regra de auditoria criada com sucesso!");
      setNome(''); setSqlQuery(''); setValorEsperado(''); setTipoAlvo('PDV');
      carregarRegras();
    } else {
      const data = await res.json();
      alert("Erro: " + data.detail);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Deletar esta regra? O Scanner vai parar de verifica-la.")) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`http://127.0.0.1:8080/api/auditoria/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) carregarRegras();
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <ShieldCheck size={32} color="#f43f5e" />
        <h2 style={{ margin: 0 }}>Padrões de Auditoria (Scanner Ativo)</h2>
      </div>
      
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        Defina os SELECTs que o PromoSync vai usar para avaliar se uma Loja está corretamente parametrizada.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <PlusCircle size={20} /> Nova Regra
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label>Nome do Padrão (Ex: Varejo 4.0, Epharma)</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} required style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }} />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label>Onde testar?</label>
              <select value={tipoAlvo} onChange={e => setTipoAlvo(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
                <option value="PDV">Apenas em Bancos de PDV</option>
                <option value="SERVIDOR">Apenas no Banco da Loja (Servidor)</option>
                <option value="AMBOS">Em Ambos</option>
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label>Comando SQL de Validação (Deve retornar 1 coluna)</label>
              <textarea value={sqlQuery} onChange={e => setSqlQuery(e.target.value)} required rows="3" placeholder="SELECT VALOR FROM PARAMETROS WHERE NOME = 'VAREJO'" style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', fontFamily: 'monospace' }}></textarea>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label>Valor Esperado (O que significa "Correto")</label>
              <input type="text" value={valorEsperado} onChange={e => setValorEsperado(e.target.value)} required placeholder="Ex: S, 1, ATIVO" style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }} />
            </div>

            <button type="submit" className="btn" style={{ width: '100%', justifyContent: 'center', background: '#f43f5e' }}>
              <Save size={18} /> Adicionar ao Scanner
            </button>
          </form>
        </div>

        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            Regras Ativas ({regras.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {regras.map(r => (
              <div key={r.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{r.nome}</h4>
                    <span className="tag" style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e' }}>
                      {r.tipo_alvo === 'SERVIDOR' ? <Server size={12}/> : <Monitor size={12}/>} {r.tipo_alvo}
                    </span>
                  </div>
                  <button onClick={() => handleDelete(r.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '5px' }}>
                    <Trash2 size={18} />
                  </button>
                </div>
                <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '5px', borderRadius: '4px', color: '#94a3b8', marginBottom: '5px' }}>
                  {r.sql_query}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#34d399' }}>
                  Espera receber: <strong>"{r.valor_esperado}"</strong>
                </div>
              </div>
            ))}
            {regras.length === 0 && <p style={{ color: 'var(--text-muted)' }}>O Scanner ainda não possui regras.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
