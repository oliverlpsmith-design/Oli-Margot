import { describe, expect, it } from "vitest";
import { parseLandAreaSqm } from "./services/realtyApi";
import {
  analyseSubdivisionPotential,
  MIN_TORRENS_FRONTAGE_M,
  STRONG_TORRENS_FRONTAGE_M,
} from "./services/subdivision";

describe("parseLandAreaSqm", () => {
  it("parses square metre, hectare, and acre strings", () => {
    expect(parseLandAreaSqm("1,012 m2")).toBe(1012);
    expect(parseLandAreaSqm("2.5ha")).toBe(25000);
    expect(Math.round(parseLandAreaSqm("5 acres")!)).toBe(20234);
  });

  it("returns null for unavailable values", () => {
    expect(parseLandAreaSqm(undefined)).toBeNull();
    expect(parseLandAreaSqm("contact agent")).toBeNull();
  });
});

const analysed = (overrides: Partial<Parameters<typeof analyseSubdivisionPotential>[0]> = {}) =>
  analyseSubdivisionPotential({
    landAreaSqm: 1_500,
    minLotSizeSqm: 600,
    zoneCode: "R2",
    frontageM: STRONG_TORRENS_FRONTAGE_M,
    bushfireStatus: "clear",
    floodStatus: "clear",
    ...overrides,
  });

describe("analyseSubdivisionPotential hard gates", () => {
  it("returns subdividable only when arithmetic, zone, frontage, and hazard gates all pass", () => {
    expect(analysed()).toMatchObject({ verdict: "subdividable", potentialLots: 2, ratio: 2.5 });
  });

  it("rejects frontage below the 12 m lower Torrens screen", () => {
    expect(MIN_TORRENS_FRONTAGE_M).toBe(12);
    expect(STRONG_TORRENS_FRONTAGE_M).toBe(15);
    expect(analysed({ frontageM: 11.9 })).toMatchObject({ verdict: "not_subdividable" });
  });

  it("caps 12–15 m or unavailable frontage at marginal", () => {
    expect(analysed({ frontageM: 12 })).toMatchObject({ verdict: "marginal" });
    expect(analysed({ frontageM: 14.9 })).toMatchObject({ verdict: "marginal" });
    expect(analysed({ frontageM: null })).toMatchObject({ verdict: "marginal" });
  });

  it.each(["C2", "E1", "SP2", "W1", "MU1"])("rejects non-permissive zone %s", (zoneCode) => {
    expect(analysed({ zoneCode })).toMatchObject({ verdict: "not_subdividable" });
  });

  it("returns unknown when zoning cannot be verified", () => {
    expect(analysed({ zoneCode: null })).toMatchObject({ verdict: "unknown" });
  });

  it("excludes mapped bushfire-prone and flood-planning parcels up front", () => {
    expect(analysed({ bushfireStatus: "flagged" })).toMatchObject({ verdict: "not_subdividable" });
    expect(analysed({ floodStatus: "flagged" })).toMatchObject({ verdict: "not_subdividable" });
  });

  it("caps unavailable bushfire or flood mapping at marginal", () => {
    expect(analysed({ bushfireStatus: "unknown" })).toMatchObject({ verdict: "marginal" });
    expect(analysed({ floodStatus: "unknown" })).toMatchObject({ verdict: "marginal" });
  });

  it("retains lot-size arithmetic as a required gate", () => {
    expect(analysed({ landAreaSqm: 700 })).toMatchObject({ verdict: "not_subdividable", potentialLots: 1 });
    expect(analysed({ landAreaSqm: 1_150 })).toMatchObject({ verdict: "marginal" });
    expect(analysed({ landAreaSqm: null })).toMatchObject({ verdict: "unknown" });
  });

  it("supports rural zones with hectare-scale minimum lots when all gates pass", () => {
    expect(analysed({
      landAreaSqm: 1_000_000,
      minLotSizeSqm: 400_000,
      zoneCode: "RU1",
      frontageM: 30,
    })).toMatchObject({ verdict: "subdividable", potentialLots: 2 });
  });

  it("preserves the existing NSW positive verdict when state is explicit", () => {
    expect(analysed({ state: "NSW", planningEvidence: "state_machine" })).toMatchObject({
      verdict: "subdividable",
      potentialLots: 2,
    });
  });
});

describe("Queensland subdivision safeguards", () => {
  const qld = (overrides: Partial<Parameters<typeof analyseSubdivisionPotential>[0]> = {}) =>
    analysed({
      state: "QLD",
      zoneCode: "Low Density Residential Zone",
      planningEvidence: "council_machine",
      ...overrides,
    });

  it("fails to unknown when council-machine planning evidence is unavailable", () => {
    expect(qld({ planningEvidence: "manual_review" })).toMatchObject({
      verdict: "unknown",
      potentialLots: null,
    });
  });

  it("caps a fully evidenced QLD arithmetic candidate at marginal for council review", () => {
    expect(qld()).toMatchObject({ verdict: "marginal", potentialLots: 2, ratio: 2.5 });
    expect(qld().explanation).toContain("council-specific");
  });

  it("still excludes non-candidate zones and mapped hazards", () => {
    expect(qld({ zoneCode: "Environmental Management and Conservation Zone" })).toMatchObject({ verdict: "not_subdividable" });
    expect(qld({ bushfireStatus: "flagged" })).toMatchObject({ verdict: "not_subdividable" });
    expect(qld({ floodStatus: "flagged" })).toMatchObject({ verdict: "not_subdividable" });
  });
});
