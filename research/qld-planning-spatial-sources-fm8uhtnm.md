# Queensland Planning and Spatial Source Research

## Initial authoritative-source findings

Queensland does **not** expose a direct statewide equivalent of the NSW Planning Portal’s local zoning and minimum-lot-size lookups through MyDAS2. The Queensland Planning site describes MyDAS2 as a system for lodging development applications when the state is the assessment manager or a referral agency. The same official page identifies the State Planning Policy Interactive Mapping System (SPP IMS) and Development Assessment Mapping System (DAMS) as the state’s GIS products for matters of **state interest** and development-assessment triggers.[1] [2]

The official mapping page states that SPP IMS and DAMS layers come directly from the relevant state agency, are amended over time, and can be incomplete for some matters. These products are authoritative for state interests and triggers, but they do not replace each council’s local planning scheme, zone map, overlays, or subdivision assessment provisions.[1]

| Required Investor Scout field | Current authoritative direction | Initial conclusion |
|---|---|---|
| Local zone and zone precinct | Local government planning scheme or council spatial service | No single MyDAS2 zoning endpoint has been established. A council-aware adapter/registry is required. |
| Minimum lot size / subdivision rule | Local planning scheme zone code, overlays, tables of assessment and development codes | Must be source-linked and council/scheme-version aware; cannot be inferred from a statewide QLD zone label alone. |
| State assessment triggers | DAMS | Suitable authoritative state-level source; exact machine service endpoints still require validation. |
| State Planning Policy interests | SPP IMS | Suitable authoritative state-level source; exact machine service endpoints still require validation. |
| Biodiversity and environmental constraints | Queensland environmental datasets, QSpatial, Maps Online, MSES and regulated-vegetation products | Statewide data exists, but each selected layer needs service metadata, licence review, and point-query validation. |
| Flood | Council flood mapping plus selected state products | Flood mapping is not uniform statewide; council sources are required for property-level local flood overlays. |
| Bushfire | State and council planning/bushfire layers | Layer authority and applicability must be recorded; a statewide screen cannot replace council planning-scheme overlays where they differ. |

The Queensland environment department describes QSpatial as the state spatial catalogue and data-download service, with dataset-specific licence conditions. It identifies Maps Online as a current-data report platform with more than 40 topics, Queensland Globe as the interactive statewide viewer, and separate products for matters of state environmental significance, coastal hazards, regional ecosystems, regulated vegetation, koala habitat, wetlands and other environmental interests.[3]

These findings establish a **tiered source model** for Investor Scout: council planning schemes for local zoning and local development controls; DAMS/SPP IMS for state planning triggers and interests; and QSpatial/Queensland environmental services for statewide environmental constraints. Every persisted result should record jurisdiction, source authority, service/layer identifier, source URL, retrieval time, and an explicit `available`, `not_mapped`, `unknown`, or `error` status.

## Statewide local-zoning availability check

The Queensland Open Data Portal contains an open request from July 2024 for a dataset of all Queensland planning zones. The official Queensland Government Publisher responded that it would ask the planning section whether the dataset was available and noted that an agency process would be required before it could be released as open data. The request remained open when checked on 3 August 2026, with no dataset link or affirmative release recorded.[5] A separate open request asks whether planning zones, biodiversity, bushfire, flood, heritage and infrastructure layers are statewide or must be obtained from individual councils; it likewise does not provide a statewide geodatabase.[6]

This is material implementation evidence: **Investor Scout must not assume that an unpublished statewide local-planning-zone service exists**. A future government release could simplify the adapter, but the production design needs explicit council/service coverage and an `unknown` result wherever no validated local source is configured.

## Verified council spatial-service patterns

Representative councils expose materially different ArcGIS services. Sunshine Coast Council publishes a queryable FeatureServer for its Planning Scheme 2014 zone maps, including separate precinct layers and a `Zones` layer, with JSON query support and a 2,000-record service limit.[7] Scenic Rim Regional Council publishes a queryable MapServer containing zoning, precincts, bushfire, biodiversity, wetlands and waterways, flood-hazard areas and categories, local heritage, and a minimum-lot-size overlay among many other layers.[8]

| Council example | Service pattern | Relevant verified layers | Consequence for the adapter |
|---|---|---|---|
| Sunshine Coast | Hosted ArcGIS FeatureServer | Zones; low-density residential precinct; rural precinct; tourism precincts | Point-query layer IDs can be configured, but scheme year and precinct must be preserved. |
| Scenic Rim | Council-hosted ArcGIS MapServer | Zoning; bushfire; biodiversity; flood hazard; heritage; minimum lot size | One service exposes multiple required fields, but layer IDs and attributes are council-specific. |

These examples confirm that a reusable ArcGIS point-query client is practical, while the **service registry remains council-specific**. Layer names cannot be treated as a statewide contract, and every configured layer needs a validated service URL, layer ID, source authority, planning-scheme/version, output-field mapping, and last validation date.

## Sources requiring endpoint-level validation

The next research step is to identify stable ArcGIS REST, WMS/WFS, downloadable, or report APIs for DAMS, SPP IMS, Queensland Globe/QSpatial layers, cadastral parcels, bushfire, flood, biodiversity/MSES, regulated vegetation, heritage, coastal hazards, and representative council planning schemes. A browser-only viewer is not sufficient for automated nightly classification unless its backing service is public, stable, and licensed for the intended use.

Initial discovery confirms that Queensland Government publishes public ArcGIS REST services under `spatial-gis.information.qld.gov.au`, including the `InlandWaters/WaterCoursesAndBodies` MapServer and planning/cadastre services. One indexed planning service, `PlanningCadastre/StateDevelopmentAreas`, explicitly announced decommissioning on 26 June 2026, demonstrating that endpoint lifecycle metadata must be monitored and that the adapter needs health checks and graceful `source_unavailable` behavior rather than treating an outage as a clear planning result.[9] [10]

## Validated statewide ArcGIS services

The Queensland Spatial REST catalogue is publicly enumerable and currently reports ArcGIS Server 11.5. Its `PlanningCadastre`, `Environment`, `FloodCheck`, `Biota`, `InlandWaters` and related folders expose queryable MapServer or FeatureServer products.[11]

| Investor Scout purpose | Validated service | Authority and update evidence | Appropriate use |
|---|---|---|---|
| Parcel, address, locality and council resolution | `PlanningCadastre/LandParcelPropertyFramework` | Queensland Department of Natural Resources; cadastral parcels and addresses updated nightly, LGA and locality boundaries quarterly; JSON, GeoJSON and PBF supported.[12] | Resolve a listing point to parcel, lot/plan, locality and LGA before council-specific planning queries. |
| State/regional planning context | `PlanningCadastre/StatePlanning` | Queensland State Development, Infrastructure and Planning 2026; open-data service with regional plans, regional land-use categories, areas of regional interest, infrastructure designations, PDAs and state development areas.[13] | Record state/regional designations and triggers. This service is **not** local planning-scheme zoning. |
| Biodiversity and environmental constraint screen | `Environment/MattersOfStateEnvironmentalSignificance` | Queensland environment authority; MSES representation under the State Planning Policy and Offset Regulation; JSON, GeoJSON and PBF supported.[14] | Query protected areas, wetlands, wildlife habitat, regulated vegetation, essential habitat, koala habitat and related MSES layers. Preserve each matched layer rather than a single opaque biodiversity flag. |
| State flood-study context | `FloodCheck` service family, including `ComprehensiveStudies`, `BasinOnePercentAEP`, `RapidHazardAssessment` and historical flood products | Queensland Department of Resources service family; queryable products but uneven service descriptions and study coverage.[15] | Use as a statewide study/context screen only. Do not represent an unmatched point as flood-clear; property-level planning flood overlays remain council-specific. |

The cadastre service is a strong foundation for the council registry because it can determine the authoritative LGA and parcel before local planning queries. The MSES service can supply a defensible statewide biodiversity layer family. By contrast, `StatePlanning` supplies state and regional context but does not solve local zone, minimum-lot-size, height or density controls. The FloodCheck catalogue confirms useful statewide and historical products, but its heterogeneous study layers are not a uniform substitute for local flood-planning overlays.

### Production layer identifiers validated on 3 August 2026

The `LandParcelPropertyFramework` service reports `Map,Query,Data` capabilities and JSON, GeoJSON and PBF query formats. Its directly relevant layers are: **4 — Cadastral parcels**, **19 — Locality Boundaries**, and **20 — Local Government Areas**. The same metadata states that cadastral parcels and addresses are updated nightly and LGA/locality boundaries quarterly. These IDs can support point-to-parcel and point-to-council resolution in the QLD adapter.[12]

The `MattersOfStateEnvironmentalSignificance` service reports `Map,Query,Data` capabilities and JSON, GeoJSON and PBF query formats. Its service metadata enumerates protected estates and nature refuges; wetlands and high ecological value waters; endangered or vulnerable wildlife habitat; core and locally refined SEQ koala habitat; endangered/of-concern regulated vegetation; essential habitat; wetland buffers; and other MSES datasets.[14] The adapter may query validated feature layers as a **state environmental screen**, but an unmatched point must not be represented as a council planning-scheme biodiversity clearance.

The `StatePlanning` service is an open-data state/regional planning service containing areas of regional interest, infrastructure designations, priority development areas, state development areas and precincts, regional plan boundaries, and regional land-use categories. It is suitable for state context and verification, but not for local zoning, minimum-lot, height or density.[13]

### First-release council zoning adapters

The accelerated release will initially query council zoning only where a public endpoint and fields were validated directly. The statewide LGA resolver is `LandParcelPropertyFramework/MapServer/20`; it exposes `lga`, `adminareaname`, and `abbrev_name` and supports point-intersection queries. The first council adapters are:

| Council | Authoritative zone endpoint | Parsed fields | Scheme/viewer context |
|---|---|---|---|
| Gold Coast | `https://maps1.goldcoast.qld.gov.au/arcgis/rest/services/City_Plan_V13_Zone/MapServer/6` | `ZONE` plus `ZONE_PRECINCT`, `LVL1_ZONE`, `Building_height`, `BH_Category` when returned | Current City Plan V13 zone service; service renderer confirms zone names including Low/Medium/High Density Residential, Mixed Use, Centre, Industry, Rural and other Queensland zone families. |
| Moreton Bay | `https://services-ap1.arcgis.com/152ojN3Ts9H3cdtl/ArcGIS/rest/services/ZM_Zones_WebMercator_OpenData/FeatureServer/0` | `ZONE`, `ZONE_CODE`, `LVL1_ZONE`, `ZONE_PRECINCT` when returned | City of Moreton Bay open-data zone service. Renderer confirms General Residential, Centre, Rural, Rural Residential, Township and other zone families. |
| Logan | `https://arcgis.lcc.wspdigital.com/server/rest/services/LoganHub/Logan_Planning_Scheme_v9_2_TLPI_No_1_2024_20250527/MapServer/368` | `Zone` | Logan Planning Scheme V9.2/TLPI service; zone renderer confirms Low, Low-Medium and Medium Density Residential, Mixed Use, Centre, Rural, Rural Residential and other families. |
| Redland | `https://gis.redland.qld.gov.au/arcgis/rest/services/planning/city_plan/MapServer/44` | `QPP_Zone`, `QPP_Description`, `QPP_Precinct` | Redland City Plan service; minimum lot size, height and density remain manual-review fields. |

All other councils remain explicit `manual_review` for local zoning in this release. A missing query result or endpoint failure is **unknown**, never a clear planning outcome. Zone-family normalization supports candidate classification only and does not establish a subdivision entitlement.

## Statewide bushfire source assessment

Queensland Fire Department describes the Bushfire Prone Area (BPA) as the statewide planning map supporting the State Planning Policy. It defines BPA as land potentially affected by significant bushfires, including hazardous vegetation and adjacent impact land. The official guidance confirms that BPA is visible through SPP IMS and DAMS and that local governments are expected to integrate applicable state interests into their local planning instruments.[16]

The Queensland Open Data Portal publishes regional download packs for the statewide BPA series, but the portal records the dataset as last updated on 12 November 2020 and with a non-regular update frequency.[17] An older public ArcGIS MapServer describes medium, high and very-high potential intensity classes plus a 100-metre impact buffer, but it is a **tiles-only** service and cannot support feature point queries.[18]

A newer Queensland Fire Department ArcGIS item, created in January 2025, describes a public `Bushfire Prone Area (BPA) Dynamic Limited` Feature Service produced with CSIRO and provides a proxied service URL. Direct server-to-server validation on 3 August 2026 returned an ArcGIS token-generation error from the public proxy, while the listed source service presented an expired TLS certificate. Its item licence also states `Published for BRC Viewer use`.[19] The production adapter therefore cannot safely rely on that endpoint until access and licensing are clarified.

The defensible implementation order is: use validated council planning-scheme bushfire layers where configured; retain a separate statewide BPA status only if a stable queryable service or licensed locally indexed dataset is established; and otherwise show `statewide_bushfire_source_unavailable` rather than a false clear result. The official viewer remains useful as a user verification link, not as an automated data contract.

## SPP IMS and DAMS launcher assessment

The official Queensland planning map launcher confirms separate products for SPP IMS, DAMS, SPP assessment benchmark mapping, state development areas, priority development areas, non-SARA mapping, regional plans, regional interests and infrastructure designations.[20] The rendered launcher is an application shell and did not expose stable layer service URLs in its public page content. Automated coverage should therefore use validated Queensland Spatial REST services where their authority matches the required field, while retaining the official launcher as a verification link.

## Statutory zone taxonomy and classifier implications

Queensland’s Planning Regulation 2017 does provide a regulated baseline for zone **names and purpose statements**. A current local planning instrument must not include land in a zone other than a zone listed in schedule 2, and it must include the corresponding purpose statement and mapping colour unless the Minister approves a stated local variation. The Regulation also constrains adopted use terms and definitions.[21]

This means Investor Scout can safely maintain a statewide **zone-name normalization taxonomy** for common regulated labels such as low density residential, low-medium density residential, medium density residential, high density residential, centre, mixed use, industry, rural, rural residential, emerging community, environmental management and conservation, community facilities, recreation and open space, and special purpose. It must still store the council’s exact source label, precinct and local variation.

The regulated taxonomy does **not** create statewide subdivision or development entitlements. Queensland Planning states that each local government has its own local planning scheme and directs users to the relevant council scheme.[22] The 2025 amendments to lower-density zone purpose statements further demonstrate that statewide settings can affect expected housing forms while council planning schemes and applicable overlays still determine approval pathways and other requirements.[23]

The classifier contract should therefore separate:

| Field | Statewide normalization allowed | Council evidence required |
|---|---|---|
| Zone family and broad investment relevance | Yes, from regulated zone name/purpose plus exact local label | Preserve council scheme, amendment/version, precinct and any approved purpose variation. |
| Subdivision feasibility and minimum lot size | No | Minimum-lot overlay/table, reconfiguring-a-lot code, zone/precinct provisions, overlays and servicing constraints. |
| Dual-occupancy or multiple-dwelling potential | Broad candidate signal only | Local use table, zone code, overlays, site constraints and current state transitional rules. |
| Height, density or plot-ratio equivalent | No uniform statewide field | Council height/building-height overlay, dwelling density, site cover, plot ratio or local plan provisions as applicable. |
| Flood, bushfire, heritage and biodiversity planning effect | State layers may provide a risk screen | Council planning-scheme overlay and assessment provisions where configured. |

Accordingly, a normalized QLD zone may support **candidate generation**, but an affirmative subdivision or development-site classification must require council-specific rule evidence. Missing rule evidence must produce `unknown` or `manual_review`, never `not_affected` or `permitted`.

## References

[1]: https://www.planning.qld.gov.au/planning-framework/mapping "Queensland Planning — Mapping"
[2]: https://www.planning.qld.gov.au/planning-framework/planning-online-services "Queensland Planning — Online planning services"
[3]: https://environment.qld.gov.au/resources/maps-data "Queensland Environment — Environmental maps and data online"
[4]: https://www.data.qld.gov.au/dataset/mapsonline-api "Queensland Open Data — MapsOnline API"
[5]: https://www.data.qld.gov.au/datarequest/comment/e71814c8-ea2c-4b0d-9880-98d16c3adea5 "Queensland Open Data request — QLD Planning Zones comments"
[6]: https://www.data.qld.gov.au/datarequest/4b5122d1-840c-4d20-9926-392065902a26 "Queensland Open Data request — Planning Scheme Dataset Requests"
[7]: https://services-ap1.arcgis.com/YQyt7djuXN7rQyg4/arcgis/rest/services/PlanningScheme_Zoning_SCC/FeatureServer "Sunshine Coast Planning Scheme zoning FeatureServer"
[8]: https://esriprod.scenicrim.qld.gov.au/arcgis/rest/services/PlanningXchange_base/MapServer "Scenic Rim PlanningXchange MapServer"
[9]: https://spatial-gis.information.qld.gov.au/arcgis/rest/services/InlandWaters/WaterCoursesAndBodies/MapServer "Queensland Spatial — Water Courses and Bodies MapServer"
[10]: https://spatial-gis.information.qld.gov.au/arcgis/rest/services/PlanningCadastre/StateDevelopmentAreas/MapServer "Queensland Spatial — State Development Areas MapServer deprecation notice"
[11]: https://spatial-gis.information.qld.gov.au/arcgis/rest/services "Queensland Spatial — ArcGIS REST Services Directory"
[12]: https://spatial-gis.information.qld.gov.au/arcgis/rest/services/PlanningCadastre/LandParcelPropertyFramework/MapServer "Queensland Spatial — Land Parcel Property Framework"
[13]: https://spatial-gis.information.qld.gov.au/arcgis/rest/services/PlanningCadastre/StatePlanning/MapServer "Queensland Spatial — State Planning MapServer"
[14]: https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Environment/MattersOfStateEnvironmentalSignificance/MapServer "Queensland Spatial — Matters of State Environmental Significance MapServer"
[15]: https://spatial-gis.information.qld.gov.au/arcgis/rest/services/FloodCheck "Queensland Spatial — FloodCheck service directory"
[16]: https://www.fire.qld.gov.au/compliance-and-planning/bushfire-planning/brc "Queensland Fire Department — Bushfire resilient communities and BPA mapping"
[17]: https://www.data.qld.gov.au/dataset/bushfire-prone-area-queensland-series "Queensland Open Data — Bushfire prone area series"
[18]: https://tiles.arcgis.com/tiles/vkTwD8kHw2woKBqV/arcgis/rest/services/Bushfire_Prone_Areas/MapServer "Queensland Fire and Emergency Services — Bushfire Prone Areas tiles-only MapServer"
[19]: https://www.arcgis.com/sharing/rest/content/items/8ac1ba8eccee472fbd0e7a57bf3ad320?f=json "Queensland Fire Department — Bushfire Prone Area Dynamic Limited ArcGIS item metadata"
[20]: https://planning.dsdmip.qld.gov.au/maps?type=spp "Queensland Planning — SPP IMS and DAMS map launcher"
[21]: https://www.legislation.qld.gov.au/view/whole/html/inforce/current/sl-2017-0078 "Queensland Planning Regulation 2017 — regulated local-instrument requirements and schedule 2 zones"
[22]: https://www.planning.qld.gov.au/planning-framework/plan-making/local-planning/local-planning-schemes "Queensland Planning — Local planning schemes"
[23]: https://www.planning.qld.gov.au/planning-issues-and-interests/changes-to-regulation-of-rooming-accommodation-dwellings-houses-and-zone-purpose-statements "Queensland Planning — 2025 lower-density zone purpose and overlay changes"
