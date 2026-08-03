# Post-Release QLD Planning Provenance and Council-Rule Architecture

## Purpose

The checkpoint `91f63313` ships a conservative first QLD release. This note defines the next implementation boundary: **planning evidence must remain distinguishable from statutory entitlement**. Queensland does not provide a single NSW-style Standard Instrument source capable of proving zoning, minimum lot size, density, height, overlays, and subdivision permissibility across every council. Each QLD planning assertion therefore needs its own source, effective date, confidence, and manual-verification state.[1] [2]

## Evidence tiers

| Tier | Meaning | Current decision effect | Councils / status in shipped release |
|---|---|---|---|
| `council_machine` | A public council spatial endpoint returns a parcel zoning value; supported fields may also include a lot size or overlay. | A QLD property may receive planning-gated candidate tags. A subdivision result remains capped at **marginal/manual review**. | Gold Coast, Moreton Bay, Logan, and Redland zoning/adapters are configured. |
| `council_partial` | One or more council spatial layers are source-validated, but required lot-size, density, height, or overlay controls are unavailable. | The platform may display returned evidence with its source, but cannot use absent controls as a positive feasibility signal. | Recorded in the source inventory; not promoted to a positive subdivision result. |
| `manual_review` | No validated machine-readable local source, a provider query fails, or required evidence is missing. | Planning-gated categories must fail closed. Property detail directs the user to official QLD/council viewers. | All remaining QLD councils, including the documented source-inventory gap. |

> **Release rule:** A missing layer is not a clear layer. Missing minimum lot, height, density, flood, bushfire, biodiversity, heritage, or subdivision-rule evidence remains `unknown` and cannot convert a QLD listing into a confirmed positive planning conclusion.

## Verified first-release adapter boundary

The four configured council sources are intentionally narrower than the completed source inventory. The first release uses only endpoints that were inspected and normalized in code:

| Council | Returned local evidence | Known limitation | Release behavior |
|---|---|---|---|
| Gold Coast | Zone, selected minimum-lot, bushfire, and flood layers. | Council-specific code and overlays still require statutory review. | `council_machine` only when a zone record returns. |
| Moreton Bay | Zone, rural-residential lot-size, bushfire, and flood layers. | Lot-size scope is not universal across every zone. | `council_machine` only when a zone record returns. |
| Logan | Zone, bushfire, and flood layers. | No configured machine-readable minimum-lot layer. | Zone-backed candidate evidence; subdivision remains manual review. |
| Redland | Zone, bushfire, and flood layers. | No configured machine-readable lot-size, height, density, biodiversity, or state-trigger layers. | Zone-backed candidate evidence; subdivision remains manual review. |

The inventory initially labelled Mount Isa as “full” at cluster level, but the supporting report identifies only a queryable zones service plus an overlays service; it does **not** establish machine-readable minimum-lot, height, density, bushfire, or biodiversity controls. It must therefore enter the registry as `council_partial`, not as a full feasibility adapter, unless its source metadata is independently verified.

## Registry contract for the next iteration

The next implementation should introduce a typed `QldCouncilRule` registry keyed by the authoritative LGA resolver. It should persist source provenance rather than embed unversioned assumptions in the classifier.

| Field | Example | Role |
|---|---|---|
| `councilKey` | `gold-coast` | Stable internal identifier matched to QLD Spatial LGA name aliases. |
| `coverageTier` | `council_machine` | Determines whether planning-gated classifier logic may use the evidence. |
| `planningScheme` | `Gold Coast City Plan` | Human-readable statutory source name. |
| `effectiveFrom` | `2025-05-27` or `null` | Prevents an old service snapshot from appearing current. |
| `sourceUrl` | Official council scheme URL | Public verification link shown in the UI. |
| `layerProvenance` | `{ zoning, lotSize, height, density, flood, bushfire, biodiversity }` | Tracks each field as `machine`, `document`, `viewer_only`, or `unknown`. |
| `subdivisionRule` | `manual_review_required` | Never infers a universal QLD lot yield from a zone family alone. |
| `confidence` | `high`, `partial`, or `manual_review` | Supports explicit UI uncertainty and auditability. |
| `notes` | `MLS is rural-residential only` | Captures scope limitations that affect classification. |

## Classifier rule hierarchy

The classifier should apply evidence in this order:

1. **Listing facts** such as distressed-sale wording, deceased-estate wording, existing secondary dwelling, and rental arithmetic remain state-neutral where they do not assert a planning entitlement.
2. **QLD zone normalization** maps descriptive statutory names to a family for filtering and prioritization, but does not establish permissibility.
3. **Council rule and field provenance** determine whether the normalized zone can support a planning-gated category candidate.
4. **Subdivision controls** require a returned zone, applicable minimum-lot evidence, site area, frontage, and non-unknown hazards. Even then, a QLD outcome remains `marginal` with a council-specific review requirement.
5. **Manual review** is the mandatory fallback whenever a required field or rule is unavailable.

## Implementation sequence

The source inventory supports a safe next sequence: first introduce the typed registry and field-level provenance; then encode the four shipped adapters into it; then add source-validated partial adapters only where their returned fields can be represented without implying missing controls; finally add source-date monitoring and a council-rule review workflow. The website should continue to label all incomplete jurisdictions as `manual_review` until their required evidence is verified.

## References

[1]: https://www.planning.qld.gov.au/planning-framework/plan-making/local-planning/zoning-information "Queensland Government — zoning information"
[2]: https://www.legislation.qld.gov.au/view/whole/html/inforce/current/sl-2017-0078 "Queensland Planning Regulation 2017"
[3]: https://spatial-gis.information.qld.gov.au/arcgis/rest/services/PlanningCadastre/LandParcelPropertyFramework/MapServer/20?f=pjson "Queensland Spatial — authoritative local government area layer"
[4]: https://planning.dsdmip.qld.gov.au/maps "Queensland Development Assessment Mapping System"
