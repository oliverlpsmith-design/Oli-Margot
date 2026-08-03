import { and, desc, eq, gte, inArray, lt, sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  catalogueListings,
  InsertCatalogueListing,
  InsertSavedProperty,
  InsertUser,
  savedProperties,
  savedSearches,
  scanRuns,
  searchHistory,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { withSubdivisionDefaultMinLand } from "../shared/subdivisionDefaults";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function saveProperty(data: InsertSavedProperty) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(savedProperties).values(data);
  return result;
}

/** Shared watchlist: returns ALL active saved properties (site is public/no-login). */
export async function listSavedProperties() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(savedProperties)
    .where(eq(savedProperties.isArchived, false))
    .orderBy(desc(savedProperties.createdAt));
}

export async function updatePropertyNotes(id: number, notes: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(savedProperties)
    .set({ notes })
    .where(eq(savedProperties.id, id));
}

export async function archiveProperty(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(savedProperties)
    .set({ isArchived: true })
    .where(eq(savedProperties.id, id));
}

export async function recordSearch(userId: number, location: string, filters: unknown, resultCount: number) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(searchHistory).values({ userId, location, filters, resultCount });
  } catch (error) {
    console.warn("[Database] Failed to record search:", error);
  }
}

/** Shared recent searches across all visitors (site is public/no-login). */
export async function listRecentSearches(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(searchHistory)
    .orderBy(desc(searchHistory.createdAt))
    .limit(limit);
}

/**
 * Aggregate usage stats for the public landing page credibility strip.
 * listingsScanned = cumulative result counts across all recorded searches.
 */
export async function getUsageStats() {
  const db = await getDb();
  if (!db) return { searches: 0, listingsScanned: 0, savedProperties: 0 };
  const [searchAgg, savedAgg] = await Promise.all([
    db
      .select({
        searches: sql<number>`count(*)`,
        listingsScanned: sql<number>`coalesce(sum(${searchHistory.resultCount}), 0)`,
      })
      .from(searchHistory),
    db
      .select({ saved: sql<number>`count(*)` })
      .from(savedProperties)
      .where(eq(savedProperties.isArchived, false)),
  ]);
  return {
    searches: Number(searchAgg[0]?.searches ?? 0),
    listingsScanned: Number(searchAgg[0]?.listingsScanned ?? 0),
    savedProperties: Number(savedAgg[0]?.saved ?? 0),
  };
}

/* ------------------------------------------------------------------ */
/* Catalogue: comprehensive analysed-listing store (sweep engine)      */
/* ------------------------------------------------------------------ */

/** All known listing ids (any status). Used by the sweep to skip re-analysis. */
export async function getKnownListingIds(): Promise<Set<string>> {
  const db = await getDb();
  if (!db) return new Set();
  const rows = await db.select({ listingId: catalogueListings.listingId }).from(catalogueListings);
  return new Set(rows.map((r) => r.listingId));
}

/** Insert a newly analysed listing; on duplicate id, refresh volatile fields. */
export async function upsertCatalogueListing(data: InsertCatalogueListing) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(catalogueListings)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        priceDisplay: data.priceDisplay,
        status: "active",
        lastSeenAt: new Date(),
        soldDetectedAt: null,
      },
    });
}

/**
 * Active rows produced by an older classifier ruleset. The nightly scan uses
 * only these stored listing/planning fields, so upgrades consume no RealtyAPI
 * or NSW planning requests.
 */
export async function listCatalogueRowsForClassifierUpgrade(version: number, limit = 1_000) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: catalogueListings.id,
      state: catalogueListings.state,
      headline: catalogueListings.headline,
      descriptionShort: catalogueListings.descriptionShort,
      priceNumeric: catalogueListings.priceNumeric,
      bedrooms: catalogueListings.bedrooms,
      zoneCode: catalogueListings.zoneCode,
      propertyType: catalogueListings.propertyType,
      landAreaSqm: catalogueListings.landAreaSqm,
      minLotSizeSqm: catalogueListings.minLotSizeSqm,
      frontageM: catalogueListings.frontageM,
      fsrValue: catalogueListings.fsrValue,
      bushfireStatus: catalogueListings.bushfireStatus,
      floodStatus: catalogueListings.floodStatus,
      category: catalogueListings.category,
      classificationEvidence: catalogueListings.classificationEvidence,
    })
    .from(catalogueListings)
    .where(and(
      eq(catalogueListings.status, "active"),
      lt(catalogueListings.classifierVersion, version),
    ))
    .orderBy(catalogueListings.id)
    .limit(limit);
}

/** Persist one historical row's versioned tags, evidence, and stricter subdivision result. */
export async function updateCatalogueClassification(
  id: number,
  data: {
    investmentTags: string;
    classifierVersion: number;
    classificationEvidence: Record<string, unknown>;
    potentialLots: number | null;
    verdict: "subdividable" | "marginal" | "not_subdividable" | "unknown";
    score: number;
  },
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(catalogueListings)
    .set(data)
    .where(eq(catalogueListings.id, id));
}

/** Bulk-refresh lastSeenAt for listings confirmed still on market. */
export async function touchListingsSeen(listingIds: string[]) {
  if (listingIds.length === 0) return;
  const db = await getDb();
  if (!db) return;
  await db
    .update(catalogueListings)
    .set({ lastSeenAt: new Date(), status: "active", soldDetectedAt: null })
    .where(inArray(catalogueListings.listingId, listingIds));
}

/** Active listings not seen since `cutoff` — candidates for sold checks. */
export async function listStaleActiveListings(cutoff: Date, limit = 200) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ listingId: catalogueListings.listingId, lastSeenAt: catalogueListings.lastSeenAt })
    .from(catalogueListings)
    .where(and(eq(catalogueListings.status, "active"), lt(catalogueListings.lastSeenAt, cutoff)))
    .orderBy(catalogueListings.lastSeenAt)
    .limit(limit);
}

/** Mark listings as sold/removed (off-market confirmed). */
export async function markListingsSold(listingIds: string[]) {
  if (listingIds.length === 0) return;
  const db = await getDb();
  if (!db) return;
  await db
    .update(catalogueListings)
    .set({ status: "sold", soldDetectedAt: new Date() })
    .where(inArray(catalogueListings.listingId, listingIds));
}

export interface CatalogueBrowseFilters {
  state?: "NSW" | "QLD";
  regionId?: string;
  verdicts?: ("subdividable" | "marginal" | "not_subdividable" | "unknown")[];
  category?: "cash_flow" | "land_only";
  minScore?: number;
  maxDaysOnMarket?: number;
  /** Minimum parsed asking price in AUD. Listings without a numeric asking price are excluded. */
  minPrice?: number;
  /** Maximum parsed asking price in AUD. Listings without a numeric asking price are excluded. */
  maxPrice?: number;
  /** Minimum advertised land area in m². Listings with unknown land area are excluded (they can't pass a size floor). */
  minLandAreaSqm?: number;
  /** Minimum lot frontage in metres. Only excludes rows with a KNOWN narrower frontage (missing data passes). */
  minFrontageM?: number;
  /** Maximum dwelling footprint coverage percent. Only excludes rows with KNOWN higher coverage (missing data passes). */
  maxCoveragePct?: number;
  /** Exclude new builds and new-estate/house-and-land listings. */
  excludeNewBuilds?: boolean;
  /** Filter to one or more state planning zone values. Rows with unknown zoning are excluded when set. */
  zones?: string[];
  /** Only return listings first seen in the last 7 days (new this week). */
  newThisWeek?: boolean;
  status?: "active" | "sold";
  search?: string;
  sort?: "score" | "newest" | "score_newest" | "price_per_lot";
  page?: number;
  pageSize?: number;
}

/** Paged catalogue browse with filters. Default: active, confirmed verdicts, score+newest. */
export async function browseCatalogue(filters: CatalogueBrowseFilters) {
  const db = await getDb();
  if (!db) return { rows: [], total: 0 };
  const conds: SQL[] = [eq(catalogueListings.status, filters.status ?? "active")];
  if (filters.state) conds.push(eq(catalogueListings.state, filters.state));
  if (filters.regionId) conds.push(eq(catalogueListings.regionId, filters.regionId));
  if (filters.verdicts && filters.verdicts.length > 0) {
    conds.push(inArray(catalogueListings.verdict, filters.verdicts));
  }
  if (filters.category) conds.push(eq(catalogueListings.category, filters.category));
  if (filters.minScore !== undefined) conds.push(gte(catalogueListings.score, filters.minScore));
  if (filters.maxDaysOnMarket !== undefined) {
    const cutoff = new Date(Date.now() - filters.maxDaysOnMarket * 24 * 3600_000);
    conds.push(gte(sql`coalesce(${catalogueListings.listedAt}, ${catalogueListings.firstSeenAt})`, cutoff));
  }
  if (filters.minPrice !== undefined && filters.minPrice > 0) {
    conds.push(sql`${catalogueListings.priceNumeric} >= ${filters.minPrice}`);
  }
  if (filters.maxPrice !== undefined && filters.maxPrice > 0) {
    conds.push(sql`${catalogueListings.priceNumeric} <= ${filters.maxPrice}`);
  }
  if (filters.minLandAreaSqm !== undefined && filters.minLandAreaSqm > 0) {
    // Strict: listings without a reported land area are excluded when a floor is set.
    conds.push(sql`${catalogueListings.landAreaSqm} >= ${filters.minLandAreaSqm}`);
  }
  if (filters.minFrontageM !== undefined && filters.minFrontageM > 0) {
    // Lenient: only rows with a KNOWN narrower frontage are excluded.
    conds.push(
      sql`(${catalogueListings.frontageM} is null or ${catalogueListings.frontageM} >= ${filters.minFrontageM})`,
    );
  }
  if (filters.maxCoveragePct !== undefined && filters.maxCoveragePct > 0) {
    // Lenient: only rows with a KNOWN higher coverage are excluded.
    conds.push(
      sql`(${catalogueListings.coveragePct} is null or ${catalogueListings.coveragePct} <= ${filters.maxCoveragePct})`,
    );
  }
  if (filters.excludeNewBuilds) {
    conds.push(eq(catalogueListings.isNewBuild, false));
  }
  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    conds.push(
      sql`(${catalogueListings.suburb} like ${term} or ${catalogueListings.postcode} like ${term} or ${catalogueListings.address} like ${term} or ${catalogueListings.lgaName} like ${term})`,
    );
  }
  if (filters.zones && filters.zones.length > 0) {
    conds.push(inArray(catalogueListings.zoneCode, filters.zones));
  }
  if (filters.newThisWeek) {
    const cutoff = new Date(Date.now() - 7 * 24 * 3600_000);
    conds.push(gte(catalogueListings.firstSeenAt, cutoff));
  }
  const where = and(...conds);
  const pageSize = Math.min(filters.pageSize ?? 24, 60);
  const page = Math.max(filters.page ?? 1, 1);

  const sort = filters.sort ?? "score_newest";
  const listedExpr = sql`coalesce(${catalogueListings.listedAt}, ${catalogueListings.firstSeenAt})`;
  const pricePerLotExpr = sql`(${catalogueListings.priceNumeric} / nullif(${catalogueListings.potentialLots}, 0))`;
  const orderBy =
    sort === "newest"
      ? [desc(listedExpr), desc(catalogueListings.score)]
      : sort === "score"
        ? [desc(catalogueListings.score), desc(listedExpr)]
        : sort === "price_per_lot"
          ? [
              // Best value: lowest $/potential lot first; rows without a
              // computable ratio (no numeric price or no lot yield) sort last.
              sql`case when ${catalogueListings.priceNumeric} is null or ${catalogueListings.potentialLots} is null or ${catalogueListings.potentialLots} < 1 then 1 else 0 end asc`,
              sql`${pricePerLotExpr} asc`,
              desc(catalogueListings.score),
            ]
          : [
              // score_newest: blend — high score first, but boost fresh listings
              desc(sql`${catalogueListings.score} + greatest(0, 15 - datediff(now(), coalesce(${catalogueListings.listedAt}, ${catalogueListings.firstSeenAt})))`),
              desc(listedExpr),
            ];

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(catalogueListings)
      .where(where)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)` }).from(catalogueListings).where(where),
  ]);
  return { rows, total: Number(totalRows[0]?.total ?? 0), page, pageSize };
}

/** Un-paged catalogue export for CSV download. Same filters as browse, hard cap. */
export async function exportCatalogue(filters: Omit<CatalogueBrowseFilters, "page" | "pageSize">, cap = 2000) {
  const { rows } = await browseCatalogue({ ...filters, page: 1, pageSize: cap });
  return rows;
}

/** Distinct zoning codes present on active catalogue rows, with counts (for the zoning filter dropdown). */
export async function listZoneCodes(state?: "NSW" | "QLD") {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ zoneCode: catalogueListings.zoneCode, count: sql<number>`count(*)` })
    .from(catalogueListings)
    .where(and(
      eq(catalogueListings.status, "active"),
      state ? eq(catalogueListings.state, state) : undefined,
      sql`${catalogueListings.zoneCode} is not null`,
    ))
    .groupBy(catalogueListings.zoneCode)
    .orderBy(desc(sql`count(*)`));
  return rows
    .filter((r): r is { zoneCode: string; count: number } => Boolean(r.zoneCode))
    .map((r) => ({ zoneCode: r.zoneCode, count: Number(r.count) }));
}

/** Build the WHERE conditions shared by browse/map/zone-mix from a filter set. */
function buildCatalogueConditions(
  filters: Omit<CatalogueBrowseFilters, "page" | "pageSize" | "sort">,
): SQL[] {
  const conds: SQL[] = [eq(catalogueListings.status, filters.status ?? "active")];
  if (filters.state) conds.push(eq(catalogueListings.state, filters.state));
  if (filters.minPrice !== undefined && filters.minPrice > 0) {
    conds.push(sql`${catalogueListings.priceNumeric} >= ${filters.minPrice}`);
  }
  if (filters.maxPrice !== undefined && filters.maxPrice > 0) {
    conds.push(sql`${catalogueListings.priceNumeric} <= ${filters.maxPrice}`);
  }
  if (filters.regionId) conds.push(eq(catalogueListings.regionId, filters.regionId));
  if (filters.verdicts && filters.verdicts.length > 0) {
    conds.push(inArray(catalogueListings.verdict, filters.verdicts));
  }
  if (filters.category) conds.push(eq(catalogueListings.category, filters.category));
  if (filters.minScore !== undefined) conds.push(gte(catalogueListings.score, filters.minScore));
  if (filters.maxDaysOnMarket !== undefined) {
    const cutoff = new Date(Date.now() - filters.maxDaysOnMarket * 24 * 3600_000);
    conds.push(gte(sql`coalesce(${catalogueListings.listedAt}, ${catalogueListings.firstSeenAt})`, cutoff));
  }
  if (filters.minLandAreaSqm !== undefined && filters.minLandAreaSqm > 0) {
    conds.push(sql`${catalogueListings.landAreaSqm} >= ${filters.minLandAreaSqm}`);
  }
  if (filters.minFrontageM !== undefined && filters.minFrontageM > 0) {
    conds.push(
      sql`(${catalogueListings.frontageM} is null or ${catalogueListings.frontageM} >= ${filters.minFrontageM})`,
    );
  }
  if (filters.maxCoveragePct !== undefined && filters.maxCoveragePct > 0) {
    conds.push(
      sql`(${catalogueListings.coveragePct} is null or ${catalogueListings.coveragePct} <= ${filters.maxCoveragePct})`,
    );
  }
  if (filters.excludeNewBuilds) {
    conds.push(eq(catalogueListings.isNewBuild, false));
  }
  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    conds.push(
      sql`(${catalogueListings.suburb} like ${term} or ${catalogueListings.postcode} like ${term} or ${catalogueListings.address} like ${term} or ${catalogueListings.lgaName} like ${term})`,
    );
  }
  if (filters.zones && filters.zones.length > 0) {
    conds.push(inArray(catalogueListings.zoneCode, filters.zones));
  }
  if (filters.newThisWeek) {
    const cutoff = new Date(Date.now() - 7 * 24 * 3600_000);
    conds.push(gte(catalogueListings.firstSeenAt, cutoff));
  }
  return conds;
}

/**
 * Zoning-mix breakdown for the current filtered view: top N zone codes with
 * counts plus the total matched rows (so the UI can show shares and an
 * "other/unknown" remainder). Ignores the zones filter dimension? No — it
 * respects ALL filters exactly as browse does, so the mix always describes
 * precisely what the user is looking at.
 */
export async function getZoneMix(
  filters: Omit<CatalogueBrowseFilters, "page" | "pageSize" | "sort">,
  top = 5,
) {
  const db = await getDb();
  if (!db) return { total: 0, zones: [] as { zoneCode: string; count: number }[] };
  const conds = buildCatalogueConditions(filters);
  const where = and(...conds);
  const [zoneRows, totalRows] = await Promise.all([
    db
      .select({ zoneCode: catalogueListings.zoneCode, count: sql<number>`count(*)` })
      .from(catalogueListings)
      .where(and(where, sql`${catalogueListings.zoneCode} is not null`))
      .groupBy(catalogueListings.zoneCode)
      .orderBy(desc(sql`count(*)`))
      .limit(Math.min(Math.max(top, 1), 10)),
    db.select({ total: sql<number>`count(*)` }).from(catalogueListings).where(where),
  ]);
  return {
    total: Number(totalRows[0]?.total ?? 0),
    zones: zoneRows
      .filter((r): r is { zoneCode: string; count: number } => Boolean(r.zoneCode))
      .map((r) => ({ zoneCode: r.zoneCode, count: Number(r.count) })),
  };
}

/**
 * Map view data: same filters as browse, but un-paged (hard cap) and limited to
 * geolocated rows with only the fields the map popup needs.
 */
export async function mapCatalogue(filters: Omit<CatalogueBrowseFilters, "page" | "pageSize" | "sort">, cap = 2500) {
  const db = await getDb();
  if (!db) return [];
  const conds: SQL[] = [
    ...buildCatalogueConditions(filters),
    sql`${catalogueListings.latitude} is not null`,
    sql`${catalogueListings.longitude} is not null`,
  ];
  return db
    .select({
      id: catalogueListings.id,
      listingId: catalogueListings.listingId,
      latitude: catalogueListings.latitude,
      longitude: catalogueListings.longitude,
      address: catalogueListings.address,
      suburb: catalogueListings.suburb,
      postcode: catalogueListings.postcode,
      verdict: catalogueListings.verdict,
      score: catalogueListings.score,
      category: catalogueListings.category,
      landAreaSqm: catalogueListings.landAreaSqm,
      zoneCode: catalogueListings.zoneCode,
      priceDisplay: catalogueListings.priceDisplay,
      priceNumeric: catalogueListings.priceNumeric,
      potentialLots: catalogueListings.potentialLots,
      listedAt: catalogueListings.listedAt,
      firstSeenAt: catalogueListings.firstSeenAt,
      listingUrl: catalogueListings.listingUrl,
    })
    .from(catalogueListings)
    .where(and(...conds))
    .orderBy(desc(catalogueListings.score))
    .limit(Math.min(cap, 2500));
}

/* ------------------------------------------------------------------ */
/* Saved searches (email alerts)                                       */
/* ------------------------------------------------------------------ */

export async function listSavedSearches(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userId, userId))
    .orderBy(desc(savedSearches.createdAt));
}

export async function createSavedSearch(userId: number, name: string, filters: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db
    .select({ n: sql<number>`count(*)` })
    .from(savedSearches)
    .where(eq(savedSearches.userId, userId));
  if (Number(existing[0]?.n ?? 0) >= 10) {
    throw new Error("Saved search limit reached (10). Delete one to add another.");
  }
  await db.insert(savedSearches).values({ userId, name, filters });
}

export async function deleteSavedSearch(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(savedSearches)
    .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)));
}

/** All saved searches across users, joined with owner email — for nightly alert dispatch. */
export async function listAllSavedSearchesWithOwners() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: savedSearches.id,
      userId: savedSearches.userId,
      name: savedSearches.name,
      filters: savedSearches.filters,
      lastNotifiedAt: savedSearches.lastNotifiedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(savedSearches)
    .innerJoin(users, eq(users.id, savedSearches.userId));
}

export async function touchSavedSearchNotified(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(savedSearches).set({ lastNotifiedAt: new Date() }).where(eq(savedSearches.id, id));
}

/** Record the latest nightly match results on a saved search (in-app alerts). */
export async function recordSavedSearchMatches(id: number, count: number, matchesJson: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(savedSearches)
    .set({ lastNotifiedAt: new Date(), lastMatchCount: count, lastMatchesJson: matchesJson })
    .where(eq(savedSearches.id, id));
}

/** New ACTIVE listings first seen after `since` that match a saved-search filter set. */
export async function findNewMatchesForFilters(filters: CatalogueBrowseFilters, since: Date, cap = 20) {
  const db = await getDb();
  if (!db) return [];
  const normalizedFilters = withSubdivisionDefaultMinLand(filters);
  const { rows } = await browseCatalogue({ ...normalizedFilters, status: "active", page: 1, pageSize: cap * 3 });
  return rows.filter((r) => r.firstSeenAt && r.firstSeenAt > since).slice(0, cap);
}

/** Aggregate catalogue stats for landing page + catalogue header. */
export async function getCatalogueStats() {
  const db = await getDb();
  if (!db) return { active: 0, subdividable: 0, marginal: 0, sold: 0, lastScanAt: null as Date | null };
  const [agg, lastRun] = await Promise.all([
    db
      .select({
        active: sql<number>`sum(case when ${catalogueListings.status} = 'active' then 1 else 0 end)`,
        subdividable: sql<number>`sum(case when ${catalogueListings.status} = 'active' and ${catalogueListings.verdict} = 'subdividable' then 1 else 0 end)`,
        marginal: sql<number>`sum(case when ${catalogueListings.status} = 'active' and ${catalogueListings.verdict} = 'marginal' then 1 else 0 end)`,
        sold: sql<number>`sum(case when ${catalogueListings.status} = 'sold' then 1 else 0 end)`,
      })
      .from(catalogueListings),
    db
      .select({ finishedAt: scanRuns.finishedAt })
      .from(scanRuns)
      .where(eq(scanRuns.status, "completed"))
      .orderBy(desc(scanRuns.finishedAt))
      .limit(1),
  ]);
  return {
    active: Number(agg[0]?.active ?? 0),
    subdividable: Number(agg[0]?.subdividable ?? 0),
    marginal: Number(agg[0]?.marginal ?? 0),
    sold: Number(agg[0]?.sold ?? 0),
    lastScanAt: lastRun[0]?.finishedAt ?? null,
  };
}

/** Freshest high-scoring confirmed finds for the homepage ticker. */
export async function getLatestFinds(limit = 8) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      listingId: catalogueListings.listingId,
      suburb: catalogueListings.suburb,
      postcode: catalogueListings.postcode,
      propertyType: catalogueListings.propertyType,
      priceDisplay: catalogueListings.priceDisplay,
      landAreaSqm: catalogueListings.landAreaSqm,
      potentialLots: catalogueListings.potentialLots,
      verdict: catalogueListings.verdict,
      score: catalogueListings.score,
      listedAt: catalogueListings.listedAt,
      firstSeenAt: catalogueListings.firstSeenAt,
    })
    .from(catalogueListings)
    .where(and(eq(catalogueListings.status, "active"), inArray(catalogueListings.verdict, ["subdividable", "marginal"])))
    .orderBy(desc(sql`coalesce(${catalogueListings.listedAt}, ${catalogueListings.firstSeenAt})`), desc(catalogueListings.score))
    .limit(limit);
}

/* ------------------------------------------------------------------ */
/* Scan runs                                                           */
/* ------------------------------------------------------------------ */

export async function createScanRun(mode: "full_sweep" | "incremental") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(scanRuns).values({ mode, status: "running" });
  // mysql2 returns insertId on the result header
  const insertId = (result as unknown as [{ insertId: number }])[0]?.insertId;
  return Number(insertId);
}

export async function updateScanRun(
  id: number,
  patch: Partial<{
    status: "running" | "completed" | "failed";
    cursor: unknown;
    listingsSeen: number;
    listingsAnalysed: number;
    listingsAdded: number;
    listingsMarkedSold: number;
    error: string | null;
    finishedAt: Date | null;
  }>,
) {
  const db = await getDb();
  if (!db) return;
  await db.update(scanRuns).set(patch).where(eq(scanRuns.id, id));
}

export async function getLatestScanRun() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(scanRuns).orderBy(desc(scanRuns.id)).limit(1);
  return rows[0] ?? null;
}

/** The most recent RUNNING scan run, if any (resume support). */
export async function getRunningScanRun() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(scanRuns)
    .where(eq(scanRuns.status, "running"))
    .orderBy(desc(scanRuns.id))
    .limit(1);
  return rows[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Investment tag helpers                                              */
/* ------------------------------------------------------------------ */

/**
 * Count of active listings per investment tag.
 * Returns an object keyed by tag name.
 */
export async function getTagCounts(): Promise<Record<string, number>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db
    .select({ tags: catalogueListings.investmentTags })
    .from(catalogueListings)
    .where(
      and(
        eq(catalogueListings.status, "active"),
        sql`${catalogueListings.investmentTags} != ''`,
      ),
    );
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (!row.tags) continue;
    for (const tag of row.tags.split("|").filter(Boolean)) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Browse catalogue listings filtered by a single investment tag.
 * Sorted by newest first by default.
 */
export interface BrowseByTagFilters {
  tag: string;
  page?: number;
  pageSize?: number;
  sort?: "newest" | "score" | "price_asc" | "price_desc";
  minPrice?: number;
  maxPrice?: number;
  minLandAreaSqm?: number;
}

export async function browseByTag(filters: BrowseByTagFilters) {
  const db = await getDb();
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(filters.pageSize ?? 24, 60);
  const sort = filters.sort ?? "newest";
  if (!db) return { rows: [], total: 0, page, pageSize };
  const tagCond = sql`FIND_IN_SET(${filters.tag}, REPLACE(${catalogueListings.investmentTags}, '|', ',')) > 0`;
  const conds: SQL[] = [eq(catalogueListings.status, "active"), tagCond];
  if (filters.minPrice !== undefined && filters.minPrice > 0) {
    conds.push(sql`${catalogueListings.priceNumeric} >= ${filters.minPrice}`);
  }
  if (filters.maxPrice !== undefined && filters.maxPrice > 0) {
    conds.push(sql`${catalogueListings.priceNumeric} <= ${filters.maxPrice}`);
  }
  if (filters.minLandAreaSqm !== undefined && filters.minLandAreaSqm > 0) {
    conds.push(sql`${catalogueListings.landAreaSqm} >= ${filters.minLandAreaSqm}`);
  }
  const where = and(...conds);
  const listedExpr = sql`coalesce(${catalogueListings.listedAt}, ${catalogueListings.firstSeenAt})`;
  const orderBy =
    sort === "score"
      ? [desc(catalogueListings.score), desc(listedExpr)]
      : sort === "price_asc"
        ? [sql`${catalogueListings.priceNumeric} is null asc`, sql`${catalogueListings.priceNumeric} asc`]
        : sort === "price_desc"
          ? [sql`${catalogueListings.priceNumeric} is null asc`, desc(catalogueListings.priceNumeric)]
          : [desc(listedExpr)];
  const [rows, totalRows] = await Promise.all([
    db.select().from(catalogueListings).where(where).orderBy(...orderBy).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)` }).from(catalogueListings).where(where),
  ]);
  return { rows, total: Number(totalRows[0]?.total ?? 0), page, pageSize };
}

/**
 * Update investmentTags for a single listing (used by the sweep engine
 * to tag new listings as they are upserted).
 */
export async function updateListingTags(listingId: string, tags: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(catalogueListings)
    .set({ investmentTags: tags })
    .where(eq(catalogueListings.listingId, listingId));
}
