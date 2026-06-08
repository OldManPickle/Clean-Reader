export interface FeedItem {
  id: string;
  title: string;
  link: string;
  pubDate?: string;
  creator?: string;
  contentSnippet?: string;
  content?: string;
  categories?: string[];
  thumbnail?: string;
  
  // Client-managed fields
  feedId: string;
  feedTitle: string;
  read: boolean;
  starred: boolean;
}

export interface Feed {
  id: string; // usually same as feedUrl
  title: string;
  description?: string;
  link?: string;
  feedUrl: string;
  category: string; // Folder/group (e.g., "Technology", "Global News")
  lastFetched?: string;
  error?: string;
}

export interface CuratedFeed {
  title: string;
  feedUrl: string;
  description: string;
  siteUrl: string;
}

export interface CuratedCategory {
  category: string;
  description: string;
  feeds: CuratedFeed[];
}

export type ViewLayout = "list" | "grid";
export type FilterType = "all" | "unread" | "starred";

export interface AppSettings {
  readingFontSize: "sm" | "base" | "lg" | "xl";
  readingFontFamily: "sans" | "serif" | "mono";
  autoMarkReadScroll: boolean;
  theme: "light" | "warm" | "dark";
  openDirectly?: boolean;
  useClientCorsProxy?: boolean;
}
