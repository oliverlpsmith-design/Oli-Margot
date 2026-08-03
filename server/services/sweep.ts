/**
 * Catalogue sweep engine.
 *
 * Builds and maintains the comprehensive catalogue of analysed NSW and QLD listings:
 * - FULL SWEEP: pages through every region location (channel=buy, viable
 *   property types, newest-first) analysing every listing not already known.
 * - INCREMENTAL: same traversal but stops paging a location early once a full
 *   page of already-known listings is hit (new listings surface first under
 *   sortType=new-desc), then runs sold-detection on stale active rows.
 *
 * Every invocation is TIME-BOXED (default 85s — cron handler budget is 2min)
 * and RESUMABLE: progress is checkpointed in scanRuns.cursor after each page,
 * so repeated invocations (nightly triggers, manual "continue" calls) carry a
 * run through to completion. Listings already in the catalogue are never
 * re-analysed (planning rules change rarely; re-analysis can be forced later
 * by clearing rows).
 */

import {
  createScanRun,
  getKnownListingIds,
  getRunningScanRun,
  listCatalogueRowsForClassifierUpgrade,
  listStaleActiveListings,
  markListingsSold,
  touchListingsSeen,
  updateCatalogueClassification,
  updateScanRun,
  upsertCatalogueListing,
} from "../db";
import { ALL_REGIONS, type CoveredState } from "../../shared/regions";
import {
  categoriseListing,
  getListingDetail,
  hasNewEstateKeywords,
  parsePriceNumeric,
  isListingOffMarket,
  parseFrontageM,
  parseLandAreaSqm,
  searchListings,
  VIABLE_PROPERTY_TYPES,
  ALL_PROPERTY_TYPES,
  type ListingSummary,
} from "./realtyApi";
import { getMinimumLotSize, getZoning } from "./nswPlanning";
import {
  getQldPlanningAtPoint,
  type QldFieldProvenance,
  type QldSourceConfidence,
} from "./qldPlanning";
import { analyseSubdivisionPotential, scoreSubdivisionPotential } from "./subdivision";
import { checkBushfire, checkFlood, checkFSR } from "./riskLayers";
import {
  buildClassificationEvidence,
  CURRENT_CLASSIFIER_VERSION,
  tagsToString,
} from "./investmentClassifier";

export interface SweepCursor {
  /** Flat list of {regionId, location} units; index of the NEXT unit to scan. */
  unitIndex: number;
  /** Next page within the current unit (1-based). */
  page: number;
  /** Whether the sold-detection pass has completed (incremental only). */
  soldCheckDone: boolean;
  /** Offset into stale listings for sold checks. */
  soldCheckOffset: number;
}

export interface SweepProgress {
  runId: number;
  mode: "full_sweep" | "incremental";
  done: boolean;
  unitsTotal: number;
  unitsDone: number;
  seen: number;
  analysed: number;
  added: number;
  reclassified: number;
  markedSold: number;
  message: string;
}

interface ScanUnit {
  regionId: string;
  state: CoveredState;
  location: string;
}

export function scanUnits(): ScanUnit[] {
  return ALL_REGIONS.filter((region) => region.enabled !== false).flatMap((region) =>
    region.locations.map((location) => ({ regionId: region.id, state: region.state, location })),
  );
}

/**
 * Hard page cap per location per invocation chain — safety valve only.
 * Sized above the largest known unit (Western Sydney ≈ 6,000 viable listings
 * ≈ 200 pages); traversal normally ends earlier via `nextPage: false`.
 */
const MAX_PAGES_PER_UNIT = 250; // 250 pages * 30 = 7,500 listings per location
/** In an incremental run, stop a unit after this many consecutive all-known pages. */
const KNOWN_PAGES_TO_STOP = 2;
/** Concurrency for detail+planning analysis. */
const ANALYSIS_CONCURRENCY = 6;
/** Max sold-checks per invocation (details/byid calls are 1 credit each). */
const SOLD_CHECKS_PER_RUN = 150;
/** Stored-data-only classifier upgrades per invocation; no external API calls. */
const CLASSIFIER_UPGRADES_PER_SLICE = 2_000;
const CLASSIFIER_UPGRADE_CONCURRENCY = 16;

function initialCursor(): SweepCursor {
  return { unitIndex: 0, page: 1, soldCheckDone: false, soldCheckOffset: 0 };
}

function positiveNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export interface CatalogueClassifierInput {
  state?: CoveredState | null;
  headline: string | null;
  description: string | null | undefined;
  priceNumeric: string | number | null;
  bedrooms: number | null;
  zoneCode: string | null;
  propertyType: string | null;
  landAreaSqm: number | null;
  minLotSizeSqm: number | null;
  frontageM: number | null;
  fsrValue: string | number | null;
  bushfireStatus: "clear" | "flagged" | "unknown";
  floodStatus: "clear" | "flagged" | "unknown";
  category: "cash_flow" | "land_only" | "unknown";
  planningEvidence?: "council_machine" | "council_partial" | "manual_review" | "state_machine" | null;
  /** Auditable QLD planning-source context stored in classificationEvidence JSON. */
  planningProvenance?: QldPlanningProvenance | null;
}

export interface QldPlanningProvenance {
  councilKey: string | null;
  schemeName: string | null;
  effectiveFrom: string | null;
  verificationUrl: string | null;
  fieldProvenance: QldFieldProvenance;
  subdivisionRule: "manual_review_required" | null;
  sourceNotes: string | null;
  confidence: QldSourceConfidence;
}

/** The exact versioned outputs persisted for both fresh and upgraded catalogue rows. */
export function deriveCatalogueClassification(input: CatalogueClassifierInput) {
  const categoryEvidence = buildClassificationEvidence({
    state: input.state,
    headline: input.headline,
    description: input.description,
    priceNumeric: input.priceNumeric,
    bedrooms: input.bedrooms,
    zoneCode: input.zoneCode,
    propertyType: input.propertyType,
    landAreaSqm: input.landAreaSqm,
    fsrValue: input.fsrValue,
    planningEvidence: input.planningEvidence,
  });
  const subdivision = analyseSubdivisionPotential({
    state: input.state,
    landAreaSqm: input.landAreaSqm,
    minLotSizeSqm: input.minLotSizeSqm,
    zoneCode: input.zoneCode,
    frontageM: input.frontageM,
    bushfireStatus: input.bushfireStatus,
    floodStatus: input.floodStatus,
    planningEvidence: input.planningEvidence,
  });
  const score = scoreSubdivisionPotential({
    analysis: subdivision,
    hasLandArea: input.landAreaSqm !== null,
    hasMls: input.minLotSizeSqm !== null,
    category: input.category,
  });
  return {
    investmentTags: tagsToString(categoryEvidence.tags),
    classifierVersion: CURRENT_CLASSIFIER_VERSION,
    classificationEvidence: {
      ...categoryEvidence,
      subdivision: {
        ...subdivision,
        frontageM: input.frontageM,
        bushfireStatus: input.bushfireStatus,
        floodStatus: input.floodStatus,
      },
      planningProvenance: input.state === "QLD" ? input.planningProvenance ?? null : null,
    },
    analysis: subdivision,
    score,
  };
}

const QLD_STORED_PLANNING_EVIDENCE = new Set([
  "council_machine",
  "council_partial",
  "manual_review",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Historic catalogue rows can be reclassified without new API calls. Their QLD
 * planning tier must be read from stored evidence; a missing tier is manual
 * review, never an inferred council-machine result.
 */
export function storedQldPlanningEvidence(value: unknown): CatalogueClassifierInput["planningEvidence"] {
  if (!isRecord(value) || !QLD_STORED_PLANNING_EVIDENCE.has(String(value.planningEvidence))) {
    return "manual_review";
  }
  return value.planningEvidence as "council_machine" | "council_partial" | "manual_review";
}

function storedQldPlanningProvenance(value: unknown): QldPlanningProvenance | null {
  if (!isRecord(value) || !isRecord(value.planningProvenance)) return null;
  return value.planningProvenance as unknown as QldPlanningProvenance;
}

/**
 * Upgrade historical active rows from stored listing/planning evidence only.
 * Rows with unavailable hazard lookup states remain conservatively unverified;
 * this phase deliberately makes no RealtyAPI or NSW layer requests.
 */
async function upgradeStoredClassifications(outOfTime: () => boolean): Promise<number> {
  const rows = await listCatalogueRowsForClassifierUpgrade(
    CURRENT_CLASSIFIER_VERSION,
    CLASSIFIER_UPGRADES_PER_SLICE,
  );
  const queue = [...rows];
  let upgraded = 0;
  const workers = Array.from({ length: CLASSIFIER_UPGRADE_CONCURRENCY }, async () => {
    for (;;) {
      const row = queue.shift();
      if (!row || outOfTime()) return;
      const state: CoveredState = row.state === "QLD" ? "QLD" : "NSW";
      const landAreaSqm = positiveNumber(row.landAreaSqm);
      const minLotSizeSqm = positiveNumber(row.minLotSizeSqm);
      const frontageM = positiveNumber(row.frontageM);
      const derived = deriveCatalogueClassification({
        state,
        headline: row.headline,
        description: row.descriptionShort,
        priceNumeric: row.priceNumeric,
        bedrooms: row.bedrooms,
        zoneCode: row.zoneCode,
        propertyType: row.propertyType,
        landAreaSqm,
        minLotSizeSqm,
        frontageM,
        fsrValue: row.fsrValue,
        bushfireStatus: row.bushfireStatus,
        floodStatus: row.floodStatus,
        category: row.category,
        planningEvidence:
          state === "QLD" ? storedQldPlanningEvidence(row.classificationEvidence) : "state_machine",
        planningProvenance:
          state === "QLD" ? storedQldPlanningProvenance(row.classificationEvidence) : null,
      });
      await updateCatalogueClassification(row.id, {
        investmentTags: derived.investmentTags,
        classifierVersion: derived.classifierVersion,
        classificationEvidence: derived.classificationEvidence,
        potentialLots: derived.analysis.potentialLots,
        verdict: derived.analysis.verdict,
        score: derived.score,
      });
      upgraded += 1;
    }
  });
  await Promise.all(workers);
  return upgraded;
}

/**
 * Analyse one listing against the applicable state planning layers and store it.
 * Returns true when the row was stored.
 */
async function analyseAndStore(
  listing: ListingSummary,
  regionId: string,
  expectedState: CoveredState,
  now: Date,
): Promise<boolean> {
  try {
    // Defence: some unresolvable location strings make REA fall back to an
    // Australia-wide search. Never store listings outside the unit's state.
    const listedState = (listing.address?.state ?? "").toUpperCase();
    if (listedState && listedState !== expectedState) return false;
    const state: CoveredState = listedState === "QLD" ? "QLD" : expectedState;
    const lat = listing.geoLocation?.latitude;
    const lng = listing.geoLocation?.longitude;
    const planningPromise = (async () => {
      if (lat == null || lng == null) {
        return {
          mls: null,
          zoning: null,
          bushfire: { status: "unknown" as const, detail: "Coordinates unavailable", items: [] as string[] },
          flood: { status: "unknown" as const, detail: "Coordinates unavailable", items: [] as string[] },
          fsr: { status: "unknown" as const, value: null, detail: "Coordinates unavailable" },
          planningEvidence: state === "QLD" ? ("manual_review" as const) : ("state_machine" as const),
          planningProvenance: null as QldPlanningProvenance | null,
          lgaName: null as string | null,
        };
      }
      if (state === "QLD") {
        const qld = await getQldPlanningAtPoint(lat, lng);
        return {
          mls: qld.minimumLotSize,
          zoning: qld.zoning,
          bushfire: qld.bushfire,
          flood: qld.flood,
          fsr: {
            status: "unknown" as const,
            value: null,
            detail: "QLD density/plot-ratio controls require council-scheme verification",
          },
          planningEvidence: qld.coverage,
          planningProvenance: {
            councilKey: qld.councilKey,
            schemeName: qld.schemeName,
            effectiveFrom: qld.effectiveFrom,
            verificationUrl: qld.verificationUrl,
            fieldProvenance: qld.fieldProvenance,
            subdivisionRule: qld.subdivisionRule,
            sourceNotes: qld.sourceNotes,
            confidence: qld.confidence,
          },
          lgaName: qld.lgaName,
        };
      }
      const [mls, zoning, bushfire, flood, fsr] = await Promise.all([
        getMinimumLotSize(lat, lng).catch(() => null),
        getZoning(lat, lng).catch(() => null),
        checkBushfire(lng, lat),
        checkFlood(lng, lat),
        checkFSR(lng, lat),
      ]);
      return {
        mls,
        zoning,
        bushfire,
        flood,
        fsr,
        planningEvidence: "state_machine" as const,
        planningProvenance: null as QldPlanningProvenance | null,
        lgaName: mls?.lgaName ?? zoning?.lgaName ?? null,
      };
    })();
    const [detail, planning] = await Promise.all([
      getListingDetail(listing.id).catch(() => null),
      planningPromise,
    ]);
    const { mls, zoning, bushfire, flood, fsr, planningEvidence } = planning;
    const landAreaSqm = parseLandAreaSqm(detail?.landArea ?? listing.landArea);
    const frontageM = parseFrontageM(detail?.description) ?? parseFrontageM(listing.headline);
    const category = categoriseListing(detail ?? listing);
    const descriptionShort = detail?.description
      ? detail.description.slice(0, 500).trim() || undefined
      : undefined;
    const priceNumeric = parsePriceNumeric(listing.price ?? detail?.price);
    const derived = deriveCatalogueClassification({
      state,
      headline: listing.headline ?? detail?.headline ?? "",
      description: descriptionShort,
      priceNumeric,
      bedrooms: listing.bedrooms ?? detail?.bedrooms ?? null,
      zoneCode: zoning?.zoneCode ?? null,
      propertyType: listing.propertyType ?? detail?.propertyType ?? null,
      landAreaSqm,
      minLotSizeSqm: mls?.lotSizeSqm ?? null,
      frontageM,
      fsrValue: fsr.value,
      bushfireStatus: bushfire.status,
      floodStatus: flood.status,
      category,
      planningEvidence,
      planningProvenance: planning.planningProvenance,
    });
    const analysis = derived.analysis;
    const score = derived.score;
    const listedAt = detail?.listedAtEstimate ?? now;
    // False-positive filter signals (see REA_API_NOTES.md "Filter-data availability")
    const buildingSizeSqm = detail?.buildingSizeSqm ?? null;
    const coveragePct =
      buildingSizeSqm != null && landAreaSqm != null && landAreaSqm > 0
        ? Math.min(999.9, Math.round((buildingSizeSqm / landAreaSqm) * 1000) / 10)
        : null;
    const estateKeywords = hasNewEstateKeywords(listing.headline, detail?.headline, detail?.description);
    const isNewBuild = (detail?.constructionStatus ?? "").toLowerCase() === "new" || estateKeywords;
    await upsertCatalogueListing({
      listingId: String(listing.id),
      address: listing.address?.full ?? detail?.address?.full,
      suburb: listing.address?.suburb ?? detail?.address?.suburb,
      postcode: listing.address?.postcode ?? detail?.address?.postcode,
      state,
      regionId,
      latitude: lat != null ? String(lat) : undefined,
      longitude: lng != null ? String(lng) : undefined,
      propertyType: listing.propertyType ?? detail?.propertyType,
      priceDisplay: (listing.price ?? detail?.price ?? "").slice(0, 158) || undefined,
      priceNumeric: priceNumeric != null ? String(priceNumeric) : undefined,
      bedrooms: listing.bedrooms ?? detail?.bedrooms,
      bathrooms: listing.bathrooms ?? detail?.bathrooms,
      landAreaSqm: landAreaSqm != null ? String(landAreaSqm) : undefined,
      minLotSizeSqm: mls?.lotSizeSqm != null ? String(mls.lotSizeSqm) : undefined,
      minLotSizeLabel: mls?.label ?? undefined,
      zoneCode: zoning?.zoneCode ?? undefined,
      lgaName: planning.lgaName ?? mls?.lgaName ?? zoning?.lgaName ?? undefined,
      potentialLots: analysis.potentialLots ?? undefined,
      verdict: analysis.verdict,
      score,
      category,
      buildingSizeSqm: buildingSizeSqm != null ? String(buildingSizeSqm) : undefined,
      coveragePct: coveragePct != null ? String(coveragePct) : undefined,
      frontageM: frontageM != null ? String(frontageM) : undefined,
      isNewBuild,
      hasEstateKeywords: estateKeywords,
      investmentTags: derived.investmentTags,
      classifierVersion: derived.classifierVersion,
      classificationEvidence: derived.classificationEvidence,
      status: "active",
      listingUrl: listing.listingUrl ?? detail?.listingUrl,
      imageUrl: listing.photos?.[0] ?? detail?.photos?.[0],
      headline: listing.headline ?? detail?.headline,
      descriptionShort,
      fsrValue: fsr.value != null ? String(fsr.value) : undefined,
      bushfireCategory:
        bushfire.status === "flagged" ? (bushfire.items.join(", ") || "flagged") : undefined,
      bushfireStatus: bushfire.status,
      floodRisk: flood.status === "flagged" ? "flagged" : undefined,
      floodStatus: flood.status,
      listedAt,
      firstSeenAt: now,
      lastSeenAt: now,
    });
    return true;
  } catch (error) {
    console.warn(`[Sweep] Failed to analyse listing ${listing.id}:`, error);
    return false;
  }
}

/**
 * Run (or resume) a sweep. Returns progress after the time budget expires or
 * the sweep completes. Call repeatedly until `done` is true.
 */
export async function runSweepSlice(opts: {
  mode: "full_sweep" | "incremental";
  /** When true, scan all property types (not just subdivision-viable ones) for niche backfill. */
  allPropertyTypes?: boolean;
  budgetMs?: number;
}): Promise<SweepProgress> {
  const budgetMs = Math.min(opts.budgetMs ?? 85_000, 100_000);
  const startedAt = Date.now();
  const outOfTime = () => Date.now() - startedAt > budgetMs;
  let reclassified = 0;

  // Resume an existing running scan of the same mode, else start a new one.
  let runId: number;
  let cursor: SweepCursor;
  let counters = { seen: 0, analysed: 0, added: 0, markedSold: 0 };
  const existing = await getRunningScanRun();
  if (existing && existing.mode === opts.mode) {
    runId = existing.id;
    cursor = (existing.cursor as SweepCursor | null) ?? initialCursor();
    counters = {
      seen: existing.listingsSeen,
      analysed: existing.listingsAnalysed,
      added: existing.listingsAdded,
      markedSold: existing.listingsMarkedSold,
    };
  } else if (existing) {
    // A different-mode run is mid-flight; finish it as superseded and start fresh.
    await updateScanRun(existing.id, { status: "failed", error: "superseded by new run", finishedAt: new Date() });
    runId = await createScanRun(opts.mode);
    cursor = initialCursor();
  } else {
    runId = await createScanRun(opts.mode);
    cursor = initialCursor();
  }

  const units = scanUnits();
  const known = await getKnownListingIds();
  const runStart = new Date();
  const incremental = opts.mode === "incremental";

  const persist = async (extra?: Partial<Parameters<typeof updateScanRun>[1]>) => {
    await updateScanRun(runId, {
      cursor,
      listingsSeen: counters.seen,
      listingsAnalysed: counters.analysed,
      listingsAdded: counters.added,
      listingsMarkedSold: counters.markedSold,
      ...extra,
    });
  };

  try {
    // ---- Phase 0: bounded, stored-data-only upgrade of historical rows ----
    reclassified = await upgradeStoredClassifications(outOfTime);
    if (outOfTime()) {
      await persist();
      return progress(false, "time budget reached after stored classifier upgrades");
    }

    // ---- Phase A: traverse listings ----
    while (cursor.unitIndex < units.length && !outOfTime()) {
      const unit = units[cursor.unitIndex]!;
      let knownPageStreak = 0;

      while (cursor.page <= MAX_PAGES_PER_UNIT && !outOfTime()) {
        let res;
        try {
          res = await searchListings({
            location: unit.location,
            page: cursor.page,
            propertyTypes: opts.allPropertyTypes ? ALL_PROPERTY_TYPES : VIABLE_PROPERTY_TYPES,
            sortType: "new-desc",
          });
        } catch (error) {
          console.warn(`[Sweep] search failed for ${unit.location} p${cursor.page}:`, error);
          break; // move to next unit; failed unit retried next run
        }
        const rows = res.searchResults;
        counters.seen += rows.length;

        const fresh = rows.filter((l) => !known.has(String(l.id)));
        const alreadyKnown = rows.filter((l) => known.has(String(l.id)));
        if (alreadyKnown.length > 0) {
          await touchListingsSeen(alreadyKnown.map((l) => String(l.id)));
        }

        // Analyse fresh listings with bounded concurrency
        const queue = [...fresh];
        const workers = Array.from({ length: ANALYSIS_CONCURRENCY }, async () => {
          for (;;) {
            const listing = queue.shift();
            if (!listing || outOfTime()) return;
            counters.analysed += 1;
            const stored = await analyseAndStore(listing, unit.regionId, unit.state, runStart);
            if (stored) {
              counters.added += 1;
              known.add(String(listing.id));
            }
          }
        });
        await Promise.all(workers);
        // Listings left in queue (time-box hit) will be re-encountered on
        // resume since cursor.page only advances after the full page persists.
        if (queue.length > 0) {
          await persist();
          return progress(false, "time budget reached mid-page");
        }

        knownPageStreak = fresh.length === 0 && rows.length > 0 ? knownPageStreak + 1 : 0;
        cursor.page += 1;
        await persist();

        if (!res.nextPage) break;
        if (incremental && knownPageStreak >= KNOWN_PAGES_TO_STOP) break;
      }

      // Only advance to the next unit when this unit genuinely finished:
      // page cap reached, no more pages, search error (retry next run), or
      // incremental early-stop. If we exited the page loop because the time
      // budget ran out, keep the cursor on this unit/page so the next slice
      // resumes exactly where we left off instead of skipping listings.
      if (!outOfTime()) {
        cursor.unitIndex += 1;
        cursor.page = 1;
        await persist();
      }
    }

    if (cursor.unitIndex < units.length) {
      await persist();
      return progress(false, "time budget reached");
    }

    // ---- Phase B: sold detection (incremental runs only) ----
    if (incremental && !cursor.soldCheckDone) {
      // Anything active that this run did NOT touch is a sold candidate.
      const staleCutoff = new Date(runStart.getTime() - 20 * 3600_000); // not seen in ~last day
      let checked = 0;
      while (checked < SOLD_CHECKS_PER_RUN && !outOfTime()) {
        const stale = await listStaleActiveListings(staleCutoff, 25);
        if (stale.length === 0) break;
        const results = await Promise.all(
          stale.map(async (row) => ({
            listingId: row.listingId,
            offMarket: await isListingOffMarket(row.listingId),
          })),
        );
        const sold = results.filter((r) => r.offMarket).map((r) => r.listingId);
        const stillActive = results.filter((r) => !r.offMarket).map((r) => r.listingId);
        if (sold.length > 0) {
          await markListingsSold(sold);
          counters.markedSold += sold.length;
        }
        if (stillActive.length > 0) await touchListingsSeen(stillActive);
        checked += stale.length;
        await persist();
      }
      cursor.soldCheckDone = true;
      await persist();
    }

    await persist({ status: "completed", finishedAt: new Date() });
    return progress(true, "sweep completed");
  } catch (error) {
    await persist({
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      finishedAt: new Date(),
    });
    throw error;
  }

  function progress(done: boolean, message: string): SweepProgress {
    return {
      runId,
      mode: opts.mode,
      done,
      unitsTotal: units.length,
      unitsDone: Math.min(cursor.unitIndex, units.length),
      seen: counters.seen,
      analysed: counters.analysed,
      added: counters.added,
      reclassified,
      markedSold: counters.markedSold,
      message,
    };
  }
}
