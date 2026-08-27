/**
 * @vitest-environment jsdom
 */

/**
 * `<AutoChart>` with a box under it — the whole adaptive thesis, driven.
 *
 * ⚠ **What this file adds over `useElementSize.test.tsx` is the second half of the loop.**
 * The hook's tests prove that a re-delivered box produces no new size object. That is
 * necessary and not sufficient: the loop is closed by *content*, so what has to be shown
 * here is that an unchanged box produces unchanged markup — because markup that does not
 * change cannot change a layout, and a layout that does not change cannot produce another
 * measurement. Together the two files are gate **G11**'s node half.
 *
 * ⚠ Still not the browser half, and the gap is worth naming precisely: jsdom does no layout.
 * Nothing here can produce the browser's `"ResizeObserver loop completed with undelivered
 * notifications"`, because nothing here can make the chart's own height feed the box it was
 * measured in. `scripts/check-containment.mjs` drives a real engine for that. This file
 * proves the property that makes the loop *terminate*; that script proves it never *starts*.
 *
 * ⚠ No stylesheet is loaded. `auto-chart.css`'s `overflow: hidden` — the scrollbar door — is
 * a rule jsdom would parse and never apply, so asserting it here would be a test that passes
 * whatever the stylesheet says. It belongs to the browser half, and it is left there.
 */

import { describeShape, planChart, resolveSizeClass, sizeContextFromPixels } from '@shiftcharts/core'
import type { Series } from '@shiftcharts/core'
import { FakeResizeObserver } from '@shiftcharts/testing'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AutoChart } from './AutoChart.tsx'

// --- Fixtures ------------------------------------------------------------------------------

const DAY = 86_400_000
const START = Date.UTC(2024, 0, 1)

function series(id: string, values: readonly number[]): Series {
  return {
    id,
    label: id.toUpperCase(),
    points: values.map((y, i) => ({ x: new Date(START + i * DAY), y })),
  }
}

const DATA: readonly Series[] = [
  series('alpha', [10, 14, 9, 22, 18, 30, 27]),
  series('beta', [4, 6, 5, 9, 7, 11, 12]),
]

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

let container: HTMLDivElement
let root: Root
let observer: FakeResizeObserver | null

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  observer = null

  /**
   * ⚠ **Stubbed onto `globalThis` here, and injected through `createObserver` in
   * `useElementSize.test.tsx` — the two files test different things on purpose.** That file
   * drives the hook's own logic and injects, because injection is what keeps a leaked stub
   * from making one file's failure surface in another's. This file is testing `<AutoChart>`,
   * which has no injection prop and should not grow one: a test seam on a public component
   * is a seam a consumer can find. So the only way to reach the component's real path — the
   * branch where the hook constructs a `ResizeObserver` itself — is to put one where it
   * looks. `unstubGlobals: true` in `vitest.config.ts` is what makes that safe; it is the
   * setting that exists for exactly this.
   *
   * jsdom implements no `ResizeObserver` at all, so nothing is being shadowed.
   *
   * ⚠ A factory function rather than `class extends FakeResizeObserver`, because capturing
   * the instance from a subclass constructor means aliasing `this` — which is a lint error
   * here and, more to the point, reads as though the subclass were doing something. A
   * constructor function that returns an object hands that object back from `new`, so the
   * hook gets a real `FakeResizeObserver` and the test gets the same one.
   */
  vi.stubGlobal('ResizeObserver', function stubbed(
    callback: ConstructorParameters<typeof FakeResizeObserver>[0],
  ) {
    observer = new FakeResizeObserver(callback)
    return observer
  })
  vi.useFakeTimers()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
  globalThis.IS_REACT_ACT_ENVIRONMENT = undefined
})

function mount(node: ReactNode): void {
  act(() => root.render(node))
}

/** One `<AutoChart>` under a driven observer. */
function chart(props: Partial<Parameters<typeof AutoChart>[0]> = {}): ReactNode {
  return <AutoChart type="line" data={DATA} title="Revenue" id="t" {...props} />
}

function resize(width: number, height: number): void {
  act(() => {
    observer?.emit(width, height)
    vi.advanceTimersToNextFrame()
  })
}

/** The wrapper the component measures. */
function wrapper(): HTMLElement {
  const el = container.querySelector('.shiftcharts-auto-chart')
  if (el === null) throw new Error('the wrapper never rendered')
  return el as HTMLElement
}

// --- Mount, before a box exists --------------------------------------------------------------

describe('before the first measurement', () => {
  it('renders the wrapper and nothing inside it', () => {
    mount(chart())
    expect(wrapper().children).toHaveLength(0)
  })

  it('starts observing the wrapper, and only the wrapper', () => {
    mount(chart())
    expect(observer?.observedCount).toBe(1)
  })

  it('draws immediately when a size was declared, without waiting for a delivery', () => {
    mount(chart({ initialSize: { width: 700, height: 520 } }))
    expect(wrapper().querySelector('svg')).not.toBeNull()
  })
})

// --- Measure, plan, render -------------------------------------------------------------------

describe('a measurement produces a chart at that measurement’s rung', () => {
  it('draws once a box arrives', () => {
    mount(chart())
    resize(700, 520)
    expect(wrapper().querySelector('svg')).not.toBeNull()
  })

  it('sizes the svg viewBox to the box it was handed', () => {
    mount(chart())
    resize(700, 520)
    expect(wrapper().querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 700 520')
  })

  it('uses the authoritative grid footprint while retaining measured content pixels', () => {
    mount(chart({ gridSize: { cols: 6, rows: 5 } }))
    resize(240, 88)

    // The same pixels are only a 2 × 1 virtual footprint under the standalone default. The
    // dashboard footprint is authoritative for the information budget, while the SVG still
    // receives the real content-box pixels.
    expect(wrapper().querySelector('figure')?.getAttribute('data-size-class')).toBe(
      resolveSizeClass(6, 5),
    )
    expect(wrapper().querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 240 88')
  })

  it('mounts the client interaction layer inside the chart figure without adding a wrapper child', () => {
    mount(chart())
    resize(700, 520)

    expect(wrapper().children).toHaveLength(1)
    expect(wrapper().firstElementChild?.tagName.toLowerCase()).toBe('figure')
    expect(wrapper().querySelector('.shiftcharts-interaction')).not.toBeNull()
  })

  it('keeps the chart as the wrapper’s only child', () => {
    // ⚠ Structural, not tidy. A sibling in normal flow contributes to the content box the
    // observer reports, so the chart would be planned for a height a caption had already
    // taken a bite out of — and shrinking the widget past that caption's own height would
    // stop the box shrinking at all. That is the containment loop through the least
    // interesting door, and it is how it first showed up in the playground.
    mount(chart())
    resize(700, 520)
    expect(wrapper().children).toHaveLength(1)
    expect(wrapper().firstElementChild?.tagName.toLowerCase()).toBe('figure')
  })

  it('climbs and descends the ladder as the box changes', () => {
    const rungs = [
      [960, 640],
      [640, 520],
      [420, 320],
      [340, 120],
      [240, 88],
      [120, 24],
    ] as const

    mount(chart())
    for (const [width, height] of rungs) {
      resize(width, height)
      const ctx = sizeContextFromPixels(width, height)
      const figure = wrapper().querySelector('figure')
      expect(figure?.getAttribute('data-size-class')).toBe(resolveSizeClass(ctx.cols, ctx.rows))
    }
  })

  it('holds a rung while a boundary wobble stays inside the deadband', () => {
    mount(chart())
    resize(599, 520)
    expect(wrapper().querySelector('figure')?.getAttribute('data-size-class')).toBe('panel')

    resize(605, 520)
    expect(wrapper().querySelector('figure')?.getAttribute('data-size-class')).toBe('panel')

    resize(607, 520)
    expect(wrapper().querySelector('figure')?.getAttribute('data-size-class')).toBe('canvas')

    resize(599, 520)
    expect(wrapper().querySelector('figure')?.getAttribute('data-size-class')).toBe('canvas')

    resize(593, 520)
    expect(wrapper().querySelector('figure')?.getAttribute('data-size-class')).toBe('panel')
  })

  it('changes the encoding, not just the chrome, at the rung that does', () => {
    // Tile substitutes horizon bands for a line between `horizonMinHeight` and
    // `plotHeightOptimal`. It is the one rung where the *mark* changes, so it is the one
    // that proves the plan is being re-resolved rather than the svg being rescaled.
    mount(chart())
    resize(240, 80)
    expect(wrapper().querySelector('.shiftcharts-line')).not.toBeNull()

    resize(240, 44)
    expect(wrapper().querySelector('.shiftcharts-line')).toBeNull()
    expect(wrapper().querySelector('.shiftcharts-band')).not.toBeNull()
  })

  it('agrees exactly with planning the same box by hand', () => {
    // ⚠ `<AutoChart>` must add nothing to the pipeline but the measurement. Any default,
    // clamp or fallback rung it applied on its own would show up as a difference here.
    mount(chart())
    resize(700, 520)

    const ctx = sizeContextFromPixels(700, 520)
    const plan = planChart('line', ctx, describeShape(DATA))
    expect(wrapper().querySelector('figure')?.getAttribute('data-size-class')).toBe(plan.sizeClass)
    expect(wrapper().querySelector('figure')?.getAttribute('data-chart-type')).toBe(plan.type)
  })

  it('reports the measured plan and content box without changing the render contract', () => {
    const onResolvedPlan = vi.fn()
    mount(chart({ onResolvedPlan }))
    resize(560, 320)

    expect(onResolvedPlan).toHaveBeenCalled()
    const [resolvedPlan, measuredSize] = onResolvedPlan.mock.calls.at(-1) ?? []
    expect(resolvedPlan?.sizeClass).toBe('panel')
    expect(measuredSize).toEqual({ width: 560, height: 320 })
  })
})

// --- Gate G11, the content half ---------------------------------------------------------------

describe('gate G11 — an unchanged box produces unchanged content', () => {
  it('emits byte-identical markup when the same box is delivered again', () => {
    mount(chart())
    resize(700, 520)
    const before = wrapper().innerHTML

    resize(700, 520)
    resize(700, 520)

    // ⚠ The half of containment the hook's own tests cannot reach. Identical markup cannot
    // change a layout, and a layout that does not change cannot produce another measurement
    // — so this is where the loop would have to terminate even if something upstream kept
    // re-delivering. Byte comparison rather than a structural one on purpose: a single
    // coordinate drifting by 0.01 is enough to relayout, and is exactly what a
    // non-deterministic `d`-string would look like.
    expect(wrapper().innerHTML).toBe(before)
  })

  it('does not replace the svg element itself on a re-delivery', () => {
    // Stronger than markup equality and worth having separately: React reusing the same
    // DOM node means no insertion, so not even a style recalculation is scheduled.
    mount(chart())
    resize(700, 520)
    const svg = wrapper().querySelector('svg')

    resize(700, 520)
    expect(wrapper().querySelector('svg')).toBe(svg)
  })

  it('returns to identical markup after a round trip away and back', () => {
    // ⚠ The plan is a pure function of the box, so 700 × 520 must draw the same chart
    // whether it is arrived at from above or from below. If it did not, dragging a widget
    // out and back would leave it in a different state than it started — and hysteresis is
    // exactly what the ladder was designed to avoid needing.
    mount(chart())
    resize(700, 520)
    const before = wrapper().innerHTML

    resize(240, 44)
    resize(960, 640)
    resize(700, 520)

    expect(wrapper().innerHTML).toBe(before)
  })

  it('leaves the chart alone when a parent re-renders with equal props', () => {
    // ⚠ `data` is memoised on identity, so a parent that rebuilds its array literal every
    // render re-derives the shape and the plan. Passing the *same* array must not. This is
    // the reason `describeShape` and `planChart` sit in separate memos rather than one.
    mount(chart())
    resize(700, 520)
    const svg = wrapper().querySelector('svg')
    const before = wrapper().innerHTML

    mount(chart())
    mount(chart())

    expect(wrapper().innerHTML).toBe(before)
    expect(wrapper().querySelector('svg')).toBe(svg)
  })
})
