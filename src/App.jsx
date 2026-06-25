import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import * as Lucide from 'lucide-react';
import { motion } from 'framer-motion';

// ============ API (NO AUTH) ============
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' }
});

// ============ CONTEXT ============
const AppContext = createContext(null);
const useApp = () => useContext(AppContext);

const AppProvider = ({ children }) => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, hot: 0, avgScore: 0 });
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await API.get('/leads');
      setLeads(res.data);
      const total = res.data.length;
      const hot = res.data.filter(l => l.aiScore >= 80).length;
      const avg = total ? Math.round(res.data.reduce((s, l) => s + (l.aiScore || 0), 0) / total) : 0;
      setStats({ total, hot, avgScore: avg });
    } catch (e) {
      showToast('Failed to fetch leads', 'error');
    } finally {
      setLoading(false);
    }
  };

  const bulkSave = async (data) => {
    try {
      const res = await API.post('/leads/bulk', data);
      await fetchLeads();
      showToast(`${res.data.length} leads saved`);
      return res.data;
    } catch (e) {
      showToast('Failed to save leads', 'error');
    }
  };

  const bulkDelete = async (ids) => {
    try {
      await API.post('/leads/bulk/delete', { ids });
      await fetchLeads();
      showToast(`${ids.length} leads deleted`);
    } catch (e) {
      showToast('Failed to delete leads', 'error');
    }
  };

  const deleteLead = async (id) => {
    try {
      await API.delete(`/leads/${id}`);
      await fetchLeads();
      showToast('Lead deleted');
    } catch (e) {
      showToast('Failed to delete lead', 'error');
    }
  };

  const createLead = async (data) => {
    try {
      const res = await API.post('/leads', data);
      await fetchLeads();
      showToast('Lead created');
      return res.data;
    } catch (e) {
      showToast('Failed to create lead', 'error');
    }
  };

  return (
    <AppContext.Provider value={{
      leads, loading, stats, toast, showToast, fetchLeads,
      bulkSave, bulkDelete, deleteLead, createLead
    }}>
      {children}
    </AppContext.Provider>
  );
};

// ============ COMPONENTS ============
const Toast = () => {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
      className={`fixed top-6 right-6 z-[999] px-6 py-3 rounded-xl text-white shadow-xl ${toast.type === 'error' ? 'bg-red-500' : toast.type === 'info' ? 'bg-blue-500' : 'bg-green-500'}`}>
      {toast.message}
    </motion.div>
  );
};

const Sidebar = () => {
  const location = useLocation();
  const items = [
    { path: '/', label: 'Dashboard', icon: 'LayoutDashboard' },
    { path: '/lead-finder', label: 'Lead Finder', icon: 'Search' },
    { path: '/campaign-hub', label: 'Campaign Hub', icon: 'Send' },
    { path: '/email-extractor', label: 'Email Extractor', icon: 'Mail' }
  ];

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-black/90 border-r border-white/5 p-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
          <Lucide.Zap size={20} className="text-white" />
        </div>
        <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500">LeadAI</span>
      </div>
      <nav className="space-y-1">
        {items.map((item) => {
          const active = location.pathname === item.path;
          const Icon = Lucide[item.icon];
          return (
            <Link key={item.path} to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${active ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              <Icon size={18} /> <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

// ============ PAGES ============

// Dashboard Page
const Dashboard = () => {
  const { leads, loading, stats, fetchLeads, deleteLead, bulkDelete } = useApp();
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => { fetchLeads(); }, []);

  const filtered = useMemo(() => {
    let result = leads;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(l => l.name?.toLowerCase().includes(s) || l.email?.toLowerCase().includes(s));
    }
    if (status) result = result.filter(l => l.status === status);
    return result;
  }, [leads, search, status]);

  const StatCard = ({ icon, label, value }) => {
    const Icon = Lucide[icon];
    return (
      <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
        <div className="flex justify-between">
          <div><div className="text-xs text-gray-400">{label}</div><div className="text-2xl font-bold mt-1">{value}</div></div>
          <div className="p-2 rounded-xl bg-purple-500/20"><Icon size={18} className="text-purple-400" /></div>
        </div>
      </div>
    );
  };

  const ScoreBadge = ({ score }) => {
    if (score >= 80) return <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-400">🔥 Hot</span>;
    if (score >= 60) return <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400">🔵 Warm</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-500/20 text-gray-400">⚪ Cold</span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard icon="Users" label="Total Leads" value={stats.total} />
        <StatCard icon="Flame" label="Hot Leads" value={stats.hot} />
        <StatCard icon="Brain" label="AI Score Avg" value={stats.avgScore} />
        <StatCard icon="TrendingUp" label="Conversion" value="45%" />
      </div>

      <div className="flex gap-3 mb-4">
        <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-purple-500/50 outline-none" />
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 outline-none">
          <option value="">All Status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
        </select>
        {selected.length > 0 && (
          <button onClick={() => { if (confirm('Delete selected?')) bulkDelete(selected); }}
            className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30">Delete {selected.length}</button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5"><tr>
              <th className="px-4 py-3"><input type="checkbox" onChange={() => {
                if (selected.length === filtered.length) setSelected([]);
                else setSelected(filtered.map(l => l._id));
              }} /></th>
              <th className="px-4 py-3 text-left text-gray-400 text-xs">Name</th>
              <th className="px-4 py-3 text-left text-gray-400 text-xs">Email</th>
              <th className="px-4 py-3 text-left text-gray-400 text-xs">Status</th>
              <th className="px-4 py-3 text-left text-gray-400 text-xs">AI Score</th>
              <th className="px-4 py-3 text-right text-gray-400 text-xs">Action</th>
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((lead) => (
                <tr key={lead._id} className="hover:bg-white/5">
                  <td className="px-4 py-3"><input type="checkbox" checked={selected.includes(lead._id)}
                    onChange={() => {
                      if (selected.includes(lead._id)) setSelected(selected.filter(id => id !== lead._id));
                      else setSelected([...selected, lead._id]);
                    }} /></td>
                  <td className="px-4 py-3">{lead.name}</td>
                  <td className="px-4 py-3 text-gray-400">{lead.email}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-white/10">{lead.status}</span></td>
                  <td className="px-4 py-3"><ScoreBadge score={lead.aiScore || 0} /></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { if (confirm('Delete?')) deleteLead(lead._id); }} className="text-red-400 hover:text-red-300">
                      <Lucide.Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Lead Finder Page
const LeadFinder = () => {
  const { bulkSave, showToast } = useApp();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('New York');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!query || !location) { showToast('Enter query & location', 'error'); return; }
    setLoading(true);
    try {
      const res = await API.post('/maps/search', { query, location });
      setResults(res.data.results || []);
      showToast(`Found ${res.data.count} results`);
    } catch (e) { showToast('Search failed', 'error'); }
    setLoading(false);
  };

  const saveSelected = async () => {
    if (!selected.length) { showToast('Select leads first', 'error'); return; }
    const toSave = results.filter(r => selected.includes(r._id)).map(r => ({
      name: r.name,
      email: `contact@${r.website?.replace(/^https?:\/\//, '').split('/')[0] || 'example.com'}`,
      phone: r.phone || '',
      website: r.website || '',
      location: r.address || location,
      rating: r.rating || 0,
      source: 'google_maps',
      status: 'new',
      aiScore: 70
    }));
    await bulkSave(toSave);
    setSelected([]);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500 mb-6">Smart Lead Finder</h1>
      <div className="bg-white/5 p-5 rounded-2xl border border-white/10 mb-6">
        <div className="flex gap-3">
          <input type="text" placeholder="What to search?" value={query} onChange={(e) => setQuery(e.target.value)}
            className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-purple-500/50 outline-none" />
          <input type="text" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)}
            className="w-48 px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-purple-500/50 outline-none" />
          <button onClick={search} disabled={loading}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 disabled:opacity-50">
            {loading ? '...' : 'Search'}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="flex justify-between mb-4">
          <span className="text-sm text-gray-400">{results.length} results</span>
          <button onClick={saveSelected} className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm">
            Save Selected ({selected.length})
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {results.map((r) => (
          <div key={r._id} className="bg-white/5 p-4 rounded-2xl border border-white/10 hover:border-purple-500/30">
            <div className="flex gap-3">
              <input type="checkbox" checked={selected.includes(r._id)}
                onChange={() => {
                  if (selected.includes(r._id)) setSelected(selected.filter(id => id !== r._id));
                  else setSelected([...selected, r._id]);
                }} className="mt-1" />
              <div>
                <h4 className="font-medium">{r.name}</h4>
                <p className="text-xs text-gray-400">{r.address}</p>
                {r.rating && <div className="flex items-center gap-1 mt-1"><Lucide.Star size={12} className="text-yellow-400" /> {r.rating}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Campaign Hub Page
const CampaignHub = () => {
  const { leads, fetchLeads, showToast } = useApp();
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState('whatsapp');

  useEffect(() => { fetchLeads(); }, []);

  const send = async () => {
    if (!selected.length || !message) { showToast('Select leads and enter message', 'error'); return; }
    try {
      await API.post(`/campaign/send/${channel}`, { leadIds: selected, message });
      showToast(`Sent to ${selected.length} leads via ${channel}`);
      setSelected([]);
      setMessage('');
    } catch (e) { showToast('Failed to send', 'error'); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500 mb-6">Campaign Hub</h1>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
          <h3 className="font-medium mb-4">Select Leads ({selected.length})</h3>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {leads.map((lead) => (
              <div key={lead._id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer ${selected.includes(lead._id) ? 'bg-purple-500/20 border border-purple-500/30' : 'hover:bg-white/5'}`}
                onClick={() => {
                  if (selected.includes(lead._id)) setSelected(selected.filter(id => id !== lead._id));
                  else setSelected([...selected, lead._id]);
                }}>
                <input type="checkbox" checked={selected.includes(lead._id)} readOnly />
                <div><div className="text-sm">{lead.name}</div><div className="text-xs text-gray-400">{lead.email}</div></div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
          <h3 className="font-medium mb-4">Composer</h3>
          <div className="flex gap-2 mb-3">
            <button onClick={() => setChannel('whatsapp')} className={`flex-1 py-2 rounded-xl text-sm ${channel === 'whatsapp' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'bg-white/5'}`}>
              <Lucide.MessageCircle size={14} className="inline mr-1" /> WhatsApp
            </button>
            <button onClick={() => setChannel('email')} className={`flex-1 py-2 rounded-xl text-sm ${channel === 'email' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'bg-white/5'}`}>
              <Lucide.Mail size={14} className="inline mr-1" /> Email
            </button>
          </div>
          <textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 outline-none resize-none"
            placeholder={`Type ${channel} message...`} />
          <button onClick={send} className="w-full mt-3 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90">
            Send to {selected.length} leads
          </button>
        </div>
      </div>
    </div>
  );
};

// Email Extractor Page
const EmailExtractor = () => {
  const { bulkSave, showToast } = useApp();
  const [url, setUrl] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);

  const extract = async () => {
    if (!url) { showToast('Enter URL', 'error'); return; }
    setLoading(true);
    try {
      const res = await API.post('/email/extract', { url, deep: true });
      setResults([res.data.data]);
      showToast('Extracted successfully');
    } catch (e) { showToast('Extraction failed', 'error'); }
    setLoading(false);
  };

  const saveSelected = async () => {
    if (!selected.length) { showToast('Select results', 'error'); return; }
    const toSave = results.filter((_, i) => selected.includes(i)).map(r => ({
      name: r.url?.replace(/^https?:\/\//, '').split('/')[0] || 'Unknown',
      email: r.emails?.[0] || '',
      phone: r.phones?.[0] || '',
      website: r.url || '',
      source: 'email_extractor',
      status: 'new',
      aiScore: 70
    }));
    await bulkSave(toSave);
    setSelected([]);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500 mb-6">Email Extractor</h1>
      <div className="bg-white/5 p-5 rounded-2xl border border-white/10 mb-6">
        <div className="flex gap-3">
          <input type="url" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)}
            className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-purple-500/50 outline-none" />
          <button onClick={extract} disabled={loading}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 disabled:opacity-50">
            {loading ? '...' : 'Extract'}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div>
          <div className="flex justify-between mb-4">
            <span className="text-sm text-gray-400">{results.length} results</span>
            <button onClick={saveSelected} className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm">
              Save Selected ({selected.length})
            </button>
          </div>
          <div className="space-y-3">
            {results.map((r, i) => (
              <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <div className="flex gap-3">
                  <input type="checkbox" checked={selected.includes(i)} onChange={() => {
                    if (selected.includes(i)) setSelected(selected.filter(id => id !== i));
                    else setSelected([...selected, i]);
                  }} className="mt-1" />
                  <div className="flex-1">
                    <div className="font-medium">{r.url}</div>
                    {r.emails?.length > 0 && <div className="text-xs text-gray-400">Emails: {r.emails.join(', ')}</div>}
                    {r.phones?.length > 0 && <div className="text-xs text-gray-400">Phones: {r.phones.join(', ')}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============ MAIN APP ============
function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-black text-white">
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 ml-64">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/lead-finder" element={<LeadFinder />} />
                <Route path="/campaign-hub" element={<CampaignHub />} />
                <Route path="/email-extractor" element={<EmailExtractor />} />
              </Routes>
            </div>
          </div>
          <Toast />
        </div>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
