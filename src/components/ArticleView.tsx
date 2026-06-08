import { useEffect, useState } from "react";
import { 
  X, ExternalLink, Star, MailOpen, Mail, Type, ZoomIn, ZoomOut, Compass, 
  Loader2, BookOpen, Sparkles, AlertTriangle, RefreshCw, FileText 
} from "lucide-react";
import { FeedItem, AppSettings } from "../types";
import { fetchAndParseArticle, FullArticleResult } from "../utils/fullTextFetcher";

interface ArticleViewProps {
  article: FeedItem | null;
  onClose: () => void;
  onToggleStar: (id: string) => void;
  onToggleRead: (id: string) => void;
  settings: AppSettings;
  onChangeSettings: (settings: AppSettings) => void;
}

export default function ArticleView({
  article,
  onClose,
  onToggleStar,
  onToggleRead,
  settings,
  onChangeSettings,
}: ArticleViewProps) {
  const [readabilityStatus, setReadabilityStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [readabilityData, setReadabilityData] = useState<FullArticleResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"feed" | "full">("feed");

  // Reset readability states when active article changes
  useEffect(() => {
    setReadabilityStatus("idle");
    setReadabilityData(null);
    setErrorMessage("");
    setActiveTab("feed");
  }, [article?.id]);

  // Bind Escape key to close the drawer easily
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!article) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-400 text-center select-none bg-neutral-50/30">
        <Compass size={40} className="text-neutral-300 stroke-[1.25] mb-3 animate-pulse" />
        <h3 className="font-sans font-semibold text-sm text-neutral-700">No Article Selected</h3>
        <p className="text-xs text-neutral-500 max-w-xs mt-1">
          Pick any publication item or bookmark from your timeline to inspect its contents.
        </p>
      </div>
    );
  }

  // Format date helper
  const formattedDate = () => {
    if (!article.pubDate) return "";
    try {
      const d = new Date(article.pubDate);
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return article.pubDate;
    }
  };

  const handleLoadReadability = async () => {
    if (!article?.link) return;
    setReadabilityStatus("loading");
    setActiveTab("full");
    try {
      const parsed = await fetchAndParseArticle(article.link);
      setReadabilityData(parsed);
      setReadabilityStatus("success");
    } catch (err: any) {
      console.error(err);
      setReadabilityStatus("error");
      setErrorMessage(err.message || "Could not retrieve web article content.");
    }
  };

  // Determine custom body colors based on settings.theme
  const getThemeClass = () => {
    switch (settings.theme) {
      case "warm":
        return "bg-warm-bg text-warm-text";
      default:
        return "bg-m3-surface text-m3-on-surface";
    }
  };

  const getBorderColor = () => {
    return settings.theme === "warm" 
      ? "border-warm-border" 
      : "border-m3-outline-variant";
  };

  const getContentFontClass = () => {
    switch (settings.readingFontFamily) {
      case "serif":
        return "font-serif";
      case "mono":
        return "font-mono text-sm";
      default:
        return "font-sans";
    }
  };

  const getFontSizeClass = () => {
    switch (settings.readingFontSize) {
      case "sm":
        return "text-sm";
      case "lg":
        return "text-lg";
      case "xl":
        return "text-xl";
      default:
        return "text-base";
    }
  };

  return (
    <div id="article-reader" className={`flex-1 flex flex-col h-full overflow-hidden border-l select-text min-w-0 ${getThemeClass()} ${getBorderColor()}`}>
      
      {/* Article Bar Controls */}
      <div className={`h-16 px-6 border-b flex items-center justify-between shrink-0 bg-opacity-70 backdrop-blur-md ${getBorderColor()}`}>
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1 px-2.5 rounded-lg text-xs font-semibold font-sans text-m3-on-surface-variant bg-m3-surface-variant hover:bg-m3-outline-variant/60 dark:bg-neutral-800 dark:hover:bg-neutral-750 dark:text-neutral-300 transition-colors cursor-pointer"
          >
            ← Back
          </button>
          
          <div className="hidden sm:block text-xs border-l pl-3 border-m3-outline-variant dark:border-slate-800">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400 block leading-tight">{article.feedTitle}</span>
            <span className="text-[10px] text-m3-on-surface-variant dark:text-slate-500 block">Feed Source</span>
          </div>
        </div>

        {/* Reader Micro Management Utility Buttons */}
        <div className="flex items-center gap-2">
          
          {/* Star/Bookmarked */}
          <button
            onClick={() => onToggleStar(article.id)}
            className={`p-2 rounded-lg cursor-pointer transition-colors border ${
              article.starred 
                ? "bg-amber-500/10 text-amber-500 border-amber-500/20" 
                : "hover:bg-m3-surface-variant dark:hover:bg-neutral-800 border-transparent text-m3-on-surface-variant"
            }`}
            title={article.starred ? "Unstar article" : "Star/Bookmark article"}
          >
            <Star size={16} className={article.starred ? "fill-amber-500" : ""} />
          </button>

          {/* Mark read / unread */}
          <button
            onClick={() => onToggleRead(article.id)}
            className={`p-2 rounded-lg cursor-pointer transition-colors border ${
              !article.read 
                ? "bg-m3-surface-variant text-indigo-600 border-m3-outline-variant" 
                : "hover:bg-m3-surface-variant dark:hover:bg-neutral-800 border-transparent text-m3-on-surface-variant"
            }`}
            title={article.read ? "Mark as unread" : "Mark as read"}
          >
            {article.read ? <Mail size={16} /> : <MailOpen size={16} />}
          </button>

          {/* Open Original Outlet URL */}
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className="p-2 rounded-lg border border-transparent hover:bg-m3-surface-variant dark:hover:bg-neutral-800 text-m3-on-surface-variant flex items-center transition-all cursor-pointer"
            title="Open original webpage"
          >
            <ExternalLink size={16} />
          </a>

          <div className="border-l h-5 mx-1 border-m3-outline-variant dark:border-neutral-750" />

          {/* Reading Layout Controllers */}
          <div className="flex items-center bg-m3-surface-variant dark:bg-neutral-800 rounded-lg p-0.5 border border-m3-outline-variant dark:border-neutral-700">
            <button
              onClick={() => {
                const nextFont = settings.readingFontFamily === "sans" ? "serif" : (settings.readingFontFamily === "serif" ? "mono" : "sans");
                onChangeSettings({ ...settings, readingFontFamily: nextFont });
              }}
              className="p-1 px-1.5 rounded text-[10px] uppercase font-bold text-m3-on-surface-variant hover:text-m3-on-surface dark:text-neutral-450 dark:hover:text-white transition-all cursor-pointer"
              title="Cycle fonts (Sans / Serif / Mono)"
            >
              <Type size={14} />
            </button>
            <button
              onClick={() => {
                const sizes: ("sm"|"base"|"lg"|"xl")[] = ["sm", "base", "lg", "xl"];
                const curIdx = sizes.indexOf(settings.readingFontSize);
                const prevSize = sizes[Math.max(0, curIdx - 1)];
                onChangeSettings({ ...settings, readingFontSize: prevSize });
              }}
              disabled={settings.readingFontSize === "sm"}
              className="p-1 rounded text-m3-on-surface-variant hover:text-m3-on-surface dark:hover:text-neutral-200 disabled:opacity-40 cursor-pointer"
              title="Shrink Text Size"
            >
              <ZoomOut size={13} />
            </button>
            <button
              onClick={() => {
                const sizes: ("sm"|"base"|"lg"|"xl")[] = ["sm", "base", "lg", "xl"];
                const curIdx = sizes.indexOf(settings.readingFontSize);
                const nextSize = sizes[Math.min(3, curIdx + 1)];
                onChangeSettings({ ...settings, readingFontSize: nextSize });
              }}
              disabled={settings.readingFontSize === "xl"}
              className="p-1 rounded text-m3-on-surface-variant hover:text-m3-on-surface dark:hover:text-neutral-200 disabled:opacity-40 cursor-pointer"
              title="Expand Text Size"
            >
              <ZoomIn size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Reader Body Scroller Container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-8 sm:py-12">
        <article className="max-w-2xl mx-auto space-y-6">
          
          {/* Feed Tag + Date */}
          <div className="flex items-center justify-between text-xs font-mono font-semibold tracking-wider text-m3-on-surface-variant">
            <span className="uppercase text-indigo-600 dark:text-indigo-400">{article.feedTitle}</span>
            {formattedDate() && <span>{formattedDate()}</span>}
          </div>

          {/* Heading */}
          <h1 className={`font-sans leading-tight font-bold tracking-tight text-m3-on-surface dark:text-neutral-100 ${
            settings.readingFontSize === "sm" ? "text-xl" :
            settings.readingFontSize === "base" ? "text-2xl" :
            settings.readingFontSize === "lg" ? "text-3xl" : "text-4xl"
          }`}>
            {article.title}
          </h1>

          {/* Author/Creator details */}
          {article.creator && (
            <div className="flex items-center gap-2 text-xs text-m3-on-surface-variant py-1 border-b border-dashed border-m3-outline-variant dark:border-neutral-800 pb-3">
              <span>Published by:</span>
              <strong className="text-m3-on-surface dark:text-neutral-300">{article.creator}</strong>
            </div>
          )}

          {/* Display parsed top-level image thumbnail if available */}
          {article.thumbnail && !article.content?.includes(article.thumbnail) && (
            <div className="rounded-xl overflow-hidden shadow-2xs max-h-80 w-full mb-6 mt-2 border bg-m3-surface-variant dark:bg-neutral-800 border-m3-outline-variant dark:border-slate-750">
              <img
                src={article.thumbnail}
                alt={article.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Interactive Navigation/Distillation Tabs */}
          <div className="flex items-center gap-2 border-b border-m3-outline-variant dark:border-neutral-800 pb-3 mt-1 text-xs">
            <button
              id="btn-tab-feed"
              onClick={() => setActiveTab("feed")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === "feed"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-m3-surface-variant text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-outline-variant/60 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-750"
              }`}
            >
              <FileText size={13} />
              Feed Summary
            </button>
            <button
              id="btn-tab-readability"
              onClick={readabilityStatus === "success" ? () => setActiveTab("full") : handleLoadReadability}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === "full"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-m3-surface-variant text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-outline-variant/60 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-750"
              }`}
            >
              {readabilityStatus === "loading" ? (
                <Loader2 size={13} className="animate-spin text-indigo-500" />
              ) : (
                <BookOpen size={13} />
              )}
              {readabilityStatus === "loading" ? "Distilling..." : "De-cluttered Article"}
              {readabilityStatus !== "success" && readabilityStatus !== "loading" && (
                <Sparkles size={11} className="text-amber-500 animate-pulse ml-0.5" />
              )}
            </button>
          </div>

          {/* Core Content Box with dynamically tailored serif reading classes */}
          <div className={`rss-content leading-relaxed ${getContentFontClass()} ${getFontSizeClass()}`}>
            {activeTab === "feed" ? (
              article.content ? (
                // Safely render the RSS content
                <div id="reader-content" dangerouslySetInnerHTML={{ __html: article.content }} />
              ) : article.contentSnippet ? (
                // Fallback to brief text snippet
                <div className="space-y-4">
                  <p>{article.contentSnippet}</p>
                  <div className="p-4 bg-m3-surface-variant dark:bg-neutral-800 rounded-lg border border-m3-outline-variant text-xs text-m3-on-surface-variant flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span>This article only provided a short summary in its RSS XML feed.</span>
                    <button
                      onClick={handleLoadReadability}
                      className="font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline flex items-center gap-1.5 cursor-pointer bg-transparent border-none p-0 inline-flex"
                    >
                      Load Full Story Webpage (Readability) <Sparkles size={12} className="text-amber-500" />
                    </button>
                  </div>
                </div>
              ) : (
                // Ultimate blank state
                <div className="text-center py-6 text-neutral-400 italic text-xs">
                  No description or body remains in this feed item, inspect via the direct linkage.
                </div>
              )
            ) : (
              // Readability full view
              <div>
                {readabilityStatus === "loading" && (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                    <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={32} />
                    <p className="text-xs text-neutral-500 animate-pulse">
                      Downloading Webpage HTML and filtering templates via Mozilla Readability...
                    </p>
                  </div>
                )}
                
                {readabilityStatus === "success" && readabilityData && (
                  <div id="reader-content" dangerouslySetInnerHTML={{ __html: readabilityData.content }} />
                )}
                
                {readabilityStatus === "error" && (
                  <div className="p-5 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-900/30 space-y-3 text-xs">
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertTriangle size={16} />
                      <strong className="font-semibold">Decluttering Failed</strong>
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      Could not fetch full webpage content through the CORS proxy. This happens when the source website blocks proxies or is heavily secured.
                    </p>
                    <div className="flex items-center gap-2.5 pt-1">
                      <button
                        onClick={handleLoadReadability}
                        className="px-3 py-1.5 bg-indigo-605 text-white bg-indigo-600 hover:bg-indigo-700 font-semibold rounded cursor-pointer flex items-center gap-1 border-none"
                      >
                        <RefreshCw size={11} /> Retry Fetch
                      </button>
                      <button
                        onClick={() => setActiveTab("feed")}
                        className="px-3 py-1.5 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded font-semibold text-neutral-800 dark:text-neutral-200 cursor-pointer border-none"
                      >
                        Back to RSS Summary
                      </button>
                      <a
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        referrerPolicy="no-referrer"
                        className="text-indigo-600 hover:underline inline-flex items-center gap-1 font-semibold ml-auto"
                      >
                        Open Website <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Article Footer End Indicator */}
          <div className="pt-8 border-t border-m3-outline-variant dark:border-neutral-800 text-center flex flex-col items-center gap-3">
            <span className="text-[10px] font-bold font-mono tracking-widest text-m3-on-surface-variant select-none uppercase">
              • END OF STORY •
            </span>
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className="px-5 py-2.5 bg-m3-surface-variant border border-m3-outline-variant text-m3-on-surface font-semibold text-xs rounded-lg hover:bg-m3-outline-variant/60 dark:bg-neutral-800 dark:border-neutral-750 dark:hover:bg-neutral-750 flex items-center gap-1.5 transition-all text-center cursor-pointer shadow-2xs"
            >
              Open Original Outlet Website <ExternalLink size={13} />
            </a>
          </div>

        </article>
      </div>
    </div>
  );
}
