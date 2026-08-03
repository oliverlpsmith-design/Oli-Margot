import { describe, expect, it } from "vitest";
import {
  rankPersonaEvaluations,
  type RankedEvaluation,
} from "./services/aiAnalystRun";
import type { AnalystCandidate } from "./services/aiAnalystCandidates";

function evaluation(
  id: number,
  qualityScore: number,
  evidenceConfidence: number,
  deterministicScore = qualityScore,
): RankedEvaluation {
  const candidate = {
    personaKey: "subdivider",
    catalogueListingId: id,
    listingId: `rea-${id}`,
    hypotheticalBudget: 1_500_000,
    deterministicScore,
    evidenceConfidence,
    confidenceLabel: evidenceConfidence >= 75 ? "high" : evidenceConfidence >= 50 ? "moderate" : "low",
    inputFingerprint: "a".repeat(64),
    scoreComponents: [],
    riskFlags: [],
    unknowns: ["Independent verification required"],
    comparableBenchmark: null,
    cashFlowScenario: null,
    facts: {
      address: null,
      suburb: null,
      postcode: null,
      propertyType: "house",
      priceDisplay: "$500,000",
      priceNumeric: 500_000,
      bedrooms: 3,
      bathrooms: 1,
      landAreaSqm: 1_000,
      minLotSizeSqm: 400,
      zoneCode: "R2",
      lgaName: null,
      potentialLots: 2,
      verdict: "subdividable",
      frontageM: null,
      coveragePct: null,
      fsrValue: null,
      maxBuildingHeightM: null,
      investmentTags: [],
      headline: null,
      descriptionShort: null,
      daysOnMarket: id,
    },
  } satisfies AnalystCandidate;
  return {
    candidate,
    qualityScore,
    evidenceConfidence,
    rationale: "A sufficiently long screening rationale for deterministic ranking tests.",
    keyEvidence: ["Evidence"],
    materialRisks: [],
    unknowns: ["Unknown"],
    model: "gpt-5-mini",
    analysisSource: "primary",
    promptTokens: 0,
    completionTokens: 0,
    recommendationRank: null,
  };
}

describe("AI analyst run ranking", () => {
  it("ranks quality first, then confidence, and persists exactly three current picks", () => {
    const ranked = rankPersonaEvaluations([
      evaluation(1, 75, 60),
      evaluation(2, 80, 40),
      evaluation(3, 75, 80),
      evaluation(4, 70, 90),
    ]);
    expect(ranked.map(row => row.candidate.catalogueListingId)).toEqual([2, 3, 1, 4]);
    expect(ranked.map(row => row.recommendationRank)).toEqual([1, 2, 3, null]);
  });

  it("uses deterministic score and freshness as stable tie-breakers", () => {
    const ranked = rankPersonaEvaluations([
      evaluation(4, 75, 60, 70),
      evaluation(2, 75, 60, 80),
      evaluation(1, 75, 60, 80),
    ]);
    expect(ranked.map(row => row.candidate.catalogueListingId)).toEqual([1, 2, 4]);
  });
});
