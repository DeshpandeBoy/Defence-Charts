# CR-VT01 — Visual audit of every chart family across the responsive ladder

Status: ready for Claude review
Date/access window: 2026-08-25 onward
Repository baseline: `591ed1f11b6b9fa96f4c3b74688aab1aa76f366b` (code baseline: `73cd88b`)
Owner: Claude review agent
Coordinator: Codex

## Exact question and exclusions

For every registered chart family and every responsive rung, can a person looking at the rendered
SVG answer:

1. What kind of chart is this?
2. What data is visible, and what does each visible mark/label represent?
3. Which series/category/value is primary at this size?
4. What information was intentionally reduced, moved, or hidden by the size contract?
5. Can the result still be understood after the card is resized to a narrow width?

Report visual and repository evidence only. Do not modify implementation files. Do not silently
change the responsive plan, chart semantics, data fixtures, or accessibility contract. A proposed
fix belongs in the issue register and must be phrased as a proposal for Codex review.

## Run setup

Use the existing local server if it is already serving the fixture. Otherwise, from the isolated
worktree start:

```bash
cd /Users/SameeraD/Defence-Charts-CR-VT01
npx --yes pnpm@10.34.5 --filter @gx/playground exec vite --config src/family-matrix-fixture.vite.ts
```

Open:

```text
http://127.0.0.1:5186/
```

Use a real Chromium browser. Record browser version, viewport, device scale factor if available,
OS, and font environment. Set reduced motion for repeatability. Check dark and light themes; use
forced colors for the representative sweep described below.

## Exact audit matrix

Inspect all 60 selectors:

```text
[data-family-case="<type>-<rung>"]
```

Types:

```text
line, area, bar, timebar, scatter, donut, kpi, progress, heatmap, funnel
```

Rungs:

```text
micro, tile, strip, panel, canvas, stage
```

Viewports:

| Profile | Width × height | Required work |
|---|---:|---|
| Desktop | `1440×1100` | Full 60-card visual and metric sweep. |
| Narrow | `390×844` | Full 60-card visual and metric sweep; prioritize clipping and identity loss. |
| Forced colors | Use browser emulation at both profiles if supported | At least one card per type at Micro, Strip, and Stage; expand to all six rungs for any failure. |
| Light theme | Toggle `[data-family-theme-toggle]` | Full type/rung issue sampling; compare text, strokes, fills, and data identity. |

Capture one full-page matrix screenshot per profile. For each card, capture a focused screenshot
only when an issue is found or when the card is needed to explain a family-wide pattern. Store
temporary artifacts under `/tmp/defence-charts-CR-VT01/`, for example:

```text
/tmp/defence-charts-CR-VT01/desktop/line-micro.png
/tmp/defence-charts-CR-VT01/narrow/heatmap-strip.png
/tmp/defence-charts-CR-VT01/forced-colors/funnel-stage.png
```

Do not commit a large screenshot directory. In the report, link only the focused evidence needed
to reproduce an issue and record the full-page screenshot paths.

## Exact fixture data to keep in view

These are the data fixtures shipped in `apps/playground/src/family-matrix/matrix.ts`. Treat this
table as repository evidence, not as a visual assumption. Confirm the rendered labels/values match.

| Type(s) | Fixture | Data facts that must remain recoverable |
|---|---|---|
| `line`, `area`, `bar`, `timebar`, `scatter` | `MATRIX_DATA` | Six series: Alpha, Bravo, Charlie, Delta, Echo, Foxtrot; eight x positions `0…7`. Alpha `5…12`; Bravo `10…3`; Charlie `15…22`; Delta `20…13`; Echo `25…32`; Foxtrot `30…23`. `area` adds fill; `timebar` currently uses the same numeric-x fixture, so do not claim date-axis semantics. |
| `donut` | `DONUT_MATRIX_DATA` | One series labelled `Program mix`; ten values `[40, 24, 16, 10, 6, 4, 3, 2, 1, 1]`; small categories and any `Other` treatment must be visible or explicitly disclosed. |
| `kpi` | `KPI_MATRIX_DATA` | `Readiness`; values `68, 71, 74`; unit `%`; target `75`; status `positive`. Check that the value, unit, target, and status are not reduced to an unlabeled number. |
| `progress` | `PROGRESS_MATRIX_DATA` | `Readiness`; current `74`; target `100`; unit `%`. Check ratio, current, target, and accessible/table wording. |
| `heatmap` | `HEATMAP_MATRIX_DATA` | Two series: Maintenance `[0,4,null,12,-2,9,1,6]`; Inspection `[3,7,5,null,18,2,4,8]`; dates are UTC 2026-01-01 through 2026-01-08. Missing cells and negative values must not look like zero. |
| `funnel` | `FUNNEL_MATRIX_DATA` | Readiness pipeline values `[100,76,54,31,12]`; five ordered stages; verify stage labels, values, and drop-offs are distinguishable. |

## Data to collect for every card

Record one row per `type/rung/viewport` in the observation table below. Use measured DOM/SVG data
alongside the screenshot; do not write “looks fine” without a measurable reason.

### Card and frame geometry

- Card `getBoundingClientRect()` width/height.
- `.family-matrix__chart-frame` rectangle.
- `svg[role="graphics-document"]` rectangle and `viewBox`.
- Whether every plotted element remains inside the SVG viewBox. For paths, inspect `getBBox()` in
  the real browser and separately note any path coordinate outside the viewBox.
- Whether text/legend/value boxes collide with marks, axes, table disclosure, or card edges.
- Whether the chart has usable plot area after value, legend, axis, and table bands.

### Meaning and semantic markup

Collect the card attributes:

```text
data-plan-size-class
data-plan-mark
data-plan-area
data-plan-interaction
data-plan-tooltip
data-plan-legend
data-plan-legend-toggle
data-plan-motion-stages
data-plan-persist-gridlines
data-plan-y2
data-plan-facet
```

Collect these visible/accessibility signals:

```text
svg title and desc
figcaption / data table presence
.gx-value, .gx-value__metric, .gx-value__unit, .gx-value__target,
.gx-value__status, .gx-value__progress
.gx-compact-key, .gx-compact-key__entry, .gx-compact-key__label
.gx-series[data-series-id]
```

Family-specific geometry/data counts:

```text
line/area: .gx-line, area paths, .gx-series[data-series-id]
bar/timebar: .gx-bar
scatter: .gx-scatter-point
donut: .gx-arc, .gx-arc--other
kpi: .gx-value and value qualifiers
progress: .gx-progress, .gx-progress__fill, .gx-progress__state
heatmap: .gx-heatmap-cell, data-heatmap-state="missing", data-heatmap-intensity
funnel: .gx-funnel-stage, .gx-funnel-stage__text, data-funnel-stage-value,
        data-funnel-stage-dropoff, data-funnel-part="summary"
```

## Human-readable grading rubric

Score each card from 0 to 3 for each dimension. A score is an observation, not an implementation
decision.

| Score | Meaning |
|---:|---|
| 3 | Immediately understandable at this size; visible data and identity agree with the plan. |
| 2 | Understandable with a short inspection or table/legend; no misleading reading. |
| 1 | Some data is present, but identity, units, comparison, or size behavior is ambiguous. |
| 0 | Blank, clipped, overlapping, misleading, inaccessible, or impossible to interpret. |

Dimensions:

- `identity`: chart/family/series/category identity.
- `value`: numeric value, unit, target, status, or explicit shape-only honesty.
- `trend-or-shape`: the mark communicates the intended trend, comparison, part-to-whole, progress,
  density, or funnel progression.
- `resize`: information survives the measured card size and narrow viewport.
- `a11y`: title/description/table/semantic IDs provide a non-visual equivalent.

Any `0` is a P1 issue. Any repeated `1` across a family/rung pattern is at least P1. A single
cosmetic `1` with no meaning loss may be P2.

## Observation table

Fill one row per card. Keep the row concise and link focused evidence for non-green rows.

| Type | Rung | Viewport | Card px | SVG/viewBox | Visible data readout | Key/legend | Geometry/overlap result | I/V/S/R/A scores | Issue IDs |
|---|---|---|---:|---|---|---|---|---|---|
| line | micro | desktop | pending | pending | pending | pending | pending | pending | pending |
| line | tile | desktop | pending | pending | pending | pending | pending | pending | pending |
| line | strip | desktop | pending | pending | pending | pending | pending | pending | pending |
| line | panel | desktop | pending | pending | pending | pending | pending | pending | pending |
| line | canvas | desktop | pending | pending | pending | pending | pending | pending | pending |
| line | stage | desktop | pending | pending | pending | pending | pending | pending | pending |
| area | micro…stage | desktop | pending | pending | pending | pending | pending | pending | pending |
| bar | micro…stage | desktop | pending | pending | pending | pending | pending | pending | pending |
| timebar | micro…stage | desktop | pending | pending | pending | pending | pending | pending | pending |
| scatter | micro…stage | desktop | pending | pending | pending | pending | pending | pending | pending |
| donut | micro…stage | desktop | pending | pending | pending | pending | pending | pending | pending |
| kpi | micro…stage | desktop | pending | pending | pending | pending | pending | pending | pending |
| progress | micro…stage | desktop | pending | pending | pending | pending | pending | pending | pending |
| heatmap | micro…stage | desktop | pending | pending | pending | pending | pending | pending | pending |
| funnel | micro…stage | desktop | pending | pending | pending | pending | pending | pending | pending |
| all above | all six | narrow | pending | pending | pending | pending | pending | pending | pending |

The grouped rows are a compact template only. Before handoff, expand them into 120 concrete rows
or attach a deterministic raw measurement table from the browser run that has one row per card.

## Issue register

Use one entry per issue, not one entry per screenshot.

| ID | Priority | Type/rung/viewport | Evidence | Observation | Data/meaning lost | Reproduction | Proposed direction |
|---|---|---|---|---|---|---|---|
| VT-001 | pending | pending | pending | pending | pending | pending | pending |

Required issue fields:

- exact selector, viewport, theme, and browser;
- screenshot path and any raw measurement path;
- whether the issue is a source-contract mismatch, renderer defect, fixture mismatch, CSS-only
  defect, or visual preference;
- the smallest affected family/rung set;
- what a human can and cannot currently infer;
- proposed fix direction, clearly labelled as a proposal;
- regression proof Codex should add before implementation is accepted.

## Repository evidence and current known baseline

- `scripts/results/d0.2-family-matrix.latest.json` reports `status: pass`, 60 cards, and empty
  console/page/ResizeObserver runtime error arrays for the latest Chromium gate.
- The automated gate checks metadata, static accessibility, stable series IDs, state fixtures,
  themes, forced colors, reduced motion, and resize boundaries. It does not replace this visual
  comprehension audit.
- The compact information work is recorded in `research/handoffs/D0.2-information-preservation.md`.
  Verify it visually; do not assume its acceptance from the prose.

## Alternatives

1. Full screenshot-only review — rejected: pixels do not reveal whether the data table, IDs,
   value qualifiers, or path bounds are correct.
2. DOM-only review — rejected: overlap, hierarchy, and visual comprehension require screenshots.
3. Combined DOM metrics + focused screenshots — selected: it gives Codex reproducible evidence and
   keeps the report small enough to review.

## Recommendation and confidence

Recommendation: treat repeated information loss as a core/primitives issue first, a measured
consumer issue second, and CSS-only polish third. Do not introduce a new visual rule when the
existing `ChartPlan`/frame/data contract already states the intended information.

Confidence: pending Claude's independent review.

## Conflicts with locked/current decisions

No amendment is authorized by this task. If the visual result appears to contradict the responsive
ladder, record the contradiction and affected contract; do not rewrite `research/00-decisions.md`.

## Unknowns

- Whether the local browser's font rendering changes minimum readable sizes.
- Whether any family-specific SVG mark is visually present but semantically unlabelled.
- Whether narrow widths cause family-specific labels to abbreviate, collide, or disappear.
- Whether forced-colors removes color-independent identity for any family.

## Affected contracts, files, tests, and docs

- Visual evidence only initially; no implementation change is authorized.
- Likely future fix surfaces: `packages/core/src/**`, `packages/primitives/src/**`, family-local
  renderer modules, and `apps/playground/src/family-matrix/**`; Claude must identify the smallest
  affected surface per issue.
- Potential regression proof: focused static SVG tests, pure frame/layout tests, and a browser
  screenshot/geometry check added by a later Codex implementation task.

## Proposed promotion

Pending review. Claude should conclude with one of: `no change`, `clarification`, `implementation
task required`, or `blocker`, and list the exact issue IDs promoted to Codex.
