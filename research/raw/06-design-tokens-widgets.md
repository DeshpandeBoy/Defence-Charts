# Design token schemas + widget/dashboard visual systems

> Status: **COMPLETE** — §1 DTCG/Style Dictionary · §2 per-library tokenisation (10 systems) ·
> §3 colour · §4 widget/bento · §5 typography · §6 proposed `--gx-*` namespace (~190 tokens, tiered) ·
> §7 granularity comparison (31 knobs × 10 libraries).
> Anything not verified against a primary source is marked `UNVERIFIED`. Open items are listed in §7.1.

Scope: token format (DTCG/Style Dictionary), how existing systems tokenise *charts specifically*,
data-vis colour, the widget/bento visual language, chart typography, and a proposed
`--gx-*` token namespace.

Assumes `00-decisions.md` (CSS custom properties + TS token types; 12-col grid; presentational-only)
and `10-responsive-ladder.md` (size families Micro → Tile → Strip → Panel → Canvas → Stage).

---

## 1. Token naming and structure — DTCG

### 1.1 Spec status (verified)

The relevant document is **"Design Tokens Format Module 2025.10"**, a **Final Community Group
Report dated 28 October 2025**, published by the Design Tokens Community Group.
It is explicitly **"not a W3C Standard nor is it on the W3C Standards Track"**
(https://www.designtokens.org/TR/2025.10/format/).

There is also a **preview draft** at https://www.designtokens.org/TR/drafts/format/ (dated
30 July 2026 at time of reading) which carries the warning: *"This is a preview draft of in
progress changes. Do not refer to this document directly, and do not implement anything in this
document."* — so **2025.10 is the version to target**.

Note the domain moved: `tr.designtokens.org` now 301-redirects to `www.designtokens.org/TR/...`.

The spec is now **modular**. As of 2025.10 there are at least:
- Format Module — https://www.designtokens.org/TR/2025.10/format/
- Color Module — https://www.designtokens.org/TR/2025.10/color/
- Resolver Module (referenced in the Format module's copyright block)

### 1.2 Structure

A token is a JSON object with a `$value`, and (as of 2025.10) a **mandatory** type:

> "If no explicit type has been set for a token, tools MUST consider the token invalid and not
> attempt to infer any other type from the value."

Type may be set directly via `$type`, **inherited from a parent group**, or acquired by aliasing a
token that has the type. Other reserved properties: `$description`, `$extensions`, `$deprecated`.
Groups may carry `$deprecated` and `$extensions`; group semantics are explicitly *organisational
only* — "tools MUST NOT try to infer any special meaning or typing of tokens based on a group they
happen to be in" (other than `$type` inheritance).

### 1.3 Base types (§8) — verified against 2025.10

| `$type` | `$value` shape | Notes |
|---|---|---|
| `color` | object: `{ colorSpace, components[], alpha?, hex? }` | Defined in the separate **Color Module**. Supported spaces: `srgb`, `srgb-linear`, `hsl`, `hwb`, `lab`, `lch`, `oklab`, `oklch`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d65`, `xyz-d50`. Grounded in CSS Color Module Level 4. `none` keyword supported for missing components. |
| `dimension` | **object**: `{ value: number, unit: "px" \| "rem" }` | ⚠️ **Breaking vs older drafts** — no longer the string `"16px"`. `unit` required even when `value` is `0`. |
| `fontFamily` | string, or array of strings (most→least preferred) | |
| `fontWeight` | number `[1,1000]`, or one of the named aliases | `thin/hairline`=100, `extra-light/ultra-light`=200, `light`=300, `normal/regular/book`=400, `medium`=500, `semi-bold/demi-bold`=600, `bold`=700, `extra-bold/ultra-bold`=800, `black/heavy`=900, `extra-black/ultra-black`=950 |
| `duration` | **object**: `{ value: number, unit: "ms" \| "s" }` | |
| `cubicBezier` | array of 4 numbers `[P1x,P1y,P2x,P2y]`; x clamped to `[0,1]` | |
| `number` | JSON number | Spec's own example uses cases: *"gradient stop positions or unitless line heights"* |

§8.8 lists types **still undocumented**: font style, percentage/ratio, file. Relevant to us:
**there is no percentage/ratio type yet**, so bar padding fractions (`0.1`) have to be `number`.

### 1.4 Composite types (§9) — verified

| `$type` | Sub-values |
|---|---|
| `strokeStyle` | Either a string enum — `solid`, `dashed`, `dotted`, `double`, `groove`, `ridge`, `outset`, `inset` (CSS line-style semantics) — **or** an object `{ dashArray: dimension[], lineCap: "round"\|"butt"\|"square" }` (SVG `stroke-linecap` semantics). |
| `border` | `{ color, width: dimension, style: strokeStyle }` |
| `transition` | `{ duration, delay, timingFunction: cubicBezier }` |
| `shadow` | `{ color, offsetX, offsetY, blur, spread, inset? }`, or an **array** of those (layered shadows) |
| `gradient` | array of `{ color, position: number 0..1 }` stops |
| `typography` | composite typographic style (fontFamily / fontSize / fontWeight / letterSpacing / lineHeight) |

`strokeStyle` matters enormously to us — it is the *only* off-the-shelf token type that expresses a
dash pattern, and our gridline/threshold/crosshair dashes need exactly that. Verified example:

```json
{ "alert-border-style": { "$type": "strokeStyle", "$value": {
    "dashArray": [ {"value":0.5,"unit":"rem"}, {"value":0.25,"unit":"rem"} ],
    "lineCap": "round" } } }
```

The spec even shows the CSS fallback problem we will hit (§9.3.3, Example 50): *"CSS does not allow
detailed control of the dash pattern or line caps on dashed borders"*, so a translator emits
`--notification-border-style: dashed;`. **We do not have that problem** — SVG `stroke-dasharray`
takes the full array. This is a point of leverage: DTCG's own escape hatch exists because CSS
borders are weak; SVG strokes are not.

Open spec issues we should track (they affect us directly):
- **Issue 98** — stroke style: *"Does it need more sub-values (e.g. equivalents to SVG's
  `stroke-linejoin`, `stroke-miterlimit` and `stroke-dashoffset` attributes)?"*
- **Issue 101** — gradient: does it need to specify linear/radial/conical?
- **Issue 53** — typography type enhancements.

### 1.5 Aliasing / references (§7)

Two syntaxes in 2025.10:
- **Curly brace** (recommended): `"$value": "{color.shadow-050}"`
- **JSON Pointer** (required support): e.g. `#/color/shadow-050/$value`

Chained references, circular-reference detection, and **property-level references** are all
specified — §7.3 explicitly covers "Color Component References", "Dimension Component References",
"Typography Component References". Arrays may mix literals and references, and references in arrays
**resolve to a single element, never flattened** (§9.1). Groups can be *extended* (§6.4) with
JSON-Schema-`$ref`-like inheritance semantics.

Verified aliasing example (Example 46) showing a composite whose sub-values are half references:

```json
"shadow": { "medium": { "$type": "shadow", "$value": {
  "color": "{color.shadow-050}", "offsetX": "{space.small}", "offsetY": "{space.small}",
  "blur": {"value":1.5,"unit":"rem"}, "spread": {"value":0,"unit":"rem"} } } }
```

### 1.6 Style Dictionary

Style Dictionary (originally Amazon; now maintained at https://styledictionary.com) is the
reference transformer. Verified from https://styledictionary.com/reference/hooks/formats/predefined/ :

- **`css/variables`** — emits `:root { --color-background-base: #f0f0f0; }`. Options:
  `showFileHeader`, **`outputReferences`** (preserves the reference chain "(a -> b -> c) in the
  output" — i.e. emits `var(--other-token)` instead of the resolved literal),
  **`outputReferenceFallbacks`** (emits `var(--x, <literal>)`), `selector` (string or array; with an
  array "the first selector in the array acts as the outermost layer"), `sort`, `formatting`.
- **`typescript/es6-declarations`** — `.d.ts` to pair with `javascript/es6`; option
  `outputStringLiterals` turns string values into literal types.
- **`typescript/module-declarations`** — the docs admit *"this does not generate 100% accurate
  d.ts"*, described as *"a compromise"*.
- Also `scss/variables`, `scss/map-deep`, `scss/map-flat`, `less/variables`, `stylus/variables`,
  `json`, `javascript/esm` (which has `stripMeta` and `minify`).
- Both token shapes flow through: legacy `{ value: ... }` and DTCG `{ $value, $type }`. A DTCG
  info page exists at `/info/dtcg/` and a util at `/reference/utils/dtcg` — `UNVERIFIED` exactly
  which spec revision v4/v5 targets (I did not fetch those pages; the 2025.10 object-shaped
  `dimension` and the Color Module's object-shaped `color` are recent enough that tool support
  should be assumed partial).

**Recommendation for us — ship both, but CSS is the source of truth.**

Reasons to make `tokens.json` (DTCG) an *output*, not the input:
1. Our locked decision is CSS custom properties. A DTCG `dimension` is `{value:1,unit:"px"}`; a CSS
   var is `1px`. One is authored ergonomically, the other is not. Authoring in DTCG means every
   local tweak is a JSON edit + rebuild.
2. Many of our tokens are **unitless numbers with domain meaning** (`bar-gap-inner: 0.1`,
   `tick-count-target: 4`, `aggregate-after: 8`). DTCG has no percentage/ratio type and no notion of
   "a count". They'd all be `number` and lose meaning.
3. DTCG-to-CSS is lossy in exactly the place we care about (dash arrays, §9.3.3).

But reasons to *emit* `@gx/tokens/tokens.json` in DTCG 2025.10:
- Figma/Tokens Studio, Supernova, Specify, Penpot all import DTCG. Designers can pull our
  chart-token vocabulary into a design file and theme us from there.
- It gives an unambiguous machine-readable manifest of every knob — good for docs generation and
  for a "token explorer" page.

So: **author in TypeScript** (typed const objects, one file per group) → generate (a) `tokens.css`
`:root` + `[data-gx-theme]` blocks, (b) `tokens.d.ts` + runtime TS consts, (c) `tokens.json` in
DTCG 2025.10 with `$extensions["dev.gx.token"]` carrying the CSS var name, the responsive class it
belongs to, and the unit semantics DTCG can't express. Style Dictionary is optional — a ~200-line
generator we own avoids the `dimension`-object impedance and the "not 100% accurate d.ts" problem,
but Style Dictionary's `outputReferences` + `outputReferenceFallbacks` behaviour is worth copying
verbatim because it is what makes `var(--gx-line-stroke-width, var(--gx-stroke-md))` cascades work.

---

## 2. How existing systems tokenise charts

### 2.1 Highcharts — verified from the machine-readable option tree

Source: `https://api.highcharts.com/highcharts/tree.json` (v13.0.1, commit `16a711b6bf`).
This is the full JSDoc-derived option tree — the most complete styling surface in the industry, and
it's queryable, so every value below is exact.

**Notable: Highcharts has moved its defaults to CSS custom properties.** e.g.
`xAxis.gridLineColor` defaults to **`var(--highcharts-neutral-color-10)`**,
`xAxis.lineColor` and `xAxis.tickColor` to `var(--highcharts-neutral-color-80)`,
`xAxis.minorGridLineColor` to `var(--highcharts-neutral-color-5)`,
`xAxis.title.style.color` to `var(--highcharts-neutral-color-60)`,
`plotOptions.series.marker.lineColor` to `var(--highcharts-background-color)`.
So the "CSS variables for chart internals" bet is already validated by the market leader.

Axis (verified defaults):

| Option | Default |
|---|---|
| `xAxis.lineWidth` | `1` |
| `xAxis.lineColor` | `var(--highcharts-neutral-color-80)` |
| `xAxis.gridLineWidth` | `null` (x default off; y default on) |
| `xAxis.gridLineColor` | `var(--highcharts-neutral-color-10)` |
| `xAxis.gridLineDashStyle` | `Solid` |
| `xAxis.gridZIndex` | `1` |
| `xAxis.tickLength` | `10` |
| `xAxis.tickWidth` | `undefined` |
| `xAxis.tickColor` | `var(--highcharts-neutral-color-80)` |
| `xAxis.tickPosition` | `outside` |
| `xAxis.tickPixelInterval` | `100` ← **a density heuristic expressed as an option** |
| `xAxis.tickAmount` | `null` |
| `xAxis.tickmarkPlacement` | `between` |
| `xAxis.minorTickLength` | `2` |
| `xAxis.minorTickWidth` | `0` |
| `xAxis.minorTicksPerMajor` | `5` |
| `xAxis.minorGridLineWidth` | `1` |
| `xAxis.labels.distance` | `15` ← **label offset**, exactly the knob we want |
| `xAxis.labels.padding` | `undefined` |
| `xAxis.labels.rotation` | `0` |
| `xAxis.labels.autoRotation` | `undefined` (array of angles) |
| `xAxis.labels.autoRotationLimit` | `80` |
| `xAxis.labels.staggerLines` | `0`; `maxStaggerLines` `5` |
| `xAxis.labels.step` | `0` ← **tick-dropping stride** |
| `xAxis.labels.allowOverlap` | `false` ← collision avoidance is a first-class flag |
| `xAxis.labels.overflow` | `justify`; `textOverflow` `ellipsis` |
| `xAxis.labels.x` / `.y` / `.zIndex` | `null` / `null` / `7` |
| `xAxis.title.style.fontSize` | `0.8em` |
| `xAxis.title.x` / `.y` / `.margin` / `.offset` | `0` / `0` / `null` / `null` |
| `xAxis.showFirstLabel` / `showLastLabel` | `true` / `undefined` |
| `xAxis.alternateGridColor` | `null` (banding) |
| `xAxis.minPadding` / `maxPadding` | `0.01` / `0.01` |
| `xAxis.startOnTick` / `endOnTick` | `false` / `false` |

Crosshair (verified): `xAxis.crosshair` default `false`; `.color` `#cccccc`; `.dashStyle` `Solid`;
`.width` `1`; `.snap` `true`; `.showDelay` `0`; `.zIndex` `2`; plus a full label sub-object
(`.label.borderRadius` `3`, `.label.padding` `8`, `.label.shape` `callout`,
`.label.style` `{"color":"white","fontWeight":"normal","fontSize":"11px","textAlign":"center"}`).

Marks (verified):

| Option | Default |
|---|---|
| `plotOptions.series.lineWidth` | `2` |
| `plotOptions.series.dashStyle` | `Solid` |
| `plotOptions.series.linecap` | `round` |
| `plotOptions.series.crisp` | `true` ← half-pixel snapping as an option |
| `plotOptions.series.marker.radius` | `4` |
| `plotOptions.series.marker.lineWidth` | `0` |
| `plotOptions.series.marker.enabledThreshold` | `2` ← **markers auto-hide when points get dense**; a responsive rule as a token |
| `plotOptions.series.dataLabels.distance` | `4`; `.borderRadius` `3`; `.borderWidth` `0` |
| `plotOptions.column.pointPadding` | `0.1` ← **inner (within-group) bar gap** |
| `plotOptions.column.groupPadding` | `0.2` ← **outer (between-group) bar gap** |
| `plotOptions.column.borderRadius` | `3` ← corner radius on bars |
| `plotOptions.column.pointWidth` | `null`; `maxPointWidth` `null`; `minPointLength` `0` |
| `plotOptions.pie.innerSize` | `0` (donut hole) |
| `plotOptions.pie.borderWidth` | `1`; `.borderRadius` `3` |
| `plotOptions.pie.slicedOffset` | `10`; `.startAngle` `0` |
| `plotOptions.pie.dataLabels.distance` | `30` |
| `plotOptions.scatter.lineWidth` | `0`; `marker.enabled` `true` |

Legend (verified): `borderRadius` `0`, `borderWidth` `0`, `itemDistance` `null` (20 in practice for
horizontal — `UNVERIFIED` exact number), `itemMarginTop` `2`, `itemMarginBottom` `2`, `margin` `12`,
`padding` `8`, `symbolWidth` `null`, `symbolHeight` `null`, `symbolPadding` `5`, `symbolRadius`
`null`, `shadow` `false`.

Tooltip (verified): `borderRadius` `5`, `padding` `8`, `distance` `16`, `hideDelay` `500`,
`snap` `10/25` (touch/mouse), `header.distance` `5`.

**Ceiling reading**: Highcharts is the granularity ceiling and it is roughly this — every stroke has
`width` + `color` + `dashStyle`, every text has `style` + `x`/`y`/`distance`/`padding`/`rotation`,
bars have inner + outer padding + a max width + a min length + a corner radius, and density rules
(`tickPixelInterval`, `labels.step`, `marker.enabledThreshold`, `labels.autoRotation`) are
themselves options. Note what it *doesn't* have: no named size-class system, no "change the chart's
information content" concept — the responsive support is `chart.responsive.rules` with
`condition: {maxWidth}` patching arbitrary options. That's the gap our ladder fills.

### 2.2 Carbon Design System charts (IBM) — verified from source

Repo: https://github.com/carbon-design-system/carbon-charts (`packages/core`).

**The headline finding: Carbon tokenises colour thoroughly and geometry not at all.**

Colour is tokenised. `packages/core/scss/_tokens.scss` defines per-theme maps across Carbon's four
themes — `themes.$white`, `themes.$g10` (both `light`), `themes.$g90`, `themes.$g100` (both `dark`)
— for chart-specific concepts: `$grid-bg`, `$alert-stroke`, `$layer-01-absolute`,
`$layer-inverse-absolute`, `$null-state`, `$meter-range-indicator`, `$tooltip-line-border`,
`$zone-fill-01..03`, `$zone-stroke-01..03`, `$network-diagrams-background-hover`. Each is a map of
`(fallback:, values: ((theme:, value:), ...))`, i.e. a token whose value is theme-dependent.

Geometry is **hard-coded in SCSS**, not tokenised. Verified literals:

| File | Literal |
|---|---|
| `scss/graphs/_line.scss` | `path.line { fill: none; stroke-width: 1.5; }` |
| `scss/components/_grid.scss` | `g.x.grid g.tick line { stroke-width: 1px; stroke: theme.$layer-accent-01; }`, active state `stroke-dasharray: 2px; stroke: theme.$focus;` |
| `scss/components/_threshold.scss` | `line.threshold-line { stroke: colors.$red-50; stroke-width: 1; stroke-dasharray: 4; }`, `.active { stroke-width: 2; }`; label `font-size: 12px; line-height: 16px; padding: 4px; min-width: 20px; box-shadow: 0 1px 6px 0 rgba(0,0,0,0.2)` |
| `scss/components/_axis.scss` | tick text `fill: theme.$text-secondary`; **`g.tick line { display: none; }`** (Carbon has no tick marks at all); `path.domain { stroke: theme.$border-strong-01 }`; axis title `font-weight: 600` |
| `scss/components/_zero-line.scss` | `line.domain { stroke: theme.$border-strong-01 }` |

There are exactly two chart-level CSS custom properties in `_globals.scss`:
`--cds-charts-font-family` (Carbon sans) and `--cds-charts-font-family-condensed`
(Carbon **sans-condensed** — Carbon uses a *condensed* face for tick labels specifically).
Prefixes: `$prefix: 'cds'`, `$charts-prefix: 'cc'` → class names like `.cds--cc--grid`.

The JS `configuration.ts` surface is deliberately thin — verified defaults:
- `grid.x = { enabled: true, numberOfTicks: 15, alignWithAxisTicks: false }`,
  `grid.y = { enabled: true, numberOfTicks: 5, alignWithAxisTicks: false }`
- `scatterChart.points = { radius: 4, fillOpacity: 0.3, filled: true }`;
  `lineChart.points = { radius: 3, filled: false }`
- `bubbleChart.bubble.radiusRange = (chartSize) => [ min*3/400, min*25/400 ]` ← **size-responsive
  geometry expressed as a function of the chart box**, exactly the pattern our ladder formalises
- `gaugeChart.gauge = { arcWidth: 16, numberSpacing: 10, deltaArrow.size: r => r/8,
  deltaFontSize: r => r/8, valueFontSize: r => r/2.5 }`
- `donutChart.donut.center = { numberFontSize: r => min(r/100*24, 24)+'px',
  titleFontSize: r => min(r/100*15,15)+'px', titleYPosition: r => min(r/80*20, 20) }`
  ← **type size scales with radius and clamps** — a real responsive-type rule in production code
- `wordCloudChart.wordCloud.fontSizeRange = (chartSize) => [min*20/400, min*75/400]`
- Truncation is a shared `standardTruncationOptions` reused by legend/tooltip/axes.

There is **no** `strokeWidth`, `dashArray`, `tickLength`, `labelOffset`, `barPadding`, or
`cornerRadius` in Carbon's config. To change a line's thickness you override CSS. That is the exact
gap we are targeting.

### 2.3 Vega / Vega-Lite `config` — the cascading-defaults precedent

Vega-Lite's `config` is a *superset* of Vega's config (https://vega.github.io/vega-lite/docs/config.html).
Structure (verified from the doc source):

```
config: {
  <top-level: autosize, background, countTitle, fieldTitle, font, lineBreak, padding, tooltipFormat>
  <format: numberFormat, numberFormatType, normalizedNumberFormat, timeFormat, customFormatTypes>
  axis, axisX, axisY, axisLeft, axisRight, axisTop, axisBottom,
  axisBand, axisPoint, axisDiscrete, axisQuantitative, axisTemporal,
  axisXBand, axisXPoint, axisXDiscrete, axisXQuantitative, axisXTemporal,
  axisYBand, axisYPoint, axisYDiscrete, axisYQuantitative, axisYTemporal,
  header, legend,
  mark, area, bar, circle, line, point, rect, geoshape, rule, square, text, tick,
  style,                       // named styles, invoked via mark.style / axis.style
  scale, range,
  projection, selection, title, view, concat, facet, repeat, locale, aria
}
```

**The precedence rule is the important part** and it is documented explicitly:

> "If multiple axis config blocks apply to a single axis, type-based options take precedence over
> orientation-based options, which in turn take precedence over general options."

So the cascade is: `config.axis` → `config.axisX` (orientation) → `config.axisBand` /
`config.axisTemporal` (scale/data type) → `config.axisXTemporal` (both) → the axis definition on the
encoding itself. Plus three cross-guide named styles that unify axis/legend/header:
`"guide-label"`, `"guide-title"`, `"group-title"`.

This is the model to copy. Our CSS-variable equivalent falls out naturally because CSS *is* a
cascade: `:root` → `[data-gx-theme]` → `.gx-widget` → `.gx-axis` → `.gx-axis--x` →
`.gx-axis--temporal` → inline `style`. We get Vega-Lite's precedence semantics for free, and unlike
Vega we don't need a merge algorithm.

**Vega's actual default values** (verified from `vega-parser/src/config.js` — these are the numbers
Vega-Lite ships with, and a useful sanity check on our own defaults):

```
defaultFont = 'sans-serif'; defaultSymbolSize = 30; defaultStrokeWidth = 2; defaultColor = '#4c78a8';
black = '#000'; gray = '#888'; lightGray = '#ddd';

axis: { minExtent: 0, maxExtent: 200, bandPosition: 0.5,
        domain: true, domainWidth: 1, domainColor: gray,
        grid: false, gridWidth: 1, gridColor: lightGray,
        labels: true, labelAngle: 0, labelLimit: 180, labelOffset: 0, labelPadding: 2,
        ticks: true, tickColor: gray, tickOffset: 0, tickRound: true, tickSize: 5, tickWidth: 1,
        titlePadding: 4 }
axisBand: { tickOffset: -0.5 }     // "correction for centering bias"

legend: { orient: 'right', padding: 0, gridAlign: 'each',
          columnPadding: 10, rowPadding: 2,
          symbolDirection: 'vertical', gradientDirection: 'vertical',
          gradientLength: 200, gradientThickness: 16, gradientStrokeColor: lightGray,
          gradientStrokeWidth: 0, gradientLabelOffset: 2,
          labelAlign: 'left', labelBaseline: 'middle', labelLimit: 160, labelOffset: 4,
          labelOverlap: true, symbolLimit: 30, symbolType: 'circle', symbolSize: 100,
          symbolOffset: 0, symbolStrokeWidth: 1.5,
          symbolBaseFillColor: 'transparent', symbolBaseStrokeColor: gray,
          titleLimit: 180, titleOrient: 'top', titlePadding: 5,
          layout: { offset: 18, direction: 'horizontal', left:{direction:'vertical'}, right:{direction:'vertical'} } }

title: { orient: 'top', anchor: 'middle', offset: 4, subtitlePadding: 3 }
line: { stroke: defaultColor, strokeWidth: 2 }; symbol: { fill: defaultColor, size: 64 };
text: { fill: black, font: defaultFont, fontSize: 11 }; trail: { size: defaultStrokeWidth }
style: { 'guide-label': { fontSize: 10 }, 'guide-title': { fontSize: 11, fontWeight: 'bold' },
         'group-title': { fontSize: 13, fontWeight: 'bold' }, 'group-subtitle': { fontSize: 12 },
         point/circle/square: { size: 30, strokeWidth: 2, shape: 'circle'|'square' },
         cell: { fill: 'transparent', stroke: lightGray }, view: { fill: 'transparent' } }

range: { category: {scheme:'tableau10'}, ordinal: {scheme:'blues'},
         heatmap: {scheme:'yellowgreenblue'}, ramp: {scheme:'blues'},
         diverging: {scheme:'blueorange', extent:[1,0]},
         symbol: ['circle','square','triangle-up','cross','diamond',
                  'triangle-right','triangle-down','triangle-left'] }
```

Note `config.range` — **the categorical/ordinal/heatmap/ramp/diverging scale *roles* are themselves
config keys**. That's a clean token idea: `--gx-range-categorical`, `--gx-range-sequential`,
`--gx-range-diverging` as *scheme names*, separate from the individual colour slots.

**Vega-Lite's full axis property list** (verified from `src/axis.ts`, `COMMON_AXIS_PROPERTIES_INDEX`
— 70 properties, the richest *guide* API of any open-source library):

`orient, aria, bandPosition, description, domain, domainCap, domainColor, domainDash,
domainDashOffset, domainOpacity, domainWidth, format, formatType, grid, gridCap, gridColor,
gridDash, gridDashOffset, gridOpacity, gridWidth, labelAlign, labelAngle, labelBaseline, labelBound,
labelColor, labelFlush, labelFlushOffset, labelFont, labelFontSize, labelFontStyle, labelFontWeight,
labelLimit, labelLineHeight, labelOffset, labelOpacity, labelOverlap, labelPadding, labels,
labelSeparation, maxExtent, minExtent, offset, position, tickBand, tickCap, tickColor, tickCount,
tickDash, tickDashOffset, tickExtra, tickMinStep, tickOffset, tickOpacity, tickRound, ticks,
tickSize, tickWidth, title, titleAlign, titleAnchor, titleAngle, titleBaseline, titleColor,
titleFont, titleFontSize, titleFontStyle, titleFontWeight, titleLimit, titleLineHeight,
titleOpacity, titlePadding, titleX, titleY, translate, values, zindex` (+ `style`, `labelExpr`,
`encoding` in Vega-Lite only).

Standouts worth stealing:
- `domainCap` / `gridCap` / `tickCap` — SVG `stroke-linecap` **per guide element**. Nobody else has this.
- `gridDash` + `gridDashOffset`, `tickDash` + `tickDashOffset`, `domainDash` + `domainDashOffset` —
  dash **and phase**, separately, per element.
- `labelOverlap` (`true` | `"parity"` | `"greedy"`) + `labelSeparation` (px) — declarative collision
  policy. `"parity"` = drop every other label; `"greedy"` = scan and drop as needed.
- `labelFlush` / `labelFlushOffset` — flush the first/last label to the edge instead of centring it.
- `labelBound` — clip labels that exceed the chart bounds.
- `tickMinStep` — "the minimum desired step between axis ticks, in terms of scale domain values …
  the `tickCount` value will be adjusted, if necessary, to enforce the minimum step value."
- `tickExtra`, `tickBand` (`"center"` | `"extent"`), `tickRound`, `tickOffset`.
- `minExtent` / `maxExtent` — reserve/limit the space the axis may take (default 0 / 200).
- `translate` — the half-pixel crispness offset, exposed.

### 2.4 Recharts — verified from source (`main` branch)

| Knob | Where | Default |
|---|---|---|
| `tickSize` | `defaultCartesianAxisProps` (`src/cartesian/CartesianAxis.tsx`) | `6` |
| `tickMargin` (tick→label padding) | same | `2` |
| `minTickGap` | same / `implicitXAxis` | `5` |
| `tickCount` | `implicitXAxis` (`src/state/selectors/axisSelectors.ts`) | `5` |
| `interval` | same | `'preserveEnd'` (also `'preserveStart'`, `'preserveStartEnd'`, `'equidistantPreserveStart'`, or a number = stride) |
| `axisLine`, `tickLine`, `tick` | `defaultCartesianAxisProps` | `true`, `true`, `true` (each accepts `false` or an SVG props object) |
| `angle` | `implicitXAxis` | `0` |
| `mirror`, `reversed` | `implicitXAxis` | `false`, `false` |
| `padding` | `implicitXAxis` | `{ left: 0, right: 0 }` — "the distance between the edge of plot area and the first/last tick" |
| `height` (x-axis reserved space) | `implicitXAxis` | `30` |
| `barCategoryGap` (**outer**) | `src/state/rootPropsSlice.ts` | `'10%'` |
| `barGap` (**inner**, between bars in a group) | same | `4` |
| `barSize`, `maxBarSize` | same | `undefined`, `undefined` |
| `Bar.radius` | `src/cartesian/Bar.tsx` | `number \| [tl,tr,br,bl]`, no default |
| `Bar.minPointSize` | same | number or callback |
| Grid dash | `CartesianGrid.strokeDasharray` | `string \| number \| number[]` — `"3 3"`, `[5,5,1,5]` both accepted |
| Grid density | `CartesianGrid.syncWithTicks`, `horizontalPoints`, `verticalPoints`, `horizontalValues`, `verticalValues`, `horizontalCoordinatesGenerator`, `verticalCoordinatesGenerator` | documented priority order: explicit points > values > `syncWithTicks` |
| Grid banding | `CartesianGrid.horizontalFill` / `verticalFill` + `fillOpacity` | — |
| `Legend.iconSize` | `src/component/DefaultLegendContent.tsx` | `14` (icon viewBox constant `SIZE = 32`) |
| Legend item gap | — | **not a prop**: hard-coded inline `{ marginRight: 10 }` on the `<li>` and `{ marginRight: 4 }` on the swatch svg |

Everything else in Recharts is "pass SVG props through", which is powerful but untyped-by-intent and
impossible to theme centrally — there is no theme object at all. Stroke width on a `<Line>` is
`strokeWidth` on the element; there is no `--recharts-line-stroke-width`.

### 2.5 Nivo — verified from source (`master`)

Nivo has a **JS theme object**, not CSS variables. `packages/theming/src/defaults.ts`:

```js
{ background: 'transparent',
  text: { fontFamily:'sans-serif', fontSize:11, fill:'#333333',
          outlineWidth:0, outlineColor:'#ffffff', outlineOpacity:1 },
  axis: { domain: { line: { stroke:'transparent', strokeWidth:1 } },
          ticks:  { line: { stroke:'#777777',    strokeWidth:1 }, text:{} },
          legend: { text: { fontSize:12 } } },
  grid: { line: { stroke:'#dddddd', strokeWidth:1 } },
  legends:{ hidden:{symbol:{fill:'#333333',opacity:.6}, text:{...}},
            ticks:{ line:{stroke:'#777777',strokeWidth:1}, text:{fontSize:10} }, title:{text:{}} },
  markers:{ lineColor:'#000000', lineStrokeWidth:1, text:{} },
  tooltip:{ container:{ background:'white', borderRadius:'2px',
                        boxShadow:'0 1px 2px rgba(0,0,0,0.25)', padding:'5px 9px' },
            chip:{ marginRight:7 }, tableCell:{ padding:'3px 5px' } },
  crosshair:{ line:{ stroke:'#000000', strokeWidth:1, strokeOpacity:0.75, strokeDasharray:'6 6' } },
  annotations:{ text:{fontSize:13, outlineWidth:2,...}, link:{stroke:'#000',strokeWidth:1,...},
                outline:{fill:'none',stroke:'#000',strokeWidth:2,...}, symbol:{fill:'#000',...} } }
```

Per-component defaults (verified):
- `@nivo/axes` `defaultAxisProps`: `tickSize: 5`, `tickPadding: 5`, `tickRotation: 0`,
  `legendPosition: 'middle'`, `legendOffset: 0`.
- `@nivo/line`: `lineWidth: 2`, `pointSize: 6`, `pointBorderWidth: 0`, `areaOpacity: 0.2`,
  `enableGridX/Y: true`, `enableCrosshair: true`, `crosshairType: 'bottom-left'`,
  `curve: 'linear'`, `colors: { scheme: 'nivo' }`, `motionConfig: 'gentle'`.
- `@nivo/bar`: `padding: 0.1` (**outer**, d3 band `paddingOuter`-ish), `innerPadding: 0` (**inner**),
  `borderRadius: 0`, `borderWidth: 0`, `labelOffset: 0`, `labelSkipWidth: 0`, `labelSkipHeight: 0`,
  `totalsOffset: 10`, `enableGridX: false`, `enableGridY: true`.
  `labelSkipWidth`/`labelSkipHeight` are a **size-driven conceal rule shipped as a prop** — hide the
  value label when the bar is narrower/shorter than N px. Direct prior art for our ladder.
- `@nivo/pie`: `innerRadius: 0`, `padAngle: 0`, `cornerRadius: 0`, `borderWidth: 0`,
  `startAngle: 0`, `endAngle: 360`, `activeInnerRadiusOffset: 0`, `activeOuterRadiusOffset: 0`,
  `arcLabelsSkipAngle: 0`, `arcLabelsSkipRadius: 0`, `arcLabelsRadiusOffset: 0.5`,
  `arcLinkLabelsSkipAngle: 0`, `arcLinkLabelsOffset: 0`, **`arcLinkLabelsDiagonalLength: 16`**,
  **`arcLinkLabelsStraightLength: 24`**, `arcLinkLabelsThickness: 1`, `arcLinkLabelsTextOffset: 6`.
  Nivo's arc-label leader-line control is the most granular of any OSS library.

Nivo's weakness for us: the theme is a **JS object passed as a prop**, so it is not overridable per
widget without re-rendering with a new object, is not RSC-friendly, and cannot be tweaked from a
stylesheet. Also there is no `gridDash` default (dash must be set via `theme.grid.line` SVG props —
`UNVERIFIED` whether all SVG stroke props pass through the type).
### 2.6 visx (Airbnb) — verified from source (`master`)

visx is unbundled primitives, so "theming" means "props on the primitive you rendered".

- `@visx/axis` `Axis` defaults: `numTicks = 10`, `tickLength = 8`, `rangePadding = 0`,
  `hideAxisLine = false`, `hideTicks = false`, `hideZero = false`, `orientation = 'bottom'`.
  Props on `SharedAxisProps`: `stroke`, `strokeWidth`, **`strokeDasharray`**, `tickStroke`,
  `tickLength`, `tickLabelProps`, `labelOffset`, `numTicks`, `rangePadding`, `tickValues`,
  `tickFormat`, `label`, `labelProps`.
- `@visx/grid` `GridRows` defaults: `stroke = '#eaf0f6'`, `strokeWidth = 1`, `strokeDasharray`
  (undefined), `numTicks = 10`, `offset`, `lineStyle`, `tickValues`.
- `@visx/xychart` does have a theme (`buildChartTheme`): `{ backgroundColor, colors: string[],
  svgLabelBig, svgLabelSmall, htmlLabel, xAxisLineStyles, yAxisLineStyles, xTickLineStyles,
  yTickLineStyles, tickLength, gridColor, gridColorDark, gridStyles }`. Built defaults:
  label font stack `-apple-system,BlinkMacSystemFont,Roboto,Helvetica Neue,sans-serif`,
  big label `fontWeight: 700, fontSize: 12, letterSpacing: 0.4`, tick label
  `fontWeight: 200, fontSize: 11`, `gridStyles.strokeWidth: 1`, axis line `strokeWidth: 2`,
  axis label `dy: '-0.25em'`.

No bar padding, corner radius, or point-size tokens — those come from whatever d3 scale/shape you
wired up yourself (`scaleBand().padding()`, `<Bar rx=...>`). Ceiling is "whatever SVG allows",
floor is "nothing is centralised".

### 2.7 Observable Plot — verified from source (`main`)

Plot's design is "options on marks + scale defaults", but two findings matter a lot to us:

**1. `tickSpacing` — a published pixel-density default.** From `src/marks/axis.js`:

```js
let {interval, ticks, tickFormat, tickSpacing = k === "x" ? 80 : 35} = options;
if (ticks === undefined) ticks = maybeRangeInterval(interval, scale.type) ?? inferTickCount(scale, tickSpacing);
...
function inferTickCount(scale, tickSpacing) {
  const [min, max] = extent(scale.range());
  return (max - min) / tickSpacing;
}
```

So Plot's default is **one x-tick per 80px and one y-tick per 35px**, computed from the *range*
(the pixel extent), not the viewport. This is direct, citable prior art for the ladder's
Sparsify rule — and it says our draft's `floor(width/90)` is in the right family but that the
y-axis wants a much tighter spacing (35px) than the x-axis (80px), because y labels are one line
tall and x labels are many characters wide.

**2. Ticks are marks.** `tickSize` defaults to `6` on the "own" axis and `0` on the cross axis
(`tickSize = k === "y" ? 6 : 0` in `axisY`, `tickSize = k === "x" ? 6 : 0` in `axisX`). Other axis
options seen in source: `tickPadding`, `tickRotate`, `labelAnchor` (`center|top|bottom`),
`labelOffset` (defaults to `marginLeft/marginRight - 3`), `labelArrow`, `inset`/`insetLeft`/
`insetRight`/`insetTop`/`insetBottom`, `dx`/`dy`, `strokeWidth = 1`, `strokeOpacity`,
`strokeLinecap`, `strokeLinejoin`, `facetAnchor`, `frameAnchor`, `ariaLabel`.
Default `marginTop = 20` when unspecified (`30` for a top-anchored x-axis).
Global style channels available on every mark (`src/style.js`): `strokeLinejoin`, `strokeLinecap`,
`strokeMiterlimit`, `strokeDasharray`, `strokeDashoffset`, `strokeOpacity`, `fillOpacity`, etc.

Plot has no CSS-variable theme, no legend item-gap knob, and its bar padding comes from the band
scale (`padding`, default 0.1 — `UNVERIFIED` exact default, not read from source).

### 2.8 ECharts (Apache) — verified from `apache/echarts-doc`

ECharts sits just below Highcharts on granularity and is the most complete OSS surface.

Axis (`en/option/component/axis-common.md`):

| Path | Default |
|---|---|
| `axisLine.show` | `true` (**but** "The **value** axis doesn't show the axis line by default since v5.0.0") |
| `axisLine.onZero` | `'auto'` (since 6.1.0); `onZeroAxisIndex` |
| `axisLine.symbol` | `'none'`; `symbolSize` `[10, 15]`; `symbolOffset` `[0, 0]` (arrowheads on the domain line) |
| `axisLine.lineStyle` | `color: '#333'`, `width: 1`, `type: 'solid'` |
| `axisTick.show` | `true` (value axis: off since v5.0.0) |
| `axisTick.length` | `5` |
| `axisTick.alignWithLabel` | `false` |
| `axisTick.inside` | `false` |
| `axisTick.interval` | `'auto'` \| number \| function |
| `axisTick.customValues` | array (since 5.5.1) |
| `minorTick.show` | `false`; `minorTick.splitNumber` `5`; `minorTick.length` `3` |
| `axisLabel.margin` | **`8`** ← the tick→label offset |
| `axisLabel.rotate` | `0` |
| `axisLabel.inside` | `false` |
| `axisLabel.interval` | `'auto'` |
| `axisLabel.hideOverlap` | boolean — declarative collision avoidance |
| `axisLabel.showMinLabel` / `showMaxLabel` | `null` (auto) |
| `axisLabel.alignMinLabel` / `alignMaxLabel` / `verticalAlignMinLabel` / `verticalAlignMaxLabel` | `null` |
| `splitLine.show` | `true`; `showMinLine` `true`; `showMaxLine` `true`; `interval` `'auto'` |
| `splitLine.lineStyle` | `color: '#333'`, `width: 1`, `type: 'solid'` |
| `minorSplitLine` | separate object, same lineStyle shape |
| `splitArea.show` | `false`; `splitArea.areaStyle.color` (banding) |

Every ECharts `lineStyle` (`en/option/partial/line-style.md` + `line-border-style.md`) carries:
`color`, `width`, `type` (`'solid'|'dashed'|'dotted'` **or a number/array = custom dash array**),
**`dashOffset`** (default `0`), **`cap`** (default `'butt'`), **`join`** (default `'bevel'`),
**`miterLimit`** (default `10`), `opacity`, `shadowBlur`, `shadowColor`, `shadowOffsetX`,
`shadowOffsetY`. That is a complete SVG/Canvas stroke model exposed on *every* line in the chart.

Bar (`en/option/partial/barGrid.md`):

| Path | Default |
|---|---|
| `barWidth` | `null` (auto); accepts absolute `40` or percent `'60%'` of the calculated category width |
| `barMaxWidth` / `barMinWidth` | `null` / — |
| `barMinHeight` | `0` |
| `barMinAngle` | `0` (polar) |
| `barGap` (**between series**, i.e. inner) | **`'20%'`** of bar width; `'-100%'` overlaps them |
| `barCategoryGap` (**between categories**, i.e. outer) | auto — *"a suitable spacing is calculated based on the number of series … When there are more series, the spacing will be appropriately reduced"* |
| `roundCap` | `false` (polar bars) |
| `itemStyle.borderRadius` | supported (number or `[tl,tr,br,bl]`) |
| `showBackground` / `backgroundStyle` | `false` / object |

Note `barCategoryGap`'s auto rule — **the gap is a function of the series count**. Another
data-driven-geometry precedent.



---

### 2.9 amCharts 5 — the template/theme-rule model

Source: https://www.amcharts.com/docs/v5/concepts/axes/ (amCharts 5 axis concepts).

amCharts does not have a flat options tree. Every visual element is a **`Template`**, and themes are
lists of **rules** matched by class name plus tags — e.g. `Grid`, `Grid ["base"]`, `Grid ["minor"]`,
`Graphics ["axis","fill"]`. So granularity is "whatever properties the underlying `Graphics` class
has", which is very wide but also less enumerable than Highcharts' `tree.json`.

Verified axis-related settings:

| Object | Setting | Notes / default |
|---|---|---|
| `AxisRendererX` / `AxisRendererY` | `strokeOpacity`, `strokeWidth` | *"The actual axis line is represented by the axis renderer itself"* — the axis line is styled on the renderer, not a child object |
| | **`minGridDistance`** | *"minimum distance in pixels between any two grid lines"* — doc examples use `50` and `20`. **This is amCharts' tick-density knob** |
| | `minorGridEnabled` | `false` (since 5.6.0) |
| | `minorLabelsEnabled` | *"Enabling minor labels will automatically enable minor grid"* |
| | `inside`, `inversed`, `opposite` | booleans |
| | **`cellStartLocation` / `cellEndLocation`** | doc example `0.2` / `0.8` = *"60% of the actual cell"* — this is amCharts' **bar inner/outer padding** control, expressed as normalised cell positions |
| | `pan` | e.g. `"zoom"` |
| `Grid` (`renderer.grid.template`) | `stroke`, `strokeWidth`, `strokeOpacity` | theme rule `"Grid"` |
| | `location` | `0` = cell start (default), `1` = cell end |
| | base grid | targeted via rule `"Grid", ["base"]` |
| | minor grid | rule `"Grid", ["minor"]`, which *"has a slightly `strokeOpacity` set by default"* (exact value not stated on this page — **UNVERIFIED**) |
| | z-order | `chart.gridContainer.toFront()` moves grid above series |
| `AxisTick` (`renderer.ticks.template`) | `visible` | **ticks are disabled by default**; must set `visible: true` |
| | `stroke`, `location`, `multiLocation`, `inside`, `minPosition`, `maxPosition` | |
| `AxisLabel` (`renderer.labels.template`) | `fill`, `fontSize` | example `"1.5em"`; **minor axis labels default to `0.6em`** |
| | `rotation` + `centerX`/`centerY` | label `centerY` defaults to top (`0%`); `am5.p50` re-centres |
| | `location` / `multiLocation` | e.g. a weekly `DateAxis` needs `location: 3.5` |
| | `minPosition` / `maxPosition` | doc example `0.1` / `0.9` — suppresses labels near the axis ends |
| | `inside`, `background` | `background` requires a template `setup()` callback |
| Axis fills | `renderer.axisFills.template` → `fill`, `fillOpacity`, `visible` | **disabled by default**; theme rule `"Graphics", ["axis","fill"]`; axis-level `fillRule` callback decides which cells get filled |
| Axis (self) | `startLocation` / `endLocation` | `0` / `1` |
| | `height`, `bullet`, `x`, `centerX` | axis-level layout |
| Axis header | `axisHeader.set("paddingTop", 10)` | headers get their own container |

**Marked UNVERIFIED for amCharts** (not covered by the axes page, do not assert):
`strokeDasharray` on grid/ticks, `AxisTick.length`, label `maxWidth`, `oversizedBehavior`,
`textAlign`, legend item gap, bar corner radius.

Reading: amCharts' `minGridDistance` and `cellStartLocation`/`cellEndLocation` are the two ideas
worth stealing. `minGridDistance` is the *same* idea as Observable Plot's `tickSpacing` and
Highcharts' `tickPixelInterval` — three independent implementations converging on
**"specify tick density in pixels, not in counts"**. `cellStartLocation`/`cellEndLocation`
is a *cleaner* formulation of bar padding than "inner %/outer %", because it is a pair of
normalised positions inside the band and composes with any number of series.

---

### 2.10 Adobe Spectrum / React Spectrum Charts

The Spectrum docs site (`https://spectrum.adobe.com/page/color-for-data-visualization/`) is a
client-rendered SPA and returns no body text to a fetcher — so everything below is taken from the
**source of `@adobe/react-spectrum-charts`**, which is the implementation of that guidance:
https://github.com/adobe/react-spectrum-charts

(Note: `github.com/adobe/spectrum-tokens` no longer contains a `packages/` tree on `main`; the
published token JSON is reachable via npm/unpkg at `@adobe/spectrum-tokens/src/*.json`, and it
contains **no data-visualisation tokens** — no `categorical-*`, `sequential-*` or `diverging-*`
keys. Data-vis colour lives in the charts library, not the token package.)

#### 2.10.1 Spectrum's chart theme is a Vega `config`

`packages/themes/src/spectrumTheme.ts` exports `getSpectrumVegaConfig(colorScheme)` returning a
Vega `Config`. Verified values:

| Group | Setting | Value |
|---|---|---|
| `axis` | `bandPosition` | `0.5` |
| | `domain` | **`false`** (no domain line by default) |
| | `domainWidth` / `domainColor` | `2` / `gray-900` |
| | `gridColor` | `gray-200` |
| | `labelFontSize` / `labelFontWeight` | `14` (`DEFAULT_FONT_SIZE`) / `normal` |
| | `labelPadding` | `8` |
| | `labelOverlap` | `true` |
| | `ticks` | **`false`** (no tick marks by default) |
| | `tickColor` / `tickSize` / `tickWidth` / `tickCap` / `tickRound` | `gray-300` / `8` / `1` / `round` / `true` |
| | `titleFontSize` / `titleFontWeight` / `titlePadding` | `14` / `bold` / `16` |
| `legend` | `columnPadding` | `20` |
| | `rowPadding` | `8` |
| | `labelLimit` | `184` |
| | `symbolSize` | `250` (Vega area px²; `DEFAULT_LEGEND_SYMBOL_WIDTH = 16`, commented *"√250 ≈ 15.8"*) |
| | `symbolType` | `ROUNDED_SQUARE_PATH` — a custom SVG path, not a circle |
| | `titlePadding` | `8` |
| | layout (h) | `offset: 24`, `margin: 48`, `anchor: middle`, `center: true` |
| | layout (v) | `offset: 24`, `margin: 24`, `center: false` |
| `line` | `strokeWidth` | `2` |
| `area` | `opacity` | `0.8` |
| `rect` | `strokeWidth` | `0` |
| `rule` | `strokeWidth` | `2` |
| `symbol` | `size` / `strokeWidth` | `100` / `2` |
| `text` | `fontSize` | `14` |
| `title` | `fontSize` / `offset` | `18` / `10` |
| `background` | | `transparent` |
| `autosize` | | `{type:'fit', contains:'padding', resize:true}` |

Font stack: `adobe-clean, 'Source Sans Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
Ubuntu, 'Trebuchet MS', 'Lucida Grande', sans-serif`.

#### 2.10.2 The important find: Spectrum has an explicit *size-tier* system

`packages/constants/constants.ts` — this is the closest published prior art to our responsive
ladder, and it is **geometry that changes with chart size**:

```ts
/** Pixel thresholds at which the size tier transitions from S → M and M → L. */
export const CHART_SIZE_BREAKPOINTS = { M: 400, L: 800 } as const;

/** Scale ratios applied to all size-tier properties (S, M, L). M=1 is the base. */
const CHART_SIZE_SCALE_RATIOS = { S: 0.75, M: 1, L: 1.25 } as const;
```

Applied to (all verified in the same file):

| Constant | Base (M) | Derived |
|---|---|---|
| `CHART_SIZE_STROKE_WIDTHS` | `BASE_STROKE_WIDTH = 2` | S `1.5`, M `2`, L `2.5` |
| `CHART_SIZE_HOVER_STROKE_WIDTHS` | stroke + `HOVER_STROKE_OFFSET = 0.5` | S `2`, M `2.5`, L `3` |
| `CHART_SIZE_POINT_SIZES` | `BASE_POINT_DIAMETER = 8`, value is `(d * ratio)²` | S `36`, M `64`, L `100` |
| `CHART_SIZE_LABEL_GAPS` | `BASE_LABEL_GAP = 12` | S `9`, M `12`, L `15` |
| `CHART_SIZE_FONT_SIZE` | signal name exists (`rscChartSizeFontSize`) | per-tier table not in this file — **UNVERIFIED** |

Each is delivered to Vega as a **reactive signal** (`rscChartSizeStrokeWidth`,
`rscChartSizeFontSize`, `rscChartSizeHoverStrokeWidth`, `rscChartSizePointSize`,
`rscChartSizeLabelGap`), i.e. recomputed on resize rather than at mount.

This validates the ladder's core premise from a shipped enterprise library — but note the
**limits**, which are exactly our opening: Spectrum's tiers only *rescale* (ratio 0.75/1/1.25).
They do not **reveal/conceal**, **relabel**, **aggregate**, **substitute** or **transpose**.
Spectrum resizes the ink; it does not change the information.

Two per-element exceptions where Spectrum *does* conceal on a geometric threshold:

```ts
/** Min arc angle radians to display a segment label. */
export const DONUT_SEGMENT_LABEL_MIN_ANGLE = 0.3;
/** Min inner radius to display the summary metric. */
export const DONUT_SUMMARY_MIN_RADIUS = 45;
export const DONUT_SUMMARY_MIN_FONT_SIZE = 28;
export const DONUT_SUMMARY_MAX_FONT_SIZE = 60;
export const DONUT_SUMMARY_FONT_SIZE_RATIO = 0.35; // of inner radius
export const DONUT_RADIUS = '(min(width, height) / 2 - 2)';
```

`clamp(innerRadius * 0.35, 28, 60)` for the donut centre number is the same shape as Carbon's
`donut.center.numberFontSize` and should be a token triple in our system
(`--gx-arc-summary-size-ratio` / `-min` / `-max`).

#### 2.10.3 Other verified Spectrum chart constants

| Constant | Value |
|---|---|
| `CORNER_RADIUS` | `6` |
| `DISCRETE_PADDING` | `0.5` |
| `PADDING_RATIO` | `0.4` |
| `LINEAR_PADDING` | `0` |
| `TRELLIS_PADDING` | `0.2` |
| `DEFAULT_LINE_TYPES` | `['solid','dashed','dotted','dotDash','longDash','twoDash']` — a **named dash vocabulary**, not raw arrays |
| `DEFAULT_LINE_WIDTHS` | `['M']` (line width is a *scale* with named steps) |
| `DEFAULT_SYMBOL_SHAPES` | `['rounded-square']` |
| `DEFAULT_SYMBOL_SIZES` | `['XS','XL']` |
| `ANNOTATION_PADDING` | `4` |
| `DEFAULT_AXIS_ANNOTATION_OFFSET` | `80` |
| `MIN_THUMBNAIL_SIZE` / `MAX_THUMBNAIL_SIZE` / `THUMBNAIL_OFFSET` | `16` / `42` / `4` |
| `REFERENCE_LINE_SIZE_STROKE_WIDTHS` | `XS 1, S 1.5, M 1.5, L 2.5` |
| `REFERENCE_LINE_LABEL_OFFSET_FROM_LINE` | `9` |
| `DIRECT_LABEL_FONT_SIZE_S/M/L` | `14` / `16` / `18` |
| `DIRECT_LABEL_FONT_WEIGHT` | `700` |
| `DIRECT_LABEL_BACKGROUND_STROKE_WIDTH` | `4` (a halo stroke behind the label) |
| `LINE_POINT_ANNOTATION_OFFSET` | `3` |
| `ANIMATION_THROTTLE` | `33` ms (*"~30fps"*) |
| `ANIMATION_HOVER_SPEED` | `100` ms |
| `DRAW_IN_ANIMATION_DURATION_MS` | `1000` |
| `HOVER_NEUTRAL_TARGET` | `0.5` |
| `FADE_FACTOR` | `0.2` |
| `TOOLTIP_DELAY` | `350` ms |

Note the pattern in `DEFAULT_LINE_TYPES` / `DEFAULT_LINE_WIDTHS` / `DEFAULT_SYMBOL_SIZES`:
Spectrum treats **line type, line width and symbol size as encodable scales** (like colour), not
just as static styles. That is a distinct axis of granularity most libraries lack, and it is worth
mirroring: our dash/width tokens should be a *named ramp* (`--gx-line-dash-1..n`) so a series can be
encoded by dash as well as hue — which is also the standard colour-blind accessibility fallback.

---

## 3. Data-visualisation colour

### 3.1 The two opposing published models

There are exactly two shipped strategies among the systems surveyed, and they disagree.

**Model A — "one long ordered sequence, applied strictly in order" (Carbon).**
Source: https://carbondesignsystem.com/data-visualization/color-palettes/ (verified via curl; page
last updated 21 August 2026).

> "The colors of this palette should be applied in sequence strictly as described below. The
> sequence is carefully curated to maximize contrast between neighboring colors to help with
> visual differentiation."

Carbon light categorical (14, in order):

| # | Name | Hex |
|---|---|---|
| 01 | Purple 70 | `#6929c4` |
| 02 | Cyan 50 | `#1192e8` |
| 03 | Teal 70 | `#005d5d` |
| 04 | Magenta 70 | `#9f1853` |
| 05 | Red 50 | `#fa4d56` |
| 06 | Red 90 | `#570408` |
| 07 | Green 60 | `#198038` |
| 08 | Blue 80 | `#002d9c` |
| 09 | Magenta 50 | `#ee538b` |
| 10 | Yellow 50 | `#b28600` |
| 11 | Teal 50 | `#009d9a` |
| 12 | Cyan 90 | `#012749` |
| 13 | Orange 70 | `#8a3800` |
| 14 | Purple 50 | `#a56eff` |

Carbon then adds the key move:

> "You can override the categorical sequence with one of the following palettes **if the exact
> number of data categories is predictable**."

…and ships *n-specific* palettes ("1-Color group", "2-…", up to 5) — confirmed in source, where
`packages/core/scss/_color-palette.scss` keys the maps by **series count** (`'1'`…`'5'`, plus
`'14'`) then by option then by slot. **The palette is a function of the series count.** That is
directly relevant to us: series count is exactly the kind of thing the responsive planner knows.

Carbon **does** swap the categorical palette for dark themes — the dark 14 shifts to lighter steps
of the same hues: purple60, cyan40, teal60, magenta40, red50, red10, green30, blue50, magenta60,
`#d2a106` (yellow 40), teal40, cyan20, `#ba4e00` (orange 60), purple30.
(Source comments in `_color-palette.scss` note yellow/orange are raw hex *"update when available in
carbon color"*.)

Carbon sequential ("monochromatic") palettes are single-hue 10-step ramps (Blue/Purple/Cyan/Teal
10→100), with the documented rule:

> "In light themes, the darkest color denotes the largest values. In dark themes, the lightest
> color denotes the largest values."

Carbon diverging: `Red 80 → Red 10` then `Cyan 10 → Cyan 80` (16 steps), and
`Purple 80 → Purple 10` then `Teal 10 → Teal 80`. With:

> "Please note that diverging palettes do not differentiate between light and dark themes."

And a semantic rule: red-cyan *"has a natural association with temperature"*; purple-teal is *"good
for data with no temperature associations."*

**Model B — "fixed palette, theme-independent" (Adobe Spectrum).**
Verified in `packages/themes/src/spectrumColors.ts`: the `categorical-100` … `categorical-1600`
values are **byte-identical between `light` and `dark`**. e.g. `categorical-100 = rgb(15,181,174)`
in both. Only the greys flip (`gray-900`: `rgb(0,0,0)` light → `rgb(255,255,255)` dark;
`gray-200`: `rgb(230,230,230)` → `rgb(48,48,48)`).

Spectrum instead varies palette **length**, exported as named arrays in
`packages/themes/src/categoricalColorPalette.ts`:
`categorical6`, `categorical12`, `categorical16` (Spectrum 1); `s2Categorical6`, `s2Categorical12`,
`s2Categorical16`, `s2Categorical20` (Spectrum 2). So Spectrum's answer to "how many series" is
**pick the palette of that length**, not "truncate the long one".

**Implication for us:** these are not mutually exclusive. Support both — a `--gx-cat-N` slot list
whose *source palette* can be selected by (a) theme and (b) series count. Both dimensions are
already in the CSS cascade's reach (`[data-gx-theme]`, `[data-gx-series-count]`).

### 3.2 Spectrum's sequential and diverging inventory (verified)

`packages/themes/src/sequentialColorPalette.ts` exports, each at **5, 9 and 16 stops**:
`sequentialViridis*`, `sequentialMagma*`, `sequentialRose*`, `sequentialCerulean*`,
`sequentialForest*`.

`packages/themes/src/divergingColorPalette.ts` exports, each at **5, 9 and 15 stops**:
`divergentOrangeYellowSeafoam*`, `divergentRedYellowBlue*`, `divergentRedBlue*`.

Defaults wired in `spectrumTheme.ts`:
`range.category = categorical16`, `range.ordinal = categorical16`,
`range.ramp = sequentialViridis16`, `range.diverging = divergentOrangeYellowSeafoam15`.

Two things to steal: (1) **every scale ships at multiple stop counts** rather than being
interpolated on the fly — which means a *discrete* ramp is a first-class artefact, not a
side-effect; (2) Adobe adopted **Viridis** as its default continuous ramp, i.e. the
perceptually-uniform academic colormap won inside a commercial design system.

### 3.3 Vega / Vega-Lite defaults (verified, `vega-parser/src/config.js`)

```
range: {
  category: 'tableau10',
  ordinal:  'blues',
  heatmap:  'yellowgreenblue',
  ramp:     'blues',
  diverging: { scheme: 'blueorange', extent: [1, 0] }
}
```

Note `extent: [1, 0]` — the diverging scheme is deliberately **reversed** from its natural order.

Verified scheme hex strings from `vega/packages/vega-scale/src/palettes.js`
(6-hex-digit concatenations):

- `tableau10` = `4c78a8 f58518 e45756 72b7b2 54a24b eeca3b b279a2 ff9da6 9d755d bab0ac`
- `tableau20` = `4c78a8 9ecae9 f58518 ffbf79 54a24b 88d27a b79a20 f2cf5b 43989 4 83bcb6 e45756 ff9d98 79706e bab0ac d67195 fcbfd2 b279a2 d6a5c9 9e765f d8b5a5`
  *(the string in source is unspaced; spacing added here for readability — always re-derive from
  the source string rather than transcribing.)*
- `category10` / `accent` / `dark2` / `paired` / `pastel1` / `pastel2` / `set1` / `set2` / `set3` /
  `observable10` are re-exported from **d3-scale-chromatic**, not defined inline.
- `category20`, `category20b`, `category20c` are defined inline (legacy d3 v3 palettes).

### 3.4 ColorBrewer — the empirical ceiling on categorical hues

Verified by parsing https://raw.githubusercontent.com/axismaps/colorbrewer/master/export/colorbrewer.json
(the canonical machine-readable ColorBrewer export; specifications by Cynthia Brewer,
http://colorbrewer2.org/):

| Type | Schemes | Class-count range offered |
|---|---|---|
| Qualitative | `Set2`, `Accent`, `Dark2`, `Pastel2` | **3–8** |
| | `Set1`, `Pastel1` | **3–9** |
| | `Set3`, `Paired` | **3–12** |
| Sequential | 18 schemes (`Blues`, `YlGnBu`, `OrRd`, …) | **3–9** (`YlOrRd` 3–8) |
| Diverging | 9 schemes (`RdBu`, `Spectral`, `PuOr`, `BrBG`, …) | **3–11** |

**This is the citable "max categorical colours" answer.** ColorBrewer — the most-cited cartographic
colour resource — **refuses to emit more than 12 qualitative classes, and most of its qualitative
schemes stop at 8.** Sequential stops at 9 and diverging at 11. Nobody publishing a rigorous
palette goes past 12 hues.

Cross-checks that corroborate the same ceiling:
- d3/Vega `tableau10`, `category10`, `observable10`, R's `"Tableau 10"` → **10**.
- Carbon's headline categorical list → **14**, but with the explicit instruction to use an
  n-specific palette instead when n is known, and n-specific palettes only exist for **1–5**.
- Spectrum tops out at **20** (`s2Categorical20`) but its *default* is 16 and its smallest, most
  recommended set is `categorical6`.

Note: the public `export/colorbrewer.json` does **not** carry the per-scheme
`properties.blind / print / screen` flags that colorbrewer2.org's UI filters on — so *which specific
schemes are flagged colourblind-safe is* **UNVERIFIED** *from a primary machine-readable source*.
Do not assert a list; link to the site's "colorblind safe" filter instead.

### 3.5 Okabe–Ito (Color Universal Design)

Primary source: Masataka Okabe & Kei Ito, "Color Universal Design (CUD) — How to make figures and
presentations that are friendly to Colorblind people", https://jfly.uni-koeln.de/color/

Verbatim design rationale for the 8-colour "colorblind barrier-free color pallet" (Fig. 16):

> "This is a proposal of color pallet that is 1: unambiguous both to colorblinds and
> non-colorblinds, 2: with vivid colors so that color names are easy to identify, 3: can be
> printable with similar color both on screen and when printed.
> For red, vermilion is used since it is recognizable also to protanopes.
> **Colors between yellow and green are all avoided**, since they are indistinguishable with yellow
> and orange. For green, bluish green is chosen so that it won't be confused with red or brown.
> Since violet is close to blue and appear the same to colorblinds, reddish purple is chosen. …
> Sky blue and blue are chosen so that they are distinguishable with there difference in brightness
> and saturation."

And the combination rule (directly tokenisable as an ordering constraint):

> "When combining colors from this pallet, Use 'warm' and 'cool' colors alternatively. When using
> two warm colors or two cool colors, put distinct differences in brightness or saturation. Avoid
> combination of colors with low saturation or low brightness."

The palette members named on the page: black, orange, sky blue, bluish green, yellow, blue,
vermilion, reddish purple (**8**). The **exact hex values are published on that page only as a
raster image** (`image/pallete.jpg`) — so the specific hex codes are **UNVERIFIED from primary
source**. The canonical machine-readable copy is R ≥ 4.0's
`palette.colors(palette = "Okabe-Ito")`
(https://stat.ethz.ch/R-manual/R-devel/library/grDevices/html/palette.html, which documents
`palette.colors(n = NULL, palette = "Okabe-Ito", …)` and names `"Okabe-Ito"` as R's **default**
palette). Take the values from there, not from a blog post.

Two more rules from the same page that are *geometry*, not colour, and belong in our token set:

> "3) Make texts and objects as thick or big as possible. When the size of color-coded objects is
> small, only a few cone cells can be used for recognition. Colorblind people find it especially
> difficult to distinguish the colors of **thin lines and small symbols**."

> "1) Avoid the situation where important information is conveyed only in the form of color."

The second is why `DEFAULT_LINE_TYPES` (Spectrum, §2.10.3) matters: a **dash ramp parallel to the
hue ramp** is the standard redundant encoding. We should ship `--gx-series-dash-1..n` as a
first-class sibling of `--gx-series-color-1..n`.

The first is why the responsive ladder must **raise** stroke width and point size at small sizes,
not lower them — which is the opposite of what Spectrum's `CHART_SIZE_SCALE_RATIOS`
(`S: 0.75`) does. Worth flagging as a deliberate divergence.

### 3.6 Viridis and perceptual uniformity

Primary source: Stéfan van der Walt & Nathaniel Smith, https://bids.github.io/colormap/ (the
matplotlib colormap page; "option D" became `viridis`, matplotlib's default in 2.0).

The stated criterion, verbatim:

> "A 'perceptually uniform' colormap is one for which the 'perceptual deltas' plot makes a simple
> horizontal line. … We want our colormap to have the property that if your data goes from 0.1 to
> 0.2, this should create about the same perceptual change as if your data goes from 0.8 to 0.9.
> For color geeks: we're using **CAM02-UCS** as our model of perceptual distance."

Also verbatim on the most common CVD form:

> "Of the 4 colorblind simulations below, the upper-left one — 'Moderate deuteranomaly' —
> represents by far the most common form. It affects something like 5% of white men."

Practical consequence: continuous ramps must be evaluated in **greyscale and under deuteranomaly
simulation**, not by eye. Adobe already concluded this and shipped Viridis as `range.ramp`.

### 3.7 Expressing all this as tokens

The failure mode to avoid: emitting `--gx-color-1 … --gx-color-20` and calling it done. Palettes have
*structure* the flat list destroys. Minimum viable structure, all expressible in CSS custom
properties:

1. **Slot tokens** — `--gx-series-1` … `--gx-series-N`. What marks actually read. Never a literal.
2. **Palette definitions** — the ordered sequences, defined once per palette per theme, and
   *assigned* into the slots. Selection is a cascade concern:
   `:root { --gx-series-1: var(--gx-palette-categorical-1); }`, and
   `[data-gx-palette="cvd"] { --gx-palette-categorical-1: …; }` swaps the whole thing.
3. **Length variants** — Carbon and Spectrum agree that the palette should depend on `n`.
   Expose `[data-gx-series-count="1".."6"]` (Carbon's n-specific groups only go to 5) and let it
   re-point the slot tokens. Above the threshold, fall back to the long sequence.
4. **Redundant-encoding ramps** — `--gx-series-dash-1..N`, `--gx-series-shape-1..N`,
   `--gx-series-width-1..N`. Required by CUD rule 1 and already precedented by Spectrum's
   `LINE_WIDTH_SCALE` / `SYMBOL_SIZE_SCALE` / `DEFAULT_LINE_TYPES`.
5. **Continuous ramps as discrete stops** — `--gx-ramp-seq-1..9`, `--gx-ramp-div-1..11`,
   matching the ColorBrewer ceilings exactly (9 sequential, 11 diverging), plus the
   *endpoints* (`--gx-ramp-seq-from` / `-to`) for CSS `color-mix()` interpolation when a truly
   continuous scale is needed. Spectrum's 5/9/16 and 5/9/15 shipping pattern is the precedent.
6. **Direction is a token, not code** — Carbon's rule "in dark themes the lightest colour denotes
   the largest values" is a *reversal*, i.e. `--gx-ramp-seq-direction: 1 | -1`, and Vega's
   `diverging: { extent: [1, 0] }` is the same idea. Encode it; do not branch in a renderer.
7. **Semantic/alert colours are a separate namespace** — Carbon publishes an explicit alert set
   (Red 60 `#da1e28`, Orange 40 `#ff832b`, Yellow 30 `#f1c21b`, Green 60 `#198038`) that must never
   be drawn from the categorical sequence, or "series 5 is red" collides with "red means error".
8. **Gradients are banned by default.** Carbon, verbatim: *"Multiple gradients are often
   inaccessible and are discouraged in our system. Gradients should not be used to represent any
   meaningful progression or divergence. Never use a gradient in place of a sequential palette."*
   This corroborates the planned lint rule that rejects gradients in token CSS.

---

## 4. Widget / bento visual language

### 4.1 Apple — WidgetKit size families (verified)

Source: https://developer.apple.com/documentation/widgetkit/widgetfamily
(fetched as `…/widgetfamily.md`; the HTML page is JS-only. Availability header:
iOS 14.0+, iPadOS 14.0+, macOS 11.0+, visionOS 26.0+, watchOS 9.0+.)

The complete enumeration — **9 cases in 2 groups**:

| Group | Case | Apple's description (verbatim) |
|---|---|---|
| System | `systemSmall` | "A small widget." |
| | `systemMedium` | "A medium-sized widget." |
| | `systemLarge` | "A large widget." |
| | `systemExtraLarge` | "An extra-large widget." |
| | `systemExtraLargePortrait` | "An extra-large widget that uses a portrait orientation." |
| Accessory | `accessoryCircular` | "A circular widget." |
| | `accessoryCorner` | "A widget-based complication in the corner of a watch face in watchOS." |
| | `accessoryRectangular` | "A rectangular widget." |
| | `accessoryInline` | "A flat widget that contains a single row of text and an optional image." |

Crucially, Apple **refuses to publish fixed dimensions**:

> "Note: The sizes of widgets may vary across devices. Your widget content should be flexible and
> avoid using fixed values."

So the widely-repeated "2×2 / 4×2 / 4×4 cell" figures are **launcher-grid folklore, not API** —
they do not appear in `WidgetFamily` and are therefore **UNVERIFIED**. The family name is the
contract; the pixel size is not. **This is a direct argument for our size-family approach over
pixel breakpoints**, and for `resolveSizeClass()` returning a *name*.

Also note the shape of the enumeration: `systemExtraLargePortrait` exists purely because the
*aspect ratio* differs, not the area. Apple's families are `(size × orientation)`, which is exactly
the `(w, h)` cell tuple + aspect test in `10-responsive-ladder-draft.md`.

### 4.2 Apple HIG — the design rules (verified)

Source: https://developer.apple.com/design/human-interface-guidelines/widgets
(fetched via `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/widgets.json`;
the HTML page is JS-only).

The HIG states our product thesis almost verbatim:

> "Small widgets use their limited space to typically show a single piece of information while
> larger sizes support additional layers of information and actions. **Avoid expanding a smaller
> widget's content to simply fill a larger area.** It's more important to create one widget in the
> size that best represents the content than providing the widget in all sizes."

> "**Balance information density.** Sparse layouts can make the widget seem unnecessary, while
> overly dense layouts are less glanceable. Create a layout that provides essential information at
> a glance and allows people to view additional details by taking a longer look. If your layout is
> too dense, consider improving its clarity by using a larger widget size **or replacing text with
> graphics**."

> "**Display only the information that's directly related to the widget's main purpose.** In larger
> widgets, you can display more data — or more detailed visualizations of the data — but you don't
> want to lose sight of the widget's primary purpose. For example, all Calendar widgets display a
> person's upcoming events. **In each size, the widget remains centered on events while expanding
> the range of information as the size increases.**"

That last sentence is the cleanest available external statement of the ladder: *same subject,
expanding range of information, as a function of size.* Cite it in the README.

Verified numeric guidance (the only hard numbers the HIG gives):

| Property | Value | Verbatim |
|---|---|---|
| Standard widget margin | **16 pt** | "Use the standard margin width for widgets — 16 points for most widgets — to avoid crowding their edges and creating a cluttered appearance." |
| Tight/content-group margin | **11 pt** | "If you need to use tighter margins — for example, to create content groupings for graphics, buttons, or background shapes — setting margins of 11 points can work well." |
| Platform variance | smaller | "widgets use smaller margins on the desktop on Mac and on the Lock Screen, including in StandBy." (exact values not given — **UNVERIFIED**) |
| visionOS user scaling | **75 %–125 %** | "people can scale a widget from 75 to 125 percent in size." |

Corner radius: the HIG explicitly refuses a number and instead makes it a *derived* value:

> "**Coordinate the corner radius of your content with the corner radius of the widget.** To ensure
> that your content looks good within a widget's rounded corners, use a SwiftUI container to apply
> the correct corner radius."

The SwiftUI mechanism referenced is `ContainerRelativeShape` — described in the same payload as
"…the system calculates from an inset version of the current container shape."
**Inner radius = outer radius − inset.** That is a *formula*, not a constant, and it is the correct
model for us:
`--gx-widget-radius-inner: calc(var(--gx-widget-radius) - var(--gx-widget-padding))`.

Note the 75–125 % visionOS range is numerically identical to Adobe's
`CHART_SIZE_SCALE_RATIOS = { S: 0.75, M: 1, L: 1.25 }` (§2.10.2). Two independent systems landing on
±25 % as the acceptable uniform-scale envelope is a reasonable default for `--gx-scale-*`.

### 4.3 Android — app widget sizing (verified)

Sources:
https://developer.android.com/develop/ui/views/appwidgets/layouts and
https://developer.android.com/about/versions/12/features/widgets

Android 12 (API 31) moved widget sizing from **pixels to grid cells**:

| Attribute | Meaning (verbatim / paraphrase) |
|---|---|
| `targetCellWidth` / `targetCellHeight` | "define the target size of the widget in terms of launcher grid cells. **If defined, these attributes are used instead of `minWidth` or `minHeight`**" |
| `minWidth` / `minHeight` | legacy dp minimums |
| `minResizeWidth` / `minResizeHeight` | smallest the user may resize to |
| `maxResizeWidth` / `maxResizeHeight` | "define the maximum size that the launcher allows the user to resize the widget to" |

Example from the docs: `targetCellWidth="3" targetCellHeight="2" maxResizeWidth="250dp"
maxResizeHeight="110dp"`.

**Android independently arrived at our `(w, h)` in cells + min/max clamp model.** Our grid decision
(12 columns × unlimited rows, size expressed in cells) is the same contract.

The responsive-layout API is even closer to the ladder:

> "If the layout needs to change depending on the size of the widget, we recommend **creating a
> small set of layouts, each valid for a range of sizes**. … This feature allows for smoother
> scaling and overall better system health, because the system doesn't have to wake up the app
> every time it displays the widget in a different size."

Implementation (verbatim from the docs' Kotlin sample):

```kotlin
val viewMapping: Map<SizeF, RemoteViews> = mapOf(
    SizeF(150f, 100f) to smallView,
    SizeF(150f, 200f) to tallView,
    SizeF(215f, 100f) to wideView,
)
val remoteViews = RemoteViews(viewMapping)
```

with the documented resolution rule (given `minResize 160×110`, `maxResize 250×200`):
`smallView` covers 160×110 → 160×199; `tallView` covers 160×200 → 214×200; `wideView` covers
215×110 → 250×200. I.e. **a discrete set of named layouts, each owning a rectangular region of the
size space, selected by nearest-fit-below.** That is precisely `resolveSizeClass()`, and it
confirms the design should be *regions*, not one-dimensional breakpoints — note `tallView` and
`wideView` are distinguished by **aspect**, not area, exactly as in the ladder draft's
`aspect >= 1.4` donut rule.

Corner radius on Android 12+:

> "Widgets in Android 12 have rounded corners. When an app widget is used on a device running
> Android 12 or higher, the launcher automatically identifies the widget's background and crops it
> to have rounded corners."

> "Caution: The dimensions of rounded corners may vary across devices because the size of the
> corner radius is **controllable by both device manufacturers (up to 16dp) and third-party
> launchers**."

Two system parameters exist for this: `system_app_widget_background_radius` and
`system_app_widget_inner_radius`. **Their default dp values are UNVERIFIED** — the docs give only
the OEM ceiling of 16 dp. The important structural point matches Apple: **outer and inner radius
are two separate tokens**, and the platform owns the outer one.

Also verified: Android 12 widgets can adopt "device theme colors for buttons, backgrounds, and
other components, including light and dark themes" — i.e. the container is theme-owned and the
content must not hard-code its surface.

### 4.4 Carbon's chart-level thresholds (verified, and directly tokenisable)

From https://carbondesignsystem.com/data-visualization/axes-and-labels/ and
https://carbondesignsystem.com/data-visualization/chart-anatomy/:

| Rule (verbatim) | Token implication |
|---|---|
| "On the X axis, the break can be fluid with graph area size, with a **minimum width of 16px**. On the Y axis, we recommend using a **fixed distance of 16px** for the break." | `--gx-axis-break-min-width: 16px` |
| "If data is available during an axis break, re-style line segments to use **0.5px stroke** and hide circles representing data points." | `--gx-line-stroke-width-muted: 0.5px` + a conceal rule |
| "When the graphic translation of the data is **less than 3 degrees**, a callout is used to clearly associate the label with the slice." | `--gx-arc-label-callout-below-deg: 3` |
| "If the data translates as **less than 1 degree**, a slice will not be rendered on the chart" | `--gx-arc-min-render-deg: 1` |
| "Whenever data crosses into a new time cycle, such as a new day, month, or year, **semibold the label** to make it a 'landmark' label" | `--gx-label-landmark-grade: 150` (⚠ retargeted from `font-weight` to `GRAD` — `42-typography.md` §3) |
| "Never change axis ticks increments to accommodate data availability." | a *constraint on the planner*, not a token: tick intervals must stay uniform across ladder rungs |
| "Never interpolate between periods when data is unavailable. Always label both the start and end point during which data is not available." | gap handling is explicit, not implicit |

Compare with Adobe's `DONUT_SEGMENT_LABEL_MIN_ANGLE = 0.3` rad ≈ 17.2° (§2.10.2) — Carbon's 3°
callout / 1° drop and Adobe's 17° label-hide are *the same mechanism at different settings*, which
is the argument for exposing it as a token rather than picking one.

### 4.5 The bento grid

**Honest status: there is no normative specification.** "Bento grid" is a descriptive term for a
layout pattern (heterogeneous rounded rectangular tiles of varying cell spans on a shared grid,
each tile self-contained, gaps uniform). It is popularised by Apple's own product marketing pages
and by dashboard UI kits, but no vendor publishes it as a spec with numbers. Do **not** cite a
"bento spec" — there isn't one. Anything numeric attributed to it would be fabricated.

What *is* verifiable is the set of visual properties the pattern is made of, and every one of them
already has a token in a real system:

| Visual property | Verified precedent |
|---|---|
| Uniform gutter between tiles | our own 12-col grid decision; Android launcher cells |
| Tile corner radius (outer) | platform-owned: Apple `ContainerRelativeShape`; Android `system_app_widget_background_radius` (≤16 dp) |
| Inner/content radius derived from outer | Apple: "an inset version of the current container shape" |
| Content inset | Apple **16 pt** standard, **11 pt** tight |
| Surface/elevation | Android: device theme colours for backgrounds; Carbon: `$layer-01-absolute`, `$layer-inverse-absolute` token layers |
| Heterogeneous spans on one grid | Android `targetCellWidth`/`targetCellHeight`; Apple's family enum |
| Content changes with span | Apple HIG (§4.2); Android `Map<SizeF, RemoteViews>` (§4.3) |
| Density budget | Apple: "Balance information density… overly dense layouts are less glanceable" |

So the "bento look" reduces, for our purposes, to seven tokens: gutter, outer radius, inner radius
(derived), padding, surface colour, border/elevation, and header treatment. Everything that makes
it feel like a *widget system* rather than a set of cards is in the **content-changes-with-span**
row — which is the part nobody else does for charts.

---

## 5. Typography in charts

### 5.1 The CSS mechanisms (verified against MDN / CSS Fonts)

Sources: https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric and
https://developer.mozilla.org/en-US/docs/Web/CSS/font-optical-sizing

`font-variant-numeric` — initial value `normal`; a space-separated list drawn from four
independent sub-axes, each mapping to an OpenType feature tag:

| Sub-axis | Keyword | OpenType tag | MDN definition (verbatim) |
|---|---|---|---|
| figures | `lining-nums` | `lnum` | "activating the set of figures where numbers are all lying on the baseline" |
| | `oldstyle-nums` | `onum` | "activating the set of figures where some numbers, like 3, 4, 7, 9 have descenders" |
| spacing | `proportional-nums` | `pnum` | "activating the set of figures where numbers are not all of the same size" |
| | `tabular-nums` | `tnum` | "activating the set of figures where numbers are all of the same size, **allowing them to be easily aligned like in tables**" |
| fractions | `diagonal-fractions` | `frac` | numerator/denominator smaller, separated by a slash |
| | `stacked-fractions` | `afrc` | numerator/denominator smaller, stacked, separated by a horizontal line |
| — | `ordinal` | `ordn` | "special glyphs for the ordinal markers, like 1st, 2nd, 3rd" |
| — | `slashed-zero` | `zero` | "forces the use of a 0 with a slash; this is useful when a clear distinction between O and 0 is needed" |

The four sub-axes are orthogonal, so `lining-nums tabular-nums slashed-zero` is a legal single
declaration. **This is why numerals want their own token, not a font-family token**: the correct
axis-tick setting (`tabular-nums`) differs from the correct in-prose setting (`proportional-nums`),
and both may share one family.

`font-optical-sizing` — initial value `auto`; keywords `auto` | `none`. Drives the variable-font
`opsz` axis. MDN's description is directly relevant to small chart labels:

> "When optical sizing is used, **small text sizes are often rendered with thicker strokes and
> larger serifs**, whereas larger text is often rendered more delicately with more contrast between
> thicker and thinner strokes."

That is the type-design analogue of the Okabe-Ito CUD instruction in §3.5 ("Make texts and objects
as thick or big as possible… thin lines and small symbols") — and again the *opposite* of Adobe's
`S: 0.75` uniform down-scale. Optical sizing is on by default and should stay on; it means a
correctly-chosen variable font already compensates for our smallest rungs for free, but only for
text, not for strokes. We must do the stroke half ourselves.

### 5.2 Who actually ships tabular figures (verified by source inspection)

I grepped the shipped packages for `tabular-nums` / `fontVariant`:

| Library (version inspected) | Ships tabular numerals by default? |
|---|---|
| **Observable Plot 0.6.17** | **Yes — and it's automatic and conditional** |
| Recharts 3.10.1 | No — `fontVariant` appears only in `util/svgPropertiesNoEvents` (a pass-through allowlist of SVG attributes) |
| Nivo (line 0.99.0) | No |
| visx (`@visx/axis` 4.0.0, `@visx/shape` 4.0.0) | No |
| Victory 37.3.6 | No |
| uPlot 1.6.32 | No |
| Unovis (`@unovis/react` 1.6.7) | No |
| Vega (`vega-parser` config defaults) | No |
| ECharts | No (not present in the inspected package) |
| Adobe React Spectrum Charts | No (absent from `spectrumTheme.ts` / `constants.ts`) |

Plot's implementation is worth copying exactly. From
`@observablehq/plot@0.6.17/src/marks/axis.js:717`:

```js
function inferFontVariant(scale) {
  return scale.bandwidth && !scale.interval ? undefined : "tabular-nums";
}
```

and `src/axes.js:4`:

```js
return isOrdinalScale(scale) && scale.interval === undefined ? undefined : "tabular-nums";
```

and `src/marks/text.js:191`:

```js
return T && (isNumeric(T) || isTemporal(T)) ? "tabular-nums" : undefined;
```

Documented in `src/scales.d.ts:599`:

> "The font-variant attribute for axis ticks; **defaults to *tabular-nums* for quantitative axes**."

The rule is: **tabular numerals iff the channel is numeric or temporal; proportional otherwise.**
A band scale of category names gets `undefined` (inherit); a band scale with an `interval` (i.e. a
binned/temporal band) gets tabular. That conditional is correct and almost nobody else implements
it. We should ship it as a *default with a token override*:
`--gx-axis-label-numeric-variant: tabular-nums` / `--gx-label-text-variant: normal`.

Plot's default label size is `10` (`src/plot.js:255`: `.attr("font-size", 10)`).

### 5.3 Verified default font sizes across systems

Every value below was read out of source, not documentation prose.

| System | Tick / axis label | Axis title | Chart title | Legend | Data label | Other |
|---|---|---|---|---|---|---|
| **Vega** (`vega-parser/src/config.js`) | `guide-label` **10** | `guide-title` **11**, `fontWeight: 'bold'` | `group-title` **13** bold | uses `guide-label`/`guide-title` | `text` mark **11** | `group-subtitle` **12** |
| **Nivo** (`packages/theming/src/defaults.ts`) | inherits `text.fontSize` **11** | `axis.legend.text` **12** | — | `legends.ticks.text` **10** | — | `annotations.text` **13**; tooltip `fontSize: 'inherit'` |
| **Observable Plot** 0.6.17 | **10** (`plot.js`) | — | — | — | — | — |
| **Adobe React Spectrum Charts** | `axis.labelFontSize` **14** (`fontWeight: 'normal'`) | `axis.titleFontSize` **14** bold | `title.fontSize` **18** | `text.fontSize` **14** | direct labels **14 / 16 / 18** by size tier, `fontWeight: 700` | `DEFAULT_FONT_SIZE = 14` |
| **Highcharts** (`hc_extract`) | — | — | — | `legend.itemStyle.fontSize: '0.8em'`, bold; `legend.title.style.fontSize: '0.8em'` bold | `plotOptions.series.dataLabels.style: { fontSize: '0.7em', fontWeight: 'bold', color: 'contrast', textOutline: '1px contrast' }` | `tooltip.style.fontSize: 0.8em` |

Two structural observations:

1. **Highcharts expresses type in `em`, not `px`.** `0.8em` / `0.7em` means the whole chart's type
   scale is inherited from the container and is therefore *already* CSS-cascade-driven — the same
   architecture our locked CSS-custom-property decision gives us. It also means Highcharts' data
   labels are deliberately *smaller* than its legend (0.7 vs 0.8), and both are smaller than body
   text. That relative ordering (data label < axis label ≤ legend < axis title < chart title) is
   consistent across every system above and is what our token defaults should encode as ratios.
2. **Nobody agrees on the absolute floor.** Vega/Plot land at **10**, Nivo at **10–11**, Adobe at
   **14**. There is a 40 % spread. That is not a bug in the research — it reflects that Vega/Plot
   target dense analyst charts and Spectrum targets product UI. It is a strong argument for making
   the floor a token (`--gx-label-font-size-min`) rather than a constant, and for our ladder to
   *conceal* labels rather than shrink them past the floor.

**No system in this survey publishes a minimum legible size as a normative rule.** WCAG does not
specify a minimum font size either (it specifies contrast and resize-to-200 %, not size). So any
"axis labels must be ≥ Npx" claim would be fabricated. What *is* citable is the observed range
(10–14 px) and the ordering. Marked **UNVERIFIED**: a normative minimum.

### 5.4 Font size as a function of chart size (verified precedent)

Two systems compute type size from chart geometry rather than a breakpoint table:

**Carbon** — `packages/core/src/configuration.ts`, word cloud:

```ts
fontSizeRange: (chartSize: any) => {
  const smallerChartDimension = Math.min(chartSize.width, chartSize.height)
  return [(smallerChartDimension * 20) / 400, (smallerChartDimension * 75) / 400]
}
```

i.e. **linear in `min(width, height)` against a 400 px reference**. Carbon uses the same pattern for
`radiusRange` and for `donut.center.numberFontSize` (§2.x).

**Adobe** — the discrete tier version: `CHART_SIZE_BREAKPOINTS = { M: 400, L: 800 }` with
`CHART_SIZE_SCALE_RATIOS = { S: 0.75, M: 1, L: 1.25 }` and a `rscChartSizeFontSize` reactive signal
(§2.10.2). Note Carbon's reference dimension is also **400**.

**Adobe donut summary** shows the hybrid — a ratio with a clamp:

```
DONUT_SUMMARY_FONT_SIZE_RATIO = 0.35
DONUT_SUMMARY_MIN_FONT_SIZE   = 28
DONUT_SUMMARY_MAX_FONT_SIZE   = 60
DONUT_SUMMARY_MIN_RADIUS      = 45
```

This is the correct general form and it is expressible in pure CSS with no JS:

```css
font-size: clamp(
  var(--gx-arc-summary-font-size-min),
  calc(var(--gx-arc-radius) * var(--gx-arc-summary-font-size-ratio)),
  var(--gx-arc-summary-font-size-max)
);
```

So `ratio` + `min` + `max` is a **three-token idiom** we should use everywhere a dimension is
size-derived, not just for donut summaries. It subsumes both Carbon's linear function and Adobe's
tier table, and it is the only one of the three that survives being handed to a user as CSS.

### 5.5 Typography tokens implied

| Token | Purpose | Grounded in |
|---|---|---|
| `--gx-font-family` | one family for all chart text | every system |
| `--gx-font-family-mono` | optional; for values where a tabular face is unavailable | — |
| `--gx-numeric-variant` | `lining-nums tabular-nums` for numeric/temporal channels | Plot `inferFontVariant` |
| `--gx-numeric-variant-categorical` | `normal` for ordinal/band channels without interval | Plot `inferFontVariant` |
| `--gx-numeric-slashed-zero` | opt-in `slashed-zero` | MDN/OpenType `zero` |
| `--gx-font-optical-sizing` | `auto` \| `none` | MDN; default `auto` |
| `--gx-label-font-size` | tick/axis labels | Vega 10 / Nivo 11 / Adobe 14 |
| `--gx-label-font-size-min` | ladder floor; conceal rather than shrink below | no normative source — ours |
| `--gx-axis-title-font-size`, `--gx-axis-title-font-weight` | Vega 11 / bold | Vega, Adobe |
| `--gx-title-font-size`, `--gx-title-font-weight` | Vega 13 bold / Adobe 18 | Vega, Adobe |
| `--gx-legend-label-font-size` | Nivo 10, Highcharts `0.8em` bold | Nivo, Highcharts |
| `--gx-value-label-font-size`, `--gx-value-label-font-weight` | Highcharts `0.7em`/bold, Adobe 700 | Highcharts, Adobe |
| `--gx-value-label-halo-width`, `--gx-value-label-halo-color` | Highcharts `textOutline: '1px contrast'`; Nivo `outlineWidth`/`outlineColor`/`outlineOpacity`; Adobe `DIRECT_LABEL_BACKGROUND_STROKE_WIDTH = 4` | three independent systems |
| `--gx-label-landmark-grade` | semibold-equivalent time-cycle boundary labels, via `GRAD` | Carbon (§4.4), retargeted — `42-typography.md` §3 |

Note the halo row: **three independent systems all found they needed a text outline for labels over
marks**, and all three expose it. Nivo exposes it most granularly (width + colour + opacity as three
separate values); we should match Nivo there.

---

## 6. Proposed token namespace

### 6.0 The naming rule (so it survives a rename)

`gx` below is a **placeholder**. The project is unnamed. What follows is therefore a *rule*, and the
prefix is the only part that changes.

```
--<prefix>-<group>[-<element>]-<property>[-<modifier>]
```

| Segment | Constraint |
|---|---|
| `<prefix>` | 2–4 lowercase letters. **First segment only, and it never recurs anywhere else in a name.** |
| `<group>` | closed set: `surface`, `plot`, `widget`, `grid`, `axis`, `tick`, `label`, `line`, `area`, `bar`, `point`, `arc`, `legend`, `tooltip`, `crosshair`, `motion`, `series`, `ramp`, `size` |
| `<element>` | optional sub-part (`domain`, `minor`, `title`, `symbol`, `summary`, `link`) |
| `<property>` | the CSS property name where one exists (`color`, `opacity`, `stroke-width`, `font-size`, `radius`, `padding`, `gap`, `offset`, `length`, `angle`, `duration`, `count`, `dash`) |
| `<modifier>` | last, always: `-x`/`-y`, `-min`/`-max`, `-inner`/`-outer`, `-hover`/`-muted`/`-active`, `-1`…`-n` |

Rules: lowercase kebab; no abbreviations except ones CSS itself uses (`bg` is banned, `radius` is
fine because `border-radius` exists); dimensions carry their unit in the value (`2px`, never `2`)
because `calc()` requires it; ratios, counts and unitless multipliers are documented as such and
never given a unit.

**Why prefix at all — three verified precedents plus one hard constraint.**

| System | Prefix | Verified in |
|---|---|---|
| Highcharts | `--highcharts-neutral-color-10`, `--highcharts-background-color` | §2.1 |
| Carbon charts | `--cds-charts-font-family`; SCSS `$prefix: 'cds'` + `$charts-prefix: 'cc'` (two-level) | §2.2 |
| Adobe RSC | Vega signal names `rscChartSizeStrokeWidth`, `rscChartSizeFontSize` | §2.10.2 |

The hard constraint: **CSS custom properties are global and inherit.** An unprefixed
`--grid-color` in a consuming app's `:root` would silently retheme our charts. There is no scoping
mechanism; the prefix *is* the namespace.

**Why this survives a rename:**

1. The prefix is the first segment and appears nowhere else, so the rename is one regex:
   `s/--gx-/--<new>-/g`. No name in the tree below contains `gx` in any other position.
2. We author in TypeScript and generate CSS (§1.6), so the prefix is a single constant in the
   generator, not 300 string literals.
3. The generated `tokens.d.ts` should type names as a template literal
   `` type GxToken = `--${Prefix}-${TokenName}` ``, so the prefix change propagates through the type
   system and every consumer gets a compile error rather than a silent no-op.
4. Group names are chosen to be *English chart vocabulary*, not product vocabulary, so they never
   need to change with the product name.

### 6.1 Provenance tiers

Same three tiers as `raw/05-theory-responsive-viz.md` §"Tokens implied by the literature", so the two
documents can be merged without re-tiering:

- **Tier A** — the number is copied from a **verified primary source**.
- **Tier B** — ours, but *consistent with* published work (e.g. sits inside a range where the field
  disagrees, or is a straightforward derivation).
- **Tier C** — pure invention. May still be right; the docs must not imply a source.

**One honest caveat, and it must appear in the published docs.** In `05` every Tier A is a
*perception study*. In this document almost every Tier A is **shipped library source code** — a
convergent industry default, not evidence about human vision. Four libraries defaulting line stroke
to `2px` tells you what looks normal, not what is legible. I therefore split the label in the tables
below:

- **A-lit** — research literature or a W3C/CSS spec.
- **A-impl** — verified source of a shipped library. Where ≥3 independent libraries agree on the
  same value I note it, because convergence is the only extra evidence available.
- **B**, **C** — as above.

Where the field disagrees materially I give the spread rather than hiding it behind one number.

### 6.2 Canvas / surface

| Token | Default | Tier | Source |
|---|---|---|---|
| `--gx-surface-color` | `transparent` | A-impl ×3 | Nivo `background:'transparent'`; Spectrum `background: transparent`; Vega `style.view.fill:'transparent'` |
| `--gx-surface-text-color` | `#333` | A-impl | Nivo `text.fill:'#333333'` (Vega uses `#000`) |
| `--gx-plot-color` | `transparent` | A-impl | Vega `style.cell.fill:'transparent'` |
| `--gx-plot-border-color` | `#ddd` | A-impl | Vega `style.cell.stroke: lightGray` |
| `--gx-plot-border-width` | `0` | C | No library draws a plot frame by default; Carbon names a "graph frame" in its anatomy but ships no option |
| `--gx-plot-margin-top` | `20px` | A-impl | Plot `marginTop = 20` (`30` when the x-axis is top-anchored) |
| `--gx-plot-margin-right` / `-bottom` / `-left` | — | C | Plot computes these from axis extent; ours should too. Ship as `auto` with an override |
| `--gx-plot-extent-min` / `-max` | `0` / `200px` | A-impl | Vega `axis.minExtent: 0`, `maxExtent: 200` — reserve/cap the space an axis may claim |
| `--gx-plot-height-optimal` | `24px` | A-lit | Heer, Kong & Agrawala CHI 2009 (via `05`) |
| `--gx-plot-height-min-for-values` | `40px` | A-lit | Heer & Bostock CHI 2010 (via `05`) |
| `--gx-plot-height-saturation` | `80px` | A-lit | Heer & Bostock CHI 2010 (via `05`) |
| `--gx-widget-padding` | `16px` | A-lit | Apple HIG: "the standard margin width for widgets — 16 points for most widgets" |
| `--gx-widget-padding-tight` | `11px` | A-lit | Apple HIG: "setting margins of 11 points can work well" |
| `--gx-widget-radius` | `8px` | B | Spectrum `CORNER_RADIUS = 6`; Android OEM ceiling 16 dp. 8 sits between and is a common step |
| `--gx-widget-radius-inner` | `calc(var(--gx-widget-radius) - var(--gx-widget-padding))` | A-lit (mechanism) | Apple `ContainerRelativeShape` — "an inset version of the current container shape" |
| `--gx-widget-gap` | `16px` | C | No published source for a bento gutter (§4.5) |
| `--gx-widget-border-width` / `-color` | `0` / `currentColor` | C | ours |
| `--gx-widget-shadow` | `0 1px 2px rgb(0 0 0 / 0.25)` | A-impl | Nivo tooltip `boxShadow` (Carbon uses `0 1px 6px 0 rgba(0,0,0,0.2)`) |

Note `--gx-widget-radius` is expected to be **overridden by the host** — on Apple and Android the
platform owns the outer radius (§4.2, §4.3). Ours is a fallback for the web.

### 6.3 Grid + axis

**Grid**

| Token | Default | Tier | Source |
|---|---|---|---|
| `--gx-grid-x-visible` | `0` | A-impl ×2 | Highcharts `xAxis.gridLineWidth: null` (x off, y on); Nivo `enableGridX: false` |
| `--gx-grid-y-visible` | `1` | A-impl ×3 | Highcharts, Nivo `enableGridY: true`, ECharts `splitLine.show: true` |
| `--gx-grid-color` | `#ddd` | A-impl ×2 | Vega `gridColor: lightGray '#ddd'`; Nivo `'#dddddd'` (visx `'#eaf0f6'`) |
| `--gx-grid-width` | `1px` | A-impl ×5 | Vega, Nivo, visx, ECharts, Highcharts minor all `1` |
| `--gx-grid-opacity` | `0.2` | A-lit | Heer & Bostock 2010 (via `05`). **See caveat below** |
| `--gx-grid-dash` | `none` | A-impl ×2 | Highcharts `gridLineDashStyle: 'Solid'`; ECharts `type: 'solid'` |
| `--gx-grid-dash-offset` | `0` | A-impl | ECharts `dashOffset: 0` |
| `--gx-grid-cap` | `butt` | A-impl | ECharts `cap: 'butt'` |
| `--gx-grid-z` | `1` | A-impl | Highcharts `gridZIndex: 1` |
| `--gx-grid-min-spacing` | `8px` | A-lit | Heer & Bostock 2010: "gridlines be separated by at least 8 pixels" |
| `--gx-grid-minor-visible` | `0` | A-impl ×3 | amCharts `minorGridEnabled: false`; ECharts `minorSplitLine`/`minorTick.show: false`; Highcharts `minorTickWidth: 0` |
| `--gx-grid-minor-count` | `5` | A-impl ×2 | Highcharts `minorTicksPerMajor: 5`; ECharts `minorTick.splitNumber: 5` |
| `--gx-grid-minor-opacity` | `0.5` (relative to `--gx-grid-opacity`) | B | Highcharts minor uses `neutral-color-5` vs grid's `neutral-color-10` — exactly half. amCharts says minor grid "has a slightly `strokeOpacity` set by default" but does not give the number (**UNVERIFIED**) |
| `--gx-grid-band-color` | `transparent` | A-impl ×3 | Highcharts `alternateGridColor: null`; ECharts `splitArea.show: false`; amCharts axis fills disabled by default |

**Caveat on `--gx-grid-opacity`.** `#ddd` at `0.2` is nearly invisible. The two numbers come from
different sources solving the same problem twice: Vega/Nivo encode "faint" in the *colour*, Heer &
Bostock measured it as *alpha*. Ship **one** mechanism — recommend `--gx-grid-color: currentColor`
plus `--gx-grid-opacity: 0.2`, which is theme-independent and matches the research directly, and
document `#ddd` as the light-theme literal equivalent. Do not apply both.

**Axis line / domain**

| Token | Default | Tier | Source |
|---|---|---|---|
| `--gx-axis-x-domain-visible` | `1` | A-impl | Vega `axis.domain: true`; ECharts category axis `axisLine.show: true` |
| `--gx-axis-y-domain-visible` | `0` | A-impl ×3 | ECharts: "The **value** axis doesn't show the axis line by default since v5.0.0"; Spectrum `domain: false`; Nivo `domain.line.stroke: 'transparent'` |
| `--gx-axis-domain-width` | `1px` | A-impl ×3 | Vega `domainWidth: 1`; Highcharts `lineWidth: 1`; ECharts `axisLine.lineStyle.width: 1` (Spectrum 2, visx 2) |
| `--gx-axis-domain-color` | `#888` | A-impl | Vega `domainColor: gray '#888'` (ECharts `'#333'`) |
| `--gx-axis-domain-dash` / `-dash-offset` / `-cap` | `none` / `0` / `butt` | A-impl (property) / B (value) | Vega-Lite `domainDash`, `domainDashOffset`, `domainCap` — the only library with per-guide cap and phase |
| `--gx-axis-translate` | `0.5px` | C | Vega exposes `translate` (the crispness offset) and Highcharts has `crisp: true`, but **the default value is UNVERIFIED** — 0.5px is the standard half-pixel SVG correction |

Splitting `x`/`y` domain visibility is deliberate: three independent systems default the **value**
axis line off and the **category** axis line on, and a single `--gx-axis-domain-visible` cannot
express that.

**Ticks**

| Token | Default | Tier | Source |
|---|---|---|---|
| `--gx-tick-visible` | `1` | B | Field is split: Vega/ECharts-category/Highcharts `on`; Carbon (`g.tick line { display:none }`), Spectrum (`ticks: false`), amCharts (`visible` off) `off` |
| `--gx-tick-length` | `5px` | A-impl ×3 | Vega `tickSize: 5`, Nivo `tickSize: 5`, ECharts `axisTick.length: 5`. Spread across the field: **5–10** (Recharts 6, Plot 6, Spectrum 8, visx 8, Highcharts 10) |
| `--gx-tick-width` | `1px` | A-impl ×3 | Vega `tickWidth: 1`, ECharts, Spectrum `tickWidth: 1` |
| `--gx-tick-color` | `#888` | A-impl | Vega `tickColor: gray` (Spectrum `gray-300`, Nivo `#777`) |
| `--gx-tick-cap` | `butt` | B | Vega-Lite exposes `tickCap`; Spectrum sets `'round'`. `butt` is the SVG default |
| `--gx-tick-padding` | `6px` | B | **The field disagrees by 7.5×**: Vega 2, Recharts `tickMargin` 2, Nivo `tickPadding` 5, ECharts `axisLabel.margin` 8, Spectrum `labelPadding` 8, Highcharts `labels.distance` 15. 6 is the median |
| `--gx-tick-offset` | `0` | A-impl | Vega `tickOffset: 0` |
| `--gx-tick-offset-band` | `-0.5` | A-impl | Vega `axisBand.tickOffset: -0.5` — "correction for centering bias" |
| `--gx-tick-round` | `1` | A-impl ×2 | Vega `tickRound: true`; Spectrum `tickRound: true` |
| `--gx-tick-minor-length` | `3px` | A-impl | ECharts `minorTick.length: 3` (Highcharts `minorTickLength: 2`) |
| `--gx-tick-minor-width` | `0` | A-impl | Highcharts `minorTickWidth: 0` |
| `--gx-tick-spacing-x` | `100px` | A-lit + A-impl | Talbot, Lin & Hanrahan InfoVis 2010: "about 1 tick per 100 pixels"; **independently** Highcharts `tickPixelInterval: 100`. Plot uses 80 |
| `--gx-tick-spacing-y` | `35px` | A-impl | Plot `tickSpacing = k === "x" ? 80 : 35` — y labels are one line tall, x labels are many characters wide |
| `--gx-tick-count-min` | `2` | A-lit | Talbot 2010: "at least two labels (our lower bound)" |
| `--gx-tick-min-step` | `unset` | A-impl (property) | Vega-Lite `tickMinStep` — "the minimum desired step between axis ticks, in terms of scale domain values" |

The three-way convergence on pixel-density tick rules (Talbot's 100px, Highcharts'
`tickPixelInterval: 100`, Plot's `tickSpacing` 80/35, amCharts' `minGridDistance`) is the single
best-supported responsive rule in this whole document. **Express tick density in pixels, not counts.**

### 6.4 Marks

**Line**

| Token | Default | Tier | Source |
|---|---|---|---|
| `--gx-line-stroke-width` | `2px` | A-impl ×4 | Vega `defaultStrokeWidth = 2` / `line.strokeWidth: 2`; Highcharts `plotOptions.series.lineWidth: 2`; Nivo `lineWidth: 2`; Spectrum `BASE_STROKE_WIDTH = 2` |
| `--gx-line-stroke-width-muted` | `0.5px` | A-impl | Carbon: "re-style line segments to use 0.5px stroke and hide circles representing data points" (during an axis break) |
| `--gx-line-stroke-width-hover` | `calc(var(--gx-line-stroke-width) + 0.5px)` | A-impl | Spectrum `HOVER_STROKE_OFFSET = 0.5` |
| `--gx-line-cap` | `round` | A-impl | Highcharts `plotOptions.series.linecap: 'round'` |
| `--gx-line-join` | `round` | C | ECharts defaults `join: 'bevel'`; `round` is ours and disagrees with the only verified source — label it C |
| `--gx-line-miter-limit` | `10` | A-impl | ECharts `miterLimit: 10` (also the SVG default) |
| `--gx-line-dash` | `none` | A-impl ×2 | Highcharts `dashStyle: 'Solid'`; ECharts `type: 'solid'` |
| `--gx-line-dash-offset` | `0` | A-impl | ECharts `dashOffset: 0` |
| `--gx-line-dash-1` … `-6` | see note | A-impl (vocabulary) / **UNVERIFIED** (arrays) | Spectrum `DEFAULT_LINE_TYPES = ['solid','dashed','dotted','dotDash','longDash','twoDash']` — a *named* six-step dash ramp for redundant encoding. **The numeric dash arrays behind those names were not verified; do not ship invented arrays without checking.** |
| `--gx-line-crisp` | `1` | A-impl | Highcharts `crisp: true` |

**Area**

| Token | Default | Tier | Source |
|---|---|---|---|
| `--gx-area-opacity` | `0.2` | A-impl | Nivo `areaOpacity: 0.2`. **Spectrum uses `0.8`** — the gap is stacking: 0.2 assumes overlap, 0.8 assumes stacked/non-overlapping. Consider `--gx-area-opacity-stacked: 0.8` as a second token |
| `--gx-area-stroke-width` | `var(--gx-line-stroke-width)` | C | ours |

**Bar**

| Token | Default | Tier | Source |
|---|---|---|---|
| `--gx-bar-gap-inner` | `0.1` | A-impl | Highcharts `plotOptions.column.pointPadding: 0.1`. Field spread: Nivo `innerPadding: 0`, Recharts `barGap: 4px`, ECharts `barGap: '20%'` |
| `--gx-bar-gap-outer` | `0.2` | A-impl | Highcharts `groupPadding: 0.2`. Spread: Nivo `padding: 0.1`, Recharts `barCategoryGap: '10%'`, ECharts auto |
| `--gx-bar-cell-start` / `-cell-end` | `0` / `1` | A-impl (mechanism) / **UNVERIFIED** (defaults) | amCharts `cellStartLocation`/`cellEndLocation`; the docs' *example* is `0.2`/`0.8` = "60% of the actual cell", not a stated default. **A cleaner formulation than inner/outer** — two normalised positions inside the band that compose with any series count |
| `--gx-bar-radius` | `3px` | A-impl | Highcharts `column.borderRadius: 3`. Spread: Nivo `0`, Spectrum `CORNER_RADIUS = 6`, Recharts/ECharts accept a 4-tuple with no default |
| `--gx-bar-border-width` | `0` | A-impl ×2 | Nivo `borderWidth: 0`; Spectrum `rect.strokeWidth: 0`; ECharts `itemStyle.borderWidth = 0` |
| `--gx-bar-min-length` | `0` | A-impl ×2 | Highcharts `minPointLength: 0`; ECharts `barMinHeight: 0` |
| `--gx-bar-width-max` | `none` | A-impl ×3 | Highcharts `maxPointWidth: null`; ECharts `barMaxWidth: null`; Recharts `maxBarSize: undefined` |
| `--gx-bar-max-categories` | `24` | A-lit | Blascheck et al. InfoVis 2018 (via `05`) |

**Point**

| Token | Default | Tier | Source |
|---|---|---|---|
| `--gx-point-radius` | `4px` | A-impl ×3 | Highcharts `marker.radius: 4`; Carbon `scatterChart.points.radius: 4`; Vega `symbol.size: 64` (area) = r 4. Carbon's *line* points are 3, Nivo `pointSize: 6` (diameter) = r 3 |
| `--gx-point-radius-hover` | — | C | Spectrum scales point **area** by tier (`36/64/100`), not on hover |
| `--gx-point-stroke-width` | `0` | A-impl ×2 | Highcharts `marker.lineWidth: 0`; Nivo `pointBorderWidth: 0`. **Vega and Spectrum both use `2`** — the split is scatter (no stroke) vs line-with-markers (stroke to separate the dot from the line) |
| `--gx-point-stroke-color` | `var(--gx-surface-color)` | A-impl | Highcharts `marker.lineColor: var(--highcharts-background-color)` — stroke the marker in the *background* colour so it knocks out the line behind it. A verified idiom worth copying exactly |
| `--gx-point-shape` | `circle` | A-impl | Vega `legend.symbolType: 'circle'` |
| `--gx-point-shape-1` … `-8` | `circle, square, triangle-up, cross, diamond, triangle-right, triangle-down, triangle-left` | A-impl | Vega `config.range.symbol` — verbatim, in order |
| `--gx-point-auto-hide-threshold` | `2` | A-impl | Highcharts `marker.enabledThreshold: 2` — hide markers when the horizontal distance between the two closest points falls below N × `marker.radius`. A conceal rule shipped as a number |

**Arc (pie / donut / gauge)**

| Token | Default | Tier | Source |
|---|---|---|---|
| `--gx-arc-inner-radius` | `0` | A-impl ×2 | Highcharts `pie.innerSize: 0`; Nivo `innerRadius: 0` |
| `--gx-arc-pad-angle` | `0` | A-impl | Nivo `padAngle: 0` |
| `--gx-arc-radius` | `calc(min(100%, 100cqh) / 2 - 2px)` | A-impl | Spectrum `DONUT_RADIUS = '(min(width, height) / 2 - 2)'` — note the `- 2` inset |
| `--gx-arc-corner-radius` | `0` | A-impl | Nivo `cornerRadius: 0` |
| `--gx-arc-border-width` | `0` | A-impl | Nivo `borderWidth: 0` (Highcharts `pie.borderWidth: 1`) |
| `--gx-arc-start-angle` | `0` | A-impl ×2 | Nivo `startAngle: 0`; Highcharts `pie.startAngle: 0` |
| `--gx-arc-sliced-offset` | `10px` | A-impl | Highcharts `slicedOffset: 10` |
| `--gx-arc-label-distance` | `30px` | A-impl | Highcharts `pie.dataLabels.distance: 30` |
| `--gx-arc-label-radius-offset` | `0.5` | A-impl | Nivo `arcLabelsRadiusOffset: 0.5` |
| `--gx-arc-link-diagonal-length` | `16px` | A-impl | Nivo `arcLinkLabelsDiagonalLength: 16` |
| `--gx-arc-link-straight-length` | `24px` | A-impl | Nivo `arcLinkLabelsStraightLength: 24` |
| `--gx-arc-link-thickness` | `1px` | A-impl | Nivo `arcLinkLabelsThickness: 1` |
| `--gx-arc-link-text-offset` | `6px` | A-impl | Nivo `arcLinkLabelsTextOffset: 6` |
| `--gx-arc-label-min-angle` | `0.3rad` | A-impl | Spectrum `DONUT_SEGMENT_LABEL_MIN_ANGLE = 0.3` (≈17.2°) |
| `--gx-arc-label-callout-below` | `3deg` | A-impl | Carbon: "When the graphic translation of the data is less than 3 degrees, a callout is used" |
| `--gx-arc-min-render-angle` | `1deg` | A-impl | Carbon: "If the data translates as less than 1 degree, a slice will not be rendered" |
| `--gx-arc-summary-min-radius` | `45px` | A-impl | Spectrum `DONUT_SUMMARY_MIN_RADIUS = 45` |
| `--gx-arc-summary-font-size-ratio` | `0.35` | A-impl | Spectrum `DONUT_SUMMARY_FONT_SIZE_RATIO = 0.35` (of inner radius) |
| `--gx-arc-summary-font-size-min` / `-max` | `28px` / `60px` | A-impl | Spectrum `DONUT_SUMMARY_MIN/MAX_FONT_SIZE` |
| `--gx-arc-max-categories` | `7` | A-lit | Blascheck 2018 / While et al. CHI 2024, radial condition (via `05`) |

Note `--gx-arc-label-min-angle` (17.2°, Spectrum) and `--gx-arc-label-callout-below` (3°, Carbon)
are the *same mechanism at very different settings* — which is precisely the argument for a token
rather than a constant.

The **ratio + min + max triple** (`--gx-arc-summary-font-size-*`) is the general idiom for anything
size-derived, and it needs no JS:

```css
font-size: clamp(
  var(--gx-arc-summary-font-size-min),
  calc(var(--gx-arc-radius) * var(--gx-arc-summary-font-size-ratio)),
  var(--gx-arc-summary-font-size-max)
);
```

### 6.5 Labels

| Token | Default | Tier | Source |
|---|---|---|---|
| `--gx-label-font-size` | `11px` | B | Field spread **10–14**: Vega `guide-label` 10 and Plot 10; Nivo `text.fontSize` 11 and Vega `text` mark 11; Spectrum 14 |
| `--gx-label-font-size-min` | `10px` | C | No system publishes a legibility floor. Talbot's 5 pt is a *search-space bound*, not a floor (see `05`). Ours: conceal below this, never shrink past it |
| `--gx-label-color` | `#888` | B | Carbon `$text-secondary`; Highcharts `var(--highcharts-neutral-color-60)`; Nivo `#333` |
| `--gx-label-angle` | `0` | A-impl ×4 | Vega `labelAngle: 0`; Highcharts, Nivo `tickRotation: 0`, ECharts `rotate: 0`, Recharts `angle: 0` |
| `--gx-label-offset` | `0` | A-impl | Vega `axis.labelOffset: 0` |
| `--gx-label-limit` | `180px` | A-impl | Vega `axis.labelLimit: 180` (legend 160; Spectrum 184) |
| `--gx-label-overflow` | `ellipsis` | A-impl | Highcharts `labels.textOverflow: 'ellipsis'` |
| `--gx-label-overlap` | `greedy` | B | Vega/Spectrum default `labelOverlap: true`; Vega-Lite's named policies are `"parity"` (drop every other) and `"greedy"` (scan and drop). `greedy` degrades more evenly on non-uniform labels |
| `--gx-label-separation` | `1.5em` | A-lit | Talbot 2010: "We begin penalizing labels if they are closer than 1.5em apart and we forbid overlapping labels" |
| `--gx-label-rotate-limit` | `80deg` | A-impl | Highcharts `labels.autoRotationLimit: 80` |
| `--gx-label-stagger-lines` / `-stagger-max` | `0` / `5` | A-impl | Highcharts `staggerLines: 0`, `maxStaggerLines: 5` |
| `--gx-label-step` | `0` | A-impl | Highcharts `labels.step: 0` (tick-dropping stride) |
| `--gx-label-landmark-grade` | `150` | B | ⚠ **Superseded `--gx-label-landmark-weight: 600` (A-impl, Carbon).** `wght` changes glyph advance widths and would silently widen the two labels with the tightest collision budget; `GRAD` verifiably does not. Clamped to Roboto Flex's verified `GRAD` ceiling of +150 (≈ weight 550), below Carbon's +200. `42-typography.md` §3 |
| `--gx-label-degrade-order` | `abbreviate split rotate transpose` | B | Talbot 2010 supplies the first three ("rotation … a last resort"); `transpose` is ours (via `05`) |
| `--gx-axis-title-font-size` / `-font-weight` | **`12px`** / `700` | **B** / A-impl | ⚠ **Size changed from Vega's 11px and demoted from A-impl.** At 11px it tied with `--gx-label-font-size: 11px`, making `DESIGN.md:123`'s ordering (`axis label ≤ legend < axis title`) unsatisfiable for *any* legend value. Vega's own scale keeps the gap open at `guide-label: 10`; taking the label to 11 (tier B) closed it. Weight unchanged: Vega `guide-title: { fontWeight: 'bold' }`. `42-typography.md` §2 |
| `--gx-legend-label-font-size` / `-font-weight` | `11px` / `500` | B / B | Was referenced (§ inventory) but never specified. Set to rank D's size, separated from it by weight — a legend has its own region and needs no size to distinguish it. `42-typography.md` §2.1 |
| `--gx-axis-title-padding` | `4px` | A-impl | Vega `axis.titlePadding: 4` (Spectrum 16) |
| `--gx-title-font-size` / `-font-weight` | `13px` / `700` | A-impl | Vega `group-title: { fontSize: 13, fontWeight: 'bold' }` (Spectrum 18) |
| `--gx-title-offset` | `4px` | A-impl | Vega `title.offset: 4` (Spectrum 10) |
| `--gx-subtitle-font-size` | `12px` | A-impl | Vega `group-subtitle: { fontSize: 12 }` |
| `--gx-subtitle-padding` | `3px` | A-impl | Vega `title.subtitlePadding: 3` |
| `--gx-value-label-font-size` | `10px` | B | Highcharts `dataLabels.style.fontSize: '0.7em'` — deliberately *smaller* than the legend's `0.8em` |
| `--gx-value-label-font-weight` | `700` | A-impl ×2 | Highcharts `dataLabels.style.fontWeight: 'bold'`; Spectrum `DIRECT_LABEL_FONT_WEIGHT = 700` |
| `--gx-value-label-offset` | `4px` | A-impl | Highcharts `plotOptions.series.dataLabels.distance: 4` |
| `--gx-value-label-radius` | `3px` | A-impl | Highcharts `dataLabels.borderRadius: 3` |
| `--gx-value-label-halo-width` | `2px` | B | Spread **1–4**: Highcharts `textOutline: '1px contrast'`, Nivo `annotations.text.outlineWidth: 2`, Spectrum `DIRECT_LABEL_BACKGROUND_STROKE_WIDTH = 4` |
| `--gx-value-label-halo-color` | `var(--gx-surface-color)` | B | Nivo `outlineColor: '#ffffff'`; Highcharts `'contrast'` (computed) |
| `--gx-value-label-halo-opacity` | `1` | A-impl | Nivo `outlineOpacity: 1` |
| `--gx-value-label-skip-width` / `-skip-height` | `0` | A-impl | Nivo `labelSkipWidth: 0`, `labelSkipHeight: 0` — hide the value label when the bar is narrower/shorter than N px. Direct prior art for the ladder's Conceal step |

Typography tokens (`--gx-font-family`, `--gx-numeric-variant`, `--gx-font-optical-sizing`, …) are in
**§5.5**; colour tokens (`--gx-series-*`, `--gx-ramp-*`, `--gx-alert-*`) are in **§3.7**. Not repeated
here.

### 6.6 Legend

| Token | Default | Tier | Source |
|---|---|---|---|
| `--gx-legend-orient` | `right` | A-impl | Vega `legend.orient: 'right'` |
| `--gx-legend-padding` | `0` | A-impl | Vega `legend.padding: 0` (Highcharts 8) |
| `--gx-legend-offset` | `18px` | A-impl | Vega `legend.layout.offset: 18` (Spectrum 24) |
| `--gx-legend-gap-column` | `10px` | A-impl ×3 | Vega `columnPadding: 10`; ECharts `legend.itemGap = 10`; Recharts hard-codes `marginRight: 10` inline. Spectrum uses 20 |
| `--gx-legend-gap-row` | `2px` | A-impl ×2 | Vega `rowPadding: 2`; Highcharts `itemMarginTop/Bottom: 2` (Spectrum 8) |
| `--gx-legend-symbol-size` | `14px` | B | Spread: Vega `symbolSize: 100` (area, √ ≈ 10), Recharts `iconSize: 14`, ECharts `itemHeight: 14` / `itemWidth: 25`, Spectrum `DEFAULT_LEGEND_SYMBOL_WIDTH: 16` |
| `--gx-legend-symbol-gap` | `5px` | A-impl | Highcharts `symbolPadding: 5` (Nivo chip `marginRight: 7`; Recharts hard-codes 4) |
| `--gx-legend-symbol-stroke-width` | `1.5px` | A-impl | Vega `symbolStrokeWidth: 1.5` |
| `--gx-legend-symbol-shape` | `circle` | A-impl | Vega `symbolType: 'circle'` (Spectrum uses a custom `ROUNDED_SQUARE_PATH`) |
| `--gx-legend-label-offset` | `4px` | A-impl | Vega `legend.labelOffset: 4` |
| `--gx-legend-label-limit` | `160px` | A-impl | Vega `legend.labelLimit: 160` (Spectrum 184) |
| `--gx-legend-symbol-limit` | `30` | A-impl | Vega `legend.symbolLimit: 30` |
| `--gx-legend-title-padding` | `5px` | A-impl | Vega `legend.titlePadding: 5` (Spectrum 8) |
| `--gx-legend-title-limit` | `180px` | A-impl | Vega `legend.titleLimit: 180` |
| `--gx-legend-gradient-length` | `200px` | A-impl | Vega `gradientLength: 200` |
| `--gx-legend-gradient-thickness` | `16px` | A-impl | Vega `gradientThickness: 16` |
| `--gx-legend-gradient-label-offset` | `2px` | A-impl | Vega `gradientLabelOffset: 2` |
| `--gx-legend-gradient-stroke-width` / `-stroke-color` | `0` / `#ddd` | A-impl | Vega `gradientStrokeWidth: 0`, `gradientStrokeColor: lightGray` |
| `--gx-legend-max-entries` | `8` | C | **UNVERIFIED** (via `05`) — no published number for legend capacity exists. Must not be presented as a threshold |

### 6.7 Tooltip / crosshair

| Token | Default | Tier | Source |
|---|---|---|---|
| `--gx-tooltip-color` | `#fff` | A-impl | Nivo `tooltip.container.background: 'white'` |
| `--gx-tooltip-radius` | `4px` | B | Nivo `'2px'`; Highcharts `borderRadius: 5` |
| `--gx-tooltip-padding` | `8px` | A-impl | Highcharts `tooltip.padding: 8` (Nivo `'5px 9px'`) |
| `--gx-tooltip-shadow` | `0 1px 2px rgb(0 0 0 / 0.25)` | A-impl | Nivo `boxShadow` (Carbon: `0 1px 6px 0 rgba(0,0,0,0.2)`) |
| `--gx-tooltip-offset` | `16px` | A-impl | Highcharts `tooltip.distance: 16` |
| `--gx-tooltip-header-gap` | `5px` | A-impl | Highcharts `tooltip.header.distance: 5` |
| `--gx-tooltip-row-padding` | `3px 5px` | A-impl | Nivo `tableCell.padding` |
| `--gx-tooltip-chip-gap` | `7px` | A-impl | Nivo `tooltip.chip.marginRight: 7` |
| `--gx-tooltip-delay` | `350ms` | A-impl | Spectrum `TOOLTIP_DELAY = 350` |
| `--gx-tooltip-hide-delay` | `500ms` | A-impl | Highcharts `hideDelay: 500` |
| `--gx-tooltip-snap` | `10px` | A-impl | Highcharts `tooltip.snap` — values `10` and `25`; **which is mouse and which is touch is UNVERIFIED**. Ship the larger as `--gx-tooltip-snap-coarse` under `@media (pointer: coarse)` |
| `--gx-crosshair-width` | `1px` | A-impl ×2 | Highcharts `crosshair.width: 1`; Nivo `crosshair.line.strokeWidth: 1` |
| `--gx-crosshair-color` | `#ccc` | A-impl | Highcharts `crosshair.color: '#cccccc'` (Nivo `#000` at 0.75 opacity) |
| `--gx-crosshair-opacity` | `0.75` | A-impl | Nivo `crosshair.line.strokeOpacity: 0.75` |
| `--gx-crosshair-dash` | `6 6` | A-impl | Nivo `strokeDasharray: '6 6'`. **Highcharts defaults `dashStyle: 'Solid'`** — the field disagrees; dashed reads better over dense marks |
| `--gx-crosshair-z` | `2` | A-impl | Highcharts `crosshair.zIndex: 2` (above grid's 1) |
| `--gx-crosshair-label-radius` | `3px` | A-impl | Highcharts `crosshair.label.borderRadius: 3` |
| `--gx-crosshair-label-padding` | `8px` | A-impl | Highcharts `crosshair.label.padding: 8` |
| `--gx-crosshair-label-font-size` | `11px` | A-impl | Highcharts `crosshair.label.style.fontSize: '11px'` |

### 6.8 Motion

| Token | Default | Tier | Source |
|---|---|---|---|
| `--gx-motion-duration` | `1000ms` | A-lit + A-impl | Heer & Robertson InfoVis 2007 (~1 s, via `05`); **independently** Spectrum `DRAW_IN_ANIMATION_DURATION_MS = 1000`. Research and shipped code agree exactly |
| `--gx-motion-duration-hover` | `100ms` | A-impl | Spectrum `ANIMATION_HOVER_SPEED = 100` |
| `--gx-motion-throttle` | `33ms` | A-impl | Spectrum `ANIMATION_THROTTLE = 33` ("~30fps") |
| `--gx-motion-stages-max` | `2` | B | Heer & Robertson's staging result (via `05`): stage axis change, then mark change; "do not exceed two stages" |
| `--gx-motion-fade-factor` | `0.2` | A-impl | Spectrum `FADE_FACTOR = 0.2` (de-emphasised series opacity) |
| `--gx-motion-hover-neutral` | `0.5` | A-impl | Spectrum `HOVER_NEUTRAL_TARGET = 0.5` |
| `--gx-motion-easing` | — | C | **UNVERIFIED.** No source read publishes an easing curve for chart transitions. Nivo ships a named `motionConfig: 'gentle'` (a react-spring preset) but the curve was not verified |

`prefers-reduced-motion: reduce` must zero `--gx-motion-duration` in the stylesheet, not in JS.
Note the consequence for `05`'s hysteresis argument: if animation is the flicker mitigation, then
disabling animation for accessibility *removes* the mitigation — so the spatial deadband cannot be
dropped entirely.

### 6.9 Responsive-threshold tokens (carried from `raw/05`)

These already have tiers assigned in `05`. Renamed onto the prefix rule; **tiers unchanged**. Listed
here only so the namespace is complete — `05` remains the authority on the values.

| `05` name | `--gx-*` name | Value | Tier (from `05`) |
|---|---|---|---|
| `--chart-gridline-min-spacing` | `--gx-grid-min-spacing` | 8px | A |
| `--chart-gridline-alpha` | `--gx-grid-opacity` | 0.2 | A |
| `--chart-label-min-spacing` | `--gx-label-separation` | 1.5em | A |
| `--chart-ticks-min` | `--gx-tick-count-min` | 2 | A |
| `--chart-tick-target-spacing` | `--gx-tick-spacing-x` | 100px | A |
| `--chart-axis-min-length` | `--gx-axis-length-min` | 30px | A |
| `--chart-domain-max-whitespace` | `--gx-scale-max-whitespace` | 20% | A |
| `--chart-font-size-min` | `--gx-label-font-size-search-min` | 5pt | A (**search bound, not a legibility floor**) |
| `--chart-plot-height-optimal` | `--gx-plot-height-optimal` | 24px | A |
| `--chart-plot-height-min-for-values` | `--gx-plot-height-min-for-values` | 40px | A |
| `--chart-plot-height-saturation` | `--gx-plot-height-saturation` | 80px | A |
| `--chart-horizon-min-height` | `--gx-horizon-height-min` | 6px | A |
| `--chart-horizon-max-bands` | `--gx-horizon-bands-max` | 3 | A |
| `--chart-categories-max-legible` | `--gx-bar-max-categories` | 24 | A |
| `--chart-categories-max-radial` | `--gx-arc-max-categories` | 7 | A |
| `--chart-transition-duration` | `--gx-motion-duration` | 1000ms | A |
| `--chart-label-degrade-order` | `--gx-label-degrade-order` | abbreviate→split→rotate→transpose | B |
| `--chart-ticks-max` | *(recommend removing)* | — | B |
| `--chart-aggregate-after` | `--gx-aggregate-after` | 8 | B |
| `--chart-substitute-below-height` | `--gx-substitute-height` | 24px | B |
| `--chart-tick-spacing` divisor | `--gx-tick-spacing-x` | 90 → **use 100** | C |
| `--chart-transpose-after-categories` | `--gx-transpose-after-categories` | 10 | C |
| `--chart-aggregate-min-slice` | `--gx-arc-aggregate-min-share` | 2% | C |
| `--chart-donut-reflow-aspect` | `--gx-arc-reflow-aspect` | 1.4 | C |
| `--chart-heatmap-min-cell` | `--gx-heatmap-cell-min` | 8px | C |
| `--chart-point-budget` | `--gx-point-budget` | 2000 | C (**rendering, not perception**) |
| `--chart-legend-max-entries` | `--gx-legend-max-entries` | 8 | C |
| `--chart-bar-min-width`, `-min-gap`, `--chart-point-min-separation`, `--chart-stroke-min-width` | `--gx-bar-width-min`, `--gx-bar-gap-min`, `--gx-point-separation-min`, `--gx-stroke-width-min` | — | C (no published values) |
| `--chart-hysteresis-deadband` | `--gx-size-hysteresis` | 8px | C |

Two additions from *this* document that belong in the same family:

| Token | Value | Tier | Source |
|---|---|---|---|
| `--gx-tick-spacing-y` | `35px` | A-impl | Plot `tickSpacing = k === "x" ? 80 : 35` — `05` has no y-specific value |
| `--gx-scale-ratio-s` / `-m` / `-l` | `0.75` / `1` / `1.25` | A-impl ×2 | Spectrum `CHART_SIZE_SCALE_RATIOS`; **independently** Apple visionOS: "people can scale a widget from 75 to 125 percent in size" |
| `--gx-size-breakpoint-m` / `-l` | `400px` / `800px` | A-impl | Spectrum `CHART_SIZE_BREAKPOINTS = { M: 400, L: 800 }`; Carbon independently uses **400** as its reference dimension in `radiusRange` / `fontSizeRange` |

**Deliberate divergence to record.** Spectrum scales stroke width *down* at small sizes
(`S: 0.75` → 1.5px). The Color Universal Design guidance says the opposite — "Make texts and objects
as thick or big as possible… thin lines and small symbols" (§3.5) — and CSS optical sizing does the
opposite too ("small text sizes are often rendered with thicker strokes", §5.1). We should **not**
inherit Spectrum's down-scale for strokes. Recommend `--gx-scale-ratio-s` applies to *gaps and
paddings* but stroke width holds or increases at small sizes. That is a Tier B choice with a Tier A
rationale on both sides — document the disagreement rather than picking silently.

### 6.10 Count and shape

Roughly **190 tokens** across the ten groups, of which the geometry ones (~130) are the actual
product. Delivered as `:root` defaults plus `[data-gx-theme]` overrides, generated from typed TS
(§1.6) into `tokens.css` + `tokens.d.ts` + a DTCG `tokens.json`. Note that a good share of the tree
is **`var()` chains, not literals** — `--gx-area-stroke-width: var(--gx-line-stroke-width)`,
`--gx-point-stroke-color: var(--gx-surface-color)`, `--gx-widget-radius-inner: calc(...)` — which is
exactly what Style Dictionary's `outputReferences` / `outputReferenceFallbacks` preserve (§1.6).
Flattening those to literals would destroy the coherence the token tree exists to provide.

---

## 7. Granularity comparison

### 7.1 The table

Legend: **●** exposed as a first-class, named, documented option · **◐** reachable but not
first-class (SVG prop pass-through, a theme-object leaf, or a constant that isn't a public prop) ·
**○** not exposed · **?** could not be verified — treated as unknown, **not** as absent.

Sources are §2.1–§2.10 of this document. Every ● and every default in the notes was read from
primary source (option tree, repo source, or official docs), not from secondary write-ups.

| Knob | Highcharts | amCharts 5 | ECharts | Vega-Lite | Recharts | Nivo | visx | Plot | Carbon | Spectrum |
|---|---|---|---|---|---|---|---|---|---|---|
| Line stroke width | ● `2` | ◐ ? | ● | ● `2` | ● | ● `2` | ● | ● `1` | **○** hard-coded `1.5` in SCSS | ● `2` + size tiers |
| Dash pattern | ● `dashStyle` named | ? | ● `type` named *or* array | ● `strokeDash` | ● | ◐ ? | ● | ● | ○ (only on threshold lines) | ● named vocabulary, **encodable** |
| Dash offset (phase) | ○ | ? | ● `dashOffset: 0` | ● per guide element | ◐ | ◐ | ◐ | ● `strokeDashoffset` | ○ | ○ |
| Stroke linecap / linejoin | ● `linecap: round` | ? | ● `cap`/`join`/`miterLimit` | ● `domainCap`/`gridCap`/`tickCap` | ◐ | ◐ | ◐ | ● | ○ | ● `tickCap: round` |
| Gridline colour | ● | ● | ● | ● | ● | ● | ● `#eaf0f6` | ● | ◐ theme token only | ● |
| Gridline width | ● | ● | ● `1` | ● `1` | ● | ● `1` | ● `1` | ● | **○** hard-coded `1px` | ◐ via Vega config |
| Gridline dash | ● | ? | ● | ● `gridDash` | ● | ◐ ? | ● | ● | ○ | ○ |
| Minor grid / minor ticks | ● full sub-tree | ● `minorGridEnabled` + tags | ● `minorTick`/`minorSplitLine` | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| Grid banding | ● `alternateGridColor` | ● axis fills + `fillRule` | ● `splitArea` | ○ | ● `horizontalFill` | ○ | ○ | ○ | ○ | ○ |
| Tick count | ● `tickAmount` | ○ | ● `splitNumber`/`interval` | ● `tickCount` + `tickMinStep` | ● `tickCount: 5` | ● `tickValues` | ● `numTicks: 10` | ● `ticks` | ● `numberOfTicks` 15/5 | ◐ |
| Tick **density** (px) | ● `tickPixelInterval: 100` | ● `minGridDistance` | ◐ `hideOverlap` only | ○ | ● `minTickGap: 5` | ○ | ○ | ● `tickSpacing` 80/35 | ○ | ○ |
| Tick size (length) | ● `10` | ? | ● `5` | ● `5` | ● `6` | ● `5` | ● `8` | ● `6`/`0` | **○** ticks hidden entirely | ● `8` |
| Tick padding | ● `distance: 15` | ◐ | ● `margin: 8` | ● `labelPadding: 2` | ● `tickMargin: 2` | ● `tickPadding: 5` | ◐ via `tickLabelProps` | ● `tickPadding` | ○ | ● `labelPadding: 8` |
| Bar padding **inner** | ● `pointPadding: 0.1` | ● `cellStart/EndLocation` | ● `barGap: '20%'` | ● `paddingInner` | ● `barGap: 4` | ● `innerPadding: 0` | ○ (your own d3 scale) | ◐ ? | ○ | ○ (constants only) |
| Bar padding **outer** | ● `groupPadding: 0.2` | ● same | ● `barCategoryGap` (auto, series-count-aware) | ● `paddingOuter` | ● `barCategoryGap: '10%'` | ● `padding: 0.1` | ○ | ◐ ? | ○ | ○ (constants only) |
| Bar corner radius | ● `3` | ? | ● number or 4-tuple | ◐ ? | ● number or 4-tuple | ● `0` | ◐ `rx` on your rect | ◐ ? | ○ | ◐ `CORNER_RADIUS = 6` |
| Bar min length / max width | ● `minPointLength`/`maxPointWidth` | ? | ● `barMinHeight`/`barMaxWidth` | ○ | ● `minPointSize`/`maxBarSize` | ○ | ○ | ○ | ○ | ○ |
| Point size | ● `radius: 4` | ◐ ? | ◐ `symbolSize` ? | ● `size` | ◐ pass-through | ● `pointSize: 6` | ○ | ◐ `r` channel | ● `radius` 4/3 | ● `size: 100` + tiers |
| Point stroke (width + colour) | ● `lineWidth: 0` + `lineColor: var(--bg)` | ◐ | ◐ ? | ● | ◐ | ● `pointBorderWidth/Color` | ○ | ● | ○ (fill only) | ● `strokeWidth: 2` |
| Point auto-hide on density | ● `enabledThreshold: 2` | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| Label offset | ● `x`/`y`/`distance` | ● `centerX/Y`, `location`, `min/maxPosition` | ● `margin`, `rotate` | ● `labelOffset`, `titleX/Y` | ● `tickMargin` | ◐ (`legendOffset` for axis titles) | ● `labelOffset` | ● `labelOffset`, `dx`/`dy` | ○ | ● `labelPadding` + annotation offsets |
| Label overlap policy | ● `allowOverlap`, `step`, `staggerLines`, `autoRotation` | ● `min/maxPosition` | ● `hideOverlap`, `interval` | ● `labelOverlap` (`parity`/`greedy`) + `labelSeparation` | ● `interval` strategies | ○ | ○ | ○ | ○ | ● `labelOverlap: true` |
| Label halo / outline | ● `textOutline: '1px contrast'` | ? | ? | ○ ? | ◐ | ● `outlineWidth` + `-Color` + `-Opacity` | ○ | ○ ? | ○ | ◐ constant `4` |
| Value-label conceal by size | ○ | ○ | ○ | ○ | ○ | ● `labelSkipWidth`/`labelSkipHeight` | ○ | ○ | ○ | ● donut `MIN_ANGLE`/`MIN_RADIUS` |
| Legend item gap | ● `itemDistance` (default `null`; **exact value UNVERIFIED**) + `itemMarginTop/Bottom: 2` + `symbolPadding: 5` | ? | ● `itemGap: 10`, `itemWidth: 25`, `itemHeight: 14` | ● `columnPadding: 10`, `rowPadding: 2` | **○ hard-coded** inline `marginRight: 10` / `4` | ◐ ? | ? | **○** (no legend gap knob) | ○ | ● `columnPadding: 20`, `rowPadding: 8` |
| Axis line visibility | ● `lineWidth: 0` | ● `strokeOpacity` | ● `axisLine.show` (value axis off since v5) | ● `domain` | ● `axisLine` | ● `stroke: 'transparent'` | ● `hideAxisLine` | ◐ ? | ○ | ● `domain: false` |
| Domain line style | ● colour + width | ● stroke/width/opacity | ● full `lineStyle` + arrowhead symbols | ● colour/width/dash/dashOffset/opacity/**cap** | ◐ SVG props | ● stroke/strokeWidth | ● + `strokeDasharray` | ● + `strokeOpacity`/`linecap` | ◐ colour token only | ● `domainWidth: 2` |
| Crosshair style | ● colour/dash/width/snap/z + full label object | ? | ◐ `axisPointer` (defaults unverified) | ◐ rule mark + selection | ◐ `Tooltip.cursor` | ● stroke/width/opacity/**dash `6 6`** + `crosshairType` | ◐ ? | **○** no tooltip/crosshair at all | ◐ `$tooltip-line-border` token | ? |
| Geometry that changes with chart size | ◐ `responsive.rules` patches arbitrary options | ○ | ○ | ○ | ○ | ◐ `labelSkip*` only | ○ | ◐ `tickSpacing` only | ● `radiusRange`, `fontSizeRange`, donut `numberFontSize` as functions of chart box | ● explicit S/M/L tiers as reactive signals |
| Theming via **CSS custom properties** | ◐ colours only, as `var()` defaults | ○ | ○ | ○ | ○ | ○ (JS theme object prop) | ○ | ○ | ◐ exactly two (`--cds-charts-font-family`, `-condensed`) | ○ |

**Unverified cells, stated explicitly** (do not read `?` as "missing"): amCharts `strokeDasharray`,
`AxisTick.length`, label halo, bar corner radius, legend gap and crosshair — none appear on the axes
documentation page I read, and amCharts' template model means they very likely *do* exist as
`Graphics` properties. ECharts series `symbolSize` and `axisPointer` defaults were not read.
Vega-Lite `cornerRadius` was not read from source. Plot's band-scale padding, `r` channel default,
domain-line default and text-halo support were not read from source. Highcharts `legend.itemDistance`
resolves to `null` in the tree with the effective horizontal value undocumented there.

### 7.2 Honest read

**Where we would genuinely exceed the field.**

1. **Delivery mechanism.** No library in the survey exposes chart *geometry* through CSS custom
   properties. Highcharts is the closest and it is **colours only** — `gridLineColor` defaults to
   `var(--highcharts-neutral-color-10)`, but `tickLength` is a plain `10`. Carbon ships exactly two
   chart custom properties, both font families. Everyone else is a JS options object (Highcharts,
   ECharts, amCharts, Vega-Lite), a JS theme prop (Nivo, visx `xychart`, Spectrum) or per-element
   props (Recharts, visx, Plot). Consequence: **nobody can retheme one widget on a dashboard from a
   stylesheet, or theme charts from a design system's existing CSS layer, or do it without
   re-rendering.** That is a real, defensible, structural difference — and it is about *reach*, not
   about knob count.
2. **Information content changing with size.** Only two libraries do anything here. Carbon computes
   a few radii and font sizes as functions of the chart box. Spectrum has explicit S/M/L tiers
   delivered as reactive Vega signals. **Both only rescale.** Neither reveals, conceals, relabels,
   aggregates, substitutes or transposes. Nivo's `labelSkipWidth`/`labelSkipHeight`, Highcharts'
   `marker.enabledThreshold` and Spectrum's donut `MIN_ANGLE`/`MIN_RADIUS` are the only conceal
   rules found anywhere, and each is a single hard-coded special case. The systematic version does
   not exist in any of the ten.
3. **Two rows where the whole field is weak.** *Legend item gap*: Recharts hard-codes it inline,
   Plot has no knob, Carbon doesn't expose it — only Vega-Lite/ECharts/Spectrum/Highcharts do, and
   Highcharts' effective default isn't even documented. *Label halo*: only Nivo exposes it properly
   (width + colour + opacity); Highcharts has a single compound string; Spectrum has a private
   constant. Both are cheap wins.
4. **Assembling the best-of set.** No single library has all of: dash **phase** per guide element
   (Vega-Lite only), stroke **cap** per guide element (Vega-Lite only), pixel-density tick spacing
   with *separate x and y* values (Plot only), point auto-hide on density (Highcharts only),
   band-cell start/end positions (amCharts only), series-count-aware bar gaps (ECharts only),
   size-tiered stroke/point/gap (Spectrum only), three-part label halo (Nivo only). Collecting all
   eight in one coherent namespace is genuinely novel — but note this is *curation*, not invention.

**Where we would merely match — and must not claim otherwise.**

- Line stroke width, gridline colour/width, tick length, tick padding, bar inner/outer padding, bar
  corner radius, point size, point stroke, label offset, axis-line visibility, domain-line style.
  **Six to ten of the ten libraries expose each of these.** These are table stakes. Our version is
  better delivered, not more granular.
- On raw knob count we do **not** beat Highcharts. Its option tree is the largest surface in the
  industry and it has things we have not designed at all (`autoRotation` angle arrays, stagger
  lines, `alternateGridColor`, `showFirstLabel`/`showLastLabel`, a full minor-tick sub-tree, per-axis
  `minPadding`/`maxPadding`, `startOnTick`/`endOnTick`).
- On *guide* API richness we do not beat Vega-Lite either: 70 documented axis properties, including
  `labelFlush`/`labelFlushOffset`, `labelBound`, `tickBand`, `tickExtra`, `minExtent`/`maxExtent`
  and `translate`. The honest framing is that Vega-Lite has the best axis API in open source and we
  should copy most of it.
- Colour is well solved by Carbon and Spectrum already (§3). We add structure (slot tokens, length
  variants, redundant-encoding ramps as tokens) but not new palettes.

**The claim that survives scrutiny**, then, is not "more knobs than anyone". It is:
*every knob the best libraries expose, in one namespace, reachable from CSS, per widget, without
JavaScript — plus a size ladder that changes what the chart says, not just how big it is.*
Three of those four clauses are novel. The knob count is not.
