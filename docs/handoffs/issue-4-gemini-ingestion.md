# Issue #4 Gemini video ingestion handoff

Issue #4 adds the server-only ingestion seam that issue #6 can consume. It does
not wire the fixture-only `/api/analyze` route, change `AnalysisEvent`, or touch
the frontend.

## Public entry point

Use `createNodeVideoIngestor` from
`src/server/ingestion/node-video-ingestor.ts`:

```ts
const ingestor = createNodeVideoIngestor({ apiKey: process.env.GEMINI_API_KEY! });

const result = await ingestor.withActiveFile(
  { kind: "url", url },
  { signal, onProgress },
  async (activeFile) => analyzeWithGemini(activeFile),
);
```

Direct uploads use `{ kind: "upload", fileName, mimeType, bytes }`. The
callback receives only `{ name, uri, mimeType }`; it never receives a local
path or media bytes.

`withActiveFile` is intentionally a lease instead of returning a bare Gemini
file. Local temporary media is removed on every exit path. The remote Gemini
file stays ACTIVE for the callback and is deleted afterward, including when
downstream analysis fails. Cleanup uses a fresh signal so a disconnected
request does not skip deletion, and cleanup failures do not mask the primary
pipeline failure.

## Behavior and ownership

- Supported URL shapes are public YouTube Shorts, `youtu.be` shares, and
  TikTok links on exact allowlisted hosts. Suffix spoofs are rejected before
  yt-dlp runs.
- yt-dlp runs through `spawn` with an argument array, `shell: false`,
  `--no-playlist`, a policy-driven 50 MB limit, restricted filenames, a
  120-second process deadline, and an output path constrained to the unique
  temporary directory. The downloaded file is measured again on disk before
  Gemini upload because remote Content-Length metadata can be absent or wrong.
- Upload names must be basenames on both POSIX and Windows path rules.
- Direct uploads are rejected above 50 MB before a temporary directory is
  allocated, matching the route and yt-dlp limits.
- MP4, MOV/QuickTime, and WebM are detected from file signatures and checked
  against extension and declared MIME. Mismatches fail before upload.
- Gemini uses the documented resumable Files REST protocol, with the API key
  sent in a header. No new package or framework dependency was added.
- Upload receives two attempts total. Only failures known to occur before an
  upload is finalized are retryable; an ambiguous finalize timeout is never
  retried because doing so could orphan a second Gemini file.
- Files are polled from `PROCESSING` or `STATE_UNSPECIFIED` to `ACTIVE`;
  `FAILED` stops immediately.
  Defaults are a 2-second interval, 60 polls, a hard 120-second activation
  deadline, 30 seconds for metadata requests, and 300 seconds for the bulk
  upload. Remote cleanup retries transient failures up to three times.
- `mapIngestionError` converts known failures into the frozen `ErrorEvent`.
  Unsupported/private/failed links explicitly direct the user to upload the
  video file. Abort returns no client error event.

## Issue #6 wiring direction

Issue #6 should construct one ingestor inside the future live analysis adapter,
map its `fetching` and `processing` progress directly to the existing frozen
progress contract, and perform Gemini claim extraction inside the ACTIVE-file
callback. Do not retain `activeFile.uri` after that callback returns. Do not
duplicate temporary-file or remote-file cleanup in issue #6.

The public route is still fixture-only by design. Route selection and the full
live SSE integration belong to the later convergence issue, not this PR.

## Verification

The first red test failed because `video-ingestion.ts` did not exist. The first
green tracer proved URL download, MIME propagation, `PROCESSING` to `ACTIVE`,
contract-valid progress, downstream lease use, and both cleanup boundaries.
Subsequent red-green cycles covered direct upload, spoofed/failed URL fallback,
retry classification, process/request/activation deadlines, ambiguous-finalize
safety, cleanup retries, `FAILED`, cancellation, safe error mapping, MIME
signatures, path containment, post-download size enforcement, and REST request
shapes.

Run the deterministic suite:

```bash
npm run test:unit -- src/server/ingestion
npm run lint -- src/server/ingestion
npm run typecheck
```

Run the opt-in live smoke tests with explicit local inputs:

```bash
GEMINI_API_KEY=... \
CAPCHECK_LIVE_SHORT_URL='https://www.youtube.com/shorts/...' \
CAPCHECK_LIVE_UPLOAD_PATH='/absolute/path/to/prepared.mp4' \
npm run test:unit -- src/server/ingestion/video-ingestion.live.test.ts
```

Both live cases use the real yt-dlp/filesystem/Gemini boundaries and delete the
Gemini file after it reaches ACTIVE. They are skipped in normal CI.

Credentialed smoke evidence recorded on 2026-07-11:

- URL: Yahoo Finance's public YouTube Short, `mRpuGPCYhAg` (47 seconds), was
  downloaded through the real yt-dlp adapter and reached Gemini `ACTIVE`.
- Upload: the separately prepared 6.56 MB `mRpuGPCYhAg.webm` file was staged
  through the direct-upload path and reached Gemini `ACTIVE`.
- The final hardened implementation reran both tests successfully in 28.70
  seconds, and each remote file was deleted after
  its ACTIVE-file callback completed.
