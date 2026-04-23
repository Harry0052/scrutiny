import { sourcePriority } from "@/lib/scrapers/source-priority";
import type { CivicDataProvider, FetchWindow, ProviderResult, RawPoliticianRecord } from "@/lib/scrapers/types";
import { emptyPayload, extractBlocks, extractTagValue, limitRecords, normalizeName, parseParty } from "@/lib/scrapers/utils";

const SENATE_CONTACT_URL = "https://www.senate.gov/general/contact_information/senators_cfm.xml";

export class OfficialSenateConnector implements CivicDataProvider {
  readonly id = "official-senate-directory";
  readonly source = "official_senate" as const;
  readonly priority = sourcePriority(this.source);
  readonly trustTier = "OFFICIAL" as const;

  isConfigured(): boolean {
    return true;
  }

  async fetch(window: FetchWindow = {}): Promise<ProviderResult> {
    const fetchedAt = new Date().toISOString();

    try {
      const response = await fetch(SENATE_CONTACT_URL, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const xml = await response.text();
      const memberBlocks = extractBlocks(xml, "member");
      const query = normalizeName(window.query ?? "");

      const politicians = memberBlocks
        .map((block): RawPoliticianRecord | null => {
          const fullName = [extractTagValue(block, "first_name"), extractTagValue(block, "last_name")]
            .filter(Boolean)
            .join(" ")
            .trim();
          const state = extractTagValue(block, "state");
          if (!fullName) {
            return null;
          }

          const politician: RawPoliticianRecord = {
            source: this.source,
            sourceRecordId:
              extractTagValue(block, "bioguide_id") ?? `${state ?? "US"}-${normalizeName(fullName).replaceAll(" ", "-")}`,
            fullName,
            normalizedFullName: normalizeName(fullName),
            party: parseParty(extractTagValue(block, "party")),
            officeTitle: "U.S. Senator",
            chamber: "Senate",
            jurisdictionLevel: "NATIONAL",
            jurisdictionState: state,
            districtLabel: state ? `${state}-At-Large` : undefined,
            candidateStatus: "OFFICEHOLDER",
            incumbentChallengerStatus: "INCUMBENT",
            officeSought: "U.S. Senate",
            latestActivitySummary: "Current official Senate contact directory entry.",
            sourceUrl: SENATE_CONTACT_URL,
            sourceLabel: "U.S. Senate contact information XML"
          };

          if (query) {
            const haystack = `${politician.normalizedFullName ?? ""} ${normalizeName(politician.jurisdictionState ?? "")} ${normalizeName(
              politician.officeTitle
            )}`;
            if (!haystack.includes(query)) {
              return null;
            }
          }

          if (window.stateCode && politician.jurisdictionState !== window.stateCode.toUpperCase()) {
            return null;
          }

          return politician;
        })
        .filter((record): record is RawPoliticianRecord => Boolean(record));

      return {
        providerId: this.id,
        source: this.source,
        priority: this.priority,
        trustTier: this.trustTier,
        fetchedAt,
        status: "ok",
        note: `Fetched ${politicians.length} official Senate directory records.`,
        payload: {
          ...emptyPayload(),
          politicians: limitRecords(politicians, window.maxRecords)
        }
      };
    } catch (error) {
      return {
        providerId: this.id,
        source: this.source,
        priority: this.priority,
        trustTier: this.trustTier,
        fetchedAt,
        status: "error",
        note: `Senate directory fetch failed: ${error instanceof Error ? error.message : "unknown error"}`,
        payload: emptyPayload()
      };
    }
  }
}
