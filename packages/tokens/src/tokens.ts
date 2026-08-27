/**
 * The token tree, as typed data. **This file is the source; `themes/theme.css` is output.**
 *
 * `research/30-implementation-plan.md` §B1: *"Author in TypeScript, generate CSS."* The
 * direction is not a preference, and the reason is one field — `tier`.
 *
 * ⚠ **A provenance tier cannot live in CSS.** B3 requires that *"each token ships with its
 * provenance tier"*, and CSS gives a value exactly one slot. Written as a comment a tier is
 * prose: nothing reads it, nothing counts it, nothing fails when it is wrong. Found live
 * while transcribing this file — `themes/theme.css:79` carried *"the alpha keeps its A-lit
 * provenance (Talbot)"*, but `research/10-responsive-ladder.md:373` attributes
 * `grid-opacity: 0.2` to **Heer & Bostock 2010**; Talbot 2010 is the *tick-spacing* work and
 * has nothing to say about gridline alpha. The wrong citation sat in the file for the whole of
 * milestone A and no gate could see it, because a comment is not a field. Below it is a field.
 *
 * ## What this file is NOT allowed to do
 *
 * ⚠ **No `var()` chain may be flattened.** `--shiftcharts-surface-text-color: var(--shiftcharts-ramp-neutral-9)` and
 * `--shiftcharts-motion-stage-delay: var(--shiftcharts-motion-stage-delay-rescale)` are *indirections on
 * purpose* — the whole re-theming mechanism is re-pointing one of them. `raw/06` §6.10 warns
 * that much of the tree is `var()` chains rather than literals and that flattening them
 * silently deletes the mechanism. Values here are opaque strings copied through verbatim, so
 * the generator structurally cannot resolve one.
 *
 * ⚠ **The names are no longer free, and a gate says so.** `raw/06` §6.0 fixes the naming rule
 * as `--<prefix>-<group>[-<element>]-<property>[-<modifier>]` over a closed `<group>` set. Slice
 * 1 deliberately left seven names disobeying it — `ground`, `ink`, `charcoal-*`, `band-alpha`,
 * `gap`, `corner-radius`, `elevation-*` — because renaming in the same commit that reversed the
 * source-of-truth direction would have made the reversal unreviewable. **Slice 2 renamed all
 * 24 and added G7's `token-name` rule**, so a new token that does not obey the grammar now
 * fails `pnpm lint:tokens` rather than passing review. The vocabulary the rule enforces lives
 * in `scripts/check-tokens.mjs` as `TOKEN_GROUPS`, and it is not §6.0's published list — see
 * the ⚠ there for why a literal copy would reject `raw/06`'s own specified names.
 *
 * ## Erasable syntax only
 *
 * ⚠ Nothing below may use an `enum`, a `namespace`, or a parameter property. The generator
 * imports this file **directly, with no build step**, on Node's native type stripping — the
 * same principle `scripts/check-tokens.mjs` states as *"a lint gate that needs the build to
 * work cannot check the build"*. `scripts/generate-typography-css.mjs` has to build `@shiftcharts/core`
 * first; this one does not, which is why the root `engines.node` floor moved to the release
 * that made type stripping unflagged.
 */

/**
 * Where a default came from — `research/30-implementation-plan.md` §B3's table, plus the two
 * states that table has no row for because it describes a *finished* tree.
 *
 * ⚠ **`A-lit` and `A-impl` are not interchangeable and collapsing them is the failure the
 * scheme exists to prevent.** Four libraries defaulting a stroke to `2px` tells you what looks
 * *normal*; it does not tell you what is *legible*. One is evidence about human vision, the
 * other about convention.
 */
export type Tier =
  /** Research literature or a W3C/CSS spec. Evidence about **human vision**. */
  | 'A-lit'
  /** Verified source of a shipped library. Evidence about **convention**. */
  | 'A-impl'
  /** Ours, but consistent with published work, or a straightforward derivation. */
  | 'B'
  /** Pure invention. May still be right; the docs must not imply a source. */
  | 'C'
  /**
   * ⚠ **Not a tier — the absence of one, and it must never be silently promoted.** A value
   * that is conventional but whose claimed source was never confirmed.
   * `research/30-implementation-plan.md` §B1 lists six of these and says they *"must not be
   * given a Tier A label on the strength of looking plausible"*. Clearing one takes
   * **research**, not transcription.
   */
  | 'unverified'
  /**
   * ⚠ Also not a tier. `raw/06` §6.2–6.9 has a specified row for this token which has not been
   * transcribed yet. Clearing one takes **transcription**, not research — which is why it is a
   * different state from `unverified`, and why the census counts them separately.
   */
  | 'untiered'

export type Token = {
  /** Without the `--shiftcharts-` prefix; `toCustomProperty()` in `./index.ts` adds it. */
  readonly name: string
  /**
   * The CSS value, verbatim. A `var()` chain stays a `var()` chain and a `calc()` stays a
   * `calc()`. Dimensions carry their unit because `calc()` requires it (§B1); ratios and counts
   * are unitless and are never given one.
   */
  readonly value: string
  readonly tier: Tier
  /** The primary source, not this repo, wherever one exists. */
  readonly source: string
  /** Emitted as a block comment above the declaration. */
  readonly note?: string
  /** Emitted as a trailing comment on the declaration itself. */
  readonly aside?: string
}

export type TokenGroup = {
  readonly title: string
  readonly note?: string
  readonly tokens: readonly Token[]
}

/**
 * `:where(:root)` — the default world, 40 declarations.
 *
 * Order here is the emitted order, so this array is the stylesheet's table of contents.
 */
export const TOKEN_GROUPS: readonly TokenGroup[] = [
  {
    title: 'Surface',
    note: 'The charcoal continuum this world sits on.\n\nMerged with Canvas tokens.',
    tokens: [
      { name: 'surface-color', value: '#141618', tier: 'C', source: 'DESIGN.md:48 — ours, and no source is implied.' },
      { name: 'plot-color', value: 'transparent', tier: 'A-impl', source: 'Vega `style.cell.fill:\'transparent\'`' },
      { name: 'plot-border-color', value: '#ddd', tier: 'A-impl', source: 'Vega `style.cell.stroke: lightGray`' },
      { name: 'plot-border-width', value: '0', tier: 'C', source: 'No library draws a plot frame by default; Carbon names a "graph frame" in its anatomy but ships no option' },
      { name: 'plot-margin-top', value: '20px', tier: 'A-impl', source: 'Plot `marginTop = 20` (`30` when the x-axis is top-anchored)' },
      { name: 'plot-height-optimal', value: '24px', tier: 'A-lit', source: 'Heer, Kong & Agrawala CHI 2009 (via `05`)' },
      { name: 'plot-height-min-for-values', value: '40px', tier: 'A-lit', source: 'Heer & Bostock CHI 2010 (via `05`)' },
      { name: 'plot-height-saturation', value: '80px', tier: 'A-lit', source: 'Heer & Bostock CHI 2010 (via `05`)' },
      { name: 'widget-padding', value: '16px', tier: 'A-lit', source: 'Apple HIG: "the standard margin width for widgets — 16 points for most widgets"' },
      { name: 'widget-padding-tight', value: '11px', tier: 'A-lit', source: 'Apple HIG: "setting margins of 11 points can work well"' },
      { name: 'widget-radius', value: '0', tier: 'C', source: 'DESIGN.md:196 — Rail Square Corner Rule' },
      { name: 'widget-radius-inner', value: 'max(0px, calc(var(--shiftcharts-widget-radius) - var(--shiftcharts-widget-padding)))', tier: 'A-lit', source: 'Apple `ContainerRelativeShape` — "an inset version of the current container shape"' },
      { name: 'widget-gap', value: '16px', tier: 'C', source: 'No published source for a bento gutter (§4.5)' },
      { name: 'widget-shadow', value: 'none', tier: 'C', source: 'DESIGN.md:190 — Rail elevation tokens resolve to nothing' },
    ],
  },
  {
    title: 'Series',
    note: [
      'Named emission lines, each solved wavelength → CIE 1931 XYZ → linear sRGB → OKLCH.',
      'DESIGN.md:52-57. The trailing comment on each is its contrast ratio against the ground.',
      '',
      'Tier B rather than A: the derivation is standard colourimetry and reproducible, but no',
      'published study says these six are the right six. What is inherited from the literature is',
      'the *constraint* — categorical separation, colour-blind safety — not the values.',
    ].join('\n'),
    tokens: [
      { name: 'series-1', value: '#b4e4fd', tier: 'B', source: 'DESIGN.md:52', aside: 'H-beta   486.1nm · 230.5° · 13.35' },
      { name: 'series-2', value: '#fdcaa6', tier: 'B', source: 'DESIGN.md:53', aside: 'Na I D₂  589.0nm ·  57.2° · 12.24' },
      { name: 'series-3', value: '#28d824', tier: 'B', source: 'DESIGN.md:54', aside: 'Mg b₂    517.3nm · 142.5° ·  9.45' },
      { name: 'series-4', value: '#bda4fb', tier: 'B', source: 'DESIGN.md:55', aside: 'H-delta  410.2nm · 296.3° ·  8.52' },
      { name: 'series-5', value: '#1c9d96', tier: 'B', source: 'DESIGN.md:56', aside: 'He I     492.2nm · 188.9° ·  5.45' },
      { name: 'series-6', value: '#fa2017', tier: 'B', source: 'DESIGN.md:57', aside: 'Fe I     615.0nm ·  29.2° ·  4.56' },
    ],
  },
  {
    title: 'Neutral ramp',
    note: [
      'Hue 248.1°, chroma 0.0051 — a faintly cool grey, not a true neutral. DESIGN.md:99.',
      'DESIGN.md still calls this *the charcoal ramp* and should: the world keeps its word, the',
      'token takes the vocabulary. `charcoal` is not a `<group>` in raw/06 §6.0 and `ramp` is.',
      '',
      '⚠ **1 is darkest and 9 is lightest, absolutely, and the ramp does NOT flip with the',
      'ground.** The theme picks an index instead; see `--shiftcharts-surface-text-color`.',
      '',
      '⚠ **The 100…900 spelling these carried until B1 slice 2 was a Material-style *weight*',
      'scale, and the renumbering to 1…9 is not cosmetic.** raw/06 §6.0 fixes `<modifier>` as',
      '`-1`…`-n`, and its own ramps are `--shiftcharts-ramp-seq-1..9` and `--shiftcharts-ramp-div-1..11` — one',
      'index per stop, counted. A 100…900 scale implies interpolation between named stops that',
      'this ramp does not offer. The direction is preserved exactly: 100→1, 900→9.',
    ].join('\n'),
    tokens: [
      { name: 'ramp-neutral-1', value: '#0c0d0f', tier: 'C', source: 'DESIGN.md:99' },
      { name: 'ramp-neutral-2', value: '#202224', tier: 'C', source: 'DESIGN.md:99' },
      { name: 'ramp-neutral-3', value: '#36383a', tier: 'C', source: 'DESIGN.md:99' },
      { name: 'ramp-neutral-4', value: '#4e5052', tier: 'C', source: 'DESIGN.md:99' },
      { name: 'ramp-neutral-5', value: '#67696c', tier: 'C', source: 'DESIGN.md:99' },
      { name: 'ramp-neutral-6', value: '#848689', tier: 'C', source: 'DESIGN.md:99' },
      { name: 'ramp-neutral-7', value: '#a2a5a8', tier: 'C', source: 'DESIGN.md:99' },
      { name: 'ramp-neutral-8', value: '#c2c4c7', tier: 'C', source: 'DESIGN.md:99' },
      { name: 'ramp-neutral-9', value: '#e2e5e8', tier: 'C', source: 'DESIGN.md:99' },
    ],
  },
  {
    title: 'Surface text',
    tokens: [
      {
        name: 'surface-text-color',
        value: 'var(--shiftcharts-ramp-neutral-9)',
        tier: 'B',
        source: 'A4 — a contrast failure measured in a browser, not reasoned about.',
        note: [
          'The ramp index this world writes with. Added at A4.',
          '',
          '⚠ **The ramp is absolute and the theme picks an index — this is where the picking',
          'happens, and until A4 nothing did it.** The ramp is documented as 1 darkest to 9',
          'lightest, which means it does *not* flip with the ground; a world that flips the ground',
          'and not the ink writes light-on-light. The `chart.css` in @shiftcharts/primitives set',
          '`color: var(--shiftcharts-ramp-neutral-9)` directly, so on the light ground every axis label, every',
          'tick and every gridline rendered at #e2e5e8 on #f4f3ef — about 1.1:1, present in the DOM,',
          'present in the a11y tree, and invisible. The chart drew its lines and lost its entire',
          'reading apparatus.',
          '',
          'The playground had made exactly this choice in its own `--pg-fg` three lines at a time',
          'since A2, with a comment predicting the library would have to make it too. It does.',
        ].join('\n'),
      },
    ],
  },
  {
    title: 'Chrome',
    note: [
      'Derived from currentColor at low opacity, so it tracks whatever ink the active theme',
      'picked. DESIGN.md:101.',
      '',
      '⚠ **These two are the worked example of composition beating provenance.**',
      '`research/10-responsive-ladder.md` §6.1: `grid-color: #ddd` (A-impl — Vega, Nivo) ×',
      '`grid-opacity: 0.2` (A-lit — Heer & Bostock 2010) are two independent, individually citable',
      'solutions to *make gridlines recede*, and composed they multiply into a gridline that is not',
      'there. The resolution keeps the alpha and replaces the colour, which is why the two rows',
      'below carry different tiers: the alpha is still the published number, the colour is ours.',
      '',
      '⚠ This once claimed gridlines were *"safe in BOTH themes by construction"*. They are safe by',
      'construction only against the ink — `currentColor` inherits, it does not choose. The',
      'construction that makes the claim true is `--shiftcharts-surface-text-color` above.',
    ].join('\n'),
    tokens: [
      {
        name: 'grid-color',
        value: 'currentColor',
        tier: 'B',
        source: 'Ours — 10-responsive-ladder.md:384, replacing Vega/Nivo #ddd, which inverts wrongly on dark.',
      },
      {
        name: 'grid-opacity',
        value: '0.2',
        tier: 'A-lit',
        source: 'Heer & Bostock 2010 — 10-responsive-ladder.md:373.',
        note: [
          '⚠ **Heer & Bostock 2010, not Talbot.** `theme.css` cited Talbot here from A1 until this',
          'file was written. Talbot 2010 is the *tick-spacing* work and says nothing about gridline',
          'alpha; `10-responsive-ladder.md:373` is unambiguous. Nothing caught it for the whole of',
          'milestone A, because in CSS a citation is a comment and a comment is not checked.',
        ].join('\n'),
      },
      {
        name: 'axis-color',
        value: 'currentColor',
        tier: 'B',
        source: 'Ours — the same reasoning as `grid-color`.',
      },
      { name: 'grid-x-visible', value: '0', tier: 'A-impl', source: 'Highcharts `xAxis.gridLineWidth: null` (x off, y on); Nivo `enableGridX: false`' },
      { name: 'grid-y-visible', value: '1', tier: 'A-impl', source: 'Highcharts, Nivo `enableGridY: true`, ECharts `splitLine.show: true`' },
      { name: 'grid-width', value: '1px', tier: 'A-impl', source: 'Vega, Nivo, visx, ECharts, Highcharts minor all `1`' },
      { name: 'grid-dash', value: 'none', tier: 'A-impl', source: 'Highcharts `gridLineDashStyle: \'Solid\'`; ECharts `type: \'solid\'`' },
      { name: 'grid-dash-offset', value: '0', tier: 'A-impl', source: 'ECharts `dashOffset: 0`' },
      { name: 'grid-cap', value: 'butt', tier: 'A-impl', source: 'ECharts `cap: \'butt\'`' },
      { name: 'grid-z', value: '1', tier: 'A-impl', source: 'Highcharts `gridZIndex: 1`' },
      { name: 'grid-min-spacing', value: '8px', tier: 'A-lit', source: 'Heer & Bostock 2010: "gridlines be separated by at least 8 pixels"' },
      { name: 'grid-minor-visible', value: '0', tier: 'A-impl', source: 'amCharts `minorGridEnabled: false`; ECharts `minorSplitLine`/`minorTick.show: false`; Highcharts `minorTickWidth: 0`' },
      { name: 'grid-minor-count', value: '5', tier: 'A-impl', source: 'Highcharts `minorTicksPerMajor: 5`; ECharts `minorTick.splitNumber: 5`' },
      { name: 'grid-minor-opacity', value: '0.5', tier: 'B', source: 'Highcharts minor uses `neutral-color-5` vs grid\'s `neutral-color-10` — exactly half. amCharts says minor grid "has a slightly `strokeOpacity` set by default" but does not give the number (**UNVERIFIED**)' },
      { name: 'grid-band-color', value: 'transparent', tier: 'A-impl', source: 'Highcharts `alternateGridColor: null`; ECharts `splitArea.show: false`; amCharts axis fills disabled by default' },
      { name: 'axis-x-domain-visible', value: '1', tier: 'A-impl', source: 'Vega `axis.domain: true`; ECharts category axis `axisLine.show: true`' },
      { name: 'axis-y-domain-visible', value: '0', tier: 'A-impl', source: 'ECharts: "The **value** axis doesn\'t show the axis line by default since v5.0.0"; Spectrum `domain: false`; Nivo `domain.line.stroke: \'transparent\'`' },
      { name: 'axis-domain-width', value: '1px', tier: 'A-impl', source: 'Vega `domainWidth: 1`; Highcharts `lineWidth: 1`; ECharts `axisLine.lineStyle.width: 1` (Spectrum 2, visx 2)' },
      { name: 'axis-domain-color', value: '#888', tier: 'A-impl', source: 'Vega `domainColor: gray \'#888\'` (ECharts `\'#333\'`)' },
      { name: 'axis-domain-dash', value: 'none', tier: 'A-impl', source: 'Vega-Lite `domainDash` — the per-guide domain dash property in the granularity survey' },
      { name: 'axis-domain-dash-offset', value: '0', tier: 'A-impl', source: 'Vega-Lite `domainDashOffset: 0`' },
      { name: 'axis-domain-cap', value: 'butt', tier: 'B', source: 'Vega-Lite `domainCap: butt`; the SVG default, with the field marked as a project choice' },
      { name: 'axis-translate', value: '0.5px', tier: 'C', source: 'Vega exposes `translate` (the crispness offset) and Highcharts has `crisp: true`, but **the default value is UNVERIFIED** — 0.5px is the standard half-pixel SVG correction' },
      { name: 'tick-visible', value: '1', tier: 'B', source: 'Field is split: Vega/ECharts-category/Highcharts `on`; Carbon (`g.tick line { display:none }`), Spectrum (`ticks: false`), amCharts (`visible` off) `off`' },
      { name: 'tick-length', value: '5px', tier: 'A-impl', source: 'Vega `tickSize: 5`, Nivo `tickSize: 5`, ECharts `axisTick.length: 5`. Spread across the field: **5–10** (Recharts 6, Plot 6, Spectrum 8, visx 8, Highcharts 10)' },
      { name: 'tick-width', value: '1px', tier: 'A-impl', source: 'Vega `tickWidth: 1`, ECharts, Spectrum `tickWidth: 1`' },
      { name: 'tick-color', value: '#888', tier: 'A-impl', source: 'Vega `tickColor: gray` (Spectrum `gray-300`, Nivo `#777`)' },
      { name: 'tick-cap', value: 'butt', tier: 'B', source: 'Vega-Lite exposes `tickCap`; Spectrum sets `\'round\'`. `butt` is the SVG default' },
      { name: 'tick-padding', value: '6px', tier: 'B', source: '**The field disagrees by 7.5×**: Vega 2, Recharts `tickMargin` 2, Nivo `tickPadding` 5, ECharts `axisLabel.margin` 8, Spectrum `labelPadding` 8, Highcharts `labels.distance` 15. 6 is the median' },
      { name: 'tick-offset', value: '0', tier: 'A-impl', source: 'Vega `tickOffset: 0`' },
      { name: 'tick-offset-band', value: '-0.5', tier: 'A-impl', source: 'Vega `axisBand.tickOffset: -0.5` — "correction for centering bias"' },
      { name: 'tick-round', value: '1', tier: 'A-impl', source: 'Vega `tickRound: true`; Spectrum `tickRound: true`' },
      { name: 'tick-minor-length', value: '3px', tier: 'A-impl', source: 'ECharts `minorTick.length: 3` (Highcharts `minorTickLength: 2`)' },
      { name: 'tick-minor-width', value: '0', tier: 'A-impl', source: 'Highcharts `minorTickWidth: 0`' },
      { name: 'tick-spacing-x', value: '100px', tier: 'A-lit', source: 'Talbot, Lin & Hanrahan InfoVis 2010: "about 1 tick per 100 pixels"; **independently** Highcharts `tickPixelInterval: 100`. Plot uses 80' },
      { name: 'tick-spacing-y', value: '35px', tier: 'A-impl', source: 'Plot `tickSpacing = k === "x" ? 80 : 35` — y labels are one line tall, x labels are many characters wide' },
      { name: 'tick-count-min', value: '2', tier: 'A-lit', source: 'Talbot 2010: "at least two labels (our lower bound)"' },
      { name: 'tick-min-step', value: 'unset', tier: 'A-impl', source: 'Vega-Lite `tickMinStep` — "the minimum desired step between axis ticks, in terms of scale domain values"' },
    ],
  },
  {
    title: 'Marks',
    note: [
      'Added at A4, when @shiftcharts/primitives first needed them.',
      '',
      '⚠ **These are tokens and the four constants in layout.ts are NOT, and the dividing line is',
      'whether the resolver already subtracted the number.** Tick length feeds `xAxisBand()`, so a',
      'theme that changed it would move the glyphs and leave the band where it was. Stroke width',
      'and point radius feed nothing: the plot box is the same either way, so a theme may own them',
      'outright. See CHROME_METRICS in packages/core/src/layout.ts.',
      '',
      '`r` is a real CSS property in SVG2 and browsers shipped it, which is what makes',
      '`--shiftcharts-point-radius` a token rather than an attribute — decision 012.',
    ].join('\n'),
    tokens: [
      {
        name: 'line-stroke-width',
        value: '2px',
        tier: 'A-impl',
        source: 'Vega `defaultStrokeWidth = 2` / `line.strokeWidth: 2`; Highcharts `plotOptions.series.lineWidth: 2`; Nivo `lineWidth: 2`; Spectrum `BASE_STROKE_WIDTH = 2`',
      },
      {
        name: 'point-radius',
        value: '4px',
        tier: 'A-impl',
        source: 'Highcharts `marker.radius: 4`; Carbon `scatterChart.points.radius: 4`; Vega `symbol.size: 64` (area) = r 4. Carbon\'s *line* points are 3, Nivo `pointSize: 6` (diameter) = r 3',
      },
      {
        name: 'area-opacity',
        value: '0.2',
        tier: 'A-impl',
        source: 'Nivo `areaOpacity: 0.2`. **Spectrum uses `0.8`** — the gap is stacking: 0.2 assumes overlap, 0.8 assumes stacked/non-overlapping. Consider `--shiftcharts-area-opacity-stacked: 0.8` as a second token',
      },
      {
        name: 'horizon-band-opacity',
        value: '0.3',
        tier: 'C',
        source: 'Ours — 0.3 creates a decent ramp when multiplied',
        aside: 'The horizon ramp multiplies this by band index — see chart.css.',
      },
      { name: 'line-stroke-width-muted', value: '0.5px', tier: 'A-impl', source: 'Carbon: "re-style line segments to use 0.5px stroke and hide circles representing data points" (during an axis break)' },
      { name: 'line-stroke-width-hover', value: 'calc(var(--shiftcharts-line-stroke-width) + 0.5px)', tier: 'A-impl', source: 'Spectrum `HOVER_STROKE_OFFSET = 0.5`' },
      { name: 'line-cap', value: 'round', tier: 'A-impl', source: 'Highcharts `plotOptions.series.linecap: \'round\'`' },
      { name: 'line-join', value: 'round', tier: 'C', source: 'ECharts defaults `join: \'bevel\'`; `round` is ours and disagrees with the only verified source — label it C' },
      { name: 'line-miter-limit', value: '10', tier: 'A-impl', source: 'ECharts `miterLimit: 10` (also the SVG default)' },
      { name: 'line-dash', value: 'none', tier: 'A-impl', source: 'Highcharts `dashStyle: \'Solid\'`; ECharts `type: \'solid\'`' },
      { name: 'line-dash-offset', value: '0', tier: 'A-impl', source: 'ECharts `dashOffset: 0`' },
      { name: 'line-crisp', value: '1', tier: 'A-impl', source: 'Highcharts `crisp: true`' },
      { name: 'area-stroke-width', value: 'var(--shiftcharts-line-stroke-width)', tier: 'C', source: 'ours' },
      { name: 'bar-gap-inner', value: '0.1', tier: 'A-impl', source: 'Highcharts `plotOptions.column.pointPadding: 0.1`. Field spread: Nivo `innerPadding: 0`, Recharts `barGap: 4px`, ECharts `barGap: \'20%\'`' },
      { name: 'bar-gap-outer', value: '0.2', tier: 'A-impl', source: 'Highcharts `groupPadding: 0.2`. Spread: Nivo `padding: 0.1`, Recharts `barCategoryGap: \'10%\'`, ECharts auto' },
      { name: 'bar-radius', value: '3px', tier: 'A-impl', source: 'Highcharts `column.borderRadius: 3`. Spread: Nivo `0`, Spectrum `CORNER_RADIUS = 6`, Recharts/ECharts accept a 4-tuple with no default' },
      { name: 'bar-border-width', value: '0', tier: 'A-impl', source: 'Nivo `borderWidth: 0`; Spectrum `rect.strokeWidth: 0`; ECharts `itemStyle.borderWidth = 0`' },
      { name: 'bar-min-length', value: '0', tier: 'A-impl', source: 'Highcharts `minPointLength: 0`; ECharts `barMinHeight: 0`' },
      { name: 'bar-width-max', value: 'none', tier: 'A-impl', source: 'Highcharts `maxPointWidth: null`; ECharts `barMaxWidth: null`; Recharts `maxBarSize: undefined`' },
      { name: 'bar-max-categories', value: '24', tier: 'A-lit', source: 'Blascheck et al. InfoVis 2018 (via `05`)' },
      {
        name: 'point-radius-hover',
        value: 'var(--shiftcharts-point-radius)',
        tier: 'C',
        source: 'Spectrum scales point **area** by tier (`36/64/100`), not on hover; the no-op reuses the resting radius',
      },
      { name: 'point-stroke-width', value: '0', tier: 'A-impl', source: 'Highcharts `marker.lineWidth: 0`; Nivo `pointBorderWidth: 0`. **Vega and Spectrum both use `2`** — the split is scatter (no stroke) vs line-with-markers (stroke to separate the dot from the line)' },
      { name: 'point-stroke-color', value: 'var(--shiftcharts-surface-color)', tier: 'A-impl', source: 'Highcharts `marker.lineColor: var(--highcharts-background-color)` — stroke the marker in the *background* colour so it knocks out the line behind it. A verified idiom worth copying exactly' },
      { name: 'point-shape', value: 'circle', tier: 'A-impl', source: 'Vega `legend.symbolType: \'circle\'`' },
      { name: 'point-auto-hide-threshold', value: '2', tier: 'A-impl', source: 'Highcharts `marker.enabledThreshold: 2` — hide markers when the horizontal distance between the two closest points falls below N × `marker.radius`. A conceal rule shipped as a number' },
      { name: 'arc-inner-radius', value: '0', tier: 'A-impl', source: 'Highcharts `pie.innerSize: 0`; Nivo `innerRadius: 0`' },
      { name: 'arc-pad-angle', value: '0', tier: 'A-impl', source: 'Nivo `padAngle: 0`' },
      { name: 'arc-radius', value: 'calc(min(100%, 100cqh) / 2 - 2px)', tier: 'A-impl', source: 'Spectrum `DONUT_RADIUS = \'(min(width, height) / 2 - 2)\'` — note the `- 2` inset' },
      { name: 'arc-corner-radius', value: '0', tier: 'A-impl', source: 'Nivo `cornerRadius: 0`' },
      { name: 'arc-border-width', value: '0', tier: 'A-impl', source: 'Nivo `borderWidth: 0` (Highcharts `pie.borderWidth: 1`)' },
      { name: 'arc-start-angle', value: '0', tier: 'A-impl', source: 'Nivo `startAngle: 0`; Highcharts `pie.startAngle: 0`' },
      { name: 'arc-sliced-offset', value: '10px', tier: 'A-impl', source: 'Highcharts `slicedOffset: 10`' },
      { name: 'arc-label-distance', value: '30px', tier: 'A-impl', source: 'Highcharts `pie.dataLabels.distance: 30`' },
      { name: 'arc-label-radius-offset', value: '0.5', tier: 'A-impl', source: 'Nivo `arcLabelsRadiusOffset: 0.5`' },
      { name: 'arc-link-diagonal-length', value: '16px', tier: 'A-impl', source: 'Nivo `arcLinkLabelsDiagonalLength: 16`' },
      { name: 'arc-link-straight-length', value: '24px', tier: 'A-impl', source: 'Nivo `arcLinkLabelsStraightLength: 24`' },
      { name: 'arc-link-thickness', value: '1px', tier: 'A-impl', source: 'Nivo `arcLinkLabelsThickness: 1`' },
      { name: 'arc-link-text-offset', value: '6px', tier: 'A-impl', source: 'Nivo `arcLinkLabelsTextOffset: 6`' },
      { name: 'arc-label-min-angle', value: '0.3rad', tier: 'A-impl', source: 'Spectrum `DONUT_SEGMENT_LABEL_MIN_ANGLE = 0.3` (≈17.2°)' },
      { name: 'arc-label-callout-below', value: '3deg', tier: 'A-impl', source: 'Carbon: "When the graphic translation of the data is less than 3 degrees, a callout is used"' },
      { name: 'arc-min-render-angle', value: '1deg', tier: 'A-impl', source: 'Carbon: "If the data translates as less than 1 degree, a slice will not be rendered"' },
      { name: 'arc-summary-min-radius', value: '45px', tier: 'A-impl', source: 'Spectrum `DONUT_SUMMARY_MIN_RADIUS = 45`' },
      { name: 'arc-summary-font-size-ratio', value: '0.35', tier: 'A-impl', source: 'Spectrum `DONUT_SUMMARY_FONT_SIZE_RATIO = 0.35` (of inner radius)' },
      { name: 'arc-max-categories', value: '7', tier: 'A-lit', source: 'Blascheck 2018 / While et al. CHI 2024, radial condition (via `05`)' },
    ],
  },
  {
    title: 'Series colour',
    tokens: [
      {
        name: 'series-color',
        value: 'var(--shiftcharts-series-1)',
        tier: 'B',
        source: 'Ours — the indirection is the mechanism, not the value.',
        note: [
          'The colour a mark paints with. Defaults to the first emission line and is re-bound per',
          'series by the `chart.css` in @shiftcharts/primitives, so a single-series chart can be recoloured by',
          'setting one property on the figure rather than by reaching into a data attribute.',
        ].join('\n'),
      },
    ],
  },
  {
    title: 'Typography',
    note: [
      'The fit-insensitive part. Everything whose value is a function of the font metrics is',
      'generated into `typography.css` by scripts/generate-typography-css.mjs instead, from the',
      '`FittingTypography` in @shiftcharts/core — those tokens have no row here because their value is',
      'computed rather than chosen.',
    ].join('\n'),
    tokens: [
      {
        name: 'label-font-size-min',
        value: '10px',
        tier: 'C',
        source: '42-typography.md:229 — ⚠ no system publishes a legibility floor and DESIGN.md:131 refuses to assert one. Ours.',
      },
      {
        name: 'label-landmark-grade',
        value: '150',
        tier: 'B',
        source: '42-typography.md:144 — the A-impl *intent* behind Carbon 600 (raw/06:1743), retargeted to GRAD and clamped to the verified +150 ceiling of Roboto Flex.',
        note: [
          '⚠ **GRAD, never wght.** Per 41-text-metrics.md §3, `wght` changes glyph advance widths and',
          '`GRAD` verifiably does not — so a landmark expressed as weight would invalidate the metrics',
          'table that every fitted size is computed from.',
          '',
          '⚠ Whether `GRAD: 150` is *perceptually* sufficient to read as a landmark at 11px is',
          'UNVERIFIED (42-typography.md:152). The tier covers where the number came from, never',
          'whether it works.',
        ].join('\n'),
      },
      {
        name: 'label-line-height',
        value: '1.2em',
        tier: 'C',
        source: '42-typography.md:252 — new, and with no source. Carried as an open question at :312.',
      },
      { name: 'label-font-size', value: '11px', tier: 'B', source: 'Field spread **10–14**: Vega `guide-label` 10 and Plot 10; Nivo `text.fontSize` 11 and Vega `text` mark 11; Spectrum 14' },
      { name: 'label-color', value: '#888', tier: 'B', source: 'Carbon `$text-secondary`; Highcharts `var(--highcharts-neutral-color-60)`; Nivo `#333`' },
      { name: 'label-angle', value: '0', tier: 'A-impl', source: 'Vega `labelAngle: 0`; Highcharts, Nivo `tickRotation: 0`, ECharts `rotate: 0`, Recharts `angle: 0`' },
      { name: 'label-offset', value: '0', tier: 'A-impl', source: 'Vega `axis.labelOffset: 0`' },
      { name: 'label-limit', value: '180px', tier: 'A-impl', source: 'Vega `axis.labelLimit: 180` (legend 160; Spectrum 184)' },
      { name: 'label-overflow', value: 'ellipsis', tier: 'A-impl', source: 'Highcharts `labels.textOverflow: \'ellipsis\'`' },
      { name: 'label-overlap', value: 'greedy', tier: 'B', source: 'Vega/Spectrum default `labelOverlap: true`; Vega-Lite\'s named policies are `"parity"` (drop every other) and `"greedy"` (scan and drop). `greedy` degrades more evenly on non-uniform labels' },
      { name: 'label-separation', value: '1.5em', tier: 'A-lit', source: 'Talbot 2010: "We begin penalizing labels if they are closer than 1.5em apart and we forbid overlapping labels"' },
      { name: 'label-rotate-limit', value: '80deg', tier: 'A-impl', source: 'Highcharts `labels.autoRotationLimit: 80`' },
      { name: 'label-step', value: '0', tier: 'A-impl', source: 'Highcharts `labels.step: 0` (tick-dropping stride)' },
      { name: 'label-stagger-lines', value: '0', tier: 'A-impl', source: 'Highcharts `staggerLines: 0`' },
      { name: 'label-stagger-max', value: '5', tier: 'A-impl', source: 'Highcharts `maxStaggerLines: 5`' },
      { name: 'label-degrade-order', value: 'abbreviate split rotate transpose', tier: 'B', source: 'Talbot 2010 supplies the first three ("rotation … a last resort"); `transpose` is ours (via `05`)' },
      { name: 'axis-title-padding', value: '4px', tier: 'A-impl', source: 'Vega `axis.titlePadding: 4` (Spectrum 16)' },
      { name: 'title-offset', value: '4px', tier: 'A-impl', source: 'Vega `title.offset: 4` (Spectrum 10)' },
      { name: 'subtitle-font-size', value: '12px', tier: 'A-impl', source: 'Vega `group-subtitle: { fontSize: 12 }`' },
      { name: 'subtitle-padding', value: '3px', tier: 'A-impl', source: 'Vega `title.subtitlePadding: 3`' },
      { name: 'value-label-font-size', value: '10px', tier: 'B', source: 'Highcharts `dataLabels.style.fontSize: \'0.7em\'` — deliberately *smaller* than the legend\'s `0.8em`' },
      { name: 'value-label-font-weight', value: '700', tier: 'A-impl', source: 'Highcharts `dataLabels.style.fontWeight: \'bold\'`; Spectrum `DIRECT_LABEL_FONT_WEIGHT = 700`' },
      { name: 'value-label-offset', value: '4px', tier: 'A-impl', source: 'Highcharts `plotOptions.series.dataLabels.distance: 4`' },
      { name: 'value-label-radius', value: '3px', tier: 'A-impl', source: 'Highcharts `dataLabels.borderRadius: 3`' },
      { name: 'value-label-halo-width', value: '2px', tier: 'B', source: 'Spread **1–4**: Highcharts `textOutline: \'1px contrast\'`, Nivo `annotations.text.outlineWidth: 2`, Spectrum `DIRECT_LABEL_BACKGROUND_STROKE_WIDTH = 4`' },
      { name: 'value-label-skip-width', value: '0', tier: 'A-impl', source: 'Nivo `labelSkipWidth: 0` — conceal labels below a bar-width threshold' },
      { name: 'value-label-skip-height', value: '0', tier: 'A-impl', source: 'Nivo `labelSkipHeight: 0` — conceal labels below a bar-height threshold' },
      { name: 'value-label-halo-color', value: 'var(--shiftcharts-surface-color)', tier: 'B', source: 'Nivo `outlineColor: \'#ffffff\'`; Highcharts `\'contrast\'` (computed)' },
      { name: 'value-label-halo-opacity', value: '1', tier: 'A-impl', source: 'Nivo `outlineOpacity: 1`' },
    ],
  },
  {
    title: 'Motion',
    note: [
      'Added at A6.',
      '',
      '⚠ **There is no `--shiftcharts-motion-enabled`, and its absence is the same decision as the missing',
      '`enabled` field on `MotionPlan`.** `40-chart-plan.md` §4: the server cannot read',
      '`prefers-reduced-motion`, so a token derived from it would differ between the server render',
      'and the client one. The plan carries the structural facts; the media query in the',
      '`chart.css` of @shiftcharts/primitives decides whether anything runs. Polarity there is',
      '`no-preference`, so the still chart is the baseline and motion is the addition.',
      '',
      '⚠ `--shiftcharts-motion-duration` is the ACTIVE one and is re-bound per figure from',
      '`data-motion-duration`, which `<Chart>` echoes from `plan.motion.durationClass`. The default',
      'is the fast end: a chart that somehow renders without the attribute moves less, rather than',
      'more, than it should.',
      '',
      '⚠ **The stage delay is derived per class HERE, and must never be written as',
      '`calc(var(--shiftcharts-motion-duration) / 2)`.** It was, and it was wrong in a way nothing caught: a',
      'custom property is substituted where it is *declared*, and the result is what inherits.',
      'Declared on `:root`, `calc(var(--shiftcharts-motion-duration) / 2)` resolves against the `:root`',
      'value — the rescale 300ms — and the token that inherits down to every figure is the already-',
      'computed `calc(300ms / 2)`. `chart.css` then rebinds `--shiftcharts-motion-duration: 1000ms` on the',
      'recompose figure and the delay does not follow, because there is no longer a `var()` left in',
      'it to re-resolve. Measured in Chromium: a recompose chart reported',
      '`--shiftcharts-motion-stage-delay: calc(300ms / 2)` and staged its marks 150ms behind a 1000ms chrome',
      'move, instead of 500ms behind. Naming both halves up front means each `calc()` resolves',
      'against a literal, so neither depends on which element it is read from. **G19 asserts the',
      'resulting gap.**',
    ].join('\n'),
    tokens: [
      {
        name: 'motion-duration-rescale',
        value: '300ms',
        tier: 'A-lit',
        source: '10-responsive-ladder.md §7 — the fast end, assigned to rescale-only changes, which are minimal-movement by definition.',
      },
      {
        name: 'motion-duration-recompose',
        value: '1000ms',
        tier: 'A-lit',
        source: 'Heer & Robertson 2007.',
        note: [
          '⚠ **A-lit and A-impl at once**, which is as strong as this scheme gets: Heer & Robertson',
          '2007 *measured* 1000ms, and Adobe Spectrum independently ships',
          '`DRAW_IN_ANIMATION_DURATION_MS = 1000`. Convergence of a vision result and a shipped',
          'convention on one number is the only corroboration available here.',
        ].join('\n'),
      },
      {
        name: 'motion-stage-delay-rescale',
        value: 'calc(var(--shiftcharts-motion-duration-rescale) / 2)',
        tier: 'C',
        source: '10-responsive-ladder.md §7 specifies *that* a change is staged and gives no timing for the overlap. Assumed half-duration.',
      },
      {
        name: 'motion-stage-delay-recompose',
        value: 'calc(var(--shiftcharts-motion-duration-recompose) / 2)',
        tier: 'C',
        source: '10-responsive-ladder.md §7 specifies *that* a change is staged and gives no timing for the overlap. Assumed half-duration.',
        note: [
          '⚠ Half the duration puts stage 2 in motion while stage 1 is still settling, so the two read',
          'as one gesture with an order rather than as two animations queued; a full-duration delay',
          'serialises them and doubles the envelope. That is an argument, not a measurement — which',
          'is exactly what `unverified` means.',
        ].join('\n'),
      },
      {
        name: 'motion-duration',
        value: 'var(--shiftcharts-motion-duration-rescale)',
        tier: 'B',
        source: 'Ours — the active binding, re-pointed per figure by chart.css.',
      },
      {
        name: 'motion-stage-delay',
        value: 'var(--shiftcharts-motion-stage-delay-rescale)',
        tier: 'B',
        source: 'Ours — the active binding, re-pointed per figure by chart.css.',
      },
      {
        name: 'motion-easing',
        value: 'ease-out',
        tier: 'C',
        source: 'Conventional; no source confirmed, chosen as safe default.',
      },
      { name: 'motion-duration-hover', value: '100ms', tier: 'A-impl', source: 'Spectrum `ANIMATION_HOVER_SPEED = 100`' },
      { name: 'motion-throttle', value: '33ms', tier: 'A-impl', source: 'Spectrum `ANIMATION_THROTTLE = 33` ("~30fps")' },
      { name: 'motion-stages-max', value: '2', tier: 'B', source: 'Heer & Robertson\'s staging result (via `05`): stage axis change, then mark change; "do not exceed two stages"' },
      { name: 'motion-fade-factor', value: '0.2', tier: 'A-impl', source: 'Spectrum `FADE_FACTOR = 0.2` (de-emphasised series opacity)' },
      { name: 'motion-hover-neutral', value: '0.5', tier: 'A-impl', source: 'Spectrum `HOVER_NEUTRAL_TARGET = 0.5`' },
    ],
  },
  {
    title: 'Spacing',
    note: 'A calc() multiplier is not a length literal — 43-theming.md §6.2.',
    tokens: [
      {
        name: 'size-gap',
        value: '4px',
        tier: 'C',
        source: 'Ours. Legacy token retained for compatibility.',
      },
      {
        name: 'plot-padding',
        value: 'calc(var(--shiftcharts-size-gap) * 2)',
        tier: 'C',
        source: 'Ours. Legacy token retained for compatibility.',
      },
      { name: 'scale-ratio-s', value: '0.75', tier: 'A-impl', source: 'Spectrum `CHART_SIZE_SCALE_RATIOS.S` and Apple visionOS widget scaling from 75 to 125 percent' },
      { name: 'scale-ratio-m', value: '1', tier: 'A-impl', source: 'Spectrum `CHART_SIZE_SCALE_RATIOS.M`' },
      { name: 'scale-ratio-l', value: '1.25', tier: 'A-impl', source: 'Spectrum `CHART_SIZE_SCALE_RATIOS.L` and Apple visionOS widget scaling from 75 to 125 percent' },
      { name: 'size-breakpoint-m', value: '400px', tier: 'A-impl', source: 'Spectrum `CHART_SIZE_BREAKPOINTS.M`; Carbon independently uses 400 as its reference dimension' },
      { name: 'size-breakpoint-l', value: '800px', tier: 'A-impl', source: 'Spectrum `CHART_SIZE_BREAKPOINTS.L`' },
    ],
  },
  {
    title: 'Legend',
    tokens: [
      { name: 'legend-orient', value: 'right', tier: 'A-impl', source: 'Vega `legend.orient: \'right\'`' },
      { name: 'legend-padding', value: '0', tier: 'A-impl', source: 'Vega `legend.padding: 0` (Highcharts 8)' },
      { name: 'legend-offset', value: '18px', tier: 'A-impl', source: 'Vega `legend.layout.offset: 18` (Spectrum 24)' },
      { name: 'legend-gap-column', value: '10px', tier: 'A-impl', source: 'Vega `columnPadding: 10`; ECharts `legend.itemGap = 10`; Recharts hard-codes `marginRight: 10` inline. Spectrum uses 20' },
      { name: 'legend-gap-row', value: '2px', tier: 'A-impl', source: 'Vega `rowPadding: 2`; Highcharts `itemMarginTop/Bottom: 2` (Spectrum 8)' },
      { name: 'legend-symbol-size', value: '14px', tier: 'B', source: 'Spread: Vega `symbolSize: 100` (area, √ ≈ 10), Recharts `iconSize: 14`, ECharts `itemHeight: 14` / `itemWidth: 25`, Spectrum `DEFAULT_LEGEND_SYMBOL_WIDTH: 16`' },
      { name: 'legend-symbol-gap', value: '5px', tier: 'A-impl', source: 'Highcharts `symbolPadding: 5` (Nivo chip `marginRight: 7`; Recharts hard-codes 4)' },
      { name: 'legend-symbol-stroke-width', value: '1.5px', tier: 'A-impl', source: 'Vega `symbolStrokeWidth: 1.5`' },
      { name: 'legend-symbol-shape', value: 'circle', tier: 'A-impl', source: 'Vega `symbolType: \'circle\'` (Spectrum uses a custom `ROUNDED_SQUARE_PATH`)' },
      { name: 'legend-label-offset', value: '4px', tier: 'A-impl', source: 'Vega `legend.labelOffset: 4`' },
      { name: 'legend-label-limit', value: '160px', tier: 'A-impl', source: 'Vega `legend.labelLimit: 160` (Spectrum 184)' },
      { name: 'legend-symbol-limit', value: '30', tier: 'A-impl', source: 'Vega `legend.symbolLimit: 30`' },
      { name: 'legend-title-padding', value: '5px', tier: 'A-impl', source: 'Vega `legend.titlePadding: 5` (Spectrum 8)' },
      { name: 'legend-title-limit', value: '180px', tier: 'A-impl', source: 'Vega `legend.titleLimit: 180`' },
      { name: 'legend-gradient-length', value: '200px', tier: 'A-impl', source: 'Vega `gradientLength: 200`' },
      { name: 'legend-gradient-thickness', value: '16px', tier: 'A-impl', source: 'Vega `gradientThickness: 16`' },
      { name: 'legend-gradient-label-offset', value: '2px', tier: 'A-impl', source: 'Vega `gradientLabelOffset: 2`' },
      { name: 'legend-max-entries', value: '8', tier: 'C', source: '**UNVERIFIED** (via `05`) — no published number for legend capacity exists. Must not be presented as a threshold' },
    ],
  },
  {
    title: 'Tooltip',
    tokens: [
      { name: 'tooltip-color', value: 'var(--shiftcharts-ramp-neutral-2)', tier: 'C', source: 'SB-005: dark tooltip surface on the default rail; theme variants may re-point it for contrast' },
      { name: 'tooltip-radius', value: '8px', tier: 'C', source: 'SB-005: premium tooltip corner radius' },
      { name: 'tooltip-padding', value: '8px', tier: 'A-impl', source: 'Highcharts `tooltip.padding: 8` (Nivo `\'5px 9px\'`)' },
      { name: 'tooltip-shadow', value: 'none', tier: 'C', source: 'DESIGN.md:190 — Rail elevation tokens resolve to nothing' },
      { name: 'tooltip-offset', value: '16px', tier: 'A-impl', source: 'Highcharts `tooltip.distance: 16`' },
      { name: 'tooltip-header-gap', value: '5px', tier: 'A-impl', source: 'Highcharts `tooltip.header.distance: 5`' },
      { name: 'tooltip-row-padding', value: '3px 5px', tier: 'A-impl', source: 'Nivo `tableCell.padding`' },
      { name: 'tooltip-chip-gap', value: '7px', tier: 'A-impl', source: 'Nivo `tooltip.chip.marginRight: 7`' },
      { name: 'tooltip-delay', value: '350ms', tier: 'A-impl', source: 'Spectrum `TOOLTIP_DELAY = 350`' },
      { name: 'tooltip-hide-delay', value: '500ms', tier: 'A-impl', source: 'Highcharts `hideDelay: 500`' },
      { name: 'tooltip-snap', value: '10px', tier: 'A-impl', source: 'Highcharts `tooltip.snap` — values `10` and `25`; **which is mouse and which is touch is UNVERIFIED**. Ship the larger as `--shiftcharts-tooltip-snap-coarse` under `@media (pointer: coarse)`' },
      { name: 'crosshair-width', value: '1px', tier: 'A-impl', source: 'Highcharts `crosshair.width: 1`; Nivo `crosshair.line.strokeWidth: 1`' },
      { name: 'crosshair-color', value: '#ccc', tier: 'A-impl', source: 'Highcharts `crosshair.color: \'#cccccc\'` (Nivo `#000` at 0.75 opacity)' },
      { name: 'crosshair-opacity', value: '0.75', tier: 'A-impl', source: 'Nivo `crosshair.line.strokeOpacity: 0.75`' },
      { name: 'crosshair-dash', value: '6 6', tier: 'A-impl', source: 'Nivo `strokeDasharray: \'6 6\'`. **Highcharts defaults `dashStyle: \'Solid\'`** — the field disagrees; dashed reads better over dense marks' },
      { name: 'crosshair-z', value: '2', tier: 'A-impl', source: 'Highcharts `crosshair.zIndex: 2` (above grid\'s 1)' },
      { name: 'crosshair-label-radius', value: '3px', tier: 'A-impl', source: 'Highcharts `crosshair.label.borderRadius: 3`' },
      { name: 'crosshair-label-padding', value: '8px', tier: 'A-impl', source: 'Highcharts `crosshair.label.padding: 8`' },
      { name: 'crosshair-label-font-size', value: '11px', tier: 'A-impl', source: 'Highcharts `crosshair.label.style.fontSize: \'11px\'`' },
    ],
  },
];

/**
 * A worlds watching.
 */
export type ThemeVariant = {
  readonly id: string
  readonly note?: string
  /** Emit an OS preference block in addition to the explicit class/data attribute block. */
  readonly prefersColorScheme?: 'dark' | 'light'
  readonly overrides: readonly Token[]
}

const NEUTRAL_DARK_RAMP: readonly Token[] = [
  { name: 'ramp-neutral-1', value: '#101010', tier: 'C', source: 'B1 neutral palette derivation: true-neutral OKLCH ramp' },
  { name: 'ramp-neutral-2', value: '#252525', tier: 'C', source: 'B1 neutral palette derivation: true-neutral OKLCH ramp' },
  { name: 'ramp-neutral-3', value: '#3b3b3b', tier: 'C', source: 'B1 neutral palette derivation: true-neutral OKLCH ramp' },
  { name: 'ramp-neutral-4', value: '#525252', tier: 'C', source: 'B1 neutral palette derivation: true-neutral OKLCH ramp' },
  { name: 'ramp-neutral-5', value: '#696969', tier: 'C', source: 'B1 neutral palette derivation: true-neutral OKLCH ramp' },
  { name: 'ramp-neutral-6', value: '#858585', tier: 'C', source: 'B1 neutral palette derivation: true-neutral OKLCH ramp' },
  { name: 'ramp-neutral-7', value: '#a1a1a1', tier: 'C', source: 'B1 neutral palette derivation: true-neutral OKLCH ramp' },
  { name: 'ramp-neutral-8', value: '#c4c4c4', tier: 'C', source: 'B1 neutral palette derivation: true-neutral OKLCH ramp' },
  { name: 'ramp-neutral-9', value: '#e8e8e8', tier: 'C', source: 'B1 neutral palette derivation: true-neutral OKLCH ramp' },
]

const NEUTRAL_LIGHT_RAMP: readonly Token[] = [
  { name: 'ramp-neutral-1', value: '#121212', tier: 'C', source: 'B1 neutral palette derivation: true-neutral OKLCH ramp' },
  { name: 'ramp-neutral-2', value: '#282828', tier: 'C', source: 'B1 neutral palette derivation: true-neutral OKLCH ramp' },
  { name: 'ramp-neutral-3', value: '#3f3f3f', tier: 'C', source: 'B1 neutral palette derivation: true-neutral OKLCH ramp' },
  { name: 'ramp-neutral-4', value: '#565656', tier: 'C', source: 'B1 neutral palette derivation: true-neutral OKLCH ramp' },
  { name: 'ramp-neutral-5', value: '#6d6d6d', tier: 'C', source: 'B1 neutral palette derivation: true-neutral OKLCH ramp' },
  { name: 'ramp-neutral-6', value: '#898989', tier: 'C', source: 'B1 neutral palette derivation: true-neutral OKLCH ramp' },
  { name: 'ramp-neutral-7', value: '#a5a5a5', tier: 'C', source: 'B1 neutral palette derivation: true-neutral OKLCH ramp' },
  { name: 'ramp-neutral-8', value: '#c8c8c8', tier: 'C', source: 'B1 neutral palette derivation: true-neutral OKLCH ramp' },
  { name: 'ramp-neutral-9', value: '#ececec', tier: 'C', source: 'B1 neutral palette derivation: true-neutral OKLCH ramp' },
]

const NEUTRAL_DARK_SURFACE_OVERRIDES: readonly Token[] = [
  ...NEUTRAL_DARK_RAMP,
  { name: 'widget-radius', value: '4px', tier: 'C', source: 'B1 neutral escape hatch: field-convention radius' },
  { name: 'widget-shadow', value: '0 2px 8px rgb(0 0 0 / 0.18)', tier: 'C', source: 'B1 neutral escape hatch: field-convention elevation' },
  { name: 'tooltip-radius', value: '3px', tier: 'C', source: 'B1 neutral escape hatch: field-convention radius' },
  { name: 'tooltip-shadow', value: '0 2px 12px rgb(0 0 0 / 0.18)', tier: 'C', source: 'B1 neutral escape hatch: field-convention elevation' },
]

const NEUTRAL_LIGHT_SURFACE_OVERRIDES: readonly Token[] = [
  ...NEUTRAL_LIGHT_RAMP,
  { name: 'widget-radius', value: '6px', tier: 'C', source: 'B1 neutral escape hatch: field-convention radius' },
  { name: 'widget-shadow', value: '0 2px 10px rgb(0 0 0 / 0.16)', tier: 'C', source: 'B1 neutral escape hatch: field-convention elevation' },
  { name: 'tooltip-radius', value: '5px', tier: 'C', source: 'B1 neutral escape hatch: field-convention radius' },
  { name: 'tooltip-shadow', value: '0 2px 14px rgb(0 0 0 / 0.16)', tier: 'C', source: 'B1 neutral escape hatch: field-convention elevation' },
]

const NEUTRAL_DARK_SERIES: readonly Token[] = [
  { name: 'series-1', value: '#8dd3c7', tier: 'C', source: 'B1 neutral palette derivation: evenly spaced OKLCH hues on a dark ground' },
  { name: 'series-2', value: '#f28e7b', tier: 'C', source: 'B1 neutral palette derivation: evenly spaced OKLCH hues on a dark ground' },
  { name: 'series-3', value: '#7eb6d9', tier: 'C', source: 'B1 neutral palette derivation: evenly spaced OKLCH hues on a dark ground' },
  { name: 'series-4', value: '#b9a7d9', tier: 'C', source: 'B1 neutral palette derivation: evenly spaced OKLCH hues on a dark ground' },
  { name: 'series-5', value: '#f2bd75', tier: 'C', source: 'B1 neutral palette derivation: evenly spaced OKLCH hues on a dark ground' },
  { name: 'series-6', value: '#a8c96f', tier: 'C', source: 'B1 neutral palette derivation: evenly spaced OKLCH hues on a dark ground' },
]

const NEUTRAL_LIGHT_SERIES: readonly Token[] = [
  { name: 'series-1', value: '#00695c', tier: 'C', source: 'B1 neutral palette derivation: evenly spaced OKLCH hues on a light ground' },
  { name: 'series-2', value: '#b23a31', tier: 'C', source: 'B1 neutral palette derivation: evenly spaced OKLCH hues on a light ground' },
  { name: 'series-3', value: '#185b83', tier: 'C', source: 'B1 neutral palette derivation: evenly spaced OKLCH hues on a light ground' },
  { name: 'series-4', value: '#654c9b', tier: 'C', source: 'B1 neutral palette derivation: evenly spaced OKLCH hues on a light ground' },
  { name: 'series-5', value: '#986000', tier: 'C', source: 'B1 neutral palette derivation: evenly spaced OKLCH hues on a light ground' },
  { name: 'series-6', value: '#4f7622', tier: 'C', source: 'B1 neutral palette derivation: evenly spaced OKLCH hues on a light ground' },
]

export const THEME_VARIANTS: readonly ThemeVariant[] = [
  {
    id: 'rail-light',
    prefersColorScheme: 'light',
    note: 'Same six wavelengths, re-solved for a light ground. 43-theming.md §2.',
    overrides: [
      { name: 'surface-color', value: '#f4f3ef', tier: 'C', source: 'DESIGN.md:63' },
      { name: 'tooltip-color', value: 'var(--shiftcharts-ramp-neutral-8)', tier: 'C', source: 'SB-005: light tooltip surface paired with dark theme text' },
      {
        name: 'surface-text-color',
        value: 'var(--shiftcharts-ramp-neutral-2)',
        tier: 'B',
        source: 'A4 — see `--shiftcharts-surface-text-color` above.',
        aside: '21.0:1 on the ground.',
      },
      { name: 'series-1', value: '#084962', tier: 'B', source: 'DESIGN.md:52', aside: 'H-beta   ·  8.84' },
      { name: 'series-2', value: '#784009', tier: 'B', source: 'DESIGN.md:53', aside: 'Na I D₂  ·  7.46' },
      { name: 'series-3', value: '#137e10', tier: 'B', source: 'DESIGN.md:54', aside: 'Mg b₂    ·  4.71' },
      { name: 'series-4', value: '#801bef', tier: 'B', source: 'DESIGN.md:55', aside: 'H-delta  ·  5.70' },
      { name: 'series-5', value: '#0d625d', tier: 'B', source: 'DESIGN.md:56', aside: 'He I     ·  6.47' },
      { name: 'series-6', value: '#710805', tier: 'B', source: 'DESIGN.md:57', aside: 'Fe I     · 10.88' },
    ],
  },
  {
    id: 'neutral',
    note: 'Neutral dark escape hatch: true-neutral ramp and evenly spaced categorical hues.',
    overrides: [
      { name: 'surface-color', value: '#181818', tier: 'C', source: 'B1 neutral palette derivation: neutral dark ground' },
      { name: 'surface-text-color', value: 'var(--shiftcharts-ramp-neutral-8)', tier: 'C', source: 'B1 neutral palette derivation: dark-ground text index' },
      ...NEUTRAL_DARK_SURFACE_OVERRIDES,
      ...NEUTRAL_DARK_SERIES,
    ],
  },
  {
    id: 'neutral-light',
    note: 'Neutral light escape hatch: true-neutral ramp and evenly spaced categorical hues.',
    overrides: [
      { name: 'surface-color', value: '#f7f7f7', tier: 'C', source: 'B1 neutral palette derivation: neutral light ground' },
      { name: 'surface-text-color', value: 'var(--shiftcharts-ramp-neutral-3)', tier: 'C', source: 'B1 neutral palette derivation: light-ground text index' },
      ...NEUTRAL_LIGHT_SURFACE_OVERRIDES,
      ...NEUTRAL_LIGHT_SERIES,
    ],
  },
]

/** Flat, in emitted order. */
export const ALL_TOKENS: readonly Token[] = TOKEN_GROUPS.flatMap((group) => group.tokens)

/**
 * How much of the tree is actually specified.
 *
 * ⚠ This remains a **number the build prints**, not a paragraph in a plan that can go stale.
 * B1's shipped tree is complete; the census now protects it against regressions. `untiered`
 * falls to zero by transcribing `raw/06` §6.2–6.9;
 * `unverified` falls only by finding a source or taking a measurement, and
 * `30-implementation-plan.md` §B1 is explicit that it must never fall by relabelling.
 *
 * @returns Counts keyed by tier, zeroes included, so a tier that empties stays visible.
 */
export function tierCensus(tokens: readonly Token[] = ALL_TOKENS): Record<Tier, number> {
  const census: Record<Tier, number> = {
    'A-lit': 0,
    'A-impl': 0,
    B: 0,
    C: 0,
    unverified: 0,
    untiered: 0,
  }
  for (const token of tokens) census[token.tier] += 1
  return census
}
