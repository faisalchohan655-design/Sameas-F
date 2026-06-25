import React, { useState } from 'react';
import { useApp } from '../App';
import * as Lucide from 'lucide-react';

const EmailExtractor = () => {
  const { bulkSave, showToast } = useApp();
  const [url, setUrl] = useState('');
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extracted, setExtracted] = useState([]);
  const [selected, setSelected] = useState([]);
  const [mode, setMode] = useState('single');

  const handleExtract = async () => {
    if (mode === 'single' && !url) {
      showToast('Please enter a URL', 'error');
      return;
    }
    if (mode === 'bulk' && urls.length === 0) {
      showToast('Please upload URLs', 'error');
      return;
    }

    setLoading(true);
    setProgress(0);
    try {
      const payload = mode === 'single' ? { url, deep: true, pages: 3 } : { urls: urls.slice(0, 100), deep: false };
      const endpoint = mode === 'single' ? '/email/extract' : '/email/extract/bulk';
      const res = await API.post(endpoint, payload);
      const data = res.data.data || [];
      const results = Array.isArray(data) ? data : [data];
      setExtracted(results);
      setProgress(100);
      showToast(`Extracted ${results.length} results`);
    } catch (e) {
      showToast(e.response?.data?.message || 'Extraction failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = XLSX.read(ev.target.result, { type: 'array' });
        const sheet = data.Sheets[data.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);
        const extractedUrls = json.map(row => row.URL || row.url || row.website || Object.values(row)[0]).filter(Boolean);
        setUrls(extractedUrls);
        showToast(`Loaded ${extractedUrls.length} URLs`);
      } catch (err) {
        showToast('Failed to parse file', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSaveSelected = async () => {
    if (selected.length === 0) {
      showToast('No results selected', 'error');
      return;
    }
    const toSave = extracted.filter((_, i) => selected.includes(i)).map(r => ({
      name: r.website?.replace(/^https?:\/\//, '').split('/')[0] || 'Unknown',
      email: r.emails?.[0] || r.validEmails?.[0] || '',
      phone: r.phones?.[0] || '',
      website: r.url || '',
      source: 'email_extractor',
      status: 'new',
      aiScore: 70,
      aiTags: ['Email Extracted'],
    }));
    try {
      await bulkSave(toSave);
      setSelected([]);
    } catch (e) {
      // handled in context
    }
  };

  const toggleSelect = (idx) => {
    if (selected.includes(idx)) setSelected(selected.filter(s => s !== idx));
    else setSelected([...selected, idx]);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold gradient-text mb-6">Email Extractor</h1>

      <div className="glass p-5 rounded-2xl border border-white/5 mb-6">
        <div className="flex flex-wrap gap-3 mb-4">
          <button
            onClick={() => setMode('single')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${mode === 'single' ? 'gradient-bg text-white' : 'glass-dark text-gray-400 hover:text-white'
              }`}
          >
            Single URL
          </button>
          <button
            onClick={() => setMode('bulk')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${mode === 'bulk' ? 'gradient-bg text-white' : 'glass-dark text-gray-400 hover:text-white'
              }`}
          >
            Bulk Upload
          </button>
        </div>

        {mode === 'single' ? (
          <div className="flex gap-3">
            <input
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl glass-dark border border-white/5 focus:border-purple-500/50 outline-none text-sm"
            />
            <button
              onClick={handleExtract}
              disabled={loading || !url}
              className="px-6 py-2.5 rounded-xl gradient-bg text-white font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Lucide.Rocket size={16} /> Extract</>}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-3">
              <label className="flex-1 px-4 py-2.5 rounded-xl glass-dark border border-dashed border-white/10 hover:border-purple-500/30 transition cursor-pointer text-center text-sm text-gray-400">
                <Lucide.Upload size={16} className="inline mr-2" />
                Upload Excel/CSV
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
              </label>
              <button
                onClick={handleExtract}
                disabled={loading || urls.length === 0}
                className="px-6 py-2.5 rounded-xl gradient-bg text-white font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Lucide.Rocket size={16} /> Extract All</>}
              </button>
            </div>
            {urls.length > 0 && (
              <div className="text-xs text-gray-400">
                {urls.length} URLs loaded (max 100)
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="mt-4">
            <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
              <div className="h-full gradient-bg transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-xs text-gray-500 mt-1">{progress}% complete</div>
          </div>
        )}
      </div>

      {/* Results */}
      {extracted.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">{extracted.length} results</span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (selected.length === extracted.length) setSelected([]);
                  else setSelected(extracted.map((_, i) => i));
                }}
                className="px-3 py-1.5 rounded-lg glass-dark hover:bg-white/5 transition text-xs"
              >
                {selected.length === extracted.length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={handleSaveSelected}
                className="px-3 py-1.5 rounded-lg gradient-bg text-white text-xs font-medium hover:opacity-90 transition"
              >
                Save Selected ({selected.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {extracted.map((result, idx) => (
              <div key={idx} className="glass p-4 rounded-2xl border border-white/5 hover:border-purple-500/30 transition">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(idx)}
                    onChange={() => toggleSelect(idx)}
                    className="mt-1 rounded border-white/10 bg-transparent"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{result.url || 'N/A'}</div>
                    {result.emails && result.emails.length > 0 && (
                      <div className="mt-1">
                        <div className="text-xs text-gray-400">Emails:</div>
                        {result.emails.slice(0, 3).map((email, i) => (
                          <div key={i} className="text-xs text-purple-400 truncate">{email}</div>
                        ))}
                      </div>
                    )}
                    {result.phones && result.phones.length > 0 && (
                      <div className="mt-1">
                        <div className="text-xs text-gray-400">Phones:</div>
                        {result.phones.slice(0, 2).map((phone, i) => (
                          <div key={i} className="text-xs text-gray-300 truncate">{phone}</div>
                        ))}
                      </div>
                    )}
                    {result.socialLinks && Object.keys(result.socialLinks).length > 0 && (
                      <div className="flex gap-2 mt-1">
                        {Object.entries(result.socialLinks).map(([platform, link]) => (
                          link && (
                            <a key={platform} href={link} target="_blank" className="text-[10px] text-purple-400 hover:underline">
                              {platform}
                            </a>
                          )
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

export default EmailExtractor;
