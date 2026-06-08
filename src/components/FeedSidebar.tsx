import { useState } from "react";
import { 
  Folder, FolderOpen, Star, Inbox, Plus, Trash2, RefreshCw, 
  Settings, Layout, Sparkles, SidebarClose, ChevronRight, ChevronDown, CheckCheck,
  SlidersHorizontal, List, Grid, Columns
} from "lucide-react";
import { Feed, AppSettings, ViewLayout } from "../types";

interface FeedSidebarProps {
  feeds: Feed[];
  unreadCounts: Record<string, number>;
  totalUnreadCount: number;
  starredCount: number;
  
  // Selection
  selectedFeedId: string | null;  // specific feed URL, or null
  selectedCategory: string | null; // specific folder name, or null
  filterStarred: boolean;          // true if looking at starred
  
  onSelectFeedId: (id: string | null) => void;
  onSelectCategory: (cat: string | null) => void;
  onToggleFilterStarred: (active: boolean) => void;
  
  // Handlers
  onOpenImportModal: () => void;
  onUnsubscribe: (feedUrl: string) => void;
  onSyncAll: () => void;
  onMarkAllAsRead: () => void;
  isSyncing: boolean;
  
  // Mobile Support
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  
  // Config
  settings: AppSettings;
  onChangeSettings: (settings: AppSettings) => void;

  // Layout Controls
  activeLayout: ViewLayout;
  onChangeLayout: (layout: ViewLayout) => void;

  // Cache Cleanup
  onClearExpiredCache: () => void;
}

export default function FeedSidebar({
  feeds,
  unreadCounts,
  totalUnreadCount,
  starredCount,
  selectedFeedId,
  selectedCategory,
  filterStarred,
  onSelectFeedId,
  onSelectCategory,
  onToggleFilterStarred,
  onOpenImportModal,
  onUnsubscribe,
  onSyncAll,
  onMarkAllAsRead,
  isSyncing,
  isOpenMobile,
  onCloseMobile,
  settings,
  onChangeSettings,
  activeLayout,
  onChangeLayout,
  onClearExpiredCache
}: FeedSidebarProps) {
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [showReaderStyles, setShowReaderStyles] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Group feeds by category
  const categories: Record<string, Feed[]> = {};
  feeds.forEach((feed) => {
    const cat = feed.category || "Subscriptions";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(feed);
  });

  const toggleCategoryCollapse = (cat: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  // Compute category-specific unread count totals
  const getCategoryUnreadCount = (category: string) => {
    const catFeeds = categories[category] || [];
    return catFeeds.reduce((sum, feed) => sum + (unreadCounts[feed.feedUrl] || 0), 0);
  };

  const sidebarStyles = () => {
    switch (settings.theme) {
      case "warm":
        return {
          aside: "bg-[#F5EFE1]/90 text-[#3D3A36] border-[#E5DAC0]",
          header: "border-[#E5DAC0] bg-[#EDE5D3]",
          titleText: "text-[#2D2A26]",
          footer: "border-[#E5DAC0] bg-[#EDE5D3]/60",
          itemHover: "hover:bg-[#EAE1CD]/80 hover:text-[#2D2A26]",
          itemActive: "bg-indigo-600/10 text-indigo-905 border-l-2 border-indigo-600 font-semibold",
          normalText: "text-[#5D554D]",
          badge: "bg-indigo-600/10 text-indigo-800 border border-indigo-600/15"
        };
      default: // light
        return {
          aside: "bg-m3-surface/95 text-m3-on-surface border-m3-outline-variant/80",
          header: "border-m3-outline-variant/80 bg-m3-surface",
          titleText: "text-m3-on-surface",
          footer: "border-m3-outline-variant/80 bg-m3-surface-variant/85",
          itemHover: "hover:bg-m3-surface-variant hover:text-m3-on-surface",
          itemActive: "bg-m3-surface-variant text-indigo-600 border-l-2 border-indigo-600 font-semibold",
          normalText: "text-m3-on-surface-variant",
          badge: "bg-m3-surface-variant text-indigo-600 border border-m3-outline-variant"
        };
    }
  };

  const st = sidebarStyles();

  const handleSelectFeed = (feedUrl: string) => {
    onSelectCategory(null);
    onToggleFilterStarred(false);
    onSelectFeedId(feedUrl);
    if (window.innerWidth < 1024) onCloseMobile();
  };

  const handleSelectCategoryGroup = (category: string) => {
    onSelectFeedId(null);
    onToggleFilterStarred(false);
    onSelectCategory(category);
    if (window.innerWidth < 1024) onCloseMobile();
  };

  const handleSelectInbox = () => {
    onSelectFeedId(null);
    onSelectCategory(null);
    onToggleFilterStarred(false);
    if (window.innerWidth < 1024) onCloseMobile();
  };

  const handleSelectStarred = () => {
    onSelectFeedId(null);
    onSelectCategory(null);
    onToggleFilterStarred(true);
    if (window.innerWidth < 1024) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div 
          onClick={onCloseMobile}
          id="sidebar-mobile-backdrop"
          className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="app-sidebar"
        className={`fixed top-0 bottom-0 left-0 w-72 border-r ${st.aside} flex flex-col z-40 transition-all duration-300 lg:translate-x-0 ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full lg:transform-none"
        }`}
      >
        {/* Sidebar Product Title */}
        <div className={`h-16 border-b ${st.header} flex items-center justify-between px-5 transition-colors duration-200`}>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-sans font-bold text-sm shadow-md shadow-indigo-600/20">
              C
            </div>
            <div>
              <span className={`font-sans font-semibold text-sm ${st.titleText} tracking-tight block leading-tight`}>Clean Reader</span>
              <span className="text-[9px] text-slate-400 font-mono block leading-none">v1.2.0 (Local-First)</span>
            </div>
          </div>
          
          <button
            onClick={onSyncAll}
            disabled={isSyncing}
            className={`p-1.5 rounded-md hover:bg-indigo-505/10 hover:text-indigo-600 transition-all cursor-pointer ${
              isSyncing ? "text-indigo-500" : "text-slate-400"
            }`}
            title="Synchronize All Feeds"
          >
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Global Feeds Navigation Sections */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          <div className="space-y-1">
            <button
              onClick={handleSelectInbox}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold font-sans cursor-pointer transition-all ${
                !selectedFeedId && !selectedCategory && !filterStarred
                  ? st.itemActive
                  : `${st.itemHover} ${st.normalText}`
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Inbox size={15} className={!selectedFeedId && !selectedCategory && !filterStarred ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"} />
                <span>All Subscriptions</span>
              </div>
              {totalUnreadCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold leading-none ${st.badge}`}>
                  {totalUnreadCount}
                </span>
              )}
            </button>

            <button
              onClick={handleSelectStarred}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold font-sans cursor-pointer transition-all ${
                filterStarred
                  ? "bg-amber-500/10 text-amber-705 dark:text-amber-400 border-l-2 border-amber-500 font-semibold"
                  : `${st.itemHover} ${st.normalText}`
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Star size={15} className={filterStarred ? "text-amber-500 fill-amber-500" : "text-slate-400"} />
                <span>Saved Articles</span>
              </div>
              {starredCount > 0 && (
                <span className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/15 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold leading-none">
                  {starredCount}
                </span>
              )}
            </button>
          </div>

          {/* Subscriptions Tree grouped by Folder */}
          <div className="space-y-3">
            <div className={`flex items-center justify-between px-3 text-[10px] font-bold uppercase tracking-wider ${st.normalText}`}>
              <span>Feeds Folder Library</span>
              <button 
                onClick={onOpenImportModal}
                className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-500/10 p-0.5 rounded transition-all cursor-pointer"
                title="Add feeds"
              >
                <Plus size={12} />
              </button>
            </div>

            {feeds.length === 0 ? (
              <div className={`px-3 py-4 text-center rounded-lg border border-dashed text-[11px] ${
                settings.theme === "warm" ? "border-[#E5DAC0] text-[#7D756D]" : "border-slate-200 dark:border-slate-800 text-slate-400"
              }`}>
                <span>No folder subscriptions. Click "+ Add Content" to get started instantly.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(categories).map(([category, catFeeds]) => {
                  const isCollapsed = collapsedCategories[category];
                  const catUnread = getCategoryUnreadCount(category);
                  const isCatSelected = selectedCategory === category;

                  return (
                    <div key={category} className="space-y-0.5 animate-fade-in">
                      {/* Category Header Row */}
                      <div
                        className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-sans font-medium cursor-pointer transition-colors ${
                          isCatSelected ? st.itemActive : st.itemHover
                        }`}
                      >
                        <div 
                          className="flex-1 flex items-center gap-1.5 overflow-hidden"
                          onClick={() => handleSelectCategoryGroup(category)}
                        >
                          <span className={st.normalText}>
                            {isCollapsed ? <Folder size={14} className="text-slate-400" /> : <FolderOpen size={14} className="text-indigo-500/80 dark:text-indigo-400/80" />}
                          </span>
                          <span className={`truncate font-medium ${isCatSelected ? "" : "text-slate-750 dark:text-slate-200"}`}>{category}</span>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          {catUnread > 0 && (
                            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono font-semibold ${st.badge}`}>
                              {catUnread}
                            </span>
                          )}
                          <button
                            onClick={() => toggleCategoryCollapse(category)}
                            className="text-slate-450 hover:text-slate-700 dark:hover:text-white p-0.5 rounded cursor-pointer transition-all"
                          >
                            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                          </button>
                        </div>
                      </div>

                      {/* Enclosed Feeds List */}
                      {!isCollapsed && (
                        <div className={`pl-4 pr-1 py-0.5 space-y-0.5 border-l ml-4 ${
                          settings.theme === "warm" ? "border-[#E5DAC0]" : "border-slate-200 dark:border-slate-800"
                        }`}>
                          {catFeeds.map((feed) => {
                            const isFeedSelected = selectedFeedId === feed.feedUrl;
                            const unread = unreadCounts[feed.feedUrl] || 0;

                            return (
                              <div
                                key={feed.feedUrl}
                                className={`group flex items-center justify-between px-2.5 py-1 rounded-md text-[11px] font-sans cursor-pointer transition-all ${
                                  isFeedSelected 
                                    ? st.itemActive 
                                    : `${st.itemHover} text-slate-505 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100`
                                }`}
                              >
                                <span 
                                  onClick={() => handleSelectFeed(feed.feedUrl)}
                                  className="flex-1 truncate pr-1"
                                  title={feed.title}
                                >
                                  {feed.title}
                                </span>
                                
                                <div className="flex items-center gap-1.5 text-right">
                                  {unread > 0 && (
                                    <span className={`px-1 py-0.2 rounded font-mono text-[9px] ${st.badge}`}>
                                      {unread}
                                    </span>
                                  )}
                                  
                                  {/* Quick Delete Feed */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirmDeleteId === feed.feedUrl) {
                                        onUnsubscribe(feed.feedUrl);
                                        setConfirmDeleteId(null);
                                      } else {
                                        setConfirmDeleteId(feed.feedUrl);
                                        // Auto-reset after a few seconds
                                        setTimeout(() => {
                                          setConfirmDeleteId(null);
                                        }, 4000);
                                      }
                                    }}
                                    className={`py-0.5 rounded cursor-pointer transition-all ${
                                      confirmDeleteId === feed.feedUrl
                                        ? "text-red-500 opacity-100 bg-red-50 dark:bg-red-950/20 px-1 text-[9px] font-bold"
                                        : "opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"
                                    }`}
                                    title={confirmDeleteId === feed.feedUrl ? "Click again to confirm" : "Unsubscribe Feed"}
                                  >
                                    {confirmDeleteId === feed.feedUrl ? "Confirm?" : <Trash2 size={11} />}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Floating Utility Controls Bar (Bottom of Sidebar) */}
        <div id="sidebar-footer" className={`p-4 border-t ${st.footer} space-y-3`}>
          
          <div className="grid grid-cols-2 gap-1.5">
            {/* Mark folders/active list read */}
            <button
              onClick={onMarkAllAsRead}
              className={`col-span-2 text-center text-[10px] font-bold py-2.5 rounded-lg border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                settings.theme === "warm" 
                  ? "text-[#5D554D] hover:bg-[#EAE1CD] border-[#E5DAC0]" 
                  : "text-m3-on-surface hover:text-m3-on-surface-variant dark:text-slate-300 dark:hover:text-white hover:bg-m3-surface-variant dark:hover:bg-slate-800/60 border-m3-outline-variant dark:border-slate-800"
              }`}
            >
              <CheckCheck size={11} className="text-indigo-600 dark:text-indigo-400" />
              Mark All as Read
            </button>

            <button
              onClick={onOpenImportModal}
              className="col-span-2 bg-indigo-600 hover:bg-indigo-500 text-white font-sans font-bold text-xs p-2.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 focus:none shadow-xs shadow-indigo-600/10"
            >
              <Plus size={14} /> Add Content
            </button>
          </div>

          <div className={`mt-2 pt-2 border-t ${
            settings.theme === "warm" ? "border-[#E5DAC0]" : "border-m3-outline-variant dark:border-slate-800"
          }`}>
            <button
              onClick={() => setShowReaderStyles(!showReaderStyles)}
              className={`w-full flex items-center justify-between text-[11px] font-bold uppercase tracking-wider mb-2 text-left cursor-pointer hover:opacity-80 transition-opacity ${st.normalText}`}
            >
              <span className="flex items-center gap-1.5">
                <Settings size={12} className="text-indigo-600 dark:text-indigo-400" />
                SETTINGS
              </span>
              <span className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                {showReaderStyles ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>

            {showReaderStyles && (
              <div className="space-y-3 pt-1 animate-fade-in">
                {/* 1. Layout Selection Row */}
                <div className="space-y-1">
                  <span className={`text-[10px] font-semibold block ${st.normalText}`}>Layout Style</span>
                  <div className={`flex rounded p-0.5 border ${
                    settings.theme === "warm" ? "bg-[#EDE5D3] border-[#E5DAC0]" : "bg-m3-surface-variant dark:bg-slate-900 border-m3-outline-variant dark:border-slate-800"
                  }`}>
                    <button
                      onClick={() => onChangeLayout("list")}
                      className={`flex-1 py-1 text-[10px] font-bold rounded flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                        activeLayout === "list" 
                          ? (settings.theme === "warm" ? "bg-[#FAF6EE] text-[#5D554D] shadow-xs font-bold" : "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold") 
                          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      }`}
                      title="List View"
                    >
                      <List size={11} /> List
                    </button>
                    <button
                      onClick={() => onChangeLayout("grid")}
                      className={`flex-1 py-1 text-[10px] font-bold rounded flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                        activeLayout === "grid" 
                          ? (settings.theme === "warm" ? "bg-[#FAF6EE] text-[#5D554D] shadow-xs font-bold" : "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold") 
                          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      }`}
                      title="Grid View"
                    >
                      <Grid size={11} /> Grid
                    </button>
                  </div>
                </div>

                {/* 1.5. Theme Mode Selection Row */}
                <div id="theme-mode-section" className={`space-y-1.5 pt-2 border-t ${
                  settings.theme === "warm" ? "border-[#E5DAC0]/60" : "border-m3-outline-variant/60"
                }`}>
                  <span className={`text-[10px] font-semibold block ${st.normalText}`}>Theme Mode</span>
                  <div className={`flex rounded p-0.5 border ${
                    settings.theme === "warm" ? "bg-[#EDE5D3] border-[#E5DAC0]" : "bg-m3-surface-variant border-m3-outline-variant"
                  }`}>
                    <button
                      id="theme-btn-light"
                      onClick={() => onChangeSettings({ ...settings, theme: "light" })}
                      className={`flex-1 py-1 text-[10px] font-bold rounded flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                        (settings.theme !== "warm") 
                          ? "bg-white text-indigo-600 shadow-xs font-bold" 
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                      title="Light Mode"
                    >
                      Light
                    </button>
                    <button
                      id="theme-btn-warm"
                      onClick={() => onChangeSettings({ ...settings, theme: "warm" })}
                      className={`flex-1 py-1 text-[10px] font-bold rounded flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                        settings.theme === "warm" 
                          ? "bg-[#FAF6EE] text-[#5D554D] shadow-xs font-bold" 
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                      title="Warm Mode"
                    >
                      Warm
                    </button>
                  </div>
                </div>

                {/* 2. Article Opening Mode Toggle */}
                <div className={`space-y-1.5 pt-2 border-t ${
                  settings.theme === "warm" ? "border-[#E5DAC0]/60" : "border-m3-outline-variant/60 dark:border-slate-800/50"
                }`}>
                  <span className={`text-[10px] font-semibold block ${st.normalText}`}>Click Action</span>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className={`text-[11px] font-medium transition-colors ${
                      settings.theme === "warm" 
                        ? "text-[#4D453D] group-hover:text-[#2D231A]" 
                        : "text-m3-on-surface group-hover:text-m3-on-surface-variant dark:text-slate-350 dark:group-hover:text-slate-100"
                    }`}>
                      Open website directly
                    </span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={!!settings.openDirectly}
                        onChange={(e) => onChangeSettings({ ...settings, openDirectly: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className={`w-8 h-4.5 rounded-full transition-colors relative ${
                        settings.openDirectly
                          ? "bg-indigo-600"
                          : (settings.theme === "warm" ? "bg-[#EDE5D3] border border-[#E5DAC0]" : "bg-m3-outline-variant dark:bg-slate-800")
                      }`}>
                        <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-3.5 w-3.5 transition-transform shadow-xs ${
                          settings.openDirectly ? "translate-x-3.5" : "translate-x-0"
                        }`} />
                      </div>
                    </div>
                  </label>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight">
                    {settings.openDirectly 
                      ? "Opens stories in a new browser tab" 
                      : "Opens clean in-app reader"}
                  </p>
                </div>

                {/* 3. CORS Proxy Mode Toggle */}
                <div className={`space-y-1.5 pt-2 border-t ${
                  settings.theme === "warm" ? "border-[#E5DAC0]/60" : "border-m3-outline-variant/60 dark:border-slate-800/50"
                }`}>
                  <span className={`text-[10px] font-semibold block ${st.normalText}`}>Fetch System</span>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className={`text-[11px] font-medium transition-colors ${
                      settings.theme === "warm" 
                        ? "text-[#4D453D] group-hover:text-[#2D231A]" 
                        : "text-m3-on-surface group-hover:text-m3-on-surface-variant dark:text-slate-350 dark:group-hover:text-slate-100"
                    }`}>
                      Client CORS Proxy & Cache
                    </span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={!!settings.useClientCorsProxy}
                        onChange={(e) => onChangeSettings({ ...settings, useClientCorsProxy: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className={`w-8 h-4.5 rounded-full transition-colors relative ${
                        settings.useClientCorsProxy
                          ? "bg-indigo-600"
                          : (settings.theme === "warm" ? "bg-[#EDE5D3] border border-[#E5DAC0]" : "bg-m3-outline-variant dark:bg-slate-800")
                      }`}>
                        <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-3.5 w-3.5 transition-transform shadow-xs ${
                          settings.useClientCorsProxy ? "translate-x-3.5" : "translate-x-0"
                        }`} />
                      </div>
                    </div>
                  </label>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight">
                    {settings.useClientCorsProxy 
                      ? "Standard ES6 Web APIs & IndexedDB cache" 
                      : "Full-stack server parser background service"}
                  </p>
                </div>

                {/* 4. Cache Maintenance Option */}
                <div className={`space-y-1.5 pt-2 border-t ${
                  settings.theme === "warm" ? "border-[#E5DAC0]/60" : "border-m3-outline-variant/60 dark:border-slate-800/50"
                }`}>
                  <span className={`text-[10px] font-semibold block ${st.normalText}`}>Cache Maintenance</span>
                  <button
                    onClick={onClearExpiredCache}
                    className={`w-full py-2 px-3 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      settings.theme === "warm"
                        ? "bg-[#EDE5D3] hover:bg-[#FAF6EE] text-[#5D554D] border border-[#E5DAC0]"
                        : "bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-150 dark:border-indigo-900/60 text-indigo-650 dark:text-indigo-400"
                    }`}
                    title="Clear Expired Cache"
                  >
                    <Trash2 size={12} />
                    Clear Expired Cache
                  </button>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight">
                    Removes articles older than 30 days from free IndexedDB cache memory
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

      </aside>
    </>
  );
}
