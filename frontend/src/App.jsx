import { BrowserRouter, Routes, Route, useNavigate, Link } from 'react-router-dom';
import Login from './components/Login';
import ChangePassword from './components/ChangePassword';
import Dashboard from './components/Dashboard';
import StoreMonitor from './components/StoreMonitor';
import Team from './components/Team';
import AdminScripts from './components/AdminScripts';
import AuditRules from './components/AuditRules';
import { Shield, Users, LogOut, Code, ShieldCheck } from 'lucide-react';
import './index.css';

function Navbar() {
  const navigate = useNavigate();
  const role = localStorage.getItem('role');

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <nav className="navbar glass-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
          <Shield size={24} color="#818cf8" />
          <h1>PromoSync</h1>
        </div>

        <div style={{ display: 'flex', gap: '15px' }}>
          <Link to="/dashboard" style={{ color: 'white', textDecoration: 'none', fontWeight: 500 }}>Dashboard</Link>

          {role === 'Admin' && (
            <>
              <Link to="/scripts" style={{ color: 'white', textDecoration: 'none', fontWeight: 500, display: 'flex', gap: '5px', alignItems: 'center' }}>
                <Code size={18} /> Cofre SQL
              </Link>
              <Link to="/auditoria" style={{ color: 'white', textDecoration: 'none', fontWeight: 500, display: 'flex', gap: '5px', alignItems: 'center' }}>
                <ShieldCheck size={18} /> Auditoria
              </Link>
              <Link to="/equipe" style={{ color: 'white', textDecoration: 'none', fontWeight: 500, display: 'flex', gap: '5px', alignItems: 'center' }}>
                <Users size={18} /> Equipe
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
        <Route path="/" element={<Login />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
        <Route path="/loja/:id" element={<Layout><StoreMonitor /></Layout>} />
        <Route path="/equipe" element={<Layout><Team /></Layout>} />
        <Route path="/scripts" element={<Layout><AdminScripts /></Layout>} />
        <Route path="/auditoria" element={<Layout><AuditRules /></Layout>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
