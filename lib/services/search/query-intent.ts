export interface ParsedPeopleQuery {
  raw: string;
  normalized: string;
  tokens: string[];
  officeHints: string[];
  stateHints: string[];
  locationHints: string[];
  districtHints: string[];
  nameHints: string[];
  statusHints: Array<"CANDIDATE" | "OFFICEHOLDER" | "FORMER_OFFICEHOLDER">;
  jurisdictionHints: Array<"LOCAL" | "STATE" | "NATIONAL">;
}

const STOP_WORDS = new Set([
  "of",
  "for",
  "the",
  "in",
  "at",
  "on",
  "and",
  "or",
  "to",
  "from",
  "near",
  "with",
  "by"
]);

const OFFICE_HINTS = [
  "city council",
  "school board",
  "county supervisor",
  "county commissioner",
  "district attorney",
  "attorney general",
  "secretary of state",
  "state senate",
  "state assembly",
  "state house",
  "state representative",
  "state legislator",
  "u.s. house",
  "house representative",
  "u.s. senate",
  "senate",
  "senator",
  "representative",
  "governor",
  "lt governor",
  "lieutenant governor",
  "mayor",
  "sheriff",
  "president",
  "council"
] as const;

const STATE_MAP: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC"
};

const STATE_CODES = new Set(Object.values(STATE_MAP));

export function normalizeSearchText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parsePeopleQuery(query: string): ParsedPeopleQuery {
  const normalized = normalizeSearchText(query);
  const tokens = normalized.split(" ").filter(Boolean);
  if (!normalized) {
    return {
      raw: query,
      normalized: "",
      tokens: [],
      officeHints: [],
      stateHints: [],
      locationHints: [],
      districtHints: [],
      nameHints: [],
      statusHints: [],
      jurisdictionHints: []
    };
  }

  const officeHints = OFFICE_HINTS.filter((office) => normalized.includes(office));
  const jurisdictionHints = inferJurisdictionHints(officeHints, normalized);
  const stateHints = inferStateHints(normalized, tokens);
  const stateNameTokens = inferStateNameTokens(normalized);
  const districtHints = inferDistrictHints(normalized);
  const statusHints = inferStatusHints(normalized);
  const locationHints = inferLocationHints(normalized, tokens, officeHints, stateHints);

  const reserved = new Set<string>([
    ...officeHints.flatMap((office) => office.split(" ")),
    ...stateHints.map((state) => state.toLowerCase()),
    ...stateNameTokens,
    ...locationHints,
    ...districtHints.flatMap((district) => district.toLowerCase().split(/[\s-]+/)),
    ...statusHints.flatMap((status) => status.toLowerCase().split("_"))
  ]);

  const nameHints = tokens.filter(
    (token) => !STOP_WORDS.has(token) && !reserved.has(token) && !isLikelyPureOfficeToken(token)
  );

  return {
    raw: query,
    normalized,
    tokens,
    officeHints,
    stateHints,
    locationHints,
    districtHints,
    nameHints,
    statusHints,
    jurisdictionHints
  };
}

function inferLocationHints(
  normalized: string,
  tokens: string[],
  officeHints: string[],
  stateHints: string[]
): string[] {
  const hints = new Set<string>();

  for (const match of normalized.matchAll(/\b([a-z]+)\s+county\b/gi)) {
    if (match[1]) {
      hints.add(match[1]);
      hints.add("county");
    }
  }

  for (const match of normalized.matchAll(/\bcity\s+of\s+([a-z]+)\b/gi)) {
    if (match[1]) {
      hints.add(match[1]);
    }
  }

  if (officeHints.length > 0 && normalized.includes(" of ")) {
    const afterOf = normalized.split(" of ").at(-1) ?? "";
    for (const token of afterOf.split(" ").filter(Boolean)) {
      if (!STOP_WORDS.has(token)) {
        hints.add(token);
      }
    }
  }

  for (const token of tokens) {
    if (stateHints.includes(token.toUpperCase())) {
      continue;
    }
    if (token.length > 2 && ["city", "county", "district", "ward", "parish"].includes(token)) {
      hints.add(token);
    }
  }

  return Array.from(hints);
}

function inferStateNameTokens(normalized: string): string[] {
  const tokens = new Set<string>();
  for (const stateName of Object.keys(STATE_MAP)) {
    if (normalized.includes(stateName)) {
      for (const token of stateName.split(" ")) {
        tokens.add(token);
      }
    }
  }
  return Array.from(tokens);
}

function inferDistrictHints(normalized: string): string[] {
  const hints = new Set<string>();
  for (const match of normalized.matchAll(
    /\b(?:district|dist|ward|precinct|ad|sd|cd|position)\s*[-#]?\s*([a-z0-9]+)\b/gi
  )) {
    if (match[1]) {
      hints.add(match[1].toUpperCase());
    }
  }
  return Array.from(hints);
}

function inferStateHints(normalized: string, tokens: string[]): string[] {
  const hints = new Set<string>();

  for (const [stateName, code] of Object.entries(STATE_MAP)) {
    if (normalized.includes(stateName)) {
      hints.add(code);
    }
  }

  for (const token of tokens) {
    const upper = token.toUpperCase();
    if (STATE_CODES.has(upper)) {
      hints.add(upper);
    }
  }

  return Array.from(hints);
}

function inferStatusHints(normalized: string): Array<"CANDIDATE" | "OFFICEHOLDER" | "FORMER_OFFICEHOLDER"> {
  const hints = new Set<"CANDIDATE" | "OFFICEHOLDER" | "FORMER_OFFICEHOLDER">();
  if (normalized.includes("candidate") || normalized.includes("running")) {
    hints.add("CANDIDATE");
  }
  if (normalized.includes("incumbent") || normalized.includes("officeholder") || normalized.includes("current")) {
    hints.add("OFFICEHOLDER");
  }
  if (normalized.includes("former") || normalized.includes("ex-")) {
    hints.add("FORMER_OFFICEHOLDER");
  }
  return Array.from(hints);
}

function inferJurisdictionHints(
  officeHints: string[],
  normalized: string
): Array<"LOCAL" | "STATE" | "NATIONAL"> {
  const hints = new Set<"LOCAL" | "STATE" | "NATIONAL">();

  if (
    officeHints.some((value) =>
      ["city council", "school board", "mayor", "sheriff", "district attorney", "county supervisor", "county commissioner", "council"].includes(value)
    ) ||
    normalized.includes("city") ||
    normalized.includes("county")
  ) {
    hints.add("LOCAL");
  }

  if (
    officeHints.some((value) =>
      ["state senate", "state assembly", "state house", "state representative", "state legislator", "governor", "attorney general", "secretary of state"].includes(
        value
      )
    ) ||
    normalized.includes("state")
  ) {
    hints.add("STATE");
  }

  if (
    officeHints.some((value) =>
      ["u.s. house", "house representative", "u.s. senate", "senate", "senator", "representative", "president"].includes(value)
    ) ||
    normalized.includes("congress") ||
    normalized.includes("federal") ||
    normalized.includes("national")
  ) {
    hints.add("NATIONAL");
  }

  return Array.from(hints);
}

function isLikelyPureOfficeToken(token: string): boolean {
  return [
    "mayor",
    "senate",
    "senator",
    "representative",
    "house",
    "council",
    "candidate",
    "governor",
    "sheriff",
    "district",
    "board",
    "school",
    "city",
    "county",
    "state",
    "president"
  ].includes(token);
}
