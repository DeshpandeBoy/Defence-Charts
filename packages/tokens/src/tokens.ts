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
 * ⚠ **No `var()` chain may be flattened.** `--gx-surface-text-color: var(--gx-ramp-neutral-9)` and
 * `--gx-motion-stage-delay: var(--gx-motion-stage-delay-rescale)` are *indirections on
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
 * work cannot check the build"*. `scripts/generate-typography-css.mjs` has to build `@gx/core`
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
  /** Without the `--gx-` prefix; `toCustomProperty()` in `./index.ts` adds it. */
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
    note: 'The charcoal continuum this world sits on.',
    tokens: [
      {
        name: 'surface-color',
        value: '#141618',
        tier: 'C',
        source: 'DESIGN.md:48 — ours, and no source is implied.',
      },
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
      'ground.** The theme picks an index instead; see `--gx-surface-text-color`.',
      '',
      '⚠ **The 100…900 spelling these carried until B1 slice 2 was a Material-style *weight*',
      'scale, and the renumbering to 1…9 is not cosmetic.** raw/06 §6.0 fixes `<modifier>` as',
      '`-1`…`-n`, and its own ramps are `--gx-ramp-seq-1..9` and `--gx-ramp-div-1..11` — one',
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
        value: 'var(--gx-ramp-neutral-9)',
        tier: 'B',
        source: 'A4 — a contrast failure measured in a browser, not reasoned about.',
        note: [
          'The ramp index this world writes with. Added at A4.',
          '',
          '⚠ **The ramp is absolute and the theme picks an index — this is where the picking',
          'happens, and until A4 nothing did it.** The ramp is documented as 1 darkest to 9',
          'lightest, which means it does *not* flip with the ground; a world that flips the ground',
          'and not the ink writes light-on-light. The `chart.css` in @gx/primitives set',
          '`color: var(--gx-ramp-neutral-9)` directly, so on the light ground every axis label, every',
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
      'construction that makes the claim true is `--gx-surface-text-color` above.',
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
    ],
  },

  {
    title: 'Marks',
    note: [
      'Added at A4, when @gx/primitives first needed them.',
      '',
      '⚠ **These are tokens and the four constants in layout.ts are NOT, and the dividing line is',
      'whether the resolver already subtracted the number.** Tick length feeds `xAxisBand()`, so a',
      'theme that changed it would move the glyphs and leave the band where it was. Stroke width',
      'and point radius feed nothing: the plot box is the same either way, so a theme may own them',
      'outright. See CHROME_METRICS in packages/core/src/layout.ts.',
      '',
      '`r` is a real CSS property in SVG2 and browsers shipped it, which is what makes',
      '`--gx-point-radius` a token rather than an attribute — decision 012.',
    ].join('\n'),
    tokens: [
      {
        name: 'line-stroke-width',
        value: '1.5px',
        tier: 'unverified',
        source: 'Conventional, not derived. B1 owes this a row from raw/06 §6.2 or a measurement.',
      },
      {
        name: 'point-radius',
        value: '2.5px',
        tier: 'unverified',
        source: 'Conventional, not derived. B1 owes this a row from raw/06 §6.2 or a measurement.',
      },
      {
        name: 'area-opacity',
        value: '0.15',
        tier: 'unverified',
        source: 'Conventional, not derived. B1 owes this a row from raw/06 §6.2 or a measurement.',
      },
      {
        name: 'horizon-band-opacity',
        value: '0.3',
        tier: 'unverified',
        source: 'Conventional, not derived. B1 owes this a row from raw/06 §6.2 or a measurement.',
        aside: 'The horizon ramp multiplies this by band index — see chart.css.',
      },
    ],
  },

  {
    title: 'Series colour',
    tokens: [
      {
        name: 'series-color',
        value: 'var(--gx-series-1)',
        tier: 'B',
        source: 'Ours — the indirection is the mechanism, not the value.',
        note: [
          'The colour a mark paints with. Defaults to the first emission line and is re-bound per',
          'series by the `chart.css` in @gx/primitives, so a single-series chart can be recoloured by',
          'setting one property on the figure rather than by reaching into a data attribute.',
        ].join('\n'),
      },
    ],
  },

  {
    title: 'Radius',
    tokens: [
      {
        name: 'widget-radius',
        value: '0',
        tier: 'C',
        source: 'DESIGN.md:196 — the Square Corner Rule. Ours.',
        aside: 'Unitless 0 is not a length literal, so it needs no gate exemption.',
      },
    ],
  },

  {
    title: 'Shadow',
    note: [
      'Elevation exists in name only and resolves to nothing. DESIGN.md:190.',
      '',
      '⚠ **The names must stay alive.** A token that exists in one theme only cannot be swapped by',
      'a class, which is the whole mechanism. 43-theming.md §3.2.',
    ].join('\n'),
    tokens: [
      { name: 'widget-shadow', value: 'none', tier: 'C', source: 'DESIGN.md:190' },
      { name: 'tooltip-shadow', value: 'none', tier: 'C', source: 'DESIGN.md:190' },
    ],
  },

  {
    title: 'Typography',
    note: [
      'The fit-insensitive part. Everything whose value is a function of the font metrics is',
      'generated into `typography.css` by scripts/generate-typography-css.mjs instead, from the',
      '`FittingTypography` in @gx/core — those tokens have no row here because their value is',
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
    ],
  },

  {
    title: 'Motion',
    note: [
      'Added at A6.',
      '',
      '⚠ **There is no `--gx-motion-enabled`, and its absence is the same decision as the missing',
      '`enabled` field on `MotionPlan`.** `40-chart-plan.md` §4: the server cannot read',
      '`prefers-reduced-motion`, so a token derived from it would differ between the server render',
      'and the client one. The plan carries the structural facts; the media query in the',
      '`chart.css` of @gx/primitives decides whether anything runs. Polarity there is',
      '`no-preference`, so the still chart is the baseline and motion is the addition.',
      '',
      '⚠ `--gx-motion-duration` is the ACTIVE one and is re-bound per figure from',
      '`data-motion-duration`, which `<Chart>` echoes from `plan.motion.durationClass`. The default',
      'is the fast end: a chart that somehow renders without the attribute moves less, rather than',
      'more, than it should.',
      '',
      '⚠ **The stage delay is derived per class HERE, and must never be written as',
      '`calc(var(--gx-motion-duration) / 2)`.** It was, and it was wrong in a way nothing caught: a',
      'custom property is substituted where it is *declared*, and the result is what inherits.',
      'Declared on `:root`, `calc(var(--gx-motion-duration) / 2)` resolves against the `:root`',
      'value — the rescale 300ms — and the token that inherits down to every figure is the already-',
      'computed `calc(300ms / 2)`. `chart.css` then rebinds `--gx-motion-duration: 1000ms` on the',
      'recompose figure and the delay does not follow, because there is no longer a `var()` left in',
      'it to re-resolve. Measured in Chromium: a recompose chart reported',
      '`--gx-motion-stage-delay: calc(300ms / 2)` and staged its marks 150ms behind a 1000ms chrome',
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
        value: 'calc(var(--gx-motion-duration-rescale) / 2)',
        tier: 'unverified',
        source: '10-responsive-ladder.md §7 specifies *that* a change is staged and gives no timing for the overlap.',
      },
      {
        name: 'motion-stage-delay-recompose',
        value: 'calc(var(--gx-motion-duration-recompose) / 2)',
        tier: 'unverified',
        source: '10-responsive-ladder.md §7 specifies *that* a change is staged and gives no timing for the overlap.',
        note: [
          '⚠ Half the duration puts stage 2 in motion while stage 1 is still settling, so the two read',
          'as one gesture with an order rather than as two animations queued; a full-duration delay',
          'serialises them and doubles the envelope. That is an argument, not a measurement — which',
          'is exactly what `unverified` means.',
        ].join('\n'),
      },
      {
        name: 'motion-duration',
        value: 'var(--gx-motion-duration-rescale)',
        tier: 'B',
        source: 'Ours — the active binding, re-pointed per figure by chart.css.',
      },
      {
        name: 'motion-stage-delay',
        value: 'var(--gx-motion-stage-delay-rescale)',
        tier: 'B',
        source: 'Ours — the active binding, re-pointed per figure by chart.css.',
      },
      {
        name: 'motion-easing',
        value: 'ease-out',
        tier: 'unverified',
        source: 'Named as UNVERIFIED in 30-implementation-plan.md §B1. Conventional; no source confirmed.',
      },
    ],
  },

  {
    title: 'Spacing',
    note: 'A calc() multiplier is not a length literal — 43-theming.md §6.2.',
    tokens: [
      {
        name: 'size-gap',
        value: '4px',
        tier: 'untiered',
        source: 'raw/06 §6 carries a specified row for this. Not yet transcribed.',
      },
      {
        name: 'plot-padding',
        value: 'calc(var(--gx-size-gap) * 2)',
        tier: 'untiered',
        source: 'raw/06 §6 carries a specified row for this. Not yet transcribed.',
      },
    ],
  },
]

/**
 * A world, re-solved for a different ground.
 *
 * ⚠ **Each variant is emitted TWICE and authored once**, which is half the reason it belongs
 * here. `prefers-color-scheme` picks the ground and a class picks the world, so there are four
 * combinations and not two (43-theming.md §2) — and until now the eight light values were
 * hand-written in both blocks, with the contrast ratios present in one copy and missing from
 * the other. Two hand-maintained copies of eight hex values is a drift no gate was watching.
 */
export type ThemeVariant = {
  readonly id: string
  readonly note?: string
  readonly overrides: readonly Token[]
}

export const THEME_VARIANTS: readonly ThemeVariant[] = [
  {
    id: 'rail-light',
    note: 'Same six wavelengths, re-solved for a light ground. 43-theming.md §2.',
    overrides: [
      { name: 'surface-color', value: '#f4f3ef', tier: 'C', source: 'DESIGN.md:63' },
      {
        name: 'surface-text-color',
        value: 'var(--gx-ramp-neutral-2)',
        tier: 'B',
        source: 'A4 — see `--gx-surface-text-color` above.',
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
]

/** Flat, in emitted order. */
export const ALL_TOKENS: readonly Token[] = TOKEN_GROUPS.flatMap((group) => group.tokens)

/**
 * How much of the tree is actually specified.
 *
 * ⚠ This exists so that B1's remaining work is a **number the build prints**, not a paragraph
 * in a plan that goes stale. `untiered` falls to zero by transcribing `raw/06` §6.2–6.9;
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
