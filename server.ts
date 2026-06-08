import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Parser from "rss-parser";

interface FeedItem {
  id: string;
  title: string;
  link: string;
  pubDate?: string;
  creator?: string;
  contentSnippet?: string;
  content?: string;
  categories?: string[];
  thumbnail?: string;
}

interface ParsedFeed {
  title: string;
  description?: string;
  link?: string;
  feedUrl: string;
  items: FeedItem[];
}

const app = express();
const PORT = 3000;

app.use(express.json());

// API: Discover Curated Feeds
app.get("/api/discover-feeds", (req, res) => {
  const curated = [
    {
      category: "Technology & Coding",
      description: "Stay ahead with the latest in software, product design, and tech breakthroughs",
      feeds: [
        { title: "Hacker News", feedUrl: "https://news.ycombinator.com/rss", description: "Top posts from Hacker News", siteUrl: "https://news.ycombinator.com" },
        { title: "TechCrunch", feedUrl: "https://techcrunch.com/feed/", description: "Startup and technology news", siteUrl: "https://techcrunch.com" },
        { title: "The Verge", feedUrl: "https://www.theverge.com/rss/index.xml", description: "Technology, science, art, and culture", siteUrl: "https://www.theverge.com" },
        { title: "Smashing Magazine", feedUrl: "https://www.smashingmagazine.com/feed/", description: "For web designers and developers", siteUrl: "https://www.smashingmagazine.com" },
        { title: "Wired", feedUrl: "https://www.wired.com/feed/rss", description: "What's next in science & tech", siteUrl: "https://www.wired.com" }
      ]
    },
    {
      category: "Global News",
      description: "Keep up with international updates, business, and finance news",
      feeds: [
        { title: "BBC News - World", feedUrl: "http://feeds.bbci.co.uk/news/world/rss.xml", description: "International news from the BBC", siteUrl: "https://www.bbc.com/news" },
        { title: "NPR News", feedUrl: "https://feeds.npr.org/1001/rss.xml", description: "U.S. and world news audio highlights", siteUrl: "https://www.npr.org" },
        { title: "NYT International", feedUrl: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", description: "New York Times global reporting", siteUrl: "https://www.nytimes.com" },
        { title: "WSJ - World News", feedUrl: "https://feeds.a.dj.com/rss/RSSWorldNews.xml", description: "Global financial and business news", siteUrl: "https://www.wsj.com" }
      ]
    },
    {
      category: "Science & Space",
      description: "Explore the mysteries of cosmology, nature, and deep-space missions",
      feeds: [
        { title: "NASA Image of the Day", feedUrl: "https://www.nasa.gov/rss/dyn/image_of_the_day.rss", description: "Spectacular daily space photography", siteUrl: "https://www.nasa.gov" },
        { title: "Scientific American", feedUrl: "https://www.scientificamerican.com/feed/", description: "Leading popular science publication", siteUrl: "https://www.scientificamerican.com" },
        { title: "Space.com", feedUrl: "https://www.space.com/feeds/all", description: "Space exploration, astronomy, and sci-fi", siteUrl: "https://www.space.com" },
        { title: "Nature Journal", feedUrl: "http://feeds.nature.com/nature/rss/current", description: "Weekly international journal of science", siteUrl: "https://www.nature.com" }
      ]
    },
    {
      category: "Design & Culture",
      description: "Feeds focused on lifestyle, minimalism, and digital arts",
      feeds: [
        { title: "Core77 Design", feedUrl: "https://www.core77.com/blog/rss", description: "Industrial design magazine and resource", siteUrl: "https://www.core77.com" },
        { title: "Zen Habits", feedUrl: "https://zenhabits.net/feed/", description: "Finding simplicity and mindfulness in daily life", siteUrl: "https://zenhabits.net" },
        { title: "Aeon Magazine", feedUrl: "https://aeon.co/feed.rss", description: "Philosophy, science, psychology and society essays", siteUrl: "https://aeon.co" }
      ]
    }
  ];
  res.json({ categories: curated });
});

// API: Parse a single feed
app.get("/api/parse-feed", async (req, res) => {
  const feedUrl = req.query.url as string;
  if (!feedUrl) {
    return res.status(400).json({ error: "Missing feed URL parameter 'url'" });
  }

  try {
    const parser = new Parser();
    let xmlText = "";

    try {
      // 1. Double protection: fetch with custom browser headers to evade strict CDN/WAF blockers
      const response = await fetch(feedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/rss+xml, application/rdf+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        },
        signal: AbortSignal.timeout(12000) // 12 seconds abort
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP status ${response.status}`);
      }
      xmlText = await response.text();
    } catch (networkError: any) {
      console.warn(`Direct fetch failed for ${feedUrl}, falling back to native parser fetching:`, networkError.message);
      // Fallback: let rss-parser try directly if our fetch block failed
      const parsedDirect = await parser.parseURL(feedUrl);
      
      const formattedItems: FeedItem[] = (parsedDirect.items || []).map((item, idx) => {
        // Find thumbnails in enclosures or descriptions
        let thumbnail = "";
        if (item.enclosure && item.enclosure.url && item.enclosure.type?.includes("image")) {
          thumbnail = item.enclosure.url;
        }

        return {
          id: item.guid || item.id || item.link || `${feedUrl}-${idx}`,
          title: item.title || "Untitled Article",
          link: item.link || "",
          pubDate: item.pubDate || item.isoDate || undefined,
          creator: item.creator || item.author || undefined,
          contentSnippet: item.contentSnippet || undefined,
          content: item.content || undefined,
          categories: item.categories || undefined,
          thumbnail: thumbnail || undefined
        };
      });

      return res.json({
        title: parsedDirect.title || "Unnamed Feed",
        description: parsedDirect.description || "",
        link: parsedDirect.link || "",
        feedUrl,
        items: formattedItems
      });
    }

    // Parse the retrieved XML string
    const parsed = await parser.parseString(xmlText);
    
    // Process items & normalize them
    const formattedItems: FeedItem[] = (parsed.items || []).map((item, idx) => {
      let thumbnail = "";
      
      // Attempt to extract thumbnail from image enclosures
      if (item.enclosure && item.enclosure.url && item.enclosure.type?.includes("image")) {
        thumbnail = item.enclosure.url;
      }
      
      // If enclosure isn't present, search in description if possible (regex-based image extraction)
      if (!thumbnail && item.content) {
        const match = item.content.match(/<img[^>]+src="([^">]+)"/);
        if (match) {
          thumbnail = match[1];
        }
      }
      if (!thumbnail && item.contentSnippet) {
        const match = item.contentSnippet.match(/<img[^>]+src="([^">]+)"/);
        if (match) {
          thumbnail = match[1];
        }
      }

      return {
        id: item.guid || item.id || item.link || `${feedUrl}-${idx}`,
        title: item.title || "Untitled Article",
        link: item.link || "",
        pubDate: item.pubDate || item.isoDate || undefined,
        creator: item.creator || item.author || undefined,
        contentSnippet: item.contentSnippet || undefined,
        content: item.content || undefined,
        categories: item.categories || undefined,
        thumbnail: thumbnail || undefined
      };
    });

    const feedResponse: ParsedFeed = {
      title: parsed.title || "Unnamed Feed",
      description: parsed.description || "",
      link: parsed.link || "",
      feedUrl,
      items: formattedItems
    };

    res.json(feedResponse);
  } catch (err: any) {
    console.error(`Failed parsing feed: ${feedUrl}`, err);
    res.status(500).json({ error: `Could not parse RSS/Atom feed: ${err.message}` });
  }
});

// Configure Vite or Static Assets based on Environment
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Setting up development server with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Setting up production server with static hosting...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

bootstrap();
