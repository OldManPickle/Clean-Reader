import { Feed } from "../types";

/**
 * Parses OPML XML text and returns an array of Feed objects.
 */
export function parseOPML(xmlText: string, defaultCategory: string = "Subscriptions"): Feed[] {
  const feeds: Feed[] = [];
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    
    // Check for parse errors
    const parsererror = xmlDoc.querySelector("parsererror");
    if (parsererror) {
      throw new Error(parsererror.textContent || "Invalid XML format");
    }

    const outlines = xmlDoc.querySelectorAll("outline");
    
    outlines.forEach((outline) => {
      const type = outline.getAttribute("type");
      const xmlUrl = outline.getAttribute("xmlUrl");
      const title = outline.getAttribute("title") || outline.getAttribute("text") || "Untitled Feed";
      const htmlUrl = outline.getAttribute("htmlUrl") || "";
      
      // If it has xmlUrl and is of type rss (or if type is omitted and has rss extension)
      if (xmlUrl) {
        // Determine category: if enclosed in a parent outline, use parent's title, otherwise use standard default
        let category = defaultCategory;
        const parent = outline.parentElement;
        if (parent && parent.tagName.toLowerCase() === "outline" && !parent.getAttribute("xmlUrl")) {
          category = parent.getAttribute("title") || parent.getAttribute("text") || defaultCategory;
        }

        feeds.push({
          id: xmlUrl,
          title: title,
          feedUrl: xmlUrl,
          link: htmlUrl || undefined,
          category: category,
          description: outline.getAttribute("description") || undefined
        });
      }
    });
  } catch (error) {
    console.error("Error parsing OPML xml", error);
    throw error;
  }
  return feeds;
}

/**
 * Extracts raw URLs from a bulk copy/pasted multiline text.
 */
export function parseBulkUrls(rawText: string, defaultCategory: string = "Inbox"): Feed[] {
  const feeds: Feed[] = [];
  const lines = rawText.split(/\r?\n/);
  
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return; // skip empty or comments

    // Test if it's a URL
    try {
      const url = new URL(trimmed);
      feeds.push({
        id: url.href,
        title: url.hostname.replace("www.", ""),
        feedUrl: url.href,
        category: defaultCategory
      });
    } catch {
      // Not a valid URL, skip
    }
  });
  
  return feeds;
}

/**
 * Generates an OPML XML string from active feed subscriptions.
 */
export function generateOPML(feeds: Feed[]): string {
  // Group feeds by category
  const categories: Record<string, Feed[]> = {};
  feeds.forEach((feed) => {
    const cat = feed.category || "Subscriptions";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(feed);
  });

  let opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Clean Reader Subscriptions</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
`;

  Object.entries(categories).forEach(([category, catFeeds]) => {
    const escapedCat = escapeXML(category);
    opml += `    <outline text="${escapedCat}" title="${escapedCat}">\n`;
    catFeeds.forEach((feed) => {
      const title = escapeXML(feed.title);
      const xmlUrl = escapeXML(feed.feedUrl);
      const htmlUrl = feed.link ? escapeXML(feed.link) : "";
      const desc = feed.description ? escapeXML(feed.description) : "";
      
      opml += `      <outline type="rss" text="${title}" title="${title}" xmlUrl="${xmlUrl}" htmlUrl="${htmlUrl}" description="${desc}"/>\n`;
    });
    opml += `    </outline>\n`;
  });

  opml += `  </body>
</opml>`;

  return opml;
}

function escapeXML(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}
