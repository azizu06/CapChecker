# Build workflow

## Dependency rule

An issue can move from Todo to In Progress only when every issue in its
`Blocked by` section is closed. Agents may prepare notes for blocked work but
must not merge dependent code early.

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

The `quality` job runs install, lint, typecheck, and build. Before the Next.js
scaffold exists, the job intentionally reports that there is no application to
validate. Once `package.json` exists, a missing lockfile or missing required
script fails CI.

## Merge policy

- Target `main`.
- Keep one issue per PR.
- Require the `quality` check.
- Never merge a PR with unresolved dependencies.
- For an issue labeled `gate-no-mistakes`, never bypass a failed gate by pushing
  the same branch directly to `origin`.
