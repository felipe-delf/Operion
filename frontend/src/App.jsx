import { BrowserRouter, Routes, Route, useNavigate, Link, Navigate } from 'react-router-dom';
import Login from './components/Login';
import ChangePassword from './components/ChangePassword';
import Dashboard from './components/Dashboard';
import StoreMonitor from './components/StoreMonitor';
import Team from './components/Team';
import AdminScripts from './components/AdminScripts';
import AuditRules from './components/AuditRules';
import ExecutionLogs from './components/ExecutionLogs';
import MassExecution from './components/MassExecution';
import { Shield, Users, LogOut, Code, ShieldCheck, ClipboardList, Radio } from 'lucide-react';
import './index.css';

// ── Interceptador Global de API ──
// Captura erros de autenticação (401/403) em qualquer requisição do frontend
// e força o logout do usuário imediatamente, protegendo a aplicação.
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (response.status === 401 || response.status === 403) {
    // Evita loop infinito se já estiver na tela de login
    if (window.location.pathname !== '/' && window.location.pathname !== '/change-password') {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('permissions');
      alert('Sua sessão expirou ou você não tem permissão. Por favor, faça login novamente.');
      window.location.href = '/';
    }
  }
  return response;
};

// Componente para Proteção de Rotas Baseado em Permissões (com fallback de TI/Admin)
function ProtectedRoute({ children, permission }) {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role') || '';
  const permissions = localStorage.getItem('permissions') || '';

  if (!token) {
    return <Navigate to="/" replace />;
  }

  // TI e Admin sempre têm acesso a todas as rotas
  if (role === 'Admin' || role === 'TI' || role === 'Administradores') {
    return children;
  }

  if (permission && !permissions.includes(permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function Navbar() {
  const navigate = useNavigate();
  const role = localStorage.getItem('role') || '';
  const permissions = localStorage.getItem('permissions') || '';

  // TI e Admin sempre têm todas as permissões no frontend (evita deslogar após atualização)
  const hasPermission = (permission) => {
    if (role === 'Admin' || role === 'TI' || role === 'Administradores') return true;
    return permissions.includes(permission);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const linkStyle = {
    color: 'white',
    textDecoration: 'none',
    fontWeight: 500,
    display: 'flex',
    gap: '5px',
    alignItems: 'center',
    fontSize: '14px',
    padding: '4px 2px',
    opacity: 0.9,
    transition: 'opacity 0.2s',
  };

  return (
    <nav className="navbar glass-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
          <Shield size={24} color="#818cf8" />
          <h1>RetailDesk</h1>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {hasPermission('VER_DASHBOARD') && (
            <Link to="/dashboard" style={linkStyle}>Dashboard</Link>
          )}

          {hasPermission('GERENCIAR_COFRE') && (
            <Link to="/scripts" style={linkStyle}><Code size={16} /> Cofre SQL</Link>
          )}

          {hasPermission('GERENCIAR_AUDITORIA') && (
            <Link to="/auditoria" style={linkStyle}><ShieldCheck size={16} /> Auditoria</Link>
          )}

          {hasPermission('GERENCIAR_EQUIPE') && (
            <Link to="/equipe" style={linkStyle}><Users size={16} /> Equipe</Link>
          )}

          {hasPermission('EXECUTAR_BROADCAST') && (
            <Link to="/execucao-massa" style={linkStyle}><Radio size={16} /> Broadcast</Link>
          )}

          {hasPermission('VER_LOGS') && (
            <Link
              to="/logs"
              style={{
                ...linkStyle,
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '6px',
                padding: '4px 10px',
                color: '#f87171',
                opacity: 1,
              }}
            >
              <ClipboardList size={16} /> Logs
            </Link>
          )}
        </div>
      </div>

      <div>
        <button className="btn" onClick={handleLogout} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)' }}>
          <LogOut size={16} /> Sair
        </button>
      </div>
    </nav>
  );
}

function Layout({ children }) {
  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                element={<Login />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/dashboard"       element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/loja/:id"        element={<ProtectedRoute><Layout><StoreMonitor /></Layout></ProtectedRoute>} />
        <Route path="/equipe"          element={<ProtectedRoute permission="GERENCIAR_EQUIPE"><Layout><Team /></Layout></ProtectedRoute>} />
        <Route path="/scripts"         element={<ProtectedRoute permission="GERENCIAR_COFRE"><Layout><AdminScripts /></Layout></ProtectedRoute>} />
        <Route path="/auditoria"       element={<ProtectedRoute permission="GERENCIAR_AUDITORIA"><Layout><AuditRules /></Layout></ProtectedRoute>} />
        <Route path="/logs"            element={<ProtectedRoute permission="VER_LOGS"><Layout><ExecutionLogs /></Layout></ProtectedRoute>} />
        <Route path="/execucao-massa"  element={<ProtectedRoute permission="EXECUTAR_BROADCAST"><Layout><MassExecution /></Layout></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
