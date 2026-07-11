# CapCheck UI references

These Mobbin screens informed the shared visual contract in
[`../design/capcheck-ui-spec.md`](../design/capcheck-ui-spec.md). Agents should
use this inventory to understand the source pattern, then implement the exact
CapCheck tokens and component rules from the design specification. The theme
these patterns render in is the locked cream light theme in
[`../agents/ui-design.md`](../agents/ui-design.md#locked-design-decisions), not
the dark navy canvas some of the source screens use — treat every entry below
as a layout/interaction reference only, never a color reference. See that file
for the additional cream-light-specific references gathered for the score
header and tabbed results layout.

## Intake and upload

- [Revolut Business upload](https://mobbin.com/screens/2a7be71f-2e9a-404c-9c56-c846d8616783)
  informed the centered intake focus, quiet upload surface, and visible
  selected-file state.
- [Fireflies upload](https://mobbin.com/screens/b11ca206-fbe6-4042-8b1c-42cf2089427a)
  informed the obvious drop target, supported-format guidance, single primary
  action, and upload status placed directly below the control.

## Analysis progress

- [WRITER research process](https://mobbin.com/screens/c1bf8d44-7bea-4b68-b47c-1acbe324389e)
  informed named research stages and a visible current activity instead of an
  invented percentage.
- [Rox research stepper](https://mobbin.com/screens/107c729c-a68d-48e3-8ece-51d43eff4215)
  informed the thin progress rail, step count, and concise nested activity
  details.

## Score and verdict summary

- [Visitors experience score](https://mobbin.com/screens/16a48591-f4ad-4fb6-b19a-cb06804b590c)
  informed the dominant numeric score, plain-language rating, short
  explanation, and labeled score bands.
- [Vanta tests dashboard](https://mobbin.com/screens/eb1d71b4-2b3c-4a83-8435-bdc0e7cbb9e2)
  informed restrained semantic status colors and clear grouping between
  healthy items and items that need attention.

## Evidence and sources

- [Cursor runtime evidence](https://mobbin.com/screens/c4e5b1fe-4379-4a73-8b16-1f1358731793)
  informed evidence grouped beneath a concise conclusion with scannable source
  details.
- [ChatGPT research sources](https://mobbin.com/screens/f04ce3e0-b627-4e84-a554-615d0930d8e2)
  informed separating source activity from the answer while keeping citations
  inspectable.

## Original-composition rule

CapCheck combines intake focus, truthful stage progress, a verdict-first score,
and expandable claim evidence into its own product flow. The references are
pattern inspiration only. Do not copy any product's brand assets, navigation,
labels, proprietary artwork, or exact screen layout. When a reference conflicts
with the CapCheck design specification, the CapCheck specification wins.
