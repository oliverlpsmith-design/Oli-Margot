/**
 * Local sweep driver — runs the catalogue sweep engine directly in the
 * sandbox (same DATABASE_URL as production) in repeated slices until done.
 *
 * Usage:
 *   node scripts/run-sweep.mjs full         # initial exhaustive sweep
 *   node scripts/run-sweep.mjs incremental  # nightly-style incremental run
 *   node scripts/run-sweep.mjs full --all-types  # backfill sweep: all property types
 *   MAX_SLICES=5 node scripts/run-sweep.mjs full  # bounded test run
 *
 * Not part of the deployed app. Uses tsx to import the TS engine.
 */
import { spawnSync } from "node:child_process";

const mode = process.argv[2] === "incremental" ? "incremental" : "full_sweep";
const allTypes = process.argv.includes("--all-types");
const maxSlices = Number(process.env.MAX_SLICES ?? 200);

for (let i = 1; i <= maxSlices; i++) {
  const r = spawnSync(
    "npx",
    [
      "tsx",
      "-e",
      `import { runSweepSlice } from "./server/services/sweep";
       runSweepSlice({ mode: "${mode}", allPropertyTypes: ${allTypes}, budgetMs: 80000 }).then((p) => {
         console.log(JSON.stringify(p));
         process.exit(p.done ? 42 : 0);
       }).catch((e) => { console.error(e); process.exit(1); });`,
    ],
    { stdio: ["ignore", "inherit", "inherit"], cwd: process.cwd(), env: process.env },
  );
  if (r.status === 42) {
    console.log(`[run-sweep] DONE after ${i} slice(s)`);
    process.exit(0);
  }
  if (r.status !== 0) {
    console.error(`[run-sweep] slice ${i} failed (exit ${r.status}) — retrying once after 10s`);
    spawnSync("sleep", ["10"]);
  }
}
console.log("[run-sweep] reached MAX_SLICES without completion — rerun to continue");
