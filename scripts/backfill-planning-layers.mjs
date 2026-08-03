import { getDb } from "../server/db.js";
import { catalogueListings } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { checkAcidSulfate, checkFSR, checkBuildingHeight } from "../server/services/riskLayers.js";

const db = await getDb();
if (!db) {
  console.error("Failed to connect to database");
  process.exit(1);
}

// Get all active listings with coordinates
const rows = await db
  .select({
    id: catalogueListings.id,
    latitude: catalogueListings.latitude,
    longitude: catalogueListings.longitude,
  })
  .from(catalogueListings)
  .where(eq(catalogueListings.status, "active"))
  .limit(100); // Process in batches for safety

console.log(`Processing ${rows.length} active listings...`);

let processed = 0;
let errors = 0;

for (const row of rows) {
  if (!row.latitude || !row.longitude) continue;

  try {
    const [acidSulfate, fsr, buildingHeight] = await Promise.all([
      checkAcidSulfate(row.longitude, row.latitude),
      checkFSR(row.longitude, row.latitude),
      checkBuildingHeight(row.longitude, row.latitude),
    ]);

    const acidSulfateClass = acidSulfate.status === "flagged"
      ? acidSulfate.detail?.split(" — ")[1]?.trim() ?? null
      : null;

    await db
      .update(catalogueListings)
      .set({
        acidSulfateClass,
        fsrValue: fsr.value,
        maxBuildingHeightM: buildingHeight.value,
      })
      .where(eq(catalogueListings.id, row.id));

    processed++;
    if (processed % 10 === 0) console.log(`  Processed ${processed}/${rows.length}...`);
  } catch (err) {
    errors++;
    console.error(`  Error processing listing ${row.id}:`, err.message);
  }
}

console.log(`\nBackfill complete: ${processed} updated, ${errors} errors`);
process.exit(errors > 0 ? 1 : 0);
