import { SUBDIVISION_DEFAULT_MIN_LAND_INPUT } from "@shared/subdivisionDefaults";

export type CatalogueState = "all" | "NSW" | "QLD";

/**
 * State selection should not silently apply filters, but Queensland needs a
 * different starting view from the NSW subdivision-oriented catalogue:
 * QLD planning evidence is deliberately fail-closed to `unknown` until a
 * council source can support a stronger conclusion.
 */
export function applyCatalogueStateDefaults<T extends {
  state: CatalogueState;
  regionId: string;
  zones: string[];
  verdictFilter: "confirmed" | "subdividable" | "marginal" | "all";
  minLand: string;
}>(filters: T, state: CatalogueState): T {
  const next = {
    ...filters,
    state,
    regionId: "all",
    zones: [],
  } as T;

  if (state !== "QLD") {
    return {
      ...next,
      verdictFilter: "confirmed",
      minLand: SUBDIVISION_DEFAULT_MIN_LAND_INPUT,
    } as T;
  }

  return {
    ...next,
    // Keep QLD listings visible even when their planning status correctly
    // remains unverified rather than treating absence of council evidence as
    // a positive subdivision determination.
    verdictFilter: "all",
    // The broad NSW subdivision default would exclude most QLD listings.
    minLand: "",
  } as T;
}
