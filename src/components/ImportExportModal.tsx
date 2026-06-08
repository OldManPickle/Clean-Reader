import React, { useState, useEffect } from "react";
import { X, Globe, Plus, Upload, Download, FileText, Check, Loader2, RefreshCw } from "lucide-react";
import { Feed, CuratedCategory } from "../types";
import { parseOPML, parseBulkUrls, generateOPML } from "../utils/importer";

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribe: (feeds: Feed[]) => void;
  existingFeeds: Feed[];
  categoriesList: string[];
}

export default function ImportExportModal({
  isOpen,
  onClose,
  onSubscribe,
  existingFeeds,
  categoriesList,
}: ImportExportModalProps) {
  const [activeTab, setActiveTab] = useState<"discover" | "manual" | "bulk" | "opml">("discover");
  
  // Custom manual URL state
  const [manualUrl, setManualUrl] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualCategory, setManualCategory] = useState("Subscriptions");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  
  // Bulk state
  const [bulkText, setBulkText] = useState("");
  const [bulkCategory, setBulkCategory] = useState("Technology");
  
  // Curated categories
  const [curatedCategories, setCuratedCategories] = useState<CuratedCategory[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Parse success notification timer
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Fetch curated discoveries
  useEffect(() => {
    if (!isOpen) return;
    
    async function fetchDiscoveries() {
      setDiscoverLoading(true);
      setDiscoverError(null);
      try {
        const res = await fetch("/api/discover-feeds");
        if (!res.ok) throw new Error("Could not fetch discovery data");
        const data = await res.json();
        setCuratedCategories(data.categories || []);
      } catch (err: any) {
        console.error(err);
        setDiscoverError("Failed to fetch discovery lists. Please check your internet connection.");
      } finally {
        setDiscoverLoading(false);
      }
    }

    fetchDiscoveries();
  }, [isOpen]);

  if (!isOpen) return null;

  // Manual Feed Subscription
  const handleManualSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUrl.trim()) return;

    setManualLoading(true);
    setManualError(null);
    const categoryToUse = manualCategory === "NEW" ? (newCategoryName.trim() || "Subscriptions") : manualCategory;

    try {
      const encodedUrl = encodeURIComponent(manualUrl.trim());
      const res = await fetch(`/api/parse-feed?url=${encodedUrl}`);
      
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed fetching URL (HTTP ${res.status})`);
      }

      const feedData = await res.json();
      
      const newFeed: Feed = {
        id: feedData.feedUrl,
        title: manualTitle.trim() || feedData.title || "Parsed Feed",
        feedUrl: feedData.feedUrl,
        link: feedData.link || undefined,
        description: feedData.description || undefined,
        category: categoryToUse
      };

      onSubscribe([newFeed]);
      setManualUrl("");
      setManualTitle("");
      setNewCategoryName("");
      setSuccessMsg(`Successfully subscribed to "${newFeed.title}"`);
    } catch (err: any) {
      console.error(err);
      setManualError(err.message || "Failed to load feed. Ensure it's a valid RSS/Atom XML feed.");
    } finally {
      setManualLoading(false);
    }
  };

  // Bulk Subscribe from URL Text Area
  const handleBulkSubscribe = () => {
    if (!bulkText.trim()) return;
    const imported = parseBulkUrls(bulkText, bulkCategory);
    if (imported.length === 0) {
      alert("No valid URLs found in text box.");
      return;
    }
    onSubscribe(imported);
    setBulkText("");
    setSuccessMsg(`Imported ${imported.length} new URL feeds. Back-end fetches will autovalidate.`);
  };

  // OPML Upload Handler
  const handleOPMLUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const imported = parseOPML(text);
        if (imported.length === 0) {
          alert("Parsed OPML successfully, but no RSS feeds were found inside.");
          return;
        }
        onSubscribe(imported);
        setSuccessMsg(`Bulk-imported ${imported.length} feeds successfully from OPML!`);
      } catch (err: any) {
        alert(`Error parsing OPML xml file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // OPML Exporter
  const handleExportOPML = () => {
    if (existingFeeds.length === 0) {
      alert("You don't have any subscription feeds to export.");
      return;
    }
    const opmlText = generateOPML(existingFeeds);
    const blob = new Blob([opmlText], { type: "text/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rss_portal_subscriptions.opml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export as JSON back-up
  const handleExportJSON = () => {
    if (existingFeeds.length === 0) {
      alert("You don't have any subscription feeds to export.");
      return;
    }
    const blob = new Blob([JSON.stringify(existingFeeds, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rss_portal_backup.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isSubscribed = (url: string) => {
    return existingFeeds.some((f) => f.feedUrl.toLowerCase() === url.toLowerCase());
  };

  const toggleCuratedFeed = (cFeeds: any, defaultCat: string) => {
    const matched = isSubscribed(cFeeds.feedUrl);
    if (matched) return; // already in subscription

    const newFeed: Feed = {
      id: cFeeds.feedUrl,
      title: cFeeds.title,
      feedUrl: cFeeds.feedUrl,
      link: cFeeds.siteUrl,
      category: defaultCat,
      description: cFeeds.description
    };
    onSubscribe([newFeed]);
    setSuccessMsg(`Subscribed to ${cFeeds.title}`);
  };

  const subscribeAllCategory = (cat: CuratedCategory) => {
    const unsubscribed = cat.feeds.filter((f) => !isSubscribed(f.feedUrl));
    if (unsubscribed.length === 0) {
      alert("You are already subscribed to all feeds in this category.");
      return;
    }

    const feedsToAdd: Feed[] = unsubscribed.map((f) => ({
      id: f.feedUrl,
      title: f.title,
      feedUrl: f.feedUrl,
      link: f.siteUrl,
      category: cat.category,
      description: f.description
    }));

    onSubscribe(feedsToAdd);
    setSuccessMsg(`Added ${feedsToAdd.length} feeds from "${cat.category}"`);
  };

  return (
    <div id="import-modal-overlay" className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div id="import-modal-container" className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-neutral-100 dark:border-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-slate-800 bg-neutral-50 dark:bg-slate-850/50">
          <div>
            <h2 className="font-sans font-semibold text-lg text-neutral-900 dark:text-slate-100 font-sans">Add & Manage Content Feeds</h2>
            <p className="text-xs text-neutral-500 dark:text-slate-400 font-sans">Subscribe, bulk import URLs, or sync via OPML</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-slate-205 hover:bg-neutral-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success Alert Banner */}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 text-indigo-805 dark:text-indigo-300 text-xs rounded-lg flex items-center justify-between">
            <span className="font-medium">{successMsg}</span>
            <Check size={14} className="text-indigo-600" />
          </div>
        )}

        {/* Modal Secondary Navigation */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-slate-850/20">
          <button
            onClick={() => setActiveTab("discover")}
            className={`py-3 px-4 font-sans text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "discover"
                ? "border-indigo-600 text-indigo-700 dark:text-indigo-400 font-bold"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Curated Discovery
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`py-3 px-4 font-sans text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "manual"
                ? "border-indigo-600 text-indigo-700 dark:text-indigo-400 font-bold"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Manual URL Add
          </button>
          <button
            onClick={() => setActiveTab("bulk")}
            className={`py-3 px-4 font-sans text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "bulk"
                ? "border-indigo-600 text-indigo-700 dark:text-indigo-400 font-bold"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Bulk URLs List
          </button>
          <button
            onClick={() => setActiveTab("opml")}
            className={`py-3 px-4 font-sans text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "opml"
                ? "border-indigo-600 text-indigo-700 dark:text-indigo-400 font-bold"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            OPML Import/Export
          </button>
        </div>

        {/* Tab Contents Panel */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* TAB: DISCOVER */}
          {activeTab === "discover" && (
            <div className="space-y-6">
              <div className="text-center max-w-md mx-auto py-2">
                <Globe className="mx-auto text-indigo-600 dark:text-indigo-400 mb-2" size={28} />
                <h3 className="text-sm font-semibold text-neutral-800 dark:text-slate-100">Explore Curated RSS Feed presets</h3>
                <p className="text-xs text-neutral-500 dark:text-slate-400">Pick feeds aligned with your topics of interest to populate your feeds list instantly.</p>
              </div>

              {discoverLoading && (
                <div className="flex flex-col items-center justify-center py-10 space-y-2">
                  <RefreshCw className="animate-spin text-neutral-400 dark:text-slate-600" size={24} />
                  <p className="text-xs text-neutral-500 dark:text-slate-400">Retrieving feed suggestions...</p>
                </div>
              )}

              {discoverError && (
                <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/60 text-xs rounded-lg">
                  {discoverError}
                </div>
              )}

              {!discoverLoading && !discoverError && curatedCategories.map((cat, idx) => (
                <div key={idx} className="border border-neutral-100 dark:border-slate-800 rounded-lg p-4 space-y-4 shadow-xs bg-neutral-50/50 dark:bg-slate-850/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-sans font-semibold text-xs text-neutral-800 dark:text-slate-200 uppercase tracking-wider">{cat.category}</h4>
                      <p className="text-xs text-neutral-500 dark:text-slate-400">{cat.description}</p>
                    </div>
                    <button
                      onClick={() => subscribeAllCategory(cat)}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-350 border border-indigo-100 dark:border-indigo-900/60 hover:border-indigo-200 bg-white dark:bg-slate-900 rounded px-2.5 py-1 cursor-pointer transition-colors"
                    >
                      Subscribe to Category
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {cat.feeds.map((feed, fIdx) => {
                      const subscribed = isSubscribed(feed.feedUrl);
                      return (
                        <div key={fIdx} className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-neutral-200/60 dark:border-slate-800 flex flex-col justify-between">
                          <div>
                            <span className="font-sans font-medium text-xs text-neutral-800 dark:text-slate-200 block">{feed.title}</span>
                            <span className="text-neutral-400 dark:text-slate-500 text-[10px] block mb-1.5 truncate">{feed.feedUrl}</span>
                            <p className="text-neutral-500 dark:text-slate-400 text-[11px] leading-relaxed line-clamp-2">{feed.description}</p>
                          </div>
                          
                          <div className="flex items-center justify-end mt-3 border-t border-neutral-100 dark:border-slate-800 pt-2">
                            {subscribed ? (
                              <span className="text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold flex items-center gap-1">
                                <Check size={12} /> Subscribed
                              </span>
                            ) : (
                              <button
                                onClick={() => toggleCuratedFeed(feed, cat.category)}
                                className="text-[11px] font-semibold text-neutral-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-50 dark:hover:bg-slate-800 px-2 py-1 rounded border border-neutral-200 dark:border-slate-700 cursor-pointer flex items-center gap-1 transition-colors"
                              >
                                <Plus size={10} /> Add Feed
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: MANUAL URL */}
          {activeTab === "manual" && (
            <form onSubmit={handleManualSubscribe} className="space-y-4 max-w-lg mx-auto py-4">
              <div className="text-center py-2">
                <Plus className="mx-auto text-indigo-600 dark:text-indigo-400 mb-2" size={28} />
                <h3 className="text-sm font-semibold text-neutral-800 dark:text-slate-100 font-sans">Enter a single Feed URL</h3>
                <p className="text-xs text-neutral-500 dark:text-slate-400">Provide direct Atom, RSS or RDF xml endpoints.</p>
              </div>

              {manualError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/40 text-xs rounded-lg leading-relaxed">
                  {manualError}
                </div>
              )}

              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-slate-400 mb-1">Feed RSS/Atom Link</label>
                  <input
                    type="url"
                    required
                    placeholder="https://example.com/rss.xml"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-neutral-200 dark:border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-950 text-neutral-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-slate-400 mb-1">Custom Title (Optional)</label>
                  <input
                    type="text"
                    placeholder="E.g. Engineering Blog (Auto-retrieved if blank)"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-neutral-200 dark:border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-950 text-neutral-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-slate-400 mb-1">Organize in Folder</label>
                    <select
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-neutral-200 dark:border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-950 text-neutral-900 dark:text-white"
                    >
                      {categoriesList.map((cat, idx) => (
                        <option key={idx} value={cat} className="dark:bg-slate-950">{cat}</option>
                      ))}
                      <option value="NEW" className="dark:bg-slate-950">+ Create New Folder...</option>
                    </select>
                  </div>

                  {manualCategory === "NEW" && (
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-slate-400 mb-1">New Folder name</label>
                      <input
                        type="text"
                        required
                        placeholder="E.g. Creative"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-neutral-200 dark:border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-950 text-neutral-900 dark:text-white animate-fade-in"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={manualLoading}
                  className="w-full flex items-center justify-center bg-neutral-900 hover:bg-neutral-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-semibold text-xs py-2.5 rounded-lg cursor-pointer transition-all disabled:opacity-50 mt-4 h-10"
                >
                  {manualLoading ? (
                    <>
                      <Loader2 className="animate-spin mr-2" size={14} /> Checking Feed XML...
                    </>
                  ) : (
                    "Scan & Subscribe"
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB: BULK URLS */}
          {activeTab === "bulk" && (
            <div className="space-y-4 max-w-lg mx-auto py-2">
              <div className="text-center py-2">
                <FileText className="mx-auto text-indigo-600 dark:text-indigo-400 mb-2" size={28} />
                <h3 className="text-sm font-semibold text-neutral-800 dark:text-slate-100 font-sans">Import Bulk Feeds</h3>
                <p className="text-xs text-neutral-500 dark:text-slate-400">Paste multiple RSS link URL endpoints below — one per line.</p>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-slate-400 mb-1">Feed list (URLs Only)</label>
                  <textarea
                    rows={6}
                    placeholder="https://feed1.com/rss&#10;https://feed2.net/feed.xml&#10;https://rss.nytimes.com/services/xml/rss/nyt/World.xml"
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    className="w-full font-mono text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-950 text-neutral-900 dark:text-white resize-y"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-slate-400 mb-1">Assign to Folder</label>
                    <select
                      value={bulkCategory}
                      onChange={(e) => setBulkCategory(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-neutral-200 dark:border-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-505 bg-white dark:bg-slate-950 text-neutral-900 dark:text-white"
                    >
                      {categoriesList.filter(c => c !== "NEW").map((cat, idx) => (
                        <option key={idx} value={cat} className="dark:bg-slate-950">{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleBulkSubscribe}
                  className="w-full bg-neutral-900 hover:bg-neutral-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-semibold text-xs py-2.5 rounded-lg cursor-pointer transition-all mt-3 h-10"
                >
                  Import Feed List
                </button>
              </div>
            </div>
          )}

          {/* TAB: OPML IMPORT/EXPORT */}
          {activeTab === "opml" && (
            <div className="space-y-6 max-w-lg mx-auto py-2">
              <div className="text-center py-2">
                <Upload className="mx-auto text-indigo-600 dark:text-indigo-400 mb-2" size={28} />
                <h3 className="text-sm font-semibold text-neutral-800 dark:text-slate-100 font-sans">Backup & Sync (OPML)</h3>
                <p className="text-xs text-neutral-500 dark:text-slate-400">Universal standard format for migrating feeds between players (e.g. Feedly, NetNewsWire).</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Importer */}
                <div className="border border-dashed border-slate-200 dark:border-slate-805 hover:border-indigo-505 dark:hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-850/30 rounded-xl p-5 flex flex-col items-center justify-center text-center transition-colors">
                  <Upload className="text-neutral-400 dark:text-slate-500 mb-2" size={20} />
                  <span className="text-xs font-semibold text-neutral-800 dark:text-slate-200 mb-1">Import XML / OPML File</span>
                  <p className="text-[10px] text-neutral-505 dark:text-slate-400 leading-normal mb-3">Load subscriptions lists exported from other readers.</p>
                  
                  <label className="bg-white dark:bg-slate-900 hover:bg-neutral-50 dark:hover:bg-slate-800 border border-neutral-200 dark:border-slate-800 text-[11px] font-semibold px-3 py-1.5 rounded cursor-pointer transition-all shadow-xs text-neutral-800 dark:text-slate-200">
                    Choose File
                    <input
                      type="file"
                      accept=".opml,.xml"
                      onChange={handleOPMLUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Exporter */}
                <div className="border border-neutral-150 dark:border-slate-805 bg-neutral-50/50 dark:bg-slate-850/30 rounded-xl p-5 flex flex-col items-center justify-center text-center">
                  <Download className="text-neutral-400 dark:text-slate-500 mb-2" size={20} />
                  <span className="text-xs font-semibold text-neutral-800 dark:text-slate-200 mb-1">Export Backup File</span>
                  <p className="text-[10px] text-neutral-505 dark:text-slate-400 leading-normal mb-3">Save your subscriptions cleanly containing folder classifications.</p>
                  
                  <div className="flex gap-2 w-full justify-center">
                    <button
                      onClick={handleExportOPML}
                      className="bg-white dark:bg-slate-900 hover:bg-neutral-50 dark:hover:bg-slate-800 border border-neutral-200 dark:border-slate-800 text-[11px] font-semibold px-2.5 py-1.5 rounded cursor-pointer transition-all shadow-xs flex items-center gap-1 text-neutral-800 dark:text-slate-200"
                    >
                      <FileText size={12} /> OPML
                    </button>
                    <button
                      onClick={handleExportJSON}
                      className="bg-white dark:bg-slate-900 hover:bg-neutral-50 dark:hover:bg-slate-800 border border-neutral-200 dark:border-slate-800 text-[11px] font-semibold px-2.5 py-1.5 rounded cursor-pointer transition-all shadow-xs flex items-center gap-1 text-neutral-800 dark:text-slate-200"
                    >
                      <Download size={12} /> JSON
                    </button>
                  </div>
                </div>
              </div>

              <div id="opml-stats" className="bg-neutral-50 dark:bg-slate-850/50 border border-neutral-150 dark:border-slate-800 rounded-lg p-3 text-[11px] text-neutral-500 dark:text-slate-400">
                <span className="font-semibold text-neutral-700 dark:text-slate-200 block mb-1">What is OPML?</span>
                XML-based tree lists containing source feed hyperlinks grouped under folder nodes. Importing OPML immediately restores your curated structure.
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="border-t border-neutral-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between bg-neutral-50 dark:bg-slate-850/50">
          <span className="text-[10px] text-neutral-450 dark:text-slate-400">
            Currently tracking <strong className="text-neutral-600 dark:text-slate-200">{existingFeeds.length} feeds</strong>
          </span>
          <button
            onClick={onClose}
            className="bg-neutral-900 dark:bg-indigo-600 hover:bg-neutral-800 dark:hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors"
          >
            Close Panel
          </button>
        </div>

      </div>
    </div>
  );
}
