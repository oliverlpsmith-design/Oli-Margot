export const SUBDIVISION_DEFAULT_MIN_LAND_ACRES = 100;
export const SUBDIVISION_DEFAULT_MIN_LAND_SQM = 404_700;
export const SUBDIVISION_DEFAULT_MIN_LAND_INPUT = `${SUBDIVISION_DEFAULT_MIN_LAND_ACRES} acres`;
export const SUBDIVISION_BROWSE_HREF = "/niche/subdivision";

/**
 * Apply the subdivision catalogue floor only when no land-size value was
 * supplied. An explicit zero is preserved so users can intentionally save a
 * search with no minimum land-size filter.
 */
export function withSubdivisionDefaultMinLand<T extends { minLandAreaSqm?: number }>(
  filters: T,
): T & { minLandAreaSqm: number } {
  if (filters.minLandAreaSqm !== undefined) {
    return filters as T & { minLandAreaSqm: number };
  }
  return { ...filters, minLandAreaSqm: SUBDIVISION_DEFAULT_MIN_LAND_SQM };
}
