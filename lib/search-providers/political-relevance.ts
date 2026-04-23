/**
 * Political Relevance Validator
 *
 * Validates whether web search results contain evidence of genuine
 * political relevance (officeholder, candidate, election, legislative
 * activity) before accepting them into the CivicWatch pipeline.
 *
 * Google-based retrieval is for discovery, not blind truth.
 * A result must pass political relevance checks based on official
 * office, candidacy, election, campaign, or government evidence.
 */

import type { TrustLevel, WebSearchResult } from "@/lib/search-providers/types";
import { trustLevelWeight } from "@/lib/search-providers/trust-classifier";

export interface RelevanceSignal {
  signal: string;
  weight: number;
  source: "title" | "snippet" | "url" | "domain";
}

export interface RelevanceResult {
  /** Is this result politically relevant enough to use? */
  isRelevant: boolean;
  /** Relevance score 0-100 */
  score: number;
  /** Individual signals that contributed to the score */
  signals: RelevanceSignal[];
  /** Why the result was accepted or rejected */
  reason: string;
  /** Best-guess figure status if detectable */
  inferredStatus: "OFFICEHOLDER" | "CANDIDATE" | "FORMER_OFFICEHOLDER" | "UNKNOWN";
  /** Best-guess jurisdiction if detectable */
  inferredJurisdiction: "NATIONAL" | "STATE" | "LOCAL" | "UNKNOWN";
  /** Trust level of the source */
  trustLevel: TrustLevel;
}

// ── Office / role patterns ──────────────────────────────────────────

const OFFICEHOLDER_PATTERNS = [
  /\b(senator|sen\.)\b/i,
  /\b(representative|rep\.)\b/i,
  /\b(congress(?:man|woman|member|person))\b/i,
  /\bgovernor\b/i,
  /\b(mayor|city council|council\s?(?:member|woman|man|person))\b/i,
  /\b(state\s(?:senator|representative|legislator|assemblymember))\b/i,
  /\b(attorney general|secretary of state|treasurer|comptroller)\b/i,
  /\b(county (?:executive|commissioner|supervisor|clerk))\b/i,
  /\b(school board)\b/i,
  /\b(sheriff|district attorney|alderman|selectman|selectwoman)\b/i,
  /\b(lt\.?\s?governor|lieutenant governor)\b/i,
  /\bpresident\b/i,
  /\bvice president\b/i,
];

const CANDIDATE_PATTERNS = [
  /\bcandidate\b/i,
  /\brunning for\b/i,
  /\bcampaign(s|ing)?\b/i,
  /\belection\b/i,
  /\bprimary\b/i,
  /\bannounce[ds]?\s+(candidacy|bid|run)\b/i,
  /\bseeks?\s+(office|seat|election|re-?election)\b/i,
  /\bchallenger\b/i,
  /\bincumbent\b/i,
  /\b(filed|filing)\s+(for|to)\s+run\b/i,
];

const LEGISLATIVE_PATTERNS = [
  /\bvot(ed|es|ing)\b/i,
  /\b(bill|legislation|amendment|resolution)\b/i,
  /\b(yea|nay|abstain)\b/i,
  /\broll\s*call\b/i,
  /\bcommittee\b/i,
  /\b(floor vote|house vote|senate vote)\b/i,
  /\b(co-?sponsor|sponsor)\b/i,
];

const FINANCE_PATTERNS = [
  /\b(donor|donation|contribution|fundrais)\b/i,
  /\b(pac|super\s?pac|political action)\b/i,
  /\b(campaign finance|fec filing)\b/i,
  /\b(financial disclosure|assets|net worth)\b/i,
  /\b(lobbyist|lobbying)\b/i,
];

const GOVERNMENT_PATTERNS = [
  /\b(sworn in|took office|inaugurat)\b/i,
  /\b(appointed|confirmed|nominated)\b/i,
  /\b(executive order|signing ceremony)\b/i,
  /\b(official|office of|bureau of)\b/i,
];

// ── Jurisdiction patterns ───────────────────────────────────────────

const NATIONAL_PATTERNS = [
  /\b(u\.?s\.?\s?(senate|house|congress))\b/i,
  /\bfederal\b/i,
  /\b(president|vice president)\b/i,
  /\bcongress\b/i,
  /\bcapitol hill\b/i,
];

const STATE_PATTERNS = [
  /\b(state (senate|house|assembly|legislature|legislator|representative))\b/i,
  /\bgovernor\b/i,
  /\b(attorney general|secretary of state)\b/i,
  /\b(state capitol|state government)\b/i,
];

const LOCAL_PATTERNS = [
  /\b(city council|mayor|alderman)\b/i,
  /\b(county (commissioner|supervisor|executive|board))\b/i,
  /\b(school board|school district)\b/i,
  /\b(town (council|board|meeting))\b/i,
  /\b(municipal|local government)\b/i,
  /\bsheriff\b/i,
  /\bdistrict attorney\b/i,
];

// ── Rejection patterns (non-political or irrelevant) ───────────────

const REJECTION_PATTERNS = [
  /\b(linkedin\.com\/in\/)\b/i,
  /\b(facebook\.com\/(?!.*(?:official|campaign|committee)))/i,
  /\b(instagram\.com\/(?!.*(?:official|campaign)))/i,
  /\b(tiktok\.com)\b/i,
  /\b(pinterest\.com)\b/i,
  /\b(yelp\.com)\b/i,
  /\b(whitepages|spokeo|beenverified|peoplefinder|truepeoplesearch)\b/i,
  /\b(ancestry\.com|findagrave)\b/i,
  /\b(imdb\.com)\b/i,
  /\b(ratemyprofessor|rate\s?my)\b/i,
];

// ── Scoring ─────────────────────────────────────────────────────────

function collectSignals(result: WebSearchResult): RelevanceSignal[] {
  const signals: RelevanceSignal[] = [];
  const text = `${result.title} ${result.snippet}`;
  const url = result.link;

  // Check rejection patterns first
  for (const pattern of REJECTION_PATTERNS) {
    if (pattern.test(url) || pattern.test(result.displayLink)) {
      signals.push({ signal: "non_political_domain", weight: -80, source: "url" });
      return signals; // early exit on hard reject
    }
  }

  // Trust level signal
  const trustWeight = trustLevelWeight(result.trustLevel);
  if (trustWeight >= 0.8) {
    signals.push({
      signal: `high_trust_source:${result.trustLevel}`,
      weight: 30 * trustWeight,
      source: "domain",
    });
  } else if (trustWeight >= 0.5) {
    signals.push({
      signal: `moderate_trust_source:${result.trustLevel}`,
      weight: 15 * trustWeight,
      source: "domain",
    });
  }

  // Officeholder evidence
  for (const pattern of OFFICEHOLDER_PATTERNS) {
    if (pattern.test(text)) {
      signals.push({ signal: "officeholder_title_mention", weight: 25, source: "snippet" });
      break; // one hit is enough
    }
  }

  // Candidate evidence
  for (const pattern of CANDIDATE_PATTERNS) {
    if (pattern.test(text)) {
      signals.push({ signal: "candidate_mention", weight: 20, source: "snippet" });
      break;
    }
  }

  // Legislative evidence
  for (const pattern of LEGISLATIVE_PATTERNS) {
    if (pattern.test(text)) {
      signals.push({ signal: "legislative_activity", weight: 15, source: "snippet" });
      break;
    }
  }

  // Finance evidence
  for (const pattern of FINANCE_PATTERNS) {
    if (pattern.test(text)) {
      signals.push({ signal: "political_finance", weight: 12, source: "snippet" });
      break;
    }
  }

  // Government evidence
  for (const pattern of GOVERNMENT_PATTERNS) {
    if (pattern.test(text)) {
      signals.push({ signal: "government_role", weight: 18, source: "snippet" });
      break;
    }
  }

  // URL-based signals
  if (/\.gov\b/i.test(url)) {
    signals.push({ signal: "gov_domain", weight: 25, source: "url" });
  }
  if (/ballotpedia\.org/i.test(url)) {
    signals.push({ signal: "ballotpedia_page", weight: 22, source: "url" });
  }
  if (/votesmart\.org/i.test(url)) {
    signals.push({ signal: "votesmart_page", weight: 20, source: "url" });
  }
  if (/opensecrets\.org/i.test(url)) {
    signals.push({ signal: "opensecrets_page", weight: 18, source: "url" });
  }

  // Search position bonus (higher position = more likely relevant)
  if (result.resultPosition <= 3) {
    signals.push({ signal: "top_search_position", weight: 8, source: "domain" });
  }

  return signals;
}

function inferStatus(signals: RelevanceSignal[], text: string): RelevanceResult["inferredStatus"] {
  if (signals.some((s) => s.signal === "officeholder_title_mention") || /\b(current|serving)\b/i.test(text)) {
    return "OFFICEHOLDER";
  }
  if (signals.some((s) => s.signal === "candidate_mention")) {
    return "CANDIDATE";
  }
  if (/\bformer\b/i.test(text) || /\bex-\b/i.test(text) || /\bretired\b/i.test(text)) {
    return "FORMER_OFFICEHOLDER";
  }
  return "UNKNOWN";
}

function inferJurisdiction(text: string): RelevanceResult["inferredJurisdiction"] {
  for (const pattern of NATIONAL_PATTERNS) {
    if (pattern.test(text)) return "NATIONAL";
  }
  for (const pattern of STATE_PATTERNS) {
    if (pattern.test(text)) return "STATE";
  }
  for (const pattern of LOCAL_PATTERNS) {
    if (pattern.test(text)) return "LOCAL";
  }
  return "UNKNOWN";
}

// ── Public API ──────────────────────────────────────────────────────

const RELEVANCE_THRESHOLD = 30;

export function validatePoliticalRelevance(result: WebSearchResult): RelevanceResult {
  const signals = collectSignals(result);
  const score = Math.max(0, Math.min(100, signals.reduce((sum, s) => sum + s.weight, 0)));
  const text = `${result.title} ${result.snippet}`;
  const isRelevant = score >= RELEVANCE_THRESHOLD;

  const positiveSignals = signals.filter((s) => s.weight > 0);
  const reason = isRelevant
    ? `Passed: ${positiveSignals.map((s) => s.signal).join(", ")}`
    : score <= 0
      ? "Rejected: matched non-political or generic people-search domain"
      : `Below threshold (${score}/${RELEVANCE_THRESHOLD}): insufficient political evidence`;

  return {
    isRelevant,
    score,
    signals,
    reason,
    inferredStatus: inferStatus(signals, text),
    inferredJurisdiction: inferJurisdiction(text),
    trustLevel: result.trustLevel,
  };
}

/**
 * Filter and rank web results by political relevance.
 * Returns only results that pass the relevance threshold,
 * sorted by relevance score descending.
 */
export function filterByPoliticalRelevance(
  results: WebSearchResult[]
): Array<WebSearchResult & { relevance: RelevanceResult }> {
  return results
    .map((result) => ({
      ...result,
      relevance: validatePoliticalRelevance(result),
    }))
    .filter((r) => r.relevance.isRelevant)
    .sort((a, b) => b.relevance.score - a.relevance.score);
}
