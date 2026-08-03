import { describe, expect, it } from "vitest";
import {
  SUBDIVISION_BROWSE_HREF,
  SUBDIVISION_DEFAULT_MIN_LAND_INPUT,
  SUBDIVISION_DEFAULT_MIN_LAND_SQM,
  withSubdivisionDefaultMinLand,
} from "@shared/subdivisionDefaults";
import { parseLandSizeFilter } from "./catalogueFilterParsing";
import {
  DISCOVERY_METHODOLOGY,
  HOMEPAGE_DISCOVERY_STEPS,
  type DiscoveryCategory,
} from "./discoveryMethodology";
import { ALL_INVESTMENT_TAGS } from "./investmentTags";

describe("subdivision catalogue defaults", () => {
  it("converts the editable 100-acre input to the persisted 404,700 sqm floor", () => {
    expect(SUBDIVISION_DEFAULT_MIN_LAND_INPUT).toBe("100 acres");
    expect(parseLandSizeFilter(SUBDIVISION_DEFAULT_MIN_LAND_INPUT)).toEqual({
      value: SUBDIVISION_DEFAULT_MIN_LAND_SQM,
      error: null,
    });
  });

  it("backfills missing saved-search floors while preserving explicit overrides", () => {
    expect(withSubdivisionDefaultMinLand({ minScore: 70 })).toMatchObject({
      minScore: 70,
      minLandAreaSqm: SUBDIVISION_DEFAULT_MIN_LAND_SQM,
    });
    expect(withSubdivisionDefaultMinLand({ minLandAreaSqm: 0 }).minLandAreaSqm).toBe(0);
    expect(withSubdivisionDefaultMinLand({ minLandAreaSqm: 250_000 }).minLandAreaSqm).toBe(250_000);
    expect(SUBDIVISION_BROWSE_HREF).toBe("/niche/subdivision");
  });
});

describe("category discovery methodology", () => {
  const categories: DiscoveryCategory[] = ["subdivision", ...ALL_INVESTMENT_TAGS];

  it("publishes criteria and honest limitations for all six category pages", () => {
    expect(Object.keys(DISCOVERY_METHODOLOGY).sort()).toEqual([...categories].sort());
    for (const category of categories) {
      const method = DISCOVERY_METHODOLOGY[category];
      expect(method.intro.length).toBeGreaterThan(40);
      expect(method.criteria.length).toBeGreaterThanOrEqual(2);
      expect(method.limitations.length).toBeGreaterThanOrEqual(2);
    }
    expect(HOMEPAGE_DISCOVERY_STEPS).toHaveLength(3);
  });

  it("documents the live subdivision thresholds, hard gates, and score weights", () => {
    const copy = JSON.stringify(DISCOVERY_METHODOLOGY.subdivision);
    for (const expected of ["2.00", "1.80", "12 m", "15 m", "bushfire", "flood", "60", "35", "15", "5", "25", "10", "2-point"]) {
      expect(copy).toContain(expected);
    }
    expect(copy).toContain("R1–R5");
    expect(copy).toContain("Section 10.7");
  });

  it("documents the positive-geared current-rate net-cash-flow model", () => {
    const copy = JSON.stringify(DISCOVERY_METHODOLOGY.pos_geared);
    for (const expected of ["7.20%", "80%", "30-year", "4% vacancy", "7% management", "1%", "above $0"]) {
      expect(copy).toContain(expected);
    }
    expect(copy).toContain("Price and bedroom count alone no longer qualify");
  });

  it("documents the dual-income and development planning/feasibility gates", () => {
    const dual = JSON.stringify(DISCOVERY_METHODOLOGY.dual_income);
    expect(dual).toContain("450 m²");
    expect(dual).toContain("R1–R5");

    const development = JSON.stringify(DISCOVERY_METHODOLOGY.dev_site);
    for (const expected of ["E1", "E2", "E3", "E4", "E5", "residual", "$3,200/m²", "20% developer margin", "B4/B6"]) {
      expect(development).toContain(expected);
    }
  });

  it("documents provenance tiers and rejects weak distressed marketing language", () => {
    expect(JSON.stringify(DISCOVERY_METHODOLOGY.deceased_estate)).toContain("Tier 1");
    const distressed = JSON.stringify(DISCOVERY_METHODOLOGY.distressed);
    expect(distressed).toContain("Tier 1");
    expect(distressed).toContain("Tier 2");
    expect(distressed).toContain("deliberately rejected");
  });

  it("discloses the 600-character scan limit for every keyword classifier", () => {
    for (const category of ["deceased_estate", "dual_income", "dev_site", "distressed"] as const) {
      expect(JSON.stringify(DISCOVERY_METHODOLOGY[category])).toContain("first 600");
    }
  });
});
