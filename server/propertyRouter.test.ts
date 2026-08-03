import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  saveProperty: vi.fn().mockResolvedValue(undefined),
  listSavedProperties: vi.fn().mockResolvedValue([{ id: 1, address: "105 Birch Avenue, Dubbo" }]),
  updatePropertyNotes: vi.fn().mockResolvedValue(undefined),
  archiveProperty: vi.fn().mockResolvedValue(undefined),
  recordSearch: vi.fn().mockResolvedValue(undefined),
  listRecentSearches: vi.fn().mockResolvedValue([]),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getDb: vi.fn().mockResolvedValue(null),
}));

import { appRouter } from "./routers";
import * as dbModule from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeCtx(user: AuthenticatedUser | null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

const testUser: AuthenticatedUser = {
  id: 42,
  openId: "test-user",
  email: "test@example.com",
  name: "Test User",
  loginMethod: "manus",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("property router", () => {
  it("allows anonymous access to watchlist procedures (public site)", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    const rows = await caller.property.listSaved();
    expect(rows).toHaveLength(1);
    const result = await caller.property.save({ address: "x", verdict: "unknown" });
    expect(result.success).toBe(true);
    // Anonymous saves are stored under the shared user id 0
    expect(dbModule.saveProperty).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 0, address: "x" }),
    );
  });

  it("saves a property for the signed-in user", async () => {
    const caller = appRouter.createCaller(makeCtx(testUser));
    const result = await caller.property.save({
      listingId: "2020996553",
      address: "105 Birch Avenue, Dubbo",
      suburb: "Dubbo",
      postcode: "2830",
      latitude: -32.2530256,
      longitude: 148.6413323,
      landAreaSqm: 950,
      minLotSizeSqm: 600,
      verdict: "not_subdividable",
    });
    expect(result.success).toBe(true);
    expect(dbModule.saveProperty).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 42, address: "105 Birch Avenue, Dubbo" }),
    );
  });

  it("lists the shared watchlist", async () => {
    const caller = appRouter.createCaller(makeCtx(testUser));
    const rows = await caller.property.listSaved();
    expect(rows).toHaveLength(1);
    expect(dbModule.listSavedProperties).toHaveBeenCalledWith();
  });

  it("archives (removes) a saved property", async () => {
    const caller = appRouter.createCaller(makeCtx(testUser));
    const result = await caller.property.remove({ id: 7 });
    expect(result.success).toBe(true);
    expect(dbModule.archiveProperty).toHaveBeenCalledWith(7);
  });

  it("validates search input", async () => {
    const caller = appRouter.createCaller(makeCtx(testUser));
    await expect(caller.property.search({ location: "x" })).rejects.toThrow();
  });

  it("rejects every RealtyAPI or planning-data action for a regular user", async () => {
    const caller = appRouter.createCaller(makeCtx(testUser));

    await expect(caller.property.autocomplete({ keyword: "Dubbo" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.property.search({ location: "Dubbo" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.property.quickAnalyse({ listings: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.property.comparables({ lgaName: "Dubbo Regional Council" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.property.rankedScan({ location: "Dubbo" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.property.analyse({ listingId: "2020996553" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.property.planningAtPoint({ latitude: -32.253, longitude: 148.642 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
