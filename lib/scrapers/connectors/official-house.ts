import { sourcePriority } from "@/lib/scrapers/source-priority";
import type { CivicDataProvider, FetchWindow, ProviderResult, RawPoliticianRecord } from "@/lib/scrapers/types";
import { coerceDate, emptyPayload, extractBlocks, extractTagAttribute, extractTagValue, limitRecords, normalizeName, parseParty } from "@/lib/scrapers/utils";

const HOUSE_MEMBER_DATA_URL = "https://clerk.house.gov/xml/lists/MemberData.xml";

export class OfficialHouseConnector implements CivicDataProvider {
  readonly id = "official-house-directory";
  readonly source = "official_house" as const;
  readonly priority = sourcePriority(this.source);
  readonly trustTier = "OFFICIAL" as const;

  isConfigured(): boolean {
    return true;
  }

  async fetch(window: FetchWindow = {}): Promise<ProviderResult> {
    const fetchedAt = new Date().toISOString();

    try {
      const response = await fetch(HOUSE_MEMBER_DATA_URL, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const xml = await response.text();
      const memberBlocks = extractBlocks(xml, "member");
      const query = normalizeName(window.query ?? "");

      const politicians = memberBlocks
        .map((block): RawPoliticianRecord | null => {
          const bioguideId = extractTagValue(block, "bioguideID");
          const officialName = extractTagValue(block, "official-name");
          const firstName = extractTagValue(block, "firstname");
          const lastName = extractTagValue(block, "lastname");
          const district = extractTagValue(block, "district");
          const stateCode = extractTagAttribute(block, "state", "postal-code") ?? undefined;
          const swornDate = extractTagAttribute(block, "sworn-date", "date") ?? extractTagValue(block, "sworn-date");

          const fullName = officialName ?? [firstName, lastName].filter(Boolean).join(" ");
          if (!fullName) {
            return null;
          }

          const politician: RawPoliticianRecord = {
            source: this.source,
            sourceRecordId: bioguideId ?? `${stateCode ?? "US"}-${district ?? "unknown"}-${normalizeName(fullName)}`,
            fullName,
            normalizedFullName: normalizeName(fullName),
            aliases: [extractTagValue(block, "namelist")].filter((item): item is string => Boolean(item)),
            party: parseParty(extractTagValue(block, "party")),
            officeTitle: "U.S. House Representative",
            chamber: "House",
            jurisdictionLevel: "NATIONAL",
            jurisdictionState: stateCode,
            districtLabel: district ? `${stateCode ?? "US"}-${district}` : stateCode,
            candidateStatus: "OFFICEHOLDER",
            incumbentChallengerStatus: "INCUMBENT",
            officeSought: "U.S. House",
            latestActivityAt: coerceDate(swornDate),
            latestActivitySummary: "Current official House member directory entry.",
            sourceUrl: HOUSE_MEMBER_DATA_URL,
            sourceLabel: "Clerk of the U.S. House MemberData.xml"
          };

          if (query) {
            const haystack = `${politician.normalizedFullName ?? ""} ${normalizeName(politician.officeTitle)} ${normalizeName(
              politician.jurisdictionState ?? ""
            )} ${normalizeName(politician.districtLabel ?? "")}`;
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
        note: `Fetched ${politicians.length} official House directory records.`,
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
        note: `House directory fetch failed: ${error instanceof Error ? error.message : "unknown error"}`,
        payload: emptyPayload()
      };
    }
  }
}
