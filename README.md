# Investor Scout

Australian property research platform. Sweeps residential listings across NSW and
QLD, enriches each one with government planning and hazard data, and classifies it
against six investment strategies. Package name is `nsw_property_research` for
historical reasons — the project now covers two states.

This is a research-intelligence tool, not investment advice. Scores are bounded by
the evidence actually retrieved, and unknowns stay visible rather than being
inferred away.

## What it does

A nightly scan pages through RealtyAPI (realestate.com.au) across 34 NSW and 17 QLD
search units, storing only listings it has not seen before. Each new listing is
enriched with zoning, minimum lot size, bushfire, flood, biodiversity and heritage
data from government ArcGIS services, then run through the subdivision calculator
and six niche classifiers:

| Category | What it looks for |
|---|---|
| Subdivision | Land area vs minimum lot size, frontage, permissive zoning, hazard gates |
| Positive geared | Modelled net cash flow (finance, rates, insurance, management, vacancy) |
| Deceased estate | Legal-provenance signals with contextual exclusions |
| Dual income / granny flat | 450 sqm secondary-dwelling threshold plus zoning permission |
| Development site | E1–E5 employment zoning plus residual land value feasibility |
| Distressed / mortgagee | Verified legal-provenance signals, not generic vendor wording |

A weekly AI analyst ranks the catalogue for three hypothetical investor personas.
See `AI_ANALYST_OPERATIONS.md`.

## Stack

- **Server** — Express, tRPC v11, Drizzle ORM, MySQL, TypeScript ESM
- **Client** — React 19, Vite 7, Tailwind 4, shadcn/Radix, wouter, TanStack Query
- **Tests** — Vitest

## Running it

```bash
pnpm install
cp .env.example .env    # then fill in the values
pnpm db:push            # generate + apply migrations
pnpm dev                # http://localhost:3000
```

| Command | Does |
|---|---|
| `pnpm dev` | Dev server, API and client together |
| `pnpm check` | TypeScript, no emit |
| `pnpm test` | Vitest suite |
| `pnpm build` | Client bundle to `dist/public`, server bundle to `dist` |
| `pnpm start` | Run the production build |
| `pnpm db:push` | Generate and apply Drizzle migrations |

### Environment

Every variable is documented in `.env.example`. The two the app cannot start
without are `DATABASE_URL` and `JWT_SECRET`. `REALTY_API_KEY` is required for any
listing ingestion; without it the catalogue can still be browsed, but no new
listings arrive.

### Test suite expectations

Roughly a tenth of the suite is integration tests that hit the live database, the
RealtyAPI key, or government ArcGIS endpoints. They fail by design in an
environment lacking any of those. The remaining ~195 tests are pure logic and
should always pass. See `docs/RECOVERY.md` for the breakdown.

## Layout

```
client/src/pages/      Catalogue, PropertyDetail, NicheCategory, AgentPicks,
                       Research, Watchlist, Home
server/routers.ts      tRPC API — auth, property, catalogue, aiAnalyst, savedSearch
server/services/       Sweep engine, planning adapters, classifiers, AI analyst
server/_core/          Platform scaffolding: auth, LLM, maps, storage, cron
drizzle/               Schema and 14 ordered migrations
shared/                Region registries, types, constants shared by both sides
scripts/               Sweep drivers, backfills, diagnostics, database backup
research/              Source inventories and validation records
```

Data-consuming endpoints are administrator-only on the server, because each call
spends RealtyAPI credits. Regular users browse stored catalogue data.

## Project documentation

- `IMPLEMENTATION_STATE.md` — running engineering log, newest sections at the top
- `REA_API_NOTES.md` — verified RealtyAPI behaviour, including which parameters
  are silently ignored upstream. Read before touching ingestion.
- `RESEARCH_NOTES.md` — planning and hazard data-source research
- `AI_ANALYST_OPERATIONS.md` — weekly analyst cadence, cost controls, manual reruns
- `docs/RECOVERY.md` — what is backed up, what is not, and how to restore
- `research/` — QLD council source inventories and live validation records
- `todo*.md` — per-session work ledgers

## Known gaps

Tracked in `todo-fm8uhtnm.md`. The significant ones:

- QLD planning adapters are validated for Gold Coast, Moreton Bay, Logan and
  Redland, with Mount Isa zoning-only. Every other council falls back to
  `unknown` or `manual_review` rather than inferring a permissive answer.
- Sold lot prices need NSW Valuer General bulk PSI. RealtyAPI has no usable sold
  channel — verified, see `REA_API_NOTES.md`.
- The nightly scan's live request volume against the 85,000/month RealtyAPI
  allowance has been modelled but not verified in production.
