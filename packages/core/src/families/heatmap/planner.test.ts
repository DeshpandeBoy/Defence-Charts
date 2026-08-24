import { describe, expect, it } from 'vitest'

import type { SizeContext } from '../../context.ts'
import { describeShape } from '../../data.ts'
import { resolvePolicy } from '../../policy.ts'
import { HEATMAP_FAMILY_FIXTURE } from './fixture.ts'
import {
  HEATMAP_CHART_TYPES,
  HEATMAP_PLANNER_FIXTURE,
  heatmapFamilyPlanner,
  type HeatmapPlan,
} from './planner.ts'

const shape = describeShape(HEATMAP_FAMILY_FIXTURE.series)
const policy = resolvePolicy()
const DAY_MS = 86_400_000
const START = Date.UTC(2026, 0, 1)

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

function withoutUndefined(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) withoutUndefined(item)
    return
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      expect(item, `plan field '${key}' must not be undefined`).not.toBeUndefined()
      withoutUndefined(item)
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

function plan(sizeClass: SizeContext['sizeClass'], inputShape = shape): HeatmapPlan {
  return heatmapFamilyPlanner({
    type: 'heatmap',
    ctx: context(sizeClass),
    shape: inputShape,
    policy,
  }) as HeatmapPlan
}

describe('heatmap family planner', () => {
  it('keeps the deterministic fixture and family contract explicit', () => {
    expect(HEATMAP_FAMILY_FIXTURE.series).toHaveLength(2)
    expect(shape).toMatchObject({ series: 2, categories: 10, points: 12, hasNegative: true, temporal: true })
    expect(shape.labelMaxChars).toBeGreaterThan(0)
    expect(HEATMAP_CHART_TYPES).toEqual(['heatmap'])
    expect(HEATMAP_PLANNER_FIXTURE).toEqual({
      type: 'heatmap',
      nominalCellFloorPx: 8,
      nominalCellFloorTier: 'C',
      cellBudget: 2000,
      stripRange: 'recent-weeks',
      stageCellValues: 'hover',
      stageStreakAnnotations: 'visible',
    })
  })

  it('covers all six rungs with a frozen, complete, JSON-stable plan', () => {
    for (const sizeClass of ['micro', 'tile', 'strip', 'panel', 'canvas', 'stage'] as const) {
      const first = plan(sizeClass)
      const second = plan(sizeClass)
      expect(first.type).toBe('heatmap')
      expect(first.sizeClass).toBe(sizeClass)
      expect(first).toEqual(second)
      expect(JSON.parse(JSON.stringify(first))).toEqual(first)
      expect(Object.isFrozen(first)).toBe(true)
      expect(Object.isFrozen(first.heatmap)).toBe(true)
      withoutUndefined(first)
      finiteNumbers(first)
    }
  })

  it('replaces the unreadable Micro and Tile grid with one total value', () => {
    for (const sizeClass of ['micro', 'tile'] as const) {
      const current = plan(sizeClass)
      expect(current.marks.primary).toEqual({ kind: 'none' })
      expect(current.valueLegibility).toBe('single-value')
      expect(current.narrative.valueDisplay).toBe('latest')
      expect(current.regionOrder).toEqual(['value', 'table'])
      expect(current.heatmap).toMatchObject({
        range: 'total',
        weekdayLabels: 'none',
        monthLabels: 'none',
        intensityLegend: 'none',
        cellValues: 'none',
        accessibility: { cellText: 'summary', keyboard: 'widget' },
      })
      expect(current.interaction.trigger).toBe('none')
      expect(current.dataTable).toMatchObject({ disclosure: 'widget-tap', columns: 'summary' })
    }
  })

  it('keeps Strip to recent weeks without axis labels and exposes tap-to-reveal access', () => {
    const current = plan('strip')
    expect(current.marks.primary).toEqual({ kind: 'cell', bandStart: 0, bandEnd: 1 })
    expect(current.valueLegibility).toBe('shape-only')
    expect(current.axes.x.visible).toBe(false)
    expect(current.axes.y.visible).toBe(false)
    expect(current.labels).toMatchObject({ seriesLabels: 'none', valueLabels: 'none', maxChars: null })
    expect(current.heatmap).toMatchObject({
      range: 'recent-weeks',
      weekdayLabels: 'none',
      monthLabels: 'none',
      intensityLegend: 'none',
      accessibility: { cellText: 'table', keyboard: 'cells' },
    })
    expect(current.interaction).toMatchObject({ trigger: 'tap', tooltip: { enabled: true, placement: 'fix' } })
    expect(current.dataTable).toMatchObject({ disclosure: 'button', columns: 'all' })
  })

  it('restores the full Panel grid and weekday/month axis intent', () => {
    const current = plan('panel')
    expect(current.marks.primary).toEqual({ kind: 'cell', bandStart: 0, bandEnd: 1 })
    expect(current.valueLegibility).toBe('values')
    expect(current.axes.x.visible).toBe(true)
    expect(current.axes.y).toMatchObject({ visible: true, ticks: { mode: 'count', count: 7 } })
    expect(current.heatmap).toMatchObject({
      range: 'full-range',
      weekdayLabels: 'axis-intent',
      monthLabels: 'axis-intent',
      intensityLegend: 'none',
    })
    expect(current.interaction).toMatchObject({ trigger: 'hover', tooltip: { placement: 'fix' }, crosshair: true })
  })

  it('adds the Canvas intensity legend and spelled weekday labels', () => {
    const current = plan('canvas')
    expect(current.legend).toEqual({ placement: 'external', position: 'right', maxEntries: 8, showValues: true, showPercent: false })
    expect(current.regionOrder).toEqual(['plot', 'legend', 'table'])
    expect(current.heatmap).toMatchObject({
      weekdayLabels: 'spelled',
      monthLabels: 'axis-intent',
      intensityLegend: 'external',
      cellValues: 'none',
    })
    expect(current.interaction).toMatchObject({ trigger: 'hover', tooltip: { enabled: true, placement: 'fluid' }, brush: true, zoom: true })
  })

  it('adds Stage per-cell hover values and streak annotation intent', () => {
    const current = plan('stage')
    expect(current.heatmap).toMatchObject({
      weekdayLabels: 'spelled',
      intensityLegend: 'external',
      cellValues: 'hover',
      streakAnnotations: 'visible',
      accessibility: { cellText: 'table-and-hover', keyboard: 'cells' },
    })
    expect(current.narrative.annotations).toBe(true)
    expect(current.interaction).toMatchObject({ trigger: 'hover', tooltip: { placement: 'fluid' } })
  })

  it('bins dense temporal columns weekly instead of shrinking below the Tier-C floor', () => {
    const denseShape = { ...shape, categories: 200, points: 4_000 }
    const current = heatmapFamilyPlanner({
      type: 'heatmap',
      ctx: { ...context('panel'), width: 600, height: 320 },
      shape: denseShape,
      policy,
    }) as HeatmapPlan
    expect(current.aggregate.temporalBin).toBe('weekly')
    expect(current.heatmap.nominalCellFloorPx).toBe(8)
    expect(current.heatmap.nominalCellFloorTier).toBe('C')
    expect(current.marks.pointBudget).toBe(policy.pointBudget)
    expect(current.heatmap.cellBudget).toBe(policy.pointBudget)
    expect(current.marks.renderer).toBe('canvas')
    expect(JSON.parse(JSON.stringify(current))).toEqual(current)
  })

  it('keeps empty, missing, negative, extreme, and dense shapes explicit without value coercion', () => {
    const empty = plan('panel', describeShape([]))
    const missing = plan('panel', describeShape([{ id: 'missing', points: [{ x: new Date(START), y: null }] }]))
    const negative = plan('panel', describeShape([{ id: 'negative', points: [{ x: new Date(START), y: -10 }] }]))
    const extreme = plan('panel', describeShape([{ id: 'extreme', points: [{ x: new Date(START), y: Number.MAX_VALUE }] }]))
    const dense = plan('panel', { ...shape, points: policy.pointBudget + 1 })

    expect(empty.marks.primary).toEqual({ kind: 'cell', bandStart: 0, bandEnd: 1 })
    expect(missing.marks.primary).toEqual(negative.marks.primary)
    expect(extreme.marks.primary).toEqual(negative.marks.primary)
    expect(dense.marks.renderer).toBe('canvas')
    expect(dense.marks.pointBudget).toBe(policy.pointBudget)
    expect(JSON.stringify(dense)).not.toContain('NaN')
    expect(JSON.stringify(dense)).not.toContain('Infinity')
  })

  it('keeps unsorted and duplicate x handling at the data/frame boundary, not in the data-blind plan', () => {
    const unsorted = describeShape([
      {
        id: 'ordered-later',
        points: [
          { x: new Date(START + DAY_MS), y: 2 },
          { x: new Date(START), y: 1 },
        ],
      },
    ])
    const duplicate = describeShape([
      {
        id: 'duplicate-x',
        points: [
          { x: new Date(START), y: 1 },
          { x: new Date(START), y: 3 },
        ],
      },
    ])
    expect(unsorted.temporal).toBe(true)
    expect(duplicate.categories).toBe(1)
    expect(plan('panel', unsorted).marks.primary).toEqual(plan('panel', duplicate).marks.primary)
  })

  it('rejects unsupported family types and malformed/non-temporal populated shapes', () => {
    expect(() =>
      heatmapFamilyPlanner({ type: 'line', ctx: context('panel'), shape, policy } as never),
    ).toThrow(/does not accept chart type 'line'/)
    expect(() =>
      heatmapFamilyPlanner({
        type: 'heatmap',
        ctx: context('panel'),
        shape: { ...shape, points: -1 },
        policy,
      }),
    ).toThrow(/shape.points/)
    expect(() =>
      heatmapFamilyPlanner({
        type: 'heatmap',
        ctx: context('panel'),
        shape: { ...shape, temporal: false },
        policy,
      }),
    ).toThrow(/requires temporal data/)
    expect(() =>
      heatmapFamilyPlanner({
        type: 'heatmap',
        ctx: context('panel'),
        shape,
        policy: resolvePolicy({ minCellSize: 0 }),
      }),
    ).toThrow(/nominal cell floor/)
  })
})
