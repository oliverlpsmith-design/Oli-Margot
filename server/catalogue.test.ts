import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { hasNewEstateKeywords, parseFrontageM } from "./services/realtyApi";
import { buildPopupHtml, markerColour, type MapListing } from "../client/src/components/CatalogueMap";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}
function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 9990,
      openId: "test-admin",
      email: "admin@example.com",
      name: "Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  return {
    user: {
      id: 9991,
      openId: "test-user",
      email: "user@example.com",
      name: "User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

describe("catalogue endpoints", () => {
  it("browse returns paged rows with totals and respects filters", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.catalogue.browse({ pageSize: 6, page: 1 });
    expect(result).toHaveProperty("rows");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.rows)).toBe(true);
    expect(result.rows.length).toBeLessThanOrEqual(6);
    // Default filter only surfaces confirmed verdicts
    for (const row of result.rows) {
      expect(["subdividable", "marginal"]).toContain(row.verdict);
      expect(row.status).toBe("active");
    }
  });

  it("browse maxDaysOnMarket filters out stale listings", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.catalogue.browse({
      maxDaysOnMarket: 30,
      verdicts: ["subdividable", "marginal", "not_subdividable", "unknown"],
      pageSize: 10,
    });
    const cutoff = Date.now() - 31 * 24 * 3600_000;
    for (const row of result.rows) {
      const listed = new Date(row.listedAt ?? row.firstSeenAt).getTime();
      expect(listed).toBeGreaterThan(cutoff);
    }
  });

  it("stats returns aggregate counts", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const stats = await caller.catalogue.stats();
    expect(stats.active).toBeGreaterThanOrEqual(0);
    expect(stats.subdividable).toBeGreaterThanOrEqual(0);
    expect(stats.subdividable + stats.marginal).toBeLessThanOrEqual(stats.active);
  });

  it("latestFinds returns only active confirmed finds, newest first", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const finds = await caller.catalogue.latestFinds({ limit: 5 });
    expect(finds.length).toBeLessThanOrEqual(5);
    for (const f of finds) {
      expect(["subdividable", "marginal"]).toContain(f.verdict);
    }
    // Sorted by listing date desc
    for (let i = 1; i < finds.length; i++) {
      const prev = new Date(finds[i - 1]!.listedAt ?? finds[i - 1]!.firstSeenAt).getTime();
      const cur = new Date(finds[i]!.listedAt ?? finds[i]!.firstSeenAt).getTime();
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
  });

  it("runScan is denied to non-admin users before it can burn scan credits", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.catalogue.runScan({ mode: "incremental" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("exposes state-tagged NSW and QLD region groups without making a listing request", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const regions = await caller.property.regions();
    expect(regions.filter(region => region.state === "NSW")).toHaveLength(12);
    expect(regions.filter(region => region.state === "QLD")).toHaveLength(15);
    expect(regions.filter(region => region.state === "NSW").reduce((sum, region) => sum + region.locationCount, 0)).toBe(34);
    expect(regions.filter(region => region.state === "QLD").reduce((sum, region) => sum + region.locationCount, 0)).toBe(17);
  });

  it("scopes stored catalogue browsing to the selected state", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const verdicts = ["subdividable", "marginal", "not_subdividable", "unknown"] as const;
    const nsw = await caller.catalogue.browse({ state: "NSW", verdicts: [...verdicts], pageSize: 50 });
    expect(nsw.rows.every(row => row.state === "NSW")).toBe(true);
    const qld = await caller.catalogue.browse({ state: "QLD", verdicts: [...verdicts], pageSize: 50 });
    expect(qld.rows.every(row => row.state === "QLD")).toBe(true);
  });

  it("keeps CSV export unavailable to regular users", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.catalogue.export({ state: "QLD" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("practicality filters (false-positive reduction)", () => {
  it("minimum and maximum price are strict and exclude unknown asking prices", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.catalogue.browse({
      minPrice: 400_000,
      maxPrice: 1_500_000,
      verdicts: ["subdividable", "marginal", "not_subdividable", "unknown"],
      pageSize: 40,
    });
    expect(result.total).toBeGreaterThan(0);
    for (const row of result.rows) {
      expect(row.priceNumeric).not.toBeNull();
      expect(Number(row.priceNumeric)).toBeGreaterThanOrEqual(400_000);
      expect(Number(row.priceNumeric)).toBeLessThanOrEqual(1_500_000);
    }
  });

  it("minLandAreaSqm is strict — every returned row has a known land area above the floor", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.catalogue.browse({ minLandAreaSqm: 1500, pageSize: 20 });
    for (const row of result.rows) {
      expect(row.landAreaSqm).not.toBeNull();
      expect(Number(row.landAreaSqm)).toBeGreaterThanOrEqual(1500);
    }
  });

  it("minFrontageM is lenient — unknown frontage passes, known-narrow is excluded", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.catalogue.browse({ minFrontageM: 15, pageSize: 30 });
    for (const row of result.rows) {
      if (row.frontageM !== null) {
        expect(Number(row.frontageM)).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it("maxCoveragePct is lenient — unknown coverage passes, known-high is excluded", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.catalogue.browse({ maxCoveragePct: 25, pageSize: 30 });
    for (const row of result.rows) {
      if (row.coveragePct !== null) {
        expect(Number(row.coveragePct)).toBeLessThanOrEqual(25);
      }
    }
  });

  it("excludeNewBuilds removes rows flagged as new builds", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.catalogue.browse({ excludeNewBuilds: true, pageSize: 30 });
    for (const row of result.rows) {
      expect(row.isNewBuild).toBe(false);
    }
  });

  it("filters can combine without error", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.catalogue.browse({
      minLandAreaSqm: 1000,
      minFrontageM: 12,
      maxCoveragePct: 50,
      excludeNewBuilds: true,
      pageSize: 10,
    });
    expect(result).toHaveProperty("total");
    for (const row of result.rows) {
      expect(Number(row.landAreaSqm)).toBeGreaterThanOrEqual(1000);
      expect(row.isNewBuild).toBe(false);
    }
  });

  it("rejects a land-size floor above the 500-acre product limit", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.catalogue.browse({ minLandAreaSqm: 2_023_501 }),
    ).rejects.toThrow();
  });
});

describe("niche category filters", () => {
  it("applies deferred price and land-size bounds to category results", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.catalogue.browseByTag({
      tag: "dev_site",
      minPrice: 300_000,
      maxPrice: 3_000_000,
      minLandAreaSqm: 450,
      pageSize: 40,
    });

    expect(result.total).toBeGreaterThan(0);
    for (const row of result.rows) {
      expect(row.investmentTags?.split("|")).toContain("dev_site");
      expect(Number(row.priceNumeric)).toBeGreaterThanOrEqual(300_000);
      expect(Number(row.priceNumeric)).toBeLessThanOrEqual(3_000_000);
      expect(Number(row.landAreaSqm)).toBeGreaterThanOrEqual(450);
    }
  });
});

describe("parseFrontageM", () => {
  it("parses common frontage phrasings", () => {
    expect(parseFrontageM("Set on a 455 m² block with a 14 m frontage")).toBe(14);
    expect(parseFrontageM("boasting a frontage of 18.5 metres")).toBe(18.5);
    expect(parseFrontageM("Land Width: 14 m<br/>Contemporary façade")).toBe(14);
    expect(parseFrontageM("wide 20m frontage ready to build")).toBe(20);
  });

  it("returns null when no frontage is mentioned or value is implausible", () => {
    expect(parseFrontageM("Beautiful family home close to schools")).toBeNull();
    expect(parseFrontageM(undefined)).toBeNull();
    expect(parseFrontageM("frontage of 1 m")).toBeNull();
    expect(parseFrontageM("400m frontage to the highway")).toBeNull();
  });
});

describe("hasNewEstateKeywords", () => {
  it("detects house-and-land and new-estate marketing copy", () => {
    expect(hasNewEstateKeywords("House and Land Package in Willowdale")).toBe(true);
    expect(hasNewEstateKeywords("Brand new home, never lived in")).toBe(true);
    expect(hasNewEstateKeywords(null, "Located within the Gables Estate community")).toBe(true);
    expect(hasNewEstateKeywords("Off the plan opportunity")).toBe(true);
  });

  it("does not flag established-home copy", () => {
    expect(hasNewEstateKeywords("Charming federation cottage on 1,200 sqm")).toBe(false);
    expect(hasNewEstateKeywords("Renovated family home with pool")).toBe(false);
    expect(hasNewEstateKeywords(undefined, undefined)).toBe(false);
  });
});

describe("catalogue zoning filter", () => {
  it("zoneCodes returns available zone codes with counts", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const zones = await caller.catalogue.zoneCodes();
    expect(Array.isArray(zones)).toBe(true);
    expect(zones.length).toBeGreaterThan(0);
    for (const z of zones.slice(0, 5)) {
      expect(typeof z.zoneCode).toBe("string");
      expect(z.zoneCode.length).toBeGreaterThan(0);
      expect(z.count).toBeGreaterThan(0);
    }
  });

  it("accepts state-scoped zone requests for both covered jurisdictions", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const nsw = await caller.catalogue.zoneCodes({ state: "NSW" });
    const qld = await caller.catalogue.zoneCodes({ state: "QLD" });
    expect(Array.isArray(nsw)).toBe(true);
    expect(Array.isArray(qld)).toBe(true);
  });

  it("browse with zones only returns listings in those zones", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const zones = await caller.catalogue.zoneCodes();
    const pick = zones.slice(0, 2).map((z) => z.zoneCode);
    const result = await caller.catalogue.browse({
      verdicts: ["subdividable", "marginal", "not_subdividable", "unknown"],
      zones: pick,
      pageSize: 50,
    });
    expect(result.total).toBeGreaterThan(0);
    for (const row of result.rows) {
      expect(pick).toContain(row.zoneCode);
    }
  });

  it("map respects the zones filter", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const zones = await caller.catalogue.zoneCodes();
    const pick = [zones[0]!.zoneCode];
    const rows = await caller.catalogue.map({
      verdicts: ["subdividable", "marginal", "not_subdividable", "unknown"],
      zones: pick,
    });
    for (const row of rows.slice(0, 50)) {
      expect(row.zoneCode).toBe(pick[0]);
    }
  });

  it("export respects the zones filter", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const zones = await caller.catalogue.zoneCodes();
    const pick = zones.slice(0, 2).map((z) => z.zoneCode);
    const rows = await caller.catalogue.export({
      verdicts: ["subdividable", "marginal", "not_subdividable", "unknown"],
      zones: pick,
    });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows.slice(0, 100)) {
      expect(pick).toContain(row.zoneCode);
    }
  });
});

describe("catalogue.map", () => {
  it("returns only geolocated rows and respects minScore", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const rows = await caller.catalogue.map({ minScore: 80 });
    expect(rows.length).toBeLessThanOrEqual(2500);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows.slice(0, 50)) {
      expect(row.latitude).not.toBeNull();
      expect(row.longitude).not.toBeNull();
      expect(Number(row.latitude)).toBeLessThan(0); // southern hemisphere
      expect(row.score ?? 0).toBeGreaterThanOrEqual(80);
    }
  });

  it("respects region filter", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const rows = await caller.catalogue.map({ regionId: "riverina", minScore: 80 });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(2500);
  });
});

describe("map marker helpers", () => {
  it("colours markers by score band", () => {
    expect(markerColour(97).fill).toBe("#059669");
    expect(markerColour(75).fill).toBe("#059669");
    expect(markerColour(60).fill).toBe("#d97706");
    expect(markerColour(20).fill).toBe("#dc2626");
    expect(markerColour(null).fill).toBe("#dc2626");
  });

  it("builds escaped popup html with price per lot", () => {
    const listing: MapListing = {
      id: 1,
      listingId: "x1",
      latitude: "-33.1",
      longitude: "150.2",
      address: `10 <script>alert("x")</script> Rd, Test, NSW`,
      suburb: "Test",
      postcode: "2000",
      verdict: "subdividable",
      score: 91,
      category: "cash_flow",
      landAreaSqm: "2400.00",
      priceDisplay: "$1,200,000",
      priceNumeric: "1200000.00",
      potentialLots: 3,
      listedAt: new Date(Date.now() - 2 * 86_400_000),
      firstSeenAt: new Date(),
      listingUrl: "https://www.realestate.com.au/property-1",
    };
    const html = buildPopupHtml(listing);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("$400,000 per potential lot");
    expect(html).toContain("2,400 m² land");
    expect(html).toContain("Listed 2 days ago");
    expect(html).toContain("realestate.com.au");
  });
});
