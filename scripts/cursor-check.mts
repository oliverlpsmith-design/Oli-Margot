/** Quick scanRuns cursor + catalogue breakdown inspector. Usage: npx tsx scripts/cursor-check.mts */
import "dotenv/config";
import mysql from "mysql2/promise";
const c = await mysql.createConnection(process.env.DATABASE_URL!);
const [runs] = await c.query(
  "SELECT id, mode, status, `cursor`, listingsSeen, listingsAnalysed, listingsAdded, listingsMarkedSold FROM scanRuns ORDER BY id DESC LIMIT 3",
);
console.log("runs:", JSON.stringify(runs, null, 1));
const [regions] = await c.query(
  "SELECT regionId, COUNT(*) AS n, SUM(CASE WHEN postcode NOT LIKE '2%' THEN 1 ELSE 0 END) AS badPostcodes FROM catalogueListings GROUP BY regionId ORDER BY n DESC",
);
console.log("regions:", JSON.stringify(regions, null, 1));
const [verdicts] = await c.query(
  "SELECT verdict, status, COUNT(*) AS n FROM catalogueListings GROUP BY verdict, status",
);
console.log("verdicts:", JSON.stringify(verdicts, null, 1));
await c.end();
