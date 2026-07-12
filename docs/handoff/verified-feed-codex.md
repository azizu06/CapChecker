# Handoff: CapCheck Verified Feed (issues #25–#31)

**Updated:** 2026-07-11 evening. **Hard deadline: 10:00 PM tonight (hackathon submission).**
Purpose: let any fresh agent (Codex or otherwise) continue this build mid-flight if the
orchestrating session runs out of usage.

## Mission and scope decisions (already approved by Aziz)

Ship the Verified Feed per epic **#25** (read it for the reliability gate, IA, and product rules):
a Supabase-persisted, searchable catalog of CapCheck-vetted YouTube finance videos at `/`,
detail at `/feed/[id]`, analyzer moved to `/analyze`.

- Build #27, #28 (+ #30 single-flight/idempotency essentials folded in), then #29. **Skip #31** (cron).
- **#26 is closed** — decision record is a comment on issue #26. Supabase project = `dev-personal`
  (`gcsradzqlidemdkebloa`, restored, us-east-1). Tables `capcheck_catalog_items` /
  `capcheck_refresh_runs` in `public`, RLS anon-SELECT-only, writes server-side via service role.
  Committed migrations are the source of truth.
- Testing deliberately trimmed for the deadline: gate/repository unit tests + one happy-path
  Playwright spec. Do NOT expand to the issues' full QA matrices tonight.
- Demo strategy: fixture-first (`CAPCHECK_ANALYSIS_MODE=fixture`, `CAPCHECK_FEED_MODE=fixture`);
  live refresh is the flex, not the dependency.

## What is DONE

- **PR #40 (issue #27, this PR):** migration `supabase/migrations/20260711120000_capcheck_verified_feed.sql`,
  `src/domain/feed.ts` (CatalogItem/RefreshRun Zod), `src/server/feed/catalog-repository.ts`
  (interface + fake + fixture + lazy Supabase impl in `supabase-catalog-repository.ts`),
  `/` feed grid, `/feed/[id]` detail with nocookie embed, `SiteHeader`, `scripts/seed-feed.ts`
  (run with `tsx`), `src/fixtures/feed.ts` (2 vetted items), `e2e/feed.spec.ts`. All checks green.
- **PR #39 (issue #28):** integrated against PR #40 persistence. The refresh adapter now maps
  catalog IDs and run counts onto `CatalogRepository`; fixture refresh and feed reads share the
  same cached repository; production requires the server-only Supabase writer. The feed button
  is mounted and reloads the server feed after success. Repository-backed atomic single-flight,
  duplicate races, safe finalization failure, unsafe metadata rejection, bounded YouTube retries,
  SSE/analyzer cancellation, and desktop/mobile refresh/retry coverage are implemented.
- **PR #39 deterministic evidence (2026-07-12):** lint and typecheck clean; 296 unit tests passed
  with 6 credential-gated skips; production build passed; Playwright passed 35 with 1 existing
  skip across desktop/mobile. Diagnosis localized the initial live failure to discovery emitting a
  YouTube `/watch?v=` URL that ingestion rejected before temp allocation. A regression test now
  covers that seam; the original bounded one-candidate live smoke passed in 92.72 seconds.
- **PR #41 compatibility:** merged `origin/main` at `08620b7`; the grotesque-flat UI remains
  authoritative and Issue #28 adds only the feed button mount plus its small scoped styles.
- **Contract notes discovered by Lane A** (authoritative in `src/domain/analysis.ts`):
  cap labels are `"no-cap" | "some-cap" | "full-of-cap"`; verdicts
  `"true" | "mostly-true" | "unverifiable" | "false"`; trust tiers at
  `verifications[].evidence[].trustTier` ∈ `"primary" | "high" | "medium" | "low"`
  (gate requires ≥1 primary/high).
- **Keys verified live:** Gemini (repo pins `gemini-3.5-flash` — works; `gemini-2.5-flash` is
  retired for new keys, don't "fix" the model name downward) and Finnhub. Both are in
  `.env.local` of worktrees `issue-27-feed-tracer` and `issue-28-feed-refresh`
  (never commit these files). Still pending from Aziz: `YOUTUBE_API_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (from the dev-personal project, NOT snaplist).

## Remaining plan (in order)

1. Merge PR #40 (this one).
2. **Apply the committed migration to dev-personal** (Supabase MCP `apply_migration`,
   project_id `gcsradzqlidemdkebloa`, use the SQL file verbatim) and verify anon can SELECT
   but not INSERT.
3. Coordinator: review PR #39, apply `20260712002724_harden_feed_refresh.sql`, and verify the
   function-search-path advisor clears and the one-running-row index exists. Keep PR #39 open
   until review and CI are green.
4. Launch issue #29 on a fresh worktree off updated main: search + category filters
   (Investing/Credit/Taxes/Budgeting/Retirement + All), empty/no-match/reset states,
   responsive grid, no horizontal overflow at 375px. Calm consumer tool; Mobbin refs in #25.
5. Seed 6–10 real vetted videos (`npx tsx scripts/seed-feed.ts` for fixtures; live analyzer
   runs on hand-picked short finance videos for real ones — only gate-passers enter).
6. Rehearse: two consecutive refreshes idempotent; fixture fallback with zero keys; mobile 375px;
   README demo notes. Close #27/#28/#29/#30 as PRs merge; update epic #25.
7. Freeze ~9:15 PM. Submit by 10:00 PM.

## House rules (non-negotiable)

- Commits and PR bodies attributed solely to `azizu06 <ab725492@ucf.edu>`; **no AI co-author
  trailers, no "Generated with Claude Code" lines.**
- One issue = one branch = one PR; work only in worktrees under
  `/Users/aziz.u/Developer/hackathons/Capcheck/worktrees/`. The main checkout at
  `CapChecker/` has another session's dirty `docs/agents/*` edits — leave it alone.
- Locked cream design system (`docs/agents/ui-design.md`); copy says "CapCheck-vetted",
  never "guaranteed reliable". No grid iframes; embeds only on `/feed/[id]`.
- Rotate the Gemini/Finnhub keys after the hackathon (they transited chat).

## References

- Epic #25, decision record on #26, PRs #39/#40 (diffs are the detailed spec).
- Doability report artifact: `Capcheck/.lavish/verified-feed-doability.html`.
- Durable copy of this doc also at `Capcheck/HANDOFF-verified-feed-codex.md` (outside the repo).
