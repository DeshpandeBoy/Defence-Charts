# 014 — Highcharts styled mode: correcting "colours only"

**Status:** ✅ **applied** 2026-08-23 · verified 2026-08-23
**Applied to:** `PRODUCT.md`, `../00-decisions.md`, `../01-plain-english.md`,
`../raw/06-design-tokens-widgets.md` §7 (correction banner; the survey text left intact as the record
of what was found).
**Affects:** `../00-decisions.md` "The claim that survives scrutiny", `PRODUCT.md`, `raw/06` §7
**Does not affect:** any architectural decision. This is a correction to a competitive claim.

---

## Context

`../00-decisions.md` states, in the section explicitly written to keep the pitch honest:

> *"No library exposes chart **geometry** through CSS custom properties. Highcharts comes closest and
> is **colours only**; Carbon ships exactly two chart custom properties, both font families."*

The Carbon half is fine. **The Highcharts half is wrong**, and wrong in the specific way that section
exists to prevent — it would not survive thirty seconds of scrutiny from anyone who has used styled
mode.

---

## Evidence

Read from Highcharts' own styled-mode documentation. Enabling is `chart.styledMode: true`, after which
*"no presentational attributes (like `fill`, `stroke`, font styles etc.) are applied to the chart
SVG."*

**Controllable from CSS — considerably more than colour:**

| Property | CSS hook | Replaces |
|---|---|---|
| Line width | `.highcharts-graph` | `plotOptions.series.lineWidth` |
| Dash style | `.highcharts-graph` | `plotOptions.series.dashStyle` |
| Gridline width | `.highcharts-grid-line` | `gridLineWidth` |
| Plot border width | `.highcharts-plot-border` | `chart.plotBorderWidth` |
| Axis tick colour **and width** | `.highcharts-tick` | `tickColor`, `tickWidth` |
| Plot line colour, dash, width | `.highcharts-plot-line` | all three |
| Zone colour, dash, fill | `.highcharts-zone-{n}` | all three |
| Box plot colours, stroke widths, dash | per-element rules | all |
| Area fill | `.highcharts-area` | `fillColor`, `fillOpacity` |
| Typography | `.highcharts-root` + `.highcharts-title`, `-subtitle`, `-axis-labels`, `-axis-title`, `-stack-label`, `-legend-item`, `-legend-title`, `-credits`, `-range-label`, `.highcharts-tooltip text` | font family and text styles |
| Point / marker styling | `.highcharts-point`, `-point-hover`, `-point-select`, `.highcharts-halo` | fill and stroke |

**It also already ships CSS custom properties.** The documented approach for colours is *"overriding
the `--highcharts-color-{n}` variables in `highcharts.css`"*, extensible past the default indices 0–9
by defining `--highcharts-color-10`, adding a matching class with `stroke: var(--highcharts-color-10);
fill: var(--highcharts-color-10);`, and raising `chart.colorCount`. Highcharts v11+ additionally reacts
to `prefers-color-scheme` unless `.highcharts-light` / `.highcharts-dark` is set.

**Not controllable from CSS** — and this is where the real boundary sits:

- **Layout, spacing, padding, positioning.** Explicitly: *"layout and positioning of elements like the
  title or legend cannot be controlled by CSS."* Positioning stays on JS options like `align` and
  `verticalAlign`.
- **Axis tick length** and **marker size** — geometric, and absent from the CSS-replaceable list. Tick
  *colour* and *width* (stroke thickness) are covered; *length* is not.

---

## Decision

**Replace "colours only" with an accurate account, and re-site the differentiator.**

The honest comparison is not *"we expose more than Highcharts"* on the axes Highcharts covers. It is
three narrower things:

| Claim | Status against Highcharts |
|---|---|
| Stroke width, dash, gridline width, tick colour/width, typography from CSS | ❌ **not a differentiator** — Highcharts has all of it |
| CSS custom properties as the theming mechanism | ❌ **not a differentiator** — `--highcharts-color-{n}` exists and is extensible |
| Reacts to `prefers-color-scheme` | ❌ **not a differentiator** — v11+ ships it |
| **One namespace covering every knob**, not a colour-indexed subset | ✅ holds — Highcharts' custom properties are colours; the rest is class-based |
| **Per-widget scope on a shared dashboard** | ✅ holds |
| **A size ladder that changes what the chart says** | ✅ **holds outright, no credible prior art** |

**And the boundary Highcharts stops at is not a Highcharts weakness.** It is the platform: tick length
is `y2` on a `<line>`, and `x1`/`y1`/`x2`/`y2` are not CSS-settable in any browser. Highcharts'
documentation says exactly this. We can cross that line only by an early rendering choice — see
[012](012-no-line-element-for-tokened-geometry.md) — which is a real advantage, but a *narrow, earned*
one, not evidence that a commercial library with two decades of investment overlooked something.

That framing is also more persuasive than the overclaim, because it is checkable.

---

## Consequences

- **`raw/06` §7's own warning applies to `raw/06` §7.** That section says *"where we merely match, say
  so"* and lists line stroke width, gridline colour/width, tick length and padding, bar padding, corner
  radius, point size and stroke, label offset, axis-line visibility as table stakes. The Highcharts
  cell was simply mis-read against its own standard. The section's discipline is right; one cell in it
  was not.
- **This is the second of three findings that push weight onto the ladder** (with
  [013](013-zero-js-claim-narrowed.md) and [012](012-no-line-element-for-tokened-geometry.md)). The
  cumulative effect: **lead with the ladder; treat the token surface as depth, not the headline.**
- **The Vega-Lite line stands and should stay.** `../00-decisions.md` already concedes that Vega-Lite
  has the best axis API in open source (70 documented axis properties) and that we should copy most of
  it. That concession survived scrutiny; this one did not. Keeping both visible is what makes the
  document trustworthy.

---

## Amendments required elsewhere

| File | Change |
|---|---|
| `../00-decisions.md` | Rewrite the "Highcharts comes closest and is colours only" clause; keep the Carbon clause, which is accurate |
| `PRODUCT.md` | Same correction wherever the comparison appears |
| `raw/06-design-tokens-widgets.md` §7 | Correct the Highcharts row in the granularity comparison; note that CSS custom properties are present |

⚠ **Do this before anything is published**, not before A1. It changes no code and blocks no milestone.

---

## What would overturn this

Nothing likely — this is a reading of current documentation for a shipping product, and the direction
of travel is toward *more* CSS coverage, not less. The realistic update is that Highcharts closes more
of the gap over time, which strengthens rather than weakens the conclusion: **the differentiator has
to be the ladder, because the theming surface is a race we would be running against an incumbent that
is already most of the way there.**

Worth re-checking at the same time as 013's four tests, immediately before any public launch.
