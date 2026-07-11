# Shared-contract change: hype context and evidence-linked actions (Lane A must read)

**Introduced by:** issue #8 (Lane B). **Affects:** Lane A issue #9 (scorecard
synthesis) and anyone producing an `AnalysisEvent` `complete` scorecard.

This is an additive change to the frozen shared seam in
`src/domain/analysis.ts`. Existing scorecards remain valid.

## What changed

`HypeFindingSchema` gained two optional fields:

```ts
context: z.string().min(1).optional()
timestampSeconds: z.number().nonnegative().optional()
```

`NextActionSchema` gained one optional field:

```ts
evidenceId: z.string().min(1).optional()
```

## Invariants

- **Optional and backward-compatible.** A hype finding or next action that omits
  every new field still validates and retains its legacy UI treatment. No existing
  Lane A producer is required to populate these fields.
- **Transcript anchors are additive.** `context` is a short transcript excerpt
  surrounding the exact hype phrase. `timestampSeconds` is the non-negative video
  offset where that excerpt occurs. Populate both when the transcript provides them;
  either may be omitted independently.
- **Evidence references stay inside the scorecard.** `evidenceId`, when present,
  should equal an `Evidence.id` in one of the same scorecard's `verifications`.
  Issue #8 does not make that cross-reference a schema-level requirement so older
  and partially enriched producers remain valid. If the ID does not resolve within
  that completed scorecard, the UI still renders the action and falls back to its
  `url` when present; without a `url`, it renders no source link. Producers for
  issues #9 and #10 should always reference an `Evidence.id` in the same scorecard.
- **Existing safety rules are unchanged.** Evidence and action URLs remain
  HTTP(S)-only, opinions remain outside `verifications`, score bands are unchanged,
  the UI does not import adapters, and fixture mode remains disabled in production.

## What issue #9 should populate

For each hype finding, preserve a concise transcript excerpt in `context` and the
matching offset in `timestampSeconds`. The excerpt should include `phrase` so the UI
can show why the language was flagged instead of presenting an isolated word list.

For each next action, write a concrete action based on a source already cited in the
scorecard and set `evidenceId` to that evidence object's `id`. Two or three actions per
scorecard are recommended. Avoid generic financial advice that could appear on any
result.

If the referenced evidence cannot be found, the UI falls back to the action's existing
optional `url` behavior. The fixture adapter validates every completion event through
`AnalysisEventSchema`, and the stream parser already parses the full event schema, so
no separate parser change is required.

## Where to look

- Schema: `src/domain/analysis.ts` (`HypeFindingSchema`, `NextActionSchema`)
- Examples: all outcomes in `src/fixtures/scorecards.ts`
- Fixture seam: `src/server/analysis/fixture-adapter.ts`
- UI: `src/components/scorecard.tsx`
- Contract and UI tests: `src/domain/analysis.test.ts`,
  `src/server/analysis/fixture-adapter.test.ts`, and
  `src/components/capcheck-app.test.tsx`
