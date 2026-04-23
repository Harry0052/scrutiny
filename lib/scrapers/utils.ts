import type { SourcePayload } from "@/lib/scrapers/types";

export function emptyPayload(): SourcePayload {
  return {
    politicians: [],
    statements: [],
    bills: [],
    votes: [],
    donorContributions: [],
    financialDisclosures: []
  };
}

export function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function extractTagValue(block: string, tag: string): string | undefined {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)</${escapedTag}>`, "i");
  const match = block.match(regex);
  if (!match) {
    return undefined;
  }

  return decodeXml(match[1]).trim() || undefined;
}

export function extractTagAttribute(block: string, tag: string, attribute: string): string | undefined {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedAttr = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<${escapedTag}[^>]*${escapedAttr}="([^"]+)"`, "i");
  const match = block.match(regex);
  return match?.[1];
}

export function extractBlocks(xml: string, tag: string): string[] {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)</${escapedTag}>`, "gi");
  const blocks: string[] = [];

  for (const match of xml.matchAll(regex)) {
    if (match[0]) {
      blocks.push(match[0]);
    }
  }

  return blocks;
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 15000
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchText(url: string, init?: RequestInit, timeoutMs = 15000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export function coerceDate(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    if (/^\d{8}$/.test(value)) {
      const normalized = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
      const parsed = new Date(normalized);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
    }
    return undefined;
  }

  return date.toISOString();
}

export function parseParty(raw?: string): string | undefined {
  if (!raw) {
    return undefined;
  }

  const upper = raw.trim().toUpperCase();
  if (upper === "D") {
    return "Democratic";
  }
  if (upper === "R") {
    return "Republican";
  }
  if (upper === "I") {
    return "Independent";
  }

  return raw.trim();
}

export function limitRecords<T>(records: T[], limit?: number): T[] {
  if (!limit || limit <= 0) {
    return records;
  }

  return records.slice(0, limit);
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}
