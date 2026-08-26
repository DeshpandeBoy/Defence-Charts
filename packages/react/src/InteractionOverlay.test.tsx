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
import { act, createElement, Fragment, type RefObject } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

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
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  containerRef = { current: container }
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
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

function renderOverlay(ctx: SizeContext): { resolved: ChartPlan; renderedFrame: ChartFrame } {
  const resolved = plan(ctx)
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

  it('keeps the interaction layer inside the chart figure and exposes a status equivalent', () => {
    renderOverlay(context(420, 320))

    expect(chartHost.querySelector('.shiftcharts-interaction')).not.toBeNull()
    expect(chartHost.querySelector('[role="status"]')).not.toBeNull()
    expect(chartHost.querySelector('.shiftcharts-interaction__target')?.getAttribute('role')).toBe('button')
  })
})

describe('fixed and fluid tooltip interaction', () => {
  it('uses the nearest stable datum for fixed hover, clips the crosshair, and clears on leave', () => {
    const { renderedFrame } = renderOverlay(context(420, 320))
    const point = renderedFrame.series[0]?.points[2]
    if (point === undefined) throw new Error('fixture point missing')

    dispatchPointer('pointermove', point)

    const tooltip = container.querySelector('[role="tooltip"]')
    expect(tooltip?.getAttribute('data-tooltip-mode')).toBe('fixed')
    expect(tooltip?.getAttribute('data-series-id')).toBe('alpha')
    expect(tooltip?.getAttribute('data-point-index')).toBe('2')
    expect(container.querySelector('[role="status"]')?.textContent).toContain('ALPHA')

    const crosshair = container.querySelector('.shiftcharts-interaction__crosshair')
    expect(crosshair?.getAttribute('clip-path')).toBe('url(#interaction-test-plot-clip)')
    expect(crosshair?.querySelector('line')?.getAttribute('y1')).toBe(String(renderedFrame.plot.y))
    expect(crosshair?.querySelector('line')?.getAttribute('y2')).toBe(
      String(renderedFrame.plot.y + renderedFrame.plot.height),
    )

    dispatchPointer('pointerout', point)
    expect(container.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('opens and closes a fixed tap tooltip without treating leave as dismissal', () => {
    const { renderedFrame } = renderOverlay(context(320, 120))
    const point = renderedFrame.series[0]?.points[1]
    if (point === undefined) throw new Error('fixture point missing')

    dispatchPointer('pointerdown', point)
    expect(container.querySelector('[role="tooltip"]')?.getAttribute('data-tooltip-mode')).toBe('fixed')

    dispatchPointer('pointerout', point)
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull()

    dispatchPointer('pointerdown', point)
    expect(container.querySelector('[role="tooltip"]')).toBeNull()
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

    expect(container.querySelector('[role="tooltip"]')?.getAttribute('data-tooltip-mode')).toBe('fixed')
    expect(container.querySelector('[role="tooltip"]')?.getAttribute('data-point-index')).toBe('1')
    expect(container.querySelector('[role="tooltip"]')?.getAttribute('data-series-id')).toBe('alpha')
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
