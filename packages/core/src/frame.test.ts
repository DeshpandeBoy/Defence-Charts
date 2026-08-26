/**
 * `resolveFrame()` — and above all, the one invariant it exists to hold.
 *
 * ⚠ **The headline test in this file is `plot.width === resolvePlotBox().width`**, swept
 * across the same widths gate G10 sweeps. Everything else here is ordinary unit testing; that
 * one is the reason the module is written the way it is. `apps/playground/src/App.tsx` names
 * the failure in the small — *"two components each resolving their own plan would put two
 * disagreeing plot heights on one page"* — and a resolver and a renderer disagreeing about the
 * plot is the same bug with a longer fuse, because there is no second component on screen to
 * compare against. Both numbers look plausible. Nothing renders visibly wrong.
 */

import { describe, expect, it } from 'vitest'

import { sizeContextFromPixels } from './context.ts'
import type { Series } from './data.ts'
import { describeShape } from './data.ts'
import { DONUT_FAMILY_FIXTURE } from './families/donut/fixture.ts'
import { chromeFromPlan, resolveFrame } from './frame.ts'
import { legendBands, resolvePlotBox } from './layout.ts'
import { applyOverrides } from './overrides.ts'
import { planChart } from './plan-chart.ts'
import { DEFAULT_POLICY } from './policy.ts'
import { MANY_SERIES, MICRO, PANEL, SHAPE, STAGE, STRIP, TILE, TILE_FLAT, TILE_SHORT } from './rungs/fixtures.ts'
import { measureText, RANK_FONT_SIZE } from './text.ts'

/** Twelve months of 2024, UTC. Real enough to exercise the time ladder. */
function monthly(id: string, values: readonly (number | null)[]): Series {
  return {
    id,
    points: values.map((y, i) => ({ x: new Date(Date.UTC(2024, i, 1)), y })),
  }
}

const ONE = [monthly('a', [10, 14, 9, 22, 18, 31, 27, 25, 33, 29, 40, 36])] as const
const THREE = [
  monthly('a', [10, 14, 9, 22, 18, 31, 27, 25, 33, 29, 40, 36]),
  monthly('b', [5, 8, 12, 11, 16, 14, 19, 21, 18, 24, 22, 28]),
  monthly('c', [30, 28, 26, 27, 24, 22, 23, 20, 19, 17, 15, 12]),
] as const

const SIX_SERIES = [
  ...THREE,
  monthly('d', [12, 14, 16]),
  monthly('e', [8, 9, 11]),
  monthly('f', [4, 5, 6]),
] as const

const BAR_DATA: Series[] = [
  { id: 'a', points: [{ x: 0, y: 10 }, { x: 1, y: 14 }, { x: 2, y: 9 }] },
  { id: 'b', points: [{ x: 0, y: 5 }, { x: 1, y: 8 }, { x: 2, y: 12 }] },
  { id: 'c', points: [{ x: 0, y: 3 }, { x: 1, y: 6 }, { x: 2, y: 11 }] },
]

/** Same ten-category fixture the family matrix ships, whose values sum to 107. */
const DONUT_DATA: Series[] = [
  {
    id: 'programs',
    points: DONUT_FAMILY_FIXTURE.values.map((y, i) => ({ x: i, y })),
  },
]
const DONUT_SHAPE = describeShape(DONUT_DATA)

describe('the plot box is the resolver’s, not a second opinion', () => {
  /**
   * ⚠ The sweep matters more than any single width. A re-derivation that happens to agree at
   * one size is the worst possible outcome — it passes, and then diverges at the boundary
   * where a band appears or disappears, which is exactly where a reader is looking.
   */
  const HEIGHTS = [140, 340, 700] as const

  for (const height of HEIGHTS) {
    it(`agrees at every width, ${height} px tall`, () => {
      const mismatches: string[] = []
      for (let w = 40; w <= 1400; w += 4) {
        const ctx = sizeContextFromPixels(w, height)
        const plan = planChart('line', ctx, MANY_SERIES)
        const frame = resolveFrame(plan, THREE, ctx)
        const box = resolvePlotBox(ctx, chromeFromPlan(plan), THREE.length, DEFAULT_POLICY)
        if (frame.plot.width !== box.width || frame.plot.height !== box.height) {
          mismatches.push(
            `${String(w)}×${String(height)}: frame ${String(frame.plot.width)}×${String(
              frame.plot.height,
            )} vs resolver ${String(box.width)}×${String(box.height)}`,
          )
        }
      }
      expect(mismatches).toEqual([])
    })
  }

  it('stays inside the measured box', () => {
    for (const ctx of [STRIP, PANEL, STAGE]) {
      const frame = resolveFrame(planChart('line', ctx, SHAPE), THREE, ctx)
      expect(frame.plot.x).toBeGreaterThanOrEqual(0)
      expect(frame.plot.y).toBeGreaterThanOrEqual(0)
      expect(frame.plot.x + frame.plot.width).toBeLessThanOrEqual(frame.box.width)
      expect(frame.plot.y + frame.plot.height).toBeLessThanOrEqual(frame.box.height)
    }
  })
})

describe('path strings', () => {
  it('is a pure function — the same inputs give a character-identical d', () => {
    const plan = planChart('line', PANEL, SHAPE)
    const a = resolveFrame(plan, THREE, PANEL)
    const b = resolveFrame(plan, THREE, PANEL)
    expect(a.series.map((s) => s.line)).toEqual(b.series.map((s) => s.line))
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  /**
   * ⚠ The assertion that `.digits(2)` is actually on. Without it d3 emits three decimals, and
   * `PATH_DIGITS` could be deleted as a no-op with every other test in this file still green.
   */
  it('rounds coordinates to two decimals', () => {
    const ctx = sizeContextFromPixels(437, 313)
    const frame = resolveFrame(planChart('line', ctx, SHAPE), THREE, ctx)
    const d = frame.series[0]?.line ?? ''
    expect(d).not.toBe('')
    const overPrecise = [...d.matchAll(/\d+\.(\d+)/g)].filter((m) => (m[1]?.length ?? 0) > 2)
    expect(overPrecise.map((m) => m[0])).toEqual([])
  })

  /**
   * ⚠ **The gap test.** `y: null` must break the path, not interpolate across it. A line drawn
   * through missing data asserts a measurement nobody took, and it is invisible — the chart
   * looks complete, which is precisely the problem. `M` appearing twice is d3 lifting the pen.
   */
  it('breaks the path at a null rather than drawing through it', () => {
    const gapped = [monthly('a', [10, 14, null, 22, 18, 31, 27, 25, 33, 29, 40, 36])]
    const frame = resolveFrame(planChart('line', PANEL, SHAPE), gapped, PANEL)
    const d = frame.series[0]?.line ?? ''
    expect(d.match(/M/g)).toHaveLength(2)
  })

  it('emits an area only when the plan asked for one', () => {
    const frame = resolveFrame(planChart('line', PANEL, SHAPE), ONE, PANEL)
    const plan = planChart('line', PANEL, SHAPE)
    const wantsArea = plan.marks.primary.kind === 'line' && plan.marks.primary.area
    expect(frame.series[0]?.area === null).toBe(!wantsArea)
  })
})

describe('ticks', () => {
  /**
   * ⚠ `'endpoints'` is first and last **data point**; `'count'` is nice values off the scale.
   * `plan.ts` is emphatic that collapsing the two *"would silently upgrade Strip to a
   * value-legible chart"*, and Strip does not claim value legibility — gate G12 asserts it
   * does not. This is that distinction, tested where it is implemented.
   */
  it('endpoints labels the data’s own extent, not a nice value', () => {
    const plan = planChart('line', STRIP, SHAPE)
    expect(plan.axes.x.ticks.mode).toBe('endpoints')

    const frame = resolveFrame(plan, ONE, STRIP)
    expect(frame.xTicks).toHaveLength(2)
    // ⚠ `'Dec'`, not `'Dec 01'` — and that is d3's multi-scale ladder working, not a bug.
    // Both instants are the first of a month, so neither reaches the day format; the January
    // one is also the first of a year, so it climbs one rung further. Tier **A-impl**: the
    // boundaries between scales are d3's judgement, transcribed in `./format.ts`.
    expect(frame.xTicks.map((t) => t.label)).toEqual(['2024', 'Dec'])
    // Endpoints sit on the plot's own edges by construction.
    expect(frame.xTicks[0]?.offset).toBe(0)
    expect(frame.xTicks[1]?.offset).toBeCloseTo(frame.plot.width, 6)
  })

  it('count asks the scale for round values', () => {
    const plan = planChart('line', PANEL, SHAPE)
    expect(plan.axes.x.ticks.mode).toBe('count')
    const frame = resolveFrame(plan, ONE, PANEL)
    expect(frame.xTicks.length).toBeGreaterThan(0)
    // Every tick lands inside the plot, offsets being plot-relative.
    for (const t of frame.xTicks) {
      expect(t.offset).toBeGreaterThanOrEqual(-1)
      expect(t.offset).toBeLessThanOrEqual(frame.plot.width + 1)
    }
  })

  it('adds a finite numeric tick from the raw domain value', () => {
    const base = planChart('line', PANEL, SHAPE)
    const plan = applyOverrides(base, { axes: { x: { tickExtra: true } } })
    const numeric: Series[] = [
      { id: 'a', points: [{ x: 0, y: 10 }, { x: 10, y: 20 }, { x: 20, y: 15 }] },
    ]
    const baseFrame = resolveFrame(base, numeric, PANEL)
    const frame = resolveFrame(plan, numeric, PANEL)
    const extra = frame.xTicks.at(-1)

    expect(frame.xTicks).toHaveLength(baseFrame.xTicks.length + 1)
    expect(typeof extra?.value).toBe('number')
    expect(extra?.value).toBeGreaterThan(baseFrame.xTicks.at(-1)?.value as number)
    expect(Number.isFinite(extra?.offset)).toBe(true)
  })

  it('keeps temporal extra ticks as valid ISO strings', () => {
    const base = planChart('line', PANEL, SHAPE)
    const plan = applyOverrides(base, { axes: { x: { tickExtra: true } } })
    const baseFrame = resolveFrame(base, ONE, PANEL)
    const frame = resolveFrame(plan, ONE, PANEL)
    const extra = frame.xTicks.at(-1)

    expect(frame.xTicks).toHaveLength(baseFrame.xTicks.length + 1)
    expect(typeof extra?.value).toBe('string')
    expect(Number.isNaN(Date.parse(extra?.value as string))).toBe(false)
    expect(Number.isFinite(extra?.offset)).toBe(true)
  })

  it('adds a finite extra tick on the inverted y axis', () => {
    const base = planChart('line', PANEL, SHAPE)
    const plan = applyOverrides(base, { axes: { y: { tickExtra: true } } })
    const baseFrame = resolveFrame(base, ONE, PANEL)
    const frame = resolveFrame(plan, ONE, PANEL)
    const extra = frame.yTicks.at(-1)
    const previous = baseFrame.yTicks.at(-1)

    expect(frame.yTicks).toHaveLength(baseFrame.yTicks.length + 1)
    expect(extra?.value).toBeGreaterThan(previous?.value as number)
    expect(extra?.offset).toBeLessThan(previous?.offset as number)
    expect(Number.isFinite(extra?.offset)).toBe(true)
  })

  it('emits nothing when the axis is off', () => {
    const plan = planChart('line', TILE_SHORT, SHAPE)
    expect(plan.axes.x.ticks.mode).toBe('none')
    expect(resolveFrame(plan, ONE, TILE_SHORT).xTicks).toEqual([])
  })

  /**
   * ⚠ **d3 `ticks()` does not promise distinct values, and A6 turned that into a visible bug.**
   *
   * Keying gridlines by `tick.value` — which is what gives a gridline a previous position to
   * transition *from*, `decisions/016` — assumes the values are unique. They are not. Swept
   * over seven magnitudes (`1e3`…`1e15`, a hundredfold apart) × ten spans (`1e-9`…`1e7`) ×
   * counts 2–12, **60 of those 770 combinations return duplicates**, all of them in the same
   * regime: a span small enough that d3's tick step underflows the float spacing available at
   * that magnitude, so consecutive ticks round to the same double. `[1e7, 1e7 + 1e-9]` at
   * count 3 asks for three and gets five, of which two are distinct.
   *
   * ⚠ The parameters above are stated because an earlier draft of this docblock reported a
   * different count from a sweep whose magnitudes and spans were never written down, and
   * `frame.ts` reported a third. Neither could be re-derived. A frozen ratio with no
   * reproduction is a number, not evidence — 60/770 is re-runnable from the line above.
   *
   * ⚠ `padDegenerate()` does not catch this and should not be widened to. It fires on
   * `lo === hi` exactly, which is a different fault — a domain with no extent at all. Here the
   * extent is real, merely unrepresentable at this magnitude.
   *
   * ⚠ Fixed in `computeTicks()` rather than in the key, and the reason is that a duplicate
   * value is not merely a key collision: identical value ⇒ identical label ⇒ identical offset
   * ⇒ identical `<rect>`. React would warn about the key, and the honest description of what
   * it is warning about is that we asked it to paint the same gridline twice. Deduping at the
   * source removes the waste and the collision in one move; deduping in the key would have
   * kept the waste and hidden it.
   */
  it('never emits the same tick value twice, however tight the domain', () => {
    // Chosen from the sweep: the smallest case that reproduces. Not a synthetic edge — this is
    // "a metric hovering around ten million with nanosecond-scale jitter", which is an ordinary
    // shape for a counter read twice in quick succession.
    const base = 1e7
    const tight: Series[] = [
      { id: 'a', points: [
        { x: new Date(Date.UTC(2024, 0, 1)), y: base },
        { x: new Date(Date.UTC(2024, 0, 2)), y: base + 1e-9 },
      ] },
    ]

    const frame = resolveFrame(planChart('line', PANEL, SHAPE), tight, PANEL)

    const values = frame.yTicks.map((t) => t.value)
    expect(values.length).toBeGreaterThan(0)
    expect(new Set(values).size).toBe(values.length)

    // The dedupe keeps the scale's own order rather than re-sorting: it drops repeats in
    // place. y offsets descend because the y range is inverted, so the check is monotone,
    // not ascending.
    const offsets = frame.yTicks.map((t) => t.offset)
    for (let i = 1; i < offsets.length; i += 1) {
      expect(offsets[i]).toBeLessThan(offsets[i - 1] as number)
    }
  })

  /**
   * ⚠ **What deduping by value does NOT fix, recorded rather than left to be rediscovered.**
   *
   * The two survivors above are `10000000` and `10000000.000000002`. They are distinct
   * doubles, so they are distinct keys and the identity fix is sound. They also both format
   * to **`"10M"`**, and at Panel they land 262px apart — top and bottom of the plot. The axis
   * reads `10M` at both ends, which looks like a rendering fault and is not one.
   *
   * This is a *legibility* bug, not an *identity* bug, and it is deliberately not fixed here:
   * the repair belongs to `format.ts`, which would have to notice that its chosen precision
   * cannot separate the domain and escalate — either to more significant figures or to an
   * offset axis (`10M + 0ns`, `+2ns`), which is a design question and not a formatting one.
   * A6 needed the keys to be unique and they are. Left as an assertion so the day someone
   * fixes it, this test tells them what else to update.
   */
  it('still collapses those two into one label — a known gap in format.ts, not in the keys', () => {
    const base = 1e7
    const tight: Series[] = [
      { id: 'a', points: [
        { x: new Date(Date.UTC(2024, 0, 1)), y: base },
        { x: new Date(Date.UTC(2024, 0, 2)), y: base + 1e-9 },
      ] },
    ]
    const frame = resolveFrame(planChart('line', PANEL, SHAPE), tight, PANEL)
    expect(frame.yTicks.map((t) => t.label)).toEqual(['10M', '10M'])
  })

  /**
   * ⚠ **A single data point gives `[v, v]`, which d3 maps entirely to the range's start.** A
   * flat line would render along the top edge and a one-point series at the left edge — both
   * look like layout bugs and neither is. `padDegenerate()` is the repair; this is its test.
   */
  it('puts a single point in the middle rather than on an edge', () => {
    const one: Series[] = [{ id: 'a', points: [{ x: new Date(Date.UTC(2024, 5, 1)), y: 42 }] }]
    const frame = resolveFrame(planChart('line', PANEL, SHAPE), one, PANEL)
    const p = frame.series[0]?.points[0]
    expect(p).toBeDefined()
    expect(p?.x).toBeCloseTo(frame.plot.x + frame.plot.width / 2, 6)
    expect(p?.y).toBeCloseTo(frame.plot.y + frame.plot.height / 2, 6)
  })
})

describe('timezone independence', () => {
  /**
   * ⚠ **Not a test that `TZ=UTC` took** — `packages/testing/src/determinism.test.ts` already
   * asserts that, and under the pin a `timeFormat()` bug is invisible anyway. This asserts the
   * stronger property the pin cannot: that the label is a function of the *instant*, so a
   * server in one zone and a browser in another produce byte-identical markup. Getting this
   * wrong is a hydration mismatch on every time axis, reported as a React warning about text
   * content and never mentioning a timezone.
   */
  it('labels an instant the same way regardless of host offset', () => {
    const plan = planChart('line', STRIP, SHAPE)
    const labels = resolveFrame(plan, ONE, STRIP).xTicks.map((t) => t.label)
    // 2024-01-01T00:00:00Z is 2023-12-31 in every negative-offset zone. A local formatter
    // would say "Dec 31" west of Greenwich and "2024" east of it.
    expect(labels[0]).toBe('2024')
  })

  it('carries tick values as ISO strings, so the frame survives JSON', () => {
    const frame = resolveFrame(planChart('line', STRIP, SHAPE), ONE, STRIP)
    const roundTripped = JSON.parse(JSON.stringify(frame)) as unknown
    expect(roundTripped).toEqual(frame)
  })
})

describe('the y axis', () => {
  /**
   * ⚠ **Zero is not forced into a line's domain, and that is deliberate.** Forcing zero is a
   * bar convention — a bar encodes value by length, so a truncated baseline lies about ratios.
   * A line encodes by position, and forcing zero on a series varying between 990 and 1010
   * flattens it into a horizontal rule showing nothing.
   */
  it('does not force zero for a line', () => {
    const tight = [monthly('a', [990, 1002, 995, 1010, 1001, 998, 1004, 992, 1007, 999, 1003, 996])]
    const frame = resolveFrame(planChart('line', PANEL, SHAPE), tight, PANEL)
    expect(frame.zeroLine).toBeNull()
    // The variation uses real vertical space rather than collapsing to a line.
    const ys = frame.series[0]?.points.map((p) => p.y) ?? []
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(frame.plot.height * 0.5)
  })

  it('reports a zero line when zero is inside the domain', () => {
    const signed = [monthly('a', [-5, 3, -2, 8, 1, -7, 4, 0, 6, -1, 9, 2])]
    const frame = resolveFrame(planChart('line', PANEL, SHAPE), signed, PANEL)
    expect(frame.zeroLine).not.toBeNull()
    expect(frame.zeroLine ?? 0).toBeGreaterThanOrEqual(frame.plot.y)
    expect(frame.zeroLine ?? 0).toBeLessThanOrEqual(frame.plot.y + frame.plot.height)
  })

  it('grows downward — a larger value sits higher on screen', () => {
    const frame = resolveFrame(planChart('line', PANEL, SHAPE), ONE, PANEL)
    const points = frame.series[0]?.points ?? []
    const lowest = points.reduce((a, b) => (a.value < b.value ? a : b))
    const highest = points.reduce((a, b) => (a.value > b.value ? a : b))
    expect(highest.y).toBeLessThan(lowest.y)
  })
})

describe('bar geometry', () => {
  it('keeps grouped endpoint bars inside the finite plot box', () => {
    const ctx = sizeContextFromPixels(500, 300)
    const plan = planChart('bar', ctx, describeShape(BAR_DATA))
    const frame = resolveFrame(plan, BAR_DATA, ctx)
    const right = frame.plot.x + frame.plot.width

    const bars = frame.series.flatMap((series) => series.cells)
    expect(bars).toHaveLength(BAR_DATA.length * 3)
    for (const bar of bars) {
      expect(bar.x).toBeGreaterThanOrEqual(frame.plot.x)
      expect(bar.x + bar.width).toBeLessThanOrEqual(right)
      expect(bar.y).toBeGreaterThanOrEqual(frame.plot.y)
      expect(bar.y + bar.height).toBeLessThanOrEqual(frame.plot.y + frame.plot.height)
    }
  })
})

describe('horizon', () => {
  /**
   * ⚠ Tile drops to a horizon below 24 px of plot because Heer 2009 measured that a line
   * degrades there and that the published fix is to *change encoding*, not to shrink. This
   * asserts the geometry that substitution produces.
   */
  it('emits one band per fold, all at the plot’s full height', () => {
    const plan = planChart('line', TILE_SHORT, SHAPE)
    expect(plan.marks.primary.kind).toBe('horizon')
    const bands = plan.marks.primary.kind === 'horizon' ? plan.marks.primary.bands : 0

    const frame = resolveFrame(plan, ONE, TILE_SHORT)
    expect(frame.series[0]?.bands).toHaveLength(bands)
    expect(frame.series[0]?.line).toBeNull()
    for (const band of frame.series[0]?.bands ?? []) {
      expect(band.sign).toBe(1)
      expect(band.d).not.toBe('')
    }
  })

  it('mirrors negatives into their own bands', () => {
    const plan = planChart('line', TILE_SHORT, SHAPE)
    const bands = plan.marks.primary.kind === 'horizon' ? plan.marks.primary.bands : 0
    const signed = [monthly('a', [-5, 3, -2, 8, 1, -7, 4, 0, 6, -1, 9, 2])]
    const frame = resolveFrame(plan, signed, TILE_SHORT)
    expect(frame.series[0]?.bands).toHaveLength(bands * 2)
    expect(new Set(frame.series[0]?.bands.map((b) => b.sign))).toEqual(new Set([1, -1]))
  })
})

describe('degenerate input', () => {
  it('returns a well-formed empty frame for no series', () => {
    const frame = resolveFrame(planChart('line', PANEL, SHAPE), [], PANEL)
    expect(frame.series).toEqual([])
    expect(frame.plot.width).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(frame.plot.height)).toBe(true)
  })

  /**
   * ⚠ A transient `0 × 0` measurement is routine — a `ResizeObserver` fires once before
   * layout settles. `resolvePlotBox()` says so, and every coordinate here must stay finite
   * through it or the first paint is a page full of `NaN` attributes.
   */
  it('stays finite at a zero-sized box', () => {
    const ctx = sizeContextFromPixels(0, 0)
    const frame = resolveFrame(planChart('line', ctx, SHAPE), THREE, ctx)
    // ⚠ `null` is *not* the thing being looked for here — a `null` line is the correct answer
    // for a Micro rung, whose mark kind is `'none'`. `NaN` is, because `NaN` reaches the DOM
    // as a literal attribute value and every coordinate downstream of it is poisoned.
    expect(JSON.stringify(frame)).not.toMatch(/NaN/)
    for (const p of frame.series[0]?.points ?? []) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })

  it('drops non-finite y values rather than emitting NaN coordinates', () => {
    const bad = [monthly('a', [10, Number.NaN, 12, Number.POSITIVE_INFINITY, 14, 9, 8, 7, 6, 5, 4, 3])]
    const frame = resolveFrame(planChart('line', PANEL, SHAPE), bad, PANEL)
    expect(frame.series[0]?.points).toHaveLength(10)
    expect(frame.series[0]?.line ?? '').not.toMatch(/NaN/)
  })
})

describe('series identity', () => {
  it('falls back to the id when a series carries no label', () => {
    const frame = resolveFrame(planChart('line', PANEL, SHAPE), ONE, PANEL)
    expect(frame.series[0]?.label).toBe('a')
    const labelled = resolveFrame(
      planChart('line', PANEL, SHAPE),
      [{ ...ONE[0], label: 'Revenue' }],
      PANEL,
    )
    expect(labelled.series[0]?.label).toBe('Revenue')
  })

  /**
   * ⚠ **Every defined point is in `points`, not only the ones the plan renders.** Geometry
   * belongs to the frame and the decision to draw belongs to the plan, so `<PointMarks>`
   * filters this list rather than the frame pre-filtering it. A5's crosshair does
   * nearest-neighbour search over it at rungs where `points.mode` is `'none'`.
   */
  it('carries every point even when the plan draws none of them', () => {
    const plan = planChart('line', PANEL, SHAPE)
    expect(plan.marks.points.mode).toBe('none')
    expect(resolveFrame(plan, ONE, PANEL).series[0]?.points).toHaveLength(12)
  })

  it('indexes extrema into points', () => {
    const frame = resolveFrame(planChart('line', PANEL, SHAPE), ONE, PANEL)
    const s = frame.series[0]
    expect(s?.extrema?.min).toBe(2) // the 9
    expect(s?.extrema?.max).toBe(10) // the 40
    expect(s?.extrema?.last).toBe(11)
  })

  it('has no extrema for a series with no defined values', () => {
    const empty = [monthly('a', [null, null, null])]
    const frame = resolveFrame(planChart('line', PANEL, SHAPE), empty, PANEL)
    expect(frame.series[0]?.extrema).toBeNull()
  })

  it('numbers series in order, for the colour ramp', () => {
    const frame = resolveFrame(planChart('line', PANEL, MANY_SERIES), THREE, PANEL)
    expect(frame.series.map((s) => s.index)).toEqual([0, 1, 2])
  })
})

// --- The value display -------------------------------------------------------------------

/**
 * ⚠ **This block exists because the band was being reserved and never painted into.**
 * `valueBand()` subtracts a strip off the top of the plot at Micro and Tile, `resolveFrame()`
 * used it as the plot's `y` origin, and nothing put a glyph in it — so the entire content of
 * the Micro rung (`marks.primary.kind: 'none'`, `regionOrder: ['value','table']`) was a value
 * display that did not exist. An empty `<svg>` with three empty `<g class="gx-series">` is
 * the failure species this project keeps naming: a thing that looks like it works and quietly
 * doesn't. Every test below is one half of "the band now has something in it, and it fits".
 */
describe('the value display', () => {
  const VERTICAL = DEFAULT_POLICY.typography.metrics.vertical
  const EM_HEIGHT = VERTICAL.ascent + VERTICAL.descent + VERTICAL.lineGap
  const MICRO_PX = sizeContextFromPixels(60, 24)

  /** The string actually painted — value, then a space, then the delta. */
  function painted(entry: { text: string; delta: { text: string } | null }): string {
    return entry.delta === null ? entry.text : `${entry.text} ${entry.delta.text}`
  }

  /** Width of `text` at `fontSize`, by the same model `fitValueDisplay()` fits with. */
  function widthAt(text: string, fontSize: number): number {
    return (measureText(text, 'A', DEFAULT_POLICY.typography.metrics) / RANK_FONT_SIZE.A) * fontSize
  }

  it('is null exactly when the plan asks for no value display', () => {
    const disagreements: string[] = []
    for (const [name, ctx] of [
      ['micro-60', MICRO_PX],
      ['micro', MICRO],
      ['tile', TILE],
      ['tile-short', TILE_SHORT],
      ['strip', STRIP],
      ['panel', PANEL],
      ['stage', STAGE],
    ] as const) {
      const plan = planChart('line', ctx, SHAPE)
      const frame = resolveFrame(plan, THREE, ctx)
      const asked = plan.narrative.valueDisplay !== 'none'
      if (asked !== (frame.value !== null)) {
        disagreements.push(`${name}: plan says ${plan.narrative.valueDisplay}, frame says ${String(frame.value)}`)
      }
    }
    expect(disagreements).toEqual([])
  })

  it('paints into the band the plot was pushed down by, not next to it', () => {
    const plan = planChart('line', MICRO, SHAPE)
    const frame = resolveFrame(plan, THREE, MICRO)
    expect(frame.value?.region.height).toBe(frame.plot.y)
    expect(frame.value?.region.y).toBe(0)
    expect(frame.value?.region.height).toBeGreaterThan(0)
  })

  it('reports a labelled primary value and makes the omitted series count explicit', () => {
    const frame = resolveFrame(planChart('line', MICRO, SHAPE), THREE, MICRO)
    expect(frame.value?.presentation).toEqual({ label: 'series', context: 'none' })
    expect(frame.value?.entries.map((e) => e.seriesId)).toEqual(['a'])
    expect(frame.value?.entries[0]?.text).toBe('36')
    expect(frame.value?.entries[0]?.label).toBe('a')
    expect(frame.value?.overflow?.hidden).toBe(2)
  })

  it('describes compact multi-series coverage instead of implying one value is the dataset', () => {
    const frame = resolveFrame(planChart('line', TILE, MANY_SERIES), SIX_SERIES, TILE)
    const coverage = frame.value?.coverage

    expect(coverage?.totalSeries).toBe(6)
    expect(coverage?.valueSeries).toBe(6)
    expect(coverage?.shownSeries).toBe(frame.value?.entries.length)
    expect(coverage?.hiddenSeries).toBe(frame.value?.overflow?.hidden ?? 0)
    expect((coverage?.shownSeries ?? 0) + (coverage?.hiddenSeries ?? 0)).toBe(6)
  })

  /**
   * ⚠ A series with nothing to report contributes **no entry**, not an em-dash. A placeholder
   * in a value display is a reading of the data, and there is no reading to give — the reader
   * would be told "the latest value is —", which is a claim rather than a silence.
   */
  it('gives an all-null series no entry at all', () => {
    const data = [monthly('a', [1, 2, 3]), monthly('b', [null, null, null])]
    const frame = resolveFrame(planChart('line', MICRO, SHAPE), data, MICRO)
    expect(frame.value?.entries.map((e) => e.seriesId)).toEqual(['a'])
    expect(frame.value?.entries[0]?.text).toBe('3')
  })

  /**
   * ⚠ **The colour is the only thing tying a painted number to its series, so the index has
   * to be the series', not the entry's.** A silent series shifts every entry after it up one
   * position; an index re-derived from the array would tint the third series with the
   * second's colour, and there is nothing on screen that would look wrong.
   */
  it('carries the series’ own index, not the entry’s position', () => {
    const data = [monthly('a', [null, null]), monthly('b', [1, 2]), monthly('c', [3, 4])]
    const frame = resolveFrame(planChart('line', MICRO, SHAPE), data, MICRO)
    expect(frame.value?.entries.map((e) => e.seriesId)).toEqual(['b', 'c'])
    expect(frame.value?.entries.map((e) => e.seriesIndex)).toEqual([1, 2])
    expect(frame.series.map((s) => s.index)).toEqual([0, 1, 2])
  })

  it('reports latest as the last defined point, skipping a trailing gap', () => {
    const data = [monthly('a', [1, 2, 42, null, null])]
    const frame = resolveFrame(planChart('line', MICRO, SHAPE), data, MICRO)
    expect(frame.value?.entries[0]?.text).toBe('42')
  })

  it('is a region with no entries when no series has a value — never null', () => {
    // Null means "the plan asked for nothing". Empty means "the plan asked, and the data had
    // no answer". The band is subtracted from the plot either way, so the two are different
    // states and the frame says which.
    const data = [monthly('a', [null, null])]
    const frame = resolveFrame(planChart('line', MICRO, SHAPE), data, MICRO)
    expect(frame.value).not.toBeNull()
    expect(frame.value?.entries).toEqual([])
    expect(frame.value?.fontSize).toBe(0)
  })

  describe('the delta', () => {
    it('is the change since the previous defined point, signed and directed', () => {
      const plan = planChart('line', TILE, SHAPE)
      expect(plan.narrative.valueDisplay).toBe('latest+delta')
      const data = [monthly('up', [10, 14])]
      const frame = resolveFrame(plan, data, TILE)
      expect(frame.value?.presentation).toEqual({ label: 'series', context: 'delta' })
      expect(frame.value?.entries.map((e) => e.delta)).toEqual([{ text: '+4', direction: 'up' }])
    })

    it('skips a gap to find the previous defined point', () => {
      const data = [monthly('a', [10, null, 14])]
      const frame = resolveFrame(planChart('line', TILE, SHAPE), data, TILE)
      expect(frame.value?.entries[0]?.delta?.text).toBe('+4')
    })

    it('renders only the value when there is no previous point to compare with', () => {
      const data = [monthly('a', [null, 14])]
      const frame = resolveFrame(planChart('line', TILE, SHAPE), data, TILE)
      expect(frame.value?.entries[0]?.text).toBe('14')
      expect(frame.value?.entries[0]?.delta).toBeNull()
    })

    it('is absent when the plan asked for the value alone', () => {
      const plan = planChart('line', MICRO, SHAPE)
      expect(plan.narrative.valueDisplay).toBe('latest')
      const frame = resolveFrame(plan, THREE, MICRO)
      expect(frame.value?.entries.every((e) => e.delta === null)).toBe(true)
    })
  })

  describe('the donut total', () => {
    /**
     * ⚠ Micro is the one rung where donut's `mark.kind` is `'none'`, so `SeriesFrame.arcs` is
     * always empty here — this is the exact condition VT-001 found broken (the total silently
     * summed that empty array to 0). The total must come from the raw defined points instead.
     */
    it('sums the raw series at Micro, where arc geometry is never built', () => {
      const plan = planChart('donut', MICRO, DONUT_SHAPE)
      expect(plan.marks.primary.kind).toBe('none')

      const frame = resolveFrame(plan, DONUT_DATA, MICRO)
      expect(frame.value?.entries).toHaveLength(1)
      expect(frame.value?.entries[0]?.text).toBe('107')
      expect(frame.value?.entries[0]?.unit).toBe('total')
    })

    it('agrees with the arc-built total at Tile, the only larger rung with both arcs and a value band', () => {
      // Strip/Panel/Canvas/Stage build arcs too, but donut's narrative turns the value band off
      // there (`valueDisplay: 'none'`) in favour of the compact key/legend, so there is no
      // `frame.value` to compare — Tile is the one rung where both paths are exercised at once.
      const plan = planChart('donut', TILE, DONUT_SHAPE)
      expect(plan.marks.primary.kind).toBe('arc')
      expect(plan.narrative.valueDisplay).toBe('latest')
      const frame = resolveFrame(plan, DONUT_DATA, TILE)
      expect(frame.value?.entries[0]?.text).toBe('107')
      expect(frame.value?.entries[0]?.unit).toBe('total')
    })

    it('has no value band at Strip, Panel, Canvas, or Stage, where the key/legend carries the total instead', () => {
      for (const ctx of [STRIP, PANEL, STAGE]) {
        const plan = planChart('donut', ctx, DONUT_SHAPE)
        expect(plan.marks.primary.kind).toBe('arc')
        expect(plan.narrative.valueDisplay).toBe('none')
        expect(resolveFrame(plan, DONUT_DATA, ctx).value).toBeNull()
      }
    })
  })

  describe('the fit', () => {
    const RUNGS = [
      ['micro-60', MICRO_PX],
      ['micro', MICRO],
      ['tile', TILE],
      ['tile-short', TILE_SHORT],
    ] as const

    it('gives every drawn value a font size above zero', () => {
      const empties: string[] = []
      for (const [name, ctx] of RUNGS) {
        const value = resolveFrame(planChart('line', ctx, SHAPE), THREE, ctx).value
        if ((value?.fontSize ?? 0) <= 0 || (value?.entries.length ?? 0) === 0) {
          empties.push(`${name}: ${String(value?.entries.length)} entries at ${String(value?.fontSize)} px`)
        }
      }
      expect(empties).toEqual([])
    })

    /**
     * ⚠ **The proof, not a sample.** `valueBand()` turns a type size into a band by
     * `height = (ascent + descent + lineGap) × fontSize`; the fit runs that equation
     * backwards, so multiplying the fitted size by the same em height must land back inside
     * the band it came from. If it ever does not, the text is overflowing a band the plot was
     * sized against — and the plot would not move, so nothing else in this suite could see it.
     */
    it('never fits text taller than the band it was given', () => {
      const overflows: string[] = []
      for (let w = 40; w <= 400; w += 4) {
        for (const h of [16, 24, 40, 100, 200]) {
          const ctx = sizeContextFromPixels(w, h)
          const value = resolveFrame(planChart('line', ctx, SHAPE), THREE, ctx).value
          if (value === null) continue
          const used = value.fontSize * EM_HEIGHT
          if (used > value.region.height + 1e-9) {
            overflows.push(`${String(w)}×${String(h)}: ${String(used)} px of type in a ${String(value.region.height)} px band`)
          }
        }
      }
      expect(overflows).toEqual([])
    })

    it('never fits text wider than the column it was given', () => {
      const overflows: string[] = []
      for (let w = 40; w <= 400; w += 4) {
        for (const h of [16, 24, 40, 100, 200]) {
          const ctx = sizeContextFromPixels(w, h)
          const value = resolveFrame(planChart('line', ctx, SHAPE), THREE, ctx).value
          if (value === null || value.entries.length === 0) continue
          const columns = value.entries.length + (value.overflow === null ? 0 : 1)
          const columnWidth = value.region.width / columns
          for (const entry of value.entries) {
            const half = widthAt(painted(entry), value.fontSize) / 2
            if (entry.x - half < value.region.x - 1e-9) overflows.push(`${String(w)}×${String(h)} left`)
            if (entry.x + half > value.region.x + value.region.width + 1e-9) {
              overflows.push(`${String(w)}×${String(h)} right`)
            }
            if (half * 2 > columnWidth + 1e-9) {
              overflows.push(`${String(w)}×${String(h)}: ${painted(entry)} is ${String(half * 2)} px in a ${String(columnWidth)} px column`)
            }
          }
        }
      }
      expect(overflows).toEqual([])
    })

    it('budgets the series label as part of the value composition', () => {
      const ctx = sizeContextFromPixels(60, 24)
      const short = [{ ...monthly('short', [10, 14]), label: 'S' }]
      const long = [{ ...monthly('long', [10, 14]), label: 'A very long series label' }]
      const shortValue = resolveFrame(planChart('line', ctx, SHAPE), short, ctx).value
      const longValue = resolveFrame(planChart('line', ctx, SHAPE), long, ctx).value

      expect(shortValue?.entries[0]?.label).toBe('S')
      expect(longValue?.entries[0]?.label).toBe('A very long series label')
      expect(longValue?.fontSize ?? 0).toBeLessThan(shortValue?.fontSize ?? 0)
      expect(longValue?.fontSize ?? 0).toBeGreaterThan(0)
    })

    /**
     * ⚠ **The inverse, stated as an equality.** With a numeric `valueTypeScale` that fits the
     * budget and a box far too wide to bind horizontally, the fitted size must come back as
     * the size that was asked for — because `valueBand()` multiplied it by the em height and
     * this divided by the same number. Any other fitting rule (a cap, a rounding to a rank, a
     * "close enough" ratio) fails here, which is the point of asserting it.
     */
    it('recovers the requested type size exactly, because the fit is the band’s inverse', () => {
      const ctx = sizeContextFromPixels(1200, 400)
      const base = planChart('line', ctx, SHAPE)
      for (const requested of [10, 16, 24, 48]) {
        const plan = applyOverrides(base, {
          narrative: { valueDisplay: 'latest', valueTypeScale: requested },
        })
        const value = resolveFrame(plan, THREE, ctx).value
        // Truncated to 2 dp — a maximum rounded up stops being a maximum — so the recovered
        // size is the requested one less at most a hundredth.
        expect(value?.fontSize).toBeCloseTo(requested, 1)
        expect(value?.fontSize ?? 0).toBeLessThanOrEqual(requested)
      }
    })
  })

  /**
   * ⚠ **Three big numbers in a 60 × 24 box is not obviously right, and at that size it is
   * wrong.** Even division gives three 20 px columns and a fitted value near 5 px: painted,
   * present, and unreadable. The cap trades entries for legibility — and says so, because a
   * value display that silently shows one of three series is a chart that lies about how many
   * series it has.
   */
  describe('the legibility cap', () => {
    it('drops entries rather than shrink below the floor, and counts what it dropped', () => {
      const value = resolveFrame(planChart('line', MICRO_PX, SHAPE), THREE, MICRO_PX).value
      expect(value?.entries).toHaveLength(1)
      expect(value?.overflow).toEqual({
        hidden: 2,
        text: '+2',
        x: expect.any(Number) as unknown as number,
        y: expect.any(Number) as unknown as number,
      })
      // The label is part of the measured composition. At this boundary the one remaining
      // labelled value can be narrower than the nominal floor, but it must stay positive and
      // the frame must say how many values moved to the table.
      expect(value?.fontSize ?? 0).toBeGreaterThan(0)
    })

    it('accounts for every series that had a value — shown plus hidden', () => {
      for (let w = 40; w <= 400; w += 4) {
        const ctx = sizeContextFromPixels(w, 24)
        const value = resolveFrame(planChart('line', ctx, SHAPE), THREE, ctx).value
        if (value === null || value.entries.length === 0) continue
        expect(value.entries.length + (value.overflow?.hidden ?? 0)).toBe(THREE.length)
      }
    })

    it('shows every value when the box has room, with no marker', () => {
      const wideMicro = Object.freeze({ ...MICRO, width: 360, aspect: 'landscape' as const })
      const value = resolveFrame(planChart('line', wideMicro, SHAPE), THREE, wideMicro).value
      expect(value?.entries).toHaveLength(3)
      expect(value?.entries.map((entry) => entry.label)).toEqual(['a', 'b', 'c'])
      expect(value?.overflow).toBeNull()
    })

    it('gives the marker a column of its own rather than overlapping the last value', () => {
      const value = resolveFrame(planChart('line', MICRO_PX, SHAPE), THREE, MICRO_PX).value
      const last = value?.entries[value.entries.length - 1]
      expect(value?.overflow?.x ?? 0).toBeGreaterThan(last?.x ?? 0)
      expect(value?.overflow?.y).toBe(last?.y)
    })
  })

  it('centres every entry vertically in the band', () => {
    const value = resolveFrame(planChart('line', TILE, SHAPE), THREE, TILE).value
    const middle = (value?.region.y ?? 0) + (value?.region.height ?? 0) / 2
    for (const entry of value?.entries ?? []) expect(entry.y).toBe(middle)
  })

  it('divides the band evenly and centres each column', () => {
    const value = resolveFrame(planChart('line', TILE, SHAPE), THREE, TILE).value
    const width = (value?.region.width ?? 0) / 3
    expect(value?.entries.map((e) => e.x)).toEqual([width * 0.5, width * 1.5, width * 2.5])
  })

  it('emits no NaN into the band at a degenerate size', () => {
    for (const [w, h] of [
      [0, 0],
      [1, 1],
      [4, 60],
    ] as const) {
      const ctx = sizeContextFromPixels(w, h)
      const value = resolveFrame(planChart('line', ctx, SHAPE), THREE, ctx).value
      if (value === null) continue
      const numbers = [value.fontSize, ...value.entries.flatMap((e) => [e.x, e.y])]
      expect(numbers.every((n) => Number.isFinite(n))).toBe(true)
    }
  })

  it('keeps the value intent serialisable and stable across frame resolution', () => {
    const plan = planChart('line', TILE, SHAPE)
    const first = resolveFrame(plan, ONE, TILE)
    const second = resolveFrame(plan, ONE, TILE)

    expect(first.value?.presentation).toEqual({ label: 'series', context: 'delta' })
    expect(first.value?.presentation).toEqual(second.value?.presentation)
    expect(first.value?.coverage).toEqual(second.value?.coverage)
    expect(JSON.parse(JSON.stringify(first.value))).toEqual(first.value)
    expect(first.value?.entries.map(({ seriesId, seriesIndex, label }) => ({ seriesId, seriesIndex, label }))).toEqual(
      second.value?.entries.map(({ seriesId, seriesIndex, label }) => ({ seriesId, seriesIndex, label })),
    )
  })

  it('does not invent a value presentation for the shape-only Strip rung', () => {
    const plan = planChart('line', STRIP, SHAPE)
    const frame = resolveFrame(plan, THREE, STRIP)

    expect(plan.valueLegibility).toBe('shape-only')
    expect(plan.narrative.valueDisplay).toBe('none')
    expect(frame.value).toBeNull()
  })
})

describe('no-plot and reserved-legend geometry', () => {
  it('spends the final no-plot surface on the value band', () => {
    const plan = planChart('line', TILE_FLAT, SHAPE)
    expect(plan.marks.primary).toEqual({ kind: 'none' })

    const frame = resolveFrame(plan, THREE, TILE_FLAT)
    const box = resolvePlotBox(TILE_FLAT, chromeFromPlan(plan), THREE.length, DEFAULT_POLICY)

    expect(box.height).toBe(0)
    expect(frame.plot.height).toBe(0)
    expect(frame.value?.region.height).toBe(TILE_FLAT.height)
    expect(frame.value?.fontSize ?? 0).toBeGreaterThan(0)
  })

  it('charges a reserved Strip legend before the marks and leaves overlay legends uncharged', () => {
    const strip = planChart('line', STRIP, MANY_SERIES)
    const reserved = legendBands(strip.legend, SIX_SERIES.length, DEFAULT_POLICY)
    const frame = resolveFrame(strip, SIX_SERIES, STRIP)

    expect(strip.legend).toEqual({ placement: 'internal', maxEntries: 8, flow: 'reserved' })
    expect(reserved.height).toBeGreaterThan(0)
    expect(frame.plot.y).toBe(reserved.height)
    expect(frame.plot.y + frame.plot.height).toBeLessThanOrEqual(frame.box.height)
    for (const series of frame.series) {
      for (const point of series.points) expect(point.y).toBeGreaterThanOrEqual(frame.plot.y)
    }

    const overlay = { placement: 'internal' as const, maxEntries: 8, flow: 'overlay' as const }
    expect(legendBands(overlay, SIX_SERIES.length, DEFAULT_POLICY)).toEqual({ width: 0, height: 0 })
  })
})
