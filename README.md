# CapCheck

CapCheck turns a short-form financial video into a source-backed claim
scorecard. A user can paste a video URL or upload a video, follow the analysis
stages, and inspect the evidence behind each supported, contradicted, or
unverifiable claim.

Built for BloomKnights 2026, CapCheck combines Gemini video understanding,
Google Search grounding, Finnhub market data, and a Supabase-backed Verified
Feed.

> **Project status:** Complete and preserved as a read-only portfolio showcase.
> Browse the deployed app at [capcheck-sigma.vercel.app](https://capcheck-sigma.vercel.app/).
> The persisted feed and evidence pages remain live; paid/private analysis and
> refresh integrations were retired after the hackathon.

## What shipped

- URL and upload intake with streamed analysis progress.
- Gemini claim extraction, grounded verification, and deterministic Cap Scores.
- Finnhub function calling for quantitative market claims.
- A searchable, category-filtered catalog of CapCheck-vetted YouTube videos.
- Supabase persistence, idempotent refresh runs, reliability gating, and safe
  failure behavior.
- Responsive, accessible feed, detail, and scorecard experiences backed by
  deterministic unit and Playwright coverage.

## Local setup

CapCheck is pinned to Node.js `22.19.0` in `.nvmrc`.

```bash
nvm install
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Open <http://127.0.0.1:3000>. The checked-in environment example enables the
local fixture adapter and contains no credentials.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | Run ESLint across the repository. |
| `npm run typecheck` | Type-check without emitting files. |
| `npm run test:unit` | Run Vitest unit, contract, route, and component tests. |
| `npm run test:e2e` | Run Playwright in desktop and mobile Chromium. |

Run a focused test by appending its path, for example:

```bash
npm run test:unit -- src/domain/analysis.test.ts
npm run test:e2e -- --project=chromium-desktop
```

## Fixture mode is server-only

`CAPCHECK_ANALYSIS_MODE=fixture` is read only by the server route. Do not rename
it to a `NEXT_PUBLIC_*` variable or expose it in client bundles. The
`/api/analyze` route selects fixtures only when the variable is exactly
`fixture` and `NODE_ENV` is not `production`. Every other configuration selects
live analysis. Live analysis requires server-only `GEMINI_API_KEY` and
`FINNHUB_KEY`; missing credentials return a sanitized unavailable response.

The browser still uses the real application boundary in fixture mode:

1. The page submits a URL or upload to `POST /api/analyze`.
2. The server fixture adapter emits contract-valid progress and result events.
3. The route encodes those events as server-sent events (SSE).
4. The client parser validates every event before rendering it.

This means Playwright covers the real page, route, streaming parser, and UI
without requiring Gemini credentials or network access. Fixture scenarios are
deterministic test data, not a production fallback.

## Architecture and the live-adapter seam

The shared seam is the Zod-validated `AnalysisEvent` contract in
`src/domain/analysis.ts`. The fixture adapter in
`src/server/analysis/fixture-adapter.ts` produces the same ordered progress,
completion, and error events that a live adapter must produce. The UI consumes
only the SSE response from `/api/analyze`; it does not import either adapter.

The production implementation selects the live yt-dlp, Gemini, Search
grounding, and Finnhub adapters while preserving the same `AnalysisEvent`
stream used by deterministic fixtures. Contract changes require coordinated
updates to schemas, fixtures, adapter tests, parser tests, and UI tests.

The live claim-extraction entry point is
`createNodeClaimExtractionPipeline` in
`src/server/analysis/node-claim-extraction-pipeline.ts`. It leases an ACTIVE
Gemini file only for the duration of one schema-constrained video-understanding
request, then returns timestamped transcript segments and claims. The frozen
claim fields remain unchanged; extraction adds optional `quant` metadata with
any present `ticker`, `metric`, `value`, and `period` fields for the later
verification stage. An emitted `quant` object always contains at least one of
those fields.

Normal tests inject external boundaries and require no credentials. To run the
opt-in prepared-video smoke test, set `GEMINI_API_KEY` and either
`CAPCHECK_LIVE_UPLOAD_PATH` or `CAPCHECK_LIVE_SHORT_URL`, then run:

```bash
npm run test:unit -- src/server/analysis/claim-extraction.live.test.ts
```

To smoke-test the complete production stream with one prepared video, remove
`CAPCHECK_ANALYSIS_MODE=fixture` and run:

```bash
CAPCHECK_LIVE_ANALYSIS=1 \
GEMINI_API_KEY=... \
FINNHUB_KEY=... \
CAPCHECK_LIVE_SHORT_URL='https://www.youtube.com/shorts/...' \
npm run test:unit -- src/server/analysis/live-analysis.live.test.ts
```

`CAPCHECK_LIVE_UPLOAD_PATH=/absolute/path/to/video.mp4` may be used instead of
the URL. The test is skipped unless the explicit opt-in flag, credentials, and
one source are all present. Do not commit the prepared video or credentials.

The end-to-end live browser smoke uses a separate Playwright configuration so
normal CI remains fixture-backed. It starts Next in live mode, submits the
prepared source through the real page and `/api/analyze`, observes SSE progress,
and requires a rendered scorecard with at least one citation:

```bash
CAPCHECK_LIVE_BROWSER=1 \
GEMINI_API_KEY=... \
FINNHUB_KEY=... \
CAPCHECK_LIVE_SHORT_URL='https://www.youtube.com/shorts/...' \
npm run test:e2e:live
```

The same `CAPCHECK_LIVE_UPLOAD_PATH` alternative is supported. This smoke is
explicitly opt-in and is not executed by `npm run test:e2e` or CI.

The implementation and verification approach is documented in
[`docs/agents/testing.md`](docs/agents/testing.md). Product scope and domain
language live in [`CONTEXT.md`](CONTEXT.md).

## Verified Feed refresh

`POST /api/feed/refresh` discovers one new public YouTube candidate, screens it,
reuses the existing analyzer, applies the frozen reliability gate, and upserts
an accepted card — streaming the same SSE shape as `/api/analyze`: `stage`
events, then one terminal `complete` (with `discovered / analyzed / kept /
rejected / duplicate` counts and the accepted card, if any) or `error` event.
Client code consumes it with `parseRefreshStream` in `src/lib/refresh-stream.ts`;
the minimal `RefreshFeedButton` in `src/components/refresh-feed-button.tsx`
drives it.

Refresh code lives under `src/server/feed/refresh/`:

- `reliability-gate.ts` — the frozen correctness core (Cap Score 0–29 and
  `no-cap`, zero `false` verdicts, at most one `unverifiable`, at least one
  `primary`/`high` citation, plus TLDR + category + timestamp present).
- `youtube-discovery.ts` — YouTube Data API v3 adapter (search.list →
  videos.list) behind a port, with a deterministic fake.
- `candidate-filter.ts` — duration / embeddable / public / safe screening and
  finance-category mapping.
- `refresh-runner.ts` — single-flight orchestration, run bookkeeping, idempotent
  upsert, and safe failure that never touches existing catalog rows.
- `catalog-port-adapter.ts` — maps refresh items and run bookkeeping onto the
  shared `CatalogRepository`; fixture mode and the feed page share one cached
  repository, while production writes through the server-only Supabase client.

Fixture mode (`CAPCHECK_ANALYSIS_MODE=fixture`) runs the whole flow against
deterministic discovery + the fixture scorecard + the fixture catalog, so two
consecutive refreshes prove idempotency (first accepts, second reports a
duplicate) with no credentials. Live mode additionally requires a server-only
`YOUTUBE_API_KEY` (plus `GEMINI_API_KEY`, `FINNHUB_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY`).

The hosted portfolio deployment intentionally omits those private credentials.
It reads the persisted catalog through the public Supabase anon key under RLS,
while live refresh and analysis render an archived-demo state instead of
calling external providers.

Opt-in live smoke test (never part of CI):

```bash
CAPCHECK_LIVE_REFRESH=1 \
YOUTUBE_API_KEY=... \
GEMINI_API_KEY=... \
FINNHUB_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... \
npm run test:unit -- src/server/feed/refresh/refresh.live.test.ts
```

### Demo runbook

Seed the persisted Supabase catalog before the demo. The seed is idempotent, so
it is safe to run again if the catalog has already been prepared:

```bash
NEXT_PUBLIC_SUPABASE_URL=... \
NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... \
npx tsx scripts/seed-feed.ts
```

For a credential-free rehearsal, keep `CAPCHECK_ANALYSIS_MODE=fixture` and
`CAPCHECK_FEED_MODE=fixture`, start the app, and click **Refresh feed** twice.
The first refresh adds the deterministic candidate and the second reports one
duplicate without adding another card.

For the live demo, configure the Supabase variables above plus
`YOUTUBE_API_KEY`, `GEMINI_API_KEY`, and `FINNHUB_KEY`, and do not set
`CAPCHECK_FEED_MODE=fixture`. Click **Refresh feed** once and wait for the final
counts before trying again. If the UI reports a retryable YouTube, Gemini,
timeout, or database failure, keep the page open and retry once after the
upstream service recovers. Do not clear or reseed the catalog: failed refreshes
leave the last good persisted cards unchanged. If the retry also fails, reload
the page and continue the demo from those persisted cards and their detail
pages instead of depending on another live refresh.

## UI design contract

All user-facing work follows the shared tokens, component anatomy, responsive
rules, accessibility requirements, and score semantics in
[`docs/design/capcheck-ui-spec.md`](docs/design/capcheck-ui-spec.md). The exact
Mobbin references and the patterns borrowed from each are recorded in
[`docs/references/ui-references.md`](docs/references/ui-references.md).

The interface is an original CapCheck composition. Reference products inform
interaction patterns only; do not copy their brand assets, navigation, labels,
or exact layouts.

## Verification before a PR

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

Implementation PRs follow test-driven development: prove one behavior fails,
make the smallest change that passes, then refactor while green. See
[`AGENTS.md`](AGENTS.md) for issue ownership, branch, PR, and merge rules.
