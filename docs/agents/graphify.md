# Graphify workflow

Graphify is installed on Aziz's machine and provides a persistent code and
documentation graph for architecture questions. It is a milestone tool, not a
per-commit gate.

## When to use it

- Do not generate a graph while the repository contains only workflow docs.
- Generate the first graph after issue #2 lands and the contracts plus app
  scaffold exist.
- Refresh it after the core verification and scoring modules are present.
- Refresh it once more during issue #10 before final integration debugging.
- If `graphify-out/graph.json` exists, query it before rereading the whole repo.

## Commands

Create the first directed graph without the heavier HTML visualization:

```bash
graphify . --directed --no-viz
```

Refresh only changed files at a milestone:

```bash
graphify . --update --directed --no-viz
```

Ask a codebase question:

```bash
graphify query "How does a source video become a cited scorecard?"
```

Use `graphify path` when tracing a specific connection and `graphify explain`
when a domain or module node is unfamiliar.

## Repository policy

Commit `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` when a
milestone refresh materially changes the graph. Local caches, interpreter
paths, token accounting, and visualization files stay ignored.

Do not install a post-commit Graphify hook during the hackathon. Automatic
rebuilds add latency to the short issue and PR loop without improving the demo.
