# CapCheck shared UI specification

This file is the visual contract for CapCheck. Lane A and Lane B may implement
independently, but every user-facing screen must use these tokens, component
patterns, and responsive rules unless a coordinated issue changes this spec.

## Product character

CapCheck is a calm consumer trust tool for evaluating short-form financial
claims. It should feel credible, legible from a projector, and approachable on
a phone. The interface uses the locked cream light theme (see
[`docs/agents/ui-design.md`](../agents/ui-design.md) for the authoritative
tokens, fonts, accent rule, and results layout), with color reserved for
status and verdict meaning. It is not a trading terminal and should not
imitate another product's brand, copy, or proprietary artwork.

## Mobbin reference composite

The intake, progress, and evidence patterns below still apply; ignore any
"dark navy" framing in the borrowed pattern descriptions — CapCheck now
renders these patterns on the cream light canvas defined in
`docs/agents/ui-design.md`.

- [Revolut Business upload](https://mobbin.com/screens/2a7be71f-2e9a-404c-9c56-c846d8616783): centered intake, quiet upload surface, and visible file state.
- [Fireflies upload](https://mobbin.com/screens/b11ca206-fbe6-4042-8b1c-42cf2089427a): obvious drop target, supported-format guidance, one primary action, and upload status below the control.
- [WRITER research process](https://mobbin.com/screens/c1bf8d44-7bea-4b68-b47c-1acbe324389e): named research stages and a visible current activity instead of an invented percentage.
- [Rox research stepper](https://mobbin.com/screens/107c729c-a68d-48e3-8ece-51d43eff4215): thin progress rail, step count, and concise nested activity details.
- [Visitors experience score](https://mobbin.com/screens/16a48591-f4ad-4fb6-b19a-cb06804b590c): dominant score, plain-language rating, explanation, and labeled score bands.
- [Vanta tests dashboard](https://mobbin.com/screens/eb1d71b4-2b3c-4a83-8435-bdc0e7cbb9e2): restrained semantic status colors and clear separation between healthy and attention-needed items.
- [Cursor runtime evidence](https://mobbin.com/screens/c4e5b1fe-4379-4a73-8b16-1f1358731793): evidence grouped under a concise conclusion with scannable source details.
- [ChatGPT research sources](https://mobbin.com/screens/f04ce3e0-b627-4e84-a554-615d0930d8e2): source activity separated from the answer, with citations that remain inspectable.

The CapCheck composition is original: combine the intake focus, truthful stage
feed, verdict-first score, and expandable claim evidence without copying any
reference's navigation, labels, logo, or exact layout.

## Design tokens

### Color

Full token table, the single interactive accent rule, and the verdict color
mapping are defined once in
[`docs/agents/ui-design.md`](../agents/ui-design.md#locked-design-decisions)
and are locked. Summary: `canvas #faf8f3`, `surface #ffffff`,
`surface-raised #f5f2ea`, `border #e7e2d6`/`#cfc9ba`, `text #211f1b`,
`text-muted #6b675f`, `text-subtle #98928a`; accent `#2f66d0`; verdict green
`#1d8a55`/`#e2f3e9`, amber `#9c6a0a`/`#f8eed4`, red `#c23f3e`/`#fbe7e4`.

Do not use decorative gradients. Semantic color must always be paired with an
icon or label. Avoid large saturated fills; use tinted surface backgrounds
with strong foreground text. The accent blue appears only on interactive
elements, never as decoration.

### Typography

- Font family: Baloo 2 for display and headings, Nunito for body and UI copy
  (both via `next/font/google`); Geist Mono only for URLs, source domains,
  timestamps, confidence percentages, counts, and other compact data.
- Display score: `clamp(3.5rem, 12vw, 7rem)`, weight 650, line-height 0.9.
- Page title: `clamp(2rem, 5vw, 4.5rem)`, weight 600, line-height 1.02.
- Section title: 1.25rem desktop and 1.125rem mobile, weight 600.
- Body: 1rem, line-height 1.6. Small metadata: 0.8125rem, line-height 1.4.
- Keep body measures at 68 characters or less. Do not use uppercase for prose.

### Geometry and spacing

- Spacing scale: `4, 8, 12, 16, 24, 32, 48, 64px` only.
- Panel and card radius: 16px. Inputs and buttons: 12px. Pills: 999px.
- Standard border: 1px solid `border`; selected/focus border: `border-strong`.
- Shadow: a soft, warm, low-opacity shadow (not black) on the one primary
  raised panel only — see the locked spec for the exact treatment.
- Content width: 1180px maximum, 24px desktop gutters, 16px mobile gutters.
- Interactive controls: at least 44px tall; primary actions are 48px tall.

## Responsive layout

- Below 768px, use one column. Intake controls, progress, score, and claims all
  span the available width. Actions stack when two 44px controls cannot fit.
- At 768px and above, the result header may use a 5/7 split: score/verdict left,
  strongest takeaway and actions right.
- Progress appears as a vertical feed on all widths. Never rely on a horizontal
  stepper that overflows a phone.
- Long URLs and claim text wrap with `overflow-wrap: anywhere`; source domains
  remain visible. No horizontal page scrolling at 375px.
- The first viewport must show app identity, the primary question, URL input,
  Analyze action, and the upload fallback without requiring navigation.

## Component contracts

### App header

Use a compact wordmark row: shield/check icon, `CapCheck`, and the descriptor
`AI financial claim verifier`. No full dashboard sidebar for the hackathon flow.

### Intake panel

- URL is the primary labeled input. Its helper copy states which video URLs are
  accepted and errors appear directly below it.
- `Analyze video` is the only filled primary button.
- A visible `or upload a video` divider reveals or focuses the drop zone; upload
  is never hidden in an overflow menu.
- Selected files show name, size, status, and a labeled remove control.
- Cover default, hover, focus-visible, invalid, selected, disabled, and loading.

### Progress timeline

- Show the six contract stages in order: Fetching, Processing, Extracting,
  Verifying, Synthesizing, Complete.
- Completed stages use a check icon; the current stage uses a subtle pulse and
  live text; future stages remain muted. Pair every state with text.
- Use `aria-live="polite"` for stage updates and honor reduced motion.
- Do not display percentages unless the backend exposes a measured percentage.

### Score header

- The results screen is a compact score header (no long scroll), followed by
  tabbed sections — see the locked results layout in
  [`docs/agents/ui-design.md`](../agents/ui-design.md#locked-design-decisions).
- The Cap Score is the strongest visual element, followed by verdict label and
  a one-sentence explanation. The one animated hero moment (score count-up and
  meter pin sweep) lives here; every other transition is a short functional
  crossfade or expand/collapse.
- Cap Score measures how much misleading or unsupported content is present, so
  higher is worse: 0-29 `No cap`, 30-69 `Some cap`, 70-100 `Full of cap`.
  Always print the label and short explanation; color alone is insufficient.
  Verdict pills are bold uppercase Nunito with a status dot, not a colored
  card-border stripe.
- Show the strongest citation or takeaway within the same result header area.
- Reset and retry are secondary actions, visually quieter than Analyze.
- Claims reviewed, hype language, and next actions render as tabs with count
  badges beneath the header, not as stacked full-width sections.

### Claim and evidence card

- Collapsed row shows claim text, Supported/Contradicted/Unverifiable label,
  confidence, and an explicit expand button with `aria-expanded`.
- Expanded content order: explanation, evidence excerpt, source title/domain,
  then `Open source` external link. Never make the entire card an ambiguous
  click target.
- Evidence links open in a new tab with `noopener noreferrer` and include an
  external-link icon plus accessible text.
- Partial failure stays inline on the affected claim and does not erase other
  completed results.

## Interaction, accessibility, and motion

- Keyboard order follows visual order. All interactive elements have visible
  `2px` accent-colored (`#2f66d0`) focus rings with a `2px` offset.
- Text and controls meet WCAG AA contrast. Muted text is not used below 14px.
- Buttons use verbs and preserve width while loading. Disabled state remains
  readable and explains itself through adjacent status text.
- Motion lasts 120-220ms and communicates state. Under
  `prefers-reduced-motion: reduce`, remove transforms, pulses, and smooth scroll.
- Fatal errors retain the submitted input and present a clear retry action.

## QA contract

Playwright must exercise every visible button, link, input, upload control,
claim expander, reset, and retry path in desktop and mobile Chromium. Verify no
runtime console errors, keyboard focus, route stability, 375px containment, and
all fixture outcomes. A final combined test runs after the live adapter lands;
fixture-backed E2E remains the deterministic CI gate.
