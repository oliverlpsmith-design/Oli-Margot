import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const db = await createConnection(process.env.DATABASE_URL);

// 1. Coverage stats
const [coverage] = await db.execute(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN headline IS NOT NULL AND headline != '' THEN 1 ELSE 0 END) as has_headline,
    SUM(CASE WHEN investmentTags IS NOT NULL AND investmentTags != '' THEN 1 ELSE 0 END) as has_tags,
    SUM(CASE WHEN investmentTags IS NULL OR investmentTags = '' THEN 1 ELSE 0 END) as no_tags,
    SUM(CASE WHEN investmentTags LIKE '%pos_geared%' THEN 1 ELSE 0 END) as pos_geared,
    SUM(CASE WHEN investmentTags LIKE '%dual_income%' THEN 1 ELSE 0 END) as dual_income,
    SUM(CASE WHEN investmentTags LIKE '%deceased_estate%' THEN 1 ELSE 0 END) as deceased_estate,
    SUM(CASE WHEN investmentTags LIKE '%distressed%' THEN 1 ELSE 0 END) as distressed,
    SUM(CASE WHEN investmentTags LIKE '%dev_site%' THEN 1 ELSE 0 END) as dev_site
  FROM catalogueListings WHERE status = 'active'
`);
console.log('=== COVERAGE STATS ===');
console.log(JSON.stringify(coverage[0], null, 2));

// 2. Sample headlines for deceased estate keywords
const [deceasedSamples] = await db.execute(`
  SELECT id, headline, investmentTags, priceDisplay
  FROM catalogueListings 
  WHERE status = 'active' 
    AND (
      headline LIKE '%estate%' OR headline LIKE '%executor%' OR headline LIKE '%probate%'
      OR headline LIKE '%deceased%'
    )
  LIMIT 20
`);
console.log('\n=== POTENTIAL DECEASED ESTATE MATCHES ===');
console.log(deceasedSamples.map(r => `[${r.investmentTags || 'UNTAGGED'}] ${r.headline}`).join('\n'));

// 3. Sample headlines for distressed keywords
const [distressedSamples] = await db.execute(`
  SELECT id, headline, investmentTags, priceDisplay
  FROM catalogueListings 
  WHERE status = 'active' 
    AND (
      headline LIKE '%urgent%' OR headline LIKE '%must sell%' OR headline LIKE '%below market%'
      OR headline LIKE '%reduced%' OR headline LIKE '%motivated%' OR headline LIKE '%priced to%'
      OR headline LIKE '%mortgagee%' OR headline LIKE '%bank sale%'
    )
  LIMIT 20
`);
console.log('\n=== POTENTIAL DISTRESSED MATCHES ===');
console.log(distressedSamples.map(r => `[${r.investmentTags || 'UNTAGGED'}] ${r.headline}`).join('\n'));

// 4. Pos-geared: listings under $600k with 3+ beds that are NOT tagged
const [posGearedMissed] = await db.execute(`
  SELECT COUNT(*) as cnt
  FROM catalogueListings 
  WHERE status = 'active' 
    AND priceNumeric IS NOT NULL
    AND priceNumeric > 0
    AND priceNumeric < 600000
    AND bedrooms >= 3
    AND (investmentTags IS NULL OR investmentTags NOT LIKE '%pos_geared%')
`);
console.log('\n=== POS_GEARED MISSED (price<600k + 3+ beds, not tagged) ===');
console.log(JSON.stringify(posGearedMissed[0], null, 2));

// 5. Price stats
const [priceStats] = await db.execute(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN priceNumeric IS NOT NULL AND priceNumeric > 0 THEN 1 ELSE 0 END) as has_price,
    SUM(CASE WHEN priceNumeric IS NULL OR priceNumeric = 0 THEN 1 ELSE 0 END) as no_price,
    SUM(CASE WHEN priceNumeric > 0 AND priceNumeric < 600000 THEN 1 ELSE 0 END) as under_600k,
    SUM(CASE WHEN priceNumeric > 0 AND priceNumeric < 600000 AND bedrooms >= 3 THEN 1 ELSE 0 END) as under_600k_3beds
  FROM catalogueListings WHERE status = 'active'
`);
console.log('\n=== PRICE STATS ===');
console.log(JSON.stringify(priceStats[0], null, 2));

// 6. Dual income - check what's being missed
const [dualSamples] = await db.execute(`
  SELECT id, headline, investmentTags
  FROM catalogueListings 
  WHERE status = 'active' 
    AND (
      headline LIKE '%dual%' OR headline LIKE '%granny%' OR headline LIKE '%secondary%'
      OR headline LIKE '%in-law%' OR headline LIKE '%self-contained%' OR headline LIKE '%2 homes%'
      OR headline LIKE '%two homes%' OR headline LIKE '%two dwellings%' OR headline LIKE '%duplex%'
    )
  LIMIT 20
`);
console.log('\n=== POTENTIAL DUAL INCOME MATCHES ===');
console.log(dualSamples.map(r => `[${r.investmentTags || 'UNTAGGED'}] ${r.headline}`).join('\n'));

await db.end();
process.exit(0);
