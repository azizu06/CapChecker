# CapCheck Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the testable Next.js foundation, frozen runtime contracts, deterministic fixture analysis path, and a polished responsive intake-to-scorecard frontend for issue #2.

**Architecture:** A single App Router repository exposes runtime-validated Zod contracts shared by a server-side analysis adapter and client UI. In development and test, `/api/analyze` streams deterministic SSE fixtures through the same public route the live adapter will later use. The UI consumes only `AnalysisEvent`, so Lane A can replace the fixture adapter without changing presentation code.

**Tech Stack:** Node 22.19, Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Zod, Vitest, React Testing Library, Playwright, Lucide React.

## Global Constraints

- TDD is mandatory: one observable red-green-refactor cycle at a time.
- URL input is primary; file upload is the visible fallback.
- Fixture mode is allowed only outside production and must use the real `/api/analyze` route and SSE parser.
- `quality` and `e2e` must pass in CI.
- Desktop and mobile Chromium are required.
- No API keys, creator media, internal file paths, or model exceptions may reach the client or git history.
- Reference composite: Descript dual intake, Perplexity stage progress, VirusTotal verdict-first summary, Ground News score bands, and Google Fact Check Explorer provenance cards.
- The issue #2 scope stops at deterministic fixture analysis. Live yt-dlp and Gemini ingestion belong to issue #4.

---

### Task 1: Scaffold and test harness

**Files:**
- Create: `.nvmrc`, `.env.example`, `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`
- Create: `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces npm scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test:unit`, and `test:e2e`.

- [ ] Generate a TypeScript, Tailwind, App Router, `src/`-directory Next.js app with npm and Node 22.
- [ ] Add Vitest, Testing Library, Playwright, Zod, and Lucide dependencies.
- [ ] Configure Vitest with jsdom and Testing Library cleanup.
- [ ] Configure Playwright with `webServer`, base URL `http://127.0.0.1:3000`, desktop Chromium, and mobile Chromium.
- [ ] Add `.env*` ignore rules while preserving `.env.example`; add `NEXT_PUBLIC_ANALYSIS_MODE=fixture` to the example without secrets.
- [ ] Run `npm run lint`, `npm run typecheck`, and `npm run build`; expect PASS.

### Task 2: Frozen contracts and fixtures

**Files:**
- Create: `src/domain/analysis.ts`
- Create: `src/fixtures/scorecards.ts`
- Test: `src/domain/analysis.test.ts`

**Interfaces:**
- Produces `ClaimSchema`, `VerificationSchema`, `ScorecardSchema`, `AnalysisEventSchema`, their inferred types, and `DEMO_SCORECARDS`.

- [ ] Write a failing contract test proving a complete mixed scorecard parses and an out-of-range Cap Score fails.
- [ ] Run `npm run test:unit -- src/domain/analysis.test.ts`; expect RED because schemas do not exist.
- [ ] Implement discriminated Zod schemas for claims, evidence, verifications, hype findings, next actions, scorecards, and progress/complete/error events.
- [ ] Add scammy, legitimate, mixed, partial-failure, and fatal-error fixtures using the same contracts.
- [ ] Run the focused test; expect GREEN.
- [ ] Refactor duplicate fixture anatomy into focused builders while the test remains green.

### Task 3: Fixture analysis route and SSE parser

**Files:**
- Create: `src/server/analysis/fixture-adapter.ts`
- Create: `src/app/api/analyze/route.ts`
- Create: `src/lib/analysis-stream.ts`
- Test: `src/server/analysis/fixture-adapter.test.ts`
- Test: `src/lib/analysis-stream.test.ts`

**Interfaces:**
- Consumes `AnalysisEvent` and `DEMO_SCORECARDS`.
- Produces `streamFixtureAnalysis(input, signal)` and `parseAnalysisStream(response)`.

- [ ] Write a failing test proving fixture analysis emits ordered stages and a contract-valid completion event.
- [ ] Implement an async generator for `fetching`, `processing`, `extracting`, `verifying`, `synthesizing`, and `complete`.
- [ ] Write a failing parser test for SSE frames split across arbitrary chunks.
- [ ] Implement a streaming parser that validates every decoded event with `AnalysisEventSchema`.
- [ ] Implement POST `/api/analyze` with URL or upload validation and `text/event-stream` output.
- [ ] Reject fixture mode when `NODE_ENV === "production"`; never branch on a public client flag in production.
- [ ] Run focused tests; expect GREEN.

### Task 4: Intake-to-result frontend tracer bullet

**Files:**
- Create: `src/components/capcheck-app.tsx`
- Create: `src/components/intake-panel.tsx`
- Create: `src/components/progress-timeline.tsx`
- Create: `src/components/scorecard.tsx`
- Create: `src/components/claim-card.tsx`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`
- Test: `src/components/capcheck-app.test.tsx`

**Interfaces:**
- Consumes only `/api/analyze` and `AnalysisEvent`.
- Produces the primary user flow: submit input, observe stages, inspect scorecard, reset, retry, or switch to upload.

- [ ] Write a failing component test for URL submission reaching the mixed scorecard through a stubbed public fetch response.
- [ ] Implement the minimal client state machine and accessible form to make it pass.
- [ ] Add visible URL validation, upload selection, reset, retry, and disabled/loading states one failing behavior at a time.
- [ ] Implement the reference composite: combined intake, meaningful stage feed, verdict-first score header, labeled score band, and provenance-rich claim cards.
- [ ] Use the locked cream light theme from `docs/agents/ui-design.md`: Baloo 2 + Nunito (Geist Mono for data only), cream/white surfaces, ink text, one blue accent, and semantic verdict colors. Use one radius and border system with restrained, soft warm shadows and no decorative gradients.
- [ ] Verify every interactive element has an accessible name, focus style, disabled behavior, and pointer affordance.
- [ ] Run component tests; expect GREEN.

### Task 5: Playwright E2E and responsive QA

**Files:**
- Create: `e2e/capcheck.spec.ts`
- Create: `e2e/fixtures/sample-video.txt`

**Interfaces:**
- Exercises the real page, real route, fixture SSE, and rendered result.

- [ ] Write a failing Playwright test for valid URL submission, ordered progress, final score, claim expansion, evidence link, and reset.
- [ ] Run `npm run test:e2e -- --project=chromium-desktop`; expect RED before the UI path is complete.
- [ ] Make the smallest fixes until the desktop test passes.
- [ ] Add tests for invalid URL, upload selection, partial failure, fatal error and retry, every visible button/link, and keyboard focus.
- [ ] Run the same core flow under mobile Chromium and fix overflow or control-size issues.
- [ ] Enable trace and screenshot capture on first retry/failure.
- [ ] Run `npm run test:e2e`; expect all projects GREEN.

### Task 6: Full verification and handoff

**Files:**
- Modify: `README.md`
- Create: `docs/references/ui-references.md`

**Interfaces:**
- Produces a PR-ready issue #2 foundation for Lane A and Lane B.

- [ ] Record the five reference URLs and the borrowed patterns without copying brand assets.
- [ ] Document Node 22 setup, scripts, fixture-mode safety, and the live-adapter seam.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`, and `npm run test:e2e`.
- [ ] Run browser QA for page identity, framework overlay, console health, desktop/mobile screenshots, and the primary interaction path.
- [ ] Run Graphify after code exists and commit `graphify-out/graph.json` plus `GRAPH_REPORT.md` if useful.
- [ ] Review the full branch for issue #2 acceptance criteria and open a draft PR with TDD evidence.
