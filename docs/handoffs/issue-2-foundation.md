# Issue #2 foundation handoff

This is the starting point for agents continuing after PR
[#21](https://github.com/azizu06/CapChecker/pull/21). The foundation is a
tested vertical slice, not only a scaffold: URL and upload intake, fixture SSE,
progress, scorecards, errors, and desktop/mobile browser QA are already present.

## Read in this order

1. [`AGENTS.md`](../../AGENTS.md) for ownership, TDD, parallelization, and PR rules.
2. [`CONTEXT.md`](../../CONTEXT.md) for canonical domain language and Cap Score semantics.
3. [`src/domain/analysis.ts`](../../src/domain/analysis.ts) for the frozen runtime contracts.
4. [`docs/agents/testing.md`](../agents/testing.md) for the independent-lane test seam.
5. [`docs/design/capcheck-ui-spec.md`](../design/capcheck-ui-spec.md) for shared UI tokens and component behavior.
6. [`README.md`](../../README.md) for setup, commands, fixture safety, and architecture.

Use [`graphify-out/graph.json`](../../graphify-out/graph.json) before broad
codebase rereads. A useful first query is:

```bash
graphify query "How does AnalysisEvent connect the fixture route to the scorecard?"
```

## Frozen seam and invariants

- `src/domain/analysis.ts` owns Zod schemas and inferred types. Contract changes
  require coordinated fixture, adapter, parser, UI, unit, and E2E updates.
- A higher Cap Score means more misleading content: `0-29 no-cap`, `30-69
  some-cap`, and `70-100 full-of-cap`.
- `VerificationSchema` accepts only checkable factual or predictive claims.
  Opinions remain extracted claims and are not verification results.
- All client-visible URLs are HTTP(S); upload source names are basenames only.
- `src/server/analysis/fixture-adapter.ts` and future live adapters produce
  `AnalysisEvent`. The UI never imports either adapter.
- `src/app/api/analyze/route.ts` is the public boundary. It emits validated SSE
  and sanitizes errors. Secrets, raw exceptions, local paths, and media bytes do
  not enter the client contract.
- Fixture mode uses server-only `CAPCHECK_ANALYSIS_MODE=fixture` and is rejected
  in production. `?fixture=mixed|scammy|legitimate|partialFailure|fatal` is an
  allowlisted development/E2E selector, not a production mode.

## Key implementation map

| Surface | Source of truth |
| --- | --- |
| Contracts and score bands | `src/domain/analysis.ts` |
| Deterministic outcomes | `src/fixtures/scorecards.ts` |
| Fixture event producer | `src/server/analysis/fixture-adapter.ts` |
| Public SSE route | `src/app/api/analyze/route.ts` |
| Chunk-safe client parser | `src/lib/analysis-stream.ts` |
| Client state machine | `src/components/capcheck-app.tsx` |
| URL/upload intake | `src/components/intake-panel.tsx` |
| Progress stages | `src/components/progress-timeline.tsx` |
| Score and evidence | `src/components/scorecard.tsx`, `claim-card.tsx` |
| Browser behavior contract | `e2e/capcheck.spec.ts` |
| Visual contract and Mobbin sources | `docs/design/capcheck-ui-spec.md`, `docs/references/ui-references.md` |

## Next issue direction

### Issue #3: audit before coding

Issue #2 already delivers the URL-first intake, upload fallback, validation,
six-stage fixture progress, responsive layout, component tests, and Playwright
coverage described by #3. Do not create a second intake or progress system.
Compare #3 acceptance criteria with the merged UI, then close #3 as satisfied or
narrow it to a concrete missing behavior discovered during review.

### Issue #4: clean backend lane

Build yt-dlp and direct-upload ingestion as a server adapter behind the frozen
event seam. Preserve `AnalysisEvent`, `/api/analyze`, and all fixture-backed
tests. Inject external boundaries and develop with TDD: URL download, MIME
selection, Gemini Files upload/polling, timeout/retry, and cleanup. Live
credentials are optional for normal tests; record one prepared local smoke path.

### Issue #5: extend, do not rebuild

Issue #2 already renders score bands, verified claims, confidence, evidence,
trust tiers, all core fixtures, and projector/mobile layouts. The likely #5
delta is explicit presentation of skipped opinion claims and visible claim
timestamps. Add those through the frozen claim/scorecard design with tests;
reuse `ScorecardView` and `ClaimCard`.

Issues #3, #4, and #5 become independent after #2 merges. Keep one issue,
branch, worktree, and PR per agent. If #3 is closed as already satisfied, the UI
agent can move directly to the narrowed #5 work.

## Verification baseline

Node is pinned to `22.19.0`. Before integration, preserve this green baseline:

```bash
npm run lint
npm run typecheck
npm run test:unit   # 65 tests at handoff
npm run build
npm run test:e2e    # 19 passed, 1 expected project-specific skip
```

Playwright starts its own fixture-enabled server and must continue to exercise
the real page, route, SSE adapter, parser, and rendered controls without route
mocking. Issue #10 later reruns the same deterministic suite against the
integrated app and adds the prepared live smoke test.

## Suggested skills

- `tdd` for every implementation slice.
- `diagnose` when a test or live adapter behavior regresses.
- `playwright` for UI controls, routing, responsive layout, and console health.
- Mobbin references plus Impeccable, when available, for additional UI work.
- `graphify` for architecture/path questions before broad file exploration.
- `handoff` before transferring an unfinished issue to another agent.
