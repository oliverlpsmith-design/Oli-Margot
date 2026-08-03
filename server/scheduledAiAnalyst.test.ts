import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  run: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: { authenticateRequest: mocks.authenticate },
}));
vi.mock("./services/aiAnalystRun", () => ({
  runAiInvestmentAnalyst: mocks.run,
}));

import { aiInvestmentAnalystHandler } from "./scheduledAiAnalyst";

function responseHarness() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return {
    res: { status, json } as unknown as Response,
    status,
    json,
  };
}

describe("scheduled AI analyst handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.run.mockResolvedValue({ started: true, runId: 4, status: "completed" });
  });

  it("rejects non-cron callers without running analysis", async () => {
    mocks.authenticate.mockResolvedValue({ isCron: false });
    const { res, status, json } = responseHarness();
    await aiInvestmentAnalystHandler(
      { originalUrl: "/api/scheduled/aiInvestmentAnalyst" } as Request,
      res,
    );
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: "cron-only endpoint" });
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("runs with the authenticated cron task uid", async () => {
    mocks.authenticate.mockResolvedValue({ isCron: true, taskUid: "task-123" });
    const { res, json } = responseHarness();
    await aiInvestmentAnalystHandler(
      { originalUrl: "/api/scheduled/aiInvestmentAnalyst" } as Request,
      res,
    );
    expect(mocks.run).toHaveBeenCalledWith({
      trigger: "scheduled",
      taskUid: "task-123",
    });
    expect(json).toHaveBeenCalledWith({
      ok: true,
      result: { started: true, runId: 4, status: "completed" },
    });
  });
});
