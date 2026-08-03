import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  currentPicks: vi.fn(),
  history: vi.fn(),
  run: vi.fn(),
}));

vi.mock("./services/aiAnalystRead", () => ({
  getCurrentAgentPicks: mocks.currentPicks,
  getAnalystRunHistory: mocks.history,
}));
vi.mock("./services/aiAnalystRun", () => ({
  runAiInvestmentAnalyst: mocks.run,
}));

import { appRouter } from "./routers";

function context(role: "admin" | "user" | null): TrpcContext {
  const user = role
    ? {
        id: role === "admin" ? 10 : 20,
        openId: `${role}-open-id`,
        email: `${role}@example.com`,
        name: role,
        loginMethod: "manus",
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }
    : null;
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("AI analyst router permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentPicks.mockResolvedValue({ run: null, personas: [] });
    mocks.history.mockResolvedValue([]);
    mocks.run.mockResolvedValue({ started: true, runId: 1, status: "completed" });
  });

  it("allows anonymous visitors to read current completed picks", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.aiAnalyst.currentPicks()).resolves.toEqual({
      run: null,
      personas: [],
    });
    expect(mocks.currentPicks).toHaveBeenCalledOnce();
  });

  it("blocks regular users from manual reruns and run history", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.aiAnalyst.runNow()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.aiAnalyst.runHistory()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.history).not.toHaveBeenCalled();
  });

  it("allows an admin rerun and records the requesting user id", async () => {
    const caller = appRouter.createCaller(context("admin"));
    await caller.aiAnalyst.runNow();
    expect(mocks.run).toHaveBeenCalledWith({
      trigger: "admin",
      requestedByUserId: 10,
    });
  });
});

