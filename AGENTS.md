# CapCheck agent guide

CapCheck fact-checks short-form financial influencer videos. The build targets
Bloomberg's Best FinTech Hack and Google's Best Use of Gemini during a 12-hour
hackathon. The planning repository is the source of truth for product scope:
<https://github.com/azizu06/bloom-plan>.

## Current foundation handoff

After issue #2, start with `docs/handoffs/issue-2-foundation.md`. It maps the
frozen contracts, fixture/live adapter seam, implemented UI, verification
baseline, and the remaining deltas for issues #3, #4, and #5. Audit that handoff
before creating new intake, progress, or scorecard components.

## Build lanes

- Lane A, assigned to `azizu06`, owns video ingestion and the Gemini pipeline.
- Lane B, assigned to `polter-dev`, owns the app shell and scorecard UI against
  frozen JSON fixtures.
- Shared issues are coordinated by both lanes. Do not change a frozen contract
  without updating both owners and the dependent issues.

Lane A and Lane B develop independently against the frozen contracts. Lane B
must not wait for the live Gemini pipeline. It uses the fixture-backed analysis
adapter described in `docs/agents/testing.md`, while Lane A verifies the same
contracts through unit and integration tests.

## Parallel execution

Do not work through independent issues sequentially. At every scheduling point,
identify the ready frontier: all open issues whose `Blocked by` issues are
closed. Dispatch separate agents or subagents to every independent issue on
that frontier at the same time.

Each agent owns exactly one issue, branch, worktree, and PR. Before dispatch,
check assignees, active branches, worktrees, and open PRs so two agents do not
claim the same surface. If independent issues would edit the same shared file,
give that file one owner or serialize those edits. The coordinator reviews all
returned work and runs the combined checks before integration.

## Test-driven development

TDD is mandatory for every implementation issue. Work in vertical
red-green-refactor cycles:

1. Write one test for one observable behavior and run it to prove it fails.
2. Write the smallest implementation that makes that test pass.
3. Refactor only while the suite is green, then start the next behavior.

Do not write production behavior first and add tests afterward. Tests use public
interfaces and mock only external boundaries such as Gemini, Finnhub, yt-dlp,
time, or the filesystem.

Lane A requires unit and contract tests for pipeline behavior. Lane B requires
unit or component tests plus Playwright E2E tests against deterministic fixture
mode. Every implemented button, link, route, input, progress transition, result
state, and recovery action must be exercised. Issue #10 reruns the fixture suite
against the combined app and adds one live local pipeline smoke test.

See `docs/agents/testing.md` for the independent-lane testing architecture and
the evidence required in each PR.

## Issue to PR workflow

1. Pick one issue labeled `ready-for-agent` whose blockers are closed.
2. Assign the issue before coding and move it to In Progress on the project.
3. Create one branch for that issue using `issue-<number>/<short-name>`.
4. Keep the change scoped to the issue and add `Closes #<number>` to the PR.
5. Run the relevant local checks. Run `no-mistakes` only when the issue has the
   `gate-no-mistakes` label.
6. Open one PR into `main`. Merge only after `quality` and `e2e` are green.
7. Move the issue to Done after the PR merges.

See `docs/agents/build-workflow.md` for the dependency rule, PR gate command,
required CI, and merge policy.

Do not commit secrets, downloaded demo videos, or cached creator content unless
the event rules and licensing allow it. Commits are authored only as Aziz or the
human teammate. Do not add AI co-author trailers.

## Agent skills

### Issue tracker

Work is tracked in GitHub Issues and the CapCheck 12-Hour Build project. See
`docs/agents/issue-tracker.md`.

### Triage labels

Use the standard Matt Pocock triage vocabulary plus lane and work-type labels.
See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context project. Read `CONTEXT.md` and relevant files under
`docs/adr/` before changing domain behavior. See `docs/agents/domain.md`.

### Codebase graph

Graphify is available for architecture navigation, but do not run it on every
commit. Query an existing graph first and refresh it only at the milestones in
`docs/agents/graphify.md`.

### UI design

The cream light visual direction is locked; do not redesign it. Reference
screens (Mobbin MCP first, then focused web image searches) are only for
genuinely new surface types, not for existing surfaces. Use Impeccable when
available to critique and refine implemented UI against the locked spec. See
`docs/agents/ui-design.md`.

### Testing

Use test-first vertical slices, fixture-backed Playwright for Lane B, and live
integration only at the shared convergence issue. See `docs/agents/testing.md`.
