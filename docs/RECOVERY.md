# Recovery and backup

What survives if things go wrong, what does not, and how to rebuild.

## Current backup status

| Asset | Backed up? | Where |
|---|---|---|
| Application source | Yes | This repository |
| Database schema | Yes | `drizzle/` — 14 ordered migrations plus snapshots |
| Engineering history and decisions | Yes | `IMPLEMENTATION_STATE.md`, `REA_API_NOTES.md`, `research/`, `todo*.md` |
| **Analysed catalogue data** | **No** | Lives only in the MySQL instance |
| **API keys and secrets** | **No** | Live only in the hosting environment |
| Hosting platform services | No | Auth, LLM, maps, cron and storage are provided by the platform |

The source is safe. The data is not, and it is the expensive part.

## The catalogue is the irreplaceable asset

The database holds tens of thousands of listings that have already been swept,
geocoded, enriched with government planning and hazard data, and classified. That
represents a large number of spent RealtyAPI credits and many hours of sweep
runtime. Rebuilding it from an empty database means paying for all of it again and
waiting hours for the sweep — and listings that have since sold are gone from the
upstream API, so historical coverage cannot be fully recovered at any price.

Back it up on a schedule:

```bash
DATABASE_URL='mysql://…' ./scripts/backup-database.sh ~/investor-scout-backups
```

Keep the dumps somewhere other than the machine running the app. Do not commit
them — dumps contain user records and are excluded by `.gitignore`.

## Restoring from scratch

1. Clone this repository.
2. `pnpm install`
3. `cp .env.example .env` and fill it in. `DATABASE_URL` and `JWT_SECRET` are
   needed to start; `REALTY_API_KEY` for any ingestion. If the RealtyAPI key is
   lost it must be reissued from the RealtyAPI.io account — it exists nowhere in
   this repository by design.
4. Create an empty database, then either:
   - restore a dump: `gunzip -c backup.sql.gz | mysql "$DATABASE_URL"`, or
   - start empty: `pnpm db:push` to apply all migrations, then run the initial
     sweep with `node scripts/run-sweep.mjs full` and expect several hours plus
     substantial credit spend.
5. `pnpm check && pnpm build` to confirm the tree is sound.
6. `pnpm dev` and confirm `/catalogue` returns rows.

## Verified build state

Confirmed from a clean clone on Node 22 with pnpm 10:

- `pnpm install --frozen-lockfile` — clean, lockfile matches
- `pnpm check` — zero TypeScript errors
- `pnpm build` — succeeds; client ~813 kB (224 kB gzipped), server bundle ~230 kB
- `pnpm test` — 195 passed, 22 failed

The 22 failures are entirely environmental and expected outside production:

| Cause | Files | Why |
|---|---|---|
| No `DATABASE_URL` | `catalogue`, `savedSearch`, `zoneMix` | Integration tests that assert against real swept data, not fixtures. An empty schema is not enough — they need a populated catalogue. |
| No `REALTY_API_KEY` | `realtyApiKey`, `e2e.flow` | Assert the key is set and accepted, then run a live search → analyse flow. |
| No egress to government APIs | `nswPlanning`, `riskAndRegions`, `rankedComparables` | Live ArcGIS and OnlineDA calls. Free and keyless, but the host must be able to reach `portal.spatial.nsw.gov.au` and `mapprod3.environment.nsw.gov.au`. |

All ~195 pure-logic tests pass — subdivision scoring, the six classifiers, zone
helpers, QLD planning fallbacks, AI analyst scoring and validation, filter
parsing, statistics. A green run of those means the business logic is intact.

## Platform coupling

The app was built on the Manus webdev platform and depends on it in five places,
all isolated in `server/_core/` and `client/src/_core/`. To run anywhere else,
each needs a replacement:

| Concern | File | Replacement needed |
|---|---|---|
| Login and the admin role check | `_core/sdk.ts`, `_core/oauth.ts` | Any OAuth provider or session system. This gates every credit-spending endpoint, so it cannot simply be removed. |
| AI analyst model calls | `_core/llm.ts` | Direct Anthropic or OpenAI SDK call |
| Map rendering | `_core/map.ts`, `components/Map.tsx` | A Google Maps key of your own, or MapLibre |
| Nightly and weekly schedules | `_core/heartbeat.ts` | Any cron that can POST to `/api/scheduled/nightlyScan` and `/api/scheduled/aiInvestmentAnalyst`. Both endpoints reject non-cron callers. |
| File storage | `_core/storageProxy.ts` | S3 — the AWS SDK is already a dependency |

Nothing in the core domain — sweep engine, planning adapters, classifiers,
scoring — depends on the platform. A migration is real work but it is bounded,
and the valuable logic is portable as-is.

## Suggested routine

- Database dump weekly, and always before a schema migration
- Push to this repository after every working session
- Store one dump off-site, separate from the host running the app
- Record where the RealtyAPI key and platform credentials can be reissued from,
  somewhere that is not this repository
