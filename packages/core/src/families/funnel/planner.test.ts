import { describe, expect, it } from 'vitest'

import type { SizeContext } from '../../context.ts'
import { describeShape } from '../../data.ts'
import { resolvePolicy } from '../../policy.ts'
import { FUNNEL_FAMILY_FIXTURE, FUNNEL_VALUE_CASES } from './fixture.ts'
import {
  FUNNEL_CHART_TYPES,
  FUNNEL_PLANNER_FIXTURE,
  funnelFamilyPlanner,
  type FunnelPlan,
} from './planner.ts'

const shape = describeShape(FUNNEL_FAMILY_FIXTURE.series)
const policy = resolvePolicy()

function context(sizeClass: SizeContext['sizeClass']): SizeContext {
  const sizes = {
    micro: [100, 100, 1, 1],
    tile: [200, 200, 2, 1],
    strip: [560, 180, 3, 1],
    panel: [560, 320, 3, 3],
    canvas: [840, 520, 6, 5],
    stage: [1200, 760, 9, 6],
  } as const
  const [width, height, cols, rows] = sizes[sizeClass]
  return { width, height, cols, rows, aspect: 'landscape', sizeClass }
}

function withoutUndefined(value: unknown, path = 'plan'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => withoutUndefined(item, `${path}[${index}]`))
    return
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      expect(item, `${path}.${key} must not be undefined`).not.toBeUndefined()
      withoutUndefined(item, `${path}.${key}`)
    }
  }
}

function finiteNumbers(value: unknown, path = 'plan'): void {
  if (typeof value === 'number') {
    expect(Number.isFinite(value), `${path} must be finite`).toBe(true)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => finiteNumbers(item, `${path}[${index}]`))
    return
  }
  if (value !== null && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => finiteNumbers(item, `${path}.${key}`))
  }
}

function plan(sizeClass: SizeContext['sizeClass'], inputShape = shape): FunnelPlan {
  return funnelFamilyPlanner({
    type: 'funnel',
    ctx: context(sizeClass),
    shape: inputShape,
    policy,
  }) as FunnelPlan
}

describe('funnel family planner', () => {
  it('keeps the family fixture, rung vocabulary, and Tier-C boundary explicit', () => {
    expect(FUNNEL_FAMILY_FIXTURE.series).toHaveLength(1)
    expect(shape).toEqual({
      series: 1,
      categories: 5,
      points: 5,
      hasNegative: false,
      labelMaxChars: 1,
      temporal: false,
    })
    expect(FUNNEL_CHART_TYPES).toEqual(['funnel'])
    expect(FUNNEL_PLANNER_FIXTURE).toEqual({
      type: 'funnel',
      compactSummary: 'overall-conversion',
      stripOrientation: 'horizontal',
      panelOrientation: 'vertical',
      canvasDetail: 'dropoff',
      stageDetail: 'breakdown',
      geometryDefaultTier: 'C',
      zeroBaseline: 'null-conversion-and-dropoff',
    })
  })

  it('covers all six rungs with a frozen, finite, JSON-stable plan', () => {
    for (const sizeClass of ['micro', 'tile', 'strip', 'panel', 'canvas', 'stage'] as const) {
      const first = plan(sizeClass)
      const second = plan(sizeClass)
      expect(first).toEqual(second)
      expect(first.type).toBe('funnel')
      expect(first.sizeClass).toBe(sizeClass)
      expect(first.funnel).toBeDefined()
      expect(JSON.parse(JSON.stringify(first))).toEqual(first)
      expect(Object.isFrozen(first)).toBe(true)
      expect(Object.isFrozen(first.funnel)).toBe(true)
      expect(Object.isFrozen(first.funnel?.accessibility)).toBe(true)
      withoutUndefined(first)
      finiteNumbers(first)
    }
  })

  it('replaces Micro and Tile with the overall-conversion summary', () => {
    for (const sizeClass of ['micro', 'tile'] as const) {
      const current = plan(sizeClass)
      expect(current.marks.primary).toEqual({ kind: 'none' })
      expect(current.valueLegibility).toBe('single-value')
      expect(current.narrative.valueDisplay).toBe('latest')
      expect(current.regionOrder).toEqual(['value', 'table'])
      expect(current.funnel).toMatchObject({
        summary: 'conversion',
        stageLabels: 'none',
        stageValues: 'none',
        dropoff: 'none',
        conversion: 'overall',
        accessibility: { stageText: 'summary', keyboard: 'widget' },
      })
      expect(current.dataTable).toMatchObject({ disclosure: 'widget-tap', columns: 'summary' })
      expect(current.interaction.trigger).toBe('none')
    }
  })

  it('transposes Strip to horizontal stage bars without claiming plot value legibility', () => {
    const current = plan('strip')
    expect(current.marks.primary).toEqual({ kind: 'funnel', orientation: 'horizontal', detail: 'stages' })
    expect(current.orientation).toBe('horizontal')
    expect(current.labels).toMatchObject({
      seriesLabels: 'none',
      valueLabels: 'none',
      axisLabelDegrade: 'axis-transpose',
      maxChars: null,
    })
    expect(current.axes.x.visible).toBe(false)
    expect(current.axes.y.visible).toBe(false)
    expect(current.valueLegibility).toBe('shape-only')
    expect(current.funnel).toMatchObject({
      summary: 'none',
      stageLabels: 'all',
      stageValues: 'none',
      dropoff: 'none',
      conversion: 'none',
      accessibility: { stageText: 'table-and-mark', keyboard: 'stages' },
    })
    expect(current.interaction).toMatchObject({ trigger: 'tap', tooltip: { enabled: true, placement: 'fix' } })
  })

  it('keeps Panel vertical with stage names and values', () => {
    const current = plan('panel')
    expect(current.marks.primary).toEqual({ kind: 'funnel', orientation: 'vertical', detail: 'stages' })
    expect(current.orientation).toBe('vertical')
    expect(current.funnel).toMatchObject({
      stageLabels: 'all',
      stageValues: 'all',
      dropoff: 'none',
      conversion: 'none',
      accessibility: { stageText: 'table-and-mark', keyboard: 'stages' },
    })
    expect(current.dataTable).toMatchObject({ disclosure: 'button', columns: 'all' })
    expect(current.interaction).toMatchObject({ trigger: 'hover', tooltip: { placement: 'fix' }, crosshair: true })
  })

  it('adds per-stage drop-off semantics at Canvas and relative conversion/breakdown at Stage', () => {
    const canvas = plan('canvas')
    const stage = plan('stage')
    expect(canvas.marks.primary).toEqual({ kind: 'funnel', orientation: 'vertical', detail: 'dropoff' })
    expect(canvas.funnel).toMatchObject({ stageValues: 'all', dropoff: 'per-stage', conversion: 'none' })
    expect(canvas.interaction).toMatchObject({ trigger: 'hover', tooltip: { placement: 'fluid' }, brush: false, zoom: false })

    expect(stage.marks.primary).toEqual({ kind: 'funnel', orientation: 'vertical', detail: 'breakdown' })
    expect(stage.funnel).toMatchObject({
      summary: 'conversion',
      stageValues: 'all',
      dropoff: 'per-stage',
      conversion: 'relative',
    })
    expect(stage.narrative.annotations).toBe(true)
    expect(stage.interaction).toMatchObject({ trigger: 'hover', tooltip: { placement: 'fluid' } })
  })

  it('keeps empty, null, zero-baseline, single-stage, unsorted, and extreme values at the value-aware seam', () => {
    const empty = plan('panel', describeShape(FUNNEL_VALUE_CASES.empty))
    const missing = plan('panel', describeShape(FUNNEL_VALUE_CASES.nullStage))
    const zero = plan('stage', describeShape(FUNNEL_VALUE_CASES.zeroBaseline))
    const single = plan('panel', describeShape(FUNNEL_VALUE_CASES.singleStage))
    const unsorted = plan('panel', describeShape(FUNNEL_VALUE_CASES.unsorted))
    const sorted = plan(
      'panel',
      describeShape([
        { id: 'sorted', points: [{ x: 0, y: 20 }, { x: 1, y: 15 }, { x: 2, y: 10 }] },
      ]),
    )
    const extreme = plan('stage', describeShape(FUNNEL_VALUE_CASES.extreme))

    // The data-blind plan does not fabricate stage values or conversion text. The coordinator's
    // frame must turn empty/null/zero-baseline cases into explicit table dashes/null semantics.
    expect(empty.funnel?.stageValues).toBe('all')
    expect(missing).toEqual(plan('panel'))
    expect(zero.funnel?.conversion).toBe('relative')
    expect(single.marks.primary).toEqual({ kind: 'funnel', orientation: 'vertical', detail: 'stages' })
    // Ordering is deliberately absent from DataShape. The same plan semantics must survive an
    // unsorted raw series; the coordinator frame, not this planner, canonicalises its x values.
    expect(unsorted).toEqual(sorted)
    expect(extreme).toEqual(plan('stage', describeShape(FUNNEL_VALUE_CASES.extreme)))
    finiteNumbers(empty)
    finiteNumbers(missing)
    finiteNumbers(zero)
    finiteNumbers(single)
    finiteNumbers(unsorted)
    finiteNumbers(extreme)
  })

  it('rejects negative, multi-series, duplicate, and malformed ambiguous shapes explicitly', () => {
    expect(() => plan('panel', describeShape(FUNNEL_VALUE_CASES.negative))).toThrow(/finite non-negative/)
    expect(() =>
      plan('panel', describeShape([
        ...FUNNEL_FAMILY_FIXTURE.series,
        { id: 'second', points: [{ x: 0, y: 10 }] },
      ])),
    ).toThrow(/exactly one series/)
    expect(() => plan('panel', describeShape(FUNNEL_VALUE_CASES.duplicateStage))).toThrow(/duplicate x values/)
    expect(() =>
      plan('panel', { ...shape, categories: 6 }),
    ).toThrow(/categories cannot exceed shape.points/)
    expect(() =>
      funnelFamilyPlanner({ type: 'line', ctx: context('panel'), shape, policy } as never),
    ).toThrow(/does not accept chart type 'line'/)
    expect(() =>
      funnelFamilyPlanner({ type: 'funnel', ctx: context('panel'), shape: { ...shape, points: -1 }, policy }),
    ).toThrow(/shape.points/)
    expect(() =>
      funnelFamilyPlanner({ type: 'funnel', ctx: context('panel'), shape, policy: resolvePolicy({ pointBudget: -1 }) }),
    ).toThrow(/point budget/)
  })

  it('keeps the planner boundary separate from central registration and frame geometry', () => {
    const planValue = plan('canvas')
    expect(planValue.funnel).toBeDefined()
    expect(planValue.marks.primary.kind).toBe('funnel')
    expect(JSON.stringify(planValue)).not.toContain('NaN')
    expect(JSON.stringify(planValue)).not.toContain('Infinity')
    // The fixture's duplicate and unsorted cases are intentionally data/frame concerns; the
    // planner only receives counts and cannot reorder raw x values or produce pixel geometry.
    expect(describeShape(FUNNEL_VALUE_CASES.unsorted).categories).toBe(3)
    expect(describeShape(FUNNEL_VALUE_CASES.duplicateStage)).toMatchObject({ categories: 1, points: 2 })
  })
})
