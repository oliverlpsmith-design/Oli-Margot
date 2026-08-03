/**
 * Subdivision potential analysis.
 *
 * The arithmetic test is only one gate. A positive automatic verdict also
 * requires a stored residential/rural zone, a strong Torrens frontage screen,
 * and clear mapped bushfire/flood checks. This is research guidance, not a
 * development approval or site-specific planning opinion.
 */

import { normalisePlanningZone } from "./investmentClassifier";

export type Verdict = "subdividable" | "marginal" | "not_subdividable" | "unknown";
export type SubdivisionRiskStatus = "clear" | "flagged" | "unknown";

export interface SubdivisionAnalysis {
  verdict: Verdict;
  potentialLots: number | null;
  /** Ratio of land area to minimum lot size, rounded to 2 decimals. */
  ratio: number | null;
  explanation: string;
}

/** Lower statewide screen and stronger default used across varying council DCPs. */
export const MIN_TORRENS_FRONTAGE_M = 12;
export const STRONG_TORRENS_FRONTAGE_M = 15;

const PERMISSIVE_SUBDIVISION_ZONES = new Set([
  "R1", "R2", "R3", "R4", "R5",
  "RU1", "RU2", "RU3", "RU4", "RU5", "RU6",
]);

function normaliseZoneCode(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.toUpperCase().match(/\b(?:RU[1-6]|R[1-5])\b/)?.[0] ?? null;
}

function riskStatus(value: SubdivisionRiskStatus | null | undefined): SubdivisionRiskStatus {
  return value ?? "unknown";
}

export function analyseSubdivisionPotential(opts: {
  state?: "NSW" | "QLD" | null;
  landAreaSqm: number | null;
  minLotSizeSqm: number | null;
  zoneCode?: string | null;
  planningEvidence?: "council_machine" | "council_partial" | "manual_review" | "state_machine" | null;
  frontageM?: number | null;
  bushfireStatus?: SubdivisionRiskStatus | null;
  floodStatus?: SubdivisionRiskStatus | null;
}): SubdivisionAnalysis {
  const { landAreaSqm, minLotSizeSqm } = opts;
  const state = opts.state === "QLD" ? "QLD" : "NSW";
  const planningZone = normalisePlanningZone(state, opts.zoneCode);
  const zone = normaliseZoneCode(opts.zoneCode);
  const bushfire = riskStatus(opts.bushfireStatus);
  const flood = riskStatus(opts.floodStatus);

  if (state === "QLD" && opts.planningEvidence !== "council_machine") {
    return {
      verdict: "unknown",
      potentialLots: null,
      ratio: null,
      explanation:
        "QLD local planning controls are council-specific and no validated council-machine zoning/minimum-lot evidence is stored for this property. Manual planning-scheme review is required.",
    };
  }

  if (!opts.zoneCode) {
    return {
      verdict: "unknown",
      potentialLots: null,
      ratio: null,
      explanation: `Subdivision zoning is unavailable, so permissibility cannot be verified from the stored ${state} planning data.`,
    };
  }

  if (state === "QLD") {
    const qldSubdivisionCandidate = Boolean(
      planningZone.family &&
        [
          "residential_low",
          "residential_general",
          "residential_medium",
          "residential_high",
          "rural_residential",
          "rural",
          "township",
          "emerging_community",
        ].includes(planningZone.family),
    );
    if (!qldSubdivisionCandidate) {
      return {
        verdict: "not_subdividable",
        potentialLots: null,
        ratio: null,
        explanation: `QLD zone “${opts.zoneCode}” does not pass the residential/rural candidate screen. Council-specific assessment tables and any specialised pathway still require direct verification.`,
      };
    }
  }

  if (state === "NSW" && (!zone || !PERMISSIVE_SUBDIVISION_ZONES.has(zone))) {
    const displayedZone = opts.zoneCode.toUpperCase();
    return {
      verdict: "not_subdividable",
      potentialLots: null,
      ratio: null,
      explanation: `Zone ${displayedZone} does not pass the automatic residential/rural subdivision-permissibility gate. Verify any specialised subdivision pathway directly in the applicable LEP.`,
    };
  }

  if (bushfire === "flagged") {
    return {
      verdict: "not_subdividable",
      potentialLots: null,
      ratio: null,
      explanation: "Excluded from the automatic subdivision shortlist because the parcel point is mapped as bush fire prone land.",
    };
  }

  if (flood === "flagged") {
    return {
      verdict: "not_subdividable",
      potentialLots: null,
      ratio: null,
      explanation: "Excluded from the automatic subdivision shortlist because the parcel point intersects a mapped flood planning layer.",
    };
  }

  if (landAreaSqm === null || minLotSizeSqm === null || minLotSizeSqm <= 0) {
    return {
      verdict: "unknown",
      potentialLots: null,
      ratio: null,
      explanation:
        `Insufficient data: land area or minimum lot size unavailable. Verify via the applicable ${state} planning scheme and official spatial viewer.`,
    };
  }

  const ratio = Math.round((landAreaSqm / minLotSizeSqm) * 100) / 100;
  const potentialLots = Math.floor(ratio);

  if (ratio < 1.8) {
    return {
      verdict: "not_subdividable",
      potentialLots: 1,
      ratio,
      explanation: `Land area is only ${ratio}× the minimum lot size (${Math.round(minLotSizeSqm).toLocaleString()} m²) — below the two-lot screen.`,
    };
  }

  if (ratio < 2) {
    return {
      verdict: "marginal",
      potentialLots: 1,
      ratio,
      explanation: `Land area is ${ratio}× the minimum lot size — just under the 2× needed for a two-lot subdivision.`,
    };
  }

  if (opts.frontageM != null && opts.frontageM < MIN_TORRENS_FRONTAGE_M) {
    return {
      verdict: "not_subdividable",
      potentialLots,
      ratio,
      explanation: `Known frontage of ${opts.frontageM} m is below the ${MIN_TORRENS_FRONTAGE_M} m lower Torrens-subdivision screen.`,
    };
  }

  const reviewReasons: string[] = [];
  if (opts.frontageM == null) {
    reviewReasons.push("frontage is not advertised");
  } else if (opts.frontageM < STRONG_TORRENS_FRONTAGE_M) {
    reviewReasons.push(`frontage is ${opts.frontageM} m, between the ${MIN_TORRENS_FRONTAGE_M} m lower screen and ${STRONG_TORRENS_FRONTAGE_M} m stronger screen`);
  }
  if (bushfire === "unknown") reviewReasons.push("bushfire mapping is unverified");
  if (flood === "unknown") reviewReasons.push("flood mapping is unverified");

  if (reviewReasons.length > 0) {
    return {
      verdict: "marginal",
      potentialLots,
      ratio,
      explanation: `Lot-size and zoning gates pass, but the result is capped at Marginal because ${reviewReasons.join("; ")}.`,
    };
  }

  if (state === "QLD") {
    return {
      verdict: "marginal",
      potentialLots,
      ratio,
      explanation: `QLD candidate screen only: land area is ${ratio}× the mapped council minimum-lot value, the zone family is potentially relevant, frontage passes the ${STRONG_TORRENS_FRONTAGE_M} m screen, and queried hazard layers are clear. Result remains Marginal because council-specific reconfiguring-a-lot tables, overlays, servicing and site constraints require manual verification.`,
    };
  }

  return {
    verdict: "subdividable",
    potentialLots,
    ratio,
    explanation: `Land area (${Math.round(landAreaSqm).toLocaleString()} m²) is ${ratio}× the minimum lot size (${Math.round(minLotSizeSqm).toLocaleString()} m²), zone ${zone} passes the automatic permissibility screen, frontage is at least ${STRONG_TORRENS_FRONTAGE_M} m, and mapped bushfire/flood checks are clear. Indicative yield: up to ${potentialLots} lots.`,
  };
}

/**
 * Composite 0–100 subdivision score used to rank scan results.
 * Verdict dominates; lot yield and data confidence refine the ordering.
 */
export function scoreSubdivisionPotential(opts: {
  analysis: SubdivisionAnalysis;
  hasLandArea: boolean;
  hasMls: boolean;
  category?: "cash_flow" | "land_only" | "unknown";
}): number {
  const { analysis, hasLandArea, hasMls } = opts;
  let score = 0;
  switch (analysis.verdict) {
    case "subdividable":
      score = 60;
      break;
    case "marginal":
      score = 35;
      break;
    case "not_subdividable":
      score = 5;
      break;
    default:
      score = 15;
  }
  if (analysis.verdict === "subdividable" && analysis.potentialLots) {
    score += Math.min(25, Math.max(0, (analysis.potentialLots - 1) * 5));
  }
  score += (hasLandArea ? 5 : 0) + (hasMls ? 5 : 0);
  if (opts.category === "cash_flow") score += 2;
  return Math.max(0, Math.min(100, score));
}
