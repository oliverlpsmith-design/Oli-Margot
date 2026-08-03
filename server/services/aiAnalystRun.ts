import { and, desc, eq, inArray, lt } from "drizzle-orm";
import {
  aiAgentScores,
  aiAnalystRuns,
  scanRuns,
  type AiAgentScore,
  type InsertAiAgentScore,
} from "../../drizzle/schema";
import { getDb } from "../db";
import {
  ANALYST_FALLBACK_MODEL,
  ANALYST_PRIMARY_MODEL,
  PICKS_PER_PERSONA,
  buildPersonaCandidateSets,
  loadAnalystSourceRows,
  type AnalystCandidate,
  type AnalystPersonaKey,
} from "./aiAnalystCandidates";
import {
  scorePersonaCandidates,
  type AnalystLlmInvoker,
  type StructuredAnalystScore,
} from "./aiAnalystScoring";

const ACTIVE_LOCK = "active";
const STALE_RUN_MS = 30 * 60_000;
const PERSONA_ORDER: AnalystPersonaKey[] = [
  "subdivider",
  "cash_flow_hunter",
  "value_finder",
];

export interface AnalystRunRequest {
  trigger: "scheduled" | "admin";
  taskUid?: string;
  requestedByUserId?: number;
  now?: Date;
  invoker?: AnalystLlmInvoker;
}

export interface AnalystRunSummary {
  started: boolean;
  runId: number;
  status: "running" | "completed";
  candidateCount: number;
  scoredCount: number;
  reusedCount: number;
  llmCallCount: number;
  promptTokens: number;
  completionTokens: number;
  picksPerPersona: Record<AnalystPersonaKey, number>;
}

export interface RankedEvaluation {
  candidate: AnalystCandidate;
  qualityScore: number;
  evidenceConfidence: number;
  rationale: string;
  keyEvidence: string[];
  materialRisks: string[];
  unknowns: string[];
  model: string;
  analysisSource: "primary" | "fallback" | "reused";
  promptTokens: number;
  completionTokens: number;
  recommendationRank: number | null;
}

export class AnalystRunInProgressError extends Error {
  constructor(public readonly runId: number) {
    super(`AI Investment Analyst run ${runId} is already in progress`);
    this.name = "AnalystRunInProgressError";
  }
}

function dbErrorText(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 2_000) : String(error).slice(0, 2_000);
}

function isDuplicateKeyError(error: unknown): boolean {
  const record = error as { code?: string; errno?: number; message?: string };
  return record.code === "ER_DUP_ENTRY" || record.errno === 1062 || /duplicate entry/i.test(record.message ?? "");
}

async function acquireRun(request: AnalystRunRequest): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = request.now ?? new Date();
  const staleCutoff = new Date(now.getTime() - STALE_RUN_MS);

  const staleRun = await db
    .select({ id: aiAnalystRuns.id })
    .from(aiAnalystRuns)
    .where(
      and(
        eq(aiAnalystRuns.activeLock, ACTIVE_LOCK),
        eq(aiAnalystRuns.status, "running"),
        lt(aiAnalystRuns.startedAt, staleCutoff),
      ),
    )
    .limit(1);
  if (staleRun[0]) {
    await db.transaction(async tx => {
      await tx
        .delete(aiAgentScores)
        .where(eq(aiAgentScores.runId, staleRun[0]!.id));
      await tx
        .update(aiAnalystRuns)
        .set({
          activeLock: null,
          status: "failed",
          error: "Run exceeded the 30-minute lock window and was released before a new attempt.",
          finishedAt: now,
        })
        .where(eq(aiAnalystRuns.id, staleRun[0]!.id));
    });
  }

  const latestScan = await db
    .select({ id: scanRuns.id })
    .from(scanRuns)
    .where(eq(scanRuns.status, "completed"))
    .orderBy(desc(scanRuns.finishedAt), desc(scanRuns.id))
    .limit(1);

  try {
    const inserted = await db.insert(aiAnalystRuns).values({
      activeLock: ACTIVE_LOCK,
      trigger: request.trigger,
      sourceScanRunId: latestScan[0]?.id ?? null,
      taskUid: request.taskUid ?? null,
      requestedByUserId: request.requestedByUserId ?? null,
      primaryModel: ANALYST_PRIMARY_MODEL,
      fallbackModel: ANALYST_FALLBACK_MODEL,
      startedAt: now,
    });
    const insertId = Number(inserted[0].insertId);
    if (!Number.isInteger(insertId) || insertId <= 0) {
      throw new Error("Failed to obtain the analyst run id");
    }
    return insertId;
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const active = await db
      .select({ id: aiAnalystRuns.id })
      .from(aiAnalystRuns)
      .where(eq(aiAnalystRuns.activeLock, ACTIVE_LOCK))
      .limit(1);
    throw new AnalystRunInProgressError(active[0]?.id ?? 0);
  }
}

async function latestReusableScores(
  personaKey: AnalystPersonaKey,
  candidates: AnalystCandidate[],
): Promise<Map<number, AiAgentScore>> {
  if (candidates.length === 0) return new Map();
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({ score: aiAgentScores })
    .from(aiAgentScores)
    .innerJoin(aiAnalystRuns, eq(aiAgentScores.runId, aiAnalystRuns.id))
    .where(
      and(
        eq(aiAnalystRuns.status, "completed"),
        eq(aiAgentScores.personaKey, personaKey),
        inArray(
          aiAgentScores.catalogueListingId,
          candidates.map(candidate => candidate.catalogueListingId),
        ),
      ),
    )
    .orderBy(desc(aiAgentScores.analysedAt), desc(aiAgentScores.id));

  const latest = new Map<number, AiAgentScore>();
  for (const row of rows) {
    if (!latest.has(row.score.catalogueListingId)) {
      latest.set(row.score.catalogueListingId, row.score);
    }
  }
  return latest;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(item => typeof item === "string") : [];
}

function newEvaluation(
  candidate: AnalystCandidate,
  score: StructuredAnalystScore,
  model: string,
  source: "primary" | "fallback",
  promptTokens: number,
  completionTokens: number,
): RankedEvaluation {
  return {
    candidate,
    qualityScore: score.qualityScore,
    evidenceConfidence: score.evidenceConfidence,
    rationale: score.rationale,
    keyEvidence: score.keyEvidence,
    materialRisks: score.materialRisks,
    unknowns: score.unknowns,
    model,
    analysisSource: source,
    promptTokens,
    completionTokens,
    recommendationRank: null,
  };
}

function reusedEvaluation(
  candidate: AnalystCandidate,
  previous: AiAgentScore,
): RankedEvaluation {
  return {
    candidate,
    qualityScore: previous.qualityScore,
    evidenceConfidence: Math.min(previous.evidenceConfidence, candidate.evidenceConfidence),
    rationale: previous.rationale,
    keyEvidence: stringArray(previous.keyEvidence),
    materialRisks: stringArray(previous.materialRisks),
    unknowns: stringArray(previous.unknowns),
    model: previous.model,
    analysisSource: "reused",
    promptTokens: 0,
    completionTokens: 0,
    recommendationRank: null,
  };
}

export function rankPersonaEvaluations(
  evaluations: RankedEvaluation[],
): RankedEvaluation[] {
  const sorted = [...evaluations].sort((a, b) =>
    b.qualityScore - a.qualityScore ||
    b.evidenceConfidence - a.evidenceConfidence ||
    b.candidate.deterministicScore - a.candidate.deterministicScore ||
    a.candidate.facts.daysOnMarket - b.candidate.facts.daysOnMarket ||
    a.candidate.catalogueListingId - b.candidate.catalogueListingId,
  );
  return sorted.map((evaluation, index) => ({
    ...evaluation,
    recommendationRank: index < PICKS_PER_PERSONA ? index + 1 : null,
  }));
}

function scoreRows(runId: number, evaluations: RankedEvaluation[]): InsertAiAgentScore[] {
  return evaluations.map(evaluation => ({
    runId,
    catalogueListingId: evaluation.candidate.catalogueListingId,
    personaKey: evaluation.candidate.personaKey,
    hypotheticalBudget: evaluation.candidate.hypotheticalBudget,
    qualityScore: evaluation.qualityScore,
    evidenceConfidence: evaluation.evidenceConfidence,
    deterministicScore: evaluation.candidate.deterministicScore,
    recommendationRank: evaluation.recommendationRank,
    eligible: true,
    analysisSource: evaluation.analysisSource,
    inputFingerprint: evaluation.candidate.inputFingerprint,
    model: evaluation.model,
    rationale: evaluation.rationale,
    keyEvidence: evaluation.keyEvidence,
    materialRisks: evaluation.materialRisks,
    unknowns: evaluation.unknowns,
    scoreComponents: evaluation.candidate.scoreComponents,
    scenarioAssumptions: evaluation.candidate.cashFlowScenario,
    promptTokens: evaluation.promptTokens,
    completionTokens: evaluation.completionTokens,
  }));
}

async function markRunFailed(runId: number, error: unknown, finishedAt: Date): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.transaction(async tx => {
    await tx.delete(aiAgentScores).where(eq(aiAgentScores.runId, runId));
    await tx
      .update(aiAnalystRuns)
      .set({
        activeLock: null,
        status: "failed",
        error: dbErrorText(error),
        finishedAt,
      })
      .where(eq(aiAnalystRuns.id, runId));
  });
}

export async function runAiInvestmentAnalyst(
  request: AnalystRunRequest,
): Promise<AnalystRunSummary> {
  let runId: number;
  try {
    runId = await acquireRun(request);
  } catch (error) {
    if (error instanceof AnalystRunInProgressError) {
      return {
        started: false,
        runId: error.runId,
        status: "running",
        candidateCount: 0,
        scoredCount: 0,
        reusedCount: 0,
        llmCallCount: 0,
        promptTokens: 0,
        completionTokens: 0,
        picksPerPersona: { subdivider: 0, cash_flow_hunter: 0, value_finder: 0 },
      };
    }
    throw error;
  }

  const now = request.now ?? new Date();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let candidateCount = 0;
  let scoredCount = 0;
  let reusedCount = 0;
  let llmCallCount = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  const picksPerPersona: Record<AnalystPersonaKey, number> = {
    subdivider: 0,
    cash_flow_hunter: 0,
    value_finder: 0,
  };

  try {
    const sourceRows = await loadAnalystSourceRows();
    if (sourceRows.length === 0) {
      throw new Error("No active, price-known catalogue rows were available for analysis");
    }
    const candidateSets = buildPersonaCandidateSets(sourceRows, now);

    const personaResults = await Promise.all(
      PERSONA_ORDER.map(async personaKey => {
        const candidates = candidateSets[personaKey];
        const previousByListing = await latestReusableScores(personaKey, candidates);
        const reusable: RankedEvaluation[] = [];
        const changed: AnalystCandidate[] = [];

        for (const candidate of candidates) {
          const previous = previousByListing.get(candidate.catalogueListingId);
          if (previous?.inputFingerprint === candidate.inputFingerprint) {
            reusable.push(reusedEvaluation(candidate, previous));
          } else {
            changed.push(candidate);
          }
        }

        const scored = await scorePersonaCandidates(
          personaKey,
          changed,
          request.invoker,
        );
        const candidatesById = new Map(
          changed.map(candidate => [candidate.catalogueListingId, candidate]),
        );
        const perScorePromptTokens = scored.results.length
          ? Math.floor(scored.promptTokens / scored.results.length)
          : 0;
        const perScoreCompletionTokens = scored.results.length
          ? Math.floor(scored.completionTokens / scored.results.length)
          : 0;
        const fresh = scored.results.map(result => {
          const candidate = candidatesById.get(result.candidateId);
          if (!candidate) {
            throw new Error(`Scoring returned an unknown candidate id: ${result.candidateId}`);
          }
          return newEvaluation(
            candidate,
            result,
            scored.model,
            scored.source,
            perScorePromptTokens,
            perScoreCompletionTokens,
          );
        });
        return {
          personaKey,
          candidateCount: candidates.length,
          freshCount: fresh.length,
          reusedCount: reusable.length,
          llmCallCount: scored.llmCallCount,
          promptTokens: scored.promptTokens,
          completionTokens: scored.completionTokens,
          ranked: rankPersonaEvaluations([...reusable, ...fresh]),
        };
      }),
    );

    const allRows: InsertAiAgentScore[] = [];
    for (const result of personaResults) {
      candidateCount += result.candidateCount;
      scoredCount += result.freshCount;
      reusedCount += result.reusedCount;
      llmCallCount += result.llmCallCount;
      promptTokens += result.promptTokens;
      completionTokens += result.completionTokens;
      picksPerPersona[result.personaKey] = result.ranked.filter(
        row => row.recommendationRank !== null,
      ).length;
      allRows.push(...scoreRows(runId, result.ranked));
    }

    const finishedAt = new Date();
    await db.transaction(async tx => {
      if (allRows.length > 0) {
        await tx.insert(aiAgentScores).values(allRows);
      }
      await tx
        .update(aiAnalystRuns)
        .set({
          activeLock: null,
          status: "completed",
          candidateCount,
          scoredCount,
          reusedCount,
          llmCallCount,
          promptTokens,
          completionTokens,
          error: null,
          finishedAt,
        })
        .where(eq(aiAnalystRuns.id, runId));
    });

    return {
      started: true,
      runId,
      status: "completed",
      candidateCount,
      scoredCount,
      reusedCount,
      llmCallCount,
      promptTokens,
      completionTokens,
      picksPerPersona,
    };
  } catch (error) {
    await markRunFailed(runId, error, new Date());
    throw error;
  }
}
