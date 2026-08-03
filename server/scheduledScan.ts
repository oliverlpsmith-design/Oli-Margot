/**
 * /api/scheduled/nightlyScan — Heartbeat cron callback.
 *
 * Triggered nightly by the Manus Heartbeat platform (see IMPLEMENTATION_STATE
 * / periodic-updates skill). Runs one time-boxed incremental sweep slice.
 * The engine is resumable: if a slice runs out of budget, the next trigger
 * (or a manual "continue" from the admin UI) picks up from the checkpoint.
 */
import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { runSweepSlice } from "./services/sweep";
import { dispatchSavedSearchAlerts } from "./services/savedSearchAlerts";

export async function nightlyScanHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req).catch(() => null);
    if (!user?.isCron) {
      res.status(403).json({ error: "cron-only endpoint" });
      return;
    }
    const progress = await runSweepSlice({ mode: "incremental", budgetMs: 85_000 });
    // Once the incremental pass finishes, fan out saved-search alerts.
    let alerts = null;
    if (progress.done) {
      alerts = await dispatchSavedSearchAlerts().catch((e) => ({
        error: e instanceof Error ? e.message : String(e),
      }));
    }
    res.json({ ok: true, progress, alerts });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context: { url: req.originalUrl },
      timestamp: new Date().toISOString(),
    });
  }
}
