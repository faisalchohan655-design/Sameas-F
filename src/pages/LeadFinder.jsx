import React, { useState } from 'react';
import { useApp } from '../App';
import * as Lucide from 'lucide-react';

const LeadFinder = () => {
  const { bulkSave, showToast } = useApp();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('New York, NY');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [activeTab, setActiveTab] = useState('google');

  const handleSearch = async () => {
    if (!query || !location) {
      showToast('Please enter both search query and location', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/maps/search', {
        query,
        location,
        filters: { minRating: 4.0 }
      });
      setResults(res.data.results || []);
      showToast(`Found ${res.data.count} leads`);
    } catch (e) {
      showToast(e.response?.data?.message || 'Search failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSelected = async () => {
    if (selected.length === 0) {
      showToast('No leads selected', 'error');
      return;
    }
    const toSave = results.filter(r => selected.includes(r._id || r.name)).map(r => ({
      name: r.name,
      company: r.name,
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
      aiTags: ['Google Maps', 'Verified'],
    }));
    try {
      await bulkSave(toSave);
      setSelected([]);
    } catch (e) {
      // handled in context
    }
  };

  const toggleSelect = (id) => {
    if (selected.includes(id)) setSelected(selected.filter(s => s !== id));
    else setSelected([...selected, id]);
  };

  const selectAll = () => {
    if (selected.length === results.length) setSelected([]);
    else setSelected(results.map(r => r._id || r.name));
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold gradient-text mb-6">Smart Lead Finder</h1>

      {/* Search */}
      <div className="glass p-5 rounded-2xl border border-white/5 mb-6">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="What are you looking for? (e.g., restaurants, plumbers)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl glass-dark border border-white/5 focus:border-purple-500/50 outline-none text-sm"
          />
          <input
            type="text"
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-48 px-4 py-2.5 rounded-xl glass-dark border border-white/5 focus:border-purple-500/50 outline-none text-sm"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl gradient-bg text-white font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Lucide.Search size={16} /> Search</>}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {['google', 'linkedin', 'facebook', 'instagram', 'twitter'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${activeTab === tab
                ? 'glass text-white border border-purple-500/30'
                : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
          >
            <span className="capitalize">{tab}</span>
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 border-3 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {results.length > 0 && (
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-400">{results.length} results found</span>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="px-3 py-1.5 rounded-lg glass-dark hover:bg-white/5 transition text-xs"
                >
                  {selected.length === results.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  onClick={handleSaveSelected}
                  className="px-3 py-1.5 rounded-lg gradient-bg text-white text-xs font-medium hover:opacity-90 transition"
                >
                  Save Selected ({selected.length})
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((result, idx) => {
              const id = result._id || result.name + idx;
              return (
                <div key={idx} className="glass p-4 rounded-2xl border border-white/5 hover:border-purple-500/30 transition group">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(id)}
                      onChange={() => toggleSelect(id)}
                      className="mt-1 rounded border-white/10 bg-transparent"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{result.name}</h4>
                      <p className="text-xs text-gray-400 truncate">{result.address || 'No address'}</p>
                      {result.rating && (
                        <div className="flex items-center gap-1 mt-1">
                          <Lucide.Star size={12} className="text-yellow-400 fill-yellow-400" />
                          <span className="text-xs text-gray-300">{result.rating}</span>
                          {result.reviews && <span className="text-xs text-gray-500">({result.reviews})</span>}
                        </div>
                      )}
                      {result.website && (
                        <a href={result.website} target="_blank" className="text-xs text-purple-400 hover:underline block truncate mt-1">
                          {result.website.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {result.categories?.slice(0, 3).map((cat, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full glass-dark text-gray-400">
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {results.length === 0 && !loading && (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto rounded-2xl glass flex items-center justify-center mb-4">
                <Lucide.Search size={32} className="text-gray-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-300">No results</h3>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your search query or location.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LeadFinder;
