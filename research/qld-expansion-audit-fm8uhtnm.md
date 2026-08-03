# Investor Scout QLD Expansion — Current-State Audit

## Scope audited

This audit covers the current multi-step catalogue pipeline, RealtyAPI client, NSW search-unit registry, deterministic category classifiers, planning/risk adapters, database schema, authenticated procedures, nightly Heartbeat callback, catalogue filters, map behavior, property-detail planning presentation, and shared methodology copy. It records the NSW baseline that must remain stable while QLD support is added.

## Search registry and RealtyAPI behavior

The canonical registry is `shared/regions.ts`. It currently contains **12 NSW region groups and 34 RealtyAPI location strings**. Greater Sydney contributes seven units; Central West contributes nine town units; New England and North West contributes eight town units; the remaining groups contribute ten units. The configuration comments still refer to Domain even though the runtime client uses RealtyAPI/realestate.com.au.

The RealtyAPI client uses `https://realestateau.realtyapi.io`, authenticates with `x-realtyapi-key`, queries `/search/bylocation`, and fetches details from `/details/byid`. Each search-unit page is one RealtyAPI request. Each newly discovered listing normally incurs one details request. Sold/off-market reconciliation also uses `/details/byid`. Listing identifiers and normalized addresses are deduplicated when a multi-location interactive search is used.

## Sweep and scheduler baseline

The nightly callback is already implemented as an authenticated Manus Heartbeat endpoint at `POST /api/scheduled/nightlyScan`. It runs an 85-second resumable incremental slice and does not rely on an always-on worker.

The sweep engine is NSW-bound in four structural places. It builds units only from `NSW_REGIONS`; its `ScanUnit` contains `regionId` and `location` but no state; it rejects any listing whose advertised state is not NSW; and it persists every accepted listing with `state: "NSW"`.

The incremental behavior is suitable to retain. It uses a persisted unit/page cursor, sorts RealtyAPI results newest-first, skips analysis for all known listing IDs, touches known rows as seen, and stops a unit after two consecutive all-known pages. It never re-analyzes an already-known listing during normal scanning. After traversal, it checks up to 150 stale active listings per slice through RealtyAPI details and marks confirmed off-market rows sold.

The current scan cursor is positional (`unitIndex`, `page`). Adding or reordering units while a scan is running can change what that cursor points to. The QLD implementation therefore needs a stable unit registry and a deployment-safe cursor transition or versioned cursor.

## Planning and spatial-data contract

The NSW sweep directly imports `getMinimumLotSize` and `getZoning` from `nswPlanning.ts` and `checkBushfire`, `checkFlood`, and `checkFSR` from `riskLayers.ts`. It has no state-neutral planning provider abstraction.

The database already stores `state`, `regionId`, `minLotSizeSqm`, `minLotSizeLabel`, `zoneCode`, `lgaName`, `fsrValue`, `maxBuildingHeightM`, `bushfireCategory`, `bushfireStatus`, `floodRisk`, `floodStatus`, `heritageFlag`, `biodiversityFlag`, and `acidSulfateClass`. However, `zoneCode` is only 16 characters, which is not sufficient for QLD planning-zone names such as “Low Density Residential”. The catalogue has no durable planning-source URL, source layer, capture timestamp, planning-scheme/version, normalized zone family, council-rule identifier, rule confidence, rule effective date, or explicit manual-review reason.

The existing NSW risk adapter can query seven planning/risk results, including biodiversity, heritage, acid sulfate, building height, and FSR. The nightly sweep currently calls and persists only zoning, minimum lot size, bushfire, flood, and FSR. It does not call or populate building height, heritage, biodiversity, or acid-sulfate results during catalogue ingestion, despite those fields being displayed on the property page. The QLD work should not repeat that mismatch or present an absent lookup as a clear result.

## Classifier assumptions

`investmentClassifier.ts` and `subdivision.ts` receive no state, council, planning-scheme, zone-family, or rule-confidence input. Their planning gates are NSW-specific:

| Classifier | Current planning gate |
|---|---|
| Subdivision | Only NSW `R1–R5` and `RU1–RU6`; arithmetic uses one mapped minimum lot size; frontage thresholds are statewide 12 m / 15 m screens. |
| Dual income / granny flat | Listing signal plus at least 450 m² and NSW `R1–R5`. |
| Development site | Explicit development evidence plus NSW `R1–R5`, `E1–E5`, or `MU1`, then residual-land-value feasibility. |
| Positive geared | Listing rent and deterministic finance model; no state-specific planning gate. |
| Deceased estate | Explicit legal/campaign language; state-neutral. |
| Distressed / mortgagee | Explicit possession, court, lender, receiver, or insolvency language; state-neutral. |

The current zone normalizer extracts short NSW Standard Instrument codes only. A QLD zone name would normalize to null and fail the planning gates. For QLD, subdivision and planning-dependent tags must distinguish “rule disproves potential” from “authoritative rule unavailable”. Missing QLD minimum-lot or council-rule evidence must remain `unknown`/manual review rather than becoming an automatic positive.

## Data access and authorization

RealtyAPI autocomplete, live search, quick planning analysis, DA comparables, ranked scans, single-listing analysis, arbitrary-point planning checks, manual catalogue scans, and AI analyst runs are server-side administrator procedures. Public catalogue browsing reads only persisted database rows.

The CSV catalogue export is currently a `protectedProcedure`, not an `adminProcedure`. Although it reads the local catalogue rather than RealtyAPI, this conflicts with the user’s explicit requirement that CSV export remain admin-only and should be corrected in the implementation phase.

## Catalogue and UI baseline

The catalogue already follows the required deferred-filter pattern: users edit `draft` filters and only the `applied` filters drive queries after the Apply/Search action. This is the correct place to add a draft/applied state selector.

The server filter contract and SQL builders have `regionId` but no `state`. State must be added consistently to browse, map, zoning mix, export, saved searches, saved-search alerts, and any count/stat endpoints. Zone-code lists and zone-mix queries are currently global; without state scoping, NSW code presets and QLD zone names would be mixed.

The catalogue map response has no state field and defaults to an NSW center. The shared zone-family helper and presets understand only NSW short codes. The property-detail page already displays a listing’s stored state in its address, but its planning section, zone descriptions, due-diligence wording, and Spatial Viewer link are hard-coded to NSW. Global footer, homepage, research page, category descriptions, methodology text, agent-pick labels, and map fallbacks also claim NSW-only coverage or NSW planning semantics.

## Required architectural direction

The safest design is a state-neutral `PlanningAssessment` contract backed by explicit NSW and QLD providers. Raw jurisdiction values should be preserved, while normalized fields drive presentation and conservative classifier gates. QLD subdivision rules must be council- and planning-scheme-aware, source-linked, effective-dated, and capable of returning an explicit `unknown`/manual-review result. Search units must carry stable IDs and state metadata, and the scan cursor must remain resumable across the NSW+QLD registry transition.
