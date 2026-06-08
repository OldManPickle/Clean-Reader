import { Readability } from "@mozilla/readability";
import DOMPurify from "dompurify";

export interface FullArticleResult {
  title: string;
  content: string; // Sanitized HTML
  textContent: string;
  excerpt: string;
  byline: string;
  siteName: string;
}

/**
 * Fetches the raw HTML of any given webpage url through AllOrigins CORS proxy,
 * parses it using Readability.js, and sanitizes the output HTML using DOMPurify.
 */
export async function fetchAndParseArticle(url: string): Promise<FullArticleResult> {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    throw new Error(`Failed to download page (HTTP ${response.status}) via CORS proxy.`);
  }
  
  const payload = await response.json();
  const rawHtml = payload.contents;
  if (!rawHtml) {
    throw new Error("Target webpage HTML is blank or could not be loaded via proxy.");
  }
  
  // HTML document assembly
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, "text/html");
  
  // Make relative URLs absolute so images and links work correctly
  try {
    const baseUri = new URL(url);
    
    // Fix images
    doc.querySelectorAll("img").forEach(img => {
      const src = img.getAttribute("src");
      if (src) {
        try {
          img.setAttribute("src", new URL(src, baseUri).toString());
        } catch {
          // ignore parsing error
        }
      }
    });

    // Fix anchor links
    doc.querySelectorAll("a").forEach(a => {
      const href = a.getAttribute("href");
      if (href) {
        try {
          a.setAttribute("href", new URL(href, baseUri).toString());
          a.setAttribute("target", "_blank");
          a.setAttribute("rel", "noopener noreferrer");
        } catch {
          // ignore parsing error
        }
      }
    });
  } catch (urlErr) {
    console.warn("Base URL parsing for relative links fixing failed:", urlErr);
  }

  // Parse readability DOM
  const reader = new Readability(doc);
  const parsedArticle = reader.parse();
  
  if (!parsedArticle) {
    throw new Error("Standard article readability distillation failed on this webpage.");
  }
  
  // Clean and Sanitize using DOMPurify
  const sanitizedContent = DOMPurify.sanitize(parsedArticle.content, {
    ALLOWED_TAGS: [
      "p", "a", "h1", "h2", "h3", "h4", "h5", "h6", "img", "br", "hr", "blockquote", 
      "ul", "ol", "li", "code", "pre", "span", "strong", "em", "i", "b", "u", "mark", "small", "table", "thead", "tbody", "tr", "th", "td"
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "target", "rel", "referrerpolicy", "class", "style"]
  });
  
  return {
    title: parsedArticle.title || "",
    content: sanitizedContent || "",
    textContent: parsedArticle.textContent || "",
    excerpt: parsedArticle.excerpt || "",
    byline: parsedArticle.byline || "",
    siteName: parsedArticle.siteName || "",
  };
}
