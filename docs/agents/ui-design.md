# Lane B UI design workflow

CapCheck is a consumer trust tool, not a dense trading terminal. The interface
should make the verdict, evidence, and next action understandable from several
feet away while still working on a narrow screen.

## Locked design decisions

The user has approved a full front-end design direction through iterated
mockups. The decisions below are **locked**. Agents implement against this
spec; do not change any token, font, accent rule, tone, motion budget, or the
results layout without explicit user sign-off. If an issue or reference seems
to conflict with this section, stop and ask rather than silently redesigning.

### Theme: cream grotesque-flat (1c/2a)

The approved 1c landing and 2a results direction is flat, square, and
typography-led. Dark themes, the earlier navy + mint scheme, rounded fintech
cards, blue interaction accents, and decorative shadows are rejected. Use only
the following surface and text tokens.

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#faf8f3` | page background |
| `surface` | `#ffffff` | white cards |
| `surface-raised` | `#f5f2ea` | raised panels, nested/expanded areas |
| `border` | `#e7e2d6` | default boundaries |
| `border-strong` | `#cfc9ba` | hover/selected boundaries |
| `text` | `#211f1b` | ink, primary text |
| `text-muted` | `#6b675f` | supporting copy |
| `text-subtle` | `#706b63` | essential metadata at 14px or larger |
| `decorative-subtle` | `#98928a` | nonessential decoration only |

Surfaces are flat: use 1px ink or neutral rules for hierarchy and no card
shadows. Components use square corners throughout.

### Typography

- Display, headings, body, and UI copy: **Instrument Sans** via
  `next/font/google`. Do not restore the superseded Baloo 2 / Nunito pairing.
- Monospace: **Geist Mono**, strictly reserved for data — timestamps, URLs,
  confidence percentages, counts. Never use monospace for prose or labels.

### Accent and semantic color

- Interaction accent: ink `#211f1b`. Links, focus rings, selected filters,
  buttons, and the square identity mark use ink, underline, or inversion rather
  than blue. Color is reserved for verdict meaning.
- Verdict/semantic colors are reserved for verdicts and must not be reused for
  decoration or generic interactivity:
  - Green (`No cap`): ink `#1d8a55`, pill ink `#19784a`, tint `#e2f3e9`.
  - Amber (`Some cap`): ink `#9c6a0a`, pill ink `#8e6009`, tint `#f8eed4`.
  - Red (`Full of cap`): ink `#c23f3e`, pill ink `#b83c3b`, tint `#fbe7e4`.
  The darker pill inks are used for compact verdict text and status dots against
  their matching tints; headings and meter bands keep the standard semantic inks.
- Minimal color is the anti-"mental clutter" rule. If a new element seems to
  need a new color, it probably needs restraint instead.

### Copy tone

Sober and financial-grade, with exactly one wink: the verdict labels stay
`No cap`, `Some cap`, `Full of cap`. Everything else — labels, errors, empty
states, methodology copy — reads like a credible fintech product, not a meme
account.

The approved identity descriptor is `Financial advice, fact-checked`; the page
title is `Is that stock tip cap? Check before you act.` and the primary action
is `Check it`.

### Motion budget

Exactly one hero moment: the score count-up plus meter pin sweep (React Bits
`CountUp` or an equivalent lightweight primitive). All other motion is
functional only — expand/collapse, tab crossfade — and stays short (120-220ms).
Respect `prefers-reduced-motion: reduce` everywhere; the hero moment must have
a static fallback (score and pin render at final state with no animation).

### Results layout

No long scroll. The results screen is:

1. A compact score header: score + verdict + meter on one side, summary +
   strongest source on the other. Not a full-bleed hero block.
2. Tabbed sections below it: "Claims reviewed", "Hype language", "Before you
   act", each with a count badge on its tab.
3. A persistent mini-intake in the app header while in the results state, so a
   user can start a new check without losing place.
4. A "How the Cap Score works" three-column strip plus a simple footer stating
   that CapCheck verifies claims and is not financial advice. Do not render
   dead footer links or invent destinations, so the results never float alone
   on the page with nothing underneath.

Verdict pills remain compact, square, and explicit. No colored left-border card
stripes and no decorative rounded pills.

### Component source

[React Bits](https://github.com/DavidHDev/react-bits) is the approved source
for the score moment and any subtle transitions. Showcase flair from that
library — auroras, custom cursors, 3D effects — is banned; CapCheck is a
credibility tool, not a portfolio site.

## Reference order

The visual direction above is locked, not exploratory. References are for
**new surface types only** — a surface CapCheck doesn't already have a pattern
for (e.g. a settings screen, an admin view). Existing surfaces (intake,
progress, score header, claim/evidence cards, hype language, next actions)
follow the locked spec in this file and in
[`docs/design/capcheck-ui-spec.md`](../design/capcheck-ui-spec.md) — do not
re-derive them from fresh references.

When a genuinely new surface type is needed:

1. If a Mobbin MCP is available and authenticated, search both screens and
   flows for that surface type specifically.
2. If Mobbin is unavailable, run focused web image searches for the same
   surface type. Prefer real products and case studies over generic dashboard
   galleries.
3. Record the strongest reference URLs in the issue or PR, and reconcile any
   pattern you borrow with the locked tokens, type system, and accent rule
   above — the reference informs hierarchy and interaction only, never color,
   font, or tone.

Do not copy another product's brand, text, icons, or proprietary assets.

## References

Mobbin references that informed the cream/light, score-forward, tabbed-result
direction. Use these for hierarchy and interaction patterns only — colors,
type, and copy always follow the locked spec above.

- [Shopify fraud analysis](https://mobbin.com/screens/c2fad317-7922-45cf-b0bc-63f9deb789ca) —
  white card with a segmented low/medium/high meter, a plain-language
  recommendation line, and a bullet list of contributing indicators. Take: the
  meter-plus-recommendation pairing for the score header.
- [Whop dispute risk](https://mobbin.com/screens/03413816-d3ca-4486-b76a-395028847517) —
  light panel with a green-to-red gradient risk meter and a "what impacts your
  score" breakdown underneath. Take: pairing the meter with a short factor
  breakdown instead of a wall of stats.
- [Uxcel assessment report](https://mobbin.com/screens/d81e2956-cb2e-4611-a05e-c6bf9c20a9e7) —
  white canvas, large score number as the dominant element, percentile bar
  chart, and a "knowledge summary" section below. Take: score-first visual
  hierarchy on a pure light background with no dark chrome.
- [Quicken debt-to-asset ratio](https://mobbin.com/screens/5ea13ab3-5e64-4428-a582-bd4eedb439d2) —
  cream/off-white dashboard panel with a colored gradient meter and a
  status pill ("Risky") sitting directly next to the number. Take: status pill
  placement and a warm-neutral (not stark white/grey) panel background.
- [Origin budget breakdown](https://mobbin.com/screens/92e8e72b-f34b-4f3b-a77d-2003725a16bc) —
  light cream background with an underline-style tab row (Expenses / Budget /
  Income) above a circular progress meter and itemized list. Take: tab visual
  treatment and how a meter anchors a tabbed content area.

## Impeccable

If the agent has access to the Impeccable skill, use it after a real UI exists:

- `critique` after the first fixture-driven screen works.
- `audit` or `harden` for accessibility, responsive behavior, errors, loading,
  and overflow.
- `polish` before the Lane B PR is marked ready.

Impeccable is the evaluation and refinement layer against the locked spec. It
does not license drifting the palette, type, or layout back toward a prior
direction.

## CapCheck constraints

- Design narrow-screen behavior first, then verify the projector layout.
- Keep the URL input primary and file upload clearly available as fallback.
- Make score, verdict, and strongest citation the first visual hierarchy.
- Use the locked type system, one icon family, and only the semantic color
  system above. Color must communicate verdict or status, not decoration.
- Cover default, hover, focus, disabled, loading, empty, partial-failure, and
  fatal-error states.
- Keep motion short and useful. Respect reduced-motion preferences.
- Verify readable contrast, keyboard navigation, visible focus, and contained
  long URLs or claim text before opening the PR.
