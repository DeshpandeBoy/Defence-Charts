# `@gx/playground` — the resize lab

Not shipped, not published, not a demo. It exists to answer one question that the test
suite cannot: **what has actually been built, and does it behave the way the research says
it should when you drag a corner?**

```bash
pnpm install
pnpm dev            # or: pnpm --filter @gx/playground dev
```

Then open <http://localhost:5173>.

## What you are looking at

A container with `resize: both` and nothing else deciding its size, measured by a
`ResizeObserver`. Every number in the right-hand panel is a pure function of the two
numbers that observer reports, computed by `@gx/core` — a package that has never seen the
DOM and is forbidden from doing so by gate **G2**.

That seam is the architecture, and this page is where you can watch it hold:

- **The ladder** — which of the six size families the current footprint resolves to, and
  what the line/area ladder says renders at that rung.
- **`SizeContext`** — the resolver's first input, in full.
- **Published thresholds** — 6 / 24 / 40 / 80 px, and which the current height clears.
  These are findings, not preferences; each one is why a boundary sits where it does.
- **`tickCountForWidth()`** — `max(2, round(width / 100))`, with no upper cap.
- **`measureText()`** — the predicted width drawn as a bar behind the string the browser
  actually laid out, so the current table's over-estimate is a thing you can see.

## What is deliberately missing

**There is no chart.** `planChart()` lands at **A3** and the renderer at **A4**. Drawing a
placeholder would make the playground look further along than the library is, which is the
one thing a progress view must not do. What exists today is A2: the plan contract, size
classification, and text measurement.

## Two open questions this page makes visible rather than hides

1. **Nominal cell size.** `resolveSizeClass()` takes grid *cells*, because that is the unit
   the published ladder is written in. A chart rendered outside a dashboard grid has no
   cells, and no document in the corpus says what one pixel-derived cell is worth. Rather
   than pick a number that would quietly harden into a default, the conversion is a slider
   you have to move by hand. See `packages/core/src/context.ts` and
   `research/40-chart-plan.md` §11.

2. **`PROVISIONAL_FONT_METRICS` over-estimates, and by how much is on screen.** The default
   table ships zero per-character coverage and a ~1 em latin fallback band — an honest upper
   bound, not an average dressed up as one. It is blocked on `research/41-text-metrics.md`
   §4.1 and §4.2. The consequence: labels will degrade earlier than they should, and any A3
   snapshot involving `maxChars` or `axisLabelDegrade` is provisional.

   The "this browser" figure beside it is one machine with one set of installed fonts. It is
   an illustration, **not** the calibration §4.2 needs.

## Gate coverage

`scripts/check-tokens.mjs` scans `packages/` only, so `src/playground.css` sits outside the
raw-hex ban by construction. That is intentional — the chrome of a development tool is not
product surface. The line to watch: **the moment anything in this app starts describing how
a chart looks, it belongs in `@gx/tokens` and under the gate.**

The theme itself is imported through its published export (`@gx/tokens/theme.css`) rather
than reimplemented, so a broken export map shows up here as a page with no colour instead of
as a private copy carrying on regardless.

`useElementSize.ts` is a near-twin of the hook that lands in `@gx/react` at **A5**, minus
the containment work — see its docblock for why that omission is currently safe and when it
stops being so.
