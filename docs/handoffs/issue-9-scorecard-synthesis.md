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
- When at least half of completed verifications are predictive, the score has a
  floor of `30`, keeping prediction-heavy videos out of the `No cap` band.
- Empty verification sets score `0`. The frozen score bands derive the label:
  `0-29 no-cap`, `30-69 some-cap`, and `70-100 full-of-cap`.
- Gemini never proposes the score or label. An unexpected model `capScore` is
  ignored before the frozen scorecard is assembled.

## Narrative grounding

Gemini receives only the transcript and completed frozen verifications and
returns summary, hype, and action prose through structured output. Code keeps a
hype finding only when its phrase occurs in a transcript segment, then supplies
that segment and timestamp. Code keeps a next action only when its `evidenceId`
resolves within the same scorecard. Extracted opinions remain outside
verifications and are copied into optional `skippedClaims`.

## Verification evidence

The first RED command was:

```bash
npm run test:unit -- src/server/analysis/scorecard-synthesis.test.ts
```

It failed because `./scorecard-synthesis` did not exist. Subsequent vertical
cycles covered false-versus-unverifiable weighting, the prediction floor,
frozen scorecard assembly, transcript/evidence grounding, malformed narrative
handling, Gemini structured output, and Node composition.

Pinned Node `v22.19.0` final gates:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

Results: 169 unit tests passed with 4 opt-in live tests skipped; the production
build passed; 19 Playwright tests passed with 1 intentional skip. No
credentialed live synthesis was run because the repository assigns the live
end-to-end smoke to issue #10.
