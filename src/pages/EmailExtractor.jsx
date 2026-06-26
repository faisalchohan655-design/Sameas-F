import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import * as Lucide from 'lucide-react';
import * as XLSX from 'xlsx';

const EmailExtractor = () => {
  const { bulkSave, showToast } = useApp();
  
  // ============ STATE ============
  const [url, setUrl] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractMode, setExtractMode] = useState('single'); // 'single' or 'bulk'
  
  // Bulk URL state
  const [bulkUrls, setBulkUrls] = useState([]);
  const [bulkResults, setBulkResults] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef(null);

  // ============ SINGLE URL EXTRACT ============
  const extractSingle = async () => {
    if (!url) {
      showToast('Please enter a URL', 'error');
      return;
    }

    setLoading(true);
    setProgress(0);
    
    try {
      const res = await API.post('/email/extract', { 
        url, 
        deep: true,
        pages: 3
      });
      
      const data = res.data.data;
      const resultData = {
        url: url,
        emails: data.emails || [],
        validEmails: data.validEmails || [],
        phones: data.phones || [],
        socialLinks: data.socialLinks || {},
        extractedAt: new Date().toISOString()
      };
      
      setResults([resultData]);
      setProgress(100);
      showToast(`✅ Extracted ${resultData.emails.length} emails from ${url}`);
      
    } catch (error) {
      showToast('❌ Extraction failed', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // ============ BULK URL UPLOAD ============
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = XLSX.read(ev.target.result, { type: 'array' });
        const sheet = data.Sheets[data.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);
        
        // Extract URLs from various column names
        const urls = json
          .map(row => row.URL || row.url || row.Website || row.website || row.Link || row.link || Object.values(row)[0])
          .filter(Boolean)
          .slice(0, 100); // Max 100 URLs
        
        if (urls.length === 0) {
          showToast('❌ No valid URLs found in file', 'error');
          return;
        }
        
        setBulkUrls(urls);
        showToast(`✅ Loaded ${urls.length} URLs for extraction`);
        
      } catch (err) {
        showToast('❌ Failed to parse file', 'error');
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ============ BULK EXTRACT ============
  const extractBulk = async () => {
    if (bulkUrls.length === 0) {
      showToast('❌ Please upload URLs first', 'error');
      return;
    }

    setIsExtracting(true);
    setProgress(0);
    const allResults = [];
    const totalUrls = Math.min(bulkUrls.length, 100);

    for (let i = 0; i < totalUrls; i++) {
      try {
        const res = await API.post('/email/extract', {
          url: bulkUrls[i],
          deep: true,
          pages: 2
        });

        if (res.data.success && res.data.data) {
          const data = res.data.data;
          allResults.push({
            url: bulkUrls[i],
            emails: data.emails || [],
            validEmails: data.validEmails || [],
            phones: data.phones || [],
            socialLinks: data.socialLinks || {},
            extractedAt: new Date().toISOString()
          });
        }

        // Update progress
        const currentProgress = Math.round(((i + 1) / totalUrls) * 100);
        setProgress(currentProgress);

      } catch (error) {
        console.error(`❌ Failed to extract from: ${bulkUrls[i]}`, error);
        // Still add empty result to show which URL failed
        allResults.push({
          url: bulkUrls[i],
          emails: [],
          validEmails: [],
          phones: [],
          socialLinks: {},
          error: 'Failed to extract',
          extractedAt: new Date().toISOString()
        });
      }
    }

    setBulkResults(allResults);
    setResults(allResults);
    setIsExtracting(false);

    const totalEmails = allResults.reduce((sum, r) => sum + (r.emails?.length || 0), 0);
    showToast(`✅ Extracted ${totalEmails} emails from ${allResults.length} URLs`);
  };

  // ============ CLEAR BULK URLs ============
  const clearBulkUrls = () => {
    setBulkUrls([]);
    setBulkResults([]);
    setResults([]);
    setSelected([]);
    setProgress(0);
    showToast('Cleared all bulk data', 'info');
  };

  // ============ SELECTION FUNCTIONS ============
  const toggleSelect = (index) => {
    if (selected.includes(index)) {
      setSelected(selected.filter(s => s !== index));
    } else {
      setSelected([...selected, index]);
    }
  };

  const selectAll = () => {
    if (selected.length === results.length) {
      setSelected([]);
    } else {
      setSelected(results.map((_, i) => i));
    }
  };

  // ============ SAVE SELECTED ============
  const saveSelected = async () => {
    if (selected.length === 0) {
      showToast('❌ Select results first', 'error');
      return;
    }

    const leadsToSave = results
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
        aiTags: ['Email Extracted', 'Bulk Import']
      }))
      .filter(l => l.email); // Only save if email exists

    if (leadsToSave.length === 0) {
      showToast('❌ No valid emails to save', 'error');
      return;
    }

    await bulkSave(leadsToSave);
    setSelected([]);
    showToast(`✅ Saved ${leadsToSave.length} leads`);
  };

  // ============ COPY FUNCTIONS ============
  const copyToClipboard = (text, label) => {
    if (text) {
      navigator.clipboard.writeText(text);
      showToast(`✅ Copied ${label}!`);
    }
  };

  const copyAllEmails = () => {
    if (selected.length === 0) {
      showToast('❌ Select results first', 'error');
      return;
    }

    const allEmails = results
      .filter((_, i) => selected.includes(i))
      .flatMap(r => r.validEmails || r.emails || [])
      .filter(Boolean);

    if (allEmails.length === 0) {
      showToast('❌ No emails to copy', 'error');
      return;
    }

    navigator.clipboard.writeText(allEmails.join('\n'));
    showToast(`✅ Copied ${allEmails.length} emails`);
  };

  // ============ EXPORT ============
  const exportResults = () => {
    if (results.length === 0) {
      showToast('❌ No results to export', 'error');
      return;
    }

    const data = results.map(r => ({
      URL: r.url || '',
      Emails: (r.emails || []).join(', '),
      'Valid Emails': (r.validEmails || []).join(', '),
      Phones: (r.phones || []).join(', '),
      LinkedIn: r.socialLinks?.linkedin || '',
      Facebook: r.socialLinks?.facebook || '',
      Twitter: r.socialLinks?.twitter || '',
      'Extracted At': r.extractedAt ? new Date(r.extractedAt).toLocaleString() : ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Extracted Emails');
    XLSX.writeFile(wb, `extracted_emails_${Date.now()}.xlsx`);
    showToast(`✅ Exported ${results.length} results to Excel`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500">
          Email Extractor
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {results.length} results
          </span>
          {selected.length > 0 && (
            <button
              onClick={saveSelected}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium hover:opacity-90 transition flex items-center gap-2"
            >
              <Lucide.Save size={16} />
              Save ({selected.length})
            </button>
          )}
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/5 pb-2">
        <button
          onClick={() => {
            setExtractMode('single');
            setResults([]);
            setSelected([]);
          }}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
            extractMode === 'single'
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Lucide.Link size={16} /> Single URL
        </button>
        <button
          onClick={() => {
            setExtractMode('bulk');
            setResults([]);
            setSelected([]);
          }}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
            extractMode === 'bulk'
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Lucide.Upload size={16} /> Bulk Upload
        </button>
      </div>

      {/* ============ SINGLE URL MODE ============ */}
      {extractMode === 'single' && (
        <div className="bg-white/5 p-5 rounded-2xl border border-white/10 mb-6">
          <div className="flex gap-3">
            <input
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-purple-500/50 outline-none text-sm"
            />
            <button
              onClick={extractSingle}
              disabled={loading || !url}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><Lucide.Rocket size={16} /> Extract</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ============ BULK MODE ============ */}
      {extractMode === 'bulk' && (
        <div className="bg-white/5 p-5 rounded-2xl border border-white/10 mb-6">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Lucide.Upload size={18} /> Upload URLs for Bulk Extraction
          </h3>
          
          <div className="flex flex-wrap gap-3">
            {/* File Upload */}
            <label className="flex-1 min-w-[200px] px-4 py-3 rounded-xl bg-white/5 border-2 border-dashed border-white/10 hover:border-purple-500/30 transition cursor-pointer text-center text-sm text-gray-400">
              <Lucide.FileSpreadsheet size={20} className="mx-auto mb-2" />
              {bulkUrls.length > 0 ? `${bulkUrls.length} URLs loaded` : 'Upload Excel/CSV with URLs'}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Action Buttons */}
            <button
              onClick={extractBulk}
              disabled={bulkUrls.length === 0 || isExtracting}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
            >
              {isExtracting ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Extracting...</>
              ) : (
                <><Lucide.Rocket size={16} /> Extract All</>
              )}
            </button>

            {bulkUrls.length > 0 && (
              <button
                onClick={clearBulkUrls}
                className="px-4 py-3 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition flex items-center gap-2"
              >
                <Lucide.X size={16} /> Clear
              </button>
            )}
          </div>

          {/* Bulk URLs Preview */}
          {bulkUrls.length > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="text-xs text-gray-400 mb-2">
                {bulkUrls.length} URLs loaded (max 100)
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {bulkUrls.slice(0, 10).map((url, i) => (
                  <div key={i} className="text-xs text-gray-500 truncate">
                    {i + 1}. {url}
                  </div>
                ))}
                {bulkUrls.length > 10 && (
                  <div className="text-xs text-gray-600">
                    ... and {bulkUrls.length - 10} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Progress */}
          {isExtracting && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Extracting emails...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ RESULTS ============ */}
      {results.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">
                {results.length} results
              </span>
              <button
                onClick={selectAll}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition text-xs"
              >
                {selected.length === results.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={copyAllEmails}
                disabled={selected.length === 0}
                className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition text-xs disabled:opacity-50 flex items-center gap-1"
              >
                <Lucide.Copy size={12} />
                Copy Emails ({selected.length})
              </button>
              <button
                onClick={exportResults}
                className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition text-xs flex items-center gap-1"
              >
                <Lucide.FileSpreadsheet size={12} />
                Export Excel
              </button>
            </div>
          </div>

          {/* Results List */}
          <div className="space-y-3">
            {results.map((result, index) => (
              <div
                key={index}
                className={`bg-white/5 p-4 rounded-2xl border transition ${
                  selected.includes(index)
                    ? 'border-purple-500/40 bg-purple-500/10'
                    : 'border-white/10 hover:border-purple-500/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(index)}
                    onChange={() => toggleSelect(index)}
                    className="mt-1 rounded border-white/20 bg-transparent checked:bg-purple-500"
                  />
                  <div className="flex-1 min-w-0">
                    {/* URL */}
                    <div className="flex items-center gap-2">
                      <Lucide.Link size={14} className="text-purple-400 flex-shrink-0" />
                      <span className="font-medium text-sm truncate">{result.url}</span>
                      <button
                        onClick={() => copyToClipboard(result.url, 'URL')}
                        className="text-gray-500 hover:text-white transition flex-shrink-0"
                        title="Copy URL"
                      >
                        <Lucide.Copy size={12} />
                      </button>
                    </div>

                    {/* Emails */}
                    {(result.emails || result.validEmails) && (
                      <div className="mt-2">
                        <div className="text-xs text-gray-400">Emails:</div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {(result.validEmails || result.emails || []).slice(0, 5).map((email, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/20"
                            >
                              <Lucide.Mail size={10} className="text-green-400 flex-shrink-0" />
                              <span className="text-xs text-green-400 truncate max-w-[200px]">{email}</span>
                              <button
                                onClick={() => copyToClipboard(email, 'email')}
                                className="text-gray-500 hover:text-white transition flex-shrink-0"
                              >
                                <Lucide.Copy size={10} />
                              </button>
                            </div>
                          ))}
                          {(result.emails || []).length > 5 && (
                            <span className="text-xs text-gray-500">+{(result.emails || []).length - 5} more</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Phones */}
                    {result.phones && result.phones.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs text-gray-400">Phones:</div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {result.phones.slice(0, 3).map((phone, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20"
                            >
                              <Lucide.Phone size={10} className="text-blue-400 flex-shrink-0" />
                              <span className="text-xs text-blue-400">{phone}</span>
                              <button
                                onClick={() => copyToClipboard(phone, 'phone')}
                                className="text-gray-500 hover:text-white transition flex-shrink-0"
                              >
                                <Lucide.Copy size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Social Links */}
                    {result.socialLinks && Object.keys(result.socialLinks).length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs text-gray-400">Social Profiles:</div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {Object.entries(result.socialLinks).map(([platform, url]) => (
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

                    {/* Error */}
                    {result.error && (
                      <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
                        <Lucide.AlertCircle size={12} />
                        {result.error}
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="mt-2 text-[10px] text-gray-500">
                      Extracted: {new Date(result.extractedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {results.length === 0 && !loading && !isExtracting && (
        <div className="text-center py-16">
          <Lucide.Mail size={48} className="mx-auto text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-400">No emails extracted yet</h3>
          <p className="text-sm text-gray-500 mt-1">
            {extractMode === 'single' 
              ? 'Enter a URL above to extract emails' 
              : 'Upload an Excel/CSV file with URLs to extract in bulk'}
          </p>
        </div>
      )}

      {/* Loading */}
      {(loading || isExtracting) && results.length === 0 && (
        <div className="flex justify-center py-16">
          <div className="text-center">
            <div className="w-12 h-12 border-3 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-400">Extracting emails...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailExtractor;
