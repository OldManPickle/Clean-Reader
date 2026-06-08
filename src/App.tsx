import { useState, useEffect, useMemo } from "react";
import { 
  Sidebar, Search, Calendar, User, Eye, EyeOff, Star, Inbox, Plus, Check, CheckCheck,
  RefreshCw, Grid, List, Columns, Menu, Loader2, Info, Moon, Sun, SlidersHorizontal, Trash2
} from "lucide-react";
import { Feed, FeedItem, AppSettings, ViewLayout, FilterType } from "./types";
import FeedSidebar from "./components/FeedSidebar";
import ArticleView from "./components/ArticleView";
import ImportExportModal from "./components/ImportExportModal";
import { 
  saveSubscriptions, 
  getSubscriptions, 
  init as clientLoadInit, 
  fetchFeed as clientFetchFeed, 
  cacheArticles, 
  getCachedArticles,
  clearExpiredCache
} from "./utils/rssStorage";

// Premium Starter Seed Feeds to wow the user on first load
const SEED_FEEDS: Feed[] = [
  {
    id: "https://news.ycombinator.com/rss",
    title: "Hacker News",
    feedUrl: "https://news.ycombinator.com/rss",
    link: "https://news.ycombinator.com",
    category: "Technology",
    description: "Startup, software, and intellectual tech items"
  },
  {
    id: "https://techcrunch.com/feed/",
    title: "TechCrunch",
    feedUrl: "https://techcrunch.com/feed/",
    link: "https://techcrunch.com",
    category: "Technology",
    description: "Latest developments in venture funding and hardware"
  },
  {
    id: "https://www.space.com/feeds/all",
    title: "Space.com",
    feedUrl: "https://www.space.com/feeds/all",
    link: "https://www.space.com",
    category: "Science & Space",
    description: "Spaceflight, cosmic physics, and solar updates"
  }
];

const DEFAULT_SETTINGS: AppSettings = {
  readingFontSize: "base",
  readingFontFamily: "sans",
  autoMarkReadScroll: false,
  theme: "light",
  openDirectly: false,
  useClientCorsProxy: false
};

export default function App() {
  // Subscriptions & Config
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  
  // Read/Starred registries (Stored as serialized key objects)
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());

  // Extracted timeline articles & UI States
  const [articles, setArticles] = useState<FeedItem[]>([]);
  const [feedLogs, setFeedLogs] = useState<Record<string, { status: "loading" | "success" | "error"; msg?: string }>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ loaded: 0, total: 0 });
  
  // UI Selection Filters
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterStarred, setFilterStarred] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>("unread");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeLayout, setActiveLayout] = useState<ViewLayout>("list");

  // Selected Article for Reading View
  const [currentArticle, setCurrentArticle] = useState<FeedItem | null>(null);

  // Modal Flags & Mobile layout flags
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);

  const showNotification = (message: string, type: "success" | "info" | "error" = "info") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // 1. First-time client bootstrap load
  useEffect(() => {
    // Restore Settings
    const storedSettings = localStorage.getItem("rss_settings");
    if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings);
        if (parsed && parsed.theme === "dark") {
          parsed.theme = "light";
        }
        setSettings(parsed);
      } catch(e) { console.error(e); }
    }

    // Restore Read/Starred IDs
    const storedRead = localStorage.getItem("rss_read_ids");
    if (storedRead) {
      try { setReadIds(new Set(JSON.parse(storedRead))); } catch(e) { console.error(e); }
    }
    const storedStarred = localStorage.getItem("rss_starred_ids");
    if (storedStarred) {
      try { setStarredIds(new Set(JSON.parse(storedStarred))); } catch(e) { console.error(e); }
    }

    // Pre-hydrate from IndexedDB for beautiful instant feed offline rendering
    getCachedArticles()
      .then((cached) => {
        if (cached && cached.length > 0) {
          setArticles(cached);
        }
      })
      .catch((e) => console.log("IndexedDB cache currently blank or unreachable:", e));

    // Restore or SEED feeds
    const storedFeeds = localStorage.getItem("rss_feeds");
    if (storedFeeds) {
      try {
        const parsed = JSON.parse(storedFeeds);
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          setFeeds(parsed);
          saveSubscriptions(parsed.map((f: any) => f.feedUrl));
          return; // exit to avoid seed override
        }
      } catch(e) { console.error(e); }
    }
    
    // Seed default if empty
    setFeeds(SEED_FEEDS);
    localStorage.setItem("rss_feeds", JSON.stringify(SEED_FEEDS));
    saveSubscriptions(SEED_FEEDS.map(f => f.feedUrl));
  }, []);

  // 2. Fire Refetch whenever the feeds list changes (e.g. initial loads, manual additions)
  useEffect(() => {
    if (feeds.length > 0) {
      syncAllFeeds();
    } else {
      setArticles([]);
    }
  }, [feeds.length]);

  // Sync the system DOM attributes with the saved setting
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-theme", settings.theme === "dark" ? "light" : settings.theme);
    html.classList.remove("dark");
  }, [settings.theme]);

  // Persists settings to storage on update
  const handleUpdateSettings = (newSettings: AppSettings) => {
    const updated = { ...newSettings };
    if (updated.theme === "dark") {
      updated.theme = "light";
    }
    setSettings(updated);
    localStorage.setItem("rss_settings", JSON.stringify(updated));
    const html = document.documentElement;
    html.setAttribute("data-theme", updated.theme);
    html.classList.remove("dark");
  };

  // Helper: Persists feeds list
  const saveFeedsList = (updatedFeeds: Feed[]) => {
    setFeeds(updatedFeeds);
    localStorage.setItem("rss_feeds", JSON.stringify(updatedFeeds));
    saveSubscriptions(updatedFeeds.map(f => f.feedUrl));
  };

  // Synchronizes all subscriptions (supports backend server & client-side CORS proxy cache)
  const syncAllFeeds = async () => {
    if (isSyncing || feeds.length === 0) return;
    
    setIsSyncing(true);
    setSyncProgress({ loaded: 0, total: feeds.length });
    
    const initialLogs: typeof feedLogs = {};
    feeds.forEach(f => {
      initialLogs[f.feedUrl] = { status: "loading" };
    });
    setFeedLogs(initialLogs);

    const retrievedItems: FeedItem[] = [];
    let completedCount = 0;

    // Concurrently fetch each feed
    const fetchPromises = feeds.map(async (feed) => {
      try {
        let processedItems: any[] = [];
        
        if (settings.useClientCorsProxy) {
          // Use client-side standard ES6 CORS fetch & cache system
          const items = await clientFetchFeed(feed.feedUrl);
          processedItems = items.map(item => ({
            ...item,
            feedId: feed.feedUrl,
            feedTitle: feed.title || item.feedTitle || "Unnamed Blog"
          }));
        } else {
          // Use default robust full-stack parser
          const res = await fetch(`/api/parse-feed?url=${encodeURIComponent(feed.feedUrl)}`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          const data = await res.json();
          if (data && Array.isArray(data.items)) {
            processedItems = data.items.map((item: any) => ({
              ...item,
              feedId: feed.feedUrl,
              feedTitle: feed.title || data.title || "Unnamed Blog"
            }));
          }
        }

        retrievedItems.push(...processedItems);

        setFeedLogs(prev => ({
          ...prev,
          [feed.feedUrl]: { status: "success" }
        }));
      } catch (err: any) {
        console.error(`Error scanning feed '${feed.title}':`, err);
        setFeedLogs(prev => ({
          ...prev,
          [feed.feedUrl]: { status: "error", msg: err.message || "Parse Failed" }
        }));
      } finally {
        completedCount++;
        setSyncProgress({ loaded: completedCount, total: feeds.length });
      }
    });

    await Promise.all(fetchPromises);
    
    // Merge into our operational timeline state
    setArticles(retrievedItems);
    setIsSyncing(false);

    // Save newly retrieved articles to IndexedDB cache
    if (retrievedItems.length > 0) {
      cacheArticles(retrievedItems).catch(e => console.error("Failed to update IndexedDB cache:", e));
    }
  };

  // Add new feeds from bulk imports or manual additions
  const handleSubscribeFeeds = (newFeeds: Feed[]) => {
    // Avoid redundant duplicates by filtering unique feed URLs
    const filtered = newFeeds.filter(
      (nf) => !feeds.some((ef) => ef.feedUrl.toLowerCase() === nf.feedUrl.toLowerCase())
    );

    if (filtered.length === 0) {
      showNotification("Selected feed URLs are already in your subscription catalog.", "info");
      return;
    }

    const merged = [...feeds, ...filtered];
    saveFeedsList(merged);
    setIsImportModalOpen(false);
    showNotification(`Subscribed to ${filtered.length} new feed channels!`, "success");
  };

  // Remove a subscribed feed
  const handleUnsubscribeFeed = (feedUrl: string) => {
    const remaining = feeds.filter((f) => f.feedUrl !== feedUrl);
    saveFeedsList(remaining);
    
    // Clear selection if deleted
    if (selectedFeedId === feedUrl) {
      setSelectedFeedId(null);
    }
    
    // Filter articles in timeline state matches the remaining feeds
    setArticles(prev => prev.filter(article => article.feedId !== feedUrl));
    
    if (currentArticle && currentArticle.feedId === feedUrl) {
      setCurrentArticle(null);
    }
  };

  // Toggle Read Status on an individual Item
  const handleToggleRead = (itemId: string) => {
    const updatedReads = new Set(readIds);
    let state = false;
    
    if (updatedReads.has(itemId)) {
      updatedReads.delete(itemId);
      state = false;
    } else {
      updatedReads.add(itemId);
      state = true;
    }
    
    setReadIds(updatedReads);
    localStorage.setItem("rss_read_ids", JSON.stringify(Array.from(updatedReads)));

    // Sync in-memory metadata
    setArticles(prev =>
      prev.map(art => (art.id === itemId ? { ...art, read: state } : art))
    );
    
    if (currentArticle && currentArticle.id === itemId) {
      setCurrentArticle({ ...currentArticle, read: state });
    }
  };

  // Toggle Star / Bookmark Status
  const handleToggleStar = (itemId: string) => {
    const updatedStars = new Set(starredIds);
    let state = false;
    
    if (updatedStars.has(itemId)) {
      updatedStars.delete(itemId);
      state = false;
    } else {
      updatedStars.add(itemId);
      state = true;
    }
    
    setStarredIds(updatedStars);
    localStorage.setItem("rss_starred_ids", JSON.stringify(Array.from(updatedStars)));

    // Sync in-memory metadata
    setArticles(prev =>
      prev.map(art => (art.id === itemId ? { ...art, starred: state } : art))
    );
    
    if (currentArticle && currentArticle.id === itemId) {
      setCurrentArticle({ ...currentArticle, starred: state });
    }
  };

  // Toggle Selection & auto mark as read when selecting
  const handleSelectArticle = (article: FeedItem) => {
    if (settings.openDirectly) {
      window.open(article.link, "_blank", "noopener,noreferrer");
      
      // Mark as read automatically when clicked
      if (!readIds.has(article.id)) {
        const updatedReads = new Set(readIds);
        updatedReads.add(article.id);
        setReadIds(updatedReads);
        localStorage.setItem("rss_read_ids", JSON.stringify(Array.from(updatedReads)));
        
        setArticles(prev =>
          prev.map(art => (art.id === article.id ? { ...art, read: true } : art))
        );
      }
      return;
    }

    setCurrentArticle(article);
    
    // Mark as read automatically when clicked
    if (!readIds.has(article.id)) {
      const updatedReads = new Set(readIds);
      updatedReads.add(article.id);
      setReadIds(updatedReads);
      localStorage.setItem("rss_read_ids", JSON.stringify(Array.from(updatedReads)));
      
      setArticles(prev =>
        prev.map(art => (art.id === article.id ? { ...art, read: true } : art))
      );
    }
  };

  // Batch mark folder or active feed timeline as Complete (Read)
  const handleMarkAllAsRead = () => {
    // Filter only those articles in the current view that are unread
    const unreadArticles = filteredAndSortedArticles.filter(art => !readIds.has(art.id));
    const activeIdsToMark = unreadArticles.map((art) => art.id);
    
    if (activeIdsToMark.length === 0) {
      showNotification("All items under the current view are already read.", "info");
      return;
    }

    const updatedReads = new Set(readIds);
    activeIdsToMark.forEach((id) => updatedReads.add(id));
    
    setReadIds(updatedReads);
    localStorage.setItem("rss_read_ids", JSON.stringify(Array.from(updatedReads)));
    
    // Update live memory list
    setArticles(prev =>
      prev.map(art => activeIdsToMark.includes(art.id) ? { ...art, read: true } : art)
    );

    if (currentArticle && activeIdsToMark.includes(currentArticle.id)) {
      setCurrentArticle({ ...currentArticle, read: true });
    }

    showNotification(`Successfully marked ${activeIdsToMark.length} items as read!`, "success");
  };

  // Clear expired cached items older than 30 days
  const handleClearExpiredCache = async () => {
    try {
      const deletedCount = await clearExpiredCache(30);
      
      // Reload the remaining articles to make sure UI is up-to-date
      const remaining = await getCachedArticles();
      setArticles(remaining);

      if (deletedCount > 0) {
        showNotification(`Cleared ${deletedCount} expired cached articles older than 30 days from IndexedDB!`, "success");
      } else {
        showNotification("No expired articles older than 30 days were found in IndexedDB.", "info");
      }
    } catch (error) {
      console.error("Failed to clear expired cache:", error);
      showNotification("Error occurred while clearing expired cached items.", "error");
    }
  };

  // Compute Unread Counts dynamically per feed Url
  const unreadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    feeds.forEach(f => { counts[f.feedUrl] = 0; });
    
    articles.forEach((art) => {
      if (!readIds.has(art.id)) {
        counts[art.feedId] = (counts[art.feedId] || 0) + 1;
      }
    });
    return counts;
  }, [articles, readIds, feeds]);

  // Compute total dynamic unread timeline items counts.
  const totalUnreadCount = useMemo(() => {
    return articles.reduce((sum, art) => sum + (readIds.has(art.id) ? 0 : 1), 0);
  }, [articles, readIds]);

  // Compute total starred
  const totalStarredCount = useMemo(() => {
    return articles.reduce((sum, art) => sum + (starredIds.has(art.id) ? 1 : 0), 0);
  }, [articles, starredIds]);

  // Compute List of Available Folder names for Modal selections support
  const categoriesList = useMemo(() => {
    const list = new Set<string>();
    feeds.forEach((f) => {
      if (f.category) list.add(f.category);
    });
    if (list.size === 0) list.add("Subscriptions");
    return Array.from(list);
  }, [feeds]);

  // CORE TIMELINE FILTERING & CHRONOLOGICAL SORTING
  const filteredAndSortedArticles = useMemo(() => {
    let list = articles.map(art => ({
      ...art,
      read: readIds.has(art.id),
      starred: starredIds.has(art.id)
    }));

    // Selection Folder Category Filter
    if (selectedCategory) {
      const feedUrlsInCat = feeds
        .filter(f => f.category === selectedCategory)
        .map(f => f.feedUrl);
      list = list.filter(art => feedUrlsInCat.includes(art.feedId));
    }

    // Selection Specific Feed UI filter
    if (selectedFeedId) {
      list = list.filter(art => art.feedId === selectedFeedId);
    }

    // Selection Starred-only filters
    if (filterStarred) {
      list = list.filter(art => art.starred);
    }

    // Secondary Read/Unread Filter (Unread only / starred / all)
    if (filterType === "unread") {
      list = list.filter(art => !art.read);
    } else if (filterType === "starred") {
      list = list.filter(art => art.starred);
    }

    // Text Search filter (Titles & snippets search)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      list = list.filter(
        art => 
          art.title.toLowerCase().includes(query) || 
          (art.contentSnippet && art.contentSnippet.toLowerCase().includes(query)) ||
          (art.creator && art.creator.toLowerCase().includes(query))
      );
    }

    // Sort: Newest stories published first!
    return list.sort((a, b) => {
      const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return dateB - dateA;
    });
  }, [articles, selectedFeedId, selectedCategory, filterStarred, filterType, searchQuery, readIds, starredIds, feeds]);

  const activeTitle = () => {
    if (filterStarred) return "Bookmarked Stories";
    if (selectedFeedId) {
      const fd = feeds.find(f => f.feedUrl === selectedFeedId);
      return fd ? fd.title : "Filtered Feed";
    }
    if (selectedCategory) return `Folder: ${selectedCategory}`;
    return "Universal Feed Inbox";
  };

  // Layout Theme Application helper to style wrapper
  const rootThemeClass = () => {
    switch (settings.theme) {
      case "warm":
        return "bg-warm-bg text-warm-text";
      default:
        return "bg-m3-surface text-m3-on-surface";
    }
  };

  return (
    <div id="app-root-container" className={`min-h-screen flex ${rootThemeClass()} transition-colors duration-200 antialiased`}>
      
      {/* 1. Collapsed & Collapsible Premium Sidebar */}
      <FeedSidebar
        feeds={feeds}
        unreadCounts={unreadCounts}
        totalUnreadCount={totalUnreadCount}
        starredCount={totalStarredCount}
        selectedFeedId={selectedFeedId}
        selectedCategory={selectedCategory}
        filterStarred={filterStarred}
        onSelectFeedId={setSelectedFeedId}
        onSelectCategory={setSelectedCategory}
        onToggleFilterStarred={setFilterStarred}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onUnsubscribe={handleUnsubscribeFeed}
        onSyncAll={syncAllFeeds}
        onMarkAllAsRead={handleMarkAllAsRead}
        isSyncing={isSyncing}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        settings={settings}
        onChangeSettings={handleUpdateSettings}
        activeLayout={activeLayout}
        onChangeLayout={setActiveLayout}
        onClearExpiredCache={handleClearExpiredCache}
      />

      {/* 2. Primary Timeline Panel */}
      <main id="timeline-body" className="flex-1 flex flex-col lg:pl-72 h-screen overflow-hidden">
        
        {/* Dynamic Sync Banner */}
        {isSyncing && (
          <div className="bg-indigo-650 text-white text-[11px] font-semibold py-1.5 px-4 text-center select-none animate-pulse shrink-0 flex items-center justify-center gap-2">
            <Loader2 className="animate-spin" size={12} />
            <span>Synchronizing active portfolios ... Loaded {syncProgress.loaded} of {syncProgress.total} feeds</span>
          </div>
        )}

        {/* Dashboard Header Panel */}
        <header className="h-16 border-b border-m3-outline-variant/80 dark:border-slate-850 px-5 sm:px-6 flex items-center justify-between shrink-0 bg-m3-surface/70 dark:bg-slate-900/60 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            {/* Hamburger for mobile responsive sidebars swipeout */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Menu size={20} />
            </button>
            
            <div>
              <h1 className="font-sans font-bold text-base text-m3-on-surface dark:text-slate-50 tracking-tight leading-tight">
                {activeTitle()}
              </h1>
              <p className="text-[10px] text-m3-on-surface-variant font-medium">
                {filteredAndSortedArticles.length} articles matching filtering criteria (sorted chronologically)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Sub-Filters Tabs: All / Unread only */}
            <div className="flex bg-m3-surface-variant dark:bg-slate-800 rounded-lg p-0.5 border border-m3-outline-variant/15">
              <button
                onClick={() => setFilterType("unread")}
                className={`py-1 px-2.5 rounded-md text-[10px] font-bold tracking-wide uppercase transition-all cursor-pointer ${
                  filterType === "unread"
                    ? "bg-m3-surface dark:bg-slate-700 text-m3-on-surface dark:text-white shadow-xs"
                    : "text-m3-on-surface-variant hover:text-m3-on-surface dark:hover:text-slate-200"
                }`}
              >
                Unread ({filteredAndSortedArticles.filter(a => !a.read).length})
              </button>
              <button
                onClick={() => setFilterType("all")}
                className={`py-1 px-2.5 rounded-md text-[10px] font-bold tracking-wide uppercase transition-all cursor-pointer ${
                  filterType === "all"
                    ? "bg-m3-surface dark:bg-slate-700 text-m3-on-surface dark:text-white shadow-xs"
                    : "text-m3-on-surface-variant hover:text-m3-on-surface dark:hover:text-slate-200"
                }`}
              >
                All
              </button>
            </div>
          </div>
        </header>

        {/* Unified Search Bar & Status Log Block */}
        <div className="px-5 sm:px-6 py-3 border-b border-m3-outline-variant/30 dark:border-slate-800 bg-m3-surface/40 dark:bg-slate-900/40 shrink-0 flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 text-m3-on-surface-variant" size={14} />
            <input
              type="text"
              placeholder="Search through retrieved article titles, summaries or authors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8.5 pr-4 py-2 rounded-lg border border-m3-outline-variant dark:border-slate-750 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-m3-surface dark:bg-slate-800"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2 text-xs text-neutral-450 hover:text-neutral-750"
              >
                Clear
              </button>
            )}
          </div>

          {/* Individual Sync logs errors indicator button */}
          {Object.values(feedLogs).some((log: any) => log.status === "error") && (
            <div className="flex items-center gap-2 text-red-500 text-[11px] font-semibold md:shrink-0 bg-red-50 dark:bg-red-950/20 px-2.5 py-1.5 rounded-md border border-red-100 dark:border-red-900/30">
              <Info size={12} />
              <span>Some feeds failed to download.</span>
            </div>
          )}
        </div>

        {/* Content Pane Layout Router */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Main Feed items list renderer */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 min-w-0">
            {filteredAndSortedArticles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 select-none">
                <Calendar size={36} className="text-slate-300 stroke-[1.25] mb-2" />
                <span className="font-sans font-semibold text-xs text-slate-750 dark:text-slate-300">Timeline Empty</span>
                <p className="text-[11px] font-sans text-slate-500 mt-1 max-w-xs leading-normal">
                  No retrieved stories fit this filter or text query. Wait for background syncs to complete or add alternate feeds.
                </p>
              </div>
            ) : (
              /* LAYOUT 1: LIST DENSITY VIEW */
              activeLayout === "list" ? (
                <div className="space-y-1.5">
                  {filteredAndSortedArticles.map((art) => (
                    <div
                      key={art.id}
                      onClick={() => handleSelectArticle(art)}
                      className={`group flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-all ${
                        art.id === currentArticle?.id ? "border-indigo-600 bg-m3-surface-variant/50 dark:bg-indigo-950/10 dark:border-indigo-500" : ""
                      } ${
                        art.read 
                          ? "bg-m3-surface-variant/40 dark:bg-slate-900/10 hover:bg-m3-surface-variant dark:hover:bg-slate-900 border-m3-outline-variant/30 dark:border-slate-800/40" 
                          : "bg-white dark:bg-slate-900 border-m3-outline-variant dark:border-slate-800 shadow-2xs hover:shadow-xs hover:border-indigo-300"
                      }`}
                    >
                      {/* Read status light dot */}
                      <div className="shrink-0 flex items-center justify-center">
                        <div className={`h-2 w-2 rounded-full ${art.read ? "bg-transparent" : "bg-indigo-600 dark:bg-indigo-400"}`} />
                      </div>

                      {/* Header/Snippet column */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] font-bold font-mono text-indigo-600 dark:text-indigo-400 uppercase tracking-wide bg-m3-surface-variant dark:bg-indigo-950/40 px-1.5 py-0.2 rounded">
                            {art.feedTitle}
                          </span>
                          
                          {art.pubDate && (
                            <span className="text-[10px] text-m3-on-surface-variant dark:text-slate-500 font-mono">
                              {new Date(art.pubDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>

                        <h3 className={`font-sans tracking-tight leading-snug line-clamp-2 text-xs sm:text-sm ${
                          art.read ? "text-m3-on-surface-variant font-medium" : "text-m3-on-surface dark:text-slate-155 font-semibold"
                        }`}>
                          {art.title}
                        </h3>

                        {/* Snippet (Hidden if split screen to save density) */}
                        {activeLayout === "list" && art.contentSnippet && (
                          <p className="text-neutral-500 text-[11px] leading-relaxed line-clamp-1">
                            {art.contentSnippet}
                          </p>
                        )}
                      </div>

                      {/* Micro actions overlay shown on hover */}
                      <div className="md:opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStar(art.id);
                          }}
                          className={`p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-amber-950/20 text-neutral-400 ${
                            art.starred ? "text-amber-500 hover:text-amber-600" : "hover:text-neutral-600"
                          }`}
                          title="Bookmark / Star article"
                        >
                          <Star size={13} className={art.starred ? "fill-amber-500" : ""} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleRead(art.id);
                          }}
                          className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600"
                          title={art.read ? "Mark as unread" : "Mark as read"}
                        >
                          {art.read ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* LAYOUT 2: CARDS GRID VIEW */
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredAndSortedArticles.map((art) => (
                    <div
                      key={art.id}
                      onClick={() => handleSelectArticle(art)}
                      className={`group flex flex-col justify-between rounded-xl border overflow-hidden cursor-pointer transition-all hover:translate-y-[-2px] ${
                        art.id === currentArticle?.id ? "border-indigo-600 ring-1 ring-indigo-500/20" : ""
                      } ${
                        art.read 
                          ? "bg-m3-surface-variant/40 border-m3-outline-variant/30 dark:bg-slate-900/10 dark:border-slate-800/40" 
                          : "bg-white dark:bg-slate-900 border-m3-outline-variant dark:border-slate-800 shadow-2xs hover:shadow-xs hover:border-indigo-300"
                      }`}
                    >
                      <div>
                        {/* Display Thumbnail if exists */}
                        {art.thumbnail ? (
                          <div className="h-40 w-full overflow-hidden border-b border-m3-outline-variant dark:border-neutral-800 bg-m3-surface-variant">
                            <img
                              src={art.thumbnail}
                              alt={art.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover transition-transform group-hover:scale-[1.02]"
                            />
                          </div>
                        ) : (
                          // Fallback default placeholder
                          <div className="h-2 bg-gradient-to-r from-indigo-600/10 to-slate-400/10" />
                        )}

                        <div className="p-4 space-y-2">
                          <div className="flex items-center justify-between text-[9px] font-mono font-bold tracking-wide">
                            <span className="text-indigo-600 dark:text-indigo-400 uppercase tracking-tight bg-m3-surface-variant dark:bg-indigo-950/40 px-1.5 py-0.2 rounded">{art.feedTitle}</span>
                            {art.pubDate && (
                              <span className="text-m3-on-surface-variant dark:text-slate-500">
                                {new Date(art.pubDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>
                          
                          <h3 className={`font-sans font-bold leading-snug tracking-tight text-xs sm:text-sm line-clamp-3 ${
                            art.read ? "text-m3-on-surface-variant font-semibold" : "text-m3-on-surface dark:text-slate-100"
                          }`}>
                            {art.title}
                          </h3>

                          {art.contentSnippet && (
                            <p className="text-m3-on-surface-variant text-[11px] leading-relaxed line-clamp-2">
                              {art.contentSnippet}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="px-4 py-3 border-t border-m3-outline-variant/50 dark:border-neutral-800/80 bg-m3-surface-variant/30 flex items-center justify-between shrink-0">
                        {/* User author details */}
                        <div className="text-[10px] text-m3-on-surface-variant font-sans truncate pr-1 max-w-[140px]">
                          {art.creator ? `By ${art.creator}` : "Staff Writer"}
                        </div>

                        {/* Interactive Buttons */}
                        <div className="flex items-center gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStar(art.id);
                            }}
                            className={`p-1 rounded hover:bg-m3-surface-variant dark:hover:bg-amber-950/20 text-m3-on-surface-variant ${
                              art.starred ? "text-amber-500 hover:text-amber-600" : "hover:text-m3-on-surface"
                            }`}
                          >
                            <Star size={12} className={art.starred ? "fill-amber-500" : ""} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleRead(art.id);
                            }}
                            className="p-1 rounded hover:bg-m3-surface-variant text-m3-on-surface-variant hover:text-m3-on-surface"
                          >
                            {art.read ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )
            )}
          </div>

        </div>

      </main>

      {/* 3. Slider Drawer Overlays */}
      {currentArticle && (
        <div id="slider-drawer-overlay" className="fixed inset-0 flex justify-end z-50">
          {/* Backdrop */}
          <div 
            onClick={() => setCurrentArticle(null)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs matches-backdrop" 
          />
          
          {/* Sliding Frame Container */}
          <div className="relative w-full max-w-2xl h-full shadow-2xl animate-slide-in-right z-10 border-l border-slate-205 dark:border-slate-800">
            <ArticleView
              article={currentArticle}
              onClose={() => setCurrentArticle(null)}
              onToggleStar={handleToggleStar}
              onToggleRead={handleToggleRead}
              settings={settings}
              onChangeSettings={handleUpdateSettings}
            />
          </div>
        </div>
      )}

      {/* 4. Subscriptions Manager Modal Component */}
      <ImportExportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSubscribe={handleSubscribeFeeds}
        existingFeeds={feeds}
        categoriesList={categoriesList}
      />

      {/* 5. Clean Reader Premium Floating Toast Notification System */}
      {notification && (
        <div 
          id="custom-toast-notification"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md animate-slide-in-right max-w-sm transition-all duration-300 bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-850"
        >
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/50">
            {notification.type === "success" ? (
              <CheckCheck size={12} className="text-indigo-600 dark:text-indigo-400" />
            ) : (
              <Info size={12} className="text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <span className="text-[12px] font-medium text-slate-800 dark:text-slate-200">{notification.message}</span>
        </div>
      )}

    </div>
  );
}
