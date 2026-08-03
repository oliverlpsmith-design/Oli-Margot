# Phase 2/3 implementation state (session pytjteg9)

## MAP BATCH PROGRESS (Jul 18 ~10:25 UTC)
DONE:
- server: mapCatalogue() in db.ts (filter-aware, lat/lng NOT NULL, cap 2500, popup fields only); catalogue.map publicProcedure in routers.ts. Verified via curl: default → rows OK; riverina+minScore80 → 126 rows with coords.
- client/src/components/CatalogueMap.tsx: wraps template MapView (Google Maps proxy). Score-coloured circle markers (>=75 emerald, 50-74 amber, <50 red), InfoWindow popups (address/verdict/score/lots/price/$per-lot/land/DOM/listing link, HTML-escaped), NSW centre (-32.5,147) zoom 6, fitBounds once per dataset, legend. Exports markerColour/buildPopupHtml/MapListing for tests.
- Catalogue.tsx REWORKED to draft/applied FilterState: DEFAULT_FILTERS, filtersEqual, isDirty, applyFilters(), resetFilters(). All filter controls edit draft only; "Apply filters" (primary when dirty) + Reset + amber not-applied hint; sort still immediate. browse query enabled only list mode; catalogue.map query enabled only map mode. List/Map toggle in toolbar. Map results header w/ count + cap note.
- Screenshots: desktop full-page + mobile OK (list mode). TS clean. Stale savedSearchAlerts console error predates 10:00 restart — ignore.
## MAP PROXY ORIGIN FINDING (Jul 18 10:26)
Maps proxy script (forge.manus.ai/v1/maps/proxy) returns 401 "project origin not matched" from the DEV preview origin (3000-...manus.computer) but 200 from the production origin (nswpropres-efznl8q4.manus.space). So the blank map in dev preview is an environment restriction, NOT a code bug. Template Map.tsx is used as-is. Verify map on production after checkpoint (auto-publish). Add a graceful loading/fallback note in CatalogueMap if script fails.
REMAINING: vitest for mapCatalogue + marker colour/popup helpers; pnpm test (was 62/62); interactive map verify via browser if possible; mark todos; checkpoint + deliver.

## FINAL VERIFY (Jul 18 10:31)
Checkpoint 65a7964e saved (map view + deferred filters), 66/66 tests. Todos all [x].
Production at nswpropres-efznl8q4.manus.space/catalogue was still serving the PREVIOUS deploy right after checkpoint (old "Filter" button, no List/Map toggle) — auto-publish deploy takes a few minutes. Need to re-check production shows "Apply filters" + List/Map toggle, then click Map on production to confirm markers render (maps proxy 200 on production origin, 401 on dev preview origin — env restriction, fallback banner added in CatalogueMap).
Then deliver final message with manus-webdev://65a7964e.

## ZONING FILTER (Jul 18 13:10) — new request, in progress
DONE:
- db.ts: `zones?: string[]` on CatalogueBrowseFilters; `inArray(catalogueListings.zoneCode, filters.zones)` cond in BOTH browseCatalogue and mapCatalogue; new `listZoneCodes()` helper (active rows, non-null zoneCode, grouped w/ counts desc).
- routers.ts: `zones: z.array(z.string().max(8)).max(40).optional()` added to browse/export/map inputs; new `catalogue.zoneCodes` publicProcedure; `listZoneCodes` imported.
- Catalogue.tsx: zones threaded through FilterState/DEFAULT_FILTERS/filtersEqual/filters/savedSearchFilters; zoning multi-select (Popover+Command combobox, house style, counts shown, Clear option, toggleDraftZone keeps sorted) placed in practicality row next to Build year; new-builds toggle col-span reduced to fit 6-col row. Verified via screenshot — renders fine.
- Zone data: 33 distinct codes on active rows; top: R2 5060, R1 3348, RU1 1085, R5 749, R3 693, C4 602, RU5 543, RU2 362, C3 311, RU4 237. 2322 rows have NULL zoneCode (excluded when filter set — documented in tooltip).
REMAINING:
1. vitest: add zones tests to server/catalogue.test.ts (browse w/ zones only returns those codes; map w/ zones; zoneCodes returns non-empty list with count fields). Run pnpm test (was 66/66).
2. Interactively verify picker + Apply flow via browser on dev preview (click zoning, pick RU2/R2, Apply, confirm results chips).
3. Mark todo-pytjteg9.md zoning items [x]; checkpoint; deliver.
NOTE: saved searches store filters JSON as-is → zones round-trips automatically via savedSearchFilters.
NOTE: stale console error about savedSearchAlerts module is old (10:00Z, pre-restart) — not a real issue; tsc clean.

### ZONING GAP FIXES (Jul 18 ~13:20)
- FOUND + FIXED: savedSearch.create filters zod schema was MISSING `zones` — client sends zones in savedSearchFilters and zod would have silently stripped/rejected it. Added `zones: z.array(z.string().max(8)).max(40).optional()` to routers.ts savedSearch.create input.
- Added catalogue.test.ts spec "export respects the zones filter" (export delegates to browseCatalogue so rows carry zoneCode).
- TODO: saved-search zones round-trip spec in savedSearch.test.ts, then pnpm test green output, mark todos, checkpoint.

Read REA_API_NOTES.md first — verified RealtyAPI realestate.com.au behaviour lives there.

## CURRENT BATCH (catalogue-first + investor copy + 3 new features) — 2026-07-18 ~10am
DONE:
- Homepage rewritten for investors: 8 feature cards + CAPABILITIES chips row in Home.tsx; badge "Built for subdivision investors"; heading "Weeks of deal-hunting, compressed into minutes"; CTAs -> /catalogue. Full-page screenshot verified.
- Nav catalogue-first (AppShell.tsx): NAV = Catalogue, Watchlist; secondary muted "Live search" -> /research.
- Schema: catalogueListings.priceNumeric decimal(14,2) (migration drizzle/0004_bitter_mojo.sql APPLIED). Backfilled via SQL from single-price priceDisplay rows (range/auction/POA left NULL; <10k nulled).
- realtyApi.ts: parsePriceNumeric() exported ($1,200,000 / $1.2m / $950k / range->low end; auction/POA->null; <10k->null).
- sweep.ts analyseAndStore now stores priceNumeric (String()) for new rows.
- db.ts: sort "price_per_lot" added to browseCatalogue (CASE null-last + ratio asc + score desc); exportCatalogue(filters, cap=2000); savedSearches helpers: listSavedSearches, createSavedSearch (cap 10/user), deleteSavedSearch, listAllSavedSearchesWithOwners (joins users for email), touchSavedSearchNotified, findNewMatchesForFilters(filters, since, cap=20) — filters rows by firstSeenAt > since client-side.
- schema: savedSearches table (id, userId, name, filters JSON-text, createdAt, lastNotifiedAt) — migration 0005 APPLIED + idx_savedSearches_user.
- routers.ts: catalogue.browse + catalogue.export accept sort enum incl "price_per_lot"; catalogue.export = un-paged (cap 2000) same filters; savedSearch router (list/create/delete, protectedProcedure, zod filter object mirrors browse minus status/sort).
ALERT DESIGN DECISION (told user via info message): no per-user email service built in — notifyOwner (server/_core/notification.ts) reaches OWNER only. Implementing: (a) in-app alerts — nightly scan matches new listings per saved search, records matches; user sees "new matches" on visit; (b) owner gets nightly summary notification; (c) email-ready dispatch structure for later Resend/SendGrid key.
BATCH NOW DONE (all code written):
- Migration 0006 APPLIED: savedSearches.lastMatchCount int NOT NULL default 0 + lastMatchesJson text.
- server/services/savedSearchAlerts.ts: dispatchSavedSearchAlerts() — per saved search JSON.parse filters, findNewMatchesForFilters(since = lastNotifiedAt ?? now-24h), recordSavedSearchMatches(id, count, snapshotJson), owner summary via notifyOwner; deliverEmail() no-op seam for future Resend/SendGrid.
- scheduledScan.ts: after incremental slice, if progress.done -> dispatchSavedSearchAlerts() (errors captured, response includes alerts).
- db.ts: recordSavedSearchMatches added.
- Catalogue.tsx: SortKey + "price_per_lot" option "Best value ($/lot)"; pricePerLot()/formatAud()/buildCatalogueCsv() exported for tests; Export CSV button (utils.catalogue.export.fetch -> client Blob download w/ BOM); Save-this-search Dialog (name input, savedSearchFilters memo) + signed-out CTA startLogin(); saved-searches strip w/ BellRing + "N new" badge + delete. $/lot line on cards (emerald, Coins icon). Screenshot verified (signed-in admin view OK, 15,933 active).
- server/savedSearch.test.ts: parsePriceNumeric cases, price_per_lot ordering (nulls last), export cap/minScore, savedSearch anonymous rejection.
REMAINING: pnpm test (expect 54 prior + ~8 new green); final full-page screenshots home+catalogue; verify homepage chips (CSV export + $/lot now true); mark todo; checkpoint + deliver. NOTE dev console error 'Cannot find module savedSearchAlerts' at 10:00:14 was stale/mid-patch — server restarted cleanly at 10:02:48.

---

## MAP VIEW BATCH (current request, after checkpoint 20184e74)

Coordinate coverage verified via SQL: active subdividable+marginal rows = 2,082, ALL 2,082 have lat/lng (catalogueListings.latitude/longitude decimal(10,7) — populated by sweep from REA geocodes). No geocoding backfill needed.

Mapping approach decision: project template has pre-built `client/src/components/Map.tsx` — Google Maps with proxy auth (per template docs: "MapView component with onMapReady callback... works directly in the browser"). Use it rather than adding Leaflet dep. Marker colouring by score: green >= 80, amber 50-79, red < 50 (verdict-consistent since browse defaults to confirmed verdicts). Use google.maps.marker or classic Marker w/ SVG circle icon; InfoWindow popup with address, verdict, score, land size, price, $/lot, DOM, listing link.

Plan:
1. db.ts: mapCatalogue(filters) — same WHERE builder as browseCatalogue but un-paged (cap 2500), select only id, listingId, latitude, longitude, address, suburb, verdict, score, landAreaSqm, priceDisplay, priceNumeric, potentialLots, listedAt, firstSeenAt, listingUrl. Reuse buildCatalogueWhere if exists (check db.ts — browse + export already share filter builder).
2. routers.ts: catalogue.map publicProcedure, same input schema as export (no sort needed).
3. Catalogue.tsx: view state "list" | "map" toggle (List/Map icons Lucide LayoutGrid / MapIcon) right of sort select or above results; when map view: render <CatalogueMap rows={mapQuery.data} /> — new component client/src/components/CatalogueMap.tsx wrapping template Map.tsx MapView; NSW centre { lat: -32.5, lng: 147 } zoom 6; markers coloured by score; InfoWindow content built with DOM (address, score badge, land, price, $/lot, dom label, link). Map query only enabled when view === "map" (trpc catalogue.map.useQuery(savedSearchFilters, { enabled: view === "map" })).
4. Pagination hidden in map view; result count still shown ("N listings plotted").
5. Test: vitest for catalogue.map (respects filters, returns coords, cap). Screenshot both views. Suite currently 62/62.
Sweep/cron note: nightly Heartbeat cron task nightly-scan (uid gMMuPUoz6V8YWKfu56tZyJ) hits POST /api/scheduled/nightlyScan, cron-only auth via sdk.authenticateRequest isCron. scheduledScan.ts currently ONLY runs one slice; alert dispatch must fire when progress.done (incremental finished within slice) OR always after slice with done check.
TODO in this batch (before checkpoint):
1. sweep.ts analyseAndStore: store priceNumeric for new rows (add parsePriceNumeric helper, export from realtyApi.ts; formats: "$1,200,000", "От/offers over", ranges -> NULL or low end? DECISION: single $ figure only, ranges use LOW end, must be >= 10000).
2. db.ts: CatalogueBrowseFilters.sort add "price_per_lot" — ORDER BY (priceNumeric/potentialLots) ASC with NULLs last (use CASE WHEN priceNumeric IS NULL OR potentialLots IS NULL OR potentialLots<1 THEN 1 ELSE 0 END, then ratio asc). Also select-all returns priceNumeric automatically.
3. routers.ts catalogue.browse sort enum + "price_per_lot". Add catalogue.exportCsv query: same filter input, returns up to 2000 rows (no page), client builds CSV Blob. (CSV built client-side from JSON to avoid superjson/binary issues.)
4. Catalogue.tsx: sort option "Best value ($/lot)"; show $/lot line on cards when computable; "Export CSV" button (uses utils.catalogue.exportCsv.fetch with current filters, builds Blob, downloads catalogue-export.csv).
5. Saved searches: table savedSearches (id, userId FK users.id, name varchar 120, filters json, createdAt, lastNotifiedAt timestamp nullable). CRUD tRPC (protected): savedSearch.list/create/delete (cap 10/user). UI: "Save this search" button on Catalogue (requires login), managed list (maybe small dialog). Nightly alert dispatch: in scheduledScan.ts after incremental run completes — for each saved search, browseCatalogue with its filters + firstSeenAt > (lastNotifiedAt ?? run start-24h), if matches>0 send email via notification API. CHECK /home/ubuntu/skills/webdev-owner-notifications/SKILL.md — likely owner-only notifications; if per-user email is impossible, alerts go to the user via... fallback: store userEmail from users.email and use notification API? MUST read the skill before promising per-user email.
6. Tests for: price parsing, price_per_lot ordering, savedSearch matching. Suite was 54/54.
7. Homepage gap check: chips claim CSV export + price-per-lot; both must ship this batch. Also audit remaining copy for agent wording.
Note: dev server console shows stale ERR_MODULE_NOT_FOUND for server/scheduledScan from 23:52 yesterday — file exists; error predates restart; ignore unless it reappears fresh.

## Done
- `server/services/realtyApi.ts` REWRITTEN for realestate.com.au (base `https://realestateau.realtyapi.io`, header `x-realtyapi-key`). Exports preserved: searchListings, searchListingsMulti, getListingDetail, autocompleteLocation, categoriseListing, parseLandAreaSqm, VIABLE_PROPERTY_TYPES (now `house,land,acreage,rural`). NEW exports: parseAddedBadge (relative "Added X ago" → Date), toReaPropertyTypes (legacy Domain token mapping), isListingOffMarket (details/byid message contains "404"). ListingSummary now also has `listingUrl`; ListingDetail has `addedDisplay`, `listedAtEstimate`, `daysOnMarket`. searchListings accepts channel + sortType:"new-desc"; land floor enforced client-side. TS check: 0 errors.
- `drizzle/schema.ts`: added `catalogueListings` (unique listingId, planning fields, verdict/score/category/status(active|sold|removed), listedAt/firstSeenAt/lastSeenAt/soldDetectedAt) and `scanRuns` (mode full_sweep|incremental, status, cursor json, counters, error, startedAt/finishedAt). Migration `drizzle/0002_dry_sleeper.sql` APPLIED to DB + indexes idx_cat_status_verdict_score, idx_cat_status_listedAt, idx_cat_region.
- Heartbeat SDK already present: `server/_core/heartbeat.ts`, sdk.ts has CRON_OPEN_ID_PREFIX (no legacy patches needed).
- Server bootstrap `server/_core/index.ts`: NO `/api/scheduled/*` route yet — must mount explicitly before Vite fallthrough.

## Remaining plan

### PROGRESS UPDATE (after smoke test)
DONE since last update:
- server/db.ts: all catalogue helpers added (getKnownListingIds, upsertCatalogueListing, touchListingsSeen, listStaleActiveListings, markListingsSold, browseCatalogue w/ filters+sort score|newest|score_newest, getCatalogueStats, getLatestFinds, createScanRun/updateScanRun/getLatestScanRun/getRunningScanRun).
- server/services/sweep.ts: time-boxed resumable engine (runSweepSlice) — full_sweep + incremental modes, cursor persisted in scanRuns.cursor, sold detection via isListingOffMarket in incremental Phase B, analysis concurrency 6, known-page early stop for incremental.
- server/scheduledScan.ts + mounted app.post("/api/scheduled/nightlyScan") in _core/index.ts (cron-only auth).
- routers.ts: catalogue router — browse (public, default verdicts subdividable+marginal), stats, latestFinds, scanStatus, runScan (admin-only, protectedProcedure).
- scripts/run-sweep.mjs (slice loop driver) + scripts/inspect-catalogue.mts (DB peek).
- Smoke test PASSED: 30s slice stored 30 rows (Box Hill/Marsden Park, zoning+MLS populated, verdicts computed). scanRun id=1 running with cursor.

STILL TO DO:
1. Client: Catalogue.tsx page + route /catalogue + AppShell nav + admin Run-scan strip (loop until done). Days-on-market from listedAt. Filters: region (property.regions gives NSW_REGIONS ids? no — need catalogue regions — reuse NSW_REGIONS via property.regions), score min, days on market, category, verdict incl. "all/unknown", search, sort.
2. Home.tsx hero ticker (catalogue.latestFinds) — hide when empty.
3. Tests: sweep unit tests (parseAddedBadge done in service; add catalogue browse test w/ real DB?, keep suite green), pnpm test all green.
4. Delete probe-rea.mjs; keep scripts/. Update todo-pytjteg9.md. Checkpoint.
5. DONE — Heartbeat cron created: name=nightly-scan, task_uid=gMMuPUoz6V8YWKfu56tZyJ, cron "0 0 16 * * *" (2am AEST) → /api/scheduled/nightlyScan. NOTE: fires against production; deployment happens automatically on checkpoint (auto-publish enabled).
6. Full sweep RUNNING in background shell session "sweep": `node scripts/run-sweep.mjs full`, log /tmp/sweep.log.
6. Run initial full sweep to completion from sandbox: `node scripts/run-sweep.mjs full` (resumes scanRun 1; ~63k listings state-wide BUT viable property types subset smaller; watch RealtyAPI credit usage — each analysed listing = 1 search-page share + 1 details call + 2 free NSW planning calls). NOTE: sweep must finish scanRun 1 (mode full_sweep) before incremental cron fires, engine handles supersede.

### Original plan below

### UI reference notes (for Catalogue.tsx build)

### STATUS at checkpoint time (Phase 2/3 build done, sweep in flight)
- Tests 45/45 green (10 files) incl. new server/catalogue.test.ts. TS clean.
- /catalogue page live in dev with filters+sort+pagination+admin scan strip. Home hero ticker working (screenshot verified).
- Full sweep running in background session "sweep" (log /tmp/sweep.log): scanRun id=1, ~570 added at last check, 2/20 units done. Each slice ~80s. Estimated total viable listings across 20 units unknown; MUST let it finish and verify.
- REA pagination caveat: REA caps results ~1000 per query (33 pages x 30). MAX_PAGES_PER_UNIT=80 exceeds that, so effective cap is the API's own. If a location unit has >1000 viable listings, tail is unreachable without query splitting (e.g. price bands) — potential future enhancement; regions were designed as multiple smaller location strings to mitigate.
- Heartbeat cron nightly-scan (task_uid gMMuPUoz6V8YWKfu56tZyJ) will hit PRODUCTION /api/scheduled/nightlyScan at 16:00 UTC — must save checkpoint (auto-publish) so prod has the endpoint. Endpoint 403s non-cron callers (verified).
- probe-rea.mjs deleted. scripts/run-sweep.mjs + scripts/inspect-catalogue.mts remain.

### Sweep sizing + fixes (checkpoint 58db3b1f)
- Sized every unit via scripts/size-sweep.mts (uses res.total): Western Sydney 5,988; Hunter Valley 4,230; Mid North Coast 2,734; Northern Rivers 2,586; Central Coast 1,941; TOTAL viable NSW ≈ 27,843 across 34 units (after region fix).
- FIXED: "Central West, NSW" and "New England, NSW"/"North West, NSW" location strings do NOT resolve on REA — they fell back to Australia-wide search (total=164,586). Replaced with 17 verified town/postcode units in shared/regions.ts (all verified: Orange 287, Bathurst 254, Dubbo 257, Tamworth 307, etc.).
- FIXED: sweep resume bug (`|| true` advanced unitIndex on time-budget exit → skipped listings). Now only advances when the unit truly finished.
- FIXED: MAX_PAGES_PER_UNIT 80 → 250 (7,500/unit, above largest unit).
- Added NSW-only guard in analyseAndStore (listing.address.state !== NSW → skip). Existing 2,041 rows verified clean (all NSW, all postcodes 2xxx).
- Sweep progress at last check: unitIndex 5/34, ~2,041 added. All from greater-sydney region so far. Verdict split: 68 subdividable, 39 marginal, 1,031 not, 903 unknown.
- At ~100 listings/80s slice, remaining ~26k listings ≈ 6 hours of background running. run-sweep.mjs MAX_SLICES=200 default → 200*80s ≈ 4.4h per invocation; may need re-launch. Sweep session: "sweep", log /tmp/sweep.log.
- REMAINING: (1) let sweep finish & verify counts via scripts/cursor-check.mts, (2) final checkpoint + delivery. NOTE: sweep runs old code until its current node process restarts per-slice — each slice spawns fresh tsx, so fixes apply from next slice automatically.

## False-positive filters (in progress, 2026-07-18 ~3am)
DONE so far:
- Schema: catalogueListings + buildingSizeSqm, coveragePct, frontageM, isNewBuild, hasEstateKeywords (migration 0003 applied via webdev_execute_sql).
- realtyApi.ts: ListingDetail now exposes constructionStatus + buildingSizeSqm; added parseFrontageM() and hasNewEstateKeywords() exports.
- sweep.ts analyseAndStore: computes/stores all five new fields (coveragePct = building/land*100, 1dp).
- db.ts CatalogueBrowseFilters + browseCatalogue: minLandAreaSqm (strict — excludes unknown land area), minFrontageM (lenient — null passes), maxCoveragePct (lenient), excludeNewBuilds (isNewBuild=false only).
- routers.ts catalogue.browse input: minLandAreaSqm (int 0..1M), minFrontageM (0..200), maxCoveragePct (1..100), excludeNewBuilds (bool).
REMAINING:
- Catalogue.tsx UI: filter card is a grid (py-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6) of shadcn Selects, each Select onValueChange calls setX + resetPage(); state via useState at top of component (regionId, verdictFilter, category, minScore, maxDom, search/searchDraft, sort, page); filters useMemo builds trpc input. ADD: minLand Select (Any/700/1000/1500/2000/4000 sqm), "More filters" row with: excludeNewBuilds Switch toggle, minFrontage Select (Any/10/12/15/18/20m, note "only excludes known-narrow"), maxCoverage Select (Any/25/35/50%), plus DISABLED "Build year" select with tooltip/badge "data not available from realestate.com.au".
- Backfill: existing ~6k catalogue rows lack new fields (all null/false). Options: leave null (filters lenient except land size which is already stored) — isNewBuild=false default means excludeNewBuilds won't exclude un-reanalysed rows. Note this in UI copy? Or run backfill script for active subdividable/marginal rows only (~100-300 details calls). DECISION: backfill only verdict IN (subdividable, marginal) actives via scripts/backfill-filters.mts to keep credit cost low; the rest get fields organically if re-analysed.
- Tests: extend server/catalogue.test.ts with browse filter tests (minLandAreaSqm strict, lenient null-pass for frontage/coverage, excludeNewBuilds) + unit tests for parseFrontageM/hasNewEstateKeywords.
- Screenshot /catalogue, run pnpm test, checkpoint.
Sweep progress at ~2:47am: cursor unitIndex 8/34 (~5.9k added). Sweep uses updated analyseAndStore from next tsx slice onwards (each slice = fresh process).
- App.tsx routes: "/", "/research", "/watchlist", NotFound fallback. Add `<Route path="/catalogue" component={Catalogue} />` and import.
- AppShell.tsx NAV array: [{href:"/research",label:"Research",icon:Search},{href:"/watchlist",...Bookmark}] — add {href:"/catalogue",label:"Catalogue",icon:Database or LayoutGrid} FIRST in nav. Header brand "NSW Subdivision Scout" links "/". Footer disclaimer exists.
- Research.tsx card pattern: Card overflow-hidden flex flex-col; image h-44 object-cover with absolute Badges top-2 left/right (verdict + Score); CardContent pt-4 flex-1 flex flex-col gap-2 (address font-medium, price text-primary font-semibold, meta row text-xs text-muted-foreground with BedDouble/Bath/Car/MapPin icons h-3.5, min-lot line, mt-auto action Button size sm).
- Research.tsx has VERDICT_META and CATEGORY_META maps (label + className badge colours) near top of file — reuse identical classes in Catalogue for consistency. Check lines ~30-60 of Research.tsx for exact values.
- trpc client: import { trpc } from "@/lib/trpc"; queries used like trpc.property.regions.useQuery(). New: trpc.catalogue.browse.useQuery(filters), trpc.catalogue.stats.useQuery(), trpc.catalogue.latestFinds.useQuery({limit:8}), trpc.catalogue.runScan.useMutation(), trpc.catalogue.scanStatus.useQuery().
- useAuth from "@/_core/hooks/useAuth" gives user?.role for admin strip.
- browseCatalogue returns { rows: CatalogueListing[], total, page, pageSize }; row fields: listingId,address,suburb,postcode,regionId,latitude,longitude,propertyType,priceDisplay,bedrooms,bathrooms,landAreaSqm(str),minLotSizeSqm(str),minLotSizeLabel,zoneCode,lgaName,potentialLots,verdict,score,category,status,listingUrl,imageUrl,headline,listedAt(Date),firstSeenAt,lastSeenAt,soldDetectedAt.
- Days on market: compute client-side from listedAt ?? firstSeenAt → Math.floor((now - d)/86400000), display "Listed today/X days ago". superjson keeps Dates.
- NSW_REGIONS ids for region filter come from trpc.property.regions.useQuery() → [{id,label,locationCount}].
- Home.tsx hero: dark slate hero section; ticker should slot under the hero stat strip; use catalogue.latestFinds; hide if empty. Home hero has "Powered by NSW Planning Portal data" strip with live stat (props from trpc.property.stats).
1. `server/db.ts`: catalogue helpers — upsertCatalogueListing, getCatalogueListingIds (Set of known ids), touchLastSeen (bulk update lastSeenAt), markMissingAsSold, browseCatalogue (filters: regionId, minScore, maxDaysOnMarket, category, verdict, sort score|newest, pagination), catalogueStats, createScanRun/updateScanRun/completeScanRun, latestFinds(limit) for ticker.
2. `server/services/sweep.ts`: sweep engine.
   - Scan unit = region (shared/regions.ts NSW_REGIONS, 12 regions with Domain-style location strings that ALSO resolve on REA — verified Mid North Coast/Riverina/Hunter Valley OK, but "Central West, NSW" resolved too broad (209k) → validate each region string, maybe use suburb fan-out for Central West).
   - Full sweep: per region location, page channel=buy propertyType=house,land,acreage,rural sortType=new-desc until nextPage=false (cap pages ~40/region/run), analyse NEW ids only (skip known), concurrency 8: getListingDetail + getMinimumLotSize + getZoning → analyseSubdivisionPotential + scoreSubdivisionPotential (server/services/subdivision.ts), store row (listedAt = listedAtEstimate ?? now).
   - Incremental: same but stop paging a location after hitting a full page of already-known ids; then sold-detection: active rows with lastSeenAt < run start in swept regions → isListingOffMarket() → mark sold (status=sold, soldDetectedAt) or touch lastSeen.
   - MUST be resumable/idempotent: 2-min handler budget → process a bounded slice per invocation (e.g. 1 region per call or time-boxed 90s), persist cursor in scanRuns.cursor, chain via self-POST or rely on nightly cadence + manual trigger loops.
3. `/api/scheduled/nightlyScan` Express handler in `server/_core/index.ts` (auth: sdk.authenticateRequest → user.isCron; ALSO allow admin/owner user for manual trigger via tRPC admin.scan.trigger which calls the same engine inline or via fetch). Cron create via `manus-heartbeat create --name nightly-scan --cron "0 0 16 * * *" --path /api/scheduled/nightlyScan` (16:00 UTC = 2am AEST) AFTER deploy (site must be deployed; workflow: checkpoint → deploy → create cron).
4. tRPC: catalogue.browse (public), catalogue.stats, catalogue.latestFinds, catalogue.runScan (admin-only manual trigger, time-boxed slice, returns progress so UI can loop "Continue sweep"), catalogue.scanStatus.
5. Client: new page `client/src/pages/Catalogue.tsx` (route /catalogue in App.tsx, nav in AppShell): full catalogue view, default sort score desc + newest, filters region/score/daysOnMarket/category/verdict, days-on-market badge ("Listed X days ago"), status badges, pagination. Admin-only "Run scan" controls on a small admin strip (visible when useAuth().user?.role === 'admin').
6. Home.tsx hero: latest-finds ticker (catalogue.latestFinds query, marquee-style vertical rotate, show suburb + score + verdict + days-on-market). Graceful hide when catalogue empty.
7. Tests: sweep engine unit tests (parseAddedBadge, incremental skip logic w/ mocked API), catalogue.browse filter test, keep 40 existing tests passing. Delete probe-rea.mjs before checkpoint.
8. After checkpoint+deploy: run initial full sweep via manual trigger loop from sandbox (curl the production endpoint or run a local script hitting the engine directly with DATABASE_URL prod). Simpler: local script `node run-sweep.mjs` using tsx to import sweep engine directly (env from .env) — sandbox DB == production DB (same DATABASE_URL) so catalogue fills production data.

## Key constraints
- Do NOT break existing property.search/rankedScan/analyse/watchlist flows (they now run on REA via the rewritten service; rankedScan default landFloor 700 still applies; regions strings unchanged).
- searchHistory/savedProperties tables untouched.
- UI: existing Research.tsx untouched except maybe link to catalogue.
- Old Domain propertyTypes tokens ("House,AcreageSemiRural,Rural,Land") flow through toReaPropertyTypes → "house,acreage,rural,land" — client sends propertyTypes only via VIABLE default, filter UI values need checking in Research.tsx (opportunity types select).
- realtyApiKey.test.ts references old service? CHECK server/realtyApiKey.test.ts + riskAndRegions.test.ts + subdivision.test.ts + e2e.flow.test.ts + rankedComparables.test.ts still pass (they import categoriseListing/parseLandAreaSqm — unchanged signatures).

## Zoning filter batch — 13:15 update
- zoneCode added to mapCatalogue select; optional zoneCode on MapListing type. pnpm test 69/69 PASS.
- Browser verify: zoning picker opens with all 33 codes + counts (R2 5,060 top).
- Next: select RU1+RU2, Escape to close, Apply filters, confirm cards show only those zones. Then todos [x], checkpoint, deliver.
- 13:16 browser verify PASS: selected RU1+RU2 in picker (trigger shows "RU1, RU2"), dirty-state banner appeared, Apply filters ran → 197 listings (from 2,082), all visible cards show Zone RU1. Zoning filter works end-to-end with deferred apply.
- Remaining: mark todos [x], checkpoint, deliver.
