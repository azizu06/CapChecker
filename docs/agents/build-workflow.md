# Build workflow

## Dependency rule

An issue can move from Todo to In Progress only when every issue in its
`Blocked by` section is closed. Agents may prepare notes for blocked work but
must not merge dependent code early.

## Parallel scheduling

The coordinator recomputes the ready frontier whenever a blocking issue closes.
If two or more ready issues do not depend on each other and do not own the same
files, dispatch them in one batch to separate agents or subagents.

Current core frontiers are:

- After issue #2 closes, issues #3, #4, and #5 can run concurrently.
- Issues #3 and #5 are both Lane B but are independent. They may be split
  between the teammate's main agent and one isolated subagent.
- Issue #6 waits for #4. Issue #8 waits for both #3 and #5.
- Issue #10 waits for both Lane A issue #9 and Lane B issue #8.

Parallel workers must use separate worktrees and must not share a feature
branch. Give each worker the issue body, relevant domain docs, ownership limits,
required checks, and the expected handoff summary. Before merging the returned
PRs, the coordinating agent reviews for contract drift and runs the combined
quality checks.

Every parallel implementation worker follows the TDD workflow in
`docs/agents/testing.md`. Lane B runs fixture-backed Playwright without waiting
for Lane A. Full live-pipeline browser verification waits for issue #10, but
unit, contract, component, and fixture-backed E2E tests run during development.

## Risk-based no-mistakes gate

Normal planning, repository setup, documentation, and routine UI PRs use focused
local checks plus GitHub CI. They do not run `no-mistakes`.

Use `no-mistakes` only when the issue has the `gate-no-mistakes` label. This is
for changes where a subtle failure can break the live demo, including video
ingestion, claim verification, scoring, and final integration. Commit the issue
work on its feature branch and run:

```bash
no-mistakes axi run --intent "<the issue goal and relevant constraints>" --skip=document
```

The minimal gate skips documentation generation and keeps review, tests, lint,
push, PR creation, and CI. Do not use `--yes`. Escalate `ask-user` findings to a
human. A `checks-passed` outcome means the PR is ready for human review, not
automatically approved for merge.

## Required CI

The `quality` job runs install, lint, typecheck, unit tests, and build. The
`e2e` job installs Chromium and runs the fixture-backed Playwright suite. Before
the Next.js scaffold exists, both jobs intentionally report that there is no
application to validate. Once `package.json` exists, a missing lockfile or any
required script fails CI.

## Merge policy

- Target `main`.
- Keep one issue per PR.
- Require both `quality` and `e2e` checks.
- Never merge a PR with unresolved dependencies.
- For an issue labeled `gate-no-mistakes`, never bypass a failed gate by pushing
  the same branch directly to `origin`.
