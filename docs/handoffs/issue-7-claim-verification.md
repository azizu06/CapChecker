# Issue #7 claim verification handoff

Issue #7 adds claim verification without changing the frozen `Claim`,
`Verification`, or `AnalysisEvent` contracts. It does not synthesize a
scorecard or modify Lane B UI/app-shell files.

## Public entry point

Use `createNodeClaimVerificationPipeline` from
`src/server/analysis/node-claim-verification-pipeline.ts`:

```ts
const pipeline = createNodeClaimVerificationPipeline({
  apiKey: process.env.GEMINI_API_KEY!,
  finnhubApiKey: process.env.FINNHUB_KEY!,
});

const verifications = await pipeline.verify(extraction.claims, {
  signal,
  onProgress,
});
```

The pipeline skips opinions and every other non-checkable claim. It emits one
`verifying` progress event, verifies checkable claims with a default concurrency
cap of three, preserves input order, and runtime-validates every result against
the frozen `VerificationSchema`.

## Evidence paths

General claims use two Gemini turns. The first turn is dedicated to Google
Search evidence retrieval so the response contains `groundingChunks` and
`groundingSupports`. The second turn replays the complete signed model content
and classifies the grounded evidence with schema-constrained output. Only chunks
referenced by grounding supports become displayable evidence.

Claims with `quant.ticker` first use the `get_stock_data` function. The complete
Gemini model content object, including the original function-call part and
`thoughtSignature`, is returned unchanged before the function response. Finnhub
quotes are normalized into a high-trust source. If the function or Finnhub path
fails, the claim receives a fresh Search-grounded attempt.

Gemini and Finnhub both use a maximum of three attempts with exponential 429
backoff. A claim that still fails or returns a malformed verification becomes a
contract-valid `unverifiable` result without exposing upstream details or
failing sibling claims. Caller cancellation remains an abort.

## Verification evidence

The first red tests failed on missing modules for orchestration, Finnhub,
Gemini verification, and the Node factory. Subsequent vertical cycles covered
checkable-only selection, frozen-contract validation, per-claim degradation,
bounded concurrency, Finnhub normalization and 429 backoff, Search-supported
citations, deterministic trust tiers, exact signed model-turn replay,
`get_stock_data`, Search fallback, Gemini 429 backoff, and production wiring.

Run deterministic checks with:

```bash
npm run test:unit -- src/server/analysis
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

The opt-in live test is
`src/server/analysis/claim-verification.live.test.ts`. Set
`CAPCHECK_LIVE_VERIFY=1`, `GEMINI_API_KEY`, and `FINNHUB_KEY` locally. On
2026-07-11 it passed with a Search-grounded SEC/Form 10-K claim and an AAPL
quote claim that completed the Gemini function-call and Finnhub path. No live
credential is required in CI.

## Issue #9 direction

Issue #9 can pass `ClaimExtraction.claims` directly to this pipeline and use the
returned frozen verifications for deterministic score bounds. It should not
re-run Search, call Finnhub directly, reclassify opinions, or weaken a per-claim
`unverifiable` result into a pipeline-wide failure.
