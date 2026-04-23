/**
 * Domain Trust Classifier
 *
 * Classifies web search result URLs into trust levels based on domain
 * patterns. Used to determine how much weight to give a web discovery
 * result before political relevance validation.
 */

import type { TrustLevel } from "@/lib/search-providers/types";

const OFFICIAL_GOVERNMENT_PATTERNS = [
  /\.gov$/i,
  /\.gov\//i,
  /congress\.gov/i,
  /senate\.gov/i,
  /house\.gov/i,
  /whitehouse\.gov/i,
  /sos\.\w+\.gov/i,
  /elections?\.\w+\.gov/i,
  /legislature\.\w+\.gov/i,
  /legis\.\w+\.gov/i,
];

const OFFICIAL_ELECTION_PATTERNS = [
  /ballotpedia\.org/i,
  /vote\.org/i,
  /votesmart\.org/i,
  /fec\.gov/i,
  /followthemoney\.org/i,
  /lwv\.org/i,
  /vote411\.org/i,
  /isidewith\.com/i,
];

const OFFICIAL_CAMPAIGN_PATTERNS = [
  /.*for(congress|senate|governor|mayor|council|house|assembly|president)/i,
  /.*campaign\.com/i,
  /.*elect.*\.com/i,
  /.*\d{4}\.com/i, // candidate2024.com pattern
];

const TRUSTED_CIVIC_PATTERNS = [
  /opensecrets\.org/i,
  /propublica\.org/i,
  /govtrack\.us/i,
  /legistorm\.com/i,
  /openstates\.org/i,
  /congress\.gov/i,
  /sunlightfoundation\.com/i,
  /commoncause\.org/i,
  /maplight\.org/i,
  /responsivepolitics\.org/i,
  /ncsl\.org/i,
  /nga\.org/i,
  /naco\.org/i,
  /nlc\.org/i,
  /icma\.org/i,
  /justfacts\.votesmart\.org/i,
];

const NEWS_MEDIA_PATTERNS = [
  /reuters\.com/i,
  /apnews\.com/i,
  /bbc\.com/i,
  /bbc\.co\.uk/i,
  /npr\.org/i,
  /pbs\.org/i,
  /c-span\.org/i,
  /politico\.com/i,
  /thehill\.com/i,
  /rollcall\.com/i,
  /washingtonpost\.com/i,
  /nytimes\.com/i,
  /wsj\.com/i,
  /usatoday\.com/i,
  /latimes\.com/i,
  /cnn\.com/i,
  /nbcnews\.com/i,
  /cbsnews\.com/i,
  /abcnews\.go\.com/i,
  /foxnews\.com/i,
  /msnbc\.com/i,
  /axios\.com/i,
  /fivethirtyeight\.com/i,
  /stateline\.org/i,
  /governing\.com/i,
  /routefifty\.com/i,
  /poynter\.org/i,
];

export function classifyDomainTrust(url: string): TrustLevel {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const fullUrl = url.toLowerCase();

    for (const pattern of OFFICIAL_GOVERNMENT_PATTERNS) {
      if (pattern.test(hostname) || pattern.test(fullUrl)) {
        return "official_government";
      }
    }

    for (const pattern of OFFICIAL_ELECTION_PATTERNS) {
      if (pattern.test(hostname) || pattern.test(fullUrl)) {
        return "official_election";
      }
    }

    for (const pattern of TRUSTED_CIVIC_PATTERNS) {
      if (pattern.test(hostname) || pattern.test(fullUrl)) {
        return "trusted_civic";
      }
    }

    for (const pattern of NEWS_MEDIA_PATTERNS) {
      if (pattern.test(hostname) || pattern.test(fullUrl)) {
        return "news_media";
      }
    }

    for (const pattern of OFFICIAL_CAMPAIGN_PATTERNS) {
      if (pattern.test(hostname)) {
        return "official_campaign";
      }
    }

    return "unverified_web";
  } catch {
    return "unverified_web";
  }
}

/**
 * Returns a numeric weight for how much to trust a result from this domain
 * tier during political relevance scoring. Higher = more trusted.
 */
export function trustLevelWeight(level: TrustLevel): number {
  switch (level) {
    case "official_government":
      return 1.0;
    case "official_election":
      return 0.95;
    case "official_campaign":
      return 0.8;
    case "trusted_civic":
      return 0.85;
    case "news_media":
      return 0.6;
    case "unverified_web":
      return 0.2;
    case "rejected":
      return 0;
  }
}
