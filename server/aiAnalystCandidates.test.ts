import { describe, expect, it } from "vitest";
import {
  buildCashFlowScenario,
  buildPersonaCandidateSets,
  parseAdvertisedWeeklyRent,
  type AnalystSourceRow,
} from "./services/aiAnalystCandidates";

const NOW = new Date("2026-08-01T00:00:00.000Z");

function row(overrides: Partial<AnalystSourceRow> = {}): AnalystSourceRow {
  return {
    id: 1,
    listingId: "rea-1",
    address: "1 Example Street, Testville NSW 2000",
    suburb: "Testville",
    postcode: "2000",
    regionId: "greater-sydney",
    propertyType: "house",
    priceDisplay: "$600,000",
    priceNumeric: "600000.00",
    bedrooms: 3,
    bathrooms: 1,
    landAreaSqm: "1000.00",
    minLotSizeSqm: "400.00",
    zoneCode: "R2",
    lgaName: "Example Council",
    potentialLots: 2,
    verdict: "subdividable",
    existingScore: 80,
    coveragePct: "20.0",
    frontageM: "18.0",
    isNewBuild: false,
    investmentTags: "pos_geared",
    headline: "Investment opportunity",
    descriptionShort: "Currently rented for $650 per week.",
    acidSulfateClass: null,
    fsrValue: null,
    maxBuildingHeightM: null,
    bushfireCategory: null,
    floodRisk: null,
    heritageFlag: null,
    biodiversityFlag: null,
    listedAt: new Date("2026-07-28T00:00:00.000Z"),
    firstSeenAt: new Date("2026-07-28T00:00:00.000Z"),
    updatedAt: new Date("2026-07-30T00:00:00.000Z"),
    ...overrides,
  };
}

describe("AI analyst deterministic candidates", () => {
  it("parses only weekly-rent evidence with plausible values", () => {
    expect(parseAdvertisedWeeklyRent("Leased at $720 per week")).toBe(720);
    expect(parseAdvertisedWeeklyRent("Rental return $590 pw")).toBe(590);
    expect(parseAdvertisedWeeklyRent("Offers over $720,000")).toBeNull();
  });

  it("uses an advertised-but-unverified rent when present and exposes every assumption", () => {
    const scenario = buildCashFlowScenario(row());
    expect(scenario).toMatchObject({
      label: "scenario_based",
      rentEvidence: "advertised_unverified",
      estimatedWeeklyRent: 650,
      loanToValuePct: 80,
      interestRatePct: 6.5,
      loanTermYears: 30,
      managementPctOfRent: 7,
      vacancyPctOfRent: 3,
    });
    expect(scenario?.annualNetCashflow).toBeTypeOf("number");
  });

  it("includes units in the cash-flow persona and caps scenario confidence", () => {
    const unit = row({
      id: 2,
      listingId: "rea-unit",
      propertyType: "apartment",
      priceNumeric: "450000.00",
      priceDisplay: "$450,000",
      bedrooms: 2,
      landAreaSqm: null,
      minLotSizeSqm: null,
      zoneCode: null,
      potentialLots: null,
      verdict: "unknown",
      frontageM: null,
      coveragePct: null,
      descriptionShort: null,
    });
    const candidates = buildPersonaCandidateSets([unit], NOW);
    expect(candidates.cash_flow_hunter).toHaveLength(1);
    expect(candidates.cash_flow_hunter[0]?.facts.propertyType).toBe("apartment");
    expect(candidates.cash_flow_hunter[0]?.evidenceConfidence).toBeLessThanOrEqual(55);
    expect(candidates.subdivider).toHaveLength(0);
  });

  it("enforces persona budgets and subdivision planning gates", () => {
    const overBudget = row({ id: 2, listingId: "rea-2", priceNumeric: "1600000.00" });
    const noFrontage = row({ id: 3, listingId: "rea-3", frontageM: null });
    const candidates = buildPersonaCandidateSets([overBudget, noFrontage], NOW);
    expect(candidates.subdivider).toHaveLength(1);
    expect(candidates.subdivider[0]?.listingId).toBe("rea-3");
    expect(candidates.subdivider[0]?.unknowns).toContain("Frontage is unknown");
  });

  it("uses a sufficiently populated active asking-price benchmark for value screening", () => {
    const comparableRows = Array.from({ length: 6 }, (_, index) =>
      row({
        id: index + 10,
        listingId: `comp-${index}`,
        priceNumeric: String(800_000 + index * 10_000),
        investmentTags: "",
      }),
    );
    const target = row({
      id: 99,
      listingId: "value-target",
      priceNumeric: "600000.00",
      investmentTags: "deceased_estate|distressed",
    });
    const candidates = buildPersonaCandidateSets([...comparableRows, target], NOW);
    expect(candidates.value_finder).toHaveLength(1);
    expect(candidates.value_finder[0]?.comparableBenchmark?.sampleSize).toBe(7);
    expect(candidates.value_finder[0]?.comparableBenchmark?.discountPct).toBeGreaterThan(20);
    expect(candidates.value_finder[0]?.inputFingerprint).toHaveLength(64);
  });
});
