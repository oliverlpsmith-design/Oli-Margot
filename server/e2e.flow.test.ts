import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * End-to-end flow test using live upstream APIs (RealtyAPI + NSW Planning
 * Portal) through the tRPC router, simulating an authenticated session.
 * DB writes are exercised against the real database.
 */
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const owner: AuthenticatedUser = {
  id: 999999,
  openId: "e2e-test-user",
  email: "e2e@example.com",
  name: "E2E Test",
  loginMethod: "manus",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function ctx(): TrpcContext {
  return {
    user: owner,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

describe("e2e research flow (live APIs)", () => {
  it("searches Dubbo, analyses the first geolocated listing, and quick-analyses a batch", async () => {
    const caller = appRouter.createCaller(ctx());

    // 1. Search
    const search = await caller.property.search({ location: "Dubbo, NSW, 2830" });
    expect(search.total).toBeGreaterThan(0);
    expect(search.searchResults.length).toBeGreaterThan(0);

    // 2. Full analysis on first geolocated listing
    const withGeo = search.searchResults.find(l => l.geoLocation);
    expect(withGeo).toBeDefined();
    const analysis = await caller.property.analyse({ listingId: withGeo!.id });
    expect(analysis.detail.id).toBe(withGeo!.id);
    expect(["subdividable", "marginal", "not_subdividable", "unknown"]).toContain(
      analysis.analysis.verdict,
    );
    // Live NSW layers can respond independently. Require at least one parcel-planning
    // signal, and prove a partial response cannot become a positive subdivision verdict.
    const hasMinimumLotSize = (analysis.mls?.lotSizeSqm ?? null) !== null;
    const hasZoning = (analysis.zoning?.zoneCode ?? null) !== null;
    expect(hasMinimumLotSize || hasZoning).toBe(true);
    if (!hasMinimumLotSize || !hasZoning) {
      expect(analysis.analysis.verdict).not.toBe("subdividable");
    }

    // 3. Quick analyse first 3 geolocated listings
    const batch = search.searchResults
      .filter(l => l.geoLocation)
      .slice(0, 3)
      .map(l => ({
        id: l.id,
        latitude: l.geoLocation!.latitude,
        longitude: l.geoLocation!.longitude,
      }));
    const quick = await caller.property.quickAnalyse({ listings: batch });
    expect(quick).toHaveLength(batch.length);
    for (const q of quick) {
      expect(["subdividable", "marginal", "not_subdividable", "unknown"]).toContain(q.verdict);
    }
  }, 120000);
});
