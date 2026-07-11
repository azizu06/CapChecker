# Lane B UI design workflow

CapCheck is a consumer trust tool, not a dense trading terminal. The interface
should make the verdict, evidence, and next action understandable from several
feet away while still working on a narrow screen.

## Reference order

Never design a screen blind.

1. If a Mobbin MCP is available and authenticated, search both screens and
   flows. Pull specific references for video or file intake, long-running
   progress, risk or trust scoring, fact-check evidence, and expandable result
   cards.
2. If Mobbin is unavailable, run focused web image searches for those same
   screen types. Prefer real products and case studies over generic dashboard
   galleries.
3. Record the three to five strongest reference URLs or screen names in the
   issue or PR before implementation.

Use references to extract hierarchy, spacing, interaction patterns, and state
handling. Do not copy another product's brand, text, icons, or proprietary
assets.

## Impeccable

If the agent has access to the Impeccable skill, use it after a real UI exists:

- `critique` after the first fixture-driven screen works.
- `audit` or `harden` for accessibility, responsive behavior, errors, loading,
  and overflow.
- `polish` before the Lane B PR is marked ready.

Impeccable is the evaluation and refinement layer. It does not replace Mobbin
or web references as the source of the initial visual direction. Do not pause
the hackathon to install it on an agent that does not already have access.

## CapCheck constraints

- Design narrow-screen behavior first, then verify the projector layout.
- Keep the URL input primary and file upload clearly available as fallback.
- Make score, verdict, and strongest citation the first visual hierarchy.
- Use one restrained type system, one icon family, and a small semantic color
  system. Color must communicate verdict or status, not decoration.
- Cover default, hover, focus, disabled, loading, empty, partial-failure, and
  fatal-error states.
- Keep motion short and useful. Respect reduced-motion preferences.
- Verify readable contrast, keyboard navigation, visible focus, and contained
  long URLs or claim text before opening the PR.
