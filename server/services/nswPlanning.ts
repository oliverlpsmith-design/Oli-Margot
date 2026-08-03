/**
 * NSW Planning Portal spatial data client.
 * Queries the EPI Primary Planning Layers ArcGIS REST service used by the
 * NSW Planning Portal Spatial Viewer.
 *
 * Layer 2 = Land Zoning, Layer 4 = Minimum Lot Size.
 * Service: https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer
 */

const ARCGIS_BASE =
  "https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer";

interface ArcGisQueryResponse {
  features?: Array<{ attributes: Record<string, unknown> }>;
  error?: { message?: string };
}

async function queryLayerAtPoint(
  layerId: number,
  latitude: number,
  longitude: number,
  outFields: string,
): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({
    geometry: `${longitude},${latitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4283",
    spatialRel: "esriSpatialRelIntersects",
    outFields,
    returnGeometry: "false",
    f: "json",
  });
  const res = await fetch(`${ARCGIS_BASE}/${layerId}/query?${params.toString()}`);
  if (!res.ok) throw new Error(`NSW Planning query failed with status ${res.status}`);
  const data = (await res.json()) as ArcGisQueryResponse;
  if (data.error) throw new Error(`NSW Planning query error: ${data.error.message ?? "unknown"}`);
  return data.features?.[0]?.attributes ?? null;
}

export interface MinimumLotSizeResult {
  lotSize: number | null;
  units: string | null;
  /** Minimum lot size normalised to square metres, when units are known. */
  lotSizeSqm: number | null;
  label: string | null;
  epiName: string | null;
  lgaName: string | null;
}

export async function getMinimumLotSize(latitude: number, longitude: number): Promise<MinimumLotSizeResult> {
  const attrs = await queryLayerAtPoint(4, latitude, longitude, "LOT_SIZE,UNITS,EPI_NAME,LGA_NAME");
  if (!attrs) {
    return { lotSize: null, units: null, lotSizeSqm: null, label: null, epiName: null, lgaName: null };
  }
  const lotSize = typeof attrs.LOT_SIZE === "number" ? attrs.LOT_SIZE : null;
  const units = typeof attrs.UNITS === "string" ? attrs.UNITS : null;
  let lotSizeSqm: number | null = null;
  if (lotSize !== null) {
    if (units === "ha") lotSizeSqm = lotSize * 10000;
    else if (units === "m²" || units === "m2" || units === null || units === "NA") lotSizeSqm = lotSize;
  }
  return {
    lotSize,
    units,
    lotSizeSqm,
    label: lotSize !== null ? `${lotSize} ${units ?? "m²"}` : null,
    epiName: typeof attrs.EPI_NAME === "string" ? attrs.EPI_NAME : null,
    lgaName: typeof attrs.LGA_NAME === "string" ? attrs.LGA_NAME : null,
  };
}

export interface ZoningResult {
  zoneCode: string | null;
  zoneDescription: string | null;
  epiName: string | null;
  lgaName: string | null;
}

export async function getZoning(latitude: number, longitude: number): Promise<ZoningResult> {
  const attrs = await queryLayerAtPoint(2, latitude, longitude, "SYM_CODE,LAY_CLASS,EPI_NAME,LGA_NAME");
  if (!attrs) return { zoneCode: null, zoneDescription: null, epiName: null, lgaName: null };
  return {
    zoneCode: typeof attrs.SYM_CODE === "string" ? attrs.SYM_CODE : null,
    zoneDescription: typeof attrs.LAY_CLASS === "string" ? attrs.LAY_CLASS : null,
    epiName: typeof attrs.EPI_NAME === "string" ? attrs.EPI_NAME : null,
    lgaName: typeof attrs.LGA_NAME === "string" ? attrs.LGA_NAME : null,
  };
}
