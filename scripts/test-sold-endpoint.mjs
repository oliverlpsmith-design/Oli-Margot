import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const KEY = process.env.REALTY_API_KEY;
const BASE = 'https://realestateau.realtyapi.io';

// Try searching for sold listings in a suburb
const suburb = 'Penrith, NSW 2750';

// Test 1: search/bylocation with channel=sold
console.log('=== Test 1: channel=sold ===');
const r1 = await fetch(`${BASE}/search/bylocation?location=${encodeURIComponent(suburb)}&channel=sold&pageSize=3`, {
  headers: { 'x-realtyapi-key': KEY }
});
const d1 = await r1.json();
console.log('Status:', r1.status);
console.log('Keys:', Object.keys(d1));
console.log('Results count:', d1?.results?.length ?? d1?.data?.length ?? 'unknown');
if (d1?.results?.[0]) {
  console.log('First result keys:', Object.keys(d1.results[0]));
  console.log('First result sample:', JSON.stringify(d1.results[0]).slice(0, 300));
}
if (d1?.data?.[0]) {
  console.log('First data keys:', Object.keys(d1.data[0]));
  console.log('First data sample:', JSON.stringify(d1.data[0]).slice(0, 300));
}
console.log('Full response (first 500):', JSON.stringify(d1).slice(0, 500));
