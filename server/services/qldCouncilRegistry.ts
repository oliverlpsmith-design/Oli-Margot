/**
 * Queensland council planning-source registry.
 *
 * Queensland planning controls are council-specific. A registry row records
 * what is actually machine-verifiable for a council; it never implies that
 * missing layers are clear or that a normalised zone family is a development
 * entitlement.
 */

export type QldPlanningCoverage = "council_machine" | "council_partial" | "manual_review";
export type QldFieldSourceStatus = "machine" | "viewer_only" | "unknown";
/** Confidence in the machine-readable source coverage, never a development entitlement. */
export type QldSourceConfidence = "high" | "partial" | "manual_review";

export interface QldLayerSpec {
  url: string;
  outFields: string;
}

export interface QldFieldProvenance {
  zoning: QldFieldSourceStatus;
  minimumLotSize: QldFieldSourceStatus;
  height: QldFieldSourceStatus;
  density: QldFieldSourceStatus;
  bushfire: QldFieldSourceStatus;
  flood: QldFieldSourceStatus;
  biodiversity: QldFieldSourceStatus;
  heritage: QldFieldSourceStatus;
  subdivisionRules: QldFieldSourceStatus;
}

export interface QldCouncilRule {
  key: string;
  matches: string[];
  coverage: Exclude<QldPlanningCoverage, "manual_review">;
  confidence: Exclude<QldSourceConfidence, "manual_review">;
  schemeName: string;
  /** Effective date when source evidence confirmed it; null prevents stale-date claims. */
  effectiveFrom: string | null;
  verificationUrl: string;
  zoning: QldLayerSpec;
  minimumLotSize?: QldLayerSpec;
  bushfire?: QldLayerSpec;
  flood?: QldLayerSpec;
  /** QLD subdivision assessment is always council-specific in this release. */
  subdivisionRule: "manual_review_required";
  fields: QldFieldProvenance;
  notes: string;
}

const UNKNOWN_FIELDS: QldFieldProvenance = {
  zoning: "unknown",
  minimumLotSize: "unknown",
  height: "unknown",
  density: "unknown",
  bushfire: "unknown",
  flood: "unknown",
  biodiversity: "unknown",
  heritage: "unknown",
  subdivisionRules: "viewer_only",
};

export const QLD_COUNCIL_RULES: readonly QldCouncilRule[] = [
  {
    key: "gold-coast",
    matches: ["gold coast"],
    coverage: "council_machine",
    confidence: "high",
    schemeName: "Gold Coast City Plan",
    effectiveFrom: null,
    verificationUrl: "https://www.goldcoast.qld.gov.au/Planning-building/Planning-our-city",
    zoning: {
      url: "https://maps1.goldcoast.qld.gov.au/arcgis/rest/services/City_Plan_V13_Zone/MapServer/6",
      outFields: "ZONE,ZONE_PRECINCT,LVL1_ZONE,Building_height,BH_Category",
    },
    minimumLotSize: {
      url: "https://maps1.goldcoast.qld.gov.au/arcgis/rest/services/CityPlan_V12_LandUse_IndustryInterface_MinimumLotSize_PacMtwy/MapServer/2",
      outFields: "CAT_DESC,MLS",
    },
    bushfire: {
      url: "https://maps1.goldcoast.qld.gov.au/arcgis/rest/services/V8_Overlays/MapServer/10",
      outFields: "CAT_DESC,OVL2_DESC",
    },
    flood: {
      url: "https://maps1.goldcoast.qld.gov.au/arcgis/rest/services/V8_Overlays/MapServer/109",
      outFields: "CAT_DESC,OVL2_DESC",
    },
    subdivisionRule: "manual_review_required",
    fields: {
      ...UNKNOWN_FIELDS,
      zoning: "machine",
      minimumLotSize: "machine",
      height: "machine",
      bushfire: "machine",
      flood: "machine",
    },
    notes: "Minimum-lot layer is not universal across all zones; no automatic QLD subdivision entitlement is inferred.",
  },
  {
    key: "moreton-bay",
    matches: ["moreton bay"],
    coverage: "council_machine",
    confidence: "high",
    schemeName: "Moreton Bay Regional Council Planning Scheme",
    effectiveFrom: null,
    verificationUrl:
      "https://www.moretonbay.qld.gov.au/Services/Building-Development/Planning-Schemes/MBRC",
    zoning: {
      url: "https://services-ap1.arcgis.com/152ojN3Ts9H3cdtl/ArcGIS/rest/services/ZM_Zones_WebMercator_OpenData/FeatureServer/0",
      outFields: "ZONE,ZONE_CODE,LVL1_ZONE,ZONE_PRECINCT,LP",
    },
    minimumLotSize: {
      url: "https://services-ap1.arcgis.com/152ojN3Ts9H3cdtl/ArcGIS/rest/services/OM_Rural_Res_Lot_Sizes_WebMercator_OpenData/FeatureServer/0",
      outFields: "*",
    },
    bushfire: {
      url: "https://services-ap1.arcgis.com/152ojN3Ts9H3cdtl/ArcGIS/rest/services/MBRC_PlanningScheme_OM_BushfireHazard/FeatureServer/0",
      outFields: "*",
    },
    flood: {
      url: "https://services-ap1.arcgis.com/152ojN3Ts9H3cdtl/ArcGIS/rest/services/OM_Flood_Hazard_WebMercator_OpenData/FeatureServer/0",
      outFields: "*",
    },
    subdivisionRule: "manual_review_required",
    fields: {
      ...UNKNOWN_FIELDS,
      zoning: "machine",
      minimumLotSize: "machine",
      bushfire: "machine",
      flood: "machine",
    },
    notes: "Rural-residential lot-size mapping is a scoped input, not a universal lot-yield rule.",
  },
  {
    key: "logan",
    matches: ["logan"],
    coverage: "council_machine",
    confidence: "high",
    schemeName: "Logan Planning Scheme 2015",
    effectiveFrom: "2025-05-27",
    verificationUrl:
      "https://www.logan.qld.gov.au/planning-and-building/planning-and-development/logan-planning-scheme",
    zoning: {
      url: "https://arcgis.lcc.wspdigital.com/server/rest/services/LoganHub/Logan_Planning_Scheme_v9_2_TLPI_No_1_2024_20250527/MapServer/368",
      outFields: "Zone",
    },
    bushfire: {
      url: "https://arcgis.lcc.wspdigital.com/server/rest/services/LoganHub/Logan_Planning_Scheme_v9_2_TLPI_No_1_2024_20250527/MapServer/21",
      outFields: "OVL2_DESC,CAT_DESC",
    },
    flood: {
      url: "https://arcgis.lcc.wspdigital.com/server/rest/services/LoganHub/Logan_Planning_Scheme_v9_2_TLPI_No_1_2024_20250527/MapServer/39",
      outFields: "Description",
    },
    subdivisionRule: "manual_review_required",
    fields: {
      ...UNKNOWN_FIELDS,
      zoning: "machine",
      bushfire: "machine",
      flood: "machine",
    },
    notes: "No parcel-specific machine minimum-lot rule is configured; reconfiguring-a-lot assessment remains manual review.",
  },
  {
    key: "redland",
    matches: ["redland"],
    coverage: "council_machine",
    confidence: "high",
    schemeName: "Redland City Plan",
    effectiveFrom: null,
    verificationUrl:
      "https://www.redland.qld.gov.au/Planning-building-and-development/Redland-City-Plan",
    zoning: {
      url: "https://gis.redland.qld.gov.au/arcgis/rest/services/planning/city_plan/MapServer/44",
      outFields: "QPP_Zone,QPP_Description,QPP_Precinct",
    },
    bushfire: {
      url: "https://gis.redland.qld.gov.au/arcgis/rest/services/planning/city_plan/MapServer/3",
      outFields: "CLASS",
    },
    flood: {
      url: "https://gis.redland.qld.gov.au/arcgis/rest/services/planning/city_plan/MapServer/11",
      outFields: "CLASS",
    },
    subdivisionRule: "manual_review_required",
    fields: {
      ...UNKNOWN_FIELDS,
      zoning: "machine",
      bushfire: "machine",
      flood: "machine",
    },
    notes: "Local zoning and overlays are machine-queryable; lot size, density, height and statutory subdivision controls remain manual review.",
  },
  {
    key: "mount-isa",
    matches: ["mount isa"],
    coverage: "council_partial",
    confidence: "partial",
    schemeName: "City of Mount Isa Planning Scheme 2020",
    effectiveFrom: "2020-03-09",
    verificationUrl:
      "https://www.mountisa.qld.gov.au/Development-and-Land-Use/Development/Planning-Schemes-and-Infrastructure-Charges",
    zoning: {
      url: "https://services8.arcgis.com/g9mppFwSsmIw9E0Z/ArcGIS/rest/services/Planning_Scheme_Zones_(public)/FeatureServer/0",
      outFields: "*",
    },
    subdivisionRule: "manual_review_required",
    fields: {
      ...UNKNOWN_FIELDS,
      zoning: "machine",
    },
    notes: "Validated public zoning source only. The completed inventory did not establish machine-readable parcel lot-size, height, density, bushfire, flood or biodiversity controls.",
  },
] as const;

export function getQldCouncilRule(lgaName: string | null): QldCouncilRule | null {
  const normalised = (lgaName ?? "").toLowerCase();
  return QLD_COUNCIL_RULES.find(rule => rule.matches.some(match => normalised.includes(match))) ?? null;
}

export function manualReviewFieldProvenance(): QldFieldProvenance {
  return { ...UNKNOWN_FIELDS };
}

export const QLD_COUNCIL_MACHINE_COVERAGE = QLD_COUNCIL_RULES
  .filter(rule => rule.coverage === "council_machine")
  .map(rule => rule.key);

export const QLD_COUNCIL_PARTIAL_COVERAGE = QLD_COUNCIL_RULES
  .filter(rule => rule.coverage === "council_partial")
  .map(rule => rule.key);
