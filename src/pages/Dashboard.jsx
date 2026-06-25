import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../App';
import { motion } from 'framer-motion';
import * as Lucide from 'lucide-react';
import { Dialog, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@radix-ui/react-dialog';

const StatCard = ({ icon, label, value, sub, color = 'purple' }) => {
  const colors = {
    purple: 'bg-purple-500/10 border-purple-500/20',
    pink: 'bg-pink-500/10 border-pink-500/20',
    blue: 'bg-blue-500/10 border-blue-500/20',
    green: 'bg-green-500/10 border-green-500/20',
    orange: 'bg-orange-500/10 border-orange-500/20',
  };
  const Icon = Lucide[icon];
  return (
    <div className={`glass p-5 rounded-2xl border ${colors[color] || colors.purple} hover-glow transition-all`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</div>
          <div className="text-2xl font-bold mt-1">{value}</div>
          {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
        </div>
        <div className={`p-2.5 rounded-xl ${colors[color] || colors.purple}`}>
          <Icon size={18} className="text-purple-400" />
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const config = {
    new: { label: 'New', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    contacted: { label: 'Contacted', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    qualified: { label: 'Qualified', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    proposal: { label: 'Proposal', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    closed: { label: 'Closed', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  };
  const c = config[status] || config.new;
  return <span className={`status-badge border ${c.color}`}>{c.label}</span>;
};

const ScoreBadge = ({ score }) => {
  if (score >= 80) return <span className="status-badge bg-purple-500/20 text-purple-400 border border-purple-500/30">🔥 Hot</span>;
  if (score >= 60) return <span className="status-badge bg-blue-500/20 text-blue-400 border border-blue-500/30">🔵 Warm</span>;
  return <span className="status-badge bg-gray-500/20 text-gray-400 border border-gray-500/30">⚪ Cold</span>;
};

const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-10 h-10 border-3 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
  </div>
);

const EmptyState = ({ icon, title, description }) => {
  const Icon = Lucide[icon];
  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 mx-auto rounded-2xl glass flex items-center justify-center mb-4">
        <Icon size={32} className="text-gray-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-300">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </div>
  );
};

const Dashboard = () => {
  const { leads, loading, stats, fetchLeads, deleteLead, bulkDelete, exportCSV, exportExcel, showToast } = useApp();
  const [selected, setSelected] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    fetchLeads();
  }, []);

  const filtered = useMemo(() => {
    let result = leads;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(l => l.name?.toLowerCase().includes(s) || l.company?.toLowerCase().includes(s) || l.email?.toLowerCase().includes(s));
    }
    if (filterStatus) {
      result = result.filter(l => l.status === filterStatus);
    }
    return result;
  }, [leads, search, filterStatus]);

  const handleSelectAll = () => {
    if (selected.length === filtered.length) setSelected([]);
    else setSelected(filtered.map(l => l._id));
  };

  const handleBulkDelete = () => {
    if (selected.length === 0) return;
    setDeleteTarget({ type: 'bulk', ids: selected });
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (deleteTarget.type === 'bulk') {
      await bulkDelete(deleteTarget.ids);
      setSelected([]);
    } else {
      await deleteLead(deleteTarget.id);
    }
    setShowDeleteModal(false);
    setDeleteTarget(null);
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const lead = leads.find(l => l._id === id);
      await updateLead(id, { ...lead, status: newStatus });
    } catch (e) {
      // handled in context
    }
  };

  const { updateLead } = useApp();

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard icon="Users" label="Total Leads" value={stats.total} color="purple" />
        <StatCard icon="Flame" label="Hot Leads" value={stats.hot} color="pink" />
        <StatCard icon="Brain" label="AI Score Avg" value={stats.avgScore} sub="out of 100" color="blue" />
        <StatCard icon="TrendingUp" label="Conversion Rate" value={`${stats.conversion}%`} color="green" />
        <StatCard icon="MessageCircle" label="Messages Sent" value={stats.messages} color="orange" />
        <StatCard icon="Mail" label="Email Extracted" value={stats.emails} color="purple" />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1 min-w-[200px] relative">
          <Lucide.Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-dark border border-white/5 focus:border-purple-500/50 outline-none text-sm transition"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2.5 rounded-xl glass-dark border border-white/5 focus:border-purple-500/50 outline-none text-sm"
        >
          <option value="">All Status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="proposal">Proposal</option>
          <option value="closed">Closed</option>
        </select>
        {selected.length > 0 && (
          <button
            onClick={handleBulkDelete}
            className="px-4 py-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition text-sm flex items-center gap-2"
          >
            <Lucide.Trash2 size={16} />
            Delete {selected.length}
          </button>
        )}
        <button onClick={exportCSV} className="px-4 py-2.5 rounded-xl glass-dark hover:bg-white/5 transition text-sm flex items-center gap-2">
          <Lucide.FileText size={16} /> CSV
        </button>
        <button onClick={exportExcel} className="px-4 py-2.5 rounded-xl glass-dark hover:bg-white/5 transition text-sm flex items-center gap-2">
          <Lucide.FileSpreadsheet size={16} /> Excel
        </button>
      </div>

      {/* Table */}
      {loading ? <LoadingSpinner /> : (
        <div className="glass rounded-2xl overflow-hidden border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selected.length === filtered.length && filtered.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-white/10 bg-transparent"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Company</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">AI Score</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">Source</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-400 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-12 text-center text-gray-500">
                      <EmptyState icon="Inbox" title="No leads found" description="Start by finding leads or importing from sources." />
                    </td>
                  </tr>
                ) : (
                  filtered.map((lead) => (
                    <tr key={lead._id} className="hover:bg-white/5 transition">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(lead._id)}
                          onChange={() => {
                            if (selected.includes(lead._id)) setSelected(selected.filter(id => id !== lead._id));
                            else setSelected([...selected, lead._id]);
                          }}
                          className="rounded border-white/10 bg-transparent"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">{lead.name || 'N/A'}</td>
                      <td className="px-4 py-3 text-gray-400">{lead.email || '—'}</td>
                      <td className="px-4 py-3 text-gray-400">{lead.company || '—'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={lead.status || 'new'}
                          onChange={(e) => handleStatusChange(lead._id, e.target.value)}
                          className="bg-transparent border-none outline-none text-sm cursor-pointer"
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="qualified">Qualified</option>
                          <option value="proposal">Proposal</option>
                          <option value="closed">Closed</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBadge score={lead.aiScore || 0} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{lead.source || 'manual'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setDeleteTarget({ type: 'single', id: lead._id });
                            setShowDeleteModal(true);
                          }}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition"
                        >
                          <Lucide.Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <DialogContent className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md glass rounded-2xl p-6 border border-white/10 slide-in">
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Lucide.AlertTriangle size={20} className="text-red-400" />
              Confirm Delete
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-sm mt-2">
              {deleteTarget?.type === 'bulk'
                ? `Are you sure you want to delete ${deleteTarget.ids.length} leads? This action cannot be undone.`
                : 'Are you sure you want to delete this lead? This action cannot be undone.'}
            </DialogDescription>
            <div className="flex gap-3 mt-6">
              <DialogClose className="flex-1 px-4 py-2.5 rounded-xl glass-dark hover:bg-white/5 transition text-sm">
                Cancel
              </DialogClose>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 transition text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  );
};

export default Dashboard;
