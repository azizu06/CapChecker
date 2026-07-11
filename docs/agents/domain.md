# Domain docs

CapCheck uses a single domain context.

Before implementation, read:

- `CONTEXT.md` for canonical product language.
- Relevant ADRs under `docs/adr/` if any exist.
- The issue body and every issue listed in its `Blocked by` section.

Use the glossary's terms in code, tests, issues, and PRs. If implementation
would change the meaning of a domain term or contradict an ADR, stop and ask for
a decision instead of silently redefining it.

`CONTEXT.md` is a glossary, not an implementation spec. Record hard-to-reverse,
surprising tradeoffs as ADRs only when the decision genuinely needs the history.
