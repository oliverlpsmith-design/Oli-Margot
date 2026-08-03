/**
 * Backfill risk flags (bushfire, flood, heritage, biodiversity) for all active
 * catalogue listings that have lat/lng but no risk data yet.
 *
 * Queries the free NSW Planning Portal ArcGIS services — same as the analyse
 * procedure. Runs 5 concurrent workers to avoid hammering the service.
 *
 * Usage:
 *   cd /home/ubuntu/nsw_property_research
 *   npx tsx scripts/backfill-risk-flags.ts
 *
 * Optional: --limit N   process only first N rows (for testing)
 *           --force     re-process rows that already have some risk data
 */

import { getDb } from "../server/db";
import { catalogueListings } from "../drizzle/schema";
import { isNull, and, eq, isNotNull, or } from "drizzle-orm";
import { checkBushfire, checkFlood, checkHeritage, checkBiodiversity } from "../server/services/riskLayers";

const CONCURRENCY = 5;
const BATCH_SIZE = 50;

const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg >= 0 ? parseInt(args[limitArg + 1], 10) : Infinity;
const FORCE = args.includes("--force");

async function processListing(row: {
  id: number;
  latitude: string | null;
  longitude: string | null;
}) {
  const lat = parseFloat(row.latitude ?? "");
  const lng = parseFloat(row.longitude ?? "");
  if (isNaN(lat) || isNaN(lng)) return { id: row.id, skipped: true };

  // Run all 4 risk checks in parallel
  const [bushfire, flood, heritage, biodiversity] = await Promise.all([
    checkBushfire(lng, lat),
    checkFlood(lng, lat),
    checkHeritage(lng, lat),
    checkBiodiversity(lng, lat),
  ]);

  const bushfireCategory =
    bushfire.status === "flagged" ? (bushfire.items.join(", ") || null) : null;
  const floodRisk = flood.status === "flagged" ? "flagged" : null;
  const heritageFlag =
    heritage.status === "flagged"
      ? (heritage.items[0] ?? "flagged").substring(0, 120)
      : null;
  const biodiversityFlag = biodiversity.status === "flagged" ? "flagged" : null;

  const db = await getDb();
  if (!db) return { id: row.id, skipped: true };
  await db
    .update(catalogueListings)
    .set({
      bushfireCategory,
      bushfireStatus: bushfire.status,
      floodRisk,
      floodStatus: flood.status,
      heritageFlag,
      biodiversityFlag,
    })
    .where(eq(catalogueListings.id, row.id));

  return {
    id: row.id,
    skipped: false,
    bushfireCategory,
    bushfireStatus: bushfire.status,
    floodRisk,
    floodStatus: flood.status,
    heritageFlag,
    biodiversityFlag,
  };
}

async function runBatch(rows: { id: number; latitude: string | null; longitude: string | null }[]) {
  const results = await Promise.all(rows.map(processListing));
  return results;
}

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("[backfill-risk-flags] Could not connect to database");
    process.exit(1);
  }

  // Build the WHERE clause
  const whereClause = FORCE
    ? and(
        eq(catalogueListings.status, "active"),
        isNotNull(catalogueListings.latitude),
        isNotNull(catalogueListings.longitude),
      )
    : and(
        eq(catalogueListings.status, "active"),
        isNotNull(catalogueListings.latitude),
        isNotNull(catalogueListings.longitude),
        isNull(catalogueListings.bushfireCategory),
        isNull(catalogueListings.floodRisk),
        isNull(catalogueListings.heritageFlag),
        isNull(catalogueListings.biodiversityFlag),
      );

  const allRows = await db
    .select({
      id: catalogueListings.id,
      latitude: catalogueListings.latitude,
      longitude: catalogueListings.longitude,
    })
    .from(catalogueListings)
    .where(whereClause);

  const rows = LIMIT < Infinity ? allRows.slice(0, LIMIT) : allRows;
  const total = rows.length;
  console.log(`[backfill-risk-flags] ${total} listings to process (FORCE=${FORCE})`);

  let processed = 0;
  let flaggedBushfire = 0;
  let flaggedFlood = 0;
  let flaggedHeritage = 0;
  let flaggedBiodiversity = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    // Process CONCURRENCY items at a time within each batch
    for (let j = 0; j < batch.length; j += CONCURRENCY) {
      const chunk = batch.slice(j, j + CONCURRENCY);
      try {
        const results = await runBatch(chunk);
        for (const r of results) {
          processed++;
          if (r.skipped) {
            skipped++;
          } else {
            if (r.bushfireCategory) flaggedBushfire++;
            if (r.floodRisk) flaggedFlood++;
            if (r.heritageFlag) flaggedHeritage++;
            if (r.biodiversityFlag) flaggedBiodiversity++;
          }
        }
      } catch (err) {
        errors++;
        console.error(`[backfill-risk-flags] Error on chunk starting at ${i + j}:`, err);
      }
    }

    // Progress report every batch
    const pct = Math.round((processed / total) * 100);
    console.log(
      `[backfill-risk-flags] ${processed}/${total} (${pct}%) — ` +
        `bushfire:${flaggedBushfire} flood:${flaggedFlood} heritage:${flaggedHeritage} biodiversity:${flaggedBiodiversity} skipped:${skipped} errors:${errors}`,
    );
  }

  console.log(`\n[backfill-risk-flags] DONE`);
  console.log(`  Total processed : ${processed}`);
  console.log(`  Skipped (no coords): ${skipped}`);
  console.log(`  Errors          : ${errors}`);
  console.log(`  Bushfire flagged: ${flaggedBushfire}`);
  console.log(`  Flood flagged   : ${flaggedFlood}`);
  console.log(`  Heritage flagged: ${flaggedHeritage}`);
  console.log(`  Biodiversity flagged: ${flaggedBiodiversity}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[backfill-risk-flags] Fatal error:", err);
  process.exit(1);
});
