/**
 * Queensland planning/spatial adapter.
 *
 * Queensland has no NSW-style statewide local-planning-scheme layer. This
 * adapter first resolves the LGA from the authoritative Queensland Spatial LGA
 * layer, then uses a source registry that states exactly which council fields
 * are machine-verifiable. Missing fields are always unknown/manual review.
 */

import type { MinimumLotSizeResult, ZoningResult } from "./nswPlanning";
import {
  getQldCouncilRule,
  manualReviewFieldProvenance,
  type QldCouncilRule,
  type QldFieldProvenance,
  type QldPlanningCoverage,
  type QldSourceConfidence,
} from "./qldCouncilRegistry";

export {
  QLD_COUNCIL_MACHINE_COVERAGE,
  QLD_COUNCIL_PARTIAL_COVERAGE,
  QLD_COUNCIL_RULES,
} from "./qldCouncilRegistry";
export type { QldFieldProvenance, QldPlanningCoverage, QldSourceConfidence } from "./qldCouncilRegistry";

interface ArcGisQueryResponse {
  features?: Array<{ attributes: Record<string, unknown> }>;
  error?: { message?: string; details?: string[] };
}

export type QldRiskStatus = "clear" | "flagged" | "unknown";

export interface QldRiskResult {
  status: QldRiskStatus;
  detail: string;
  items: string[];
}

export interface QldPlanningBundle {
  lgaName: string | null;
  councilKey: string | null;
  coverage: QldPlanningCoverage;
  confidence: QldSourceConfidence;
  zoning: ZoningResult;
  minimumLotSize: MinimumLotSizeResult;
  bushfire: QldRiskResult;
  flood: QldRiskResult;
  schemeName: string | null;
  effectiveFrom: string | null;
  verificationUrl: string;
  fieldProvenance: QldFieldProvenance;
  subdivisionRule: "manual_review_required" | null;
  sourceNotes: string | null;
}

const QLD_LGA_LAYER =
  "https://spatial-gis.information.qld.gov.au/arcgis/rest/services/PlanningCadastre/LandParcelPropertyFramework/MapServer/20";

export const QLD_STATE_PLANNING_VIEWER = "https://planning.dsdmip.qld.gov.au/maps?type=spp";
export const QLD_DEVELOPMENT_MAPS = "https://planning.dsdmip.qld.gov.au/maps";
export const QLD_GLOBE = "https://qldglobe.information.qld.gov.au/";

function textValue(attributes: Record<string, unknown> | null, names: string[]): string | null {
  if (!attributes) return null;
  const entries = Object.entries(attributes);
  for (const name of names) {
    const match = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
    if (match && match[1] != null && String(match[1]).trim()) return String(match[1]).trim();
  }
  return null;
}

async function queryPoint(
  layerUrl: string,
  latitude: number,
  longitude: number,
  outFields: string,
): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({
    geometry: `${longitude},${latitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields,
    returnGeometry: "false",
    f: "json",
  });
  const response = await fetch(`${layerUrl}/query?${params.toString()}`, {
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`QLD spatial query failed with status ${response.status}`);
  const data = (await response.json()) as ArcGisQueryResponse;
  if (data.error) {
    throw new Error(
      `QLD spatial query error: ${data.error.message ?? data.error.details?.join("; ") ?? "unknown"}`,
    );
  }
  return data.features?.[0]?.attributes ?? null;
}

function emptyMinimumLotSize(lgaName: string | null): MinimumLotSizeResult {
  return {
    lotSize: null,
    units: null,
    lotSizeSqm: null,
    label: null,
    epiName: null,
    lgaName,
  };
}

function parseAreaSqm(value: unknown): { raw: number; units: string; sqm: number; label: string } | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return { raw: value, units: "m²", sqm: value, label: `${value} m²` };
  }
  const text = String(value).trim().toLowerCase().replace(/,/g, "");
  const match = text.match(/([\d.]+)\s*(ha|hectares?|m2|m²|sqm|square metres?)?/i);
  if (!match) return null;
  const raw = Number(match[1]);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const unit = match[2] ?? "m²";
  const isHa = unit.startsWith("ha") || unit.startsWith("hectare");
  const sqm = isHa ? raw * 10_000 : raw;
  return { raw, units: isHa ? "ha" : "m²", sqm, label: `${raw} ${isHa ? "ha" : "m²"}` };
}

async function resolveLga(latitude: number, longitude: number): Promise<string | null> {
  const attrs = await queryPoint(QLD_LGA_LAYER, latitude, longitude, "lga,adminareaname,abbrev_name");
  return textValue(attrs, ["lga", "adminareaname", "abbrev_name"]);
}

async function queryRisk(
  spec: QldCouncilRule["bushfire"] | QldCouncilRule["flood"],
  latitude: number,
  longitude: number,
  label: string,
  manualReview: boolean,
): Promise<QldRiskResult> {
  if (!spec) {
    return {
      status: "unknown",
      detail: `${label} requires council/state map verification`,
      items: [],
    };
  }
  try {
    const attrs = await queryPoint(spec.url, latitude, longitude, spec.outFields);
    if (!attrs) {
      return manualReview
        ? { status: "unknown", detail: `${label} not returned; manual verification required`, items: [] }
        : { status: "clear", detail: `No ${label.toLowerCase()} polygon returned by council layer`, items: [] };
    }
    const item =
      textValue(attrs, ["CAT_DESC", "OVL2_DESC", "Description", "CLASS", "CATEGORY", "HAZARD"]) ??
      label;
    return { status: "flagged", detail: item, items: [item] };
  } catch (error) {
    return {
      status: "unknown",
      detail: `${label} query unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
      items: [],
    };
  }
}

function manualReviewBundle(lgaName: string | null): QldPlanningBundle {
  return {
    lgaName,
    councilKey: null,
    coverage: "manual_review",
    confidence: "manual_review",
    schemeName: null,
    effectiveFrom: null,
    verificationUrl: QLD_DEVELOPMENT_MAPS,
    fieldProvenance: manualReviewFieldProvenance(),
    subdivisionRule: null,
    sourceNotes: "No validated machine-readable council planning source is configured for this property.",
    zoning: { zoneCode: null, zoneDescription: null, epiName: null, lgaName },
    minimumLotSize: emptyMinimumLotSize(lgaName),
    bushfire: {
      status: "unknown",
      detail: "Bushfire mapping requires council/state map verification",
      items: [],
    },
    flood: {
      status: "unknown",
      detail: "Flood mapping requires council/state map verification",
      items: [],
    },
  };
}

export async function getQldPlanningAtPoint(
  latitude: number,
  longitude: number,
): Promise<QldPlanningBundle> {
  let lgaName: string | null = null;
  try {
    lgaName = await resolveLga(latitude, longitude);
  } catch {
    // Preserve unknown/manual-review behavior if the statewide LGA service is unavailable.
  }
  const source = getQldCouncilRule(lgaName);
  if (!source) return manualReviewBundle(lgaName);

  const [zoneAttrs, minimumLotAttrs, bushfire, flood] = await Promise.all([
    queryPoint(source.zoning.url, latitude, longitude, source.zoning.outFields).catch(() => null),
    source.minimumLotSize
      ? queryPoint(source.minimumLotSize.url, latitude, longitude, source.minimumLotSize.outFields).catch(
          () => null,
        )
      : Promise.resolve(null),
    queryRisk(source.bushfire, latitude, longitude, "Bushfire overlay", source.coverage !== "council_machine"),
    queryRisk(source.flood, latitude, longitude, "Flood overlay", source.coverage !== "council_machine"),
  ]);

  const zoneCode = textValue(zoneAttrs, [
    "ZONE",
    "Zone",
    "QPP_Description",
    "QPP_Zone",
    "ZONE_CODE",
    "LVL1_ZONE",
  ]);
  const zoneDescription = textValue(zoneAttrs, [
    "QPP_Description",
    "ZONE",
    "Zone",
    "LVL1_ZONE",
    "ZONE_PRECINCT",
    "QPP_Precinct",
  ]);
  const area = parseAreaSqm(
    textValue(minimumLotAttrs, ["MLS", "MIN_LOT_SIZE", "LOT_SIZE", "CAT_DESC", "DESCRIPTION"]),
  );
  const coverage: QldPlanningCoverage = zoneCode ? source.coverage : "manual_review";

  return {
    lgaName,
    councilKey: source.key,
    coverage,
    confidence: coverage === "manual_review" ? "manual_review" : source.confidence,
    schemeName: source.schemeName,
    effectiveFrom: source.effectiveFrom,
    verificationUrl: source.verificationUrl,
    fieldProvenance: { ...source.fields },
    subdivisionRule: source.subdivisionRule,
    sourceNotes: source.notes,
    zoning: {
      zoneCode,
      zoneDescription,
      epiName: source.schemeName,
      lgaName,
    },
    minimumLotSize: area
      ? {
          lotSize: area.raw,
          units: area.units,
          lotSizeSqm: area.sqm,
          label: area.label,
          epiName: source.schemeName,
          lgaName,
        }
      : emptyMinimumLotSize(lgaName),
    bushfire,
    flood,
  };
}
