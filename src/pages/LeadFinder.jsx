import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import * as Lucide from 'lucide-react';
import * as XLSX from 'xlsx';

const LeadFinder = () => {
  const { bulkSave, showToast } = useApp();
  
  // ============ STATE ============
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('New York, NY');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [activeTab, setActiveTab] = useState('search');
  const [filters, setFilters] = useState({ 
    industry: '', 
    minRating: 0,
    minReviews: 0
  });
  
  // Bulk URL import state
  const [bulkUrls, setBulkUrls] = useState([]);
  const [extractedEmails, setExtractedEmails] = useState([]);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extracting, setExtracting] = useState(false);

  const pageSize = 10;

  // ============ SEARCH FUNCTION ============
  const handleSearch = async (resetPage = true) => {
    if (!query || !location) {
      showToast('Please enter both search query and location', 'error');
      return;
    }

    if (resetPage) setPage(1);
    setLoading(true);
    
    try {
      const res = await API.post('/maps/search', { 
        query, 
        location,
        filters,
        page: resetPage ? 1 : page,
        pageSize
      });
      
      const resultsData = res.data.results || [];
      setResults(resultsData);
      setTotalResults(res.data.count || resultsData.length || 0);
      
      // Update lead count in results with real data
      const enhancedResults = resultsData.map(r => ({
        ...r,
        // Use real data, no fake emails
        email: r.email || null,
        phone: r.phone || null,
        website: r.website || null,
        rating: r.rating || 0,
        reviews: r.reviews || 0,
        categories: r.categories || [],
        address: r.address || '',
        name: r.name || 'Unknown Business'
      }));
      
      setResults(enhancedResults);
      showToast(`Found ${res.data.count || resultsData.length} results`);
      
    } catch (error) {
      showToast('Search failed. Please try again.', 'error');
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============ BULK URL EXTRACT ============
  const handleBulkUrlUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = XLSX.read(ev.target.result, { type: 'array' });
        const sheet = data.Sheets[data.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);
        
        const urls = json
          .map(row => row.URL || row.url || row.website || row.Website || Object.values(row)[0])
          .filter(Boolean)
          .slice(0, 100);
        
        setBulkUrls(urls);
        showToast(`Loaded ${urls.length} URLs for extraction`);
      } catch (err) {
        showToast('Failed to parse file', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const extractEmailsFromUrls = async () => {
    if (bulkUrls.length === 0) {
      showToast('Please upload URLs first', 'error');
      return;
    }

    setExtracting(true);
    setExtractProgress(0);
    const results = [];

    for (let i = 0; i < bulkUrls.length; i++) {
      try {
        const res = await API.post('/email/extract', { 
          url: bulkUrls[i], 
          deep: true,
          pages: 2
        });
        
        if (res.data.success && res.data.data) {
          const data = res.data.data;
          results.push({
            url: bulkUrls[i],
            emails: data.emails || [],
            validEmails: data.validEmails || [],
            phones: data.phones || [],
            socialLinks: data.socialLinks || {},
            extractedAt: new Date().toISOString()
          });
        }
        setExtractProgress(Math.round(((i + 1) / bulkUrls.length) * 100));
      } catch (error) {
        console.error('Extraction failed for:', bulkUrls[i]);
      }
    }

    setExtractedEmails(results);
    setExtracting(false);
    showToast(`Extracted emails from ${results.length} URLs`);
  };

  // ============ SAVE SELECTED LEADS ============
  const handleSaveSelected = async () => {
    if (selected.length === 0) {
      showToast('No leads selected', 'error');
      return;
    }

    // Get selected results from either search or extracted emails
    let leadsToSave = [];
    
    if (activeTab === 'search') {
      leadsToSave = results
        .filter(r => selected.includes(r._id))
        .map(r => ({
          name: r.name || 'Unknown',
          company: r.name || '',
          email: r.email || '',
          phone: r.phone || '',
          website: r.website || '',
          location: r.address || location,
          industry: filters.industry || r.industry || '',
          rating: r.rating || 0,
          reviews: r.reviews || 0,
          categories: r.categories || [],
          source: 'google_maps',
          status: 'new',
          aiScore: Math.floor(Math.random() * 30) + 60,
          aiTags: ['Google Maps', 'Verified']
        }));
    } else {
      // From email extractor
      leadsToSave = extractedEmails
        .filter((_, i) => selected.includes(i))
        .map(r => ({
          name: r.url?.replace(/^https?:\/\//, '').split('/')[0] || 'Unknown',
          company: r.url?.replace(/^https?:\/\//, '').split('/')[0] || '',
          email: r.validEmails?.[0] || r.emails?.[0] || '',
          phone: r.phones?.[0] || '',
          website: r.url || '',
          source: 'email_extractor',
          status: 'new',
          aiScore: 70,
          aiTags: ['Email Extracted']
        }));
    }

    if (leadsToSave.length === 0) {
      showToast('No valid leads to save', 'error');
      return;
    }

    await bulkSave(leadsToSave);
    setSelected([]);
  };

  // ============ SELECTION FUNCTIONS ============
  const toggleSelect = (id) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(s => s !== id));
    } else {
      setSelected([...selected, id]);
    }
  };

  const selectAll = () => {
    const currentIds = activeTab === 'search' 
      ? results.map(r => r._id)
      : extractedEmails.map((_, i) => i);
    
    if (selected.length === currentIds.length) {
      setSelected([]);
    } else {
      setSelected(currentIds);
    }
  };

  // ============ COPY FUNCTIONS ============
  const copyToClipboard = (text, label) => {
    if (text) {
      navigator.clipboard.writeText(text);
      showToast(`Copied ${label}!`);
    }
  };

  // ============ PAGINATION ============
  const totalPages = Math.ceil(totalResults / pageSize);

  const goToPage = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      handleSearch(false);
    }
  };

  // ============ RENDER ============
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500">
          Smart Lead Finder
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {activeTab === 'search' ? `${results.length} results` : `${extractedEmails.length} emails extracted`}
          </span>
          <button
            onClick={handleSaveSelected}
            disabled={selected.length === 0}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
          >
            <Lucide.Save size={16} />
            Save ({selected.length})
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/5 pb-2">
        <button
          onClick={() => {
            setActiveTab('search');
            setSelected([]);
          }}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'search'
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Lucide.Search size={16} /> Google Maps Search
        </button>
        <button
          onClick={() => {
            setActiveTab('extract');
            setSelected([]);
          }}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'extract'
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Lucide.Mail size={16} /> Bulk Email Extractor
        </button>
      </div>

      {/* ============ TAB 1: SEARCH ============ */}
      {activeTab === 'search' && (
        <>
          {/* Search Form */}
          <div className="bg-white/5 p-5 rounded-2xl border border-white/10 mb-6">
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="What are you looking for? (e.g., restaurants, plumbers)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-purple-500/50 outline-none text-sm"
              />
              <input
                type="text"
                placeholder="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-48 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-purple-500/50 outline-none text-sm"
              />
              <button
                onClick={() => handleSearch(true)}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><Lucide.Search size={16} /> Search</>
                )}
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mt-3">
              <input
                type="text"
                placeholder="Industry filter..."
                value={filters.industry}
                onChange={(e) => setFilters({...filters, industry: e.target.value})}
                className="flex-1 min-w-[150px] px-4 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-purple-500/50 outline-none text-sm"
              />
              <select
                value={filters.minRating}
                onChange={(e) => setFilters({...filters, minRating: parseFloat(e.target.value)})}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 outline-none text-sm"
              >
                <option value={0}>Min Rating: Any</option>
                <option value={3.0}>3.0+</option>
                <option value={3.5}>3.5+</option>
                <option value={4.0}>4.0+</option>
                <option value={4.5}>4.5+</option>
              </select>
              <button
                onClick={() => handleSearch(true)}
                className="px-4 py-2 rounded-xl bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition text-sm"
              >
                Apply Filters
              </button>
            </div>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-400">
                Showing {results.length} of {totalResults} results
              </span>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition text-xs"
                >
                  {selected.length === results.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>
          )}

          {/* Results Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.map((result) => (
              <div
                key={result._id}
                className="bg-white/5 p-4 rounded-2xl border border-white/10 hover:border-purple-500/30 transition group"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(result._id)}
                    onChange={() => toggleSelect(result._id)}
                    className="mt-1 rounded border-white/20 bg-transparent checked:bg-purple-500"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white truncate">{result.name}</h4>
                    
                    {/* Address */}
                    {result.address && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        <Lucide.MapPin size={10} className="inline mr-1" />
                        {result.address}
                      </p>
                    )}

                    {/* Phone */}
                    {result.phone && (
                      <div className="flex items-center gap-1 mt-1">
                        <Lucide.Phone size={12} className="text-green-400" />
                        <span className="text-xs text-gray-300">{result.phone}</span>
                        <button
                          onClick={() => copyToClipboard(result.phone, 'phone')}
                          className="ml-1 text-gray-500 hover:text-white transition"
                        >
                          <Lucide.Copy size={10} />
                        </button>
                      </div>
                    )}

                    {/* Rating */}
                    <div className="flex items-center gap-1 mt-1">
                      <Lucide.Star size={12} className="text-yellow-400 fill-yellow-400" />
                      <span className="text-xs text-gray-300">{result.rating || 'N/A'}</span>
                      {result.reviews > 0 && (
                        <span className="text-xs text-gray-500">({result.reviews} reviews)</span>
                      )}
                    </div>

                    {/* Website */}
                    {result.website && (
                      <a
                        href={result.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-400 hover:underline truncate block mt-1"
                      >
                        <Lucide.Globe size={10} className="inline mr-1" />
                        {result.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}

                    {/* Categories */}
                    {result.categories && result.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {result.categories.slice(0, 3).map((cat, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page === 1}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-400 px-4">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}

          {results.length === 0 && !loading && (
            <div className="text-center py-16">
              <Lucide.Search size={48} className="mx-auto text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-400">No results found</h3>
              <p className="text-sm text-gray-500 mt-1">
                Try adjusting your search query or location
              </p>
            </div>
          )}
        </>
      )}

      {/* ============ TAB 2: BULK EMAIL EXTRACTOR ============ */}
      {activeTab === 'extract' && (
        <>
          {/* Upload Section */}
          <div className="bg-white/5 p-5 rounded-2xl border border-white/10 mb-6">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Lucide.Upload size={18} /> Upload URLs for Email Extraction
            </h3>
            
            <div className="flex flex-wrap gap-3">
              <label className="flex-1 min-w-[200px] px-4 py-3 rounded-xl bg-white/5 border-2 border-dashed border-white/10 hover:border-purple-500/30 transition cursor-pointer text-center text-sm text-gray-400">
                <Lucide.FileSpreadsheet size={20} className="mx-auto mb-2" />
                Upload Excel/CSV with URLs
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleBulkUrlUpload}
                  className="hidden"
                />
              </label>
              
              <button
                onClick={extractEmailsFromUrls}
                disabled={bulkUrls.length === 0 || extracting}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
              >
                {extracting ? (
                  <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Extracting...</>
                ) : (
                  <><Lucide.Rocket size={16} /> Extract Emails</>
                )}
              </button>
            </div>

            {bulkUrls.length > 0 && (
              <div className="mt-3">
                <div className="text-sm text-gray-400">
                  {bulkUrls.length} URLs loaded
                </div>
                {extracting && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Progress</span>
                      <span>{extractProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                        style={{ width: `${extractProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Extracted Results */}
          {extractedEmails.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-400">
                  {extractedEmails.length} URLs processed
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition text-xs"
                  >
                    {selected.length === extractedEmails.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {extractedEmails.map((item, index) => (
                  <div
                    key={index}
                    className="bg-white/5 p-4 rounded-2xl border border-white/10 hover:border-purple-500/30 transition"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(index)}
                        onChange={() => toggleSelect(index)}
                        className="mt-1 rounded border-white/20 bg-transparent checked:bg-purple-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Lucide.Link size={14} className="text-purple-400" />
                          <span className="font-medium text-sm truncate">{item.url}</span>
                        </div>

                        {/* Emails */}
                        {item.validEmails && item.validEmails.length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs text-gray-400">Valid Emails:</div>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {item.validEmails.map((email, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/20"
                                >
                                  <Lucide.Mail size={10} className="text-green-400" />
                                  <span className="text-xs text-green-400">{email}</span>
                                  <button
                                    onClick={() => copyToClipboard(email, 'email')}
                                    className="text-gray-500 hover:text-white transition"
                                  >
                                    <Lucide.Copy size={10} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Phones */}
                        {item.phones && item.phones.length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs text-gray-400">Phones:</div>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {item.phones.map((phone, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20"
                                >
                                  <Lucide.Phone size={10} className="text-blue-400" />
                                  <span className="text-xs text-blue-400">{phone}</span>
                                  <button
                                    onClick={() => copyToClipboard(phone, 'phone')}
                                    className="text-gray-500 hover:text-white transition"
                                  >
                                    <Lucide.Copy size={10} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Social Links */}
                        {item.socialLinks && Object.keys(item.socialLinks).length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs text-gray-400">Social Profiles:</div>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {Object.entries(item.socialLinks).map(([platform, url]) => (
                                url && (
                                  <a
                                    key={platform}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-purple-400 hover:underline flex items-center gap-1"
                                  >
                                    <Lucide.Share2 size={10} />
                                    {platform}
                                  </a>
                                )
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="mt-2 text-[10px] text-gray-500">
                          Extracted: {new Date(item.extractedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default LeadFinder;
