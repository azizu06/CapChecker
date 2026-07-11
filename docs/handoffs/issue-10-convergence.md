# Issue #10 convergence handoff

The automatable convergence seam now composes production video ingestion,
claim extraction, evidence verification, and scorecard synthesis. It emits the
frozen `AnalysisEvent` stream through the existing `/api/analyze` SSE boundary.
Non-production fixture mode still drives the deterministic browser gate; every
other mode selects live analysis and fails safely when server credentials are
absent.

## Automated evidence

- Injected-boundary orchestration tests cover ordered progress, completion,
  URL ingestion recovery, and cancellation without a terminal frame.
- Route tests cover fixture selection, live URL and multipart inputs, upload
  bytes and MIME propagation, aborts, SSE validation, and sanitized missing
  credentials.
- The existing fixture-backed desktop and mobile Playwright suite remains the
  deterministic UI integration gate.
- `src/server/analysis/live-analysis.live.test.ts` is the opt-in prepared-video
  path through the real server composition.
- `playwright.live.config.ts` and `e2e-live/live-analysis.pw.ts` provide a
  separate opt-in browser smoke through the real page, API route, SSE stream,
  production pipeline, and rendered cited scorecard. The exact commands and
  required environment variables are documented in `README.md`.

## Human-only acceptance evidence still required

This change does not fabricate event-day evidence. A human with approved demo
videos, credentials, and presentation hardware must still:

1. Run the scammy, legitimate, and mixed videos through the live smoke path,
   review the citations, and approve any scorecards before caching them.
2. Confirm URL-to-upload recovery in the final combined app with a real failed
   public link and prepared local file.
3. Perform the projector text-size, contrast, and score-reveal timing pass.
4. Capture and retain the full backup screen recording after the stable run.

Prepared videos, resulting creator content, credentials, and recordings must
not be committed unless licensing and event rules explicitly permit it.
