/**
 * /api/scheduled/aiInvestmentAnalyst — Heartbeat cron callback.
 *
 * Runs weekly and invokes the same locked, incremental analyst engine used by
 * the admin control. Only authenticated Manus cron identities may call it.
 */
import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { runAiInvestmentAnalyst } from "./services/aiAnalystRun";

export async function aiInvestmentAnalystHandler(req: Request, res: Response) {
  let taskUid: string | undefined;
  try {
    const user = await sdk.authenticateRequest(req).catch(() => null);
    taskUid = user?.taskUid;
    if (!user?.isCron || !taskUid) {
      res.status(403).json({ error: "cron-only endpoint" });
      return;
    }

    const result = await runAiInvestmentAnalyst({
      trigger: "scheduled",
      taskUid,
    });
    res.json({ ok: true, result });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: { url: req.originalUrl, taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}

