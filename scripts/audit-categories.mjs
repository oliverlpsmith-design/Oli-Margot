import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.query(`
  SELECT 
    SUM(CASE WHEN LOWER(headline) REGEXP 'deceased|estate of the|executor|probate' THEN 1 ELSE 0 END) as deceased_count,
    SUM(CASE WHEN LOWER(headline) REGEXP 'granny flat|dual occupancy|dual income|secondary dwelling|dual living' THEN 1 ELSE 0 END) as dual_income_count,
    SUM(CASE WHEN LOWER(headline) REGEXP 'mortgagee|bank sale|urgent sale|must sell' THEN 1 ELSE 0 END) as distressed_count,
    SUM(CASE WHEN LOWER(headline) REGEXP 'development site|da approved|development approval' THEN 1 ELSE 0 END) as dev_site_count,
    SUM(CASE WHEN priceNumeric IS NOT NULL AND priceNumeric < 600000 AND bedrooms >= 3 THEN 1 ELSE 0 END) as pos_geared_candidates,
    COUNT(*) as total_active
  FROM catalogueListings WHERE status = 'active'
`);
console.log('Category keyword counts from existing data:');
console.table(rows[0]);

// Sample some deceased estate headlines
const [deceased] = await conn.query(`
  SELECT headline, suburb, priceDisplay FROM catalogueListings 
  WHERE status='active' AND LOWER(headline) REGEXP 'deceased|estate of the|executor|probate'
  LIMIT 5
`);
console.log('\nSample deceased estate headlines:');
deceased.forEach(r => console.log(' -', r.headline, '|', r.suburb, '|', r.priceDisplay));

await conn.end();
