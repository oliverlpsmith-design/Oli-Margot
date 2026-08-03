/**
 * Tests for the value-sort, CSV export cap, price parsing, and saved-search
 * alert flow added in the catalogue-first upgrade batch.
 */
import { describe, expect, it } from "vitest";
import { parsePriceNumeric } from "./services/realtyApi";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function publicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function userCtx(id = 9991): TrpcContext {
  return {
    user: {
      id,
      openId: `test-user-${id}`,
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}
function adminCtx(): TrpcContext {
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
    res: {} as TrpcContext["res"],
  };
}

describe("parsePriceNumeric", () => {
  it("parses plain figures", () => {
    expect(parsePriceNumeric("$1,200,000")).toBe(1_200_000);
    expect(parsePriceNumeric("Offers over $850,000")).toBe(850_000);
  });
  it("parses shorthand", () => {
    expect(parsePriceNumeric("$1.2m")).toBe(1_200_000);
    expect(parsePriceNumeric("$950k")).toBe(950_000);
  });
  it("takes the low end of ranges", () => {
    expect(parsePriceNumeric("$800,000 - $880,000")).toBe(800_000);
  });
  it("returns null for auctions / POA / junk", () => {
    expect(parsePriceNumeric("Auction")).toBeNull();
    expect(parsePriceNumeric("Contact agent")).toBeNull();
    expect(parsePriceNumeric("POA")).toBeNull();
    expect(parsePriceNumeric(null)).toBeNull();
    expect(parsePriceNumeric("$5,000")).toBeNull(); // below sanity floor
  });
});

describe("catalogue.browse price_per_lot sort", () => {
  it("orders computable ratios ascending with nulls last", async () => {
    const caller = appRouter.createCaller(publicCtx());
    const res = await caller.catalogue.browse({ sort: "price_per_lot", pageSize: 24 });
    const ratios = res.rows
      .map((r) =>
        r.priceNumeric != null && r.potentialLots != null && r.potentialLots >= 1
          ? Number(r.priceNumeric) / r.potentialLots
          : null,
      );
    // Once a null appears, no non-null may follow (nulls last)
    const firstNull = ratios.indexOf(null);
    if (firstNull !== -1) {
      expect(ratios.slice(firstNull).every((v) => v === null)).toBe(true);
    }
    const computable = ratios.filter((v): v is number => v !== null);
    for (let i = 1; i < computable.length; i++) {
      expect(computable[i]!).toBeGreaterThanOrEqual(computable[i - 1]!);
    }
  }, 30_000);
});

describe("catalogue.export", () => {
  it("returns un-paged filtered rows within the cap", async () => {
    const caller = appRouter.createCaller(adminCtx());
    const rows = await caller.catalogue.export({ minScore: 80 });
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeLessThanOrEqual(2000);
    for (const r of rows.slice(0, 20)) {
      expect(r.score ?? 0).toBeGreaterThanOrEqual(80);
    }
  }, 30_000);
});

describe("savedSearch CRUD", () => {
  it("rejects anonymous access", async () => {
    const caller = appRouter.createCaller(publicCtx());
    await expect(caller.savedSearch.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("enforces the 10-saved-searches-per-user limit", async () => {
    const { getDb } = await import("./db");
    const { savedSearches, users } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = (await getDb())!;
    const openId = "vitest-limit-user";
    await db
      .insert(users)
      .values({ openId, name: "Vitest Limit User" })
      .onDuplicateKeyUpdate({ set: { name: "Vitest Limit User" } });
    const [u] = await db.select().from(users).where(eq(users.openId, openId));
    const uid = u!.id;
    try {
      const caller = appRouter.createCaller(userCtx(uid));
      for (let i = 0; i < 10; i++) {
        await caller.savedSearch.create({ name: `limit-test-${i}`, filters: { minScore: 90 } });
      }
      await expect(
        caller.savedSearch.create({ name: "limit-test-overflow", filters: { minScore: 90 } }),
      ).rejects.toThrow(/limit/i);
      const mine = await caller.savedSearch.list();
      expect(mine.length).toBe(10);
    } finally {
      await db.delete(savedSearches).where(eq(savedSearches.userId, uid));
      await db.delete(users).where(eq(users.id, uid));
    }
  }, 30_000);

  it("round-trips state and descriptive QLD zoning names through create and list", async () => {
    const { getDb } = await import("./db");
    const { savedSearches, users } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = (await getDb())!;
    const openId = "vitest-zones-user";
    await db
      .insert(users)
      .values({ openId, name: "Vitest Zones User" })
      .onDuplicateKeyUpdate({ set: { name: "Vitest Zones User" } });
    const [u] = await db.select().from(users).where(eq(users.openId, openId));
    const uid = u!.id;
    try {
      const caller = appRouter.createCaller(userCtx(uid));
      await caller.savedSearch.create({
        name: "zones-round-trip",
        filters: {
          state: "QLD",
          minScore: 75,
          zones: ["Low Density Residential Zone", "Emerging Community Zone"],
        },
      });
      const mine = await caller.savedSearch.list();
      const saved = mine.find((s) => s.name === "zones-round-trip");
      expect(saved).toBeDefined();
      const filters = JSON.parse(saved!.filters) as {
        state?: "NSW" | "QLD";
        zones?: string[];
        minScore?: number;
        minLandAreaSqm?: number;
      };
      expect(filters.state).toBe("QLD");
      expect(filters.zones).toEqual(["Low Density Residential Zone", "Emerging Community Zone"]);
      expect(filters.minScore).toBe(75);
      expect(filters.minLandAreaSqm).toBe(404_700);
    } finally {
      await db.delete(savedSearches).where(eq(savedSearches.userId, uid));
      await db.delete(users).where(eq(users.id, uid));
    }
  }, 30_000);

  it("preserves explicit zero and custom land-size overrides", async () => {
    const { getDb } = await import("./db");
    const { savedSearches, users } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = (await getDb())!;
    const openId = "vitest-land-override-user";
    await db
      .insert(users)
      .values({ openId, name: "Vitest Land Override User" })
      .onDuplicateKeyUpdate({ set: { name: "Vitest Land Override User" } });
    const [u] = await db.select().from(users).where(eq(users.openId, openId));
    const uid = u!.id;
    try {
      const caller = appRouter.createCaller(userCtx(uid));
      await caller.savedSearch.create({ name: "no-land-floor", filters: { minLandAreaSqm: 0 } });
      await caller.savedSearch.create({ name: "custom-land-floor", filters: { minLandAreaSqm: 250_000 } });
      const mine = await caller.savedSearch.list();
      const noFloor = JSON.parse(mine.find((s) => s.name === "no-land-floor")!.filters) as { minLandAreaSqm: number };
      const custom = JSON.parse(mine.find((s) => s.name === "custom-land-floor")!.filters) as { minLandAreaSqm: number };
      expect(noFloor.minLandAreaSqm).toBe(0);
      expect(custom.minLandAreaSqm).toBe(250_000);
    } finally {
      await db.delete(savedSearches).where(eq(savedSearches.userId, uid));
      await db.delete(users).where(eq(users.id, uid));
    }
  }, 30_000);
});
