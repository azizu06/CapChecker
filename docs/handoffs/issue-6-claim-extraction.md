# Issue #6 transcript and claim extraction handoff

Issue #6 adds the server-only video-understanding stage that issue #7 can
consume. It does not select the live adapter in `/api/analyze`, verify claims,
or change the frozen `ClaimSchema` and `AnalysisEvent` contracts.

## Public entry point

Use `createNodeClaimExtractionPipeline` from
`src/server/analysis/node-claim-extraction-pipeline.ts`:

```ts
const pipeline = createNodeClaimExtractionPipeline({
  apiKey: process.env.GEMINI_API_KEY!,
});

const extraction = await pipeline.extract(source, { signal, onProgress });
```

The pipeline delegates URL and upload preparation to
`createNodeVideoIngestor(...).withActiveFile(...)`. Gemini video understanding
runs inside the ACTIVE-file callback. The ingestor remains the only owner of
local and remote file cleanup, and the ACTIVE URI is not returned in the
extraction result.

## Output contract

`ClaimExtractionSchema` returns:

- `transcript`: one or more `{ timestampSeconds, text }` segments;
- `claims`: zero or more frozen factual, predictive, or opinion claim shapes,
  each with a required extraction timestamp;
- optional `quant` metadata on an extracted claim, preserving whichever of
  `ticker`, `metric`, `value`, and `period` are present. `quant` must contain at
  least one field when emitted.

`ExtractedClaimSchema` intersects the frozen `ClaimSchema` with the timestamp
and optional quantitative metadata. Opinions therefore remain
`kind: "opinion"` and `checkable: false`, while downstream verification can
select only checkable factual and predictive claims. No shared scorecard or SSE
schema changed.

## Gemini boundary and failures

`createGeminiClaimGenerator` sends the ACTIVE file first, followed by a focused
extraction prompt, to the stable `gemini-3.5-flash` `generateContent` endpoint.
It requests `application/json` with a JSON Schema and then runtime-validates the
result with Zod. The API key stays in the request header.

Malformed JSON, missing candidates, and schema-invalid content fail with the
safe `MALFORMED_CLAIM_EXTRACTION` code and never advance beyond the
`extracting` progress event. HTTP rate limits and transient failures are marked
retryable, generation has a 120-second default deadline, and caller
cancellation remains an abort so ingestion cleanup still runs.

## Verification evidence

The first red test failed because `claim-extraction.ts` did not exist. Vertical
red-green cycles then covered valid extraction, malformed structured content,
partial and empty quantitative metadata, the Gemini REST request/response
contract, ACTIVE-file lease ordering, cleanup after generation failure and
caller abort, missing or malformed model envelopes, safe 429 handling, and the
generation deadline.

Run deterministic checks with:

```bash
npm run test:unit -- src/server/analysis
npm run lint -- src/server/analysis
npm run typecheck
```

An opt-in prepared-video test lives at
`src/server/analysis/claim-extraction.live.test.ts`. It requires
`GEMINI_API_KEY` plus either `CAPCHECK_LIVE_UPLOAD_PATH` or
`CAPCHECK_LIVE_SHORT_URL`, asserts a non-empty transcript and useful checkable
claims, checks that claims containing numeric details retain non-empty `quant`
metadata, and observes one production-ingestor remote delete after extraction.
Those variables were unavailable in this worktree during implementation, so a
credentialed run remains required before the final live acceptance checkbox can
be claimed.

## Issue #7 direction

Issue #7 should consume `ClaimExtraction.claims`, skip every claim whose
`checkable` flag is false, and use `quant` to choose the market-data function
path. It should not re-transcribe the video, retain the ACTIVE file URI, or
duplicate ingestion cleanup.
