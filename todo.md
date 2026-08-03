# Project TODO — NSW Subdividable Property Research System

## Phase 1: Foundation
- [x] Database schema: savedProperties (listing snapshot + MLS/zoning results + analysis, consolidated by design) and searchHistory tables
- [x] Request RealtyAPI.io API key from user (REALTY_API_KEY secret)
- [x] Verify RealtyAPI.io endpoints work with the key (Domain.com.au works; realestate.com.au subdomains not resolvable)

## Phase 2: Backend
- [x] Property search API (tRPC): search NSW listings by suburb/postcode via RealtyAPI.io
- [x] NSW Planning Portal integration: query ArcGIS Lot Size layer (Layer 4) by coordinates for Minimum Lot Size
- [x] NSW Planning Portal integration: query Land Zoning layer (Layer 2) by coordinates
- [x] Subdivision potential calculator: land size vs minimum lot size → potential lots + score
- [x] Persist analysed properties to database for saved research
- [x] Vitest unit tests for subdivision calculator
- [x] Vitest tests for property router procedures (save, listSaved, remove, auth guard)

## Phase 3: Frontend
- [x] Landing page explaining the tool
- [x] Search dashboard: suburb/postcode search with filters (price range)
- [x] Results list with analyse action per listing
- [x] Property detail view: listing info, MLS overlay result, zoning, potential lot yield
- [x] Saved properties / watchlist page
- [x] Minimum land size filter wired into search flow
- [x] Subdivision potential badges shown on result cards (bulk quick analysis)
- [x] Map view with verdict-coloured markers (grid/map toggle on Research page)
- [x] Designed empty states for Research and Watchlist pages
- [x] Live end-to-end flow test (search → analyse → quick analyse) passing against live APIs

## Phase 4: Mapping & polish
- [x] Map view of search results with markers (duplicate of Phase 3 map item — done)
- [x] Visual polish, responsive layout, empty/loading states (mobile verified at 375px)
- [x] Final checkpoint and delivery

## Phase 5: Risk layers, region search, categories (user-requested upgrade)
- [x] Research ArcGIS endpoints: bushfire prone land, biodiversity values (BVM), flood planning, heritage layers (all verified live)
- [x] Region-to-locality mapping: 12 NSW regions with verified Domain location strings (Greater Sydney = 7 sub-area fan-out)
- [x] Backend: risk layer service querying bushfire/BVM/flood/heritage by coordinates (parallel, timeout-guarded)
- [x] Backend: search by region (multi-location fan-out with de-dup) and All-NSW state scan
- [x] Backend: cash-flow vs land-only categorisation from property type + bed/bath signals
- [x] Frontend: search scope selector (suburb / region / All NSW tabs)
- [x] Frontend: enriched report card with 4 constraint layers + Spatial Viewer/RFS/Maps verification links
- [x] Frontend: category badge (Cash flow vs Land only) on cards and analysis dialog, plus filter dropdown
- [x] Vitest tests for risk layers, region catalogue, and categorisation (31 tests passing total)
- [x] Checkpoint and deliver upgraded app

## Phase 6: Ranked scans + subdivision comparables (user-requested)
- [x] Research NSW DA API (Planning Portal online DA data) for subdivision approvals near a point — verified open OnlineDA API, header-based filters, has coords + lots before/after + subdivision type
- [x] Research sold/sales price data source — RealtyAPI Domain has NO sold channel (listingType ignored); NSW Valuer General bulk PSI noted as future work
- [x] Backend: subdivision score 0–100 for ranking (verdict + lot yield + data confidence + cash-flow tiebreak)
- [x] Backend: quickAnalyse now returns score per listing (page-level ranking)
- [x] Backend: rankedScan endpoint — analyses full region/state scan server-side (concurrency-limited, capped at 60) and returns server-sorted results by score, with live router test
- [x] Backend: comparables service — nearby subdivision DAs from OnlineDA (status, lots X→Y, Torrens/Strata, distance km, cost of works), determined-first + distance sort
- [x] Frontend: "Ranked by potential" sort toggle with score badges on result cards
- [x] Frontend: "Deep scan (analyse all)" button — runs rankedScan and shows fully-analysed, score-sorted results
- [x] Frontend: comparables section in analysis report card (on-demand load per LGA)
- [x] Vitest tests for scoring, comparables, and rankedScan (39 tests passing total)
- [x] Checkpoint and deliver (e6539aab)
- [ ] Sold lot prices in comparables — RealtyAPI Domain has no sold channel (verified); requires NSW Valuer General bulk PSI integration (awaiting user go-ahead — proposed at delivery)

## Phase 8: Confirmed-subdividable-only scanning (user feedback: All NSW scan returns non-subdividable properties)
- [x] Diagnose live All-NSW scan: 60 analysed → 2 marginal + 17 UNKNOWN kept, 0 subdividable. Unknown-verdict metro houses (land=null) dominate; Sydney-heavy interleave starves rural stock; duplicate addresses appear
- [x] Default scan output = confirmed subdividable + marginal verdicts ONLY (verified live: All NSW scan now returns 17 subdividable + 4 marginal, 0 unknown — was 2 marginal + 17 unknown)
- [x] Unknown-verdict listings behind "Include unverified listings" switch (off by default)
- [x] Scan depth: cap raised 60→120; round-robin interleave across all 20 locations (was location-sequential, first-60 were 57 metro Houses); land/rural/acreage types analysed first; address-level dedupe added
- [x] Tests updated for the confirmed-only contract; 39 tests passing
- [x] Checkpoint and deliver (f60994bf)

## Phase 9: Fully public access, no login anywhere (user sharing with buyer's agent)
- [x] Research endpoints (search, rankedScan, analyse, quickAnalyse, comparables) switched to public procedures
- [x] Watchlist fully public: shared single list, save/notes/remove work anonymously (anonymous saves under shared id 0)
- [x] Search history works anonymously (shared recent searches)
- [x] UI: removed sign-in gates on Research/Watchlist/Home; header sign-in button removed (quiet sign-out only when a session exists)
- [x] Tests updated for public access contract; all 39 tests passing
- [ ] Checkpoint, verify public flow end-to-end, hand back for republish

## Phase 7: Viability-first search rework (user feedback: too many small residential houses in results)
- [x] Default minimum land size floor: Domain's landSizeMin param verified IGNORED upstream → enforced post-analysis in rankedScan, default 700 m² (user-adjustable via Min land field), unknown-area listings kept but ranked lower
- [x] Viable property types at source: propertyTypes=House,AcreageSemiRural,Rural,Land (verified tokens; apartments/units/townhouses excluded) applied to search + rankedScan
- [x] Auto-run full ranked scan on every new search (page 1) so all shown results carry real verdicts + scores
- [x] Default scan view drops not_subdividable listings (viableOnly=true server-side); scan summary toast reports analysed vs kept
- [x] Update landing page copy to reflect viability-first behaviour
- [x] Min land field prefilled to 700 m² (user-overridable); skeletons shown until ranked scan completes (no raw unanalysed flash)
- [x] Tests updated for new defaults (rankedScan viability contract: keptCount, land floor, no not_subdividable, no apartments); 39 tests passing
- [x] Checkpoint and deliver
