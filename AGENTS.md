# CapCheck agent guide

CapCheck fact-checks short-form financial influencer videos. The build targets
Bloomberg's Best FinTech Hack and Google's Best Use of Gemini during a 12-hour
hackathon. The planning repository is the source of truth for product scope:
<https://github.com/azizu06/bloom-plan>.

## Build lanes

- Lane A, assigned to `azizu06`, owns video ingestion and the Gemini pipeline.
- Lane B, assigned to `polter-dev`, owns the app shell and scorecard UI against
  frozen JSON fixtures.
- Shared issues are coordinated by both lanes. Do not change a frozen contract
  without updating both owners and the dependent issues.

## Issue to PR workflow

1. Pick one issue labeled `ready-for-agent` whose blockers are closed.
2. Assign the issue before coding and move it to In Progress on the project.
3. Create one branch for that issue using `issue-<number>/<short-name>`.
4. Keep the change scoped to the issue and add `Closes #<number>` to the PR.
5. Run the relevant local checks. Run `no-mistakes` only when the issue has the
   `gate-no-mistakes` label.
6. Open one PR into `main`. Merge only after the `quality` check is green.
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
