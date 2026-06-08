/**
 * Client-Side RSS Storage & Feed Caching Utility
 * 
 * This module provides clean, lightweight, modular functions using standard Web APIs
 * (Fetch, DOMParser, localStorage, IndexedDB) to save feed subscriptions, fetch them via CORS proxy,
 * and cache feed articles inside an IndexedDB store to prevent duplication.
 */

// --- 1. Subscription Storage (localStorage) ---

/**
 * Saves a list of RSS feed URLs to localStorage.
 * @param urls Array of RSS feed URLs
 */
export function saveSubscriptions(urls: string[]): void {
  localStorage.setItem("rss_feed_urls", JSON.stringify(urls));
}

/**
 * Retrieves the list of RSS feed URLs from localStorage.
 * @returns Array of RSS feed URLs
 */
export function getSubscriptions(): string[] {
  const stored = localStorage.getItem("rss_feed_urls");
  if (!stored) return [];
  try {
    const urls = JSON.parse(stored);
    return Array.isArray(urls) ? urls : [];
  } catch (e) {
    console.error("Failed to parse subscriptions from localStorage", e);
    return [];
  }
}


// --- 2. Caching Engine (IndexedDB) ---

const DB_NAME = "RSSReaderCache";
const DB_VERSION = 1;
const STORE_NAME = "articles";

/**
 * Initializes the IndexedDB database.
 */
export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("Your browser does not support IndexedDB"));
      return;
    }
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      reject(request.error || new Error("Database failed to open"));
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Use standard ID (GUID or Link) as keyPath for fast lookup and de-duplication
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

/**
 * Cache fetched article items inside IndexedDB.
 * Since keyPath is "id" (the unique article code), duplicate keys will automatically be handled.
 * @param articles List of parsed RSS items
 */
export async function cacheArticles(articles: any[]): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    
    articles.forEach(article => {
      if (article.id) {
        // PUT inserts the record or replaces the existing one with same key to keep it updated without duplicate entries
        store.put(article);
      }
    });

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(transaction.error || new Error("Failed to write articles to IndexedDB"));
    };
  });
}

/**
 * Retrieves all cached RSS articles from IndexedDB.
 */
export async function getCachedArticles(): Promise<any[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      reject(request.error || new Error("Failed to retrieve articles from IndexedDB"));
    };
  });
}


// --- 3. CORS-enabled Fetcher (DOMParser & AllOrigins Proxy) ---

/**
 * Normalizes text content from various element structures.
 */
function getTextValue(element: Element | null): string {
  if (!element) return "";
  return element.textContent?.trim() || "";
}

/**
 * Fetches an RSS or Atom feed XML through a public CORS Proxy and parses it.
 * Cached articles are saved to IndexedDB after a successful retrieve.
 * @param url The actual RSS/Atom feed URL
 */
export async function fetchFeed(url: string): Promise<any[]> {
  // Public, speed-tested CORS proxy
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    throw new Error(`HTTP network error: ${response.status} via CORS Proxy`);
  }
  
  const payload = await response.json();
  const xmlText = payload.contents;
  if (!xmlText) {
    throw new Error("No XML payload returned from CORS proxy");
  }

  // Parse raw text XML using browser's standard DOMParser
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  
  // Check for XML parsing errors
  const parseError = xmlDoc.querySelector("parsererror");
  if (parseError) {
    throw new Error(`XML Parse Error: ${parseError.textContent}`);
  }

  const items: any[] = [];
  const feedTitle = getTextValue(xmlDoc.querySelector("channel > title")) || getTextValue(xmlDoc.querySelector("feed > title")) || "RSS Feed";

  // 1. Check for standard RSS <item> tags
  const rssItems = xmlDoc.querySelectorAll("item");
  if (rssItems.length > 0) {
    rssItems.forEach((item, idx) => {
      const guid = getTextValue(item.querySelector("guid")) || getTextValue(item.querySelector("link")) || `${url}-${idx}`;
      const title = getTextValue(item.querySelector("title")) || "Untitled Article";
      const link = getTextValue(item.querySelector("link"));
      const pubDate = getTextValue(item.querySelector("pubDate")) || getTextValue(item.querySelector("pubdate"));
      const creator = getTextValue(item.querySelector("creator")) || getTextValue(item.querySelector("author")) || getTextValue(item.querySelector("dc\\:creator"));
      const content = getTextValue(item.querySelector("content\\:encoded")) || getTextValue(item.querySelector("content")) || getTextValue(item.querySelector("description"));
      const contentSnippet = getTextValue(item.querySelector("description")).replace(/<[^>]*>/g, "").slice(0, 200);

      // Attempt thumbnail find in enclosure
      let thumbnail = "";
      const enclosure = item.querySelector("enclosure");
      if (enclosure) {
        const encUrl = enclosure.getAttribute("url");
        const encType = enclosure.getAttribute("type") || "";
        if (encUrl && (encType.includes("image") || /\.(jpg|jpeg|png|gif|webp)/i.test(encUrl))) {
          thumbnail = encUrl;
        }
      }
      if (!thumbnail) {
        // Regex image fallback inside content body
        const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (imgMatch) {
          thumbnail = imgMatch[1];
        }
      }

      items.push({
        id: guid,
        title,
        link,
        pubDate,
        creator,
        contentSnippet,
        content,
        thumbnail: thumbnail || undefined,
        feedId: url,
        feedTitle,
        read: false,
        starred: false
      });
    });
  } else {
    // 2. Check for Atom <entry> tags
    const atomEntries = xmlDoc.querySelectorAll("entry");
    atomEntries.forEach((entry, idx) => {
      const id = getTextValue(entry.querySelector("id")) || getTextValue(entry.querySelector("link[rel='alternate']")) || `${url}-${idx}`;
      const title = getTextValue(entry.querySelector("title")) || "Untitled Article";
      
      const linkEl = entry.querySelector("link[rel='alternate']") || entry.querySelector("link:not([rel])") || entry.querySelector("link");
      const link = linkEl ? linkEl.getAttribute("href") || "" : "";
      
      const pubDate = getTextValue(entry.querySelector("published")) || getTextValue(entry.querySelector("updated"));
      const creator = getTextValue(entry.querySelector("author > name")) || getTextValue(entry.querySelector("author"));
      const content = getTextValue(entry.querySelector("content")) || getTextValue(entry.querySelector("summary"));
      const contentSnippet = content.replace(/<[^>]*>/g, "").slice(0, 200);

      // Thumbnail check in standard media tags
      let thumbnail = "";
      const mediaContent = entry.querySelector("media\\:content") || entry.querySelector("content");
      if (mediaContent) {
        const mediaUrl = mediaContent.getAttribute("url");
        if (mediaUrl) thumbnail = mediaUrl;
      }
      if (!thumbnail) {
        const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (imgMatch) {
          thumbnail = imgMatch[1];
        }
      }

      items.push({
        id,
        title,
        link,
        pubDate,
        creator,
        contentSnippet,
        content,
        thumbnail: thumbnail || undefined,
        feedId: url,
        feedTitle,
        read: false,
        starred: false
      });
    });
  }

  // Persist fetched items to IndexedDB cache
  if (items.length > 0) {
    await cacheArticles(items);
  }

  return items;
}


// --- 4. Auto-Loader ---

/**
 * Initializes on page load.
 * Retrieves feed URLs from localStorage and triggers fetch tasks concurrently,
 * storing all mapped results into IndexedDB and returning the absolute list.
 * @returns Combined flat list of all parsed feed items
 */
export async function init(): Promise<any[]> {
  const urls = getSubscriptions();
  if (urls.length === 0) {
    console.log("No subscriptions URLs registered in localStorage.");
    return [];
  }

  console.log(`Auto-loader triggered. Syncing ${urls.length} feed URL channels...`);
  
  // Use settled requests so that if one URL fails, it doesn't crash the whole load chain
  const fetchTasks = urls.map(url => fetchFeed(url));
  const results = await Promise.allSettled(fetchTasks);

  const parsedArticles: any[] = [];
  results.forEach((res, index) => {
    if (res.status === "fulfilled") {
      parsedArticles.push(...res.value);
    } else {
      console.warn(`[Auto-Loader] Refused feed load from ${urls[index]}:`, res.reason);
    }
  });

  return parsedArticles;
}
