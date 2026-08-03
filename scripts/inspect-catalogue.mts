/** Quick catalogue inspection. Usage: npx tsx scripts/inspect-catalogue.mts */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

async function main() {
  const db = drizzle(process.env.DATABASE_URL!);
  const [rows] = await db.execute(
    sql`SELECT listingId, suburb, propertyType, landAreaSqm, minLotSizeSqm, zoneCode, verdict, score, category, listedAt FROM catalogueListings ORDER BY id DESC LIMIT 10`,
  );
  console.table(rows);
  const [agg] = await db.execute(sql`SELECT verdict, count(*) c FROM catalogueListings GROUP BY verdict`);
  console.table(agg);
  const [runs] = await db.execute(sql`SELECT id, mode, status, listingsSeen, listingsAnalysed, listingsAdded, listingsMarkedSold, startedAt, finishedAt FROM scanRuns ORDER BY id DESC LIMIT 5`);
  console.table(runs);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
