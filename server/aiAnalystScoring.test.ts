import { describe, expect, it, vi } from "vitest";
import type { InvokeResult } from "./_core/llm";
import {
  InvalidAnalystResponseError,
  scorePersonaCandidates,
  validateAnalystResponse,
  type AnalystLlmInvoker,
} from "./services/aiAnalystScoring";
import type { AnalystCandidate } from "./services/aiAnalystCandidates";

function candidate(overrides: Partial<AnalystCandidate> = {}): AnalystCandidate {
  return {
    personaKey: "subdivider",
    catalogueListingId: 101,
    listingId: "rea-101",
    hypotheticalBudget: 1_500_000,
    deterministicScore: 72,
    evidenceConfidence: 64,
    confidenceLabel: "moderate",
    inputFingerprint: "a".repeat(64),
    scoreComponents: [],
    riskFlags: [],
    unknowns: ["Frontage is unknown"],
    comparableBenchmark: null,
    cashFlowScenario: null,
    facts: {
      address: "1 Example Street",
      suburb: "Testville",
      postcode: "2000",
      propertyType: "house",
      priceDisplay: "$900,000",
      priceNumeric: 900_000,
      bedrooms: 3,
      bathrooms: 1,
      landAreaSqm: 1_000,
      minLotSizeSqm: 400,
      zoneCode: "R2",
      lgaName: "Example Council",
      potentialLots: 2,
      verdict: "subdividable",
      frontageM: null,
      coveragePct: 20,
      fsrValue: null,
      maxBuildingHeightM: null,
      investmentTags: [],
      headline: "Large block",
      descriptionShort: "Stored listing description.",
      daysOnMarket: 4,
    },
    ...overrides,
  };
}

function response(content: string, model = "gpt-5-mini"): InvokeResult {
  return {
    id: "test",
    created: 0,
    model,
    choices: [{
      index: 0,
      message: { role: "assistant", content },
      finish_reason: "stop",
    }],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  };
}

function validContent(id = 101) {
  return JSON.stringify({
    results: [{
      candidateId: id,
      qualityScore: 99,
      evidenceConfidence: 95,
      rationale: "This is a planning-screen candidate with two theoretical lots and material frontage uncertainty.",
      keyEvidence: ["Two theoretical lots from stored planning inputs"],
      materialRisks: ["Frontage is not known"],
      unknowns: ["Council interpretation and services require verification"],
    }],
  });
}

describe("AI analyst structured scoring", () => {
  it("caps model score movement and evidence confidence deterministically", () => {
    const result = validateAnalystResponse("subdivider", [candidate()], validContent());
    expect(result[0]?.qualityScore).toBe(82);
    expect(result[0]?.evidenceConfidence).toBe(64);
  });

  it("rejects omitted or duplicate candidate ids", () => {
    expect(() =>
      validateAnalystResponse("subdivider", [candidate()], validContent(999)),
    ).toThrow(InvalidAnalystResponseError);
  });

  it("rejects unsupported investment claims", () => {
    const raw = JSON.parse(validContent());
    raw.results[0].rationale =
      "This is guaranteed to be profitable and subdividable based on the stored evidence supplied.";
    expect(() =>
      validateAnalystResponse("subdivider", [candidate()], JSON.stringify(raw)),
    ).toThrow(/unsupported claim/i);
  });

  it("uses gpt-5 only when the primary response is structurally invalid", async () => {
    const invoker = vi
      .fn<AnalystLlmInvoker>()
      .mockResolvedValueOnce(response("not-json"))
      .mockResolvedValueOnce(response(validContent(), "gpt-5"));
    const scored = await scorePersonaCandidates("subdivider", [candidate()], invoker);
    expect(invoker).toHaveBeenCalledTimes(2);
    expect(invoker.mock.calls[0]?.[0].model).toBe("gpt-5-mini");
    expect(invoker.mock.calls[1]?.[0].model).toBe("gpt-5");
    expect(invoker.mock.calls[0]?.[0]).toMatchObject({
      maxCompletionTokens: 8_000,
      reasoning: { effort: "low" },
    });
    expect(invoker.mock.calls[0]?.[0].maxTokens).toBeUndefined();
    expect(scored.source).toBe("fallback");
    expect(scored.llmCallCount).toBe(2);
  });

  it("does not spend a fallback call on an upstream/network failure", async () => {
    const invoker = vi.fn<AnalystLlmInvoker>().mockRejectedValue(new Error("network"));
    await expect(
      scorePersonaCandidates("subdivider", [candidate()], invoker),
    ).rejects.toThrow("network");
    expect(invoker).toHaveBeenCalledTimes(1);
  });

  it("requires explicit scenario wording for cash-flow analysis", () => {
    const cashCandidate = candidate({ personaKey: "cash_flow_hunter" });
    expect(() =>
      validateAnalystResponse("cash_flow_hunter", [cashCandidate], validContent()),
    ).toThrow(/scenario-based/i);
  });

  it("allows explicit negated cautions while still rejecting positive unsupported claims", () => {
    const cashCandidate = candidate({ personaKey: "cash_flow_hunter" });
    const raw = JSON.parse(validContent());
    raw.results[0].rationale =
      "This is a scenario under stated assumptions, not verified positive gearing and not investment advice; rent and expenses require verification.";
    expect(() =>
      validateAnalystResponse("cash_flow_hunter", [cashCandidate], JSON.stringify(raw)),
    ).not.toThrow();

    raw.results[0].rationale =
      "This scenario is verified positive gearing and constitutes investment advice based on the supplied listing.";
    expect(() =>
      validateAnalystResponse("cash_flow_hunter", [cashCandidate], JSON.stringify(raw)),
    ).toThrow(/unsupported claim/i);
  });
});
