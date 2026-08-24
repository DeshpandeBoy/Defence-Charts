import { describe, expect, it } from 'vitest'

import type { TooltipPlacementInput } from './tooltip-placement.ts'
import {
  TooltipPlacementValidationError,
  placeTooltip,
} from './tooltip-placement.ts'

const WIDGET = { x: 0, y: 0, width: 240, height: 200 } as const
const PLOT = { x: 0, y: 60, width: 240, height: 80 } as const
const TOOLTIP = {
  width: 48,
  height: 32,
  headerHeight: 8,
  rowCount: 3,
  rowHeight: 8,
} as const

function input(overrides: Partial<TooltipPlacementInput> = {}): TooltipPlacementInput {
  return {
    mode: 'fixed',
    anchor: { x: 108, y: 90, width: 4, height: 4 },
    tooltip: TOOLTIP,
    widget: WIDGET,
    plot: PLOT,
    safePadding: 8,
    offset: 4,
    preferredFixedRail: 'top',
    preferredFluidSide: 'above-right',
    ...overrides,
  }
}

function expectInside(
  placement: ReturnType<typeof placeTooltip>,
  boundary: { x: number; y: number; width: number; height: number },
): void {
  expect(placement.x).toBeGreaterThanOrEqual(boundary.x)
  expect(placement.y).toBeGreaterThanOrEqual(boundary.y)
  expect(placement.x + placement.width).toBeLessThanOrEqual(boundary.x + boundary.width)
  expect(placement.y + placement.height).toBeLessThanOrEqual(boundary.y + boundary.height)
}

function expectValidation(fn: () => unknown, code: TooltipPlacementValidationError['code']): void {
  try {
    fn()
    throw new Error(`expected ${code}`)
  } catch (error) {
    expect(error).toBeInstanceOf(TooltipPlacementValidationError)
    expect((error as TooltipPlacementValidationError).code).toBe(code)
  }
}

describe('pure tooltip placement', () => {
  it('places fixed tooltips on the preferred rail and centres on the active X position', () => {
    const placement = placeTooltip(input())

    expect(placement).toEqual({
      x: 86,
      y: 24,
      width: 48,
      height: 32,
      mode: 'fixed',
      side: 'top',
      availableWidth: 224,
      availableHeight: 48,
      status: 'fit',
      hiddenRowCount: 0,
    })
    expectInside(placement, WIDGET)
  })

  it('does not follow anchor Y in fixed mode after the active X is selected', () => {
    const first = placeTooltip(input({ anchor: { x: 108, y: 20, width: 4, height: 4 } }))
    const second = placeTooltip(input({ anchor: { x: 108, y: 170, width: 4, height: 4 } }))

    expect(second).toEqual(first)
  })

  it('flips fixed rails when the preferred rail has no room', () => {
    const placement = placeTooltip(
      input({
        widget: { x: 0, y: 0, width: 200, height: 160 },
        plot: { x: 0, y: 24, width: 200, height: 40 },
        preferredFixedRail: 'top',
      }),
    )

    expect(placement.side).toBe('bottom')
    expect(placement.status).toBe('fit')
    expectInside(placement, WIDGET)
  })

  it('reports bounded row overflow when neither fixed rail can hold the panel', () => {
    const placement = placeTooltip(
      input({
        tooltip: { width: 80, height: 80, headerHeight: 8, rowCount: 6, rowHeight: 12 },
        widget: { x: 0, y: 0, width: 160, height: 120 },
        plot: { x: 0, y: 48, width: 160, height: 24 },
      }),
    )

    expect(placement.side).toBe('top')
    expect(placement.height).toBe(36)
    expect(placement.availableHeight).toBe(36)
    expect(placement.status).toBe('clamped')
    expect(placement.hiddenRowCount).toBe(4)
    expectInside(placement, { x: 0, y: 0, width: 160, height: 120 })
  })

  it.each([
    ['top-left', { x: 8, y: 8, width: 4, height: 4 }, 'below-right'],
    ['top-right', { x: 172, y: 8, width: 4, height: 4 }, 'below-left'],
    ['bottom-right', { x: 172, y: 148, width: 4, height: 4 }, 'above-left'],
    ['bottom-left', { x: 8, y: 148, width: 4, height: 4 }, 'above-right'],
  ] as const)('flips fluid placement at the %s corner', (_name, anchor, side) => {
    const placement = placeTooltip(
      input({
        mode: 'fluid',
        anchor,
        widget: { x: 0, y: 0, width: 200, height: 160 },
        plot: { x: 8, y: 8, width: 184, height: 144 },
        tooltip: { width: 64, height: 32, headerHeight: 8, rowCount: 2, rowHeight: 12 },
        safePadding: 8,
        offset: 8,
        preferredFluidSide: side === 'below-right' ? 'above-left' : side === 'below-left' ? 'above-right' : side === 'above-left' ? 'below-right' : 'below-left',
      }),
    )

    expect(placement.mode).toBe('fluid')
    expect(placement.side).toBe(side)
    expect(placement.status).toBe('fit')
    expectInside(placement, { x: 0, y: 0, width: 200, height: 160 })
  })

  it('shifts and clamps fluid placement when the requested box exceeds the boundary', () => {
    const placement = placeTooltip(
      input({
        mode: 'fluid',
        anchor: { x: 100, y: 90, width: 4, height: 4 },
        tooltip: { width: 400, height: 300, headerHeight: 12, rowCount: 20, rowHeight: 16 },
        safePadding: 10,
        offset: 6,
        preferredFluidSide: 'below-right',
      }),
    )

    expect(placement).toMatchObject({
      x: 10,
      y: 10,
      width: 220,
      height: 180,
      availableWidth: 220,
      availableHeight: 180,
      status: 'clamped',
      hiddenRowCount: 10,
    })
    expectInside(placement, WIDGET)
  })

  it('returns an explicit bounded fallback for a zero-space widget', () => {
    const placement = placeTooltip(
      input({
        widget: { x: 10, y: 20, width: 0, height: 0 },
        plot: { x: 10, y: 20, width: 0, height: 0 },
      }),
    )

    expect(placement).toEqual({
      x: 10,
      y: 20,
      width: 0,
      height: 0,
      mode: 'fixed',
      side: 'top',
      availableWidth: 0,
      availableHeight: 0,
      status: 'unavailable',
      hiddenRowCount: 3,
    })
  })

  it('recomputes deterministically when the widget and plot resize', () => {
    const narrow = placeTooltip(
      input({
        mode: 'fluid',
        anchor: { x: 128, y: 54, width: 4, height: 4 },
        widget: { x: 0, y: 0, width: 160, height: 120 },
        plot: { x: 8, y: 8, width: 144, height: 104 },
        tooltip: { width: 64, height: 32, headerHeight: 8, rowCount: 2, rowHeight: 12 },
        safePadding: 8,
        offset: 8,
        preferredFluidSide: 'below-right',
      }),
    )
    const wide = placeTooltip(
      input({
        mode: 'fluid',
        anchor: { x: 248, y: 54, width: 4, height: 4 },
        widget: { x: 0, y: 0, width: 280, height: 120 },
        plot: { x: 8, y: 8, width: 264, height: 104 },
        tooltip: { width: 64, height: 32, headerHeight: 8, rowCount: 2, rowHeight: 12 },
        safePadding: 8,
        offset: 8,
        preferredFluidSide: 'below-right',
      }),
    )

    expect(narrow).not.toEqual(wide)
    expectInside(narrow, { x: 0, y: 0, width: 160, height: 120 })
    expectInside(wide, { x: 0, y: 0, width: 280, height: 120 })
    expect(placeTooltip(input({ mode: 'fluid', anchor: { x: 128, y: 54, width: 4, height: 4 }, widget: { x: 0, y: 0, width: 160, height: 120 }, plot: { x: 8, y: 8, width: 144, height: 104 }, tooltip: { width: 64, height: 32, headerHeight: 8, rowCount: 2, rowHeight: 12 }, safePadding: 8, offset: 8, preferredFluidSide: 'below-right' }))).toEqual(narrow)
  })

  it('round-trips serialisable inputs and output without client-only fields', () => {
    const original = input({ mode: 'fluid', preferredFluidSide: 'below-left' })
    const decoded = JSON.parse(JSON.stringify(original)) as TooltipPlacementInput
    const placement = placeTooltip(decoded)
    const roundTrip = JSON.parse(JSON.stringify(placement))

    expect(roundTrip).toEqual(placement)
    expect(placeTooltip(decoded)).toEqual(placement)
    expect('function' in placement).toBe(false)
  })
})

describe('pure tooltip placement validation', () => {
  it('rejects malformed geometry and an out-of-widget plot', () => {
    expectValidation(
      () => placeTooltip(input({ widget: { x: 0, y: 0, width: -1, height: 100 } })),
      'invalid-number',
    )
    expectValidation(
      () => placeTooltip(input({ plot: { x: 0, y: 0, width: 300, height: 80 } })),
      'plot-outside-widget',
    )
    expectValidation(
      () => placeTooltip(input({ mode: 'other' as TooltipPlacementInput['mode'] })),
      'invalid-mode',
    )
  })

  it('accepts negative coordinate origins and oversized safe padding deterministically', () => {
    const placement = placeTooltip(
      input({
        widget: { x: -40, y: -30, width: 40, height: 30 },
        plot: { x: -40, y: -30, width: 40, height: 30 },
        anchor: { x: -20, y: -20, width: 4, height: 4 },
        safePadding: 100,
      }),
    )

    expect(placement.width).toBe(0)
    expect(placement.height).toBe(0)
    expect(placement.x).toBe(-20)
    expect(placement.y).toBe(-15)
    expect(placement.status).toBe('unavailable')
  })
})
