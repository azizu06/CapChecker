# Graph Report - .  (2026-07-11)

## Corpus Check
- Corpus is ~20,684 words - fits in a single context window. You may not need a graph.

## Summary
- 217 nodes · 281 edges · 17 communities (14 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Fixture SSE Pipeline|Fixture SSE Pipeline]]
- [[_COMMUNITY_Frontend User Flow|Frontend User Flow]]
- [[_COMMUNITY_Domain Contracts|Domain Contracts]]
- [[_COMMUNITY_Engineering Workflow|Engineering Workflow]]
- [[_COMMUNITY_TypeScript Configuration|TypeScript Configuration]]
- [[_COMMUNITY_Domain Model|Domain Model]]
- [[_COMMUNITY_Runtime Dependencies|Runtime Dependencies]]
- [[_COMMUNITY_Test Tooling|Test Tooling]]
- [[_COMMUNITY_Architecture and Design|Architecture and Design]]
- [[_COMMUNITY_App Shell Metadata|App Shell Metadata]]
- [[_COMMUNITY_ESLint Configuration|ESLint Configuration]]
- [[_COMMUNITY_Next.js Configuration|Next.js Configuration]]
- [[_COMMUNITY_PostCSS Configuration|PostCSS Configuration]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `scripts` - 8 edges
3. `AnalysisEvent` - 7 edges
4. `AnalysisEventSchema` - 6 edges
5. `DEMO_SCORECARDS` - 6 edges
6. `Scorecard` - 6 edges
7. `Required CI Contract` - 6 edges
8. `Fixture-Backed Playwright` - 6 edges
9. `DEMO_FATAL_ERROR` - 5 edges
10. `POST()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `CI E2E Job` --implements--> `Fixture-Backed Playwright`  [INFERRED]
  .github/workflows/ci.yml → docs/agents/testing.md
- `Vertical Red-Green-Refactor TDD` --conceptually_related_to--> `Fixture-Backed Playwright`  [EXTRACTED]
  AGENTS.md → docs/agents/testing.md
- `Consumer Trust Visual Hierarchy` --references--> `Scorecard`  [EXTRACTED]
  docs/agents/ui-design.md → CONTEXT.md
- `Pull Request Verification Contract` --references--> `Risk-Based No-Mistakes Gate`  [EXTRACTED]
  .github/pull_request_template.md → docs/agents/build-workflow.md
- `Pull Request Verification Contract` --references--> `Required CI Contract`  [EXTRACTED]
  .github/pull_request_template.md → docs/agents/build-workflow.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **CapCheck Scorecard Domain** — context_scorecard, context_cap_score, context_verification, context_evidence_source, context_hype_language [EXTRACTED 1.00]
- **Independent Lane Contract Flow** — plans_2026_07_11_capcheck_foundation_frozen_contracts, plans_2026_07_11_capcheck_foundation_fixture_route, plans_2026_07_11_capcheck_foundation_frontend_tracer, agents_testing_independent_lane_seam [EXTRACTED 1.00]
- **Verdict-First UI Composition** — design_capcheck_ui_spec_intake_panel, design_capcheck_ui_spec_progress_timeline, design_capcheck_ui_spec_score_header, design_capcheck_ui_spec_claim_evidence_card [EXTRACTED 1.00]

## Communities (17 total, 3 thin omitted)

### Community 0 - "Fixture SSE Pipeline"
Cohesion: 0.08
Nodes (19): FixtureAnalysisInput, FixtureScenario, progress, errorResponse(), parseScenario(), POST(), safeStreamError, scenarios (+11 more)

### Community 1 - "Frontend User Flow"
Cohesion: 0.09
Nodes (23): allowedScenarios, CapCheckApp(), ClaimCard(), verdictLabels, allowedExtensions, allowedUploadTypes, formatSize(), IntakePanel() (+15 more)

### Community 2 - "Domain Contracts"
Cohesion: 0.10
Nodes (22): AnalysisStageSchema, CheckableClaim, CheckableClaimSchema, Claim, ClaimBaseSchema, ClaimSchema, CompleteEvent, CompleteEventSchema (+14 more)

### Community 3 - "Engineering Workflow"
Cohesion: 0.12
Nodes (20): Core Issue Frontiers, Blocked-By Dependency Rule, Risk-Based No-Mistakes Gate, Required CI Contract, Milestone-Based Graphify Workflow, One Issue One Branch One PR Workflow, Isolated Worktree Ownership, GitHub Ready Frontier (+12 more)

### Community 4 - "TypeScript Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 5 - "Domain Model"
Cohesion: 0.12
Nodes (18): CapCheck, Architecture Decision Records, Canonical Domain Language, Consumer Trust Visual Hierarchy, Cap Score, Checkable Claim, Claim, Evidence Source (+10 more)

### Community 6 - "Runtime Dependencies"
Cohesion: 0.11
Nodes (17): dependencies, lucide-react, next, react, react-dom, zod, name, private (+9 more)

### Community 7 - "Test Tooling"
Cohesion: 0.12
Nodes (16): devDependencies, eslint, eslint-config-next, jsdom, @playwright/test, tailwindcss, @tailwindcss/postcss, @testing-library/jest-dom (+8 more)

### Community 8 - "Architecture and Design"
Cohesion: 0.15
Nodes (13): Independent Build Lanes, Frozen Contract Lane Seam, Integrated Live Pipeline Smoke Test, Evidence-Based UI Reference Order, Demo Fixture, Dark Semantic Design Token System, Mobile-First Responsive Layout, CapCheck Shared Visual Contract (+5 more)

### Community 9 - "App Shell Metadata"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

## Knowledge Gaps
- **96 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+91 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Fixture-Backed Playwright` connect `Engineering Workflow` to `Architecture and Design`?**
  _High betweenness centrality (0.000) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _103 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Fixture SSE Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.08097165991902834 - nodes in this community are weakly interconnected._
- **Should `Frontend User Flow` be split into smaller, more focused modules?**
  _Cohesion score 0.09247311827956989 - nodes in this community are weakly interconnected._
- **Should `Domain Contracts` be split into smaller, more focused modules?**
  _Cohesion score 0.10144927536231885 - nodes in this community are weakly interconnected._
- **Should `Engineering Workflow` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._
- **Should `TypeScript Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._