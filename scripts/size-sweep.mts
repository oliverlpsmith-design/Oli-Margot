/** Estimate total viable listings per sweep unit. Usage: npx tsx scripts/size-sweep.mts */
import "dotenv/config";
import { NSW_REGIONS } from "../shared/regions";
import { searchListings, VIABLE_PROPERTY_TYPES } from "../server/services/realtyApi";

let grand = 0;
for (const region of NSW_REGIONS) {
  for (const location of region.locations) {
    try {
      const res = await searchListings({
        location,
        page: 1,
        propertyTypes: VIABLE_PROPERTY_TYPES,
        sortType: "new-desc",
      });
      const total = res.total || res.searchResults.length;
      grand += total;
      console.log(`${region.id} · ${location}: ${total}`);
    } catch (e) {
      console.log(`${region.id} · ${location}: ERROR ${(e as Error).message}`);
    }
  }
}
console.log(`TOTAL viable listings across units: ${grand}`);
