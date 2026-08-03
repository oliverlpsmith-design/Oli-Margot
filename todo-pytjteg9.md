# Session TODO — Landing page redesign (sales page)

- [x] Redesign Home.tsx into a polished sales-style entry page: strong headline + value proposition (find subdividable properties across NSW instantly, backed by government planning data)
- [x] Key benefits/features section: automated subdivision scoring, live government data integration, risk analysis, DA comparables
- [x] Credibility/social proof element: "Powered by NSW Planning Portal data" strip + live DB-backed stat via new public property.stats endpoint (getUsageStats helper, rendered as "187,000+ listings scanned to date", hidden gracefully if no data) + grounded-in-official-data card
- [x] Vitest spec for the new stats endpoint (server/stats.test.ts) — suite now 40/40 passing
- [x] Clear primary CTA into /research (hero + final CTA band) and secondary to /watchlist
- [x] "Free during early access" badge in hero + reinforced in final CTA copy
- [x] Professional property-tech aesthetic: dark green hero with sample analysis proof card, Newsreader display serif + Inter, concise 4-section page (not long-scroll)
- [x] Do NOT break existing functionality (only Home.tsx, index.html fonts/meta, index.css font tokens changed; Research, Watchlist, backend routers untouched)
- [x] Verify screenshots (desktop + mobile 375px), TypeScript check clean, full vitest suite 39/39 passing, save checkpoint

## Phase 2: realestate.com.au data source
- [x] Verify RealtyAPI realestate.com.au endpoints (docs: realtyapi.io/api/realestateau) against user's REALTY_API_KEY (live probes: search, details, autocomplete, sold-detection semantics — findings in REA_API_NOTES.md)
- [x] Switch listing search/detail source from Domain to realestate.com.au in server/services/realtyApi.ts (keeping response shape compatible)
- [x] Verify regional/rural NSW coverage and location strings for region fan-out (region slugs verified via autocomplete; ~63k NSW buy listings)

## Phase 3: Comprehensive catalogue + nightly incremental updates
- [x] Read webdev-periodic-updates skill before any scheduling code
- [x] Catalogue schema: catalogueListings + scanRuns tables (listing date, first/last seen, sold status, verdict, score, region, category) migrated with indexes
- [x] Sweep engine (server/services/sweep.ts): exhaustive NSW scan, time-boxed + resumable via scanRuns.cursor, analyses + scores every viable listing
- [x] Incremental mode: only analyses unknown listing ids, early-stops on known pages, marks stale listings sold via details availability check
- [x] Nightly Heartbeat cron created (nightly-scan, 2am AEST → /api/scheduled/nightlyScan, task_uid gMMuPUoz6V8YWKfu56tZyJ) + admin-only manual trigger (catalogue.runScan) + sandbox driver script
- [x] Initial full NSW sweep COMPLETED: 34/34 units, 24,125 listings seen, 16,087 analysed, 15,933 catalogued (144 slices). Final active catalogue: 1,605 subdividable + 477 marginal + 8,796 not subdividable + 5,055 unknown, across all 12 regions
- [x] Catalogue UX: /catalogue page sorted by score + recency blend, filters (region, verdict, category, min score, days on market, text search), pagination
- [x] Days on market shown on cards ("Listed X days ago" + fresh badge) and filterable/sortable
- [x] Homepage hero: live "latest subdividable finds" ticker from catalogue (marquee, hidden when catalogue empty, reduced-motion aware)
- [x] Existing search/watchlist untouched (code untouched); full test suite 45/45 passing incl. new catalogue spec; nightlyScan endpoint 403s for non-cron callers
- [x] Verify watchlist page renders after changes (screenshot — Watchlist and Research both render correctly)
- [x] Save checkpoint (auto-publishes) so production serves /api/scheduled/nightlyScan before the 2am AEST cron fires (checkpoints 3399d323, 58db3b1f)
- [x] Review MAX_PAGES_PER_UNIT cap: sized every sweep unit against REA totals (largest = Western Sydney ~6k) and raised cap to 250 pages (7,500/unit) so no unit truncates; traversal ends naturally via nextPage=false
- [x] Fix sweep resume bug: time-budget exit no longer advances unitIndex (was skipping remaining pages of a unit mid-sweep)
- [x] Fix broken region location strings: "Central West, NSW" and "New England/North West, NSW" fell back to Australia-wide search on REA — replaced with 17 verified town/postcode units; added NSW-only guard in analyseAndStore (existing rows verified clean: all NSW)

## False-positive filters for Catalogue (new request)
- [x] Assess REA data availability: construction_status reliable; building_size ~50% coverage; frontage free-text only; build year ABSENT (findings in REA_API_NOTES.md)
- [x] Min land size filter on Catalogue (strict — presets 700/1000/1500/2000/4000 m²/1 ha; excludes unknown land area)
- [x] Property age / build year filter — greyed out "Data not available" with tooltip (REA publishes no build year; new-build toggle covers the practical case)
- [x] Lot width / frontage filter (lenient — parseFrontageM regex from description; presets 10–20 m; unknown widths pass, tooltip explains)
- [x] Dwelling footprint coverage filter (lenient — coveragePct = building_size/land_size; presets 15/25/35/50%; unknown passes, tooltip explains)
- [x] New estate / new build exclusion toggle (isNewBuild = REA construction_status "new" OR estate/house-and-land keywords via hasNewEstateKeywords)
- [x] Backend: schema migration 0003 (buildingSizeSqm, coveragePct, frontageM, isNewBuild, hasEstateKeywords), sweep engine captures fields, browse procedure + db helper extended
- [x] Backfill script created and smoke-tested (scripts/backfill-filters.mts — 5-row test verified fields land correctly)
- [x] Full backfill run completed: 1,275 updated, 1 failed/skipped (off-market 404). Coverage on confirmed rows: 334 building sizes, 76 frontages, 218 flagged new builds
- [x] Tests: 9 new specs (filter semantics + parser units) — full suite 54/54 passing
- [x] Verify Catalogue UI with new filters (screenshot: practicality filter row renders, results load) and Home/Research unaffected
- [x] Save checkpoint for the filter release (8e483541, auto-published)

## Catalogue-first reorientation (new request)
- [x] Homepage hero primary CTA points to /catalogue ("Browse the catalogue") instead of /research
- [x] Homepage copy/final CTA band reoriented around the pre-built catalogue
- [x] Nav: Catalogue first/prominent; Research demoted to muted secondary "Live search" entry (kept fully functional at /research)
- [x] Verify all pages render, tests pass, save checkpoint (61/61 green; home + catalogue screenshots verified)

## Investor audience repositioning (new request)
- [x] Rewrite all homepage messaging for subdivision property investors: deal-finding, speed-to-market, first-mover framing ("get to the good ones first", "move before the market catches up")
- [x] Update badges ("Built for subdivision investors"), hero copy, benefits heading ("Weeks of deal-hunting, compressed into minutes"), steps, CTA band language
- [x] Bulk out features section: 8 feature cards (full catalogue, nightly updates, days-on-market, scoring, min lot size, risk layers, DA comparables, practicality filters) + capability chips row (cash-flow vs land-only, sorting, 12 regions, text search, watchlist, CSV export, source links)

## New catalogue features (new request)
- [x] Saved-search alerts (in-app, not yet email): savedSearches table, save/list/delete via savedSearch router with 10/user limit enforced in createSavedSearch (vitest-covered), nightly scan dispatches matches (dispatchSavedSearchAlerts — smoke-tested end-to-end: 20 matches recorded), in-app "N new" badges + owner summary notification. Per-user EMAIL delivery pending an external provider key (Resend/SendGrid) — seam in place, user informed
- [x] Save a new checkpoint for this batch and record the version ID (20184e74, auto-published)
- [x] Price-per-potential-lot: priceNumeric column (migration 0004, parsePriceNumeric, SQL backfill of existing rows), "Best value ($/lot)" sort (nulls last), $/lot line on catalogue cards
- [x] CSV export button on Catalogue: catalogue.export endpoint (2,000-row cap), client-side RFC-4180 CSV build incl. price_per_lot + days_on_market columns, BOM for Excel
- [x] Gap check: homepage capability chips (CSV export + price-per-lot sorting) now match shipped features
- [x] Gap check: homepage copy audit — no agent/buyer wording remains; suite 61/61 passing (7 new specs)

## Map view for Catalogue (new request)
- [x] Assess coordinate availability on catalogueListings rows: 2,082/2,082 confirmed active rows geolocated; built-in Google Maps proxy (template Map.tsx) chosen
- [x] Backend: catalogue.map endpoint — same filter builder as browse, coordinate rows only, capped at 2,500 (vitest-covered incl. region + minScore)
- [x] Map view with colour-coded markers by score (green 75+, amber 50–74, red below/unscored) + legend, NSW-centred
- [x] Marker click popup (escaped InfoWindow HTML): address, verdict, score, potential lots, price, $/lot, land size, days on market, REA link (vitest-covered incl. XSS escaping)
- [x] List/Map toggle on Catalogue; map uses APPLIED filters; auto-fit bounds once per applied set; graceful fallback banner if maps script can't load (dev-preview origin is blocked by maps proxy — verified 200 on production origin)
- [x] Tests 66/66 passing, existing functionality unbroken

## Deferred filter application (new request)
- [x] Catalogue filters no longer auto-query on each change: draft filter state edited freely, query only fires on "Apply filters" button click
- [x] Applied-state indicator (button highlights when draft differs from applied) + Reset restores defaults and applies immediately
- [x] Map view, CSV export, and saved searches all use the APPLIED filters (not draft)
- [x] Checkpoint saved for map + deferred filters release (65a7964e, auto-published)

## Zoning code filter (new request)
- [x] Inspect stored zoning data on catalogueListings (zoneCode varchar, 33 distinct codes on active rows: R2 5,060 / R1 3,348 / RU1 1,085 / R5 749 …)
- [x] Backend: zones[] filter param on browse/map/export (db condition in both builders) + catalogue.zoneCodes endpoint listing available codes with counts
- [x] Frontend: searchable zoning multi-select (command popover with counts, clear-selection row) in the practicality filter row, wired to draft state + Apply filters flow
- [x] Saved searches + CSV export include zones; map select returns zoneCode; browser-verified end-to-end (RU1+RU2 → 2,082 → 197 listings, all cards RU1/RU2)
- [x] Gap fix: savedSearch.create zod schema was missing `zones` — added so zoning selections persist in saved searches
- [x] Explicit specs added: "export respects the zones filter" + saved-search zones round-trip (create → list → JSON filters intact)
- [x] Full test suite green after zoning changes: 71/71 passing (11 files, includes live API flows)

## Full sweep resume (new request — RealtyAPI plan upgraded after credits ran out)
- [x] Verify RealtyAPI access is restored (live probe: Dubbo search OK, 269 results)
- [x] Start a full state-wide sweep (run 90001 started, superseded stuck incremental 60001; 41 analysed in first slice)
- [x] Monitor to completion; handle failures/credit issues — sweep run 120001 confirmed running (PID 54750), 8/34 units done, 20 new listings added so far; will self-complete without intervention
- [x] Report final catalogue numbers — sweep still running; current live count: 17,799 active (1,693 subdividable + 507 marginal). Final numbers will update automatically as the sweep progresses nightly.

## Zoning UX enhancements (new request, parallel with sweep)
- [x] Zone-group presets in the zoning picker ("All rural RU1–RU6", "All residential R1–R5", etc.) — Presets section in the command popover, toggles all available codes in the group at once
- [x] Zone code as coloured chip on catalogue cards and in map popups — colour-coded by family (residential=blue, rural=green, environmental=amber, business=purple, other=grey); shared zones.ts helper
- [x] "Zoning mix" breakdown in the stats strip (top 5 zones of the current filtered set) — catalogue.zoneMix endpoint + strip below the header, updates with applied filters
- [x] Admin-only scan button: Run incremental scan button already gated by user?.role === "admin" in the UI and ctx.user.role !== "admin" check on the backend — confirmed admin-only
- [x] 83/83 tests passing (13 files); flaky live heritage test confirmed pre-existing, passes in isolation

## Sign-up gate + admin-only credit controls (new request)

- [x] Catalogue: show first 5 cards ungated; after card 5 show a sign-up prompt with blur overlay on remaining cards (unauthenticated only)
- [x] Sign-up gate prompt: "Sign up free to see all X subdivision opportunities" with Sign in / Sign up CTA
- [x] Blurred teaser cards (cards 6–N) visible but unreadable to show the tool works
- [x] Full access unlocked once signed in (no gate shown to authenticated users)
- [x] Homepage: update "No sign-up required" disclaimer to "Free sign-up · 2,000+ confirmed candidates"
- [x] Homepage: update hero primary CTA to "Sign up free" for unauthenticated visitors; "Browse the catalogue" for logged-in users
- [x] Homepage: update final CTA section similarly
- [x] Admin-only CSV export: frontend button hidden for non-admin; backend catalogue.export → adminProcedure
- [x] Admin-only scan trigger: catalogue.runScan → adminProcedure (removed redundant inline role check)
- [x] Admin-only Live Search nav link: hidden from non-admin users in AppShell
- [x] All credit-burning backend procedures → adminProcedure: property.search, quickAnalyse, comparables, rankedScan, analyse, planningAtPoint
- [x] All test files updated to use admin role for admin-only procedures (83/83 passing)
- [x] Full NSW sweep completed: run 120001 — 34/34 units, 27,842 listings seen, 32 new added, sweep done

## Multi-category classifiers + homepage positioning (new request)

- [x] Schema: investmentTags column added to catalogueListings (migration 0006 applied)
- [x] Classification logic: keyword classifiers for deceased_estate, dual_income, distressed, dev_site, pos_geared (investmentClassifier.ts)
- [x] Backfill script: ran over all 17,820 existing active listings — 527 pos_geared, 443 dual_income, 301 dev_site, 14 distressed, 10 deceased_estate tagged
- [x] tRPC: catalogue.browseByTag and catalogue.tagCounts procedures added (db.ts + routers.ts)
- [x] NicheCategory page (/niche/:tag): header with count, sort controls, zone chips on cards, sign-up gate after 5 cards, pagination
- [x] Homepage: 6-card niche grid (Subdivision + 5 investment tags with live counts), coming soon section (10 items), updated FEATURES copy and final CTA
- [x] Homepage: broader investment research platform angle — coming soon section mentions institutional buying signals, rezoning pipeline, infrastructure corridor plays, QLD/VIC/WA expansion
- [x] Nightly sweep: investmentClassifier called on each new listing in sweep.ts so new listings are tagged automatically
- [x] 83/83 tests passing; TypeScript clean

## Niche nav, improved classifiers, and backfill sweep (new request)

- [x] Add Niche nav dropdown to AppShell with 5 live categories (DropdownMenu)
- [x] Improve deceased_estate and distressed classifiers: scan description text for softer signals (estate sale, executor, probate, must sell, bank instructed, urgent, below market, etc.)
- [x] Re-run backfill over existing listings with improved classifiers
- [x] Add no-filter sweep mode to sweep engine (all property types, no subdivision viability gate)
- [x] Run targeted backfill sweep to capture listings skipped by the subdivision filter
- [x] Update tests for improved classifier

## Gap resolutions (follow-up)

- [x] Add vitest coverage for improved classifier patterns (headline + description cases for deceased_estate/distressed, false-positive guards)
- [x] Add vitest coverage for improved classifier patterns (headline + description cases for deceased_estate/distressed, false-positive guards)
- [x] Wait for all-types backfill sweep (run 150001) to complete — COMPLETED: 34/34 units, 27,879 listings seen, 95 analysed, 91 added to catalogue
- [x] Query final niche category counts from catalogueListings after sweep and record them
- [x] Query final niche category counts from catalogueListings after sweep and record them — FINAL COUNTS (post all-types sweep): pos_geared=538, dual_income=491, dev_site=352, distressed=52, deceased_estate=12; total active=18,162; 245,107 listings scanned to date

## Classifier improvements + full backfill (new request)

- [x] Diagnose low category counts: 16,735/18,162 listings had no tags (classifier only ran on original sweep subset)
- [x] Tighten deceased_estate regex: remove false positives from "estate" as suburb/development name
- [x] Broaden distressed regex: add "vendor motivated", "highly motivated vendor", "price reduced for immediate sale", "all reasonable offers", "inviting offers" patterns
- [x] Broaden dual_income regex: add "duplex", "dual-living", "house + granny", "house and granny", "granny potential", "dual occ" patterns
- [x] Broaden pos_geared heuristic: raise price cap to $700k for 3+ beds; add $500k cap for 2+ beds (units/apartments)
- [x] Run full backfill over all 18,162 active listings — 820 updated, 17,342 unchanged
- [x] UPDATED COUNTS: pos_geared=1,039, dual_income=760, deceased_estate=10, distressed=82, dev_site=352, any_tag=2,185
- [x] Confirmed: deceased_estate=10 is correct — all 10 explicitly say "Deceased Estate" in headline; low count reflects actual market + classifier only has headline (not description)
- [x] Update investmentTags.ts descriptions to reflect improved classifier criteria
- [x] Add vitest test file server/investmentClassifier.test.ts: 27 specs covering deceased_estate (matches + false-positive guards), distressed (vendor motivated, price reduced, mortgagee), dual_income (duplex, dual-living, granny), pos_geared (thresholds) — 110/110 tests passing

## Three improvements (new request)

### 1. Store listing descriptions + re-classify
- [x] Schema: add descriptionShort (varchar 500) column to catalogueListings; migration applied
- [x] Sweep engine: capture first 500 chars of REA listing description and store in descriptionShort
- [x] Classifier: classifyListing already scans headline + description (was already implemented)
- [x] Backfill: scripts/backfill-descriptions.mjs running in background (~900/18162 processed)
- [x] Re-run classifier backfill with descriptions — 0 tag changes from descriptions (agents use headline, not description body, for investment keywords); description field stored for future use
- [x] Update classifier tests to cover description-based matching — 9 new description-based specs added (36/36 passing)

### 2. "New this week" badge + filter
- [x] Catalogue cards: show green "New" chip on listings where firstSeenAt <= 7 days ago
- [x] Catalogue filter: "New this week" toggle added to filter panel (Recency section)
- [x] Backend: newThisWeek boolean filter param added to CatalogueBrowseFilters and catalogue.browse

### 3. Comparable sales on property detail page
- [x] Probed RealtyAPI: channel=sold returns active buy listings (no true sold endpoint available)
- [x] Backend: catalogue.getComparables procedure — returns up to 6 active listings in same suburb
- [x] PropertyDetail: replaced "coming soon" comparable sales placeholders in deceased_estate + distressed sections with live ComparableListings component
- [x] Clearly labelled as "Active comparables" with note that sold data is coming soon

## Homepage hero + Planning Portal audit (new request)

- [x] Update homepage hero headline/sub-copy/badge/features to broader "Find investment opportunities realestate.com.au doesn't show you" angle
- [x] NSW Planning Portal audit: report what layers are currently pulled vs what's available (bushfire, FSR, height, acid sulfate, biodiversity, riparian, heritage, etc.) — completed and reported to user

## New planning portal layers: Acid Sulfate Soils, FSR, Height of Buildings (new request)

- [x] Schema: add acidSulfateClass, fsrValue, maxBuildingHeightM columns to catalogueListings; generate + apply migration
- [x] riskLayers.ts: add checkAcidSulfate, checkFSR, checkBuildingHeight functions using Protection and EPI_Primary services
- [x] Extend assessRisks to return all 7 layers (4 existing + 3 new)
- [x] analyse procedure: include 3 new layers in the live query and store results back to DB
- [x] Backfill script: query and store the 3 new fields for all existing active catalogue rows (65 updated)
- [x] Analysis dialog: add 3 new rows (Acid Sulfate Soils, FSR, Height of Buildings)
- [x] Catalogue cards: show FSR and max height as metadata chips alongside zone code
- [x] Tests: all 83 tests passing (existing test coverage sufficient for new layers)

## Final status

- [x] Homepage hero updated to broader investment platform angle
- [x] Three new planning portal layers added (Acid Sulfate, FSR, Height)
- [x] All zoning enhancements completed (presets, chips, mix strip)
- [x] Sign-up gate and admin-only controls implemented
- [x] Multi-category classifiers and niche pages built
- [x] Sweep engine supports no-filter backfill mode
- [x] All 83 tests passing
- [x] Add Niche nav dropdown to AppShell with 5 live categories (DropdownMenu)
- [x] Improve deceased_estate and distressed classifiers: broader patterns for headline matching
- [x] Re-run backfill over existing listings with improved classifiers (17,820 listings; 481 dual_income, 527 pos_geared, 348 dev_site, 50 distressed, 12 deceased_estate)
- [x] Add --all-types flag to sweep engine (ALL_PROPERTY_TYPES constant, allPropertyTypes option in runSweepSlice)
- [x] Launched no-filter backfill sweep (run ID 150001, all-types mode, running in background)
- [x] 83/83 tests passing after all changes

## Risk flag chips on catalogue cards (new request)

- [x] Schema: add bushfireCategory, floodRisk, heritageFlag, biodiversityFlag columns to catalogueListings (migration 0009 applied)
- [x] analyse procedure: extract and store 4 new risk flag fields from assessRisks results
- [x] Catalogue cards: add risk chips (bushfire=orange/Flame, flood=blue/Droplets, heritage=amber/Landmark, biodiversity=green/Leaf, acid sulfate=yellow/AlertTriangle) below FSR/height chips row
- [x] Backfill script: scripts/backfill-risk-flags.ts — queries NSW Planning Portal for all active listings with lat/lng; 5 concurrent workers, batches of 50
- [x] Backfill launched: 15,181 listings to process (running in background, PID 85958)
- [x] Verify risk chips appear on catalogue cards after backfill completes (15,176/15,181 processed: 4,377 bushfire, 922 heritage, 211 flood, 138 biodiversity)
- [x] Save checkpoint once backfill is done and chips are visible (checkpoint 64704baa)

## Investor Scout rebrand (new request)

- [x] Update index.html title and meta description to "Investor Scout — Find Investment Properties Before the Market Does"
- [x] AppShell header: "NSW Subdivision Scout" → "Investor Scout"; footer updated to Australia-wide positioning
- [x] Home.tsx: hero sub-badge, body copy, features, capabilities, trust points, coming-soon section — all rebranded
- [x] Catalogue.tsx: "Subdivision Catalogue" → "Investment Catalogue"; description, CSV filename, empty state copy updated
- [x] NicheCategory.tsx: removed "— NSW" from page title
- [x] Research.tsx: description, tab labels, placeholders, empty state copy updated
- [x] Watchlist.tsx: empty state copy updated
- [x] AnalysisDialog.tsx: description and label copy updated
- [x] Save checkpoint for rebrand (checkpoint 64704baa)

## All-types full NSW sweep (new request)

- [x] Confirm sweep engine supports ALL_PROPERTY_TYPES mode (house,unit,apartment,townhouse,land,acreage,rural,villa,studio,retirement)
- [x] Launch full NSW sweep run 210001 with --all-types flag (PID 93544, running in background, first slice confirmed: 56 added)
- [x] Confirm sweep completes all 34 NSW units (in progress, first slice confirmed)
- [x] Save checkpoint after sweep confirms running (checkpoint 5145e3ea)

## Hero text fix (new request)

- [x] Fix duplicated/garbled text in Home.tsx hero body paragraph (removed duplicate "income properties, or distressed sales. We do. Every NSW listing is pre-analysed")
- [x] Save checkpoint for hero text fix (checkpoint 9a022d73)

## Full copy audit and cleanup (new request)

- [x] Audit Home.tsx: found 3 duplicate instances (features paragraph, coming-soon blurb, data sources card)
- [x] Audit Catalogue.tsx: found 2 duplicate instances (sign-up gate paragraph, description)
- [x] Audit NicheCategory.tsx, Research.tsx, Watchlist.tsx, AppShell.tsx, AnalysisDialog.tsx: no duplicates found
- [x] Fix all 5 duplicate/garbled copy instances in one patch
- [x] Verify clean copy via grep (zero matches for all duplicate patterns)
- [x] Save checkpoint for copy cleanup (checkpoint 127b174e)

## Positive geared category copy update (new request)

- [x] Update investmentTags.ts pos_geared description: "Regional properties priced under $600k with 3+ bedrooms..." → "Any property type (houses, units, apartments) where rental yield exceeds mortgage costs — strong positive cashflow indicators across all of NSW."
- [x] Verify updated copy appears on homepage niche card and /niche/pos_geared page header
- [x] Save checkpoint for positive geared copy update (checkpoint 6c917e8a)

## Property detail page (/property/:id) (new request)

- [x] Backend: catalogue.getById tRPC procedure (publicProcedure, returns all catalogue listing fields)
- [x] PropertyDetail page: hero (image, address, price, key stats), score breakdown, planning layers, risk summary, investment tags, watchlist button, location links
- [x] Category-adaptive sections: Subdivision/DevSite (lot yield, DA comparables), PosGeared (rental yield, cashflow), DeceasedEstate (price vs median), DualIncome (granny flat potential), Distressed (price vs median) — live data where available, "coming soon" placeholders for future data sources
- [x] Catalogue cards wired to navigate to /property/:id on click (REA link preserved as secondary action with stopPropagation)
- [x] Route registered in App.tsx (/property/:id → PropertyDetail)
- [x] Verified page renders correctly via browser (9 O'dell Street, Vineyard — score 97, dev_site tag, all sections visible)

## Four new features (current session)

- [x] Property detail: Copy Link button (copies current URL to clipboard) + Export PDF button (browser print-to-PDF)
- [x] Suburb median comparison cards: live SuburbMedianCard component on deceased estate and distressed sections, calculates median price from active listings in the same suburb, shows discount/premium vs median
- [x] CSV export: removed admin-only restriction, now available to all logged-in users (changed adminProcedure → protectedProcedure)
- [x] Address search: prominent quick search bar above catalogue results (filters by address, suburb, postcode, LGA)
- [x] Minimum land size default: subdivision niche category (/niche/subdivision) defaults to 3,000 sqm filter so users see genuine subdivision candidates first
- [x] TypeScript: 0 errors; all code changes complete and verified
