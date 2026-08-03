import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import {
  findSubdivisionComparables,
  haversineKm,
  lgaToCouncilName,
} from "./services/daComparables";
import { analyseSubdivisionPotential, scoreSubdivisionPotential } from "./services/subdivision";

function authedCaller() {
  const user = {
    id: 1,
    openId: "test-user",
    email: "t@example.com",
    name: "Test",
    loginMethod: "manus",
    role: "admin" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  } as TrpcContext;
  return appRouter.createCaller(ctx);
}

describe("scoreSubdivisionPotential", () => {
  const analysed = (landAreaSqm: number | null, minLotSizeSqm: number | null, zoneCode?: string) =>
    analyseSubdivisionPotential({
      landAreaSqm,
      minLotSizeSqm,
      zoneCode: zoneCode ?? "R2",
      frontageM: 15,
      bushfireStatus: "clear",
      floodStatus: "clear",
    });

  it("ranks higher yield above lower yield", () => {
    const fourLots = scoreSubdivisionPotential({
      analysis: analysed(4000, 1000),
      hasLandArea: true,
      hasMls: true,
    });
    const twoLots = scoreSubdivisionPotential({
      analysis: analysed(2000, 1000),
      hasLandArea: true,
      hasMls: true,
    });
    expect(fourLots).toBeGreaterThan(twoLots);
  });

  it("ranks subdividable > marginal > unknown > not_subdividable", () => {
    const sub = scoreSubdivisionPotential({ analysis: analysed(2100, 1000), hasLandArea: true, hasMls: true });
    const marginal = scoreSubdivisionPotential({ analysis: analysed(1850, 1000), hasLandArea: true, hasMls: true });
    const unknown = scoreSubdivisionPotential({ analysis: analysed(null, 1000), hasLandArea: false, hasMls: true });
    const not = scoreSubdivisionPotential({ analysis: analysed(1200, 1000), hasLandArea: true, hasMls: true });
    expect(sub).toBeGreaterThan(marginal);
    expect(marginal).toBeGreaterThan(unknown);
    expect(unknown).toBeGreaterThan(not);
  });

  it("gives cash-flow a small tiebreak and stays within 0-100", () => {
    const base = { analysis: analysed(6000, 1000), hasLandArea: true, hasMls: true };
    const cash = scoreSubdivisionPotential({ ...base, category: "cash_flow" });
    const land = scoreSubdivisionPotential({ ...base, category: "land_only" });
    expect(cash).toBeGreaterThan(land);
    expect(cash).toBeLessThanOrEqual(100);
  });
});

describe("lgaToCouncilName", () => {
  it("appends Council when missing", () => {
    expect(lgaToCouncilName("DUBBO REGIONAL")).toBe("DUBBO REGIONAL Council");
  });
  it("keeps existing council/shire names", () => {
    expect(lgaToCouncilName("Sutherland Shire")).toBe("Sutherland Shire");
    expect(lgaToCouncilName("Dubbo Regional Council")).toBe("Dubbo Regional Council");
  });
});

describe("haversineKm", () => {
  it("computes sensible distances", () => {
    // Sydney CBD to Parramatta ≈ 20km
    const d = haversineKm(-33.8688, 151.2093, -33.815, 151.0);
    expect(d).toBeGreaterThan(15);
    expect(d).toBeLessThan(25);
  });
});

describe("findSubdivisionComparables (live OnlineDA API)", () => {
  it("returns nearby subdivision DAs for Dubbo sorted by distance", async () => {
    const res = await findSubdivisionComparables({
      councilName: "Dubbo Regional Council",
      latitude: -32.2569,
      longitude: 148.601,
      limit: 8,
      maxPages: 2,
    });
    expect(res.scanned).toBeGreaterThan(0);
    expect(res.comparables.length).toBeGreaterThan(0);
    const first = res.comparables[0]!;
    expect(first.panNumber).toMatch(/^PAN-/);
    expect(first.address).toBeTruthy();
    // Determined DAs should come before non-determined
    const statuses = res.comparables.map((c) => (c.status === "Determined" ? 0 : 1));
    expect([...statuses].sort()).toEqual(statuses);
  }, 120000);
});

describe("property.rankedScan (live)", () => {
  it("analyses server-side, keeps only confirmed verdicts, and sorts by score", async () => {
    const caller = authedCaller();
    const res = await caller.property.rankedScan({ location: "Dubbo, NSW, 2830" });
    expect(res.analysedCount).toBeGreaterThan(0);
    // Viability filter: results = keptCount ≤ analysedCount
    expect(res.results.length).toBe(res.keptCount);
    expect(res.keptCount).toBeLessThanOrEqual(res.analysedCount);
    expect(res.landFloorSqm).toBe(700);
    const scores = res.results.map((r) => r.score);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
    for (const r of res.results) {
      // default output = confirmed subdividable/marginal ONLY (no unknowns)
      expect(["subdividable", "marginal"]).toContain(r.verdict);
      // confirmed land areas respect the 700 m² floor (unknowns allowed)
      if (r.landAreaSqm !== null) expect(r.landAreaSqm).toBeGreaterThanOrEqual(700);
      // property-type source filter: no apartment/unit stock
      expect((r.propertyType ?? "").toLowerCase()).not.toContain("apartment");
    }
  }, 120000);
});
