# Issue tracker: GitHub

Issues live in `azizu06/CapChecker` on GitHub and are mirrored into the
`CapCheck 12-Hour Build` GitHub Project.

## Conventions

- Prefer `gh-axi` for issue and PR reads and writes.
- Publish blocker issues before their dependents so issue bodies can reference
  real issue numbers.
- Every implementation issue must include acceptance criteria and an explicit
  `Blocked by` section.
- An issue is agent-ready only when it has `ready-for-agent`, an owner, and no
  unresolved blocker.
- Use one issue, one branch, and one PR. Branches use
  `issue-<number>/<short-name>`.
- PR bodies must include `Closes #<number>`.
- The GitHub Project is the execution view. GitHub Issues remain the source of
  truth for requirements and dependencies.

## Build ownership

- `lane-a-pipeline`: `azizu06`
- `lane-b-ui`: `polter-dev`
- `lane-shared`: both teammates
