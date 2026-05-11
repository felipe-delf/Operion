import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Code, Save, Database, Server, CheckSquare, ListPlus, Pencil, Trash2, X, HelpCircle } from 'lucide-react';

export default function AdminScripts() {
  const [scripts, setScripts] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [sqlServidor, setSqlServidor] = useState('');
  const [sqlPdv, setSqlPdv] = useState('');
  const [exigeCaixa, setExigeCaixa] = useState(false);
  const [publicado, setPublicado] = useState(true);
  const navigate = useNavigate();

  const loadScripts = () => {
    const token = localStorage.getItem('token');
    fetch('http://127.0.0.1:8080/api/scripts/', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setScripts(data);
        } else {
          console.error("Erro ao carregar scripts:", data);
          setScripts([]);
        }
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    if (localStorage.getItem('role') !== 'Admin') {
      alert('Acesso Negado: Apenas Administradores.');
      navigate('/dashboard');
      return;
    }
    loadScripts();
  }, [navigate]);

  const resetForm = () => {
    setEditandoId(null);
    setNome(''); setDescricao(''); setSqlServidor(''); setSqlPdv(''); setExigeCaixa(false); setPublicado(true);
  };

  const handleEditClick = (script) => {
    setEditandoId(script.id);
    setNome(script.nome);
    setDescricao(script.descricao || '');
    setSqlServidor(script.sql_servidor || '');
    setSqlPdv(script.sql_pdv || '');
    setExigeCaixa(script.parametros_exigidos?.includes('caixa'));
    setPublicado(script.publicado);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Certeza absoluta que quer deletar esse script?")) return;
    const token = localStorage.getItem('token');
    
    const res = await fetch(`http://127.0.0.1:8080/api/scripts/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
      loadScripts();
      if (editandoId === id) resetForm();
    } else {
      alert("Erro ao excluir.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const parametros_exigidos = exigeCaixa ? ["caixa"] : [];

    const url = editandoId ? `http://127.0.0.1:8080/api/scripts/${editandoId}` : 'http://127.0.0.1:8080/api/scripts/';
    const method = editandoId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        nome,
        descricao,
        sql_servidor: sqlServidor,
        sql_pdv: sqlPdv,
        parametros_exigidos,
        publicado
      })
    });

    if (res.ok) {
      alert(editandoId ? "Script atualizado!" : "Script salvo no cofre com sucesso!");
      resetForm();
      loadScripts();
    } else {
      const data = await res.json();
      alert("Erro: " + data.detail);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Code size={32} color="#c084fc" />
        <h2 style={{ margin: 0 }}>Cofre de Scripts SQL</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Formulário de Criação/Edição */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            {editandoId ? <Pencil size={20} color="#f59e0b" /> : <ListPlus size={20} />}
            {editandoId ? 'Editando Código' : 'Novo Código de Parametrização'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label>Nome do Script (Ficará visível no botão)</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} required placeholder="Ex: Ativar Epharma" style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>Descrição Opcional</label>
              <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }} />
            </div>
            
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(99, 102, 241, 0.1)', padding: '10px', borderRadius: '6px' }}>
              <input type="checkbox" checked={exigeCaixa} onChange={e => setExigeCaixa(e.target.checked)} style={{ width: '20px', height: '20px' }} />
              <label style={{ margin: 0, fontWeight: 'bold', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                Este script exige que o usuário digite o Número do Caixa?
                <HelpCircle size={16} title="Marcando isso, o Suporte será obrigado a informar o número do caixa. O texto {caixa} no SQL será substituído pelo número digitado." style={{ cursor: 'help' }} />
              </label>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#34d399' }}><Server size={16} /> SQL do Banco da Loja</label>
              <textarea value={sqlServidor} onChange={e => setSqlServidor(e.target.value)} rows="5" placeholder="USE LOJA; ..." style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', fontFamily: 'monospace' }}></textarea>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#818cf8' }}><Database size={16} /> SQL do Banco do PDV</label>
              <textarea value={sqlPdv} onChange={e => setSqlPdv(e.target.value)} rows="5" placeholder="USE PDV; ..." style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', fontFamily: 'monospace' }}></textarea>
            </div>

            <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="checkbox" checked={publicado} onChange={e => setPublicado(e.target.checked)} style={{ width: '20px', height: '20px' }} />
              <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                Publicar agora (Ficará visível nas lojas)
                <HelpCircle size={16} title="Se não marcar, o script ficará como Rascunho, visível apenas para você aqui no Cofre." style={{ cursor: 'help', color: 'var(--text-muted)' }} />
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn" type="submit" style={{ flex: 1, justifyContent: 'center', background: editandoId ? '#f59e0b' : '#8b5cf6' }}>
                <Save size={18} /> {editandoId ? 'Atualizar Script' : 'Salvar Script no Cofre'}
              </button>
              {editandoId && (
                <button type="button" onClick={resetForm} className="btn" style={{ background: '#475569' }}>
                  <X size={18} /> Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Lista de Scripts */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckSquare size={20} /> Scripts Cadastrados
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {scripts.map(s => (
              <div key={s.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{s.nome}</h4>
                    {s.publicado ? <span className="tag" style={{ background: 'rgba(52, 211, 153, 0.2)', color: '#34d399' }}>Publicado</span> : <span className="tag" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>Rascunho</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => handleEditClick(s)} style={{ background: 'transparent', border: 'none', color: '#f59e0b', cursor: 'pointer', padding: '5px' }} title="Editar">
                      <Pencil size={18} />
                    </button>
                    <button onClick={() => handleDelete(s.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '5px' }} title="Excluir">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{s.descricao || "Sem descrição"}</p>
                <div style={{ display: 'flex', gap: '10px', fontSize: '0.8rem' }}>
                  {s.parametros_exigidos && s.parametros_exigidos.length > 0 && (
                    <span style={{ color: '#f59e0b' }}>⚠️ Exige Parâmetros: {s.parametros_exigidos.join(', ')}</span>
                  )}
                </div>
              </div>
            ))}
            {scripts.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Nenhum script cadastrado ainda.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
