import { fetchText } from "@/lib/scrapers/utils";

export interface NewsCrossCheckEntry {
  title: string;
  source: string;
  sourceUrl?: string;
  publishedAt?: string;
  link?: string;
}

export interface NewsCrossCheckResult {
  query: string;
  articleCount: number;
  sources: string[];
  entries: NewsCrossCheckEntry[];
}

const GOOGLE_NEWS_RSS_BASE = "https://news.google.com/rss/search";

export async function fetchGoogleNewsCrossCheck(query: string, limit = 5): Promise<NewsCrossCheckResult | null> {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return null;
  }

  try {
    const params = new URLSearchParams();
    params.set("q", `${trimmed} politics`);
    params.set("hl", "en-US");
    params.set("gl", "US");
    params.set("ceid", "US:en");
    const xml = await fetchText(`${GOOGLE_NEWS_RSS_BASE}?${params.toString()}`);

    const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi))
      .map((match) => match[1] ?? "")
      .map(extractEntry)
      .filter((entry): entry is NewsCrossCheckEntry => Boolean(entry && entry.source))
      .slice(0, Math.max(limit, 1));

    if (items.length === 0) {
      return null;
    }

    const sources = [...new Set(items.map((item) => item.source).filter(Boolean))];

    return {
      query: trimmed,
      articleCount: items.length,
      sources,
      entries: items
    };
  } catch {
    return null;
  }
}

function extractEntry(itemXml: string): NewsCrossCheckEntry | null {
  const title = decodeXml(extractTag(itemXml, "title") ?? "").trim();
  const link = decodeXml(extractTag(itemXml, "link") ?? "").trim();
  const publishedAtRaw = decodeXml(extractTag(itemXml, "pubDate") ?? "").trim();
  const source = decodeXml(extractTag(itemXml, "source") ?? "").trim();
  const sourceUrl = extractTagAttribute(itemXml, "source", "url");

  if (!title || !source) {
    return null;
  }

  const publishedAt = publishedAtRaw ? new Date(publishedAtRaw).toISOString() : undefined;

  return {
    title,
    source,
    sourceUrl: sourceUrl ? decodeXml(sourceUrl) : undefined,
    publishedAt: Number.isNaN(new Date(publishedAt ?? "").getTime()) ? undefined : publishedAt,
    link: link || undefined
  };
}

function extractTag(input: string, tag: string): string | undefined {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = input.match(new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "i"));
  return match?.[1];
}

function extractTagAttribute(input: string, tag: string, attribute: string): string | undefined {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedAttr = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = input.match(new RegExp(`<${escapedTag}[^>]*${escapedAttr}="([^"]+)"`, "i"));
  return match?.[1];
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'");
}
