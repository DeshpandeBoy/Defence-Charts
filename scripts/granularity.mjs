/**
 * Data for the **B2 granularity audit** — `research/30-implementation-plan.md`'s one-sentence
 * mandate for the milestone: *"`raw/06` §7 produced the granularity table across ten libraries.
 * Every ● in that table becomes a token or a plan field, or we write down why not."*
 *
 * Two things live here, deliberately in one file because they are one claim read two ways:
 *
 *   `parseGranularityTable` — turns `research/raw/06-design-tokens-widgets.md` §7.1's markdown
 *   table into data. The table itself stays the source of truth; this never hand-copies a row.
 *
 *   `DISPOSITIONS` — the other half of the sentence, keyed by the table's own knob labels. Each
 *   entry is one of three shapes: tokens named (cite `raw/06` §6.2–6.9's own token names, never
 *   invent a new one), a `ChartPlan` field named, or a `declined` reason with a source to check
 *   against. A row may carry more than one — "Axis line visibility" is both a token pair and a
 *   plan field, because the plan's boolean *is* the mechanism the token pair renders.
 *
 * ⚠ Plain JavaScript with JSDoc types, deliberately, matching `check-tokens.mjs` and
 * `check-api.mjs` — see either for why: a lint gate that needs the build to work cannot check
 * the build.
 */

/** Column order matches `raw/06-design-tokens-widgets.md` §7.1's header, left to right. */
export const COLUMN_KEYS = [
  'highcharts',
  'amcharts',
  'echarts',
  'vegaLite',
  'recharts',
  'nivo',
  'visx',
  'plot',
  'carbon',
  'spectrum',
]

/** Legend, §7.1: ● first-class · ◐ reachable but not first-class · ○ not exposed · ? unverified. */
const MARK_GLYPHS = ['●', '◐', '○', '?']

/**
 * @typedef {Record<COLUMN_KEYS[number], string | null>} MarkRow
 * @typedef {{ knob: string, marks: MarkRow }} GranularityRow
 */

/**
 * @param {string} line A markdown table row, e.g. `"| a | b | c |"`.
 * @returns {string[]} Trimmed cell contents, leading/trailing pipes discarded.
 */
function splitRow(line) {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return inner.split('|').map((cell) => cell.trim())
}

/**
 * @param {string} text
 * @returns {string}
 */
function stripMarkdown(text) {
  return text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * The first legend glyph a cell contains.
 *
 * ⚠ Not the first *character* — several cells lead with a `⚠` qualifier or a footnote marker
 * before the mark itself (row 30's Highcharts cell: `"⚠ ◐ *~~colours only~~ — **wrong**..."`).
 * Scanning for the glyph, not the position, is what keeps that row's mark `◐` instead of `null`.
 *
 * @param {string} cell
 * @returns {string | null}
 */
function firstMark(cell) {
  for (const char of cell) {
    if (MARK_GLYPHS.includes(char)) return char
  }
  return null
}

/**
 * Parse §7.1's table out of the research doc's raw markdown.
 *
 * @param {string} markdown Full contents of `research/raw/06-design-tokens-widgets.md`.
 * @returns {GranularityRow[]}
 */
export function parseGranularityTable(markdown) {
  const lines = markdown.split('\n')
  // ⚠ Not the first `| Knob |` — several per-library option tables in this doc happen to reuse
  // that header word for their own first column (Recharts' `tickSize` table, among others). The
  // granularity table is the only one whose second column is `Highcharts`.
  const headerIndex = lines.findIndex((line) => line.trim().startsWith('| Knob | Highcharts |'))
  if (headerIndex === -1) return []

  /** @type {GranularityRow[]} */
  const rows = []
  for (let i = headerIndex + 2; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim().startsWith('|')) break
    const cells = splitRow(line)
    if (cells.length < COLUMN_KEYS.length + 1) continue

    const knob = stripMarkdown(cells[0])
    /** @type {MarkRow} */
    const marks = /** @type {any} */ ({})
    COLUMN_KEYS.forEach((key, idx) => {
      marks[key] = firstMark(cells[idx + 1] ?? '')
    })
    rows.push({ knob, marks })
  }
  return rows
}

/**
 * @typedef {object} Disposition
 * @property {string[]} [tokens] `--shiftcharts-*` names (without the prefix) that cover this knob. Cite
 *   `raw/06` §6.2–6.9's own names — this manifest does not mint new ones.
 * @property {string[]} [planPaths] Dotted paths into `ChartPlan` (`packages/core/src/plan.ts`)
 *   that carry this knob's decision at the plan level, not just at the token level.
 * @property {{ reason: string, source: string }} [declined] Why this knob becomes neither a
 *   token nor a plan field. `source` is a repo-relative path checked to exist.
 * @property {string} [note] Free text — a §7.2 claim this row supports, or context the tokens/
 *   planPaths lists don't carry on their own.
 */

/** @type {Record<string, Disposition>} */
export const DISPOSITIONS = {
  'Line stroke width': {
    tokens: ['line-stroke-width'],
    note: 'Table stakes — §7.2: "Six to ten of the ten libraries expose each of these."',
  },
  'Dash pattern': {
    tokens: ['line-dash'],
    note: 'Table stakes, same §7.2 sentence as line stroke width.',
  },
  'Dash offset (phase)': {
    tokens: ['line-dash-offset', 'grid-dash-offset', 'axis-domain-dash-offset'],
    note:
      '§7.2 point 4 best-of-eight: "dash phase per guide element (Vega-Lite only)." The ● count ' +
      'alone overstates the field here — ECharts and Plot expose *a* dashOffset, just not per ' +
      'guide element; see `research/44-granularity.md` for the reading.',
  },
  'Stroke linecap / linejoin': {
    tokens: ['line-cap', 'line-join', 'line-miter-limit', 'grid-cap', 'axis-domain-cap', 'tick-cap'],
    note: '§7.2 point 4 best-of-eight: "stroke cap per guide element (Vega-Lite only)."',
  },
  'Gridline colour': {
    tokens: ['grid-color'],
    note: 'Table stakes.',
  },
  'Gridline width': {
    tokens: ['grid-width'],
    note: 'Table stakes.',
  },
  'Gridline dash': {
    tokens: ['grid-dash'],
  },
  'Minor grid / minor ticks': {
    tokens: ['grid-minor-visible', 'grid-minor-count', 'grid-minor-opacity', 'tick-minor-length', 'tick-minor-width'],
  },
  'Grid banding': {
    tokens: ['grid-band-color'],
  },
  'Tick count': {
    tokens: ['tick-count-min'],
    planPaths: ['axes.x.ticks.count', 'axes.y.ticks.count', 'axes.y2.ticks.count'],
  },
  'Tick density (px)': {
    tokens: ['tick-spacing-x', 'tick-spacing-y'],
    note: '§7.2 point 4 best-of-eight: "pixel-density tick spacing with separate x and y values (Plot only)."',
  },
  'Tick size (length)': {
    declined: {
      reason:
        'Ticks are drawn as `<line>` geometry; `x1`/`y1`/`x2`/`y2` are not CSS-settable in any ' +
        'browser, so a `--shiftcharts-tick-length` custom property could be declared but could never move ' +
        'the mark from a stylesheet — "a geometry token ships, is documented, and does nothing" ' +
        '(gate G14). `raw/06` §6.3 still records `--shiftcharts-tick-length: 5px` as a rendering constant; ' +
        'it is not a themeable token and this manifest does not list it as one.',
      source: 'research/decisions/012-no-line-element-for-tokened-geometry.md',
    },
  },
  'Tick padding': {
    tokens: ['tick-padding'],
    note: 'Table stakes.',
  },
  'Bar padding inner': {
    tokens: ['bar-gap-inner'],
    note: 'Table stakes.',
  },
  'Bar padding outer': {
    tokens: ['bar-gap-outer'],
    note: 'Table stakes.',
  },
  'Bar corner radius': {
    tokens: ['bar-radius'],
    note: 'Table stakes.',
  },
  'Bar min length / max width': {
    tokens: ['bar-min-length', 'bar-width-max'],
  },
  'Point size': {
    tokens: ['point-radius'],
    note: 'Table stakes. Already declared in `packages/tokens/src/tokens.ts` (tier `unverified`).',
  },
  'Point stroke (width + colour)': {
    tokens: ['point-stroke-width', 'point-stroke-color'],
    note: 'Table stakes.',
  },
  'Point auto-hide on density': {
    tokens: ['point-auto-hide-threshold'],
    note: '§7.2 point 4 best-of-eight: "point auto-hide on density (Highcharts only)."',
  },
  'Label offset': {
    tokens: ['label-offset'],
  },
  'Label overlap policy': {
    tokens: ['label-overlap', 'label-separation', 'label-rotate-limit', 'label-step', 'label-stagger-lines', 'label-stagger-max'],
    planPaths: ['labels.axisLabelDegrade'],
  },
  'Label halo / outline': {
    tokens: ['value-label-halo-width', 'value-label-halo-color', 'value-label-halo-opacity'],
    note: '§7.2 point 3, one of "two cheap wins where the field is weak."',
  },
  'Value-label conceal by size': {
    tokens: ['value-label-skip-width', 'value-label-skip-height'],
    note:
      'No `ChartPlan` field models per-mark concealment by size — it is a rendering rule the ' +
      'tokens carry directly, not a plan-level decision, so `planPaths` is deliberately empty.',
  },
  'Legend item gap': {
    tokens: ['legend-gap-column', 'legend-gap-row'],
    note: '§7.2 point 3, the other of "two cheap wins where the field is weak."',
  },
  'Axis line visibility': {
    tokens: ['axis-x-domain-visible', 'axis-y-domain-visible'],
    planPaths: ['axes.x.domainLine', 'axes.y.domainLine', 'axes.y2.domainLine'],
  },
  'Domain line style': {
    tokens: ['axis-domain-width', 'axis-domain-color', 'axis-domain-dash', 'axis-domain-dash-offset', 'axis-domain-cap'],
    note: 'Table stakes.',
  },
  'Crosshair style': {
    tokens: [
      'crosshair-width',
      'crosshair-color',
      'crosshair-opacity',
      'crosshair-dash',
      'crosshair-z',
      'crosshair-label-radius',
      'crosshair-label-padding',
      'crosshair-label-font-size',
    ],
    planPaths: ['interaction.crosshair'],
  },
  'Geometry that changes with chart size': {
    tokens: ['scale-ratio-s', 'scale-ratio-m', 'scale-ratio-l', 'size-breakpoint-m', 'size-breakpoint-l'],
    planPaths: ['sizeClass'],
    note:
      '§7.2 point 2: only two libraries do anything here, and both only rescale — neither ' +
      'reveals, conceals, relabels, aggregates, substitutes or transposes. `ChartPlan.sizeClass` ' +
      'plus the degrade ladder (`labels.axisLabelDegrade`, `aggregate.*`, `dataTable.*`) is the ' +
      'systematic version the survey found nowhere in the field.',
  },
  'Theming via CSS custom properties': {
    tokens: [],
    planPaths: [],
    note:
      'This row is the token tree itself — all of `packages/tokens/src/tokens.ts` — not a single ' +
      'named token. Its disposition is the tree existing and staying current with its generated ' +
      'CSS, which gate G17 already enforces. §7.2 point 1 is the delivery-mechanism claim this row ' +
      'supports: no surveyed library reaches chart *geometry* through CSS custom properties end to end.',
  },
}
