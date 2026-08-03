# Key research findings (saved for reference)

## User context
- User is a growth marketer; friend is a buyer's agent specialising in subdividable properties in NSW.
- User has RealtyAPI.io Pro plan key (20,000 req/mo, refreshes Jul 25 2026), user named "Oliver", key starts with `rt_ea...`.
- Secret stored as REALTY_API_KEY (validated, works against domain.realtyapi.io).
- User insists RealtyAPI has realestate.com.au data "100%" — my probes of rea./realestate. subdomains failed (fetch failed = DNS no such host). Domain.com.au endpoints work. Assessment doc delivered earlier concluded realtyapi.io has no realestate.com.au product page (404).
- Future roadmap wishes: positive-geared properties (Airbnb API), deceased estates, other states.

## Verified working APIs
### RealtyAPI.io Domain (base https://domain.realtyapi.io, header x-realtyapi-key)
- GET /autocomplete?keyword=... → location suggestions
- GET /search/bylocation?location=Dubbo, NSW, 2830&listingType=buy&page=&priceRangeMin=&priceRangeMax=&propertyTypes= → {total, nextPage, resultCount, searchResults:[{id, headline, price, address{full,suburb,postcode,state}, propertyType, bedrooms, bathrooms, carspaces, dateListed, geoLocation{latitude,longitude}, photos[]}]}
  - NOTE: search results do NOT include landArea; detail endpoint does.
- GET /details/byid?id=2020996553 → {detail:{..., landArea:"950m²", geoLocation, marketInsights{priceGuide, priceSeries[], recentSalesCount,...}, agency, schools, seoUrl, listingUrl, isAuction, daysOnMarket}}
- Airbnb endpoints exist at airbnb.realtyapi.io (search/homes/bydestination etc.)

### NSW Planning Portal ArcGIS (no key needed)
Base: https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer
- Layer 4 = Lot Size (fields LOT_SIZE double, UNITS ha|m²|NA, EPI_NAME, LGA_NAME)
- Layer 2 = Land Zoning (SYM_CODE e.g. R2, LAY_CLASS e.g. "Low Density Residential", EPI_NAME, LGA_NAME)
- Query: /{layer}/query?geometry=lng,lat&geometryType=esriGeometryPoint&inSR=4283&spatialRel=esriSpatialRelIntersects&outFields=...&returnGeometry=false&f=json
- Verified: point 148.6413323,-32.2530256 (Dubbo) → LOT_SIZE 600 m², zone R2, Dubbo Regional LEP 2022.
- MaxRecordCount 10000. Other layers: 0 Heritage, 1 FSR, 3 Land Reservation, 5 HOB, 6 Land Application.

### Risk layers (verified Jul 15, all point-queryable, no key)
- Bushfire: https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Fire/BFPL/MapServer/0 — fields Category (int 1,2,3), d_Category ("Vegetation Category N"), also "Vegetation Buffer". Verified positive at 152.6,-31.5 (Cat 3) and 150.39,-33.7 (Cat 1). No feature = not bushfire prone. NOTE: this is BFPL vegetation category, NOT a BAL rating — BAL requires site assessment; present as "bushfire prone land: yes/category" + link to RFS map.
- Biodiversity Values (BVM): https://www.lmbc.nsw.gov.au/arcgis/rest/services/BV/BiodiversityValues/MapServer/0 — fields BV_Category, BOSET_Class, Date_Added. No feature = not on BV map ("purple"). Works with inSR=4326.
- Flood Planning: https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/Hazard/MapServer/1 — fields EPI_NAME, LGA_NAME, LAY_CLASS ("Flood Planning Area"). CAVEAT: only 622 polygons statewide, sparse LGA coverage (many LGAs incl. Hawkesbury/Maitland absent). Must label result "no mapped flood layer at this point (coverage incomplete)" not "flood-free". Layer 2 = Landslide Risk Land.
- Heritage: EPI_Primary_Planning_Layers layer 0 — fields H_NAME, SIG (Local/State), LAY_CLASS ("Conservation Area - General", "Item - General"), LGA_NAME. Verified positive at Maitland CBD and Katoomba.
- Query pattern identical to lot size/zoning; use inSR=4326, catch count=0 as clear/not-mapped.
- Spatial Viewer deep link for verification: https://www.planningportal.nsw.gov.au/spatialviewer/#/find-a-property/address (per-property link included in report card).

### Region/state search (verified Jul 15)
- Domain's /search/bylocation accepts REGION strings directly: "Mid North Coast, NSW" (3781), "Hunter Valley, NSW" (1563), "Illawarra, NSW" (4962), "Northern Rivers, NSW" (2470), "Riverina, NSW" (1168), "Central West, NSW" (1283), "South Coast, NSW" (4962), "New England, NSW" (1030), "Blue Mountains, NSW" (372), "Central Coast, NSW" (2101), "Sydney, NSW" (297 = suburb only).
- NOT resolvable: "Greater Sydney, NSW", "New South Wales". Plain "NSW" works (825 results) but coverage suspect — for state-wide use fan-out across all regions instead.
- Autocomplete endpoint param is `input` (NOT `keyword`): /autocomplete?input=... → suggestions[{type: Area|Region|School|..., displayName, name, state}]. Region/Area types can drive a scope selector.
- Greater Sydney strategy: fan out over Domain areas (e.g. "Western Sydney, NSW", "North Shore, NSW", etc.) or list of Sydney sub-areas; verify which resolve at implementation time.
- Pagination: resultCount 20/page, `nextPage` boolean, `page` param.
- Verified Sydney sub-areas: Western Sydney (4265), Eastern Suburbs (1491), Inner West (1705), Northern Beaches (717), Sutherland Shire (674), Macarthur (5233), Hawkesbury (404), Southern Highlands (851), Far West (45), North West (1030). NOT resolvable: South Western Sydney, Snowy Mountains, Southern Tablelands, Greater Sydney. "North Shore, NSW"/"The Hills, NSW"/"Murray, NSW" resolve to wrong places (suburb matches) — exclude.

### Phase 6 leads: DA / comparables (Jul 15)
- NSW "Online DA Data API": all DAs lodged on NSW Planning Portal since Jan 2019. Dataset page: https://www.planningportal.nsw.gov.au/opendata/dataset/online-da-data-api (docs at planningportal.nsw.gov.au/API; may need eplanning API key/registration).
- Known open endpoint (from ePlanning docs): https://api.apps1.nsw.gov.au/eplanning/data/v0/OnlineDA — requires headers PageSize/PageNumber, filters via OData-ish query params. TO VERIFY.
- PlanningAlerts API — non-commercial only, not suitable.
- council-da.com — commercial 3rd party, has REST API for 3.97M DAs, paid.
- Sold prices: RealtyAPI Domain may support listingType=sold in /search/bylocation. TO VERIFY. Fallback: NSW Valuer General bulk PSI (weekly CSV downloads).

### Other sources (assessment doc)
- Online DA Data API (planningportal.nsw.gov.au/opendata/dataset/online-da-data-api) — needs subscription key via ePlanningAPI@planning.nsw.gov.au.
- Valuer General bulk PSI: https://www.valuergeneral.nsw.gov.au/__psi/weekly/YYYYMMDD.zip (.DAT files, CC BY-NC-ND — commercial use requires PSI licence).

## Project state
- Scaffold: web-db-user (React+tRPC+Drizzle MySQL). Project path /home/ubuntu/nsw_property_research.
- DB tables created: savedProperties, searchHistory (migration 0001 applied).
- Services created: server/services/realtyApi.ts, nswPlanning.ts, subdivision.ts.
- Subdivision rule: ratio = landArea/minLotSize; >=2 subdividable, >=1.8 marginal, else not; restricted zones C1,C2,E1,W*,SP*,RE* → not_subdividable; missing data → unknown.
- Earlier delivered: /home/ubuntu/nsw_property_research_system_assessment.md (roadmap doc).
- Probe test file server/realtyApiProbe.test.ts + probe-realtyapi.mjs should be deleted before checkpoint.

## Frontend/final state (post-build)
- Pages: Home landing, /research (search + quick verdict badges + grid/map toggle + AnalysisDialog), /watchlist (saved properties with notes)
- Components: AppShell, AnalysisDialog, ResultsMap (verdict-coloured markers, Google Maps via built-in MapView)
- Routers: property.search (location/priceMin/priceMax/landSizeMin), property.analyse, property.quickAnalyse (max 24), property.save/listSaved/updateNotes/remove, property.recentSearches
- Tests: 21 passing incl. live e2e (server/e2e.flow.test.ts): search Dubbo → analyse → quickAnalyse against live APIs
- Sandbox browser cannot complete Manus OAuth (portal spinner — known limitation); owner session verified via screenshot service ("Oliver Smith" signed in). Server flow covered by e2e test.
- Theme: deep green (oklch hue ~160), light default.

## User's prior v1 (Perplexity) — "Margo Reports" sales page (reviewed Jul 15)
Product: a 124-page PDF REPORT (not an app): 18 viable properties, 6 NSW regions, 9 automated data layers, ROI 10–314%, ranked shortlist with Deal Grades A–D (60% ROI + 40% inverted risk).
12-section property card: Overview (incl. existing dwellings, risk score 1–10); Feasibility (LEP min lot size, 15% road/access allowance); Bushfire BAL (BAL-40/FZ hard exclude, BAL-29+ flag, RFS map link); Biodiversity BVM (purple coverage, offset $10K–$200K+, RED near-exclude); Profit model 3 scenarios (stamp duty, civil works $100K/lot, S7.11, DA fees, holding, sales costs; tiered lot pricing 25% premium +20%, 60% standard, 15% battleaxe −15%); Market & site signals (NSW PSI 1yr/3yr growth, ABS 8731.0 approvals, flood, heritage, AHIMS, amenities distances); Market cycle (lot absorption rate); Comps (Part A sold acreage via RealtyAPI, Part B completed subdivisions reconstructed from 2.2M NSW PSI rows, Part C vacant lot comps <5000sqm); Council DA rate + determination days (ePlanning), water/sewer serviceability (Sydney/Hunter Water ArcGIS), rezoning proposals; Capital stack 60–70% LVR, DSCR; Sensitivity (net profit at 18–36mo DA timelines; lot yield at 70/85/100% DA approval); Pre-offer verification checklist (9 links: Street View, Spatial Viewer, RFS, BVM, AHIMS, LRS, S10.7, pre-DA, infra).
Pipeline: 37 NSW search corridors, acreage 0.4ha+, WITH existing dwellings, $300K–$5M; excludes strata/units. Claude API writes exec narratives.
Customisation: parameterised (price, min land, regions, ROI floor ≥10%, zones, dwelling count 1+/2+/none, civils/lot, hold period, LVR, cadence, PDF vs dashboard, white label).
Brand: "Margo Reports", teal/cream serif design.
KEY USER CLARIFICATION: two product categories — (1) subdividable WITH existing cash flow (dwelling on site, rentable while DA runs), (2) NO cash flow (land only). Current webapp doesn't distinguish these; Margo pipeline filtered FOR dwellings.
Margo page extras: footer "Margo Reports — Smith Enterprise"; disclaimer "Profit figures indicative; BAL/BVM screening estimates only — verify before offer"; CTA is manual-service style ("Send a message... first report within 24 hours") — no self-serve, no pricing shown; delivery is one-off/weekly/monthly PDF (interactive dashboard listed as option). Sample properties: 49 Gorricks Run Upper Macdonald 314% ROI 14 lots $695K Grade A; Hollisdale 88.6ha 60 lots $599K 180%; Winton 143ha 60 lots $1.82M 143%; Singleton 79% B; Borenore 41% C; Tamworth 27% C MARGINAL. Claude API writes 200-word exec narrative + 120-word regional context.
- Sold prices: RealtyAPI Domain may support listingType=sold in /search/bylocation. TO VERIFY. Fallback: NSW Valuer General bulk PSI (weekly CSV downloads).

### VERIFIED: NSW Online DA API (open, no key!)
- GET https://api.apps1.nsw.gov.au/eplanning/data/v0/OnlineDA
- Filters go in HTTP HEADERS (not query params): `PageSize: N`, `PageNumber: N`, `filters: {"filters":{...}}`
- Filter keys verified: CouncilName (array, e.g. ["DUBBO REGIONAL COUNCIL"], case-insensitive match), LodgementDateFrom/LodgementDateTo (YYYY-MM-DD)
- Response: {PageSize, PageNumber, TotalPages, TotalCount, Application:[...]}
- Application fields: PlanningPortalApplicationNumber (PAN-xxx), ApplicationStatus (Determined/Cancelled/Under Assessment...), ApplicationType, SubdivisionProposedFlag ("Y"/"N"), NumberOfNewDwellings, CostOfDevelopment, LodgementDate, DeterminationDate, DeterminationAuthority, Council.CouncilName, DevelopmentType[].DevelopmentType (e.g. "Subdivision of land"), Location[].{FullAddress,X(lon),Y(lat),Suburb,Postcode,Lot[]}
- Has X/Y coords per location → can compute distance to subject property client-side.
- Strategy: filter by CouncilName (get from MLS lgaName) + LodgementDateFrom (last ~3y), then client-side filter SubdivisionProposedFlag=Y or DevelopmentType contains "Subdivision", sort by haversine distance.

### VERIFIED: Domain sold listings NOT available via RealtyAPI
- /search/bylocation ignores listingType param entirely — "sold"/"sale"/"buy" all return identical for-sale results (same 165 total). No sold channel.
- DA data DOES include NumberOfExistingLots / NumberOfProposedLots + CostOfDevelopment + SubdivisionType (Torrens/Strata/Community) — enough for meaningful comparables without sale prices.
- Sale-price angle: skip for v1; note VG bulk PSI as future work. Comparables card = nearby subdivision DAs with lots before→after, status, determination date, distance.

### VERIFIED Jul 15 (Phase 7): Domain search param behaviour
- landSizeMin param is IGNORED by /search/bylocation (2000 vs none → identical 165 totals). Land-size filtering must happen after analysis (landArea only in detail endpoint anyway).
- propertyTypes works with tokens: "Rural"→Acreage/Semi-Rural|Rural|Farm (438 in MNC), "Land"→Vacant land|New Land (731), "House"→House|Semi-Detached (1789), "AcreageSemiRural"→ same as Rural. Combined "House,AcreageSemiRural,Rural,Land" → 2959 (union). Unknown tokens (VacantLand, DevelopmentSite) are ignored → returns everything incl. apartments (3793).
- Viability-first defaults: propertyTypes=House,AcreageSemiRural,Rural,Land (excludes apartments/units/townhouses at source); land floor enforced post-analysis in rankedScan (default 700 m²); default view = subdividable+marginal only.

### DIAGNOSED Jul 15 (Phase 8): why All NSW scan shows non-subdividable stock
Live state-wide rankedScan: 25,056 total listings, 60 analysed, 19 kept → {marginal: 2, unknown: 17}. ZERO confirmed subdividable.
Root causes:
1. UNKNOWN-verdict leakage: 17/19 kept results are metro Houses with land=null (Paddington, Bondi, Kingsford…) — they skip the land floor (null ≠ < floor) and rank on data-confidence points. These dominate what the user sees.
2. Duplicate listing (Strathfield appears 2×) — dedupe by id happens per-search but same property can appear in overlapping region locations under different ids? (same id? check — address identical). Add address-level dedupe.
3. Scan depth: only 60 of 25k analysed, page 1 of each Sydney-heavy location → metro houses flood the cap before rural/acreage stock is reached. Need per-location caps + prioritise Land/Rural types in analysis order, and raise cap.
4. Scoring: unknown=15 base + confidence up to +10 lets no-data listings outrank real marginals. Default output must be confirmed subdividable/marginal ONLY.
Fix: viableOnly default keeps ONLY subdividable+marginal; unknowns behind explicit flag; dedupe by address; analyse land-only/acreage types first; raise analysis cap to 120 with per-location interleave.
CONFIRMED starvation: first-60 of merged state-wide results = 57 House + 1 Terrace + 1 Rural, ALL from Western Sydney/Eastern Suburbs/Inner West (Seven Hills, Bondi, Paddington…). Merge order is location-sequential, so the 60-cap never reaches Mid North Coast (2,960 listings), Illawarra (3,898), Macarthur (4,013) etc. Also Domain returns newest-first; metro = mostly houses. Fix must interleave round-robin across locations AND sort candidates land-first before capping.
