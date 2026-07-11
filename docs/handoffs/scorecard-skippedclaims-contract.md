# Shared-contract change: `Scorecard.skippedClaims` (Lane A must read)

**Introduced by:** PR #22 (issue #5, Lane B). **Affects:** Lane A issue #9 (scorecard
synthesis) and anyone producing an `AnalysisEvent` `complete` scorecard.

This is a change to the **frozen shared seam** in `src/domain/analysis.ts`. Do not skip it.

## What changed

`ScorecardSchema` gained one **optional, additive** field:

```ts
skippedClaims: z.array(OpinionClaimSchema).optional()
```

`OpinionClaimSchema` is the existing opinion claim shape, now exported:
`{ id, text, timestampSeconds?, kind: "opinion", checkable: false }`.

## Invariants (keep these when you populate it in #9)

- **Optional / backward-compatible.** A scorecard that omits `skippedClaims` still
  validates. Every pre-existing fixture and Lane A scorecard is unaffected. You are not
  required to populate it.
- **Opinions only.** Items must be `kind: "opinion"`, `checkable: false`. The contract
  test `src/domain/analysis.test.ts` ("rejects checkable claims in the skipped opinion
  collection") enforces this — a factual/predictive claim cannot go here.
- **Opinions stay OUT of `verifications`.** `verifications` remains checkable-only
  (`CheckableClaimSchema`). Do not move opinions into it. If synthesis retains extracted
  opinions, put them in `skippedClaims`.

## What #9 should do

When Gemini synthesis retains extracted opinion claims, emit them as
`scorecard.skippedClaims` (opinion-only). If you drop opinions, simply omit the field.
No parser change is needed — `src/lib/analysis-stream.ts` already parses the full
`AnalysisEventSchema`. The fixture adapter now validates its `complete` event through
`AnalysisEventSchema` before yielding, so a malformed scorecard fails fast.

## Where to look

- Schema: `src/domain/analysis.ts` (`OpinionClaimSchema`, `ScorecardSchema.skippedClaims`)
- Example: the `mixed` fixture in `src/fixtures/scorecards.ts` includes one skipped opinion
- UI (Lane B, informational): opinions render after verified claims as a non-interactive
  "Opinion — not fact-checked" card with no confidence/evidence affordance
  (`src/components/claim-card.tsx`, `scorecard.tsx`)
