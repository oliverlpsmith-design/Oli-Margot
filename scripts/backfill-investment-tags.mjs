/**
 * Backfill investment tags for all existing active catalogue listings.
 * Zero API cost — classifies from stored headline + description + numeric fields.
 *
 * Run: node scripts/backfill-investment-tags.mjs
 */
import { createConnection } from 'mysql2/promise';

const DECEASED_RE = /deceased\s+estate|estate\s+of\s+the\s+late|executor[- ]managed|executor[- ]instructed|probate\s+sale|probate\s+property|estate\s+sale|estate\s+of\s+late|estate\s+liquidation|beneficiary\s+sale|executor\s+sale|selling\s+the\s+estate|estate\s+of\s+the/i;
const DUAL_INCOME_RE = /granny\s+flat|dual\s+occupancy|dual\s+income|secondary\s+dwelling|dual\s+living|in-law\s+suite|self[- ]contained|second\s+dwelling|secondary\s+suite|additional\s+dwelling|dual\s+residence|two\s+dwellings|two\s+homes|two\s+houses|two\s+units\s+on|separate\s+dwelling|detached\s+granny/i;
const DISTRESSED_RE = /mortgagee[- ]in[- ]possession|mortgagee\s+sale|bank\s+sale|bank\s+instructed|urgent\s+sale|must\s+sell|must\s+be\s+sold|below\s+market\s+value|under\s+market\s+value|forced\s+sale|distressed\s+sale|vendor\s+must\s+sell|owner\s+must\s+sell|priced\s+to\s+sell|motivated\s+seller|financial\s+hardship|receivership|court[- ]ordered\s+sale|bank\s+repossession|repossessed\s+property|price\s+slashed|drastically\s+reduced/i;
const DEV_SITE_RE = /development\s+site|development\s+opportunity|da\s+approved|development\s+approval|rezone[d]?|rezoning\s+approved|approved\s+plans|subdivision\s+approved|development\s+potential|approved\s+development|commercial\s+development|mixed\s+use\s+development|townhouse\s+development|unit\s+development|multi[- ]unit|multi[- ]dwelling/i;

function classifyListing(row) {
  const tags = [];
  // description is not stored in catalogueListings; headline-only for DB backfill
  const text = (row.headline ?? '').toLowerCase();
  if (DECEASED_RE.test(text)) tags.push('deceased_estate');
  if (DUAL_INCOME_RE.test(text)) tags.push('dual_income');
  if (DISTRESSED_RE.test(text)) tags.push('distressed');
  if (DEV_SITE_RE.test(text)) tags.push('dev_site');
  const price = row.priceNumeric !== null ? Number(row.priceNumeric) : null;
  const beds = row.bedrooms ?? 0;
  if (price !== null && price > 0 && price < 600_000 && beds >= 3) {
    tags.push('pos_geared');
  }
  return tags.join('|');
}

const conn = await createConnection(process.env.DATABASE_URL);

// Fetch all active listings in batches
const BATCH = 500;
let offset = 0;
let totalUpdated = 0;
const tagCounts = {};

console.log('Starting investment tag backfill...');

for (;;) {
  const [rows] = await conn.query(
    `SELECT id, headline, priceNumeric, bedrooms, zoneCode, propertyType
     FROM catalogueListings
     WHERE status = 'active'
     LIMIT ? OFFSET ?`,
    [BATCH, offset]
  );

  if (rows.length === 0) break;

  // Build bulk update cases
  const updates = rows.map(row => ({
    id: row.id,
    tags: classifyListing(row),
  }));

  // Execute as a single bulk UPDATE using CASE WHEN
  const ids = updates.map(u => u.id);
  const caseExpr = updates
    .map(u => `WHEN id = ${u.id} THEN ${conn.escape(u.tags)}`)
    .join('\n    ');

  await conn.query(
    `UPDATE catalogueListings
     SET investmentTags = CASE
       ${caseExpr}
       ELSE investmentTags
     END
     WHERE id IN (${ids.join(',')})`,
  );

  // Count tags for summary
  updates.forEach(u => {
    if (!u.tags) return;
    u.tags.split('|').forEach(t => {
      tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    });
  });

  totalUpdated += rows.length;
  process.stdout.write(`\rProcessed ${totalUpdated} listings...`);
  offset += BATCH;
}

console.log(`\n\nBackfill complete. ${totalUpdated} listings processed.`);
console.log('\nTag counts:');
Object.entries(tagCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([tag, count]) => console.log(`  ${tag}: ${count}`));

await conn.end();
