/**
 * NSW risk layer checks — bushfire, biodiversity, flood, heritage, acid sulfate, FSR, building height.
 * All queried live by parcel coordinates from official government ArcGIS
 * services (same data behind the NSW Spatial Viewer). No API key required.
 */

const HAZARD_BASE =
  "https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/Hazard/MapServer";
const EPI_BASE =
  "https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer";
const BFPL_BASE =
  "https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Fire/BFPL/MapServer";
const BVM_BASE =
  "https://www.lmbc.nsw.gov.au/arcgis/rest/services/BV/BiodiversityValues/MapServer";
const PROT_BASE =
  "https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/Protection/MapServer";

export type RiskStatus = "clear" | "flagged" | "unknown";

export interface RiskLayerResult {
  status: RiskStatus;
  /** Short human-readable finding, e.g. "Vegetation Category 1" */
  detail: string | null;
  /** Extra context, e.g. heritage item name or EPI name */
  items: string[];
}

export interface RiskAssessment {
  bushfire: RiskLayerResult;
  biodiversity: RiskLayerResult;
  flood: RiskLayerResult;
  heritage: RiskLayerResult;
  acidSulfate: RiskLayerResult;
  /** FSR value (e.g. 0.5) or null if not mapped. Status "clear" = no FSR control. */
  fsr: { status: RiskStatus; value: number | null; detail: string | null };
  /** Max building height in metres or null if not mapped. */
  buildingHeight: { status: RiskStatus; value: number | null; detail: string | null };
}

async function queryLayer(
  base: string,
  layerId: number,
  lng: number,
  lat: number,
  outFields: string,
): Promise<Record<string, unknown>[] | null> {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields,
    returnGeometry: "false",
    f: "json",
  });
  try {
    const res = await fetch(`${base}/${layerId}/query?${params}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: { attributes: Record<string, unknown> }[];
      error?: unknown;
    };
    if (data.error) return null;
    return (data.features ?? []).map((f) => f.attributes);
  } catch {
    return null;
  }
}

export async function checkBushfire(lng: number, lat: number): Promise<RiskLayerResult> {
  const attrs = await queryLayer(BFPL_BASE, 0, lng, lat, "Category,d_Category");
  if (attrs === null) return { status: "unknown", detail: "Service unavailable", items: [] };
  if (attrs.length === 0)
    return { status: "clear", detail: "Not mapped as bush fire prone land", items: [] };
  const cats = Array.from(
    new Set(attrs.map((a) => String(a.d_Category ?? `Category ${a.Category}`))),
  );
  return {
    status: "flagged",
    detail: `Bush fire prone land — ${cats.join(", ")}`,
    items: cats,
  };
}

export async function checkBiodiversity(lng: number, lat: number): Promise<RiskLayerResult> {
  const attrs = await queryLayer(BVM_BASE, 0, lng, lat, "BV_Category,BOSET_Class");
  if (attrs === null) return { status: "unknown", detail: "Service unavailable", items: [] };
  if (attrs.length === 0)
    return { status: "clear", detail: "Not on the Biodiversity Values Map", items: [] };
  const cats = Array.from(
    new Set(attrs.map((a) => String(a.BV_Category ?? a.BOSET_Class ?? "Biodiversity value"))),
  );
  return {
    status: "flagged",
    detail: `On the Biodiversity Values Map — ${cats.join(", ")}`,
    items: cats,
  };
}

export async function checkFlood(lng: number, lat: number): Promise<RiskLayerResult> {
  const attrs = await queryLayer(HAZARD_BASE, 1, lng, lat, "EPI_NAME,LGA_NAME,LAY_CLASS");
  if (attrs === null) return { status: "unknown", detail: "Service unavailable", items: [] };
  if (attrs.length === 0)
    return {
      status: "clear",
      detail: "No mapped flood planning layer at this point (statewide coverage is incomplete — confirm via council S10.7 certificate)",
      items: [],
    };
  const classes = Array.from(new Set(attrs.map((a) => String(a.LAY_CLASS ?? "Flood layer"))));
  return {
    status: "flagged",
    detail: `Within mapped ${classes.join(", ")}`,
    items: attrs.map((a) => `${a.LAY_CLASS} — ${a.EPI_NAME}`),
  };
}

export async function checkHeritage(lng: number, lat: number): Promise<RiskLayerResult> {
  const attrs = await queryLayer(EPI_BASE, 0, lng, lat, "H_NAME,SIG,LAY_CLASS,EPI_NAME");
  if (attrs === null) return { status: "unknown", detail: "Service unavailable", items: [] };
  if (attrs.length === 0)
    return { status: "clear", detail: "No heritage item or conservation area mapped", items: [] };
  const items = attrs.map(
    (a) => `${a.H_NAME ?? "Heritage"} (${a.SIG ?? "?"} — ${a.LAY_CLASS ?? "?"})`,
  );
  return {
    status: "flagged",
    detail: `Heritage constraint — ${items[0]}${items.length > 1 ? ` +${items.length - 1} more` : ""}`,
    items,
  };
}

export async function checkAcidSulfate(lng: number, lat: number): Promise<RiskLayerResult> {
  const attrs = await queryLayer(PROT_BASE, 1, lng, lat, "LAY_CLASS,EPI_NAME");
  if (attrs === null) return { status: "unknown", detail: "Service unavailable", items: [] };
  if (attrs.length === 0)
    return { status: "clear", detail: "Not mapped on Acid Sulfate Soils layer", items: [] };
  const classes = Array.from(new Set(attrs.map((a) => String(a.LAY_CLASS ?? "ASS"))));
  return {
    status: "flagged",
    detail: `Acid Sulfate Soils — ${classes.join(", ")}`,
    items: attrs.map((a) => `${a.LAY_CLASS} — ${a.EPI_NAME}`),
  };
}

export async function checkFSR(lng: number, lat: number): Promise<{ status: RiskStatus; value: number | null; detail: string | null }> {
  const attrs = await queryLayer(EPI_BASE, 1, lng, lat, "FSR,LAY_CLASS,EPI_NAME");
  if (attrs === null) return { status: "unknown", value: null, detail: "Service unavailable" };
  if (attrs.length === 0)
    return { status: "clear", value: null, detail: "No FSR control mapped in LEP" };
  const fsr = Number(attrs[0].FSR);
  if (isNaN(fsr)) return { status: "unknown", value: null, detail: "FSR value not readable" };
  return {
    status: "flagged",
    value: fsr,
    detail: `Maximum Floor Space Ratio: ${fsr}:1 (${attrs[0].LAY_CLASS ?? "FSR control"})`,
  };
}

export async function checkBuildingHeight(lng: number, lat: number): Promise<{ status: RiskStatus; value: number | null; detail: string | null }> {
  const attrs = await queryLayer(EPI_BASE, 5, lng, lat, "MAX_B_H_M,LAY_CLASS,EPI_NAME");
  if (attrs === null) return { status: "unknown", value: null, detail: "Service unavailable" };
  if (attrs.length === 0)
    return { status: "clear", value: null, detail: "No height control mapped in LEP" };
  const height = Number(attrs[0].MAX_B_H_M);
  if (isNaN(height)) return { status: "unknown", value: null, detail: "Height value not readable" };
  return {
    status: "flagged",
    value: height,
    detail: `Maximum building height: ${height}m (${attrs[0].LAY_CLASS ?? "height control"})`,
  };
}

/** Run all seven risk/planning checks in parallel. */
export async function assessRisks(lng: number, lat: number): Promise<RiskAssessment> {
  const [bushfire, biodiversity, flood, heritage, acidSulfate, fsr, buildingHeight] = await Promise.all([
    checkBushfire(lng, lat),
    checkBiodiversity(lng, lat),
    checkFlood(lng, lat),
    checkHeritage(lng, lat),
    checkAcidSulfate(lng, lat),
    checkFSR(lng, lat),
    checkBuildingHeight(lng, lat),
  ]);
  return { bushfire, biodiversity, flood, heritage, acidSulfate, fsr, buildingHeight };
}

/** Deep links for manual verification, per property. */
export function verificationLinks(lng: number, lat: number, address: string) {
  const enc = encodeURIComponent(address);
  return {
    spatialViewer: `https://www.planningportal.nsw.gov.au/spatialviewer/#/find-a-property/address`,
    rfsBushfire: `https://www.rfs.nsw.gov.au/plan-and-prepare/building-in-a-bush-fire-area/planning-for-bush-fire-protection/bush-fire-prone-land/check-bfpl`,
    bvmTool: `https://www.environment.nsw.gov.au/topics/animals-and-plants/biodiversity-offsets-scheme/about-the-biodiversity-offsets-scheme/when-does-bos-apply/biodiversity-values-map`,
    googleStreetView: `https://www.google.com/maps?q=&layer=c&cbll=${lat},${lng}`,
    googleMaps: `https://www.google.com/maps/search/?api=1&query=${enc}`,
  };
}
