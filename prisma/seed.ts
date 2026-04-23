import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const district = await prisma.district.upsert({
    where: { code: "US-CA-SEN-AT-LARGE" },
    update: {
      name: "California Senate At-Large",
      jurisdictionLevel: "NATIONAL",
      jurisdictionState: "CA",
      population: 39500000,
      medianHouseholdIncomeUsd: 91400,
      demographics: {
        age_18_to_34_pct: 0.29,
        age_65_plus_pct: 0.15,
        uninsured_pct: 0.07,
        renter_pct: 0.45
      }
    },
    create: {
      code: "US-CA-SEN-AT-LARGE",
      name: "California Senate At-Large",
      jurisdictionLevel: "NATIONAL",
      jurisdictionState: "CA",
      population: 39500000,
      medianHouseholdIncomeUsd: 91400,
      demographics: {
        age_18_to_34_pct: 0.29,
        age_65_plus_pct: 0.15,
        uninsured_pct: 0.07,
        renter_pct: 0.45
      }
    }
  });

  const politician = await prisma.politician.upsert({
    where: { slug: "alex-rivera" },
    update: {
      fullName: "Sen. Alex Rivera",
      normalizedFullName: "alex rivera",
      party: "Independent",
      officeTitle: "United States Senator",
      chamber: "Senate",
      jurisdictionLevel: "NATIONAL",
      jurisdictionState: "CA",
      districtLabel: "At-Large",
      city: null,
      county: null,
      candidateStatus: "OFFICEHOLDER",
      incumbentChallengerStatus: "INCUMBENT",
      officeSought: null,
      electionYear: 2028,
      issueFocusTags: ["climate", "healthcare", "privacy"],
      latestActivityAt: new Date("2025-11-09"),
      latestActivitySummary: "Filed annual financial disclosure and participated in three floor votes.",
      districtId: district.id,
      externalProfiles: {
        govtrack_id: "placeholder-govtrack-id",
        congress_id: "placeholder-congress-id"
      }
    },
    create: {
      externalId: "CW-POL-0001",
      slug: "alex-rivera",
      fullName: "Sen. Alex Rivera",
      normalizedFullName: "alex rivera",
      party: "Independent",
      officeTitle: "United States Senator",
      chamber: "Senate",
      jurisdictionLevel: "NATIONAL",
      jurisdictionState: "CA",
      districtLabel: "At-Large",
      city: null,
      county: null,
      candidateStatus: "OFFICEHOLDER",
      incumbentChallengerStatus: "INCUMBENT",
      officeSought: null,
      electionYear: 2028,
      issueFocusTags: ["climate", "healthcare", "privacy"],
      latestActivityAt: new Date("2025-11-09"),
      latestActivitySummary: "Filed annual financial disclosure and participated in three floor votes.",
      districtId: district.id,
      termStart: new Date("2023-01-03"),
      termEnd: new Date("2029-01-03"),
      externalProfiles: {
        govtrack_id: "placeholder-govtrack-id",
        congress_id: "placeholder-congress-id"
      }
    }
  });

  const additionalFigures = [
    {
      externalId: "CW-POL-0002",
      slug: "maria-thompson",
      fullName: "Maria Thompson",
      normalizedFullName: "maria thompson",
      party: "Nonpartisan",
      officeTitle: "City Council Member",
      chamber: "City Council",
      jurisdictionLevel: "LOCAL" as const,
      jurisdictionState: "CA",
      city: "Oakland",
      county: "Alameda",
      districtLabel: "District 4",
      candidateStatus: "OFFICEHOLDER" as const,
      incumbentChallengerStatus: "INCUMBENT" as const,
      officeSought: "City Council District 4",
      electionYear: 2026,
      issueFocusTags: ["housing", "public_safety", "transportation"],
      latestActivityAt: new Date("2025-10-18"),
      latestActivitySummary: "Published transportation safety statement."
    },
    {
      externalId: "CW-POL-0003",
      slug: "devon-nguyen",
      fullName: "Devon Nguyen",
      normalizedFullName: "devon nguyen",
      party: "Democratic",
      officeTitle: "State Assembly Candidate",
      chamber: "State Assembly",
      jurisdictionLevel: "STATE" as const,
      jurisdictionState: "CA",
      city: "San Jose",
      county: "Santa Clara",
      districtLabel: "AD-26",
      candidateStatus: "CANDIDATE" as const,
      incumbentChallengerStatus: "CHALLENGER" as const,
      officeSought: "California State Assembly District 26",
      electionYear: 2026,
      issueFocusTags: ["education", "cost_of_living", "healthcare"],
      latestActivityAt: new Date("2025-09-22"),
      latestActivitySummary: "Campaign platform update on education funding."
    },
    {
      externalId: "CW-POL-0004",
      slug: "claire-johnson",
      fullName: "Claire Johnson",
      normalizedFullName: "claire johnson",
      party: "Republican",
      officeTitle: "Former County Supervisor",
      chamber: "County Board",
      jurisdictionLevel: "LOCAL" as const,
      jurisdictionState: "TX",
      city: "Austin",
      county: "Travis",
      districtLabel: "Precinct 2",
      candidateStatus: "FORMER_OFFICEHOLDER" as const,
      incumbentChallengerStatus: "UNKNOWN" as const,
      officeSought: null,
      electionYear: null,
      issueFocusTags: ["budget", "public_safety"],
      latestActivityAt: new Date("2024-11-01"),
      latestActivitySummary: "No current campaign activity."
    },
    {
      externalId: "CW-POL-0005",
      slug: "jordan-patel",
      fullName: "Jordan Patel",
      normalizedFullName: "jordan patel",
      party: "Independent",
      officeTitle: "School Board Candidate",
      chamber: "School Board",
      jurisdictionLevel: "LOCAL" as const,
      jurisdictionState: "WA",
      city: "Seattle",
      county: "King",
      districtLabel: "Position 3",
      candidateStatus: "CANDIDATE" as const,
      incumbentChallengerStatus: "OPEN_SEAT" as const,
      officeSought: "Seattle School Board Position 3",
      electionYear: 2026,
      issueFocusTags: ["education", "student_safety"],
      latestActivityAt: new Date("2025-08-03"),
      latestActivitySummary: "Community forum on school accountability."
    }
  ];

  for (const figure of additionalFigures) {
    await prisma.politician.upsert({
      where: { slug: figure.slug },
      update: figure,
      create: figure
    });
  }

  const billRecords = [
    {
      billCode: "S-2114",
      title: "Climate Resilience Infrastructure Act",
      summary: "Increases grants for resilient energy infrastructure and wildfire mitigation.",
      issueTags: ["climate", "infrastructure", "energy"],
      jurisdictionLevel: "NATIONAL" as const,
      chamber: "Senate"
    },
    {
      billCode: "HR-4821",
      title: "Affordable Coverage Expansion Act",
      summary: "Expands subsidies for low income families and extends marketplace enrollment windows.",
      issueTags: ["healthcare", "cost_of_living"],
      jurisdictionLevel: "NATIONAL" as const,
      chamber: "House"
    },
    {
      billCode: "S-887",
      title: "Consumer Data Privacy and Transparency Act",
      summary: "Creates national baseline privacy standards and enforcement rules for data brokers.",
      issueTags: ["technology", "privacy", "consumer_protection"],
      jurisdictionLevel: "NATIONAL" as const,
      chamber: "Senate"
    }
  ];

  const bills = new Map<string, { id: string; billCode: string }>();
  for (const bill of billRecords) {
    const upserted = await prisma.bill.upsert({
      where: { billCode: bill.billCode },
      update: {
        title: bill.title,
        summary: bill.summary,
        issueTags: bill.issueTags,
        chamber: bill.chamber,
        latestActionAt: new Date("2025-09-15")
      },
      create: {
        externalId: `CW-BILL-${bill.billCode}`,
        billCode: bill.billCode,
        title: bill.title,
        summary: bill.summary,
        issueTags: bill.issueTags,
        jurisdictionLevel: bill.jurisdictionLevel,
        jurisdictionState: null,
        chamber: bill.chamber,
        introducedAt: new Date("2025-02-01"),
        latestActionAt: new Date("2025-09-15")
      }
    });
    bills.set(bill.billCode, { id: upserted.id, billCode: upserted.billCode });
  }

  const statements = [
    {
      externalId: "CW-STMT-0001",
      text: "I support long-term climate infrastructure investments that lower wildfire risk.",
      issueTags: ["climate", "infrastructure"],
      madeAt: new Date("2025-03-12"),
      sourceType: "PRESS_RELEASE" as const,
      sourceLabel: "Press release"
    },
    {
      externalId: "CW-STMT-0002",
      text: "Families need broader access to affordable healthcare coverage.",
      issueTags: ["healthcare", "cost_of_living"],
      madeAt: new Date("2025-04-20"),
      sourceType: "INTERVIEW" as const,
      sourceLabel: "Regional interview"
    },
    {
      externalId: "CW-STMT-0003",
      text: "I support stronger consumer privacy protections against data misuse.",
      issueTags: ["technology", "privacy"],
      madeAt: new Date("2025-05-02"),
      sourceType: "SPEECH" as const,
      sourceLabel: "Committee floor speech"
    }
  ];

  const statementByExternalId = new Map<string, { id: string }>();
  for (const statement of statements) {
    const upserted = await prisma.statement.upsert({
      where: { externalId: statement.externalId },
      update: {
        text: statement.text,
        issueTags: statement.issueTags,
        madeAt: statement.madeAt,
        sourceType: statement.sourceType,
        sourceLabel: statement.sourceLabel,
        sourceUrl: "https://example.com/source-placeholder"
      },
      create: {
        externalId: statement.externalId,
        politicianId: politician.id,
        text: statement.text,
        issueTags: statement.issueTags,
        madeAt: statement.madeAt,
        sourceType: statement.sourceType,
        sourceLabel: statement.sourceLabel,
        sourceUrl: "https://example.com/source-placeholder"
      }
    });
    statementByExternalId.set(statement.externalId, { id: upserted.id });
  }

  const votes = [
    {
      externalId: "CW-VOTE-0001",
      billCode: "S-2114",
      votePosition: "YES" as const,
      rollCallReference: "SENATE-ROLL-2025-122",
      votedAt: new Date("2025-06-19")
    },
    {
      externalId: "CW-VOTE-0002",
      billCode: "HR-4821",
      votePosition: "NO" as const,
      rollCallReference: "SENATE-ROLL-2025-131",
      votedAt: new Date("2025-06-27")
    },
    {
      externalId: "CW-VOTE-0003",
      billCode: "S-887",
      votePosition: "YES" as const,
      rollCallReference: "SENATE-ROLL-2025-144",
      votedAt: new Date("2025-07-11")
    }
  ];

  const voteByExternalId = new Map<string, { id: string; billId: string }>();
  for (const vote of votes) {
    const bill = bills.get(vote.billCode);
    if (!bill) {
      throw new Error(`Missing bill for ${vote.billCode}`);
    }

    const upserted = await prisma.vote.upsert({
      where: { externalId: vote.externalId },
      update: {
        votePosition: vote.votePosition,
        rollCallReference: vote.rollCallReference,
        votedAt: vote.votedAt,
        billId: bill.id,
        politicianId: politician.id
      },
      create: {
        externalId: vote.externalId,
        politicianId: politician.id,
        billId: bill.id,
        votePosition: vote.votePosition,
        rollCallReference: vote.rollCallReference,
        votedAt: vote.votedAt
      }
    });
    voteByExternalId.set(vote.externalId, { id: upserted.id, billId: bill.id });
  }

  const statementBillLinks = [
    { statementExternalId: "CW-STMT-0001", billCode: "S-2114", relevanceScore: 0.94 },
    { statementExternalId: "CW-STMT-0002", billCode: "HR-4821", relevanceScore: 0.91 },
    { statementExternalId: "CW-STMT-0003", billCode: "S-887", relevanceScore: 0.95 }
  ];

  for (const link of statementBillLinks) {
    const statement = statementByExternalId.get(link.statementExternalId);
    const bill = bills.get(link.billCode);
    if (!statement || !bill) {
      throw new Error(`Missing statement or bill for link ${link.statementExternalId} -> ${link.billCode}`);
    }

    await prisma.statementBillLink.upsert({
      where: {
        statementId_billId: {
          statementId: statement.id,
          billId: bill.id
        }
      },
      update: {
        relevanceScore: link.relevanceScore,
        relevanceRationale: "Issue tags and semantic overlap"
      },
      create: {
        statementId: statement.id,
        billId: bill.id,
        relevanceScore: link.relevanceScore,
        relevanceRationale: "Issue tags and semantic overlap"
      }
    });
  }

  const donorTech = await prisma.donor.upsert({
    where: { externalId: "CW-DONOR-TECH-01" },
    update: { name: "Civic Technology PAC", donorType: "PAC", sector: "technology" },
    create: {
      externalId: "CW-DONOR-TECH-01",
      name: "Civic Technology PAC",
      donorType: "PAC",
      sector: "technology"
    }
  });

  const donorHealth = await prisma.donor.upsert({
    where: { externalId: "CW-DONOR-HEALTH-01" },
    update: { name: "Healthcare Access Coalition", donorType: "ASSOCIATION", sector: "healthcare" },
    create: {
      externalId: "CW-DONOR-HEALTH-01",
      name: "Healthcare Access Coalition",
      donorType: "ASSOCIATION",
      sector: "healthcare"
    }
  });

  await prisma.donorContribution.upsert({
    where: { externalId: "CW-CONTRIB-0001" },
    update: {
      donorId: donorTech.id,
      politicianId: politician.id,
      amountUsd: "340000.00",
      electionCycle: "2026",
      contributionDate: new Date("2025-08-09"),
      sourceSystem: "manual_seed"
    },
    create: {
      externalId: "CW-CONTRIB-0001",
      donorId: donorTech.id,
      politicianId: politician.id,
      amountUsd: "340000.00",
      electionCycle: "2026",
      contributionDate: new Date("2025-08-09"),
      sourceSystem: "manual_seed",
      contributionType: "independent_expenditure"
    }
  });

  await prisma.donorContribution.upsert({
    where: { externalId: "CW-CONTRIB-0002" },
    update: {
      donorId: donorHealth.id,
      politicianId: politician.id,
      amountUsd: "185000.00",
      electionCycle: "2026",
      contributionDate: new Date("2025-08-27"),
      sourceSystem: "manual_seed"
    },
    create: {
      externalId: "CW-CONTRIB-0002",
      donorId: donorHealth.id,
      politicianId: politician.id,
      amountUsd: "185000.00",
      electionCycle: "2026",
      contributionDate: new Date("2025-08-27"),
      sourceSystem: "manual_seed",
      contributionType: "pac_contribution"
    }
  });

  const disclosure = await prisma.financialDisclosure.upsert({
    where: { externalId: "CW-DISC-2025-0001" },
    update: {
      filingYear: 2025,
      reportType: "Annual",
      extractionStatus: "PARSED",
      extractionConfidence: 0.82,
      parserVersion: "pdf-parser-0.1.0",
      sourceUrl: "https://example.com/disclosures/cw-disc-2025-0001.pdf",
      rawPdfPath: "data/disclosures/CW-DISC-2025-0001.pdf",
      parsedData: {
        assets_count: 3,
        liabilities_count: 1,
        income_sources_count: 2,
        transactions_count: 2
      },
      filedAt: new Date("2025-05-15")
    },
    create: {
      externalId: "CW-DISC-2025-0001",
      politicianId: politician.id,
      filingYear: 2025,
      reportType: "Annual",
      extractionStatus: "PARSED",
      extractionConfidence: 0.82,
      parserVersion: "pdf-parser-0.1.0",
      sourceUrl: "https://example.com/disclosures/cw-disc-2025-0001.pdf",
      rawPdfPath: "data/disclosures/CW-DISC-2025-0001.pdf",
      parsedData: {
        assets_count: 3,
        liabilities_count: 1,
        income_sources_count: 2,
        transactions_count: 2
      },
      filedAt: new Date("2025-05-15")
    }
  });

  await prisma.disclosureAsset.deleteMany({ where: { financialDisclosureId: disclosure.id } });
  await prisma.disclosureLiability.deleteMany({ where: { financialDisclosureId: disclosure.id } });
  await prisma.disclosureIncomeSource.deleteMany({ where: { financialDisclosureId: disclosure.id } });
  await prisma.disclosureTransaction.deleteMany({ where: { financialDisclosureId: disclosure.id } });

  await prisma.disclosureAsset.createMany({
    data: [
      {
        financialDisclosureId: disclosure.id,
        name: "Broad Market Index Fund",
        category: "security",
        owner: "self",
        valueMinUsd: 50001,
        valueMaxUsd: 100000
      },
      {
        financialDisclosureId: disclosure.id,
        name: "Primary Residence",
        category: "real_estate",
        owner: "joint",
        valueMinUsd: 500001,
        valueMaxUsd: 1000000
      },
      {
        financialDisclosureId: disclosure.id,
        name: "Municipal Bond Fund",
        category: "security",
        owner: "self",
        valueMinUsd: 15001,
        valueMaxUsd: 50000
      }
    ]
  });

  await prisma.disclosureLiability.create({
    data: {
      financialDisclosureId: disclosure.id,
      creditor: "First Federal Bank",
      liabilityType: "mortgage",
      amountMinUsd: 250001,
      amountMaxUsd: 500000
    }
  });

  await prisma.disclosureIncomeSource.createMany({
    data: [
      {
        financialDisclosureId: disclosure.id,
        sourceName: "Senate salary",
        incomeType: "employment",
        incomeMinUsd: 174000,
        incomeMaxUsd: 174000
      },
      {
        financialDisclosureId: disclosure.id,
        sourceName: "Municipal Bond Fund",
        incomeType: "investment",
        incomeMinUsd: 1001,
        incomeMaxUsd: 2500
      }
    ]
  });

  await prisma.disclosureTransaction.createMany({
    data: [
      {
        financialDisclosureId: disclosure.id,
        assetName: "Broad Market Index Fund",
        transactionType: "purchase",
        transactionDate: new Date("2025-02-03"),
        amountMinUsd: 1001,
        amountMaxUsd: 15000
      },
      {
        financialDisclosureId: disclosure.id,
        assetName: "Municipal Bond Fund",
        transactionType: "sale",
        transactionDate: new Date("2025-11-09"),
        amountMinUsd: 1001,
        amountMaxUsd: 15000
      }
    ]
  });

  await prisma.districtIssueIndicator.deleteMany({ where: { districtId: district.id } });

  await prisma.districtIssueIndicator.createMany({
    data: [
      {
        districtId: district.id,
        issueTag: "healthcare",
        indicatorName: "uninsured_rate",
        indicatorValue: 0.07,
        indicatorUnit: "pct",
        normalizedNeedScore: 0.76,
        sourceLabel: "Census ACS",
        sourceYear: 2024
      },
      {
        districtId: district.id,
        issueTag: "climate",
        indicatorName: "wildfire_risk_index",
        indicatorValue: 0.83,
        indicatorUnit: "index_0_1",
        normalizedNeedScore: 0.83,
        sourceLabel: "FEMA",
        sourceYear: 2024
      },
      {
        districtId: district.id,
        issueTag: "privacy",
        indicatorName: "broadband_households",
        indicatorValue: 0.91,
        indicatorUnit: "pct",
        normalizedNeedScore: 0.61,
        sourceLabel: "FCC",
        sourceYear: 2024
      }
    ]
  });

  const statement1 = statementByExternalId.get("CW-STMT-0001");
  const statement2 = statementByExternalId.get("CW-STMT-0002");
  const statement3 = statementByExternalId.get("CW-STMT-0003");
  const vote1 = voteByExternalId.get("CW-VOTE-0001");
  const vote2 = voteByExternalId.get("CW-VOTE-0002");
  const vote3 = voteByExternalId.get("CW-VOTE-0003");

  if (!statement1 || !statement2 || !statement3 || !vote1 || !vote2 || !vote3) {
    throw new Error("Missing statement or vote mappings for analysis results");
  }

  const analysis1 = await prisma.analysisResult.upsert({
    where: { externalId: "CW-AN-0001" },
    update: {
      politicianId: politician.id,
      statementId: statement1.id,
      billId: vote1.billId,
      voteId: vote1.id,
      classification: "ALIGNED",
      confidenceScore: 0.91,
      rationale: "Statement supports climate investment and vote was YES on related climate funding bill.",
      comparable: true,
      methodVersion: "truth-engine-0.1.0"
    },
    create: {
      externalId: "CW-AN-0001",
      politicianId: politician.id,
      statementId: statement1.id,
      billId: vote1.billId,
      voteId: vote1.id,
      classification: "ALIGNED",
      confidenceScore: 0.91,
      rationale: "Statement supports climate investment and vote was YES on related climate funding bill.",
      comparable: true,
      methodVersion: "truth-engine-0.1.0",
      metadata: { matched_by: "issue_tag_overlap" },
      verificationState: "UNVERIFIED"
    }
  });

  const analysis2 = await prisma.analysisResult.upsert({
    where: { externalId: "CW-AN-0002" },
    update: {
      politicianId: politician.id,
      statementId: statement2.id,
      billId: vote2.billId,
      voteId: vote2.id,
      classification: "CONTRADICTED",
      confidenceScore: 0.89,
      rationale: "Statement supports healthcare access expansion but vote was NO on coverage expansion bill.",
      comparable: true,
      methodVersion: "truth-engine-0.1.0"
    },
    create: {
      externalId: "CW-AN-0002",
      politicianId: politician.id,
      statementId: statement2.id,
      billId: vote2.billId,
      voteId: vote2.id,
      classification: "CONTRADICTED",
      confidenceScore: 0.89,
      rationale: "Statement supports healthcare access expansion but vote was NO on coverage expansion bill.",
      comparable: true,
      methodVersion: "truth-engine-0.1.0",
      metadata: { matched_by: "issue_tag_overlap" },
      verificationState: "UNVERIFIED"
    }
  });

  const analysis3 = await prisma.analysisResult.upsert({
    where: { externalId: "CW-AN-0003" },
    update: {
      politicianId: politician.id,
      statementId: statement3.id,
      billId: vote3.billId,
      voteId: vote3.id,
      classification: "ALIGNED",
      confidenceScore: 0.93,
      rationale: "Statement supports stronger privacy protections and vote was YES on privacy bill.",
      comparable: true,
      methodVersion: "truth-engine-0.1.0"
    },
    create: {
      externalId: "CW-AN-0003",
      politicianId: politician.id,
      statementId: statement3.id,
      billId: vote3.billId,
      voteId: vote3.id,
      classification: "ALIGNED",
      confidenceScore: 0.93,
      rationale: "Statement supports stronger privacy protections and vote was YES on privacy bill.",
      comparable: true,
      methodVersion: "truth-engine-0.1.0",
      metadata: { matched_by: "issue_tag_overlap" },
      verificationState: "UNVERIFIED"
    }
  });

  await prisma.honestyScoreSnapshot.deleteMany({
    where: {
      politicianId: politician.id,
      periodLabel: "all_time_seed"
    }
  });

  await prisma.honestyScoreSnapshot.create({
    data: {
      politicianId: politician.id,
      periodLabel: "all_time_seed",
      consistentActions: 2,
      totalComparableStatements: 3,
      honestyScore: (2 / 3) * 100,
      methodologyVersion: "truth-engine-0.1.0"
    }
  });

  await prisma.constituentImpactResult.upsert({
    where: { externalId: "CW-IMPACT-0001" },
    update: {
      politicianId: politician.id,
      districtId: district.id,
      billId: vote1.billId,
      voteId: vote1.id,
      issueTag: "climate",
      impactAlignment: "ALIGNED",
      impactScore: 0.84,
      confidenceScore: 0.8,
      rationale: "District has elevated wildfire risk indicator and vote supported resilience funding.",
      methodVersion: "constituent-impact-0.1.0"
    },
    create: {
      externalId: "CW-IMPACT-0001",
      politicianId: politician.id,
      districtId: district.id,
      billId: vote1.billId,
      voteId: vote1.id,
      issueTag: "climate",
      impactAlignment: "ALIGNED",
      impactScore: 0.84,
      confidenceScore: 0.8,
      rationale: "District has elevated wildfire risk indicator and vote supported resilience funding.",
      methodVersion: "constituent-impact-0.1.0",
      verificationState: "UNVERIFIED"
    }
  });

  await prisma.constituentImpactResult.upsert({
    where: { externalId: "CW-IMPACT-0002" },
    update: {
      politicianId: politician.id,
      districtId: district.id,
      billId: vote2.billId,
      voteId: vote2.id,
      issueTag: "healthcare",
      impactAlignment: "MISALIGNED",
      impactScore: 0.31,
      confidenceScore: 0.77,
      rationale: "District healthcare need score is elevated and vote opposed expansion bill.",
      methodVersion: "constituent-impact-0.1.0"
    },
    create: {
      externalId: "CW-IMPACT-0002",
      politicianId: politician.id,
      districtId: district.id,
      billId: vote2.billId,
      voteId: vote2.id,
      issueTag: "healthcare",
      impactAlignment: "MISALIGNED",
      impactScore: 0.31,
      confidenceScore: 0.77,
      rationale: "District healthcare need score is elevated and vote opposed expansion bill.",
      methodVersion: "constituent-impact-0.1.0",
      verificationState: "UNVERIFIED"
    }
  });

  await prisma.constituentImpactResult.upsert({
    where: { externalId: "CW-IMPACT-0003" },
    update: {
      politicianId: politician.id,
      districtId: district.id,
      billId: vote3.billId,
      voteId: vote3.id,
      issueTag: "privacy",
      impactAlignment: "ALIGNED",
      impactScore: 0.69,
      confidenceScore: 0.68,
      rationale: "District has high connected-household share and vote supported data privacy protections.",
      methodVersion: "constituent-impact-0.1.0"
    },
    create: {
      externalId: "CW-IMPACT-0003",
      politicianId: politician.id,
      districtId: district.id,
      billId: vote3.billId,
      voteId: vote3.id,
      issueTag: "privacy",
      impactAlignment: "ALIGNED",
      impactScore: 0.69,
      confidenceScore: 0.68,
      rationale: "District has high connected-household share and vote supported data privacy protections.",
      methodVersion: "constituent-impact-0.1.0",
      verificationState: "UNVERIFIED"
    }
  });

  await prisma.dataLineage.deleteMany({
    where: {
      recordType: { in: ["analysis_result", "statement", "vote", "financial_disclosure", "donor_contribution"] }
    }
  });

  await prisma.dataLineage.createMany({
    data: [
      {
        recordType: "analysis_result",
        recordId: analysis1.id,
        layer: "INTERPRETED",
        sourceType: "analysis_engine",
        retrievalDate: new Date(),
        parserVersion: "truth-engine-0.1.0",
        extractionStatus: "SUCCESS",
        confidenceScore: 0.91,
        verificationState: "UNVERIFIED",
        rawJsonSnapshot: { statement_id: statement1.id, bill_id: vote1.billId, classification: "aligned" },
        notes: "Derived via deterministic issue-tag mapping."
      },
      {
        recordType: "analysis_result",
        recordId: analysis2.id,
        layer: "INTERPRETED",
        sourceType: "analysis_engine",
        retrievalDate: new Date(),
        parserVersion: "truth-engine-0.1.0",
        extractionStatus: "PARTIAL",
        confidenceScore: 0.89,
        verificationState: "NEEDS_VERIFICATION",
        rawJsonSnapshot: { statement_id: statement2.id, bill_id: vote2.billId, classification: "contradicted" },
        notes: "Potential contradiction; requires source review."
      },
      {
        recordType: "analysis_result",
        recordId: analysis3.id,
        layer: "INTERPRETED",
        sourceType: "analysis_engine",
        retrievalDate: new Date(),
        parserVersion: "truth-engine-0.1.0",
        extractionStatus: "SUCCESS",
        confidenceScore: 0.93,
        verificationState: "UNVERIFIED",
        rawJsonSnapshot: { statement_id: statement3.id, bill_id: vote3.billId, classification: "aligned" },
        notes: "Derived via deterministic issue-tag mapping."
      }
    ]
  });

  await prisma.analysisRunLog.createMany({
    data: [
      {
        methodVersion: "truth-engine-0.1.0",
        status: "SUCCESS",
        classification: "ALIGNED",
        confidenceScore: 0.91,
        recordType: "analysis_result",
        recordId: analysis1.id,
        statementId: statement1.id,
        billId: vote1.billId,
        voteId: vote1.id,
        message: "Classification produced with high confidence from issue-tag overlap and vote direction.",
        rawInputSnapshot: { statement_tags: ["climate", "infrastructure"], vote: "YES" },
        rawOutputSnapshot: { classification: "aligned", rationale: "Statement direction matches vote direction." },
        verificationState: "UNVERIFIED"
      },
      {
        methodVersion: "truth-engine-0.1.0",
        status: "PARTIAL",
        classification: "CONTRADICTED",
        confidenceScore: 0.89,
        recordType: "analysis_result",
        recordId: analysis2.id,
        statementId: statement2.id,
        billId: vote2.billId,
        voteId: vote2.id,
        message: "Contradiction detected; manual review advised due policy scope ambiguity risk.",
        rawInputSnapshot: { statement_tags: ["healthcare", "cost_of_living"], vote: "NO" },
        rawOutputSnapshot: { classification: "contradicted", rationale: "Vote direction conflicts with statement direction." },
        verificationState: "NEEDS_VERIFICATION"
      }
    ]
  });

  await prisma.parserRunLog.create({
    data: {
      sourceType: "financial_disclosure_pdf",
      sourceUrl: "https://example.com/disclosures/cw-disc-2025-0001.pdf",
      parserVersion: "pdf-parser-0.1.0",
      status: "PARTIAL",
      confidenceScore: 0.82,
      recordType: "financial_disclosure",
      recordId: disclosure.id,
      message: "Disclosure parsed with table extraction; some fields may require manual verification.",
      rawInputSnapshot: { file: "CW-DISC-2025-0001.pdf" },
      rawOutputSnapshot: { assets: 3, liabilities: 1, income_sources: 2, transactions: 2 }
    }
  });

  await prisma.politicianAlias.deleteMany({});
  await prisma.politicianAlias.createMany({
    data: [
      { politicianId: politician.id, alias: "A. Rivera", normalizedAlias: "a rivera" },
      { politicianId: politician.id, alias: "Alex R.", normalizedAlias: "alex r" }
    ]
  });

  await prisma.officeHistory.deleteMany({});
  await prisma.officeHistory.createMany({
    data: [
      {
        politicianId: politician.id,
        officeTitle: "United States Senator",
        chamber: "Senate",
        jurisdictionLevel: "NATIONAL",
        jurisdictionState: "CA",
        districtLabel: "At-Large",
        startDate: new Date("2023-01-03"),
        isCurrent: true,
        electionYear: 2028
      }
    ]
  });

  const allFigures = await prisma.politician.findMany({
    include: {
      aliases: true,
      donorContributions: true,
      votes: true,
      financialDisclosures: true,
      honestyScoreSnapshots: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  for (const figure of allFigures) {
    const donorVolumeUsd = figure.donorContributions.reduce((total, record) => total + Number(record.amountUsd), 0);
    const latestDisclosureYear = figure.financialDisclosures[0]?.filingYear ?? null;
    const honestyScore = figure.honestyScoreSnapshots[0]?.honestyScore ?? null;
    const aliases = figure.aliases.map((alias) => alias.alias);

    const searchBlob = [
      figure.fullName,
      figure.normalizedFullName ?? "",
      figure.officeTitle,
      figure.officeSought ?? "",
      figure.party ?? "",
      figure.chamber ?? "",
      figure.jurisdictionState ?? "",
      figure.city ?? "",
      figure.county ?? "",
      figure.districtLabel ?? "",
      ...aliases,
      ...(figure.issueFocusTags ?? [])
    ]
      .join(" ")
      .toLowerCase();

    await prisma.publicFigureSearchDocument.upsert({
      where: { politicianId: figure.id },
      update: {
        fullName: figure.fullName,
        normalizedFullName: figure.normalizedFullName ?? figure.fullName.toLowerCase(),
        aliases,
        officeDisplay: figure.officeSought ?? figure.officeTitle,
        officeHeld: figure.officeTitle,
        officeSought: figure.officeSought,
        chamber: figure.chamber,
        party: figure.party,
        jurisdictionLevel: figure.jurisdictionLevel,
        jurisdictionState: figure.jurisdictionState,
        city: figure.city,
        county: figure.county,
        districtLabel: figure.districtLabel,
        candidateStatus: figure.candidateStatus,
        incumbentChallengerStatus: figure.incumbentChallengerStatus,
        electionYear: figure.electionYear,
        issueTags: figure.issueFocusTags,
        honestyScore,
        donorVolumeUsd,
        recentVotesCount: figure.votes.length,
        latestDisclosureYear,
        latestActivityAt: figure.latestActivityAt,
        latestActivitySummary: figure.latestActivitySummary,
        searchBlob
      },
      create: {
        politicianId: figure.id,
        fullName: figure.fullName,
        normalizedFullName: figure.normalizedFullName ?? figure.fullName.toLowerCase(),
        aliases,
        officeDisplay: figure.officeSought ?? figure.officeTitle,
        officeHeld: figure.officeTitle,
        officeSought: figure.officeSought,
        chamber: figure.chamber,
        party: figure.party,
        jurisdictionLevel: figure.jurisdictionLevel,
        jurisdictionState: figure.jurisdictionState,
        city: figure.city,
        county: figure.county,
        districtLabel: figure.districtLabel,
        candidateStatus: figure.candidateStatus,
        incumbentChallengerStatus: figure.incumbentChallengerStatus,
        electionYear: figure.electionYear,
        issueTags: figure.issueFocusTags,
        honestyScore,
        donorVolumeUsd,
        recentVotesCount: figure.votes.length,
        latestDisclosureYear,
        latestActivityAt: figure.latestActivityAt,
        latestActivitySummary: figure.latestActivitySummary,
        searchBlob
      }
    });
  }

  console.log("Seed complete: CivicWatch sample dataset loaded.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
