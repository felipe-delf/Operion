import { BrowserRouter, Routes, Route, useNavigate, Link } from 'react-router-dom';
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

function Navbar() {
  const navigate = useNavigate();
  const role = localStorage.getItem('role');

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
          <h1>PromoSync</h1>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link to="/dashboard" style={linkStyle}>Dashboard</Link>

          {role === 'Admin' && (
            <>
              <Link to="/scripts"  style={linkStyle}><Code size={16} /> Cofre SQL</Link>
              <Link to="/auditoria" style={linkStyle}><ShieldCheck size={16} /> Auditoria</Link>
              <Link to="/equipe"   style={linkStyle}><Users size={16} /> Equipe</Link>
              <Link to="/execucao-massa" style={linkStyle}><Radio size={16} /> Broadcast</Link>

              {/* Link de Logs — destaque vermelho para Admin saber que é área sensível */}
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
            </>
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
        <Route path="/dashboard"       element={<Layout><Dashboard /></Layout>} />
        <Route path="/loja/:id"        element={<Layout><StoreMonitor /></Layout>} />
        <Route path="/equipe"          element={<Layout><Team /></Layout>} />
        <Route path="/scripts"         element={<Layout><AdminScripts /></Layout>} />
        <Route path="/auditoria"       element={<Layout><AuditRules /></Layout>} />
        <Route path="/logs"            element={<Layout><ExecutionLogs /></Layout>} />
        <Route path="/execucao-massa"  element={<Layout><MassExecution /></Layout>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
