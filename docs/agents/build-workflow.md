# Build workflow

## Dependency rule

An issue can move from Todo to In Progress only when every issue in its
`Blocked by` section is closed. Agents may prepare notes for blocked work but
must not merge dependent code early.

## Pull request gate

Before opening or updating a PR, commit the issue work on its feature branch and
run:

```bash
no-mistakes axi run --intent "<the issue goal and relevant constraints>" --skip=document
```

This keeps the minimal gate focused on review, tests, lint, push, PR creation,
and CI. Do not use `--yes`. Escalate `ask-user` findings to a human. A
`checks-passed` outcome means the PR is ready for human review, not automatically
approved for merge.

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
- Never bypass a failed `no-mistakes` run by pushing the same branch directly
  to `origin`.
