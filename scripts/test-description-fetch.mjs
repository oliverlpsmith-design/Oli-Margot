import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const REALTY_API_KEY = process.env.REALTY_API_KEY;
console.log('Key present:', !!REALTY_API_KEY, REALTY_API_KEY?.slice(0, 8));

const db = await createConnection(process.env.DATABASE_URL);
const [rows] = await db.execute('SELECT listingId FROM catalogueListings WHERE status="active" LIMIT 3');
console.log('Sample IDs:', rows.map(r => r.listingId));

const id = rows[0].listingId;
const res = await fetch(`https://realestateau.realtyapi.io/details/byid?id=${id}`, {
  headers: { 'x-realtyapi-key': REALTY_API_KEY }
});
console.log('Status:', res.status);
const data = await res.json();
const topKeys = Object.keys(data ?? {});
console.log('Top-level keys:', topKeys);
const inner = data?.data ?? data;
console.log('Inner keys:', Object.keys(inner ?? {}));
// Print the detail sub-object
const detail = data?.detail ?? data?.data ?? data;
console.log('detail keys:', Object.keys(detail ?? {}));
const desc = detail?.description ?? detail?.listingDescription ?? detail?.summary ?? detail?.body;
console.log('Description (first 200):', typeof desc === 'string' ? desc.slice(0, 200) : desc);
// Print raw JSON for inspection
console.log('Raw (first 500):', JSON.stringify(data).slice(0, 500));

await db.end();
