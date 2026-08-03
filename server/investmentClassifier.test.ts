import { describe, expect, it } from "vitest";
import {
  assessDeceasedEstateProvenance,
  assessDistressedProvenance,
  assessNetCashFlow,
  assessResidualLandValue,
  buildClassificationEvidence,
  classifyListing,
  CURRENT_CLASSIFIER_VERSION,
  isDevelopmentZone,
  NET_CASH_FLOW_ASSUMPTIONS,
  normalisePlanningZone,
  parseAdvertisedWeeklyRent,
} from "./services/investmentClassifier";

const row = (overrides: Partial<Parameters<typeof classifyListing>[0]> = {}) => ({
  headline: null,
  description: null,
  priceNumeric: null,
  bedrooms: null,
  zoneCode: null,
  propertyType: null,
  landAreaSqm: null,
  fsrValue: null,
  weeklyRent: null,
  ...overrides,
});

describe("deceased-estate provenance", () => {
  it("classifies explicit deceased-estate campaigns as tier 2", () => {
    const input = row({ headline: "Deceased Estate | Sought-After Location" });
    expect(classifyListing(input)).toContain("deceased_estate");
    expect(assessDeceasedEstateProvenance(input)).toMatchObject({
      qualifies: true,
      tier: "tier_2_explicit_estate_campaign",
      signal: "deceased estate",
    });
  });

  it("classifies probate and contextual executor sales as tier 1", () => {
    expect(assessDeceasedEstateProvenance(row({ headline: "Probate sale, inspect today" }))).toMatchObject({
      qualifies: true,
      tier: "tier_1_legal_process",
    });
    expect(assessDeceasedEstateProvenance(row({ description: "Executor instructed sale by public auction." }))).toMatchObject({
      qualifies: true,
      tier: "tier_1_legal_process",
    });
  });

  it.each([
    "Tranquil acreage lifestyle in a prestigious estate",
    "Orchard Hills Estate — Pepperfield design",
    "Contact the real estate team",
    "Executor of the construction contract has approved the variation",
    "Administrator access is available for the building management portal",
  ])("rejects unrelated estate/legal-role wording: %s", (headline) => {
    expect(classifyListing(row({ headline }))).not.toContain("deceased_estate");
  });

  it("limits description provenance matching to the first 600 characters", () => {
    expect(classifyListing(row({
      headline: "Family home",
      description: `${"A".repeat(610)} deceased estate sale`,
    }))).not.toContain("deceased_estate");
  });
});

describe("distressed-sale legal provenance", () => {
  it.each([
    "Mortgagee in possession sale",
    "Court-ordered auction",
    "Sheriff's sale",
    "Offered by the receiver and manager",
    "Bank repossession",
  ])("accepts tier 1 possession/court evidence: %s", (headline) => {
    expect(assessDistressedProvenance(row({ headline }))).toMatchObject({
      qualifies: true,
      tier: "tier_1_possession_or_court",
    });
    expect(classifyListing(row({ headline }))).toContain("distressed");
  });

  it.each([
    "Mortgagee sale — public auction",
    "Bank-instructed sale campaign",
    "Receivership sale",
    "Sale by the liquidator",
  ])("accepts tier 2 explicit lender/insolvency sale evidence: %s", (headline) => {
    expect(assessDistressedProvenance(row({ headline }))).toMatchObject({
      qualifies: true,
      tier: "tier_2_explicit_lender_or_insolvency_sale",
    });
  });

  it.each([
    "Vendor motivated to sell",
    "Highly motivated vendor — all offers considered",
    "Must sell this weekend",
    "Price reduced for immediate sale",
    "Urgent sale",
    "Below market opportunity",
  ])("rejects unverified marketing urgency: %s", (headline) => {
    expect(classifyListing(row({ headline }))).not.toContain("distressed");
  });
});

describe("dual-income planning gates", () => {
  it("requires a signal, at least 450 m², and R1–R5 residential zoning", () => {
    expect(classifyListing(row({
      headline: "House with approved granny flat",
      landAreaSqm: 450,
      zoneCode: "R2",
    }))).toContain("dual_income");
  });

  it("rejects a 449 m² lot, missing area, and a non-residential zone", () => {
    expect(classifyListing(row({ headline: "Granny flat potential", landAreaSqm: 449, zoneCode: "R2" })))
      .not.toContain("dual_income");
    expect(classifyListing(row({ headline: "Granny flat potential", landAreaSqm: null, zoneCode: "R2" })))
      .not.toContain("dual_income");
    expect(classifyListing(row({ headline: "Dual occupancy", landAreaSqm: 800, zoneCode: "E1" })))
      .not.toContain("dual_income");
  });

  it("does not confuse dual street frontage with dual income", () => {
    expect(classifyListing(row({
      headline: "Prime corner block with dual street frontage",
      landAreaSqm: 1_000,
      zoneCode: "R2",
    }))).not.toContain("dual_income");
  });

  it("fails closed for QLD council_partial zoning-only evidence", () => {
    const qldCandidate = row({
      state: "QLD",
      headline: "DA approved development site with granny flat potential",
      description: "DA approved for 4 townhouses with plans available",
      priceNumeric: 500_000,
      landAreaSqm: 1_000,
      zoneCode: "Low Density Residential Zone",
    });

    expect(classifyListing({ ...qldCandidate, planningEvidence: "council_machine" }))
      .toEqual(expect.arrayContaining(["dual_income", "dev_site"]));

    const partialEvidence = buildClassificationEvidence({
      ...qldCandidate,
      planningEvidence: "council_partial",
    });
    expect(partialEvidence).toMatchObject({
      state: "QLD",
      planningEvidence: "council_partial",
      requiresCouncilVerification: true,
      dualIncome: { zonePass: false, qualifies: false },
      developmentSite: { zonePass: false, qualifies: false },
    });
    expect(partialEvidence.tags).not.toEqual(expect.arrayContaining(["dual_income", "dev_site"]));
  });
});

describe("Queensland planning-zone normalization and evidence gates", () => {
  it.each([
    ["Low Density Residential Zone", "residential_low", true, true],
    ["Low-Medium Density Residential", "residential_medium", true, true],
    ["Rural Residential Zone", "rural_residential", true, true],
    ["District Centre Zone", "centre", false, true],
    ["Emerging Community Zone", "emerging_community", false, true],
    ["Environmental Management and Conservation Zone", "other", false, false],
  ] as const)("maps %s to the conservative %s family", (zoneName, family, residential, development) => {
    expect(normalisePlanningZone("QLD", zoneName)).toMatchObject({
      state: "QLD",
      family,
      residentialCandidate: residential,
      developmentCandidate: development,
      requiresCouncilVerification: true,
    });
  });

  it("requires council-machine evidence before a QLD residential signal becomes an automatic tag", () => {
    const qld = row({
      state: "QLD",
      headline: "House with approved granny flat",
      landAreaSqm: 700,
      zoneCode: "Low Density Residential Zone",
    });
    expect(classifyListing({ ...qld, planningEvidence: "manual_review" })).not.toContain("dual_income");
    expect(classifyListing({ ...qld, planningEvidence: "council_machine" })).toContain("dual_income");
    expect(buildClassificationEvidence({ ...qld, planningEvidence: "manual_review" })).toMatchObject({
      state: "QLD",
      zoneFamily: "residential_low",
      requiresCouncilVerification: true,
      dualIncome: { zonePass: false, qualifies: false },
    });
  });

  it("keeps text-provenance and cash-flow categories state-neutral", () => {
    const tags = classifyListing(row({
      state: "QLD",
      headline: "Mortgagee sale — deceased estate",
      description: "Currently leased at $750 per week",
      priceNumeric: 300_000,
      planningEvidence: "manual_review",
    }));
    expect(tags).toEqual(expect.arrayContaining(["deceased_estate", "distressed", "pos_geared"]));
  });
});

describe("positive-geared net cash flow", () => {
  it("uses the documented current-rate and operating-cost assumptions", () => {
    expect(NET_CASH_FLOW_ASSUMPTIONS).toMatchObject({
      investorInterestRate: 0.072,
      loanToValueRatio: 0.8,
      loanTermYears: 30,
      vacancyPctOfGrossRent: 0.04,
      managementPctOfCollectedRent: 0.07,
      maintenancePctOfPropertyValue: 0.01,
    });
  });

  it.each([
    ["Currently leased at $750 per week", 750],
    ["Rental appraisal: $680-$720 pw", 680],
    ["Combined rental income $1,250 p.w.", 1250],
    ["$590 per week rental return", 590],
  ])("parses rent-context weekly income conservatively", (text, expected) => {
    expect(parseAdvertisedWeeklyRent(text)).toBe(expected);
  });

  it("does not treat an unrelated weekly amount as rent", () => {
    expect(parseAdvertisedWeeklyRent("Vendor finance available from $500 per week repayments")).toBeNull();
  });

  it("qualifies only when modelled annual cash flow is positive", () => {
    const positive = row({
      priceNumeric: 300_000,
      description: "Currently leased at $750 per week",
    });
    const assessment = assessNetCashFlow(positive);
    expect(assessment.qualifies).toBe(true);
    expect(assessment.annualNetCashFlow).toBeGreaterThan(0);
    expect(classifyListing(positive)).toContain("pos_geared");
  });

  it("rejects an affordable property when modelled finance and expenses make it negative", () => {
    const negative = row({
      priceNumeric: 650_000,
      bedrooms: 3,
      description: "Rental appraisal $600 per week",
    });
    const assessment = assessNetCashFlow(negative);
    expect(assessment.qualifies).toBe(false);
    expect(assessment.annualNetCashFlow).toBeLessThan(0);
    expect(classifyListing(negative)).not.toContain("pos_geared");
  });

  it("fails closed without an asking price or evidenced weekly rent", () => {
    expect(classifyListing(row({ priceNumeric: 300_000, bedrooms: 4 }))).not.toContain("pos_geared");
    expect(classifyListing(row({ description: "Currently leased at $900 per week" }))).not.toContain("pos_geared");
  });
});

describe("development-site current zones and residual feasibility", () => {
  it("recognises E1–E5 current NSW employment zones", () => {
    for (const zoneCode of ["E1", "E2", "E3", "E4", "E5"]) {
      expect(isDevelopmentZone(zoneCode)).toBe(true);
    }
  });

  it("does not recognise obsolete B4/B6 codes", () => {
    expect(isDevelopmentZone("B4")).toBe(false);
    expect(isDevelopmentZone("B6")).toBe(false);
  });

  it("qualifies an evidenced current-zone site only when residual value covers asking price", () => {
    const viable = row({
      headline: "DA approved development site",
      description: "DA approved for 4 townhouses with plans available",
      priceNumeric: 500_000,
      zoneCode: "E1",
      landAreaSqm: 1_000,
    });
    expect(assessResidualLandValue(viable)).toMatchObject({ qualifies: true, basis: "approved_yield" });
    expect(classifyListing(viable)).toContain("dev_site");

    const unviable = { ...viable, priceNumeric: 1_500_000 };
    expect(assessResidualLandValue(unviable).qualifies).toBe(false);
    expect(classifyListing(unviable)).not.toContain("dev_site");
  });

  it("uses FSR as an input to residual value, not as a stand-alone tag", () => {
    const noCampaignEvidence = row({
      headline: "Large block",
      priceNumeric: 1_000_000,
      zoneCode: "R4",
      landAreaSqm: 1_000,
      fsrValue: 1,
    });
    expect(assessResidualLandValue(noCampaignEvidence)).toMatchObject({ qualifies: true, basis: "fsr" });
    expect(classifyListing(noCampaignEvidence)).not.toContain("dev_site");
  });

  it("fails closed when current zoning or enough feasibility evidence is missing", () => {
    expect(classifyListing(row({
      headline: "DA approved development site",
      description: "DA approved for 4 townhouses",
      priceNumeric: 400_000,
      zoneCode: "B4",
    }))).not.toContain("dev_site");
    expect(classifyListing(row({
      headline: "Development site",
      priceNumeric: 400_000,
      zoneCode: "E2",
    }))).not.toContain("dev_site");
  });
});

describe("versioned classification evidence", () => {
  it("records gate outcomes from the same decision used for tags", () => {
    const evidence = buildClassificationEvidence(row({
      headline: "Mortgagee sale with granny flat",
      description: "Currently leased at $750 per week",
      priceNumeric: 300_000,
      landAreaSqm: 500,
      zoneCode: "R2",
    }));
    expect(evidence.version).toBe(CURRENT_CLASSIFIER_VERSION);
    expect(evidence.tags).toEqual(expect.arrayContaining(["distressed", "dual_income", "pos_geared"]));
    expect(evidence.distressed.qualifies).toBe(true);
    expect(evidence.dualIncome).toMatchObject({ zonePass: true, landAreaPass: true, qualifies: true });
    expect(evidence.positiveGeared.qualifies).toBe(true);
  });
});
