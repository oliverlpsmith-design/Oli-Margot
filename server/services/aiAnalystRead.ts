import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import {
  aiAgentScores,
  aiAnalystRuns,
  catalogueListings,
  type AiAnalystRun,
} from "../../drizzle/schema";
import { getDb } from "../db";
import {
  ANALYST_PERSONAS,
  type AnalystPersonaKey,
  type CashFlowScenario,
  type ScoreComponent,
} from "./aiAnalystCandidates";

const PERSONA_ORDER: AnalystPersonaKey[] = [
  "subdivider",
  "cash_flow_hunter",
  "value_finder",
];

export function canSurfaceAnalystRun(
  run: Pick<AiAnalystRun, "status"> | null | undefined,
): boolean {
  return run?.status === "completed";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function scoreComponents(value: unknown): ScoreComponent[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ScoreComponent => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    return (
      typeof row.key === "string" &&
      typeof row.label === "string" &&
      typeof row.points === "number" &&
      typeof row.maxPoints === "number" &&
      typeof row.detail === "string"
    );
  });
}

function cashFlowScenario(value: unknown): CashFlowScenario | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<CashFlowScenario>;
  return row.label === "scenario_based" ? (row as CashFlowScenario) : null;
}

export async function getCurrentAgentPicks() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const completedRuns = await db
    .select({
      id: aiAnalystRuns.id,
      status: aiAnalystRuns.status,
      trigger: aiAnalystRuns.trigger,
      sourceScanRunId: aiAnalystRuns.sourceScanRunId,
      candidateCount: aiAnalystRuns.candidateCount,
      scoredCount: aiAnalystRuns.scoredCount,
      reusedCount: aiAnalystRuns.reusedCount,
      startedAt: aiAnalystRuns.startedAt,
      finishedAt: aiAnalystRuns.finishedAt,
    })
    .from(aiAnalystRuns)
    .where(eq(aiAnalystRuns.status, "completed"))
    .orderBy(desc(aiAnalystRuns.finishedAt), desc(aiAnalystRuns.id))
    .limit(1);
  const run = completedRuns[0] ?? null;

  const emptyPersonas = PERSONA_ORDER.map(key => ({
    ...ANALYST_PERSONAS[key],
    picks: [],
  }));
  if (!run || !canSurfaceAnalystRun(run)) {
    return { run: null, personas: emptyPersonas };
  }

  const rows = await db
    .select({
      score: aiAgentScores,
      listing: {
        id: catalogueListings.id,
        listingId: catalogueListings.listingId,
        address: catalogueListings.address,
        suburb: catalogueListings.suburb,
        postcode: catalogueListings.postcode,
        state: catalogueListings.state,
        propertyType: catalogueListings.propertyType,
        priceDisplay: catalogueListings.priceDisplay,
        priceNumeric: catalogueListings.priceNumeric,
        bedrooms: catalogueListings.bedrooms,
        bathrooms: catalogueListings.bathrooms,
        landAreaSqm: catalogueListings.landAreaSqm,
        minLotSizeSqm: catalogueListings.minLotSizeSqm,
        minLotSizeLabel: catalogueListings.minLotSizeLabel,
        zoneCode: catalogueListings.zoneCode,
        lgaName: catalogueListings.lgaName,
        potentialLots: catalogueListings.potentialLots,
        verdict: catalogueListings.verdict,
        frontageM: catalogueListings.frontageM,
        coveragePct: catalogueListings.coveragePct,
        fsrValue: catalogueListings.fsrValue,
        maxBuildingHeightM: catalogueListings.maxBuildingHeightM,
        bushfireStatus: catalogueListings.bushfireStatus,
        floodStatus: catalogueListings.floodStatus,
        heritageFlag: catalogueListings.heritageFlag,
        biodiversityFlag: catalogueListings.biodiversityFlag,
        investmentTags: catalogueListings.investmentTags,
        listingUrl: catalogueListings.listingUrl,
        imageUrl: catalogueListings.imageUrl,
        listedAt: catalogueListings.listedAt,
        firstSeenAt: catalogueListings.firstSeenAt,
        updatedAt: catalogueListings.updatedAt,
      },
    })
    .from(aiAgentScores)
    .innerJoin(
      catalogueListings,
      eq(aiAgentScores.catalogueListingId, catalogueListings.id),
    )
    .where(
      and(
        eq(aiAgentScores.runId, run.id),
        eq(aiAgentScores.eligible, true),
        isNotNull(aiAgentScores.recommendationRank),
        eq(catalogueListings.status, "active"),
      ),
    )
    .orderBy(
      asc(aiAgentScores.personaKey),
      asc(aiAgentScores.recommendationRank),
    );

  const personas = PERSONA_ORDER.map(key => ({
    ...ANALYST_PERSONAS[key],
    picks: rows
      .filter(row => row.score.personaKey === key)
      .map(row => ({
        rank: row.score.recommendationRank!,
        qualityScore: row.score.qualityScore,
        evidenceConfidence: row.score.evidenceConfidence,
        deterministicScore: row.score.deterministicScore,
        rationale: row.score.rationale,
        keyEvidence: stringArray(row.score.keyEvidence),
        materialRisks: stringArray(row.score.materialRisks),
        unknowns: stringArray(row.score.unknowns),
        scoreComponents: scoreComponents(row.score.scoreComponents),
        scenarioAssumptions: cashFlowScenario(row.score.scenarioAssumptions),
        analysedAt: row.score.analysedAt,
        listing: row.listing,
      })),
  }));

  return { run, personas };
}

export async function getAnalystRunHistory(limit = 12) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(aiAnalystRuns)
    .orderBy(desc(aiAnalystRuns.startedAt), desc(aiAnalystRuns.id))
    .limit(Math.min(30, Math.max(1, limit)));
}
