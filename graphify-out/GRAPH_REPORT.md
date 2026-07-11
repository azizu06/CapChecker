# Graph Report - 01KX96RAK9H2YDVQY1WWYGZRWY  (2026-07-11)

## Corpus Check
- 60 files · ~26,855 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 421 nodes · 542 edges · 33 communities (28 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `28f1d5d9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `CapCheck domain glossary` - 11 edges
3. `scripts` - 8 edges
4. `CapCheck shared UI specification` - 8 edges
5. `AnalysisEventSchema` - 7 edges
6. `AnalysisEvent` - 7 edges
7. `createNodeVideoIngestor()` - 7 edges
8. `BoundaryError` - 7 edges
9. `CapCheck agent guide` - 7 edges
10. `Agent skills` - 7 edges

## Surprising Connections (you probably didn't know these)
- `CI E2E Job` --implements--> `Fixture-Backed Playwright`  [INFERRED]
  .github/workflows/ci.yml → docs/agents/testing.md
- `Vertical Red-Green-Refactor TDD` --conceptually_related_to--> `Fixture-Backed Playwright`  [EXTRACTED]
  AGENTS.md → docs/agents/testing.md
- `Build lanes` --references--> `Demo fixture`  [EXTRACTED]
  AGENTS.md → CONTEXT.md
- `Consumer Trust Visual Hierarchy` --references--> `Scorecard`  [EXTRACTED]
  docs/agents/ui-design.md → CONTEXT.md
- `CI Quality Job` --implements--> `Required CI`  [EXTRACTED]
  .github/workflows/ci.yml → docs/agents/build-workflow.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **CapCheck Scorecard Domain** — context_scorecard, context_cap_score, context_verification, context_evidence_source, context_hype_language [EXTRACTED 1.00]
- **Independent Lane Contract Flow** — plans_2026_07_11_capcheck_foundation_frozen_contracts, plans_2026_07_11_capcheck_foundation_fixture_route, plans_2026_07_11_capcheck_foundation_frontend_tracer, agents_testing_independent_lane_seam [EXTRACTED 1.00]
- **Verdict-First UI Composition** — design_capcheck_ui_spec_intake_panel, design_capcheck_ui_spec_progress_timeline, design_capcheck_ui_spec_score_header, design_capcheck_ui_spec_claim_evidence_card [EXTRACTED 1.00]

## Communities (33 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (39): FixtureAnalysisInput, FixtureScenario, progress, errorResponse(), parseScenario(), POST(), safeStreamError, scenarios (+31 more)

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (15): allowedScenarios, CapCheckApp(), allowedExtensions, allowedUploadTypes, formatSize(), IntakePanel(), Props, validateSubmission() (+7 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (36): ErrorEventSchema, ProgressEvent, ProgressEventSchema, createGeminiFilesClient(), GeminiFilesClientOptions, ReadFile, transientStatuses, createNodeTemporaryFiles() (+28 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (32): Agent skills, Build workflow, Core Issue Frontiers, Dependency rule, Merge policy, Risk-Based No-Mistakes Gate, Parallel scheduling, Required CI (+24 more)

### Community 4 - "Community 4"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (24): CapCheck, Architecture Decision Records, Canonical Domain Language, Consumer Trust Visual Hierarchy, Cap Score, CapCheck, CapCheck domain glossary, Checkable claim (+16 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (17): dependencies, lucide-react, next, react, react-dom, zod, name, private (+9 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (16): devDependencies, eslint, eslint-config-next, jsdom, @playwright/test, tailwindcss, @tailwindcss/postcss, @testing-library/jest-dom (+8 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (25): Build lanes, Fixture-Backed Playwright, Fixture Mode Production Safety, Frozen Contract Lane Seam, Integrated Live Pipeline Smoke Test, CapCheck constraints, Impeccable, Lane B UI design workflow (+17 more)

### Community 9 - "Community 9"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 17 - "Community 17"
Cohesion: 0.17
Nodes (12): DetectedVideoMimeType, detectFromSignature(), detectVideoMimeType(), EXTENSION_TYPES, hasWebMDocType(), MIME_TYPES, MP4_BRANDS, normalizeDeclaredType() (+4 more)

### Community 18 - "Community 18"
Cohesion: 0.18
Nodes (12): ClaimCard(), ClaimCardProps, ClaimTimestamp(), verdictLabels, explanations, labels, ScorecardView(), trustRank (+4 more)

### Community 19 - "Community 19"
Cohesion: 0.18
Nodes (10): Frozen seam and invariants, Issue #2 foundation handoff, Issue #3: audit before coding, Issue #4: clean backend lane, Issue #5: extend, do not rebuild, Key implementation map, Next issue direction, Read in this order (+2 more)

### Community 20 - "Community 20"
Cohesion: 0.22
Nodes (8): Independent lane workflow, Lane A contract and integration tests, Lane B fixture-backed Playwright tests, PR evidence, TDD and browser QA workflow, Test layers, The required loop, Unit and component tests

### Community 21 - "Community 21"
Cohesion: 0.22
Nodes (8): CapCheck Foundation Implementation Plan, Global Constraints, Task 1: Scaffold and test harness, Task 2: Frozen contracts and fixtures, Task 3: Fixture analysis route and SSE parser, Task 4: Intake-to-result frontend tracer bullet, Task 5: Playwright E2E and responsive QA, Task 6: Full verification and handoff

### Community 22 - "Community 22"
Cohesion: 0.25
Nodes (7): Gemini Video Ingestion Implementation Plan, Global Constraints, Task 1: Orchestration tracer slice, Task 2: Upload and failure contracts, Task 3: Concrete external adapters, Task 4: Live smoke path and handoff, Task 5: Review and delivery

### Community 23 - "Community 23"
Cohesion: 0.25
Nodes (7): Architecture and the live-adapter seam, CapCheck, Commands, Fixture mode is server-only, Local setup, UI design contract, Verification before a PR

### Community 24 - "Community 24"
Cohesion: 0.29
Nodes (6): Analysis progress, CapCheck UI references, Evidence and sources, Intake and upload, Original-composition rule, Score and verdict summary

### Community 25 - "Community 25"
Cohesion: 0.33
Nodes (5): Demo notes, Issue, TDD evidence, Verification, What changed

### Community 26 - "Community 26"
Cohesion: 0.33
Nodes (5): Invariants, Shared-contract change: hype context and evidence-linked actions (Lane A must read), What changed, What issue #9 should populate, Where to look

### Community 27 - "Community 27"
Cohesion: 0.33
Nodes (5): Behavior and ownership, Issue #4 Gemini video ingestion handoff, Issue #6 wiring direction, Public entry point, Verification

### Community 28 - "Community 28"
Cohesion: 0.33
Nodes (5): Invariants (keep these when you populate it in #9), Shared-contract change: `Scorecard.skippedClaims` (Lane A must read), What #9 should do, What changed, Where to look

### Community 29 - "Community 29"
Cohesion: 0.40
Nodes (4): Commands, Graphify workflow, Repository policy, When to use it

### Community 30 - "Community 30"
Cohesion: 0.50
Nodes (3): Build ownership, Conventions, Issue tracker: GitHub

## Knowledge Gaps
- **198 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+193 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Build lanes` connect `Community 8` to `Community 3`, `Community 5`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `Fixture-Backed Playwright` connect `Community 8` to `Community 3`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `CapCheck agent guide` connect `Community 3` to `Community 8`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _202 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05552617662612375 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05423728813559322 - nodes in this community are weakly interconnected._