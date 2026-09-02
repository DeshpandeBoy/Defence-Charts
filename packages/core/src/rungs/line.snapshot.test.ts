/**
 * Gate **G9** — `(type, size, shape) → plan`, per rung, against the hand-authored spec.
 *
 * `research/40-chart-plan.md` §6 hand-authors all six line/area rungs as JSONC before any
 * code existed, and calls itself *"the cheap paper version of the A3 snapshot suite"*. This
 * is the expensive version. The expected plans below are **transcribed from §6 by hand**,
 * not captured from the implementation — a machine-generated snapshot of the resolver only
 * proves the resolver agrees with itself.
 *
 * ⚠ Where §6 elides a group as *"differs from …"*, the elided group is identical to the rung
 * above and is written out in full here. §1.1 forbids diffs in the *type*; it does not
 * forbid the spec document from using them as prose, so expanding them is part of the
 * transcription rather than a departure from it.
 *
 * ⚠ **`toEqual`, not `toMatchObject`.** A partial match would pass while a field §6 never
 * mentions quietly appeared, and §1.1's totality claim is exactly the claim a partial match
 * cannot check.
 */

import { describe, expect, it } from 'vitest'

import { planChart } from './../plan-chart.ts'
import type { ChartPlan } from './../plan.ts'
import { AXIS_OFF } from './../plan.ts'
import { DEFAULT_POLICY } from './../policy.ts'
import {
  CANVAS,
  MANY_SERIES,
  MICRO,
  PANEL,
  SHAPE,
  STAGE,
  STRIP,
  TILE,
  TILE_FLAT,
  TILE_SHORT,
} from './fixtures.ts'

const OFF = AXIS_OFF

/** Shared by every line/area rung: line and area never aggregate (§6, all six rows). */
const NO_AGGREGATE = {
  after: null,
  minShare: null,
  otherBucket: false,
  expandable: false,
  temporalBin: 'none',
} as const

// --- §6:542 Micro (1×1) ----------------------------------------------------------------

const MICRO_PLAN: ChartPlan = {
  type: 'line',
  sizeClass: 'micro',
  valueLegibility: 'single-value',
  orientation: 'vertical',
  regionOrder: ['value', 'table'],
  axes: { x: OFF, y: OFF, y2: null },
  marks: {
    primary: { kind: 'none' },
    points: { mode: 'none', autoHideDensityThreshold: null },
    pointBudget: 2000,
    renderer: 'svg',
    facet: { mode: 'none' },
  },
  labels: {
    seriesLabels: 'none',
    valueLabels: 'none',
    axisLabelDegrade: 'none',
    maxChars: null,
    seriesLabelMaxChars: null,
    labelHalo: 'none',
  },
  legend: { placement: 'absent' },
  interaction: {
    trigger: 'none',
    tooltip: { enabled: false, placement: 'fix' },
    crosshair: false,
    brush: false,
    zoom: false,
    legendToggle: false,
  },
  narrative: {
    // ⚠ `true` here and `false` at every larger rung. The non-monotonic field whose maximum
    // is at the smallest size — Kim et al.'s small-size-only `add`, and the single strongest
    // argument for §1.1's complete-specs-not-diffs rule.
    summaryPhrase: true,
    valueDisplay: 'latest',
    valueTypeScale: 'fit',
    deltaBasis: false,
    callouts: 'none',
    annotations: false,
    thresholdBands: false,
  },
  aggregate: NO_AGGREGATE,
  // ⚠ Present at 1×1. §4.8's inversion: the table matters most where value legibility is
  // weakest. `'widget-tap'` rather than a button, so nothing is concealed (§5.4).
  dataTable: {
    present: true,
    disclosure: 'widget-tap',
    initiallyExpanded: false,
    columns: 'summary',
  },
  motion: {
    durationClass: 'recompose',
    stages: 1,
    persistGridlines: false,
    objectConstancy: false,
  },
}

// --- §6:573 Tile (2×1 – 2×2) -----------------------------------------------------------

const TILE_PLAN: ChartPlan = {
  ...MICRO_PLAN,
  sizeClass: 'tile',
  regionOrder: ['value', 'plot', 'table'],
  marks: { ...MICRO_PLAN.marks, primary: { kind: 'line', area: false } },
  narrative: {
    ...MICRO_PLAN.narrative,
    summaryPhrase: false,
    valueDisplay: 'latest+delta',
    valueTypeScale: 'fit',
  },
}

// --- §6:592 Strip (3×1 – 4×2) ----------------------------------------------------------

const STRIP_PLAN: ChartPlan = {
  type: 'line',
  sizeClass: 'strip',
  // ⚠ A mark is drawn and the chart explicitly does NOT claim a reader can estimate values
  // from it — which is why `axes.y` is off. That pairing is gate G12.
  valueLegibility: 'shape-only',
  orientation: 'vertical',
  regionOrder: ['plot', 'table'],
  axes: {
    // ⚠ `'endpoints'` is a distinct state from `{ mode: 'count', count: 2 }`. Endpoints
    // label the extent of the data; two Talbot ticks label a readable scale. Collapsing
    // them would silently upgrade this rung to value-legible.
    x: { visible: true, domainLine: true, ticks: { mode: 'endpoints' }, title: false, gridlines: false, labelFlush: false, labelBound: false, tickBand: 'center', tickExtra: false, minExtent: 0, maxExtent: 0, translate: 0, strokeCap: 'butt', dashPhase: 0 },
    y: OFF,
    y2: null,
  },
  marks: {
    primary: { kind: 'line', area: false },
    points: { mode: 'none', autoHideDensityThreshold: null },
    pointBudget: 2000,
    renderer: 'svg',
    facet: { mode: 'none' },
  },
  labels: {
    seriesLabels: 'none',
    valueLabels: 'none',
    axisLabelDegrade: 'none',
    maxChars: null,
    seriesLabelMaxChars: null,
    labelHalo: 'none',
  },
  legend: { placement: 'internal', maxEntries: 8, flow: 'reserved' },
  interaction: {
    trigger: 'tap',
    tooltip: { enabled: true, placement: 'fix' },
    crosshair: false,
    brush: false,
    zoom: false,
    legendToggle: false,
  },
  narrative: {
    summaryPhrase: false,
    valueDisplay: 'none',
    valueTypeScale: 'fit',
    deltaBasis: false,
    callouts: 'none',
    annotations: false,
    thresholdBands: false,
  },
  aggregate: NO_AGGREGATE,
  dataTable: { present: true, disclosure: 'button', initiallyExpanded: false, columns: 'all' },
  motion: {
    durationClass: 'recompose',
    stages: 1,
    persistGridlines: false,
    objectConstancy: false,
  },
}

// --- §6:615 Panel (3×3 – 6×4) ----------------------------------------------------------

const PANEL_PLAN: ChartPlan = {
  ...STRIP_PLAN,
  sizeClass: 'panel',
  valueLegibility: 'values',
  axes: {
    // 500 px box − 53.27 px value-aware y gutter − 16 px symmetric plot inset =
    // 430.73 px plot, so `round(4.31)` = 4. Direct labels anchor inward and do not
    // consume a second rail.
    x: { visible: true, domainLine: true, ticks: { mode: 'count', count: 4 }, title: false, gridlines: false, labelFlush: false, labelBound: false, tickBand: 'center', tickExtra: false, minExtent: 0, maxExtent: 0, translate: 0, strokeCap: 'butt', dashPhase: 0 },
    // ⚠ `domainLine: false` with `gridlines: true`. Gridlines are the landmarks a reader
    // traces to a label; a rule beside them is ink that adds nothing.
    y: { visible: true, domainLine: false, ticks: { mode: 'count', count: 4 }, title: false, gridlines: true, labelFlush: false, labelBound: false, tickBand: 'center', tickExtra: false, minExtent: 0, maxExtent: 0, translate: 0, strokeCap: 'butt', dashPhase: 0 },
    y2: null,
  },
  // `seriesLabelMaxChars: 8` is the direct identity label's own compactness budget.
  // `maxChars` (the x-axis tick-label budget) stays `null`: 396.04 px across 4 tick slots
  // leaves enough room for the fixture's five-character labels.
  labels: { ...STRIP_PLAN.labels, seriesLabels: 'direct-end', seriesLabelMaxChars: 8 },
  // At this rung the legend IS the end-of-line labels. One fact, stated from two sides.
  legend: { placement: 'direct' },
  interaction: {
    trigger: 'hover',
    tooltip: { enabled: true, placement: 'fix' },
    crosshair: true,
    brush: false,
    zoom: false,
    legendToggle: false,
  },
  motion: {
    durationClass: 'recompose',
    stages: 2,
    persistGridlines: true,
    objectConstancy: false,
  },
}

// --- §6:640 Canvas (6×5 – 8×6) ---------------------------------------------------------

const CANVAS_PLAN: ChartPlan = {
  ...PANEL_PLAN,
  sizeClass: 'canvas',
  // The legend becomes a region of the box, so it joins the order.
  regionOrder: ['plot', 'legend', 'table'],
  axes: {
    // The data-shape y-label budget tightens the titled y gutter to the actual formatted
    // scale class. After that gutter, the right legend, and 16 px symmetric inset, the plot
    // resolves to five target tick slots. Direct labels remain an in-plot identity channel
    // and therefore do not charge a second right-side band.
    x: { visible: true, domainLine: true, ticks: { mode: 'count', count: 5 }, title: true, gridlines: false, labelFlush: false, labelBound: false, tickBand: 'center', tickExtra: false, minExtent: 0, maxExtent: 0, translate: 0, strokeCap: 'butt', dashPhase: 0 },
    y: { visible: true, domainLine: false, ticks: { mode: 'count', count: 4 }, title: true, gridlines: true, labelFlush: false, labelBound: false, tickBand: 'center', tickExtra: false, minExtent: 0, maxExtent: 0, translate: 0, strokeCap: 'butt', dashPhase: 0 },
    y2: null,
  },
  /**
   * The measured five-slot composition retains enough room for the fixture's worst-case
   * five-character label after mandatory spacing. Canvas therefore keeps §6's `none`
   * degradation while using the shared plot inset.
   */
  labels: PANEL_PLAN.labels,
  marks: { ...PANEL_PLAN.marks, points: { mode: 'all', autoHideDensityThreshold: 2 } },
  // ⚠ Conditional on `shape.series > 4`. At ≤ 4 this rung keeps `'direct'` — §4.4's
  // non-monotonic rule. Canvas does not automatically have MORE legend than Panel.
  legend: {
    placement: 'external',
    position: 'right',
    maxEntries: 8,
    showValues: false,
    showPercent: false,
  },
  interaction: {
    trigger: 'hover',
    tooltip: { enabled: true, placement: 'fluid' },
    crosshair: true,
    brush: false,
    zoom: false,
    legendToggle: true,
  },
}

// --- §6:660 Stage (9×6 – 12×8+) --------------------------------------------------------

const STAGE_PLAN: ChartPlan = {
  ...CANVAS_PLAN,
  sizeClass: 'stage',
  axes: {
    // The same formatted-y-label metadata tightens both y-axis rails; after the external
    // legend and symmetric inset the Stage plot resolves to seven target tick slots.
    x: { visible: true, domainLine: true, ticks: { mode: 'count', count: 7 }, title: true, gridlines: false, labelFlush: false, labelBound: false, tickBand: 'center', tickExtra: false, minExtent: 0, maxExtent: 0, translate: 0, strokeCap: 'butt', dashPhase: 0 },
    y: { visible: true, domainLine: false, ticks: { mode: 'count', count: 4 }, title: true, gridlines: true, labelFlush: false, labelBound: false, tickBand: 'center', tickExtra: false, minExtent: 0, maxExtent: 0, translate: 0, strokeCap: 'butt', dashPhase: 0 },
    y2: { visible: true, domainLine: false, ticks: { mode: 'count', count: 4 }, title: true, gridlines: false, labelFlush: false, labelBound: false, tickBand: 'center', tickExtra: false, minExtent: 0, maxExtent: 0, translate: 0, strokeCap: 'butt', dashPhase: 0 },
  },
  marks: {
    ...CANVAS_PLAN.marks,
    // ⚠ Discovered by hand-authoring this rung, not by designing the type: "small multiples
    // if series > 4" is not a mark, axis or legend change.
    facet: { mode: 'series', columns: 3 },
  },
  // `labels` inherits `CANVAS_PLAN.labels` unchanged bar `valueLabels`; the direct series
  // label keeps its independent eight-character compactness budget.
  labels: { ...CANVAS_PLAN.labels, valueLabels: 'extrema' },
  interaction: { ...CANVAS_PLAN.interaction, brush: true, zoom: true },
  narrative: {
    summaryPhrase: false,
    valueDisplay: 'none',
    valueTypeScale: 12,
    deltaBasis: false,
    callouts: 'extrema',
    annotations: true,
    thresholdBands: true,
  },
}

// --- The gate --------------------------------------------------------------------------

const EXPECTED: readonly (readonly [
  name: string,
  ctx: typeof MICRO,
  shape: typeof SHAPE,
  plan: ChartPlan,
])[] = [
  ['Micro §6:542', MICRO, SHAPE, MICRO_PLAN],
  ['Tile §6:573', TILE, SHAPE, TILE_PLAN],
  ['Strip §6:592', STRIP, SHAPE, STRIP_PLAN],
  ['Panel §6:615', PANEL, SHAPE, PANEL_PLAN],
  ['Canvas §6:640', CANVAS, MANY_SERIES, CANVAS_PLAN],
  ['Stage §6:660', STAGE, MANY_SERIES, STAGE_PLAN],
]

describe('G9 — the six rungs reproduce research/40-chart-plan.md §6', () => {
  for (const [name, ctx, shape, expected] of EXPECTED) {
    it(name, () => {
      expect(planChart('line', ctx, shape)).toEqual(expected)
    })
  }

  it("'area' differs from 'line' by exactly one field", () => {
    for (const [name, ctx, shape, expected] of EXPECTED) {
      const area = planChart('area', ctx, shape)
      const wanted: ChartPlan = {
        ...expected,
        type: 'area',
        marks: {
          ...expected.marks,
          primary:
            expected.marks.primary.kind === 'line'
              ? { kind: 'line', area: true }
              : expected.marks.primary,
        },
      }
      expect(area, name).toEqual(wanted)
    }
  })
})

describe("G9 — Tile's three mark states, chosen by measured plot height", () => {
  // §6: "all driven by measured plot height rather than by size class, which is why
  // `sizeClass` alone is not sufficient input to the resolver."
  it('line at or above plotHeightOptimal', () => {
    expect(planChart('line', TILE, SHAPE).marks.primary).toEqual({ kind: 'line', area: false })
  })

  it('1-band horizon between horizonMinHeight and plotHeightOptimal', () => {
    expect(planChart('line', TILE_SHORT, SHAPE).marks.primary).toEqual({
      kind: 'horizon',
      bands: 1,
    })
  })

  it('no mark below horizonMinHeight', () => {
    expect(planChart('line', TILE_FLAT, SHAPE).marks.primary).toEqual({ kind: 'none' })
  })

  it("degenerates to Micro's regionOrder while keeping Tile's valueDisplay", () => {
    const flat = planChart('line', TILE_FLAT, SHAPE)
    expect(flat.regionOrder).toEqual(['value', 'table'])
    expect(flat.narrative.valueDisplay).toBe('latest+delta')
    expect(flat.sizeClass).toBe('tile')
  })

  it('policy.substitute: false pins the line at all three heights', () => {
    const pinned = { substitute: false }
    for (const ctx of [TILE, TILE_SHORT, TILE_FLAT]) {
      expect(planChart('line', ctx, SHAPE, pinned).marks.primary).toEqual({
        kind: 'line',
        area: false,
      })
    }
  })

  it('the thresholds come from policy, not from literals', () => {
    // Raise the floor above the fixture's 20 px plot and the horizon must vanish.
    expect(
      planChart('line', TILE_SHORT, SHAPE, { horizonMinHeight: 30, plotHeightOptimal: 60 }).marks
        .primary,
    ).toEqual({ kind: 'none' })
    // Lower the optimal below the measured plot that remains after the compact summary band and
    // the line must come back.
    expect(
      planChart('line', TILE_SHORT, SHAPE, { plotHeightOptimal: 7 }).marks.primary,
    ).toEqual({ kind: 'line', area: false })
  })
})

describe('G9 — the conditionals at Canvas and Stage', () => {
  it("Canvas keeps a 'direct' legend at four series or fewer", () => {
    const plan = planChart('line', CANVAS, { ...SHAPE, series: 4 })
    expect(plan.legend).toEqual({ placement: 'direct' })
    expect(plan.regionOrder).toEqual(['plot', 'table'])
  })

  it('Canvas externalises past four series', () => {
    expect(planChart('line', CANVAS, { ...SHAPE, series: 5 }).legend).toEqual({
      placement: 'external',
      position: 'right',
      maxEntries: DEFAULT_POLICY.legendMaxEntries,
      showValues: false,
      showPercent: false,
    })
  })

  it('Stage facets past four series and not at four', () => {
    expect(planChart('line', STAGE, { ...SHAPE, series: 4 }).marks.facet).toEqual({ mode: 'none' })
    expect(planChart('line', STAGE, { ...SHAPE, series: 5 }).marks.facet).toEqual({
      mode: 'series',
      columns: 3,
    })
  })

  it('facet columns never exceed the series count', () => {
    const wide = { ...STAGE, width: 3000, aspect: 'ultrawide' as const }
    expect(planChart('line', wide, { ...SHAPE, series: 5 }).marks.facet).toEqual({
      mode: 'series',
      columns: 4,
    })
  })

  it('Stage omits the secondary axis for a single series', () => {
    // ⚠ Tier C. §4.1 calls y2 "optional" and never says what makes it optional; `DataShape`
    // cannot express the thing that justifies one. Two axes against one series is the case
    // that is indefensible at any size, so that is the case this declines.
    expect(planChart('line', STAGE, { ...SHAPE, series: 1 }).axes.y2).toBeNull()
    expect(planChart('line', STAGE, { ...SHAPE, series: 2 }).axes.y2).not.toBeNull()
  })
})

describe('G9 — the renderer flips rather than sampling', () => {
  it('stays svg at the budget and flips above it', () => {
    const at = planChart('line', PANEL, { ...SHAPE, points: DEFAULT_POLICY.pointBudget })
    const over = planChart('line', PANEL, { ...SHAPE, points: DEFAULT_POLICY.pointBudget + 1 })
    expect(at.marks.renderer).toBe('svg')
    expect(over.marks.renderer).toBe('canvas')
    // §4.2: "never silently sample". The plan carries no sampling field at all, and the
    // point budget it reports is the policy's, unmodified.
    expect(over.marks.pointBudget).toBe(DEFAULT_POLICY.pointBudget)
  })
})

describe('G9 — unimplemented types throw rather than falling back', () => {
  it('does not return a plan for them', () => {
    // A silent fallback is the failure species this project keeps naming: a thing that
    // looks like it works and quietly doesn't.
    for (const type of ['funnel'] as const) {
      expect(() => planChart(type, PANEL, SHAPE)).toThrow()
    }
  })
})
