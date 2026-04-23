/**
 * Result Normalizer
 *
 * Transforms validated Google web search results into CivicWatch's
 * PeopleSearchResult format. Extracts person names, office titles,
 * locations, and party affiliations from search result titles and snippets.
 *
 * This is best-effort extraction from unstructured web text.
 * Results are marked with lower confidence and require verification
 * through official sources before being treated as authoritative.
 */

import type { RelevanceResult } from "@/lib/search-providers/political-relevance";
import type { WebSearchResult } from "@/lib/search-providers/types";
import type { PeopleSearchResult } from "@/lib/services/search/types";

interface EnrichedWebResult extends WebSearchResult {
  relevance: RelevanceResult;
}

// ── Name extraction patterns ────────────────────────────────────────

const TITLE_OFFICE_PREFIXES = [
  "senator", "sen.", "rep.", "representative", "governor", "gov.",
  "mayor", "president", "vice president", "lt. governor",
  "attorney general", "ag", "secretary of state",
];

const STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
]);

const STATE_NAMES: Record<string, string> = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
  "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
  "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
  "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
  "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
  "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
  "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
  "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
  "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
  "wisconsin": "WI", "wyoming": "WY", "district of columbia": "DC",
};

const PARTY_PATTERNS: Array<[RegExp, string]> = [
  [/\b\(D\b[-–)]?/i, "Democratic"],
  [/\b\(R\b[-–)]?/i, "Republican"],
  [/\b\(I\b[-–)]?/i, "Independent"],
  [/\bDemocrat(?:ic)?\b/i, "Democratic"],
  [/\bRepublican\b/i, "Republican"],
  [/\bIndependent\b/i, "Independent"],
  [/\bLibertarian\b/i, "Libertarian"],
  [/\bGreen Party\b/i, "Green"],
];

// ── Extraction functions ────────────────────────────────────────────

function extractPersonName(title: string, snippet: string): string | null {
  // Try title first — often in format "Name - Office" or "Office Name"
  let cleaned = title;

  // Strip common suffixes
  cleaned = cleaned
    .replace(/\s*[-–|•·]\s*.+$/, "") // "Name - Something"
    .replace(/\s*\|.+$/, "")          // "Name | Something"
    .replace(/\(.+?\)/g, "")          // Remove parentheticals
    .trim();

  // If title starts with an office prefix, try to extract name after it
  const lowerTitle = title.toLowerCase();
  for (const prefix of TITLE_OFFICE_PREFIXES) {
    const idx = lowerTitle.indexOf(prefix);
    if (idx === 0) {
      const afterPrefix = title.slice(prefix.length).trim();
      const nameMatch = afterPrefix.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/);
      if (nameMatch) {
        return nameMatch[1].trim();
      }
    }
  }

  // Try to find a capitalized name pattern in the cleaned title
  const namePattern = cleaned.match(/^([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?(?:\s+[A-Z][a-z]+){0,3})/);
  if (namePattern) {
    const candidate = namePattern[1].trim();
    // Reject if it looks like an organization/site name
    if (candidate.split(/\s+/).length >= 2 && candidate.length <= 50) {
      return candidate;
    }
  }

  // Fall back to snippet — look for "Name (Party-State)" pattern
  const snippetNameMatch = snippet.match(
    /([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?(?:\s+[A-Z][a-z]+){1,3})\s*\([DRIG][-–]/
  );
  if (snippetNameMatch) {
    return snippetNameMatch[1].trim();
  }

  return null;
}

function extractOffice(title: string, snippet: string): string {
  const text = `${title} ${snippet}`.toLowerCase();

  // Specific offices in priority order
  const offices: Array<[RegExp, string]> = [
    [/\bu\.?s\.?\s*senator\b/i, "U.S. Senator"],
    [/\bu\.?s\.?\s*representative\b/i, "U.S. Representative"],
    [/\bu\.?s\.?\s*house\b/i, "U.S. Representative"],
    [/\bu\.?s\.?\s*congress\b/i, "U.S. Congress"],
    [/\bgovernor\b/i, "Governor"],
    [/\blt\.?\s*governor\b/i, "Lt. Governor"],
    [/\blieutenant governor\b/i, "Lt. Governor"],
    [/\battorney general\b/i, "Attorney General"],
    [/\bsecretary of state\b/i, "Secretary of State"],
    [/\bstate senator\b/i, "State Senator"],
    [/\bstate representative\b/i, "State Representative"],
    [/\bstate assembl/i, "State Assembly"],
    [/\bmayor\b/i, "Mayor"],
    [/\bcity council/i, "City Council"],
    [/\bcounty commissioner\b/i, "County Commissioner"],
    [/\bcounty supervisor\b/i, "County Supervisor"],
    [/\bschool board\b/i, "School Board"],
    [/\bsheriff\b/i, "Sheriff"],
    [/\bdistrict attorney\b/i, "District Attorney"],
    [/\bsenator\b/i, "Senator"],
    [/\brepresentative\b/i, "Representative"],
    [/\bcouncil\s?member\b/i, "Council Member"],
  ];

  for (const [pattern, label] of offices) {
    if (pattern.test(text)) {
      return label;
    }
  }

  return "Political Figure";
}

function extractState(title: string, snippet: string, url: string): string | null {
  const text = `${title} ${snippet} ${url}`;

  // Look for state codes in parenthetical context like (D-CA) or (R-TX)
  const partyStateMatch = text.match(/\([DRIG][-–]([A-Z]{2})\)/);
  if (partyStateMatch && STATE_CODES.has(partyStateMatch[1])) {
    return partyStateMatch[1];
  }

  // Look for standalone state codes
  for (const code of STATE_CODES) {
    const codePattern = new RegExp(`\\b${code}\\b`);
    if (codePattern.test(text)) {
      return code;
    }
  }

  // Look for full state names
  const lowerText = text.toLowerCase();
  for (const [name, code] of Object.entries(STATE_NAMES)) {
    if (lowerText.includes(name)) {
      return code;
    }
  }

  return null;
}

function extractParty(title: string, snippet: string): string | null {
  const text = `${title} ${snippet}`;
  for (const [pattern, label] of PARTY_PATTERNS) {
    if (pattern.test(text)) {
      return label;
    }
  }
  return null;
}

function extractDistrict(title: string, snippet: string): string | null {
  const text = `${title} ${snippet}`;
  const match = text.match(/\b(?:district|dist\.?)\s*#?\s*(\d+)\b/i);
  if (match) {
    return match[1];
  }

  // Congressional district pattern like "CA-12" or "TX 5th"
  const cdMatch = text.match(/\b[A-Z]{2}[-\s](\d{1,2})(?:st|nd|rd|th)?\b/);
  if (cdMatch) {
    return cdMatch[1];
  }

  return null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Normalize a validated web search result into a CivicWatch PeopleSearchResult.
 * Returns null if a person name cannot be extracted.
 */
export function normalizeWebResult(
  result: EnrichedWebResult
): (PeopleSearchResult & { sourceUrls: string[]; discoverySource: string }) | null {
  const name = extractPersonName(result.title, result.snippet);
  if (!name) {
    return null;
  }

  const office = extractOffice(result.title, result.snippet);
  const state = extractState(result.title, result.snippet, result.link);
  const party = extractParty(result.title, result.snippet);
  const district = extractDistrict(result.title, result.snippet);

  const jurisdictionLevel = result.relevance.inferredJurisdiction === "UNKNOWN"
    ? (office.startsWith("U.S.") || office === "Senator" || office === "Representative"
      ? "NATIONAL"
      : office.startsWith("State") || office === "Governor"
        ? "STATE"
        : "LOCAL")
    : result.relevance.inferredJurisdiction;

  const candidateStatus = result.relevance.inferredStatus === "UNKNOWN"
    ? "OFFICEHOLDER"
    : result.relevance.inferredStatus;

  const slug = slugify(
    `${name}-${jurisdictionLevel}-${state ?? ""}-${office}-${district ?? ""}`
  );

  return {
    id: `web:google_cse:${slug}`,
    politicianId: `web:google_cse:${slug}`,
    slug: slug || `web-${Date.now()}`,
    fullName: name,
    officeDisplay: office,
    officeHeld: candidateStatus === "OFFICEHOLDER" ? office : null,
    officeSought: candidateStatus === "CANDIDATE" ? office : null,
    jurisdictionLevel,
    city: null,
    county: null,
    state,
    district,
    chamber: null,
    party,
    candidateStatus,
    incumbentChallengerStatus: "UNKNOWN",
    electionYear: null,
    issueTags: [],
    honestyScore: null,
    donorVolumeUsd: 0,
    recentVotesCount: 0,
    latestDisclosureYear: null,
    latestActivityAt: null,
    latestActivitySummary: result.snippet.slice(0, 200),
    relevanceScore: result.relevance.score,
    politicalRelevanceScore: result.relevance.score,
    relevanceReason: `web discovery via ${result.trustLevel} source`,
    sourceUrls: [result.link],
    discoverySource: "google_custom_search",
  };
}

/**
 * Normalize and deduplicate a batch of validated web results.
 * Deduplication is by normalized name + state + office.
 */
export function normalizeWebResults(
  results: EnrichedWebResult[]
): Array<PeopleSearchResult & { sourceUrls: string[]; discoverySource: string }> {
  const seen = new Map<string, PeopleSearchResult & { sourceUrls: string[]; discoverySource: string }>();

  for (const result of results) {
    const normalized = normalizeWebResult(result);
    if (!normalized) continue;

    const dedupeKey = [
      normalized.fullName.toLowerCase().replace(/\s+/g, " ").trim(),
      normalized.state ?? "",
      normalized.officeDisplay.toLowerCase(),
    ].join("|");

    const existing = seen.get(dedupeKey);
    if (existing) {
      // Merge source URLs, keep higher-scored version
      existing.sourceUrls = [...new Set([...existing.sourceUrls, ...normalized.sourceUrls])];
      if (normalized.relevanceScore > existing.relevanceScore) {
        seen.set(dedupeKey, {
          ...normalized,
          sourceUrls: existing.sourceUrls,
        });
      }
    } else {
      seen.set(dedupeKey, normalized);
    }
  }

  return Array.from(seen.values());
}
