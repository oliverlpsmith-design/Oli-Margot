import { describe, expect, it } from "vitest";
import { canSurfaceAnalystRun } from "./services/aiAnalystRead";

describe("AI analyst current-picks safety", () => {
  it("surfaces only completed runs", () => {
    expect(canSurfaceAnalystRun({ status: "completed" })).toBe(true);
    expect(canSurfaceAnalystRun({ status: "running" })).toBe(false);
    expect(canSurfaceAnalystRun({ status: "failed" })).toBe(false);
    expect(canSurfaceAnalystRun(null)).toBe(false);
  });
});
