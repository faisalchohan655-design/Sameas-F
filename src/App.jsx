import React, { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import * as Lucide from 'lucide-react';
import { Dialog, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@radix-ui/react-dialog';
import Dashboard from './pages/Dashboard';
import LeadFinder from './pages/LeadFinder';
import CampaignHub from './pages/CampaignHub';
import EmailExtractor from './pages/EmailExtractor';
import Login from './pages/Login';

// API Client
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Context
const AppContext = createContext(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, hot: 0, avgScore: 0, conversion: 0, messages: 0, emails: 0 });
  const [campaigns, setCampaigns] = useState([]);
  const [toast, setToast] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchLeads = useCallback(async (filters = {}) => {
    setLoading(true);
    try {
      const res = await API.get('/leads', { params: filters });
      setLeads(res.data);
      const total = res.data.length;
      const hot = res.data.filter(l => l.aiScore >= 80).length;
      const avgScore = total ? Math.round(res.data.reduce((s, l) => s + (l.aiScore || 0), 0) / total) : 0;
      const messages = res.data.filter(l => l.status === 'contacted' || l.status === 'qualified').length;
      const emails = res.data.filter(l => l.email).length;
      setStats({ total, hot, avgScore, conversion: total ? Math.round((messages / total) * 100) : 0, messages, emails });
    } catch (e) {
      console.error('Fetch leads error:', e);
      if (e.response?.status === 401) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const createLead = async (data) => {
    try {
      const res = await API.post('/leads', data);
      await fetchLeads();
      showToast('Lead created successfully');
      return res.data;
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to create lead', 'error');
      throw e;
    }
  };

  const updateLead = async (id, data) => {
    try {
      const res = await API.put(`/leads/${id}`, data);
      await fetchLeads();
      showToast('Lead updated successfully');
      return res.data;
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to update lead', 'error');
      throw e;
    }
  };

  const deleteLead = async (id) => {
    try {
      await API.delete(`/leads/${id}`);
      await fetchLeads();
      showToast('Lead deleted successfully');
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to delete lead', 'error');
      throw e;
    }
  };

  const bulkDelete = async (ids) => {
    try {
      await API.post('/leads/bulk/delete', { ids });
      await fetchLeads();
      showToast(`${ids.length} leads deleted successfully`);
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to delete leads', 'error');
      throw e;
    }
  };

  const bulkSave = async (data) => {
    try {
      const res = await API.post('/leads/bulk', data);
      await fetchLeads();
      showToast(`${res.data.saved || res.data.length} leads saved successfully`);
      return res.data;
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to save leads', 'error');
      throw e;
    }
  };

  const exportCSV = async () => {
    try {
      const res = await API.get('/leads/export/csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads_${Date.now()}.csv`;
      a.click();
      showToast('CSV exported successfully');
    } catch (e) {
      showToast('Failed to export CSV', 'error');
    }
  };

  const exportExcel = async () => {
    try {
      const res = await API.get('/leads/export/excel', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads_${Date.now()}.xlsx`;
      a.click();
      showToast('Excel exported successfully');
    } catch (e) {
      showToast('Failed to export Excel', 'error');
    }
  };

  const login = async (email, password) => {
    try {
      const res = await API.post('/auth/login', { email, password });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
      showToast(`Welcome back, ${user.name}!`);
      return user;
    } catch (e) {
      showToast(e.response?.data?.message || 'Login failed', 'error');
      throw e;
    }
  };

  const register = async (name, email, password) => {
    try {
      const res = await API.post('/auth/register', { name, email, password });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
      showToast(`Welcome, ${user.name}!`);
      return user;
    } catch (e) {
      showToast(e.response?.data?.message || 'Registration failed', 'error');
      throw e;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setLeads([]);
    showToast('Logged out successfully', 'info');
  };

  const value = {
    user,
    leads,
    loading,
    stats,
    campaigns,
    toast,
    token,
    showToast,
    fetchLeads,
    createLead,
    updateLead,
    deleteLead,
    bulkDelete,
    bulkSave,
    exportCSV,
    exportExcel,
    login,
    register,
    logout,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// Toast Component
const Toast = ({ message, type }) => {
  const icons = { success: 'CheckCircle', error: 'XCircle', info: 'Info' };
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`fixed top-6 right-6 z-[999] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl ${type === 'error' ? 'bg-red-500/20 border border-red-500/30' :
          type === 'info' ? 'bg-blue-500/20 border border-blue-500/30' :
          'bg-green-500/20 border border-green-500/30'
        }`}
    >
      {React.createElement(Lucide[icons[type] || 'CheckCircle'], { size: 20, className: type === 'error' ? 'text-red-400' : type === 'info' ? 'text-blue-400' : 'text-green-400' })}
      <span className="text-sm font-medium">{message}</span>
    </motion.div>
  );
};

// Sidebar Component
const Sidebar = () => {
  const location = useLocation();
  const { logout, user } = useApp();
  const navItems = [
    { path: '/', label: 'Dashboard', icon: 'LayoutDashboard' },
    { path: '/lead-finder', label: 'Lead Finder', icon: 'Search' },
    { path: '/campaign-hub', label: 'Campaign Hub', icon: 'Send' },
    { path: '/email-extractor', label: 'Email Extractor', icon: 'Mail' },
  ];

  return (
    <div className="fixed left-0 top-0 h-full w-64 glass-dark border-r border-white/5 p-4 flex flex-col z-50">
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
          <Lucide.Zap size={22} className="text-white" />
        </div>
        <span className="text-xl font-bold gradient-text">LeadAI</span>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                  ? 'gradient-bg text-white shadow-lg shadow-purple-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              {React.createElement(Lucide[item.icon], { size: 18 })}
              <span className="font-medium text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="pt-4 border-t border-white/5 space-y-3">
        <div className="px-4 py-3 rounded-xl glass text-sm">
          <div className="flex items-center gap-2 text-purple-400">
            <Lucide.Sparkles size={16} />
            <span className="font-medium">AI Engine Active</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">v2.4.1</div>
        </div>
        {user && (
          <div className="flex items-center justify-between px-2">
            <span className="text-sm text-gray-400">{user.name}</span>
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition"
            >
              <Lucide.LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Protected Route
const ProtectedRoute = ({ children }) => {
  const { token } = useApp();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  return token ? children : null;
};

// Main App
function App() {
  const { toast } = useApp();

  return (
    <BrowserRouter>
      <AppProvider>
        <div className="flex min-h-screen">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <div className="flex min-h-screen">
                  <Sidebar />
                  <div className="flex-1 ml-64 min-h-screen">
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/lead-finder" element={<LeadFinder />} />
                      <Route path="/campaign-hub" element={<CampaignHub />} />
                      <Route path="/email-extractor" element={<EmailExtractor />} />
                    </Routes>
                  </div>
                </div>
              </ProtectedRoute>
            } />
          </Routes>
          <AnimatePresence>
            {toast && <Toast {...toast} />}
          </AnimatePresence>
        </div>
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
