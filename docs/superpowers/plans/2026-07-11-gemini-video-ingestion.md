# Gemini Video Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a supported short-video URL or direct upload into an `ACTIVE` Gemini File while reporting progress and cleaning local temporary media on every exit path.

**Architecture:** `createVideoIngestor(...).withActiveFile(...)` is a callback-based lease consumed by the later live-analysis adapter. It accepts injected yt-dlp, Gemini Files, temporary-storage, time, and sleep boundaries; the callback receives the ACTIVE file, after which both local and remote resources are guaranteed to be released. Concrete adapters use an argument-safe child process, Node temporary files, and Google's documented Files REST protocol without changing package configuration. The frozen `AnalysisEvent`, `/api/analyze`, fixtures, and UI remain untouched.

**Tech Stack:** TypeScript, Node 22, Vitest, yt-dlp, Gemini Files REST API

## Global Constraints

- TDD is mandatory: one observable red-green-refactor cycle at a time.
- Lane A changes only isolated server ingestion modules, focused backend tests, and issue documentation.
- Never expose API keys, local paths, raw remote errors, or media bytes to client-facing errors.
- Normal tests use injected fakes and require no credentials or network.
- Polling, transient retries, and total processing time are bounded.
- Local temporary media is removed after both success and failure; the remote Gemini file remains available for the duration of the downstream callback and is then deleted.
- URL failures carry an explicit upload-fallback action.

---

### Task 1: Orchestration tracer slice

**Files:**
- Create: `src/server/ingestion/ingest-video.ts`
- Test: `src/server/ingestion/ingest-video.test.ts`

**Interfaces:**
- Consumes: `IngestionSource`, `IngestionDependencies`, `IngestionOptions`
- Produces: `createVideoIngestor(dependencies, policy).withActiveFile(source, options, consume): Promise<T>`

- [x] Write a failing test proving a YouTube Short is downloaded, uploaded with its detected MIME, polled from `PROCESSING` to `ACTIVE`, reports fetching/processing progress, exposes the ACTIVE reference only inside the callback, and then removes local and remote resources.
- [x] Run `npm run test:unit -- src/server/ingestion/video-ingestion.test.ts` and record the missing-module failure.
- [x] Implement the smallest public types and orchestration needed for that path.
- [x] Re-run the focused test and keep it green before the next behavior.

### Task 2: Upload and failure contracts

**Files:**
- Modify: `src/server/ingestion/ingest-video.ts`
- Modify: `src/server/ingestion/ingest-video.test.ts`
- Create: `src/server/ingestion/media-type.ts`
- Test: `src/server/ingestion/media-type.test.ts`

**Interfaces:**
- Consumes: URL or `{ kind: "upload", fileName, mimeType, bytes }`
- Produces: safe `IngestionError` values with `code`, `retryable`, and `offerUploadFallback`

- [x] Add one failing test at a time for direct upload bypassing yt-dlp, MIME normalization, unsupported URL/upload errors, one transient upload retry, `FAILED`, timeout, cancellation, and cleanup on every failure.
- [x] Implement only the behavior required by each failing test, keeping local paths out of error messages.
- [x] Run the focused ingestion and MIME suites after every cycle.

### Task 3: Concrete external adapters

**Files:**
- Create: `src/server/ingestion/node-temp-media.ts`
- Test: `src/server/ingestion/node-temp-media.test.ts`
- Create: `src/server/ingestion/yt-dlp.ts`
- Test: `src/server/ingestion/yt-dlp.test.ts`
- Create: `src/server/ingestion/gemini-files.ts`
- Test: `src/server/ingestion/gemini-files.test.ts`

**Interfaces:**
- Produces: `createNodeTempMediaStore()`, `createYtDlpDownloader()`, and `createGeminiFilesClient({ apiKey, fetch? })`

- [x] Test then implement basename-only upload writes and recursive cleanup under a unique OS temporary directory.
- [x] Test then implement yt-dlp spawning with an argument array, `--no-playlist`, bounded size, and a captured final filepath; translate private/unsupported/failed downloads into the upload fallback contract.
- [x] Test then implement Gemini resumable upload start/finalize, explicit MIME headers, safe response validation, get, and delete through injected `fetch`.
- [x] Run all adapter tests and `npm run typecheck`.

### Task 4: Live smoke path and handoff

**Files:**
- Create: `src/server/ingestion/video-ingestion.live.test.ts`
- Create: `docs/handoffs/issue-4-gemini-ingestion.md`

**Interfaces:**
- Produces: opt-in local functions for one real short URL and one prepared upload; no CI credential requirement.

- [x] Add an opt-in smoke runner that requires `GEMINI_API_KEY`, accepts explicit local input, prints only safe status, and deletes the remote smoke file in `finally`.
- [x] Run the URL and upload smoke paths when credentials and test media are available; otherwise record the exact remaining issue #10 verification without claiming success.
- [x] Document public interfaces, retry/timeout defaults, cleanup ownership, commands, and issue #6 wiring direction.
- [x] Run lint, typecheck, unit tests, build, and Playwright to prove the frozen frontend remains intact.

### Task 5: Review and delivery

**Files:**
- Modify only files already owned by this issue if review finds defects.

- [ ] Commit the issue branch with Aziz's configured identity and no AI co-author trailer.
- [ ] Run the issue's required minimal `no-mistakes` gate after explicit confirmation.
- [ ] Push, open a PR with `Closes #4`, include red/green evidence and live-smoke truth, and wait for `quality` and `e2e`.
- [ ] Merge only after required checks and the issue gate pass.
