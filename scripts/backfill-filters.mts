/**
 * Backfill the new false-positive filter fields (buildingSizeSqm, coveragePct,
 * frontageM, isNewBuild, hasEstateKeywords) on existing catalogue rows.
 * Only touches ACTIVE rows with verdict subdividable/marginal (the rows users
 * actually browse) to keep RealtyAPI credit cost low (1 details call per row).
 *
 * Usage: npx tsx scripts/backfill-filters.mts [limit]
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { catalogueListings } from "../drizzle/schema";
import {
  getListingDetail,
  hasNewEstateKeywords,
  parseFrontageM,
} from "../server/services/realtyApi";

const limit = Number(process.argv[2] ?? 2000);
const db = drizzle(process.env.DATABASE_URL!);

const rows = await db
  .select({
    id: catalogueListings.id,
    listingId: catalogueListings.listingId,
    landAreaSqm: catalogueListings.landAreaSqm,
    headline: catalogueListings.headline,
  })
  .from(catalogueListings)
  .where(
    and(
      eq(catalogueListings.status, "active"),
      inArray(catalogueListings.verdict, ["subdividable", "marginal"]),
      // Not yet backfilled: no building size AND no frontage AND not flagged
      isNull(catalogueListings.buildingSizeSqm),
      isNull(catalogueListings.frontageM),
      eq(catalogueListings.isNewBuild, false),
      sql`${catalogueListings.updatedAt} < date_sub(now(), interval 5 minute)`,
    ),
  )
  .limit(limit);

console.log(`Backfilling ${rows.length} rows...`);
let done = 0;
let failed = 0;

for (const row of rows) {
  try {
    const detail = await getListingDetail(row.listingId);
    const land = row.landAreaSqm != null ? Number(row.landAreaSqm) : null;
    const buildingSizeSqm = detail.buildingSizeSqm ?? null;
    const coveragePct =
      buildingSizeSqm != null && land != null && land > 0
        ? Math.min(999.9, Math.round((buildingSizeSqm / land) * 1000) / 10)
        : null;
    const frontageM = parseFrontageM(detail.description) ?? parseFrontageM(row.headline);
    const estateKeywords = hasNewEstateKeywords(row.headline, detail.headline, detail.description);
    const isNewBuild = (detail.constructionStatus ?? "").toLowerCase() === "new" || estateKeywords;
    await db
      .update(catalogueListings)
      .set({
        buildingSizeSqm: buildingSizeSqm != null ? String(buildingSizeSqm) : null,
        coveragePct: coveragePct != null ? String(coveragePct) : null,
        frontageM: frontageM != null ? String(frontageM) : null,
        isNewBuild,
        hasEstateKeywords: estateKeywords,
      })
      .where(eq(catalogueListings.id, row.id));
    done++;
  } catch (e) {
    failed++;
    if ((e as Error).message.includes("404")) {
      // Off-market — the nightly scan will mark it sold; skip here.
    }
  }
  if ((done + failed) % 50 === 0) console.log(`progress: ${done} done, ${failed} failed`);
  await new Promise((r) => setTimeout(r, 150));
}

console.log(`Backfill complete: ${done} updated, ${failed} failed/skipped.`);
process.exit(0);
