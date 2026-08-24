# Granularity coverage — the B2 audit

> `30-implementation-plan.md`'s mandate for Milestone B2, one sentence: *"`raw/06` §7 produced the
> granularity table across ten libraries. Every ● in that table becomes a token or a plan field, or
> we write down why not."* This document and the gate behind it (`scripts/check-granularity.mjs`,
> `scripts/granularity.mjs`) are that sentence made falsifiable.

---

## 1. What this is, and what it deliberately is not

`raw/06-design-tokens-widgets.md` §7.1 surveys ten charting libraries across 30 knobs and marks
each ● (first-class), ◐ (reachable but not first-class), ○ (not exposed), or ? (unverified). §7.2
reads that table in prose. Neither half is, on its own, a claim CI can check — a table is data, and
prose is prose.

`scripts/granularity.mjs` closes that gap two ways:

- `parseGranularityTable(markdown)` parses the table directly out of the research doc, so the doc
  stays the one source of truth and nothing here is a hand-copy that can drift from it.
- `DISPOSITIONS`, keyed by the table's own knob labels, states — for every row — which `--gx-*`
  tokens cover it, which `ChartPlan` field (if any) carries the same decision at the plan level, or
  why neither applies.

`scripts/check-granularity.mjs` is the gate: it cross-checks `DISPOSITIONS` against the parsed
table (every row named, no row invented) and against the real repo (every cited token or plan path
has to actually exist). `scripts/check-granularity.test.mjs` enforces it, including two ratchets
(no row may go un-dispositioned; no cited token may go undeclared beyond the count already owed)
and planted-violation cases proving each hard failure can actually fire.

**Current status:** B2's delivered control surface covers the implemented line/area renderer, and
the audit is clean: all 30 research knobs are dispositioned and 0 are owed to B2. The 12 named
token candidates that had no current CSS consumer are now declared in the typed B1 source with
their research values and provenance, so the shipped audit reports 0 owed to B1 as well. They are
available for later chart-family renderers without inventing names at D. Gate G20 is wired into
`pnpm verify` and CI.

---

## 2. The disposition table

Rendered from `scripts/granularity.mjs`'s `DISPOSITIONS`. "Owed to B1" means a research
disposition names a token that is not in the current shipped presentation tree. The current count
is 14; these are follow-up candidates, not undeclared `var()` references in authored CSS.

| Knob | Tokens | Plan path(s) | Note |
|---|---|---|---|
| Line stroke width | `line-stroke-width` | — | Table stakes |
| Dash pattern | `line-dash` | — | Table stakes |
| Dash offset (phase) | `line-dash-offset`, `grid-dash-offset`, `axis-domain-dash-offset` | — | Best-of-eight (§7.2 pt. 4) — see §3.1 below |
| Stroke linecap / linejoin | `line-cap`, `line-join`, `line-miter-limit`, `grid-cap`, `axis-domain-cap`, `tick-cap` | — | Best-of-eight (§7.2 pt. 4) |
| Gridline colour | `grid-color` | — | Table stakes |
| Gridline width | `grid-width` | — | Table stakes |
| Gridline dash | `grid-dash` | — | |
| Minor grid / minor ticks | `grid-minor-visible`, `grid-minor-count`, `grid-minor-opacity`, `tick-minor-length`, `tick-minor-width` | — | |
| Grid banding | `grid-band-color` | — | |
| Tick count | `tick-count-min` | `axes.x.ticks.count`, `axes.y.ticks.count`, `axes.y2.ticks.count` | Only resolves inside `TickPlan`'s `count` member |
| Tick density (px) | `tick-spacing-x`, `tick-spacing-y` | — | Best-of-eight (§7.2 pt. 4) |
| Tick size (length) | *declined* | — | See §3.2 |
| Tick padding | `tick-padding` | — | Table stakes |
| Bar padding inner | `bar-gap-inner` | — | Table stakes |
| Bar padding outer | `bar-gap-outer` | — | Table stakes |
| Bar corner radius | `bar-radius` | — | Table stakes |
| Bar min length / max width | `bar-min-length`, `bar-width-max` | — | |
| Point size | `point-radius` | — | Table stakes; already declared |
| Point stroke (width + colour) | `point-stroke-width`, `point-stroke-color` | — | Table stakes |
| Point auto-hide on density | `point-auto-hide-threshold` | — | Best-of-eight (§7.2 pt. 4) |
| Label offset | `label-offset` | — | |
| Label overlap policy | `label-overlap`, `label-separation`, `label-rotate-limit`, `label-step`, `label-stagger-lines`, `label-stagger-max` | `labels.axisLabelDegrade` | |
| Label halo / outline | `value-label-halo-width`, `value-label-halo-color`, `value-label-halo-opacity` | — | Cheap win (§7.2 pt. 3) |
| Value-label conceal by size | `value-label-skip-width`, `value-label-skip-height` | — | No plan field — rendering rule, not a plan decision |
| Legend item gap | `legend-gap-column`, `legend-gap-row` | — | Cheap win (§7.2 pt. 3) |
| Axis line visibility | `axis-x-domain-visible`, `axis-y-domain-visible` | `axes.x.domainLine`, `axes.y.domainLine`, `axes.y2.domainLine` | |
| Domain line style | `axis-domain-width`, `axis-domain-color`, `axis-domain-dash`, `axis-domain-dash-offset`, `axis-domain-cap` | — | Table stakes |
| Crosshair style | `crosshair-width`, `crosshair-color`, `crosshair-opacity`, `crosshair-dash`, `crosshair-z`, `crosshair-label-radius`, `crosshair-label-padding`, `crosshair-label-font-size` | `interaction.crosshair` | |
| Geometry that changes with chart size | `scale-ratio-s`, `scale-ratio-m`, `scale-ratio-l`, `size-breakpoint-m`, `size-breakpoint-l` | `sizeClass` | See §3.3 |
| Theming via CSS custom properties | *(the tree itself)* | — | See §3.4 |

---

## 3. Notes that need more room than a table cell

### 3.1 "Best-of-eight" needs the prose, not just the marks

§7.2 point 4 frames eight knobs as "library X only." Counting ● marks does not mechanically
reproduce that framing for all eight — **Dash offset (phase)** is the case that shows why: the row
marks ● for ECharts and Plot as well as Vega-Lite. The legend's four symbols distinguish "exposed"
from "not exposed," not "exposed once, globally" from "exposed **per guide element**," which is
Vega-Lite's actual differentiator (axis, grid, and tick each get their own phase). `check-
granularity.test.mjs` checks the manifest's note states this explicitly rather than asserting a
false equivalence between "raw ● count" and "the sole-library claim." The other seven best-of-eight
rows were read the same way against the source prose, not re-derived from marks.

### 3.2 Tick size (length) — declined

Ticks are drawn as `<line>` geometry. `x1`/`y1`/`x2`/`y2` are not CSS-settable in any browser — no
browser has one planned — so a `--gx-tick-length` custom property could be declared and documented
and would still never move the mark from a stylesheet. That is gate **G14**'s failure mode in one
sentence: *"a geometry token ships, is documented, and does nothing."* `raw/06` §6.3 still records
`--gx-tick-length: 5px` as a rendering constant (five of ten libraries converge near it); it is a
real default, just not a themeable token, and this manifest does not list it as one.

See [`decisions/012-no-line-element-for-tokened-geometry.md`](decisions/012-no-line-element-for-tokened-geometry.md).

### 3.3 Geometry that changes with chart size

§7.2 point 2 is blunt: only two of ten libraries do anything here, and both only rescale — neither
reveals, conceals, relabels, aggregates, substitutes, or transposes. That is not one knob's worth of
tokens; it is the argument for `ChartPlan.sizeClass` and the degrade ladder
(`labels.axisLabelDegrade`, `aggregate.*`, `dataTable.*`) existing at all. The token pair
(`scale-ratio-*`, `size-breakpoint-*`) covers the *rescale* half; the plan-level fields are where the
systematic version — the thing the survey found nowhere in the field — actually lives.

### 3.4 Theming via CSS custom properties

This row is not a token; it's the tree. Its disposition is that the tree exists and stays current
with its generated CSS — already gate **G17**'s job (`generate-tokens-css.mjs` / `theme.css` /
`tokens.generated.ts`). §7.2 point 1 is the claim this row backs: no surveyed library reaches chart
*geometry* through CSS custom properties end to end — Highcharts is closest and is colours (plus
some presentation properties) rather than geometry; Carbon ships exactly two, both font families.

---

## 4. Gate G20 — wired

`research/maps/04-ci-gate-map.md`'s register runs G1–G17, with G18 reserved for a proposed,
unimplemented network-API-ban gate and G19 taken by motion. G20 is the granularity audit.

`pnpm lint:granularity` runs `check-granularity.mjs` and passes against the current tree. It is
wired into `package.json`'s `verify` chain and `.github/workflows/ci.yml` beside the token gate.
The Vitest suite also asserts that the manifest has no undeclared named tokens.

---

## 5. What's still open

- The newly declared candidates still need consumers as each later chart family lands; declaration
  closes the naming/provenance gap, but does not claim that the line/area renderer currently uses
  every one.
- Keep the G20 manifest in step with the renderer as C/D add plan fields and chart families.
- Chart breadth is now the D track; each new family gets its own ladder, snapshots, renderer, and
  disposition pass.
