# TDD and browser QA workflow

TDD is the default development process for all CapCheck implementation work.
The goal is fast feedback during parallel development, followed by a small
full-stack convergence test when both lanes are ready.

## The required loop

For each behavior:

1. **Red:** write one test through a public interface and run it. Confirm the
   failure is caused by the missing behavior.
2. **Green:** add only enough production code to pass that test.
3. **Refactor:** improve structure while all tests remain green.
4. Repeat with the next behavior.

Do not write a batch of imagined tests and then a batch of implementation. Each
cycle is a thin, observable vertical slice.

## Test layers

### Unit and component tests

Use Vitest and React Testing Library for synchronous functions, hooks, client
components, score calculations, schema boundaries, and UI state transitions.
Test behavior through exported interfaces. Avoid assertions about private
functions, internal call order, or CSS implementation details.

Async Server Components and full routing behavior belong in Playwright rather
than being forced into component tests.

### Lane A contract and integration tests

Lane A owns adapters for Gemini video analysis, Google Search grounding,
Finnhub or its fallback, yt-dlp, file upload, and filesystem cleanup. Inject
these boundaries so tests can supply deterministic fakes. Do not mock internal
pipeline stages.

Contract tests must prove that:

- extracted claims match the frozen claim schema;
- verification results match the frozen verification schema;
- scorecards and progress events match their frozen contracts;
- one failed claim degrades to unverifiable without killing the run;
- retries, timeouts, rate limits, and cleanup remain observable and bounded.

Real API credentials are never required for normal PR tests. Live API smoke
tests are opt-in and run locally during issue #10.

### Lane B fixture-backed Playwright tests

Lane B uses the real Next.js page, routing, API route, SSE parsing, and rendered
components without waiting for Lane A. In development and test only, the
analysis route selects a deterministic fixture adapter that emits the same
progress-event and scorecard contracts as the live adapter.

The fixture adapter must be impossible to enable in production. It may be
selected through a test-only environment variable or the existing demo mode,
but it must travel through the same public application route as live analysis.
Playwright should not replace the whole route with a browser mock for the main
happy path, because doing so would skip route and stream integration.

Each Lane B issue adds Playwright coverage before implementation for every
interactive control or route it introduces. At minimum, the accumulated suite
must cover:

- app identity, initial route, and absence of runtime console errors;
- valid and invalid URL input;
- analyze, reset, retry, and upload-fallback controls;
- file selection with a small committed test fixture;
- each progress transition and the completed scorecard reveal;
- claim expansion, evidence links, and any internal route change;
- scammy, legitimate, mixed, partial-failure, and fatal-error fixtures;
- keyboard focus and disabled or loading behavior;
- desktop Chromium and one mobile Chromium project;
- every visible button and link, including an explicit assertion for its result.

Use Playwright's `webServer` configuration to start the local app, a `baseURL`
for relative navigation, and traces or screenshots on failure. PR runs use
headless Chromium for speed. Issue #10 may add broader browser coverage if the
core demo is already stable.

## Independent lane workflow

The contracts and fixtures from issue #2 are the seam:

- Lane A builds the live adapter and proves it produces the contracts.
- Lane B builds against the fixture adapter and proves the user flow through
  Playwright.
- Neither lane imports the other's internal implementation.
- Contract changes require a coordinated issue and updated fixtures before
  either lane continues.

When issues #8 and #9 close, issue #10 runs the same Playwright suite against
the integrated application. Fixture-backed E2E remains the deterministic CI
gate. A separate local smoke test uses one prepared video through yt-dlp,
Gemini, verification, SSE, and the rendered scorecard. This live smoke test is
recorded as evidence but is not required in CI because it depends on credentials
and network services.

## PR evidence

Every implementation PR includes:

- the first failing test and why it failed;
- the focused test command used during development;
- the final unit or component result;
- the final Playwright result for UI work;
- any untested live-service path and why it remains for issue #10.

Screenshots and traces are failure artifacts, not repository source. Keep them
under ignored Playwright output directories.
