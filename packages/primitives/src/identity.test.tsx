/**
 * @vitest-environment jsdom
 */

/**
 * **Element identity across a re-render** — the single property `<Grid>` and `<Axis>` were
 * re-keyed for, asserted the only way it can be.
 *
 * ⚠ **Every other test in this package compares markup, and markup cannot see this bug.**
 * `Chart.test.tsx` snapshots the element census; it would have been byte-identical before and
 * after the keys changed, because the *output* was always right. What was wrong was the
 * *continuity* — React was destroying each gridline and building a replacement that happened
 * to look like it. So the assertion here is `toBe`, on DOM node objects captured before a
 * resize and looked up again after it. Equal markup passes; equal identity is what A6 needs.
 *
 * ⚠ **Why it needs to be true.** `decisions/016` measured what SVG geometry actually
 * transitions in a browser, and the one unconditional finding was that a **replaced element
 * never transitions** — a brand-new node has no previous value to interpolate from, so it
 * paints at its final position on the first frame regardless of any `transition` property.
 * `MotionPlan.objectConstancy` is therefore not a rendering hint we can add later; it is a
 * precondition, and this file is where it is held.
 *
 * ⚠ **The vacuity guard is load-bearing, so read it before trusting any of this.** If the
 * two renders produced the same geometry, the old offset-derived keys would pass here too and
 * the file would prove nothing. Every identity test below therefore first asserts that the
 * node's own `y`/`x` attribute *changed* on the node it is holding. That single pair of
 * assertions — same object, different attribute — is exactly the state a CSS transition
 * needs, and neither half means anything without the other.
 *
 * Verified by reverting: with `<Grid>` keyed on `tick.offset` again, the first two tests fail.
 */

import {
  type ChartFrame,
  describeShape,
  planChart,
  resolveFrame,
  type Series,
  sizeContextFromPixels,
} from '@shiftcharts/core'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { Chart } from './Chart.tsx'

// --- Fixtures ------------------------------------------------------------------------------

const DAY = 86_400_000
const START = Date.UTC(2024, 0, 1)

function daily(id: string, values: readonly number[]): Series {
  return {
    id,
    label: id.toUpperCase(),
    points: values.map((y, i) => ({ x: new Date(START + i * DAY), y })),
  }
}

/** Seven days, two series: the y domain resolves to 0/10/20/30 at every rung that draws it, so
 * a resize moves the gridlines without changing which values exist. That is the *rescale* half
 * of `MotionPlan.durationClass`, isolated. */
const WEEK: readonly Series[] = [
  daily('alpha', [10, 14, 9, 22, 18, 30, 27]),
  daily('beta', [4, 6, 5, 9, 7, 11, 12]),
]

/** Forty days, one series. Wide enough that the x axis ladder actually changes rungs — 20 ticks
 * at Stage, 5 at the next size down, sharing 2. That is *recompose*: some ticks survive, most
 * do not, and the survivors are the ones the eye tracks through the change. */
const MONTHS: readonly Series[] = [
  daily('alpha', Array.from({ length: 40 }, (_, i) => 10 + 8 * Math.sin(i / 3))),
]

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  globalThis.IS_REACT_ACT_ENVIRONMENT = undefined
})

/**
 * Render into the *same* root, which is the whole point — a fresh root would mount a fresh
 * tree and identity would be trivially false.
 */
function renderAt(width: number, height: number, data: readonly Series[]): ChartFrame {
  const ctx = sizeContextFromPixels(width, height)
  const plan = planChart('line', ctx, describeShape(data))
  act(() => {
    root.render(<Chart plan={plan} data={data} ctx={ctx} title="Identity" id="t" />)
  })
  // The component memoises its own frame; this is an equal one, wanted only for its tick
  // values. Nothing here asserts against the component's copy.
  return resolveFrame(plan, data, ctx)
}

/**
 * ⚠ **Grid rects carry no value attribute, so this correlation is positional** — the nth rect
 * is the nth tick. That is sound only because `<Grid>` maps the tick array in order, which is
 * an implementation fact and not a contract, so the length equality below is asserted rather
 * than assumed: if `<Grid>` ever filters or reorders, this fails loudly instead of silently
 * comparing the wrong pairs.
 */
function gridByValue(axis: 'x' | 'y', frame: ChartFrame): Map<number | string, Element> {
  const nodes = Array.from(container.querySelectorAll(`.shiftcharts-grid__line[data-axis="${axis}"]`))
  const ticks = axis === 'y' ? frame.yTicks : frame.xTicks
  expect(nodes).toHaveLength(ticks.length)

  const byValue = new Map<number | string, Element>()
  ticks.forEach((tick, i) => {
    const node = nodes[i]
    if (node !== undefined) byValue.set(tick.value, node)
  })
  return byValue
}

/** Axis ticks publish `data-value`, so these need no positional trust. */
function axisTicksByValue(orientation: 'x' | 'y'): Map<string, Element> {
  const byValue = new Map<string, Element>()
  for (const node of container.querySelectorAll(`.shiftcharts-axis--${orientation} .shiftcharts-axis__tick`)) {
    const value = node.getAttribute('data-value')
    if (value !== null) byValue.set(value, node)
  }
  return byValue
}

// --- rescale: everything survives, everything moves -----------------------------------------

describe('gridlines', () => {
  it('keeps the same <rect> for every y value that survives a resize', () => {
    const before = gridByValue('y', renderAt(900, 500, WEEK))
    expect(before.size).toBeGreaterThan(2)

    // Held across the re-render on purpose: these are live references, so reading an
    // attribute after the second render reads the *new* value off the *old* node — if it
    // still is the old node.
    const zero = before.get(0)
    expect(zero).toBeDefined()
    const yBefore = zero?.getAttribute('y')

    const after = gridByValue('y', renderAt(600, 430, WEEK))

    expect([...after.keys()].sort()).toEqual([...before.keys()].sort())
    for (const [value, node] of before) {
      expect(after.get(value)).toBe(node)
    }

    // ⚠ THE VACUITY GUARD. Without this the test passes on a chart that never moved, and a
    // chart that never moved would pass under the offset-derived keys too.
    expect(zero?.getAttribute('y')).not.toBe(yBefore)
    expect(container.contains(zero ?? null)).toBe(true)
  })

  it('survives a rung change, not merely a resize within one rung', () => {
    // Canvas → Panel. The plan changes shape around the gridlines; the gridlines do not care.
    const before = gridByValue('y', renderAt(900, 500, WEEK))
    // ⚠ An INTERIOR tick, deliberately. The guard has to watch a value whose offset is a
    // function of the plot height, and the domain's own bounds are not: 30 sits at `y=0` and
    // 0 sits at `y=plot.height`, so the top gridline reports the same attribute at every size
    // and would make this guard vacuous — which is exactly what it caught on first run.
    const interior = before.get(10)
    expect(interior).toBeDefined()
    const yBefore = interior?.getAttribute('y')

    const after = gridByValue('y', renderAt(420, 300, WEEK))

    for (const [value, node] of before) {
      expect(after.get(value)).toBe(node)
    }
    expect(interior?.getAttribute('y')).not.toBe(yBefore)
  })
})

// --- recompose: some survive, most do not ---------------------------------------------------

describe('axis ticks', () => {
  it('keeps identity for the ticks a recompose spares, and detaches the rest', () => {
    const dense = renderAt(1200, 700, MONTHS)
    const before = axisTicksByValue('x')
    expect(before.size).toBe(dense.xTicks.length)
    expect(before.size).toBeGreaterThan(10)

    const sparse = renderAt(1000, 600, MONTHS)
    const after = axisTicksByValue('x')
    expect(after.size).toBe(sparse.xTicks.length)
    expect(after.size).toBeLessThan(before.size)

    const survivors = [...before.keys()].filter((v) => after.has(v))
    // 2 of 20, at the time of writing. Asserted as "more than none and fewer than all" rather
    // than as a number, because the exact count is d3's tick ladder and not our contract —
    // pinning it would make this file fail on a d3 upgrade that broke nothing.
    expect(survivors.length).toBeGreaterThan(0)
    expect(survivors.length).toBeLessThan(before.size)

    for (const value of survivors) {
      const node = before.get(value)
      expect(after.get(value)).toBe(node)
      expect(container.contains(node ?? null)).toBe(true)
    }

    // The other half of object constancy: a tick that did NOT survive must be gone from the
    // document, not merely absent from the query. A detached-but-referenced node would mean
    // React had rebuilt the group wholesale, and the survivors above would be coincidence.
    for (const [value, node] of before) {
      if (after.has(value)) continue
      expect(container.contains(node)).toBe(false)
    }
  })
})

// --- the case that was already right ---------------------------------------------------------

describe('point marks', () => {
  /**
   * ⚠ **A characterisation test, not a regression test, and the difference is worth stating:
   * this one passes against the old code too.** `PointMarks` keys by the datum's index in
   * `SeriesFrame.points`, which no resize can move — see the comment at its `key`. It is here
   * so that a future change to that key has something to break, because nothing else in the
   * suite would notice.
   */
  it('keeps the same <circle> for a datum across a resize', () => {
    renderAt(1200, 700, MONTHS)
    const before = Array.from(container.querySelectorAll('.shiftcharts-point'))
    expect(before.length).toBeGreaterThan(0)
    // ⚠ The LAST point, for the same reason the gridline guard takes an interior tick: point
    // 0 sits at the plot's left edge, and the left edge is the y-label gutter, which a width
    // change does not move. Its `cx` is identical at both sizes.
    const last = before[before.length - 1]
    const cxBefore = last?.getAttribute('cx')

    renderAt(900, 500, MONTHS)
    const after = Array.from(container.querySelectorAll('.shiftcharts-point'))

    expect(after).toHaveLength(before.length)
    after.forEach((node, i) => {
      expect(node).toBe(before[i])
    })
    expect(last?.getAttribute('cx')).not.toBe(cxBefore)
  })
})
