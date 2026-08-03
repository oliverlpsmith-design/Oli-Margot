# AI Investment Analyst — Operating Notes

## What Runs

The **AI Investment Analyst** ranks catalogue-only candidates for three hypothetical personas: **The Subdivider** ($1.5M), **The Cash Flow Hunter** ($800K), and **The Value Finder** ($1.2M). It is a research-intelligence feature, not investment advice. Scores remain evidence-bounded, planning data is presented as stored catalogue evidence, and unknowns remain visible on every pick.

## Weekly Automation

| Setting | Value |
|---|---|
| Job name | `ai-investment-analyst` |
| Schedule | Every Sunday at 17:00 UTC |
| Cron expression | `0 0 17 * * 0` |
| Callback | `POST /api/scheduled/aiInvestmentAnalyst` |
| Heartbeat task ID | `5K5kjPQxE3yZUZE7J3jYoW` |
| Owner | Investor Scout project owner |

The callback accepts cron-authenticated requests only. It acquires a database-backed single-run lock, analyses each persona concurrently, and publishes ranked picks only when the complete run succeeds. A failed or partial run cannot replace the last completed shortlist.

## Cost Controls and Evidence Rules

Deterministic persona gates run before model scoring, so only plausible listings within each hypothetical budget are considered. A material-evidence fingerprint reuses prior scores for unchanged candidates; an unchanged rerun should make zero model calls. Structured scoring uses `gpt-5-mini` as the primary model and invokes `gpt-5` only when the primary response fails strict structured-output validation. The Cash Flow Hunter is explicitly scenario-based until verified rent, vacancy, and operating-expense data is introduced; it must not be interpreted as a verified positive-gearing calculation.

## Manual Operations

Only project admins can use **Run analysis now** on `/agent-picks`. The same concurrency lock and incremental logic apply to manual runs. Regular users can browse saved picks but cannot trigger analysis, scans, exports, or model calls.

To inspect or manage the schedule from a project shell, use:

```bash
manus-heartbeat list
manus-heartbeat logs --task-uid 5K5kjPQxE3yZUZE7J3jYoW
manus-heartbeat update --task-uid 5K5kjPQxE3yZUZE7J3jYoW --enable=false
```

The project owner can also inspect, pause, resume, and review execution history in the project schedule management interface.

## Future Tuning

Before expanding the Cash Flow Hunter beyond scenario labels, add a verified rental, vacancy, and operating-expense source. Before changing persona thresholds or prompt language, update the deterministic gates, structured schema, unit tests, and disclosures together to retain transparent, reproducible scoring behavior.
