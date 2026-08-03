/**
 * Backfill descriptionShort for existing active listings.
 * Fetches listing detail from RealtyAPI for each listing without a description,
 * stores first 500 chars, then re-runs the classifier.
 *
 * Rate-limited to ~3 concurrent requests to stay within API limits.
 * Logs progress to stdout.
 */
import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const REALTY_API_KEY = process.env.REALTY_API_KEY;
const REALTY_BASE_URL = 'https://realestateau.realtyapi.io';
const CONCURRENCY = 10;
// If first non-flag arg is a number, use it as limit; otherwise default to 99999
const numArg = process.argv.find(a => /^\d+$/.test(a));
const LIMIT = numArg ? parseInt(numArg, 10) : 99999;

if (!REALTY_API_KEY) {
  console.error('REALTY_API_KEY not set');
  process.exit(1);
}

const db = await createConnection(process.env.DATABASE_URL);

// ---- Classifier patterns (mirrors investmentClassifier.ts) ----
const DECEASED_RE =
  /deceased\s+estate|estate\s+of\s+the\s+late|executor[- ]managed|executor[- ]instructed|probate\s+sale|probate\s+property|estate\s+liquidation|beneficiary\s+sale|executor\s+sale|selling\s+the\s+estate|instructed\s+by\s+executor|instructed\s+by\s+the\s+estate|estate\s+instructed|on\s+behalf\s+of\s+the\s+estate|instructions\s+of\s+the\s+estate/i;
const DUAL_INCOME_RE =
  /granny\s+flat|granny\s+potential|dual\s+occupancy|dual\s+income|secondary\s+dwelling|dual[- ]living|in-law\s+suite|self[- ]contained\s+(unit|studio|flat|cottage|dwelling)|second\s+dwelling|secondary\s+suite|additional\s+dwelling|dual\s+residence|two\s+dwellings|two\s+homes|two\s+houses|two\s+units\s+on|separate\s+dwelling|detached\s+granny|duplex|dual\s+occ|house\s+[+&]\s+granny|house\s+and\s+granny|house\s+with\s+granny|dual\s+access\s+block|dual[- ]zoned|dual\s+frontage.*income|income\s+producing.*flat|flat.*income|rental\s+income.*granny|granny.*rental/i;
const DISTRESSED_RE =
  /mortgagee[- ]in[- ]possession|mortgagee\s+sale|bank\s+sale|bank\s+instructed|urgent\s+sale|must\s+sell|must\s+be\s+sold|below\s+market\s+value|under\s+market\s+value|forced\s+sale|distressed\s+sale|vendor\s+must\s+sell|owner\s+must\s+sell|priced\s+to\s+sell|motivated\s+(seller|vendor|to\s+sell)|vendor\s+motivated|highly\s+motivated\s+vendor|financial\s+hardship|receivership|court[- ]ordered\s+sale|bank\s+repossession|repossessed\s+property|price\s+slashed|drastically\s+reduced|price\s+reduced\s+for\s+(immediate|quick|urgent)|all\s+reasonable\s+offers|inviting\s+offers.*motivated|motivated.*inviting\s+offers|below\s+replacement\s+cost|selling\s+below|priced\s+below\s+market|reduced\s+to\s+sell|urgent\s+sale\s+required|must\s+be\s+sold\s+by/i;
const DEV_SITE_RE =
  /development\s+site|development\s+opportunity|da\s+approved|development\s+approval|rezone[d]?|rezoning\s+approved|approved\s+plans|subdivision\s+approved|development\s+potential|approved\s+development|commercial\s+development|mixed\s+use\s+development|townhouse\s+development|unit\s+development|multi[- ]unit|multi[- ]dwelling/i;

function classifyText(headline, description, priceNumeric, bedrooms) {
  const text = ((headline ?? '') + ' ' + (description ?? '').slice(0, 600)).toLowerCase();
  const tags = [];
  if (DECEASED_RE.test(text)) tags.push('deceased_estate');
  if (DUAL_INCOME_RE.test(text)) tags.push('dual_income');
  if (DISTRESSED_RE.test(text)) tags.push('distressed');
  if (DEV_SITE_RE.test(text)) tags.push('dev_site');
  const price = priceNumeric ? Number(priceNumeric) : null;
  const beds = bedrooms ?? 0;
  if (price !== null && price > 0 && ((price < 700_000 && beds >= 3) || (price < 500_000 && beds >= 2))) {
    tags.push('pos_geared');
  }
  return tags.join('|');
}

async function fetchDescription(listingId) {
  try {
    const res = await fetch(`${REALTY_BASE_URL}/details/byid?id=${listingId}`, {
      headers: { 'x-realtyapi-key': REALTY_API_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // RealtyAPI response shape: { message, source, detail: { description, ... } }
    const desc = data?.detail?.description ?? data?.data?.description ?? data?.description ?? null;
    return typeof desc === 'string' ? desc.slice(0, 500).trim() : null;
  } catch {
    return null;
  }
}

// Fetch listings without descriptions (or all if --all flag)
const fetchAll = process.argv.includes('--all');
const whereClause = fetchAll
  ? `status = 'active'`
  : `status = 'active' AND (descriptionShort IS NULL OR descriptionShort = '')`;

const [rows] = await db.execute(
  `SELECT id, listingId, headline, priceNumeric, bedrooms, investmentTags FROM catalogueListings WHERE ${whereClause} LIMIT ${LIMIT}`
);

console.log(`Fetching descriptions for ${rows.length} listings (concurrency=${CONCURRENCY})...`);

let processed = 0;
let updated = 0;
let tagChanges = 0;

// Process in batches of CONCURRENCY
for (let i = 0; i < rows.length; i += CONCURRENCY) {
  const batch = rows.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(async (row) => {
    const desc = await fetchDescription(row.listingId);
    const newTags = classifyText(row.headline, desc, row.priceNumeric, row.bedrooms);
    const tagsChanged = newTags !== (row.investmentTags ?? '');
    await db.execute(
      `UPDATE catalogueListings SET descriptionShort = ?, investmentTags = ? WHERE id = ?`,
      [desc ?? '', newTags, row.id]
    );
    if (desc) updated++;
    if (tagsChanged) tagChanges++;
  }));
  processed += batch.length;
  if (processed % 100 === 0 || processed === rows.length) {
    process.stdout.write(`\r  Processed: ${processed}/${rows.length} | Descriptions fetched: ${updated} | Tag changes: ${tagChanges}`);
  }
}

console.log(`\nDone!`);

// Final counts
const [counts] = await db.execute(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN investmentTags LIKE '%pos_geared%' THEN 1 ELSE 0 END) as pos_geared,
    SUM(CASE WHEN investmentTags LIKE '%dual_income%' THEN 1 ELSE 0 END) as dual_income,
    SUM(CASE WHEN investmentTags LIKE '%deceased_estate%' THEN 1 ELSE 0 END) as deceased_estate,
    SUM(CASE WHEN investmentTags LIKE '%distressed%' THEN 1 ELSE 0 END) as distressed,
    SUM(CASE WHEN investmentTags LIKE '%dev_site%' THEN 1 ELSE 0 END) as dev_site,
    SUM(CASE WHEN descriptionShort IS NOT NULL AND descriptionShort != '' THEN 1 ELSE 0 END) as has_description
  FROM catalogueListings WHERE status = 'active'
`);
console.log('\n=== FINAL COUNTS ===');
console.log(JSON.stringify(counts[0], null, 2));

await db.end();
process.exit(0);
