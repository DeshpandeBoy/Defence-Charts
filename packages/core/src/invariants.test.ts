/**
 * Gate **G12**, and the four §1 constraints that hold over every plan.
 *
 * G12 is one line — `valueLegibility !== 'values'` implies `!axes.y.visible` — and it is the
 * cheapest possible guard on the library's central claim (`research/40-chart-plan.md`:151,
 * `DESIGN.md`): *an axis a reader cannot read values off is a promise the chart cannot keep.*
 * Everything else in this file exists because §1's four constraints are acceptance criteria
 * rather than style preferences, and three of the four are violated by the obvious design.
 *
 * ⚠ **These run over a corpus, not over six fixtures.** A rung is correct at the size the
 * snapshot names it at; an invariant has to hold at every size, every shape, and after any
 * override. G9 checks the first thing. This checks the second, which is why the corpus below
 * sweeps rather than enumerating.
 */

import { describe, expect, it } from 'vitest'

import { sizeContextFromPixels, type DataShape, type SizeContext } from './context.ts'
import { applyOverrides, ATOMIC_PATHS, NULLABLE_PATHS } from './overrides.ts'
import { planChart } from './plan-chart.ts'
import type { ChartPlan, RegionName } from './plan.ts'
import { DEFAULT_POLICY } from './policy.ts'
import {
  coveredBy,
  describeNodes,
  divergentPaths,
  MANY_SERIES,
  ONE_SERIES,
  PANEL,
  SHAPE,
  SIX,
  TILE_FLAT,
  TILE_SHORT,
} from './rungs/fixtures.ts'

// --- The corpus ------------------------------------------------------------------------

type Case = readonly [name: string, plan: ChartPlan]

const SHAPES: readonly (readonly [string, DataShape])[] = [
  ['3 series', SHAPE],
  ['6 series', MANY_SERIES],
  ['1 series', ONE_SERIES],
  ['long labels', { ...SHAPE, labelMaxChars: 24 }],
  ['over budget', { ...SHAPE, points: DEFAULT_POLICY.pointBudget + 1 }],
]

function corpus(): readonly Case[] {
  const cases: Case[] = []

  const push = (label: string, ctx: SizeContext, shape: DataShape): void => {
    for (const type of ['line', 'area'] as const) {
      cases.push([`${type} ${label}`, planChart(type, ctx, shape)])
    }
  }

  for (const [rung, ctx] of SIX) for (const [name, shape] of SHAPES) push(`${rung} / ${name}`, ctx, shape)
  for (const [label, ctx] of [
    ['tile-short', TILE_SHORT],
    ['tile-flat', TILE_FLAT],
  ] as const) {
    push(label, ctx, SHAPE)
  }

  // A sweep, because an invariant that only holds at the six hand-picked sizes is not an
  // invariant. Steps are coprime-ish with the boundaries so they land inside families rather
  // than only on their edges.
  for (let w = 60; w <= 1300; w += 37) {
    for (const h of [50, 130, 290, 430, 660]) {
      push(`${w}×${h}`, sizeContextFromPixels(w, h), SHAPE)
    }
  }

  return cases
}

const CASES = corpus()

/** Every plan above, plus the same plans with awkward-but-legal overrides forced onto them. */
const WITH_OVERRIDES: readonly Case[] = [
  ...CASES,
  ...SIX.flatMap(([rung, ctx, shape]): Case[] => {
    const base = planChart('line', ctx, shape)
    return [
      [`${rung} + y2 from null`, applyOverrides(base, { axes: { y2: { visible: true } } })],
      [`${rung} + y2 off`, applyOverrides(base, { axes: { y2: null } })],
      [
        `${rung} + horizon`,
        applyOverrides(base, { marks: { primary: { kind: 'horizon', bands: 2 } } }),
      ],
      [
        `${rung} + external legend`,
        applyOverrides(base, {
          legend: {
            placement: 'external',
            position: 'bottom',
            maxEntries: 4,
            showValues: true,
            showPercent: false,
          },
        }),
      ],
    ]
  }),
]

it('the corpus is large enough to be worth running', () => {
  expect(CASES.length).toBeGreaterThan(300)
})

/**
 * ⚠ **The assertions below are conditional, and a conditional assertion over a corpus that
 * never satisfies the condition is a green test that checks nothing.** Every `continue` in
 * this file is a place that can happen silently. This is the guard: it asserts the corpus
 * reaches each state, so a fixture change that stops exercising one fails here rather than
 * quietly hollowing out the gate that depends on it.
 */
describe('the corpus reaches every state the gates branch on', () => {
  const reached = <T>(pick: (plan: ChartPlan) => T): Set<T> =>
    new Set(CASES.map(([, plan]) => pick(plan)))

  it('all three value-legibility claims', () => {
    expect([...reached((p) => p.valueLegibility)].sort()).toEqual([
      'shape-only',
      'single-value',
      'values',
    ])
  })

  it('all three mark states, including the empty one', () => {
    expect([...reached((p) => p.marks.primary.kind)].sort()).toEqual(['horizon', 'line', 'none'])
  })

  it('an internal legend and an external one', () => {
    const placements = reached((p) => p.legend.placement)
    expect(placements.has('external')).toBe(true)
    expect(placements.has('direct')).toBe(true)
    expect(placements.has('absent')).toBe(true)
  })

  it('a facet grid', () => {
    expect(reached((p) => p.marks.facet.mode).has('series')).toBe(true)
  })

  it('a secondary axis, and its absence', () => {
    expect(reached((p) => p.axes.y2 === null)).toEqual(new Set([true, false]))
  })

  it('both renderers', () => {
    expect([...reached((p) => p.marks.renderer)].sort()).toEqual(['canvas', 'svg'])
  })

  /**
   * ⚠ If this fails, `labels.maxChars` is `null` everywhere and the two label assertions
   * below are checking an empty set. `SHAPES` carries a 24-character fixture for exactly
   * this reason — §6 hand-authors `'none'` at every rung, so nothing in the published ladder
   * exercises `degradeXLabels()` at all.
   */
  it('label degradation past the first step', () => {
    const steps = reached((p) => p.labels.axisLabelDegrade)
    expect(steps.has('none')).toBe(true)
    expect([...steps].some((s) => s !== 'none')).toBe(true)
  })
})

// --- G12 -------------------------------------------------------------------------------

describe('G12 — the honesty claim, as an assertion', () => {
  it('a chart that does not claim values carries no visible y axis', () => {
    for (const [name, plan] of WITH_OVERRIDES) {
      if (plan.valueLegibility === 'values') continue
      expect(plan.axes.y.visible, name).toBe(false)
    }
  })

  /**
   * ⚠ The converse, asserted separately and on purpose. §3 states it as *"the chart claims
   * value legibility, **and must carry a y-axis**"* — so the implication runs both ways, and
   * a resolver that quietly dropped the y axis at a value-legible rung would satisfy G12 as
   * written while breaking the same promise from the other side.
   */
  it('a chart that claims values does carry one', () => {
    for (const [name, plan] of CASES) {
      if (plan.valueLegibility !== 'values') continue
      expect(plan.axes.y.visible, name).toBe(true)
      expect(plan.axes.y.ticks.mode, name).not.toBe('none')
    }
  })

  it("'single-value' states a number outright, since there is nothing to read", () => {
    for (const [name, plan] of CASES) {
      if (plan.valueLegibility !== 'single-value') continue
      expect(plan.narrative.valueDisplay, name).not.toBe('none')
    }
  })

  it("'shape-only' draws a mark — that is what distinguishes it from 'single-value'", () => {
    for (const [name, plan] of CASES) {
      if (plan.valueLegibility !== 'shape-only') continue
      expect(plan.marks.primary.kind, name).not.toBe('none')
    }
  })

  /**
   * §4.8's inversion, and the reason the data table is not an accessibility afterthought:
   * the table matters most exactly where `valueLegibility` is weakest. If it were ever
   * absent, the rungs that decline to claim value legibility would have no numbers at all.
   */
  it('the numbers are always reachable somewhere', () => {
    for (const [name, plan] of CASES) expect(plan.dataTable.present, name).toBe(true)
  })
})

// --- §1.4 plain and serialisable --------------------------------------------------------

describe('§1.4 — the plan survives a JSON round-trip unchanged', () => {
  it('deep-equals itself after JSON.parse(JSON.stringify(plan))', () => {
    for (const [name, plan] of WITH_OVERRIDES) {
      expect(JSON.parse(JSON.stringify(plan)), name).toEqual(plan)
    }
  })

  /**
   * The round-trip above passes for a plan containing `undefined` — the key vanishes on the
   * way out and `toEqual` treats a missing key and an `undefined` one as equal. So the
   * round-trip alone does not prove §1.4; this does.
   */
  it('contains no undefined, NaN, Infinity, or non-plain value', () => {
    for (const [name, plan] of WITH_OVERRIDES) {
      walk(plan, (path, value) => {
        const at = `${name} @ ${path}`
        expect(value, at).not.toBeUndefined()
        if (typeof value === 'number') expect(Number.isFinite(value), at).toBe(true)
        expect(typeof value, at).not.toBe('function')
        expect(typeof value, at).not.toBe('symbol')
        expect(typeof value, at).not.toBe('bigint')
        if (value !== null && typeof value === 'object') {
          expect(
            Object.getPrototypeOf(value) === Object.prototype || Array.isArray(value),
            `${at} — class instance, Date, Map or Set`,
          ).toBe(true)
        }
      })
    }
  })

  /**
   * Not a §1 constraint, but the reason `readonly` is on every field of `ChartPlan`: the plan
   * is snapshot-tested in isolation and sent server to client without its inputs, so a
   * mutable one can be edited between those two points and still look like the resolver's
   * output. `readonly` is compile-time only; this is the runtime half.
   */
  it('is frozen at every level, including after an override', () => {
    for (const [name, plan] of WITH_OVERRIDES) {
      walk(plan, (path, value) => {
        if (value !== null && typeof value === 'object') {
          expect(Object.isFrozen(value), `${name} @ ${path}`).toBe(true)
        }
      })
    }
  })
})

// --- §1.3 containment -------------------------------------------------------------------

/**
 * ⚠ Key names, never values. `legend.position: 'right'` is a legitimate state — it says
 * which side of the plot the legend sits on, which is a subdivision of the box. A key named
 * `right` would be an inset from the box's edge, which is an outer dimension.
 *
 * ⚠ `y2` is not on this list and is not a coordinate. It is the secondary y *axis*. The one
 * place a `y2` genuinely was an outer dimension is decision 012 — SVG `<line>` geometry —
 * and that is gate G14's problem, in the renderer, not this one's.
 */
const OUTER_DIMENSION_KEYS: ReadonlySet<string> = new Set([
  'width',
  'height',
  'margin',
  'padding',
  'inset',
  'gap',
  'offset',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'top',
  'bottom',
  'left',
  'right',
  'size',
])

describe('§1.3 — no field names an outer dimension', () => {
  it('no key anywhere in the tree could change the measured box', () => {
    for (const [name, plan] of WITH_OVERRIDES) {
      for (const path of describeNodes(plan).keys()) {
        const key = path.slice(path.lastIndexOf('.') + 1)
        expect(OUTER_DIMENSION_KEYS.has(key), `${name} @ ${path}`).toBe(false)
      }
    }
  })

  /**
   * The negative test is easy to pass by accident, so this checks the check: a plan that
   * *did* carry an outer dimension has to be caught. Without this, deleting the loop body
   * above would leave a green suite.
   */
  it('would catch one if it were added', () => {
    const planted = { ...planChart('line', PANEL, SHAPE), height: 300 }
    const keys = [...describeNodes(planted).keys()].map((p) => p.slice(p.lastIndexOf('.') + 1))
    expect(keys.some((k) => OUTER_DIMENSION_KEYS.has(k))).toBe(true)
  })
})

// --- §1.1 totality ----------------------------------------------------------------------

describe('§1.1 — complete specs, not diffs', () => {
  /**
   * The honest form of *"the deep key-path set is identical across all six rungs"*. It is
   * not identical, and it cannot be: `MarkSpec`, `TickPlan`, `FacetPlan` and `LegendPlan` are
   * discriminated unions, so their members legitimately carry different keys. What §1.1
   * forbids is an *optional* field — a key that means "inherit from the smaller rung".
   *
   * Those two are distinguishable, and the distinction is the whole point: a union member is
   * declared, a forgotten optional is not. Every divergence must be accounted for by
   * `ATOMIC_PATHS` or `NULLABLE_PATHS`. An undeclared one is either a new union nobody told
   * `applyOverrides()` about, or an optional field that should not exist.
   */
  it('every structural divergence between rungs is a declared union', () => {
    const plans = SIX.map(([, ctx, shape]) => planChart('line', ctx, shape))
    const undeclared = divergentPaths(plans).filter(
      (path) => !coveredBy(path, ATOMIC_PATHS) && !coveredBy(path, NULLABLE_PATHS),
    )
    expect(undeclared).toEqual([])
  })

  it('and the walk finds the divergences it should', () => {
    const plans = SIX.map(([, ctx, shape]) => planChart('line', ctx, shape))
    // If this ever shrinks to nothing, the assertion above became vacuous.
    expect(divergentPaths(plans)).toEqual([
      'axes.x.ticks',
      'axes.y.ticks',
      'axes.y2',
      'legend',
      'marks.facet',
      'marks.primary',
    ])
  })

  it('the nine groups are present at every rung', () => {
    for (const [name, plan] of WITH_OVERRIDES) {
      expect(Object.keys(plan).sort(), name).toEqual([
        'aggregate',
        'axes',
        'dataTable',
        'interaction',
        'labels',
        'legend',
        'marks',
        'motion',
        'narrative',
        'orientation',
        'regionOrder',
        'sizeClass',
        'type',
        'valueLegibility',
      ])
    }
  })
})

// --- §3 regions -------------------------------------------------------------------------

describe('§3 — regionOrder lists exactly the present regions', () => {
  it('membership matches each group’s own statement of presence', () => {
    for (const [name, plan] of CASES) {
      const expected: RegionName[] = []
      if (plan.narrative.valueDisplay !== 'none') expected.push('value')
      if (plan.marks.primary.kind !== 'none') expected.push('plot')
      if (plan.legend.placement === 'external') expected.push('legend')
      if (plan.dataTable.present) expected.push('table')
      expect(plan.regionOrder, name).toEqual(expected)
    }
  })

  it('never repeats a region', () => {
    for (const [name, plan] of WITH_OVERRIDES) {
      expect(new Set(plan.regionOrder).size, name).toBe(plan.regionOrder.length)
    }
  })

  /**
   * ⚠ A `'direct'` or `'internal'` legend is not a top-level region. Those live inside the
   * plot; a reserved internal legend may charge a plot-internal band, but listing one here
   * would claim a second outer region and make the plan and layout disagree.
   */
  it('an internal legend is not a region', () => {
    for (const [name, plan] of CASES) {
      if (plan.legend.placement === 'external') continue
      expect(plan.regionOrder.includes('legend'), name).toBe(false)
    }
  })
})

// --- §3 the two fields that carry one fact ----------------------------------------------

describe('§3 — orientation and axisLabelDegrade agree', () => {
  /**
   * `plan.ts`:433 accepts this duplication deliberately — `orientation` is needed by
   * consumers that never inspect `labels`, and deriving it would make the plan
   * non-self-describing — and then says the two are *"bound by assertion rather than by
   * construction"*. This is that assertion. Without it the accepted duplication is just
   * duplication.
   */
  it("'axis-transpose' is exactly when the chart is horizontal", () => {
    for (const [name, plan] of CASES) {
      expect(plan.orientation === 'horizontal', name).toBe(
        plan.labels.axisLabelDegrade === 'axis-transpose',
      )
    }
  })

  it('maxChars is set only by the step that abbreviates', () => {
    for (const [name, plan] of CASES) {
      if (plan.labels.maxChars === null) continue
      expect(plan.labels.axisLabelDegrade, name).toBe('abbreviate')
      expect(plan.labels.maxChars, name).toBeGreaterThan(0)
    }
  })
})

// --- §4 the numeric floors --------------------------------------------------------------

describe('§4 — counts respect their policy floors', () => {
  it('a counted axis never falls below ticksMin', () => {
    for (const [name, plan] of CASES) {
      for (const axis of [plan.axes.x, plan.axes.y, plan.axes.y2]) {
        if (axis === null || axis.ticks.mode !== 'count') continue
        expect(axis.ticks.count, name).toBeGreaterThanOrEqual(DEFAULT_POLICY.ticksMin)
        expect(Number.isInteger(axis.ticks.count), name).toBe(true)
      }
    }
  })

  it('a facet grid always has at least one column and never more than one per series', () => {
    for (const [rung, ctx] of SIX) {
      for (const series of [1, 2, 5, 9, 40]) {
        const facet = planChart('line', ctx, { ...SHAPE, series }).marks.facet
        if (facet.mode === 'none') continue
        expect(facet.columns, `${rung} / ${series} series`).toBeGreaterThanOrEqual(1)
        expect(facet.columns, `${rung} / ${series} series`).toBeLessThanOrEqual(series)
      }
    }
  })

  it('motion never asks for more than two stages', () => {
    for (const [name, plan] of CASES) expect([1, 2], name).toContain(plan.motion.stages)
  })
})

// --- Helper ------------------------------------------------------------------------------

/** Every value in the tree, including the objects and arrays themselves. */
function walk(value: unknown, visit: (path: string, value: unknown) => void, path = '$'): void {
  visit(path, value)
  if (value === null || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((child, i) => walk(child, visit, `${path}[${i}]`))
    return
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    walk(child, visit, `${path}.${key}`)
  }
}
