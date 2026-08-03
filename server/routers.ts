import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  archiveProperty,
  browseCatalogue,
  createSavedSearch,
  deleteSavedSearch,
  exportCatalogue,
  listZoneCodes,
  getZoneMix,
  getCatalogueStats,
  getLatestFinds,
  mapCatalogue,
  getLatestScanRun,
  getUsageStats,
  listRecentSearches,
  listSavedProperties,
  listSavedSearches,
  recordSearch,
  saveProperty,
  updatePropertyNotes,
} from "./db";
import { getTagCounts, browseByTag } from "./db";
import { runSweepSlice } from "./services/sweep";
import { getMinimumLotSize, getZoning } from "./services/nswPlanning";
import { getDb } from "./db";
import { catalogueListings } from "../drizzle/schema";
import { eq, and, desc, sql, SQL } from "drizzle-orm";
import {
  autocompleteLocation,
  categoriseListing,
  getListingDetail,
  parseFrontageM,
  parseLandAreaSqm,
  searchListings,
  searchListingsMulti,
  VIABLE_PROPERTY_TYPES,
} from "./services/realtyApi";
import { assessRisks, verificationLinks } from "./services/riskLayers";
import { analyseSubdivisionPotential, scoreSubdivisionPotential } from "./services/subdivision";
import { findSubdivisionComparables, lgaToCouncilName } from "./services/daComparables";
import { ALL_REGIONS, getRegionById, stateWideLocations } from "../shared/regions";
import { withSubdivisionDefaultMinLand } from "../shared/subdivisionDefaults";
import { getAnalystRunHistory, getCurrentAgentPicks } from "./services/aiAnalystRead";
import { runAiInvestmentAnalyst } from "./services/aiAnalystRun";

// NOTE: All research + watchlist features are intentionally PUBLIC (no login)
// so the published site can be shared freely. Anonymous activity is stored
// under the shared id SHARED_USER_ID — the watchlist is a single shared list.
const SHARED_USER_ID = 0;

const catalogueFilterShape = {
  state: z.enum(["NSW", "QLD"]).optional(),
  regionId: z.string().max(64).optional(),
  verdicts: z
    .array(z.enum(["subdividable", "marginal", "not_subdividable", "unknown"]))
    .max(4)
    .optional(),
  category: z.enum(["cash_flow", "land_only"]).optional(),
  minScore: z.number().int().min(0).max(100).optional(),
  maxDaysOnMarket: z.number().int().min(1).max(365).optional(),
  minPrice: z.number().int().min(0).max(1_000_000_000).optional(),
  maxPrice: z.number().int().min(0).max(1_000_000_000).optional(),
  minLandAreaSqm: z.number().int().min(0).max(2_023_500).optional(),
  minFrontageM: z.number().min(0).max(200).optional(),
  maxCoveragePct: z.number().min(1).max(100).optional(),
  excludeNewBuilds: z.boolean().optional(),
  zones: z.array(z.string().max(100)).max(40).optional(),
  status: z.enum(["active", "sold"]).optional(),
  search: z.string().max(120).optional(),
  newThisWeek: z.boolean().optional(),
};

const catalogueBrowseInput = z.object({
  ...catalogueFilterShape,
  sort: z.enum(["score", "newest", "score_newest", "price_per_lot"]).optional(),
  page: z.number().int().min(1).max(500).optional(),
  pageSize: z.number().int().min(6).max(60).optional(),
});

const catalogueExportInput = z.object({
  ...catalogueFilterShape,
  sort: z.enum(["score", "newest", "score_newest", "price_per_lot"]).optional(),
});

const catalogueMapInput = z.object(catalogueFilterShape);

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  property: router({
    /** Suburb/location autocomplete passthrough. */
    /** Location autocomplete passthrough — admin only (burns RealtyAPI credits). */
    autocomplete: adminProcedure
      .input(z.object({ keyword: z.string().min(2).max(100) }))
      .query(({ input }) => autocompleteLocation(input.keyword)),

    /** Search NSW listings for sale by location. */
    /** Search NSW listings for sale by location — admin only (burns RealtyAPI credits). */
    search: adminProcedure
      .input(
        z.object({
          location: z.string().min(2).max(200),
          scope: z.enum(["suburb", "region", "state"]).optional(),
          regionId: z.string().max(64).optional(),
          state: z.enum(["NSW", "QLD"]).optional(),
          page: z.number().int().min(1).max(50).optional(),
          priceMin: z.number().int().nonnegative().optional(),
          priceMax: z.number().int().nonnegative().optional(),
          propertyTypes: z.string().max(200).optional(),
          landSizeMin: z.number().int().nonnegative().optional(),
          category: z.enum(["cash_flow", "land_only", "all"]).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const scope = input.scope ?? "suburb";
        let res;
        let scopeLabel = input.location;

        // Viability-first: exclude apartments/units/townhouses at the source
        // unless the caller explicitly overrides property types.
        const propertyTypes = input.propertyTypes ?? VIABLE_PROPERTY_TYPES;
        const searchInput = { ...input, propertyTypes };
        if (scope === "state") {
          res = await searchListingsMulti({
            ...searchInput,
            locations: stateWideLocations(input.state ?? "NSW"),
          });
          scopeLabel = `${input.state ?? "NSW"} (state-wide)`;
        } else if (scope === "region" && input.regionId) {
          const region = getRegionById(input.regionId);
          if (!region) throw new Error(`Unknown region: ${input.regionId}`);
          if (input.state && region.state !== input.state) {
            throw new Error(`Region ${input.regionId} does not belong to ${input.state}`);
          }
          res = await searchListingsMulti({ ...searchInput, locations: region.locations });
          scopeLabel = region.label;
        } else {
          const single = await searchListings(searchInput);
          res = { ...single, perLocation: undefined };
        }

        // Categorise every listing; filter when a category is requested
        let searchResults = res.searchResults.map((listing) => ({
          ...listing,
          category: categoriseListing(listing),
        }));
        if (input.category && input.category !== "all") {
          searchResults = searchResults.filter((l) => l.category === input.category);
        }

        if ((input.page ?? 1) === 1) {
          void recordSearch(ctx.user?.id ?? SHARED_USER_ID, scopeLabel, input, res.total);
        }
        return { ...res, searchResults, scopeLabel };
      }),

    /** Available state-tagged region scopes for the search UI. */
    regions: publicProcedure.query(() =>
      ALL_REGIONS.filter((r) => r.enabled !== false).map((r) => ({
        id: r.id,
        label: r.label,
        state: r.state,
        locationCount: r.locations.length,
      })),
    ),

    /**
     * Bulk quick analysis for search result cards. For each listing with
     * coordinates, queries the Minimum Lot Size layer and (when the listing
     * detail provides land area) computes an indicative verdict. Limited to
     * 24 listings per call to keep latency and upstream load reasonable.
     */
    /** Bulk planning-layer analysis — admin only (burns NSW Planning API credits). */
    quickAnalyse: adminProcedure
      .input(
        z.object({
          listings: z
            .array(
              z.object({
                id: z.number(),
                latitude: z.number().optional(),
                longitude: z.number().optional(),
              }),
            )
            .max(24),
        }),
      )
      .mutation(async ({ input }) => {
        const results = await Promise.all(
          input.listings.map(async listing => {
            if (listing.latitude === undefined || listing.longitude === undefined) {
              return { id: listing.id, verdict: "unknown" as const, minLotSizeLabel: null, zoneCode: null, score: 0 };
            }
            try {
              const [detail, mls, zoning] = await Promise.all([
                getListingDetail(listing.id).catch(() => null),
                getMinimumLotSize(listing.latitude, listing.longitude).catch(() => null),
                getZoning(listing.latitude, listing.longitude).catch(() => null),
              ]);
              const landAreaSqm = parseLandAreaSqm(detail?.landArea);
              const analysis = analyseSubdivisionPotential({
                landAreaSqm,
                minLotSizeSqm: mls?.lotSizeSqm ?? null,
                zoneCode: zoning?.zoneCode ?? null,
              });
              const score = scoreSubdivisionPotential({
                analysis,
                hasLandArea: landAreaSqm !== null,
                hasMls: mls?.lotSizeSqm != null,
                category: detail ? categoriseListing(detail) : "unknown",
              });
              return {
                id: listing.id,
                verdict: analysis.verdict,
                potentialLots: analysis.potentialLots,
                landAreaSqm,
                minLotSizeLabel: mls?.label ?? null,
                zoneCode: zoning?.zoneCode ?? null,
                score,
              };
            } catch {
              return { id: listing.id, verdict: "unknown" as const, minLotSizeLabel: null, zoneCode: null, score: 0 };
            }
          }),
        );
        return results;
      }),

    /**
     * Nearby subdivision comparables: recent subdivision DAs in the same
     * council area from the NSW Online DA feed, sorted by distance.
     */
    /** DA comparables fetch — admin only (burns NSW Online DA API credits). */
    comparables: adminProcedure
      .input(
        z.object({
          lgaName: z.string().min(2).max(120),
          latitude: z.number().optional(),
          longitude: z.number().optional(),
        }),
      )
      .mutation(({ input }) =>
        findSubdivisionComparables({
          councilName: lgaToCouncilName(input.lgaName),
          latitude: input.latitude,
          longitude: input.longitude,
          limit: 10,
        }),
      ),

    /**
     * Full ranked scan: run the search across the scope, analyse EVERY result
     * server-side (concurrency-limited), and return listings sorted by
     * subdivision score. Caps analysis at 60 listings per call.
     */
    /** Full ranked scan — admin only (burns RealtyAPI + NSW Planning API credits). */
    rankedScan: adminProcedure
      .input(
        z.object({
          location: z.string().min(2).max(200),
          scope: z.enum(["suburb", "region", "state"]).optional(),
          regionId: z.string().max(64).optional(),
          priceMin: z.number().int().nonnegative().optional(),
          priceMax: z.number().int().nonnegative().optional(),
          landSizeMin: z.number().int().nonnegative().optional(),
          category: z.enum(["cash_flow", "land_only", "all"]).optional(),
          /** Only return subdividable/marginal/unknown listings (default true). */
          viableOnly: z.boolean().optional(),
          /** Include unverified (unknown-verdict) listings in output (default false). */
          includeUnverified: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const scope = input.scope ?? "suburb";
        let res;
        let scopeLabel = input.location;
        const propertyTypes = VIABLE_PROPERTY_TYPES;
        // Land floor: Domain's landSizeMin param is ignored upstream (verified),
        // so we enforce it post-analysis. Default 700 m² keeps small suburban
        // blocks out of scan results.
        const landFloorSqm = input.landSizeMin ?? 700;
        if (scope === "state") {
          res = await searchListingsMulti({ ...input, propertyTypes, locations: stateWideLocations() });
          scopeLabel = "NSW (state-wide)";
        } else if (scope === "region" && input.regionId) {
          const region = getRegionById(input.regionId);
          if (!region) throw new Error(`Unknown region: ${input.regionId}`);
          res = await searchListingsMulti({ ...input, propertyTypes, locations: region.locations });
          scopeLabel = region.label;
        } else {
          res = await searchListings({ ...input, propertyTypes });
        }

        let listings = res.searchResults.map((l) => ({ ...l, category: categoriseListing(l) }));
        if (input.category && input.category !== "all") {
          listings = listings.filter((l) => l.category === input.category);
        }
        // Prioritise candidates most likely to be genuinely subdividable before
        // capping: vacant land / rural / acreage first, then houses. Within each
        // band keep the interleaved (state-fair) order.
        const typeRank = (l: (typeof listings)[number]) => {
          const t = (l.propertyType ?? "").toLowerCase();
          if (t.includes("land")) return 0;
          if (t.includes("rural") || t.includes("acreage") || t.includes("farm")) return 0;
          return 1;
        };
        const prioritised = listings
          .map((l, i) => ({ l, i }))
          .sort((a, b) => typeRank(a.l) - typeRank(b.l) || a.i - b.i)
          .map((x) => x.l);
        const capped = prioritised.slice(0, 120);

        // Concurrency-limited analysis (8 at a time) across the full capped set
        const analysed: {
          listing: (typeof capped)[number];
          verdict: string;
          potentialLots: number | null;
          landAreaSqm: number | null;
          minLotSizeLabel: string | null;
          zoneCode: string | null;
          score: number;
        }[] = [];
        const queue = [...capped];
        const workers = Array.from({ length: 8 }, async () => {
          for (;;) {
            const listing = queue.shift();
            if (!listing) return;
            const lat = listing.geoLocation?.latitude;
            const lng = listing.geoLocation?.longitude;
            if (lat === undefined || lng === undefined) {
              analysed.push({ listing, verdict: "unknown", potentialLots: null, landAreaSqm: null, minLotSizeLabel: null, zoneCode: null, score: 0 });
              continue;
            }
            try {
              const [detail, mls, zoning] = await Promise.all([
                getListingDetail(listing.id).catch(() => null),
                getMinimumLotSize(lat, lng).catch(() => null),
                getZoning(lat, lng).catch(() => null),
              ]);
              const landAreaSqm = parseLandAreaSqm(detail?.landArea);
              const analysis = analyseSubdivisionPotential({
                landAreaSqm,
                minLotSizeSqm: mls?.lotSizeSqm ?? null,
                zoneCode: zoning?.zoneCode ?? null,
              });
              analysed.push({
                listing,
                verdict: analysis.verdict,
                potentialLots: analysis.potentialLots,
                landAreaSqm,
                minLotSizeLabel: mls?.label ?? null,
                zoneCode: zoning?.zoneCode ?? null,
                score: scoreSubdivisionPotential({
                  analysis,
                  hasLandArea: landAreaSqm !== null,
                  hasMls: mls?.lotSizeSqm != null,
                  category: listing.category,
                }),
              });
            } catch {
              analysed.push({ listing, verdict: "unknown", potentialLots: null, landAreaSqm: null, minLotSizeLabel: null, zoneCode: null, score: 0 });
            }
          }
        });
        await Promise.all(workers);

        // Confirmed-only filter (user feedback: unknowns polluted results).
        // Default output = confirmed subdividable + marginal verdicts with the
        // land floor met. Unknown-verdict listings are excluded unless
        // explicitly requested via includeUnverified.
        const viableOnly = input.viableOnly ?? true;
        let kept = analysed;
        if (viableOnly) {
          const confirmed = new Set(["subdividable", "marginal"]);
          kept = kept.filter((a) => {
            if (confirmed.has(a.verdict)) {
              return a.landAreaSqm === null || a.landAreaSqm >= landFloorSqm;
            }
            return (
              (input.includeUnverified ?? false) &&
              a.verdict === "unknown" &&
              (a.landAreaSqm === null || a.landAreaSqm >= landFloorSqm)
            );
          });
        } else {
          kept = kept.filter((a) => a.landAreaSqm === null || a.landAreaSqm >= landFloorSqm);
        }
        kept.sort((a, b) => b.score - a.score);
        void recordSearch(ctx.user?.id ?? SHARED_USER_ID, `${scopeLabel} (ranked scan)`, input, res.total);
        return {
          scopeLabel,
          total: res.total,
          analysedCount: analysed.length,
          keptCount: kept.length,
          landFloorSqm,
          results: kept.map((a) => ({
            ...a.listing,
            verdict: a.verdict,
            potentialLots: a.potentialLots,
            landAreaSqm: a.landAreaSqm,
            minLotSizeLabel: a.minLotSizeLabel,
            zoneCode: a.zoneCode,
            score: a.score,
          })),
        };
      }),

    /**
     * Full analysis for one listing: fetch detail, query NSW planning layers
     * at the property's coordinates, compute subdivision potential.
     */
    /** Single-listing full analysis — admin only (burns RealtyAPI + NSW Planning API credits). */
    analyse: adminProcedure
      .input(z.object({ listingId: z.union([z.string(), z.number()]) }))
      .mutation(async ({ input }) => {
        const detail = await getListingDetail(input.listingId);
        const lat = detail.geoLocation?.latitude;
        const lng = detail.geoLocation?.longitude;

        const [mls, zoning, risks] = lat !== undefined && lng !== undefined
          ? await Promise.all([
              getMinimumLotSize(lat, lng).catch(() => null),
              getZoning(lat, lng).catch(() => null),
              assessRisks(lng, lat).catch(() => null),
            ])
          : [null, null, null];

        const landAreaSqm = parseLandAreaSqm(detail.landArea);
        const frontageM = parseFrontageM(detail.description) ?? parseFrontageM(detail.headline);
        const analysis = analyseSubdivisionPotential({
          landAreaSqm,
          minLotSizeSqm: mls?.lotSizeSqm ?? null,
          zoneCode: zoning?.zoneCode ?? null,
          frontageM,
          bushfireStatus: risks?.bushfire.status ?? "unknown",
          floodStatus: risks?.flood.status ?? "unknown",
        });

        const category = categoriseListing(detail);
        const links = lat !== undefined && lng !== undefined
          ? verificationLinks(lng, lat, detail.address?.full ?? "")
          : null;

        // Extract the three new planning fields for storage
        const acidSulfateClass = risks?.acidSulfate?.status === "flagged"
          ? risks.acidSulfate.detail?.split(" — ")[1]?.trim() ?? null
          : null;
        const fsrValue = risks?.fsr?.value ?? null;
        const maxBuildingHeightM = risks?.buildingHeight?.value ?? null;
        // Extract the 4 new risk flag fields for storage
        const bushfireCategory = risks?.bushfire?.status === "flagged"
          ? risks.bushfire.items.join(", ") || null
          : null;
        const floodRisk = risks?.flood?.status === "flagged" ? "flagged" : null;
        const heritageFlag = risks?.heritage?.status === "flagged"
          ? (risks.heritage.items[0] ?? "flagged").substring(0, 120)
          : null;
        const biodiversityFlag = risks?.biodiversity?.status === "flagged" ? "flagged" : null;

        // Store the new fields back to the database
        if (lat !== undefined && lng !== undefined && detail.id) {
          const db = await getDb();
          if (db) {
            await db
              .update(catalogueListings)
              .set({
                acidSulfateClass: acidSulfateClass ? String(acidSulfateClass) : null,
                fsrValue: fsrValue ? String(fsrValue) : null,
                maxBuildingHeightM: maxBuildingHeightM ? String(maxBuildingHeightM) : null,
                bushfireCategory,
                bushfireStatus: risks?.bushfire.status ?? "unknown",
                floodRisk,
                floodStatus: risks?.flood.status ?? "unknown",
                heritageFlag,
                biodiversityFlag,
              })
              .where(eq(catalogueListings.id, Number(detail.id)))
              .catch(() => null); // Silently fail if not in catalogue
          }
        }

        return { detail, landAreaSqm, mls, zoning, analysis, risks, category, links };
      }),

    /** Planning check for an arbitrary point (manual address research). */
    /** Planning check at coordinates — admin only (burns NSW Planning API credits). */
    planningAtPoint: adminProcedure
      .input(z.object({ latitude: z.number(), longitude: z.number() }))
      .query(async ({ input }) => {
        const [mls, zoning] = await Promise.all([
          getMinimumLotSize(input.latitude, input.longitude),
          getZoning(input.latitude, input.longitude),
        ]);
        return { mls, zoning };
      }),

    /** Save an analysed property to the shared watchlist (public, no login). */
    save: publicProcedure
      .input(
        z.object({
          listingId: z.string().max(64).optional(),
          address: z.string().min(1),
          suburb: z.string().max(120).optional(),
          postcode: z.string().max(8).optional(),
          latitude: z.number().optional(),
          longitude: z.number().optional(),
          priceDisplay: z.string().max(120).optional(),
          landAreaSqm: z.number().optional(),
          minLotSizeSqm: z.number().optional(),
          minLotSizeLabel: z.string().max(64).optional(),
          epiName: z.string().optional(),
          lgaName: z.string().max(120).optional(),
          zoneCode: z.string().max(16).optional(),
          zoneDescription: z.string().optional(),
          potentialLots: z.number().int().optional(),
          verdict: z.enum(["subdividable", "marginal", "not_subdividable", "unknown"]),
          listingUrl: z.string().optional(),
          imageUrl: z.string().optional(),
          notes: z.string().optional(),
          rawData: z.unknown().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await saveProperty({
          userId: ctx.user?.id ?? SHARED_USER_ID,
          listingId: input.listingId,
          address: input.address,
          suburb: input.suburb,
          postcode: input.postcode,
          latitude: input.latitude?.toString(),
          longitude: input.longitude?.toString(),
          priceDisplay: input.priceDisplay,
          landAreaSqm: input.landAreaSqm?.toString(),
          minLotSizeSqm: input.minLotSizeSqm?.toString(),
          minLotSizeLabel: input.minLotSizeLabel,
          epiName: input.epiName,
          lgaName: input.lgaName,
          zoneCode: input.zoneCode,
          zoneDescription: input.zoneDescription,
          potentialLots: input.potentialLots,
          verdict: input.verdict,
          listingUrl: input.listingUrl,
          imageUrl: input.imageUrl,
          notes: input.notes,
          rawData: input.rawData,
        });
        return { success: true } as const;
      }),

    /** List the shared watchlist (all saved properties, any user). */
    listSaved: publicProcedure.query(() => listSavedProperties()),

    /** Update notes on a saved property. */
    updateNotes: publicProcedure
      .input(z.object({ id: z.number().int(), notes: z.string().max(5000) }))
      .mutation(async ({ input }) => {
        await updatePropertyNotes(input.id, input.notes);
        return { success: true } as const;
      }),

    /** Remove a property from the watchlist (soft delete). */
    remove: publicProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        await archiveProperty(input.id);
        return { success: true } as const;
      }),

    /** Recent search history for quick re-runs (shared across visitors). */
    recentSearches: publicProcedure.query(() => listRecentSearches()),

    /** Aggregate usage stats for the landing page (public). */
    stats: publicProcedure.query(() => getUsageStats()),
  }),

  catalogue: router({
    /**
     * Browse the comprehensive catalogue of analysed NSW and QLD listings.
     * Defaults: active listings, confirmed verdicts, blended score+recency sort.
     */
    browse: publicProcedure
      .input(catalogueBrowseInput)
      .query(({ input }) =>
        browseCatalogue({
          ...input,
          verdicts: input.verdicts ?? ["subdividable", "marginal"],
        }),
      ),

    /**
     * Un-paged export of the current filtered view for CSV download
     * (client builds the CSV file). Capped at 2,000 rows.
     */
    /** CSV export — admin only (reserved for admin; returns up to 2,000 rows). */
    export: adminProcedure
      .input(catalogueExportInput)
      .query(({ input }) =>
        exportCatalogue({
          ...input,
          verdicts: input.verdicts ?? ["subdividable", "marginal"],
        }),
      ),

    /**
     * Map view data: geolocated rows matching the current filters
     * (un-paged, capped at 2,500 — highest scores kept when over cap).
     */
    map: publicProcedure
      .input(catalogueMapInput)
      .query(({ input }) =>
        mapCatalogue({
          ...input,
          verdicts: input.verdicts ?? ["subdividable", "marginal"],
        }),
      ),

    /** Catalogue aggregate stats (active counts, verdict split, last scan). */
    stats: publicProcedure.query(() => getCatalogueStats()),

    /** Distinct zoning codes present in the active catalogue, with counts (for the zoning filter). */
    zoneCodes: publicProcedure
      .input(z.object({ state: z.enum(["NSW", "QLD"]).optional() }).optional())
      .query(({ input }) => listZoneCodes(input?.state)),

    /**
     * Zoning-mix breakdown of the current filtered view: top 5 zone codes with
     * counts + total matched rows (powers the stats-strip zoning chips).
     */
    zoneMix: publicProcedure
      .input(catalogueMapInput)
      .query(({ input }) =>
        getZoneMix({
          ...input,
          verdicts: input.verdicts ?? ["subdividable", "marginal"],
        }),
      ),

    /** Freshest high-scoring finds for the homepage ticker. */
    latestFinds: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(12).optional() }).optional())
      .query(({ input }) => getLatestFinds(input?.limit ?? 8)),

    /** Latest scan run info (public read — powers "last updated" display). */
    scanStatus: publicProcedure.query(() => getLatestScanRun()),

    /**
     * Manually run one sweep slice (admin only). Used for the initial full
     * sweep and for testing the nightly job. Call repeatedly until done=true.
     */
    /** Manually run one sweep slice — admin only. */
    runScan: adminProcedure
      .input(z.object({ mode: z.enum(["full_sweep", "incremental"]) }))
      .mutation(({ input }) => runSweepSlice({ mode: input.mode, budgetMs: 85_000 })),
    /** Per-tag counts for the homepage niche cards. */
    tagCounts: publicProcedure.query(() => getTagCounts()),

    /** Fetch a single catalogue listing by its numeric DB id (for the property detail page). */
    getById: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const rows = await db
          .select()
          .from(catalogueListings)
          .where(eq(catalogueListings.id, input.id))
          .limit(1);
        if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
        return rows[0];
      }),

    /** Comparable active listings in the same suburb (for property detail page). */
    getComparables: publicProcedure
      .input(
        z.object({
          suburb: z.string().max(100),
          postcode: z.string().max(10).optional(),
          propertyType: z.string().max(50).optional(),
          bedrooms: z.number().int().min(0).max(20).optional(),
          excludeId: z.number().int().positive().optional(),
        }),
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conds: SQL[] = [
          eq(catalogueListings.status, "active"),
          eq(catalogueListings.suburb, input.suburb),
        ];
        if (input.excludeId) conds.push(sql`${catalogueListings.id} != ${input.excludeId}`);
        // Prefer same property type if available
        const rows = await db
          .select({
            id: catalogueListings.id,
            listingId: catalogueListings.listingId,
            address: catalogueListings.address,
            suburb: catalogueListings.suburb,
            priceDisplay: catalogueListings.priceDisplay,
            priceNumeric: catalogueListings.priceNumeric,
            bedrooms: catalogueListings.bedrooms,
            bathrooms: catalogueListings.bathrooms,
            landAreaSqm: catalogueListings.landAreaSqm,
            propertyType: catalogueListings.propertyType,
            imageUrl: catalogueListings.imageUrl,
            listingUrl: catalogueListings.listingUrl,
            listedAt: catalogueListings.listedAt,
            firstSeenAt: catalogueListings.firstSeenAt,
            score: catalogueListings.score,
            verdict: catalogueListings.verdict,
          })
          .from(catalogueListings)
          .where(and(...conds))
          .orderBy(desc(catalogueListings.listedAt), desc(catalogueListings.score))
          .limit(6);
        return rows;
      }),

    /** Suburb-level stats calculated from active catalogue listings (median, avg, low, high price). */
    getSuburbStats: publicProcedure
      .input(z.object({ suburb: z.string().max(100), postcode: z.string().max(10).optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const conds: SQL[] = [
          eq(catalogueListings.status, "active"),
          eq(catalogueListings.suburb, input.suburb),
          sql`${catalogueListings.priceNumeric} IS NOT NULL`,
        ];
        if (input.postcode) conds.push(eq(catalogueListings.postcode, input.postcode));
        const rows = await db
          .select({ priceNumeric: catalogueListings.priceNumeric })
          .from(catalogueListings)
          .where(and(...conds))
          .orderBy(catalogueListings.priceNumeric);
        if (rows.length === 0) return null;
        const prices = rows.map(r => Number(r.priceNumeric)).filter(p => p > 0).sort((a, b) => a - b);
        if (prices.length === 0) return null;
        const mid = Math.floor(prices.length / 2);
        const median = prices.length % 2 === 0
          ? Math.round((prices[mid - 1] + prices[mid]) / 2)
          : prices[mid];
        const avg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
        return { median, avg, low: prices[0], high: prices[prices.length - 1], count: prices.length };
      }),

    /** Browse listings by a single investment tag (deceased_estate, dual_income, distressed, dev_site, pos_geared). */
    browseByTag: publicProcedure
      .input(
        z.object({
          tag: z.enum(["deceased_estate", "dual_income", "distressed", "dev_site", "pos_geared"]),
          page: z.number().int().min(1).optional(),
          pageSize: z.number().int().min(1).max(60).optional(),
          sort: z.enum(["newest", "score", "price_asc", "price_desc"]).optional(),
          minPrice: z.number().int().min(0).max(1_000_000_000).optional(),
          maxPrice: z.number().int().min(0).max(1_000_000_000).optional(),
          minLandAreaSqm: z.number().int().min(0).max(2_023_500).optional(),
        }),
      )
      .query(({ input }) =>
        browseByTag({
          ...input,
          page: input.page ?? 1,
          pageSize: input.pageSize ?? 24,
          sort: input.sort ?? "newest",
        }),
      ),
  }),

  aiAnalyst: router({
    /** Current recommendations from the latest completed run only. */
    currentPicks: publicProcedure.query(() => getCurrentAgentPicks()),

    /** Recent run audit and status. Model prompts and credentials are never returned. */
    runHistory: adminProcedure
      .input(
        z.object({ limit: z.number().int().min(1).max(30).optional() }).optional(),
      )
      .query(({ input }) => getAnalystRunHistory(input?.limit ?? 12)),

    /** Manual analysis trigger. Server-side admin enforcement protects LLM spend. */
    runNow: adminProcedure.mutation(({ ctx }) =>
      runAiInvestmentAnalyst({
        trigger: "admin",
        requestedByUserId: ctx.user.id,
      }),
    ),
  }),

  savedSearch: router({
    /** The signed-in user's saved searches. */
    list: protectedProcedure.query(({ ctx }) => listSavedSearches(ctx.user.id)),

    /** Save the current filter combination for nightly email alerts. */
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(120),
          filters: z.object({
            state: z.enum(["NSW", "QLD"]).optional(),
            regionId: z.string().max(64).optional(),
            verdicts: z
              .array(z.enum(["subdividable", "marginal", "not_subdividable", "unknown"]))
              .max(4)
              .optional(),
            category: z.enum(["cash_flow", "land_only"]).optional(),
            minScore: z.number().int().min(0).max(100).optional(),
            maxDaysOnMarket: z.number().int().min(1).max(365).optional(),
            minPrice: z.number().int().min(0).max(1_000_000_000).optional(),
            maxPrice: z.number().int().min(0).max(1_000_000_000).optional(),
            minLandAreaSqm: z.number().int().min(0).max(2_023_500).optional(),
            minFrontageM: z.number().min(0).max(200).optional(),
            maxCoveragePct: z.number().min(1).max(100).optional(),
            excludeNewBuilds: z.boolean().optional(),
            zones: z.array(z.string().max(100)).max(40).optional(),
            search: z.string().max(120).optional(),
            newThisWeek: z.boolean().optional(),
          }),
        }),
      )
      .mutation(({ ctx, input }) => {
        const normalizedFilters = withSubdivisionDefaultMinLand(input.filters);
        return createSavedSearch(ctx.user.id, input.name, JSON.stringify(normalizedFilters));
      }),

    /** Delete one of the user's saved searches. */
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().min(1) }))
      .mutation(({ ctx, input }) => deleteSavedSearch(ctx.user.id, input.id)),
  }),
});

export type AppRouter = typeof appRouter;
