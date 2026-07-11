# Issue #9 scorecard synthesis handoff

Issue #9 adds deterministic scorecard synthesis without changing the frozen
domain or event contracts and without wiring the live route owned by issue #10.

## Public entry point

Use `createNodeScorecardSynthesisPipeline` from
`src/server/analysis/node-scorecard-synthesis-pipeline.ts`. Pass the transcript
and claims returned by issue #6 plus the completed verifications returned by
issue #7. The pipeline emits the frozen `synthesizing` progress event and
returns a runtime-validated `Scorecard`.

For deterministic-only tests or composition, use `calculateCapScore` and
`createScorecardSynthesisPipeline` from
`src/server/analysis/scorecard-synthesis.ts`.

## Deterministic score rules

- Verdict weights are `true: 0`, `mostly-true: 15`, `unverifiable: 40`, and
  `false: 100`; the rounded mean is the base score.
- Prediction ratio uses all extracted factual and predictive claims as its
  denominator; opinions are excluded. When at least half are predictive, the
  score has a floor of `30`, even if those predictions were non-checkable or no
  verification completed.
- Empty verification sets use a weighted base of `0`; the prediction floor can
  still raise that score. With no extracted factual or predictive claims, the
  score remains `0`. Frozen labels are `0-29 no-cap`, `30-69 some-cap`, and
  `70-100 full-of-cap`.
- Gemini never proposes the score or label. An unexpected model `capScore` is
  ignored before the frozen scorecard is assembled.

## Narrative grounding

Gemini receives only the transcript and completed frozen verifications. Its
internal structured output requires `summary.text`, `summary.claimIds`, a
verified `claimId` on every hype finding, and an `evidenceId` on every action.
When verifications exist, a summary must cite at least one valid verification
claim ID; invented IDs reject the narrative. Hype survives only when its claim
ID resolves and its exact transcript phrase relates to that claim by text or
timestamp. Actions survive only when their evidence ID resolves in the same
scorecard. All internal claim references are stripped before frozen
`ScorecardSchema` validation. Extracted opinions remain outside verifications
and are copied into optional `skippedClaims`.

## Gemini request policy

The narrative adapter makes at most three attempts by default. HTTP `429`,
`5xx`, request timeouts, and network failures retry with exponential backoff.
Every attempt owns a fresh 30-second deadline. Backoff and attempt counts are
injectable for deterministic tests. Caller cancellation bypasses retries and
preserves the caller's exact abort reason. Exhausted, malformed, and
non-retryable failures expose only `SCORECARD_NARRATIVE_UNAVAILABLE`.

## Verification evidence

The first RED command was:

```bash
npm run test:unit -- src/server/analysis/scorecard-synthesis.test.ts
```

It failed because `./scorecard-synthesis` did not exist. Subsequent vertical
cycles covered false-versus-unverifiable weighting, the prediction floor,
frozen scorecard assembly, transcript/evidence grounding, malformed narrative
handling, Gemini structured output, and Node composition.

Coordinator-review RED cycles then proved and fixed: prediction-dominated
extraction with only factual verification, prediction-only extraction with zero
verifications, structured summary/hype references, invented summary claim IDs,
unrelated hype claim IDs, retryable HTTP and network recovery, caller abort
reason preservation, and pre-cancelled callers consuming zero attempts.

Pinned Node `v22.19.0` final gates:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

Results: 181 unit tests passed with 4 opt-in live tests skipped; the production
build passed; 19 Playwright tests passed with 1 intentional skip. No
credentialed live synthesis was run because the repository assigns the live
end-to-end smoke to issue #10.
