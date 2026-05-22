import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Search, X } from 'lucide-react';

export default function Dashboard() {
  const [lojas, setLojas]   = useState([]);
  const [busca, setBusca]   = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`http://${window.location.hostname}:8080/api/lojas/`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setLojas(data);
        else { console.error('Erro ao buscar lojas:', data); setLojas([]); }
      })
      .catch(err => console.error('Erro na requisição:', err));
  }, []);

  const lojasFiltradas = lojas.filter(loja => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;

    // Se digitou apenas números (ex: "6") ou "loja <número>" / "lj <número>" (ex: "loja 16"), faz busca exata pelo ID da loja
    const matchLojaNum = q.match(/^(?:loja\s+|lj\s+)?(\d+)$/);
    if (matchLojaNum) {
      const targetId = parseInt(matchLojaNum[1], 10);
      return loja.id === targetId;
    }

    // Caso contrário, busca parcial por nome e CNPJ
    return loja.nome?.toLowerCase().includes(q)
      || loja.cnpj?.replace(/\D/g, '').includes(q.replace(/\D/g, ''));
  });

  return (
    <div>
      {/* ── Header + Busca ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Selecione uma Loja</h2>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            {busca ? `${lojasFiltradas.length} de ${lojas.length} lojas` : `${lojas.length} loja(s) ativa(s)`}
          </p>
        </div>

        {/* Campo de busca */}
        <div style={{ position: 'relative', minWidth: '280px' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }}
          />
          <input
            id="busca-loja"
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar loja por nome, número ou CNPJ..."
            style={{
              width: '100%',
              padding: '10px 36px 10px 38px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.06)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.12)',
              fontSize: '14px',
              outline: 'none',
              transition: 'border 0.2s',
              boxSizing: 'border-box',
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(129,140,248,0.6)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer',
                display: 'flex', padding: '2px'
              }}
              title="Limpar busca"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Grid de Lojas ── */}
      {lojas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <Store size={48} color="#334155" style={{ marginBottom: '1rem' }} />
          <p>Carregando lojas...</p>
        </div>
      ) : lojasFiltradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <Search size={40} color="#334155" style={{ marginBottom: '1rem' }} />
          <p>Nenhuma loja encontrada para <strong style={{ color: '#818cf8' }}>"{busca}"</strong></p>
          <button
            onClick={() => setBusca('')}
            style={{ marginTop: '1rem', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}
          >
            Limpar filtro
          </button>
        </div>
      ) : (
        <div className="grid-cards">
          {lojasFiltradas.map(loja => (
            <div
              key={loja.id}
              className="glass-panel store-card"
              onClick={() => navigate(`/loja/${loja.id}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
                <div style={{ background: 'rgba(99, 102, 241, 0.2)', padding: '12px', borderRadius: '12px', flexShrink: 0 }}>
                  <Store color="#818cf8" size={28} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {loja.nome}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    #{loja.id} · CNPJ: {loja.cnpj}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
