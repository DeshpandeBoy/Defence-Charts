# `@shiftcharts/playground` — local demos

The default route is the product-facing ShiftCharts dashboard demo. It shows three realistic
widgets in the controlled grid and makes the resize-to-information-density behavior visible.
The measurement lab remains available at `/?lab=1` for engineering inspection.

```bash
pnpm install
pnpm dev            # or: pnpm --filter @shiftcharts/playground dev
```

Then open <http://localhost:5173>.

## Current status

The local demo exercises the generated token surface, the Rail theme, `WidgetGrid`, `WidgetShell`,
`AutoChart`, controlled layout commits, keyboard movement/resizing and the line/area proof. The
measurement lab exposes the resolver and threshold details. Bar/timebar and the remaining chart
families are not part of this demo yet.

## What you are looking at by default

The dashboard explains the core interaction in one sentence: **shape your dashboard and the charts
follow**. Start in edit mode, move a widget with its grip, resize it from the corner, or use the
visible Move and Resize keyboard controls. `Reset layout` returns the three widgets to their
initial placements. `View details` opens a compact explanation of the grid, planner and stable
identity contract.

Each widget owns its metric, title and data. The grid owns placement and passes the actual footprint
to `AutoChart`, so the chart can change its information density without the grid knowing what the
chart means. The optional details panel also links to the measurement lab.

## Measurement lab (`/?lab=1`)

A container with `resize: both` and nothing else deciding its size, measured by a
`ResizeObserver`. Every number in the right-hand panel is a pure function of the two
numbers that observer reports, computed by `@shiftcharts/core` — a package that has never seen the
DOM and is forbidden from doing so by gate **G2**.

That seam is the architecture, and this page is where you can watch it hold:

- **The ladder** — which of the six size families the current footprint resolves to, and
  what the line/area ladder says renders at that rung.
- **`SizeContext`** — the resolver's first input, in full.
- **Published thresholds** — 6 / 24 / 40 / 80 px, and which the current **plot** height
  clears. These are findings, not preferences; each one is why a boundary sits where it
  does. The widget height is shown beside it, and the gap between the two is the chrome.
- **`tickCountForWidth()`** — `max(2, round(width / 100))`, with no upper cap.
- **`planChart()`** — the resolved `ChartPlan`, as formatted JSON, recomputed on every
  resize. Chart type and series count are controls, because both change the plan and
  neither is a size.
- **`measureText()`** — the predicted width drawn as a bar behind the string the browser
  actually laid out, so the current table's over-estimate is a thing you can see.

## The two things to actually watch

**The plot height, not the widget height.** The thresholds are compared against what is
left after the value region, x-axis band and legend band take their share. That vertical
chain is **Tier B** — ours, consistent with the corpus but not drawn from it, because the
published work fixes only the horizontal order. Drag until a threshold flips and the plan
above it changes in the same frame.

**The fingerprint returns.** Drag out past a boundary and back in: the hash beside the plan
must land on exactly the value it had before. `planChart()` remains a pure function of size and
shape — gate **G10** asserts that — while the live `AutoChart` boundary now holds a 1% fractional
deadband around rung mounts so a slow resize wobble does not blink new marks on and off. The panel
uses the same classifier and previous-rung rule as the chart beside it.

## What is deliberately missing

**The line chart is the demo's focus.** The playground exercises the delivered A4–A6 renderer,
`AutoChart`, B1-B3 control surface, fractional rung deadband and CSS transition path beside the
resolver's JSON output. The core planner and family renderers now cover all ten registered chart
types; the product-facing demo stays intentionally focused on line and area.


## The remaining open question this page makes visible

Standalone charts now use `sizeContextFromPixels()` and its exported 100 px nominal-cell
default. The number is explicitly **Tier C** — project-owned and configurable, not dressed
up as a research finding. Grid-owned charts bypass it and pass their real footprint.

**Which face is actually painting, and therefore what the ratio means.** The metrics table
is real now — measured offline from a content-pinned Roboto Flex by
`scripts/generate-font-metrics.mjs` — and it ships with `safetyFactor: 1.57`, the widest
advance ratio observed across the reachable fallback faces. The panel shows two ratios
because they answer different questions: `over-estimate` includes that margin and must
never drop below `1.00×`, and `margin divided out` removes it, showing how closely the
table tracks the glyphs this browser chose.

The playground does not bundle the reference face — `research/41-text-metrics.md` §7 keeps
font files out of the build — so on most machines this reads a fallback, and the panel says
which. That is a fair test of the safety factor and **not** a test of the table: one
browser on one machine with one set of installed fonts is an illustration, and §4.2's
controlled `fonttools` pass is the calibration. Segoe UI Variable stays **UNVERIFIED**:
Windows-only, unobtainable here, and never estimated.

## Gate coverage

`scripts/check-tokens.mjs` scans `packages/` only, so `src/playground.css` sits outside the
raw-hex ban by construction. That is intentional — the chrome of a development tool is not
product surface. The line to watch: **the moment anything in this app starts describing how
a chart looks, it belongs in `@shiftcharts/tokens` and under the gate.**

The theme itself is imported through its published export (`@shiftcharts/tokens/theme.css`) rather
than reimplemented, so a broken export map shows up here as a page with no colour instead of
as a private copy carrying on regardless.

`useElementSize.ts` is a near-twin of the hook that lands in `@shiftcharts/react` at **A5**, minus
the containment work — see its docblock for why that omission is currently safe and when it
stops being so.
