# RealtyAPI realestate.com.au — verified findings (probes run 2026-07-18, user's REALTY_API_KEY)

Base URL: `https://realestateau.realtyapi.io` · header `x-realtyapi-key: $REALTY_API_KEY`
All responses HTTP 200; errors come as `message: "404: ..."` with empty `detail`.

## Endpoints verified
- `GET /search/bylocation` — params: `location` (free text: "Dubbo, NSW 2830", "Mid North Coast, NSW", "NSW"), `channel` (buy|sold), `page` (30/page, `nextPage` bool, `total`), `sortType=new-desc` (WORKS — changes order to newest-first; `sort` is ignored), `propertyType` (WORKS, singular name: e.g. `land`→residential land only, `acreage`, `rural`, `house`; comma list works e.g. `house,land,acreage`; unknown names silently ignored).
  - `minLandSize`/`minLandArea`/`landSizeMin`/`property_types` DO NOT filter (silently ignored). Land-size filtering must be done client-side.
  - Response row: `listing_id`, `url`, `title`, `description`, `property_type` (house|townhouse|acreage/semi-rural|duplex/semi-detached|residential land|unit|apartment|lifestyle|cropping|mixed farming|...), `price` (display string), `land_size: {value, unit, display}` (often null), `address: {street, suburb, postcode, state, latitude, longitude, show_address}`, `main_image`, `images[]`, `beds/baths/parking`, `modified_date` (always null in tests), `agency`, NO listing date.
- `GET /details/byid` — param `listingId`. Response `detail.{...}` same shape plus:
  - `detail.is_sold`, `detail.is_buy`, `detail.channel` — but a SOLD listing (found via channel=sold) still returned `is_sold=false, channel=buy` → UNRELIABLE for sold detection. Better sold detection: listing disappears from buy-channel search + `message` "404: listing ... not found or no longer available (off-market)" for truly dead ids.
  - **Listing freshness**: `detail.details_components.summary.summary.secondaryBadges[0].description = "Added 16 hours ago"` (relative string, e.g. "Added X hours/days ago"). No ISO listed date anywhere.
- `GET /autocomplete` — `input` param; returned 0 results for "Central West, NSW" (weak; don't rely on it).

## Coverage (buy channel totals)
- NSW state-wide: **63,077** listings (vs Domain's far fewer) — 30/page ≈ 2,103 pages.
- Dubbo 2830: 266 · Mid North Coast: 3,364 · Riverina: 1,517 · Hunter Valley: 4,912.
- "Central West, NSW" resolved to something too big (209,753 — likely fell back to broader area) → region strings must be validated per-region; prefer suburb/postcode fan-out or verified region strings.

## Implications for catalogue design
- Exhaustive NSW sweep: state-wide `location=NSW&channel=buy&propertyType=house,land,acreage,rural&sortType=new-desc` paginate until `nextPage=false`; filter land-size client-side. propertyType filter cuts total to relevant subset (NSW total with house,land,acreage,rural needs verification but Dubbo cut 266→237).
- Incremental scan: `sortType=new-desc` + stop when we hit N consecutive already-known listing_ids.
- listedAt: derive from "Added X ago" badge at analysis time (firstListedAt = now - parsed offset); afterwards firstSeenAt is authoritative.
- Sold detection: nightly, for active catalogue rows not seen in current sweep, mark `missing`; confirm via details/byid message 404 → mark sold/removed.
- Rate: no hard rate limits advertised; still throttle ~4-6 concurrent.

## Cost note
- search = 1 credit/call; details/byid = 1 credit; details/byaddress = 2 credits.

## Filter-data availability (probed 2026-07-18 for false-positive filters)
- `detail.construction_status`: "new" | "established" — RELIABLE, present on all sampled rows. Best signal for new-build/new-estate exclusion (no build year anywhere).
- `detail.building_size {value, unit:"m2"}`: present on ~half of sampled rows (mostly new builds) → dwelling footprint coverage ratio = building_size / land_size, computable only when both present (store; filter treats missing as pass-through).
- Lot width/frontage: NO structured field. Appears only in free-text descriptions ("14 m frontage", "Land Width: 14 m") → parse with regex opportunistically; low coverage, treat missing as pass.
- Build year: ABSENT everywhere (no yearBuilt/year_built) → filter not implementable; construction_status covers the "new build" case.
- New-estate keywords: description + headline text available on detail rows already stored? (catalogue stores headline only) → need to store flags at analysis time: isNewBuild (construction_status=new OR keyword match), estateKeyword match on description/headline.
