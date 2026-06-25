import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import * as Lucide from 'lucide-react';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';

// ============ API ============
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
  const [stats, setStats] = useState({ total: 0, hot: 0, avgScore: 0, contacted: 0, qualified: 0 });
  const [toast, setToast] = useState(null);
  const [campaigns, setCampaigns] = useState([]);

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
      const contacted = res.data.filter(l => l.status === 'contacted').length;
      const qualified = res.data.filter(l => l.status === 'qualified').length;
      setStats({ total, hot, avgScore: avg, contacted, qualified });
    } catch (e) {
      showToast('Failed to fetch leads', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await API.get('/campaign/history');
      setCampaigns(res.data || []);
    } catch (e) {}
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

  const updateLead = async (id, data) => {
    try {
      const res = await API.put(`/leads/${id}`, data);
      await fetchLeads();
      showToast('Lead updated');
      return res.data;
    } catch (e) {
      showToast('Failed to update lead', 'error');
    }
  };

  const aiScoreAll = async () => {
    setLoading(true);
    let scored = 0;
    for (const lead of leads) {
      try {
        await API.post('/ai/score', { leadId: lead._id });
        scored++;
      } catch (e) {}
    }
    await fetchLeads();
    showToast(`AI scored ${scored} leads`);
    setLoading(false);
  };

  const exportExcel = () => {
    const data = leads.map(l => ({
      Name: l.name || '',
      Email: l.email || '',
      Company: l.company || '',
      Phone: l.phone || '',
      Website: l.website || '',
      Location: l.location || '',
      Status: l.status || 'new',
      'AI Score': l.aiScore || 0,
      'Created At': new Date(l.createdAt).toLocaleDateString()
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, `leads_${Date.now()}.xlsx`);
    showToast('Excel exported!');
  };

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Company', 'Phone', 'Website', 'Location', 'Status', 'AI Score'];
    const rows = leads.map(l => [
      l.name || '', l.email || '', l.company || '', l.phone || '',
      l.website || '', l.location || '', l.status || 'new', l.aiScore || 0
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_${Date.now()}.csv`;
    a.click();
    showToast('CSV exported!');
  };

  return (
    <AppContext.Provider value={{
      leads, loading, stats, campaigns, toast, showToast, fetchLeads, fetchCampaigns,
      bulkSave, bulkDelete, deleteLead, createLead, updateLead, aiScoreAll,
      exportExcel, exportCSV
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

// ============ DASHBOARD PAGE ============
const Dashboard = () => {
  const { leads, loading, stats, fetchLeads, deleteLead, bulkDelete, aiScoreAll, exportExcel, exportCSV } = useApp();
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showCharts, setShowCharts] = useState(true);

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

  const StatCard = ({ icon, label, value, color = 'purple' }) => {
    const Icon = Lucide[icon];
    const colors = {
      purple: 'bg-purple-500/20 border-purple-500/30',
      pink: 'bg-pink-500/20 border-pink-500/30',
      blue: 'bg-blue-500/20 border-blue-500/30',
      green: 'bg-green-500/20 border-green-500/30',
      orange: 'bg-orange-500/20 border-orange-500/30'
    };
    return (
      <div className={`p-5 rounded-2xl border ${colors[color] || colors.purple}`}>
        <div className="flex justify-between">
          <div><div className="text-xs text-gray-400">{label}</div><div className="text-2xl font-bold mt-1">{value}</div></div>
          <div className={`p-2 rounded-xl ${colors[color] || colors.purple}`}><Icon size={18} className="text-purple-400" /></div>
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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard icon="Users" label="Total Leads" value={stats.total} color="purple" />
        <StatCard icon="Flame" label="Hot Leads" value={stats.hot} color="pink" />
        <StatCard icon="Brain" label="AI Score Avg" value={stats.avgScore} color="blue" />
        <StatCard icon="MessageCircle" label="Contacted" value={stats.contacted} color="orange" />
        <StatCard icon="CheckCircle" label="Qualified" value={stats.qualified} color="green" />
      </div>

      {/* Charts Section */}
      {showCharts && (
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Lead Status Distribution</h3>
            <div className="flex items-center justify-center h-48">
              <div className="flex flex-wrap gap-4">
                {['New', 'Contacted', 'Qualified', 'Proposal', 'Closed'].map((s) => (
                  <div key={s} className="text-center">
                    <div className="text-2xl font-bold">{leads.filter(l => l.status === s.toLowerCase()).length}</div>
                    <div className="text-xs text-gray-400">{s}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Quick Stats</h3>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-gray-400">Total</span><span className="font-bold">{stats.total}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Hot Leads</span><span className="font-bold text-purple-400">{stats.hot}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Avg Score</span><span className="font-bold text-blue-400">{stats.avgScore}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Conversion</span><span className="font-bold text-green-400">{stats.total ? Math.round((stats.qualified / stats.total) * 100) : 0}%</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[200px] relative">
          <Lucide.Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-purple-500/50 outline-none" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 outline-none">
          <option value="">All Status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="proposal">Proposal</option>
          <option value="closed">Closed</option>
        </select>
        <button onClick={aiScoreAll} disabled={loading}
          className="px-4 py-2 rounded-xl bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition text-sm flex items-center gap-2 disabled:opacity-50">
          <Lucide.Brain size={16} /> AI Score All
        </button>
        <button onClick={exportExcel} className="px-4 py-2 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 transition text-sm flex items-center gap-2">
          <Lucide.FileSpreadsheet size={16} /> Excel
        </button>
        <button onClick={exportCSV} className="px-4 py-2 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition text-sm flex items-center gap-2">
          <Lucide.FileText size={16} /> CSV
        </button>
        {selected.length > 0 && (
          <button onClick={() => { if (confirm('Delete selected?')) bulkDelete(selected); }}
            className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition text-sm flex items-center gap-2">
            <Lucide.Trash2 size={16} /> Delete {selected.length}
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5"><tr>
                <th className="px-4 py-3"><input type="checkbox" onChange={() => {
                  if (selected.length === filtered.length) setSelected([]);
                  else setSelected(filtered.map(l => l._id));
                }} /></th>
                <th className="px-4 py-3 text-left text-gray-400 text-xs">Name</th>
                <th className="px-4 py-3 text-left text-gray-400 text-xs">Email</th>
                <th className="px-4 py-3 text-left text-gray-400 text-xs">Company</th>
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
                    <td className="px-4 py-3 font-medium">{lead.name || 'N/A'}</td>
                    <td className="px-4 py-3 text-gray-400">{lead.email || '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{lead.company || '—'}</td>
                    <td className="px-4 py-3">
                      <select value={lead.status || 'new'} onChange={async (e) => {
                        await updateLead(lead._id, { ...lead, status: e.target.value });
                      }} className="bg-transparent border-none outline-none text-sm cursor-pointer">
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="qualified">Qualified</option>
                        <option value="proposal">Proposal</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
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
        </div>
      )}
    </div>
  );
};

// ============ LEAD FINDER PAGE ============
const LeadFinder = () => {
  const { bulkSave, showToast } = useApp();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('New York');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ industry: '', minRating: 0 });
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const pageSize = 6;

  const search = async () => {
    if (!query || !location) { showToast('Enter query & location', 'error'); return; }
    setLoading(true);
    try {
      const res = await API.post('/maps/search', { query, location, filters, page, pageSize });
      setResults(res.data.results || []);
      setTotalResults(res.data.count || res.data.results?.length || 0);
      showToast(`Found ${res.data.count || res.data.results?.length || 0} results`);
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
      reviews: r.reviews || 0,
      categories: r.categories || [],
      source: 'google_maps',
      status: 'new',
      aiScore: Math.floor(Math.random() * 40) + 60,
      aiTags: ['Google Maps', 'Verified']
    }));
    await bulkSave(toSave);
    setSelected([]);
  };

  useEffect(() => { search(); }, [page]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500 mb-6">Smart Lead Finder</h1>
      
      {/* Search */}
      <div className="bg-white/5 p-5 rounded-2xl border border-white/10 mb-6">
        <div className="flex flex-wrap gap-3">
          <input type="text" placeholder="What to search?" value={query} onChange={(e) => setQuery(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-purple-500/50 outline-none" />
          <input type="text" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)}
            className="w-48 px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-purple-500/50 outline-none" />
          <button onClick={search} disabled={loading}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 disabled:opacity-50">
            {loading ? '...' : 'Search'}
          </button>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mt-3">
          <input type="text" placeholder="Industry filter..." value={filters.industry} 
            onChange={(e) => setFilters({...filters, industry: e.target.value})}
            className="flex-1 min-w-[150px] px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-purple-500/50 outline-none text-sm" />
          <select value={filters.minRating} onChange={(e) => setFilters({...filters, minRating: parseFloat(e.target.value)})}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 outline-none text-sm">
            <option value={0}>Min Rating: Any</option>
            <option value={4.0}>4.0+</option>
            <option value={4.5}>4.5+</option>
          </select>
          <button onClick={search} className="px-4 py-2 rounded-xl bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition text-sm">
            Apply Filters
          </button>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <span className="text-sm text-gray-400">{totalResults} results found</span>
          <div className="flex gap-2">
            <button onClick={() => {
              if (selected.length === results.length) setSelected([]);
              else setSelected(results.map(r => r._id));
            }} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition text-xs">
              {selected.length === results.length ? 'Deselect All' : 'Select All'}
            </button>
            <button onClick={saveSelected} className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm">
              Save Selected ({selected.length})
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((r) => (
          <div key={r._id} className="bg-white/5 p-4 rounded-2xl border border-white/10 hover:border-purple-500/30 transition group">
            <div className="flex gap-3">
              <input type="checkbox" checked={selected.includes(r._id)}
                onChange={() => {
                  if (selected.includes(r._id)) setSelected(selected.filter(id => id !== r._id));
                  else setSelected([...selected, r._id]);
                }} className="mt-1" />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate">{r.name}</h4>
                <p className="text-xs text-gray-400 truncate">{r.address || 'No address'}</p>
                {r.rating && <div className="flex items-center gap-1 mt-1"><Lucide.Star size={12} className="text-yellow-400" /> {r.rating}</div>}
                {r.website && <a href={r.website} target="_blank" className="text-xs text-purple-400 hover:underline block truncate">{r.website}</a>}
                {r.categories && r.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {r.categories.slice(0, 2).map((c, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5">{c}</span>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalResults > pageSize && (
        <div className="flex justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
            className="px-4 py-2 rounded-xl bg-white/5 disabled:opacity-50 hover:bg-white/10 transition">
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-gray-400">Page {page} of {Math.ceil(totalResults/pageSize)}</span>
          <button onClick={() => setPage(p => p+1)} disabled={page >= Math.ceil(totalResults/pageSize)}
            className="px-4 py-2 rounded-xl bg-white/5 disabled:opacity-50 hover:bg-white/10 transition">
            Next
          </button>
        </div>
      )}
    </div>
  );
};

// ============ CAMPAIGN HUB PAGE ============
const CampaignHub = () => {
  const { leads, fetchLeads, showToast } = useApp();
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [sending, setSending] = useState(false);

  const templates = {
    welcome: {
      label: 'Welcome',
      subject: 'Welcome to {{company}}!',
      message: `Hi {{name}},\n\nWelcome to {{company}}! We're excited to have you on board.\n\nBest regards,\nThe Team`
    },
    followup: {
      label: 'Follow-up',
      subject: 'Following up with {{company}}',
      message: `Hi {{name}},\n\nI wanted to follow up on our recent conversation. Do you have any questions?\n\nBest,\nThe Team`
    },
    proposal: {
      label: 'Proposal',
      subject: 'Proposal for {{company}}',
      message: `Hi {{name}},\n\nHere's the proposal we discussed for {{company}}. Let me know your thoughts.\n\nBest,\nThe Team`
    },
    closing: {
      label: 'Closing',
      subject: 'Closing with {{company}}',
      message: `Hi {{name}},\n\nI'd love to finalize our agreement with {{company}}. When are you available?\n\nBest,\nThe Team`
    },
    newsletter: {
      label: 'Newsletter',
      subject: 'Monthly Newsletter',
      message: `Hi {{name}},\n\nHere's our latest newsletter. We hope you find it valuable!\n\nBest,\nThe Team`
    }
  };

  useEffect(() => { fetchLeads(); }, []);

  const applyTemplate = (key) => {
    const t = templates[key];
    if (t) {
      setSelectedTemplate(key);
      setSubject(t.subject);
      setMessage(t.message);
    }
  };

  const send = async () => {
    if (!selected.length || !message) { showToast('Select leads and enter message', 'error'); return; }
    setSending(true);
    try {
      await API.post(`/campaign/send/${channel}`, { leadIds: selected, message, subject });
      showToast(`Sent to ${selected.length} leads via ${channel}`);
      setSelected([]);
      setMessage('');
      setSubject('');
      setSelectedTemplate('');
    } catch (e) { showToast('Failed to send', 'error'); }
    setSending(false);
  };

  // Campaign stats
  const stats = {
    total: leads.length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    qualified: leads.filter(l => l.status === 'qualified').length
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500 mb-6">Campaign Hub</h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white/5 p-4 rounded-xl border border-white/10">
          <div className="text-xs text-gray-400">Total Leads</div>
          <div className="text-xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-white/5 p-4 rounded-xl border border-white/10">
          <div className="text-xs text-gray-400">Contacted</div>
          <div className="text-xl font-bold text-yellow-400">{stats.contacted}</div>
        </div>
        <div className="bg-white/5 p-4 rounded-xl border border-white/10">
          <div className="text-xs text-gray-400">Qualified</div>
          <div className="text-xl font-bold text-green-400">{stats.qualified}</div>
        </div>
        <div className="bg-white/5 p-4 rounded-xl border border-white/10">
          <div className="text-xs text-gray-400">Conversion Rate</div>
          <div className="text-xl font-bold text-purple-400">{stats.total ? Math.round((stats.qualified / stats.total) * 100) : 0}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Selection */}
        <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
          <h3 className="font-medium mb-4">Select Leads ({selected.length})</h3>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {leads.map((lead) => (
              <div key={lead._id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition ${selected.includes(lead._id) ? 'bg-purple-500/20 border border-purple-500/30' : 'hover:bg-white/5'}`}
                onClick={() => {
                  if (selected.includes(lead._id)) setSelected(selected.filter(id => id !== lead._id));
                  else setSelected([...selected, lead._id]);
                }}>
                <input type="checkbox" checked={selected.includes(lead._id)} readOnly />
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{lead.name || 'N/A'}</div>
                  <div className="text-xs text-gray-400">{lead.email || lead.phone || 'No contact'}</div>
                </div>
                {lead.aiScore >= 80 ? <span className="text-xs text-purple-400">🔥</span> : lead.aiScore >= 60 ? <span className="text-xs text-blue-400">🔵</span> : <span className="text-xs text-gray-400">⚪</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Composer */}
        <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
          <h3 className="font-medium mb-4">Composer</h3>
          
          <div className="flex gap-2 mb-3">
            <button onClick={() => setChannel('whatsapp')} className={`flex-1 py-2 rounded-xl text-sm transition ${channel === 'whatsapp' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'bg-white/5 hover:bg-white/10'}`}>
              <Lucide.MessageCircle size={14} className="inline mr-1" /> WhatsApp
            </button>
            <button onClick={() => setChannel('email')} className={`flex-1 py-2 rounded-xl text-sm transition ${channel === 'email' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'bg-white/5 hover:bg-white/10'}`}>
              <Lucide.Mail size={14} className="inline mr-1" /> Email
            </button>
          </div>

          {/* Templates */}
          <select value={selectedTemplate} onChange={(e) => applyTemplate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 outline-none text-sm mb-3">
            <option value="">Select Template</option>
            {Object.entries(templates).map(([key, t]) => (
              <option key={key} value={key}>{t.label}</option>
            ))}
          </select>

          {channel === 'email' && (
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject"
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-purple-500/50 outline-none text-sm mb-3" />
          )}

          <textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 outline-none resize-none text-sm"
            placeholder={`Type ${channel} message...`} />

          <div className="text-xs text-gray-500 text-center mt-2">
            Variables: {'{{name}}'}, {'{{company}}'}, {'{{industry}}'}, {'{{rating}}'}
          </div>

          <button onClick={send} disabled={!selected.length || !message || sending}
            className="w-full mt-3 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Lucide.Send size={16} /> Send to {selected.length} leads</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ EMAIL EXTRACTOR PAGE ============
const EmailExtractor = () => {
  const { bulkSave, showToast } = useApp();
  const [url, setUrl] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [bulkUrls, setBulkUrls] = useState([]);

  const extract = async () => {
    if (!url) { showToast('Enter URL', 'error'); return; }
    setLoading(true);
    try {
      const res = await API.post('/email/extract', { url, deep: true });
      const data = res.data.data;
      if (Array.isArray(data)) {
        setResults(data);
      } else {
        setResults([data]);
      }
      setProgress(100);
      showToast('Extracted successfully');
    } catch (e) { showToast('Extraction failed', 'error'); }
    setLoading(false);
  };

  const handleBulkUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = XLSX.read(ev.target.result, { type: 'array' });
        const sheet = data.Sheets[data.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);
        const urls = json.map(row => row.URL || row.url || row.website || Object.values(row)[0]).filter(Boolean);
        setBulkUrls(urls);
        showToast(`Loaded ${urls.length} URLs`);
      } catch (err) { showToast('Failed to parse file', 'error'); }
    };
    reader.readAsArrayBuffer(file);
  };

  const extractBulk = async () => {
    if (!bulkUrls.length) { showToast('Upload URLs first', 'error'); return; }
    setLoading(true);
    setProgress(0);
    const allResults = [];
    for (let i = 0; i < Math.min(bulkUrls.length, 100); i++) {
      try {
        const res = await API.post('/email/extract', { url: bulkUrls[i] });
        allResults.push(res.data.data);
        setProgress(Math.round(((i + 1) / Math.min(bulkUrls.length, 100)) * 100));
      } catch (e) {}
    }
    setResults(allResults);
    setLoading(false);
    showToast(`Extracted ${allResults.length} URLs`);
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
      aiScore: 70,
      aiTags: ['Email Extracted']
    }));
    await bulkSave(toSave);
    setSelected([]);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500 mb-6">Email Extractor</h1>

      {/* Single URL */}
      <div className="bg-white/5 p-5 rounded-2xl border border-white/10 mb-6">
        <h3 className="font-medium mb-3">Single URL</h3>
        <div className="flex gap-3">
          <input type="url" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)}
            className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-purple-500/50 outline-none" />
          <button onClick={extract} disabled={loading || !url}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 disabled:opacity-50">
            {loading ? '...' : 'Extract'}
          </button>
        </div>
      </div>

      {/* Bulk Upload */}
      <div className="bg-white/5 p-5 rounded-2xl border border-white/10 mb-6">
        <h3 className="font-medium mb-3">Bulk Upload</h3>
        <div className="flex flex-wrap gap-3">
          <label className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl bg-white/5 border border-dashed border-white/10 hover:border-purple-500/30 transition cursor-pointer text-center text-sm text-gray-400">
            <Lucide.Upload size={16} className="inline mr-2" />
            Upload Excel/CSV
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleBulkUpload} className="hidden" />
          </label>
          <button onClick={extractBulk} disabled={loading || !bulkUrls.length}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 disabled:opacity-50">
            Extract All ({bulkUrls.length})
          </button>
        </div>
        {bulkUrls.length > 0 && <div className="text-xs text-gray-400 mt-2">{bulkUrls.length} URLs loaded</div>}
        
        {/* Progress */}
        {loading && (
          <div className="mt-3">
            <div className="flex justify-between text-sm text-gray-400 mb-1">
              <span>Extracting...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <span className="text-sm text-gray-400">{results.length} results</span>
            <div className="flex gap-2">
              <button onClick={() => {
                if (selected.length === results.length) setSelected([]);
                else setSelected(results.map((_, i) => i));
              }} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition text-xs">
                {selected.length === results.length ? 'Deselect All' : 'Select All'}
              </button>
              <button onClick={saveSelected} className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm">
                Save Selected ({selected.length})
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {results.map((r, i) => (
              <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/10 hover:border-purple-500/30 transition">
                <div className="flex gap-3">
                  <input type="checkbox" checked={selected.includes(i)} onChange={() => {
                    if (selected.includes(i)) setSelected(selected.filter(id => id !== i));
                    else setSelected([...selected, i]);
                  }} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.url || 'N/A'}</div>
                    {r.emails && r.emails.length > 0 && (
                      <div className="mt-1">
                        <div className="text-xs text-gray-400">Emails:</div>
                        {r.emails.slice(0, 3).map((email, j) => (
                          <div key={j} className="text-xs text-purple-400 truncate">{email}</div>
                        ))}
                      </div>
                    )}
                    {r.phones && r.phones.length > 0 && (
                      <div className="mt-1">
                        <div className="text-xs text-gray-400">Phones:</div>
                        {r.phones.slice(0, 2).map((phone, j) => (
                          <div key={j} className="text-xs text-gray-300 truncate">{phone}</div>
                        ))}
                      </div>
                    )}
                    {r.socialLinks && Object.keys(r.socialLinks).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {Object.entries(r.socialLinks).map(([platform, link]) => link && (
                          <a key={platform} href={link} target="_blank" className="text-[10px] text-purple-400 hover:underline">{platform}</a>
                        ))}
                      </div>
                    )}
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
