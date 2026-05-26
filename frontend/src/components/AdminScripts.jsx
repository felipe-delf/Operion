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
  const [alvoFixo, setAlvoFixo] = useState('');
  const [publicado, setPublicado] = useState(true);
  const navigate = useNavigate();

  const loadScripts = () => {
    const token = localStorage.getItem('token');
    fetch(`http://${window.location.hostname}:8080/api/scripts/`, {
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
    const activeRole = localStorage.getItem('role');
    const permissions = localStorage.getItem('permissions') || '';
    
    if (activeRole !== 'TI' && activeRole !== 'Administradores' && activeRole !== 'Admin' && !permissions.includes('GERENCIAR_COFRE')) {
      alert('Acesso Negado: Você não tem permissão para gerenciar o cofre SQL.');
      navigate('/dashboard');
      return;
    }
    loadScripts();
  }, [navigate]);

  const resetForm = () => {
    setEditandoId(null);
    setNome(''); setDescricao(''); setSqlServidor(''); setSqlPdv(''); setExigeCaixa(false); setAlvoFixo(''); setPublicado(true);
  };

  const handleEditClick = (script) => {
    setEditandoId(script.id);
    setNome(script.nome);
    setDescricao(script.descricao || '');
    setSqlServidor(script.sql_servidor || '');
    setSqlPdv(script.sql_pdv || '');
    setExigeCaixa(script.parametros_exigidos?.includes('caixa'));
    setAlvoFixo(script.alvo_fixo || '');
    setPublicado(script.publicado);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Certeza absoluta que quer deletar esse script?")) return;
    const token = localStorage.getItem('token');
    
    const res = await fetch(`http://${window.location.hostname}:8080/api/scripts/${id}`, {
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

    const url = editandoId ? `http://${window.location.hostname}:8080/api/scripts/${editandoId}` : `http://${window.location.hostname}:8080/api/scripts/`;
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
        publicado,
        alvo_fixo: alvoFixo || null
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
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} required placeholder="Ex: Ativar Epharma" className="form-input" style={{ marginTop: "5px" }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>Descrição Opcional</label>
              <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)} className="form-input" style={{ marginTop: "5px" }} />
            </div>
            
            <div 
              style={{ marginBottom: '1rem', display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(99, 102, 241, 0.1)', padding: '10px', borderRadius: '6px', cursor: 'help' }}
              title="O QUE FAZ: Obriga o suporte a informar o número do caixa antes de rodar. O robô substitui a variável {caixa} no SQL pelo número digitado.&#13;&#13;QUANDO UTILIZAR: Use em scripts de correção de PDV que contenham filtros específicos ou caminhos baseados no número do terminal (ex: WHERE NumeroPdv = {caixa})."
            >
              <input type="checkbox" checked={exigeCaixa} onChange={e => setExigeCaixa(e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'help' }} />
              <label style={{ margin: 0, fontWeight: 'bold', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'help' }}>
                Este script exige que o usuário digite o Número do Caixa?
                <HelpCircle size={16} />
              </label>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#34d399' }}>
                <Server size={16} /> SQL do Banco da Loja
                <HelpCircle 
                  size={14} 
                  title="O QUE FAZ: Código SQL que será executado no banco de dados do Servidor da Loja (RETAGUARDA).&#13;&#13;QUANDO UTILIZAR: Sempre que precisar alterar tabelas da Retaguarda, tabelas de controle de filiais ou realizar SELECTs/UPDATEs gerais no servidor principal da loja." 
                  style={{ cursor: 'help', color: 'var(--text-muted)' }} 
                />
              </label>
              <textarea value={sqlServidor} onChange={e => setSqlServidor(e.target.value)} rows="5" placeholder="USE LOJA; ..." className="form-input" style={{ marginTop: "5px", fontFamily: "monospace", minHeight: "120px" }}></textarea>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#818cf8' }}>
                <Database size={16} /> SQL do Banco do PDV
                <HelpCircle 
                  size={14} 
                  title="O QUE FAZ: Código SQL que será executado no banco de dados do Caixa/PDV.&#13;&#13;QUANDO UTILIZAR: Sempre que a alteração for em tabelas locais do caixa (tabelas de vendas locais, parâmetros do terminal, configurações de cupom local, etc.)." 
                  style={{ cursor: 'help', color: 'var(--text-muted)' }} 
                />
              </label>
              <textarea value={sqlPdv} onChange={e => setSqlPdv(e.target.value)} rows="5" placeholder="USE PDV; ..." className="form-input" style={{ marginTop: "5px", fontFamily: "monospace", minHeight: "120px" }}></textarea>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
                Travar Alvo de Execução (Opcional)
                <HelpCircle 
                  size={16} 
                  title="O QUE FAZ: Restringe a execução deste script a um destino fixo, desabilitando a escolha do usuário no momento de rodar.&#13;&#13;QUANDO UTILIZAR: Sempre que o SQL for específico para um tipo de banco. Ex: Se o SQL usa 'USE PDV', trave em 'Apenas todos os caixas' ou 'Apenas um caixa específico' para evitar que o suporte tente rodar acidentalmente no servidor." 
                  style={{ cursor: 'help', color: 'var(--text-muted)' }} 
                />
              </label>
              <select value={alvoFixo} onChange={e => setAlvoFixo(e.target.value)} className="form-select">
                <option value="" title="O QUE FAZ: Permite que o operador escolha livremente onde rodar.&#13;&#13;QUANDO UTILIZAR: Use para scripts muito genéricos ou que possam se aplicar a qualquer cenário conforme a necessidade do suporte.">Deixar usuário escolher no momento da execução</option>
                <option value="AMBOS" title="O QUE FAZ: Trava a execução para rodar simultaneamente no Servidor e em todos os caixas da loja.&#13;&#13;QUANDO UTILIZAR: Use para scripts globais de parametrização completa da filial.">Todos os Servidores e Todos os Caixas</option>
                <option value="TODOS_PDVS" title="O QUE FAZ: Trava a execução para rodar em todos os caixas da loja.&#13;&#13;QUANDO UTILIZAR: Use para scripts de alteração em massa nos PDVs (ex: alteração de configuração de cupom ou carga de dados em todos os caixas).">Apenas Todos os Caixas</option>
                <option value="SERVIDOR" title="O QUE FAZ: Trava a execução para rodar apenas no banco RETAGUARDA do Servidor.&#13;&#13;QUANDO UTILIZAR: Use para scripts que afetam apenas tabelas da retaguarda local da filial (ex: ajustes de cargas, integrações locais).">Apenas os Servidores (LOJA)</option>
                <option value="SERVIDOR_PDV" title="O QUE FAZ: Trava a execução para rodar no banco do PDV localizado dentro do servidor da loja.&#13;&#13;QUANDO UTILIZAR: Use quando a base do PDV centralizada no servidor precisar sofrer alterações.">Servidores (PDV)</option>
                <option value="PDV_ESPECIFICO" title="O QUE FAZ: Trava a execução para rodar em apenas um caixa específico digitado pelo operador.&#13;&#13;QUANDO UTILIZAR: Use para correções pontuais de erros ou falhas locais em um terminal específico da loja.">Apenas um Caixa Específico</option>
              </select>
            </div>

            <div 
              style={{ marginBottom: '1.5rem', display: 'flex', gap: '10px', alignItems: 'center', cursor: 'help' }}
              title="O QUE FAZ: Define a visibilidade do script para a equipe técnica nas lojas.&#13;&#13;QUANDO UTILIZAR: Deixe desmarcado (Rascunho) enquanto estiver testando ou refinando o SQL. Marque (Publicado) apenas quando o script estiver pronto, testado e homologado para uso do suporte nas lojas."
            >
              <input type="checkbox" checked={publicado} onChange={e => setPublicado(e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'help' }} />
              <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '5px', cursor: 'help' }}>
                Publicar agora (Ficará visível nas lojas)
                <HelpCircle size={16} style={{ color: 'var(--text-muted)' }} />
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
                    {s.publicado ? (
                      <span 
                        className="tag" 
                        style={{ background: 'rgba(52, 211, 153, 0.2)', color: '#34d399', cursor: 'help' }}
                        title="O QUE SIGNIFICA: Este script está ativo e visível para execução pelo suporte nas lojas."
                      >
                        Publicado
                      </span>
                    ) : (
                      <span 
                        className="tag" 
                        style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', cursor: 'help' }}
                        title="O QUE SIGNIFICA: Este script está salvo apenas como rascunho. O suporte não consegue visualizá-lo ou executá-lo nas lojas."
                      >
                        Rascunho
                      </span>
                    )}
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
                <div style={{ display: 'flex', gap: '10px', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                  {s.parametros_exigidos && s.parametros_exigidos.length > 0 && (
                    <span 
                      style={{ color: '#f59e0b', cursor: 'help' }}
                      title="O QUE SIGNIFICA: Ao executar, o suporte será obrigado a informar o número do caixa específico para preencher a variável {caixa} no SQL."
                    >
                      ⚠️ Exige Parâmetros: {s.parametros_exigidos.join(', ')}
                    </span>
                  )}
                  {s.alvo_fixo && (
                    <span 
                      style={{ color: '#818cf8', cursor: 'help', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      title={`Este script está travado para rodar apenas no alvo: ${s.alvo_fixo}. O suporte não poderá alterar o destino na hora de executar, proporcionando segurança máxima.`}
                    >
                      🔒 Alvo Fixo: {s.alvo_fixo}
                    </span>
                  )}
                </div>
                {/* Metadados de Autoria (Audit) */}
                <div style={{ 
                  marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', 
                  display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.75rem', color: '#64748b' 
                }}>
                  {s.criado_por && (
                    <span>✍️ Criado por: <strong style={{ color: '#94a3b8' }}>{s.criado_por}</strong></span>
                  )}
                  {s.modificado_por && s.modificado_por !== s.criado_por && (
                    <span>✏️ Modificado por: <strong style={{ color: '#94a3b8' }}>{s.modificado_por}</strong></span>
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
