import { describe, expect, it } from "vitest";
import { CURRENT_CLASSIFIER_VERSION } from "./services/investmentClassifier";
import {
  deriveCatalogueClassification,
  scanUnits,
  storedQldPlanningEvidence,
} from "./services/sweep";

const input = (overrides: Partial<Parameters<typeof deriveCatalogueClassification>[0]> = {}) => ({
  state: "NSW" as const,
  headline: "Family home",
  description: null,
  priceNumeric: 500_000,
  bedrooms: 3,
  zoneCode: "R2",
  propertyType: "House",
  landAreaSqm: 1_000,
  minLotSizeSqm: 400,
  frontageM: 15,
  fsrValue: 1,
  bushfireStatus: "clear" as const,
  floodStatus: "clear" as const,
  category: "cash_flow" as const,
  ...overrides,
});

describe("nightly catalogue classifier derivation", () => {
  it("persists all tightened category and subdivision outcomes from one versioned ruleset", () => {
    const result = deriveCatalogueClassification(input({
      headline: "Deceased estate mortgagee sale — DA approved development site with granny flat",
      description: "DA approved for 4 townhouses. Currently leased at $1,100 per week.",
      priceNumeric: 300_000,
    }));

    expect(result.classifierVersion).toBe(CURRENT_CLASSIFIER_VERSION);
    expect(result.investmentTags.split("|")).toEqual(expect.arrayContaining([
      "deceased_estate",
      "distressed",
      "dual_income",
      "dev_site",
      "pos_geared",
    ]));
    expect(result.analysis).toMatchObject({ verdict: "subdividable", potentialLots: 2 });
    expect(result.classificationEvidence).toMatchObject({
      version: CURRENT_CLASSIFIER_VERSION,
      deceasedEstate: { tier: "tier_2_explicit_estate_campaign", qualifies: true },
      distressed: { tier: "tier_2_explicit_lender_or_insolvency_sale", qualifies: true },
      dualIncome: { minimumLandAreaSqm: 450, qualifies: true },
      developmentSite: { zoneCode: "R2", zonePass: true, qualifies: true },
      positiveGeared: { qualifies: true },
      subdivision: {
        verdict: "subdividable",
        frontageM: 15,
        bushfireStatus: "clear",
        floodStatus: "clear",
      },
    });
  });

  it("removes weak category signals and fails closed on unavailable financial/planning evidence", () => {
    const result = deriveCatalogueClassification(input({
      headline: "Motivated vendor — estate living with granny flat potential and development opportunity",
      description: "Price reduced for immediate sale",
      priceNumeric: 650_000,
      zoneCode: "B4",
      landAreaSqm: 449,
      fsrValue: null,
      frontageM: null,
      bushfireStatus: "unknown",
      floodStatus: "unknown",
    }));

    expect(result.investmentTags).toBe("");
    expect(result.analysis.verdict).toBe("not_subdividable");
    expect(result.classificationEvidence).toMatchObject({
      deceasedEstate: { qualifies: false },
      distressed: { qualifies: false },
      dualIncome: { landAreaPass: false, zonePass: false, qualifies: false },
      developmentSite: { zonePass: false, qualifies: false },
      positiveGeared: { qualifies: false },
    });
  });

  it("excludes verified bushfire or flood flags from the subdivision shortlist", () => {
    expect(deriveCatalogueClassification(input({ bushfireStatus: "flagged" })).analysis.verdict)
      .toBe("not_subdividable");
    expect(deriveCatalogueClassification(input({ floodStatus: "flagged" })).analysis.verdict)
      .toBe("not_subdividable");
  });

  it("persists QLD zone family and manual-review uncertainty without a false subdivision verdict", () => {
    const result = deriveCatalogueClassification(input({
      state: "QLD",
      headline: "Dual income development opportunity",
      zoneCode: "Low Density Residential Zone",
      planningEvidence: "manual_review",
    }));
    expect(result.investmentTags).not.toContain("dual_income");
    expect(result.analysis).toMatchObject({ verdict: "unknown", potentialLots: null });
    expect(result.classificationEvidence).toMatchObject({
      state: "QLD",
      planningEvidence: "manual_review",
      zoneFamily: "residential_low",
      requiresCouncilVerification: true,
    });
  });

  it("caps a QLD council-machine candidate at marginal while retaining evidence-backed tags", () => {
    const result = deriveCatalogueClassification(input({
      state: "QLD",
      headline: "Approved granny flat",
      zoneCode: "Low Density Residential Zone",
      planningEvidence: "council_machine",
    }));
    expect(result.investmentTags).toContain("dual_income");
    expect(result.analysis).toMatchObject({ verdict: "marginal", potentialLots: 2 });
  });

  it("persists auditable QLD council provenance inside classification evidence", () => {
    const result = deriveCatalogueClassification(input({
      state: "QLD",
      zoneCode: "Low Density Residential Zone",
      planningEvidence: "council_partial",
      planningProvenance: {
        councilKey: "mount-isa",
        schemeName: "City of Mount Isa Planning Scheme 2020",
        effectiveFrom: "2020-03-09",
        verificationUrl: "https://www.mountisa.qld.gov.au/Development-and-Land-Use/Development/Planning-Schemes-and-Infrastructure-Charges",
        fieldProvenance: {
          zoning: "machine",
          minimumLotSize: "unknown",
          height: "unknown",
          density: "unknown",
          bushfire: "unknown",
          flood: "unknown",
          biodiversity: "unknown",
          heritage: "unknown",
          subdivisionRules: "viewer_only",
        },
        subdivisionRule: "manual_review_required",
        sourceNotes: "Validated public zoning source only.",
        confidence: "partial",
      },
    }));

    expect(result.classificationEvidence).toMatchObject({
      planningEvidence: "council_partial",
      planningProvenance: {
        councilKey: "mount-isa",
        effectiveFrom: "2020-03-09",
        confidence: "partial",
        fieldProvenance: { zoning: "machine", minimumLotSize: "unknown" },
      },
    });
    expect(result.investmentTags).not.toContain("dual_income");
    expect(result.analysis.verdict).toBe("unknown");
  });

  it("never infers council-machine evidence when upgrading legacy QLD rows", () => {
    expect(storedQldPlanningEvidence({ planningEvidence: "council_machine" }))
      .toBe("council_machine");
    expect(storedQldPlanningEvidence({ planningEvidence: "council_partial" }))
      .toBe("council_partial");
    expect(storedQldPlanningEvidence({ planningEvidence: "manual_review" }))
      .toBe("manual_review");
    expect(storedQldPlanningEvidence({ planningEvidence: "state_machine" }))
      .toBe("manual_review");
    expect(storedQldPlanningEvidence({})).toBe("manual_review");
    expect(storedQldPlanningEvidence(null)).toBe("manual_review");
  });
});

describe("nightly two-state scan fan-out", () => {
  it("schedules every validated NSW and QLD provider unit exactly once", () => {
    const units = scanUnits();
    const nsw = units.filter(unit => unit.state === "NSW");
    const qld = units.filter(unit => unit.state === "QLD");
    expect(nsw).toHaveLength(34);
    expect(qld).toHaveLength(17);
    expect(units).toHaveLength(51);
    expect(new Set(units.map(unit => `${unit.state}|${unit.location}`)).size).toBe(51);
    expect(qld.every(unit => unit.regionId.startsWith("qld-"))).toBe(true);
  });
});
