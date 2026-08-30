/**
 * @vitest-environment jsdom
 */

import {
  describeShape,
  planChart,
  resolveFrame,
  sizeContextFromPixels,
  type ChartPlan,
  type ChartFrame,
  type Series,
  type SizeContext,
} from '@shiftcharts/core'
import { act, createElement, Fragment, Profiler, type RefObject } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { InteractionOverlay } from './InteractionOverlay.tsx'

const DAY = 86_400_000
const START = Date.UTC(2024, 0, 1)

function series(id: string, values: readonly number[]): Series {
  return {
    id,
    label: id.toUpperCase(),
    points: values.map((y, index) => ({ x: new Date(START + index * DAY), y })),
  }
}

const DATA: readonly Series[] = [
  series('alpha', [10, 14, 9, 22, 18, 30, 27]),
  series('beta', [4, 6, 5, 9, 7, 11, 12]),
]

let container: HTMLDivElement
let chartHost: HTMLElement
let root: Root
let containerRef: RefObject<HTMLElement | null>

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  // Keep DOM interaction assertions synchronous in jsdom. Real browsers retain rAF pacing;
  // the overlay's scheduler falls back to an immediate flush when no frame driver exists.
  vi.stubGlobal('requestAnimationFrame', undefined)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  containerRef = { current: container }
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function context(width: number, height: number): SizeContext {
  return sizeContextFromPixels(width, height)
}

function plan(ctx: SizeContext): ChartPlan {
  return planChart('line', ctx, describeShape(DATA))
}

function frame(ctx: SizeContext, resolved: ChartPlan): ChartFrame {
  return resolveFrame(resolved, DATA, ctx)
}

function renderOverlay(
  ctx: SizeContext,
  options: {
    readonly activePointHighlight?: boolean
    readonly tooltipPlacement?: 'fix' | 'fluid'
  } = {},
): { resolved: ChartPlan; renderedFrame: ChartFrame } {
  const resolved = planChart(
    'line',
    ctx,
    describeShape(DATA),
    undefined,
    options.tooltipPlacement === undefined
      ? undefined
      : { interaction: { tooltip: { placement: options.tooltipPlacement } } },
  )
  const renderedFrame = frame(ctx, resolved)
  act(() => {
    root.render(
      createElement(
        Fragment,
        null,
        createElement('figure', { className: 'shiftcharts-chart' }),
        createElement(InteractionOverlay, {
          containerRef,
          plan: resolved,
          data: DATA,
          ctx,
          title: 'Revenue',
          id: 'interaction-test',
          activePointHighlight: options.activePointHighlight,
        }),
      ),
    )
  })
  act(() => {})
  chartHost = container.querySelector('.shiftcharts-chart') as HTMLElement
  const svg = container.querySelector('.shiftcharts-interaction__svg')
  if (svg !== null) {
    Object.defineProperty(svg, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        width: renderedFrame.box.width,
        height: renderedFrame.box.height,
        right: renderedFrame.box.width,
        bottom: renderedFrame.box.height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    })
  }
  return { resolved, renderedFrame }
}

function target(): SVGRectElement {
  const element = container.querySelector('.shiftcharts-interaction__target')
  if (element === null) throw new Error('interaction target did not render')
  return element as SVGRectElement
}

function dispatchPointer(type: string, point: { readonly x: number; readonly y: number }): void {
  act(() => {
    target().dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        clientX: point.x,
        clientY: point.y,
      }),
    )
  })
}

function dispatchKey(key: string): void {
  act(() => {
    target().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }))
  })
}

describe('interaction availability and the portal boundary', () => {
  it('does not mount a pointer surface when the plan disables interaction', () => {
    renderOverlay(context(120, 24))

    expect(container.querySelector('.shiftcharts-interaction')).toBeNull()
    expect(chartHost.children).toHaveLength(0)
  })

  it('marks over-budget canvas plans as reduced interaction without dropping tooltip semantics', () => {
    const denseData: readonly Series[] = [
      {
        id: 'dense',
        points: Array.from({ length: 2_001 }, (_, index) => ({ x: index, y: index % 17 })),
      },
    ]
    const ctx = context(420, 320)
    const densePlan = planChart('line', ctx, describeShape(denseData))
    expect(densePlan.marks.renderer).toBe('canvas')

    act(() => {
      root.render(
        createElement(
          Fragment,
          null,
          createElement('figure', { className: 'shiftcharts-chart' }),
          createElement(InteractionOverlay, {
            containerRef,
            plan: densePlan,
            data: denseData,
            ctx,
            title: 'Dense',
            id: 'interaction-dense-test',
          }),
        ),
      )
    })
    act(() => {})

    expect(container.querySelector('.shiftcharts-interaction')?.getAttribute('data-interaction-mode')).toBe('reduced')
  })

  it('keeps the interaction layer inside the chart figure and exposes a status equivalent', () => {
    renderOverlay(context(420, 320))

    expect(chartHost.querySelector('.shiftcharts-interaction')).not.toBeNull()
    expect(chartHost.querySelector('[role="status"]')).not.toBeNull()
    expect(chartHost.querySelector('.shiftcharts-interaction__target')?.getAttribute('role')).toBe('button')
  })
})

describe('fixed and fluid tooltip interaction', () => {
  it('caches the SVG client rect until resize, scroll, or pointer leave invalidates it', () => {
    const { renderedFrame } = renderOverlay(context(420, 320))
    const svg = container.querySelector('.shiftcharts-interaction__svg')
    if (!(svg instanceof SVGSVGElement)) throw new Error('interaction SVG missing')
    const point = renderedFrame.series[0]?.points[2]
    if (point === undefined) throw new Error('fixture point missing')

    let reads = 0
    const bounds = {
      left: 0,
      top: 0,
      width: renderedFrame.box.width,
      height: renderedFrame.box.height,
      right: renderedFrame.box.width,
      bottom: renderedFrame.box.height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }
    Object.defineProperty(svg, 'getBoundingClientRect', {
      configurable: true,
      value: () => {
        reads += 1
        return bounds
      },
    })

    dispatchPointer('pointermove', point)
    dispatchPointer('pointermove', point)
    expect(reads).toBe(1)

    window.dispatchEvent(new Event('scroll'))
    dispatchPointer('pointermove', point)
    expect(reads).toBe(2)

    dispatchPointer('pointerout', point)
    dispatchPointer('pointermove', point)
    expect(reads).toBe(3)
  })

  it('does not commit a React update when pointer movement resolves the same datum', () => {
    const resolved = planChart('line', context(420, 320), describeShape(DATA))
    const renderedFrame = frame(context(420, 320), resolved)
    let commits = 0
    act(() => {
      root.render(
        createElement(
          Profiler,
          { id: 'interaction', onRender: () => { commits += 1 } },
          createElement(
            Fragment,
            null,
            createElement('figure', { className: 'shiftcharts-chart' }),
            createElement(InteractionOverlay, {
              containerRef,
              plan: resolved,
              data: DATA,
              ctx: context(420, 320),
              title: 'Revenue',
              id: 'interaction-profiler-test',
            }),
          ),
        ),
      )
    })
    act(() => {})
    const point = renderedFrame.series[0]?.points[2]
    if (point === undefined) throw new Error('fixture point missing')
    const commitsBeforeHover = commits

    dispatchPointer('pointermove', point)
    const commitsAfterFirstDatum = commits
    dispatchPointer('pointermove', point)

    expect(commitsAfterFirstDatum).toBeGreaterThan(commitsBeforeHover)
    expect(commits).toBe(commitsAfterFirstDatum)
  })

  it('coalesces a pointer burst to the latest datum on the next animation frame', () => {
    const callbacks: Array<() => void> = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callbacks.push(() => callback(performance.now()))
      return callbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => undefined)

    const { renderedFrame } = renderOverlay(context(420, 320))
    const first = renderedFrame.series[0]?.points[1]
    const latest = renderedFrame.series[0]?.points[4]
    if (first === undefined || latest === undefined) throw new Error('fixture points missing')

    dispatchPointer('pointermove', first)
    dispatchPointer('pointermove', latest)
    expect(container.querySelector('[role="tooltip"]')).toBeNull()
    expect(callbacks).toHaveLength(1)

    act(() => callbacks.shift()?.())
    expect(container.querySelector('[role="tooltip"]')?.getAttribute('data-point-index')).toBe('4')
  })

  it('falls back to fluid hover when the docked rail cannot fit the tooltip, clips the crosshair, and clears on leave', () => {
    const { renderedFrame } = renderOverlay(context(420, 320))
    const point = renderedFrame.series[0]?.points[2]
    if (point === undefined) throw new Error('fixture point missing')

    dispatchPointer('pointermove', point)

    const tooltip = container.querySelector('[role="tooltip"]')
    // At 420x320 the docked rail below the plot is only a few px tall — too thin to fit a
    // header plus a row for every series without clamping — so the overlay floats the tooltip
    // next to the point instead of shipping a box with rows silently hidden (see
    // InteractionOverlay's fixed -> fluid escalation, keyed on `TooltipPlacement.status`).
    expect(tooltip?.getAttribute('data-tooltip-mode')).toBe('fluid')
    expect(tooltip?.getAttribute('data-series-id')).toBe('alpha')
    expect(tooltip?.getAttribute('data-point-index')).toBe('2')
    // Point index 2 isn't the series' last point, so the header shows the bucket it covers —
    // [this point's x, the next point's x) — rather than a single instant.
    expect(tooltip?.querySelector('.shiftcharts-interaction__tooltip-header')?.textContent).toBe('Jan 03 → Jan 04')
    expect(tooltip?.querySelector('.shiftcharts-interaction__tooltip-overflow')).toBeNull()
    expect(container.querySelector('[role="status"]')?.textContent).toContain('ALPHA')

    const crosshair = container.querySelector('.shiftcharts-interaction__crosshair')
    expect(crosshair?.getAttribute('clip-path')).toBe('url(#interaction-test-plot-clip)')
    expect(crosshair?.querySelector('line')?.getAttribute('y1')).toBe(String(renderedFrame.plot.y))
    expect(crosshair?.querySelector('line')?.getAttribute('y2')).toBe(
      String(renderedFrame.plot.y + renderedFrame.plot.height),
    )
    const crosshairLine = crosshair?.querySelector('line')
    const nextPoint = renderedFrame.series[0]?.points[4]
    if (crosshairLine === null || crosshairLine === undefined || nextPoint === undefined) {
      throw new Error('crosshair fixture missing')
    }
    dispatchPointer('pointermove', nextPoint)
    expect(crosshair?.querySelector('line')).toBe(crosshairLine)
    expect(crosshairLine.getAttribute('x1')).toBe(String(nextPoint.x))

    dispatchPointer('pointerout', point)
    expect(container.querySelector('[role="tooltip"]')).toBeNull()
    expect(crosshair?.getAttribute('data-active')).toBe('false')
  })

  it('opens and closes a tap tooltip without treating leave as dismissal', () => {
    const { renderedFrame } = renderOverlay(context(320, 120))
    const point = renderedFrame.series[0]?.points[1]
    if (point === undefined) throw new Error('fixture point missing')

    dispatchPointer('pointerdown', point)
    // The docked rail at this size cannot fit the tooltip either, so this floats too — see the
    // fixed -> fluid escalation this describe block exercises above.
    expect(container.querySelector('[role="tooltip"]')?.getAttribute('data-tooltip-mode')).toBe('fluid')

    dispatchPointer('pointerout', point)
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull()

    dispatchPointer('pointerdown', point)
    expect(container.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('renders shared active points and allows the client highlight to be disabled', () => {
    const { renderedFrame } = renderOverlay(context(420, 320))
    const point = renderedFrame.series[0]?.points[2]
    if (point === undefined) throw new Error('fixture point missing')

    dispatchPointer('pointermove', point)

    expect(container.querySelectorAll('.shiftcharts-interaction__active-point')).toHaveLength(2)
    expect(container.querySelector('.shiftcharts-interaction__active-point[data-series-id="alpha"]')).not.toBeNull()
    expect(container.querySelector('.shiftcharts-interaction__active-point[data-series-id="beta"]')).not.toBeNull()

    renderOverlay(context(420, 320), { activePointHighlight: false })
    expect(container.querySelector('.shiftcharts-interaction__active-point')).toBeNull()
  })

  it('keeps every shared row visible when fluid placement has room', () => {
    const { renderedFrame } = renderOverlay(context(420, 320), { tooltipPlacement: 'fluid' })
    const point = renderedFrame.series[0]?.points[2]
    if (point === undefined) throw new Error('fixture point missing')

    dispatchPointer('pointermove', point)

    const tooltip = container.querySelector('[role="tooltip"]')
    expect(tooltip?.getAttribute('data-tooltip-mode')).toBe('fluid')
    expect(tooltip?.querySelectorAll('.shiftcharts-interaction__tooltip-row')).toHaveLength(2)
    // The fixture is a 'line' chart, so each row's swatch is the dash-matching line variant
    // (a tiny inline <svg><line>), not the generic dot — see the swatch-shape test below for
    // the dot fallback on a non-line chart type.
    expect(
      [...(tooltip?.querySelectorAll('.shiftcharts-interaction__tooltip-row') ?? [])].map((row) => ({
        seriesId: row.getAttribute('data-series-id'),
        seriesIndex: row.getAttribute('data-series-index'),
        lineSwatch: row.querySelector('.shiftcharts-interaction__tooltip-swatch-line') !== null,
      })),
    ).toEqual([
      { seriesId: 'alpha', seriesIndex: '0', lineSwatch: true },
      { seriesId: 'beta', seriesIndex: '1', lineSwatch: true },
    ])
    expect(tooltip?.querySelector('.shiftcharts-interaction__tooltip-overflow')).toBeNull()
  })

  it('shows a single instant, not a range, for the last point in a series', () => {
    const { renderedFrame } = renderOverlay(context(420, 320))
    const lastIndex = renderedFrame.series[0]!.points.length - 1
    const point = renderedFrame.series[0]?.points[lastIndex]
    if (point === undefined) throw new Error('fixture point missing')

    dispatchPointer('pointermove', point)

    const tooltip = container.querySelector('[role="tooltip"]')
    expect(tooltip?.querySelector('.shiftcharts-interaction__tooltip-header')?.textContent).toBe('Jan 07')
  })

  it('falls back to the plain dot swatch on a non-line chart type', () => {
    const ctx = context(420, 320)
    const resolved = planChart('scatter', ctx, describeShape(DATA))
    const renderedFrame = frame(ctx, resolved)
    act(() => {
      root.render(
        createElement(
          Fragment,
          null,
          createElement('figure', { className: 'shiftcharts-chart' }),
          createElement(InteractionOverlay, {
            containerRef,
            plan: resolved,
            data: DATA,
            ctx,
            title: 'Revenue',
            id: 'interaction-scatter-test',
          }),
        ),
      )
    })
    act(() => {})
    const point = renderedFrame.series[0]?.points[2]
    if (point === undefined) throw new Error('fixture point missing')

    Object.defineProperty(container.querySelector('.shiftcharts-interaction__svg')!, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0, top: 0, width: renderedFrame.box.width, height: renderedFrame.box.height,
        right: renderedFrame.box.width, bottom: renderedFrame.box.height, x: 0, y: 0, toJSON: () => ({}),
      }),
    })
    act(() => {
      container
        .querySelector('.shiftcharts-interaction__target')!
        .dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: point.x, clientY: point.y }))
    })

    const row = container.querySelector('.shiftcharts-interaction__tooltip-row')
    expect(row?.querySelector('.shiftcharts-interaction__tooltip-swatch')).not.toBeNull()
    expect(row?.querySelector('.shiftcharts-interaction__tooltip-swatch-line')).toBeNull()
  })

  it('uses fluid placement at Canvas and preserves the explicit datum identity through resize', () => {
    const initial = renderOverlay(context(700, 520))
    const point = initial.renderedFrame.series[0]?.points[1]
    if (point === undefined) throw new Error('fixture point missing')
    dispatchPointer('pointermove', point)

    const tooltip = container.querySelector('[role="tooltip"]')
    expect(tooltip?.getAttribute('data-tooltip-mode')).toBe('fluid')
    expect(
      Number.parseFloat(tooltip?.getAttribute('style')?.match(/inset-inline-start: ([^;]+)/)?.[1] ?? ''),
    ).toBeGreaterThanOrEqual(0)

    const resizedContext = context(420, 320)
    const resizedPlan = plan(resizedContext)
    act(() => {
      root.render(
        createElement(
          Fragment,
          null,
          createElement('figure', { className: 'shiftcharts-chart' }),
          createElement(InteractionOverlay, {
            containerRef,
            plan: resizedPlan,
            data: DATA,
            ctx: resizedContext,
            title: 'Revenue',
            id: 'interaction-test',
          }),
        ),
      )
    })
    act(() => {})

    // Panel's docked rail can't fit this tooltip either, so it stays fluid after the resize —
    // what this asserts is that the datum identity survives, not a mode switch.
    expect(container.querySelector('[role="tooltip"]')?.getAttribute('data-tooltip-mode')).toBe('fluid')
    expect(container.querySelector('[role="tooltip"]')?.getAttribute('data-point-index')).toBe('1')
    expect(container.querySelector('[role="tooltip"]')?.getAttribute('data-series-id')).toBe('alpha')
  })
})

describe('delay, hide-delay, and snap tokens', () => {
  // Restricted to setTimeout/clearTimeout: the top-level beforeEach stubs
  // `requestAnimationFrame` to `undefined` so the pointer scheduler flushes synchronously (see
  // its comment above), and a broad `vi.useFakeTimers()` would silently replace that stub with
  // a fake RAF implementation, breaking every synchronous hover assertion in this block.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function setTiming(options: { delay?: string; hideDelay?: string; snap?: string }): void {
    const svg = container.querySelector('.shiftcharts-interaction__svg')
    if (!(svg instanceof SVGSVGElement)) throw new Error('interaction svg missing')
    if (options.delay !== undefined) svg.style.setProperty('--shiftcharts-tooltip-delay', options.delay)
    if (options.hideDelay !== undefined) svg.style.setProperty('--shiftcharts-tooltip-hide-delay', options.hideDelay)
    if (options.snap !== undefined) svg.style.setProperty('--shiftcharts-tooltip-snap', options.snap)
  }

  it('has no delay, hide-delay, or snap cutoff when the tokens are unset — unchanged prior behavior', () => {
    // No real stylesheet is loaded in this test environment, so this is also what every other
    // test in this file exercises: getComputedStyle reads back '' for these custom properties,
    // which parses to 0ms/0ms/no-cutoff, matching the overlay's behavior before these tokens
    // were wired up.
    const { renderedFrame } = renderOverlay(context(420, 320))
    const point = renderedFrame.series[0]?.points[2]
    if (point === undefined) throw new Error('fixture point missing')
    dispatchPointer('pointermove', { x: point.x + 40, y: point.y })
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull()
    dispatchPointer('pointerout', point)
    expect(container.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('gates the first tooltip appearance behind --shiftcharts-tooltip-delay, but not a later move to a different point', () => {
    const { renderedFrame } = renderOverlay(context(420, 320))
    setTiming({ delay: '200ms' })
    const point = renderedFrame.series[0]?.points[2]
    const nextPoint = renderedFrame.series[0]?.points[4]
    if (point === undefined || nextPoint === undefined) throw new Error('fixture point missing')

    dispatchPointer('pointermove', point)
    expect(container.querySelector('[role="tooltip"]')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(199)
    })
    expect(container.querySelector('[role="tooltip"]')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(container.querySelector('[role="tooltip"]')?.getAttribute('data-point-index')).toBe('2')

    dispatchPointer('pointermove', nextPoint)
    expect(container.querySelector('[role="tooltip"]')?.getAttribute('data-point-index')).toBe('4')
  })

  it('keeps the tooltip up for --shiftcharts-tooltip-hide-delay after the pointer leaves', () => {
    const { renderedFrame } = renderOverlay(context(420, 320))
    setTiming({ hideDelay: '150ms' })
    const point = renderedFrame.series[0]?.points[2]
    if (point === undefined) throw new Error('fixture point missing')

    dispatchPointer('pointermove', point)
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull()

    dispatchPointer('pointerout', point)
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(149)
    })
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(container.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('cancels a pending hide when the pointer re-enters before the hide delay elapses', () => {
    const { renderedFrame } = renderOverlay(context(420, 320))
    setTiming({ hideDelay: '150ms' })
    const point = renderedFrame.series[0]?.points[2]
    if (point === undefined) throw new Error('fixture point missing')

    dispatchPointer('pointermove', point)
    dispatchPointer('pointerout', point)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    dispatchPointer('pointermove', point)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    // 200ms have elapsed in total — past the 150ms hide delay — but the re-entry at the 100ms
    // mark canceled the pending hide, so the tooltip is still up.
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull()
  })

  it('treats a point beyond --shiftcharts-tooltip-snap as no match', () => {
    const { renderedFrame } = renderOverlay(context(420, 320))
    setTiming({ snap: '5px' })
    const point = renderedFrame.series[0]?.points[2]
    if (point === undefined) throw new Error('fixture point missing')

    dispatchPointer('pointermove', { x: point.x + 3, y: point.y })
    expect(container.querySelector('[role="tooltip"]')?.getAttribute('data-point-index')).toBe('2')

    dispatchPointer('pointerout', point)
    expect(container.querySelector('[role="tooltip"]')).toBeNull()

    dispatchPointer('pointermove', { x: point.x + 40, y: point.y })
    expect(container.querySelector('[role="tooltip"]')).toBeNull()
  })
})

describe('dismissal and keyboard access', () => {
  it('dismisses an open tooltip with Escape and exposes the same text through status', () => {
    const { renderedFrame } = renderOverlay(context(420, 320))
    const point = renderedFrame.series[0]?.points[0]
    if (point === undefined) throw new Error('fixture point missing')

    dispatchPointer('pointermove', point)
    expect(target().getAttribute('aria-describedby')).toBe('interaction-test-tooltip')
    expect(container.querySelector('[role="status"]')?.textContent).toContain('ALPHA')

    dispatchKey('Escape')
    expect(container.querySelector('[role="tooltip"]')).toBeNull()
    expect(target().getAttribute('aria-describedby')).toBeNull()
  })

  it('moves the explicit point index with keyboard arrows and Home/End', () => {
    renderOverlay(context(420, 320))
    target().focus()

    dispatchKey('Enter')
    expect(container.querySelector('[role="tooltip"]')?.getAttribute('data-point-index')).toBe('0')

    dispatchKey('ArrowRight')
    expect(container.querySelector('[role="tooltip"]')?.getAttribute('data-point-index')).toBe('1')

    dispatchKey('End')
    expect(container.querySelector('[role="tooltip"]')?.getAttribute('data-point-index')).toBe('6')
  })
})
