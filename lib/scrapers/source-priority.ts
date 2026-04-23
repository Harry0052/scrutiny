import type { SourceName } from "@/lib/scrapers/types";

const SOURCE_PRIORITY: Record<SourceName, number> = {
  official_house: 100,
  official_senate: 100,
  fec: 95,
  openstates: 90,
  propublica: 85,
  google_civic: 80,
  state_local: 75,
  opensecrets: 70,
  google_custom_search: 55
};

export function sourcePriority(source: SourceName): number {
  return SOURCE_PRIORITY[source] ?? 0;
}

export function sourceTrustDescription(source: SourceName): string {
  if (source === "official_house" || source === "official_senate" || source === "fec") {
    return "official_record";
  }

  if (source === "openstates" || source === "propublica" || source === "google_civic") {
    return "official_api_or_curated_civic_source";
  }

  if (source === "google_custom_search") {
    return "web_discovery_requires_verification";
  }

  return "public_source";
}
