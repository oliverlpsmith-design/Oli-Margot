import { describe, expect, it } from "vitest";
import { categoriseListing } from "./services/realtyApi";
import { assessRisks, checkBushfire, checkHeritage } from "./services/riskLayers";
import {
  ALL_REGIONS,
  COVERED_STATES,
  getRegionById,
  getRegionsByState,
  NSW_REGIONS,
  QLD_REGIONS,
  stateWideLocations,
} from "../shared/regions";

describe("categoriseListing", () => {
  it("classifies houses with bedrooms as cash_flow", () => {
    expect(categoriseListing({ propertyType: "House", bedrooms: 3, bathrooms: 1 })).toBe("cash_flow");
  });
  it("classifies vacant land as land_only", () => {
    expect(categoriseListing({ propertyType: "VacantLand" })).toBe("land_only");
    expect(categoriseListing({ propertyType: "Vacant Land" })).toBe("land_only");
    expect(categoriseListing({ propertyType: "DevelopmentSite" })).toBe("land_only");
  });
  it("classifies acreage with beds as cash_flow", () => {
    expect(categoriseListing({ propertyType: "AcreageSemiRural", bedrooms: 4 })).toBe("cash_flow");
  });
  it("classifies typed dwellings without bed data as cash_flow", () => {
    expect(categoriseListing({ propertyType: "House" })).toBe("cash_flow");
  });
  it("returns unknown when nothing is known", () => {
    expect(categoriseListing({})).toBe("unknown");
  });
});

describe("NSW_REGIONS catalogue", () => {
  it("has unique ids and non-empty locations", () => {
    const ids = NSW_REGIONS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of NSW_REGIONS) expect(r.locations.length).toBeGreaterThan(0);
  });
  it("resolves regions by id and fans out state-wide", () => {
    expect(getRegionById("mid-north-coast")?.label).toBe("Mid North Coast");
    expect(stateWideLocations().length).toBeGreaterThanOrEqual(NSW_REGIONS.length);
  });

  it("preserves the validated 34-location NSW regression baseline", () => {
    expect(stateWideLocations("NSW")).toHaveLength(34);
    expect(getRegionsByState("NSW")).toEqual(NSW_REGIONS);
  });
});

describe("QLD_REGIONS catalogue", () => {
  it("exposes 15 groups, 17 validated search units, and all 77 councils exactly once", () => {
    const locations = QLD_REGIONS.flatMap(region => region.locations);
    const councils = QLD_REGIONS.flatMap(region => region.lgas ?? []);
    expect(QLD_REGIONS).toHaveLength(15);
    expect(locations).toHaveLength(17);
    expect(new Set(locations).size).toBe(17);
    expect(councils).toHaveLength(77);
    expect(new Set(councils).size).toBe(77);
    expect(QLD_REGIONS.every(region => region.state === "QLD")).toBe(true);
  });

  it("keeps identifiers unique across both states and resolves statewide QLD fan-out", () => {
    expect(COVERED_STATES).toEqual(["NSW", "QLD"]);
    expect(new Set(ALL_REGIONS.map(region => region.id)).size).toBe(ALL_REGIONS.length);
    expect(stateWideLocations("QLD")).toHaveLength(17);
    expect(getRegionById("qld-gold-coast")).toMatchObject({ state: "QLD", label: "Gold Coast" });
  });
});

describe("risk layers (live government services)", () => {
  it("flags bushfire prone land in Blue Mountains bushland", async () => {
    const res = await checkBushfire(150.39, -33.7);
    expect(res.status).toBe("flagged");
    expect(res.detail).toContain("Category");
  }, 30000);

  it("flags heritage in central Katoomba", async () => {
    const res = await checkHeritage(150.312, -33.7145);
    expect(res.status).toBe("flagged");
    expect(res.items.length).toBeGreaterThan(0);
  }, 30000);

  it("returns a full assessment with all four layers", async () => {
    const risks = await assessRisks(148.6413, -32.253); // Dubbo residential
    expect(risks.bushfire.status).toMatch(/clear|flagged|unknown/);
    expect(risks.biodiversity.status).toMatch(/clear|flagged|unknown/);
    expect(risks.flood.status).toMatch(/clear|flagged|unknown/);
    expect(risks.heritage.status).toMatch(/clear|flagged|unknown/);
  }, 45000);
});
