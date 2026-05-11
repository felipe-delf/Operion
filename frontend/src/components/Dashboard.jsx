import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store } from 'lucide-react';

export default function Dashboard() {
  const [lojas, setLojas] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('http://127.0.0.1:8080/api/lojas/', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLojas(data);
        } else {
          console.error("Erro ao buscar lojas:", data);
          setLojas([]);
        }
      })
      .catch(err => console.error("Erro na requisição:", err));
  }, []);

  return (
    <div>
      <h2>Selecione uma Loja</h2>
      <p style={{ color: 'var(--text-muted)' }}>Escolha a loja onde deseja rodar os scripts de parametrização.</p>
      
      <div className="grid-cards">
        {lojas.map(loja => (
          <div 
            key={loja.id} 
            className="glass-panel store-card"
            onClick={() => navigate(`/loja/${loja.id}`)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
              <div style={{ background: 'rgba(99, 102, 241, 0.2)', padding: '12px', borderRadius: '12px' }}>
                <Store color="#818cf8" size={28} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{loja.nome}</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>CNPJ: {loja.cnpj}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
