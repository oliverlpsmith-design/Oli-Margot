import { describe, expect, it } from "vitest";
import { getMinimumLotSize, getZoning } from "./services/nswPlanning";

// Live integration tests against the NSW Planning Portal ArcGIS service.
// Test point: 105 Birch Avenue, Dubbo NSW (verified R2 zone, 600 m² MLS).
const LAT = -32.2530256;
const LNG = 148.6413323;

describe("NSW Planning Portal integration", () => {
  it("returns minimum lot size for a known point", async () => {
    const mls = await getMinimumLotSize(LAT, LNG);
    expect(mls.lotSize).toBe(600);
    expect(mls.units).toBe("m²");
    expect(mls.lotSizeSqm).toBe(600);
    expect(mls.epiName).toContain("Dubbo");
  }, 30000);

  it("returns zoning for a known point", async () => {
    const z = await getZoning(LAT, LNG);
    expect(z.zoneCode).toBe("R2");
    expect(z.zoneDescription).toBe("Low Density Residential");
  }, 30000);
});

