# CapCheck

CapCheck turns a short-form financial video into a source-backed claim
scorecard. A user can paste a video URL or upload a video, follow the analysis
stages, and inspect the evidence behind each supported, contradicted, or
unverifiable claim.

This repository contains the Bloomberg Hackathon 2026 application. The current
foundation uses deterministic fixtures so the frontend and analysis pipeline
can be developed and tested independently against the same runtime-validated
contracts.

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
`/api/analyze` route refuses fixture analysis unless the variable is exactly
`fixture`, and it refuses fixture analysis unconditionally when
`NODE_ENV=production`.

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

Lane A can introduce the live yt-dlp, Gemini, and evidence-grounding adapter by
selecting it on the server while preserving the route and `AnalysisEvent`
stream. Lane B can continue working against fixtures. Contract changes require
a coordinated update to schemas, fixtures, adapter tests, parser tests, and UI
tests before either lane depends on them.

The implementation and verification approach is documented in
[`docs/agents/testing.md`](docs/agents/testing.md). Product scope and domain
language live in [`CONTEXT.md`](CONTEXT.md).

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
