import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("property.stats (public landing page stats)", () => {
  it("returns non-negative aggregate usage counters without auth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const stats = await caller.property.stats();

    expect(typeof stats.searches).toBe("number");
    expect(typeof stats.listingsScanned).toBe("number");
    expect(typeof stats.savedProperties).toBe("number");
    expect(stats.searches).toBeGreaterThanOrEqual(0);
    expect(stats.listingsScanned).toBeGreaterThanOrEqual(0);
    expect(stats.savedProperties).toBeGreaterThanOrEqual(0);
    // listingsScanned is a cumulative sum across searches, so it can never
    // be positive while searches is zero.
    if (stats.searches === 0) {
      expect(stats.listingsScanned).toBe(0);
    }
  });
});
