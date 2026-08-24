import { describe, expect, it } from 'vitest'

import type { SizeContext } from '../../context.ts'
import { describeShape } from '../../data.ts'
import { resolvePolicy } from '../../policy.ts'
import { PROGRESS_FAMILY_FIXTURE, PROGRESS_VALIDATION_FIXTURES } from './fixture.ts'
import {
  PROGRESS_CHART_TYPES,
  PROGRESS_PLANNER_FIXTURE,
  progressFamilyPlanner,
} from './planner.ts'

const data = [PROGRESS_FAMILY_FIXTURE.series] as const
const shape = describeShape(data)
const policy = resolvePolicy()

function context(sizeClass: SizeContext['sizeClass']): SizeContext {
  const sizes = {
    micro: [100, 100, 1, 1],
    tile: [200, 200, 2, 1],
    strip: [400, 200, 3, 1],
    panel: [500, 300, 3, 3],
    canvas: [700, 500, 6, 5],
    stage: [1000, 700, 9, 6],
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

describe('progress family planner', () => {
  it('keeps the family type and target assumptions explicit', () => {
    expect(PROGRESS_FAMILY_FIXTURE.series).toMatchObject({
      id: 'readiness',
      unit: '%',
      target: 100,
      status: 'positive',
    })
    expect(PROGRESS_CHART_TYPES).toEqual(['progress'])
    expect(PROGRESS_PLANNER_FIXTURE).toEqual({
      type: 'progress',
      radialSizeClasses: ['micro', 'tile'],
      horizontalSizeClasses: ['strip', 'panel', 'canvas', 'stage'],
      microValueDisplay: 'none',
      comparisonValueDisplay: 'latest',
      targetValidation: 'finite-positive-only',
    })
  })

  it('records the shared frame validation cases without coercing them in the planner', () => {
    expect(PROGRESS_VALIDATION_FIXTURES.map(({ name }) => name)).toEqual([
      'complete',
      'partial',
      'over-target',
      'negative-current',
      'missing-current',
      'missing-target',
      'zero-target',
      'negative-target',
      'non-finite-target',
    ])
    expect(PROGRESS_VALIDATION_FIXTURES.filter(({ state }) => state === 'determinate')).toHaveLength(4)
    expect(PROGRESS_VALIDATION_FIXTURES.filter(({ state }) => state === 'indeterminate')).toHaveLength(5)
    // The planner is deliberately data-blind: these cases are a contract for the frame seam,
    // not a reason to add value inspection or a second progress resolver here.
    expect(shape.series).toBe(1)
  })

  it('covers all six size classes with the explicit radial-to-horizontal mark substitution', () => {
    for (const sizeClass of ['micro', 'tile', 'strip', 'panel', 'canvas', 'stage'] as const) {
      const plan = progressFamilyPlanner({ type: 'progress', ctx: context(sizeClass), shape, policy })
      const radial = sizeClass === 'micro' || sizeClass === 'tile'
      expect(plan.type).toBe('progress')
      expect(plan.sizeClass).toBe(sizeClass)
      expect(plan.marks.primary).toEqual({ kind: 'progress', orientation: radial ? 'radial' : 'horizontal' })
      expect(plan.marks.primary.kind).not.toBe('line')
      expect(plan.marks.primary.kind).not.toBe('arc')
      expect(plan.marks.primary.kind).not.toBe('bar')
      expect(JSON.parse(JSON.stringify(plan))).toEqual(plan)
      withoutUndefined(plan)
    }
  })

  it('keeps the mark independent of missing and negative data shape summaries', () => {
    const emptyShape = describeShape([])
    const negativeShape = describeShape([
      { id: 'debt', points: [{ x: 0, y: -10 }, { x: 1, y: null }] },
    ])
    for (const sizeClass of ['micro', 'tile', 'strip', 'panel', 'canvas', 'stage'] as const) {
      const empty = progressFamilyPlanner({ type: 'progress', ctx: context(sizeClass), shape: emptyShape, policy })
      const negative = progressFamilyPlanner({ type: 'progress', ctx: context(sizeClass), shape: negativeShape, policy })
      expect(empty.marks.primary).toEqual(negative.marks.primary)
      expect(empty.type).toBe('progress')
      expect(negative.type).toBe('progress')
    }
  })

  it('keeps value, table, and interaction semantics explicit at each rung', () => {
    const micro = progressFamilyPlanner({ type: 'progress', ctx: context('micro'), shape, policy })
    expect(micro).toMatchObject({
      valueLegibility: 'shape-only',
      regionOrder: ['plot', 'table'],
      dataTable: { present: true, disclosure: 'widget-tap', columns: 'summary' },
      interaction: { trigger: 'none', tooltip: { enabled: false, placement: 'fix' } },
      axes: { x: { visible: false }, y: { visible: false }, y2: null },
      narrative: { valueDisplay: 'none', deltaBasis: false },
    })

    const tile = progressFamilyPlanner({ type: 'progress', ctx: context('tile'), shape, policy })
    expect(tile).toMatchObject({
      valueLegibility: 'single-value',
      regionOrder: ['value', 'plot', 'table'],
      dataTable: { present: true, disclosure: 'widget-tap', columns: 'summary' },
      interaction: { trigger: 'none', tooltip: { enabled: false, placement: 'fix' } },
      narrative: { valueDisplay: 'latest', deltaBasis: false },
    })

    const strip = progressFamilyPlanner({ type: 'progress', ctx: context('strip'), shape, policy })
    expect(strip).toMatchObject({
      regionOrder: ['value', 'plot', 'table'],
      dataTable: { disclosure: 'button', columns: 'all' },
      interaction: { trigger: 'tap', tooltip: { enabled: true, placement: 'fix' } },
    })

    const panel = progressFamilyPlanner({ type: 'progress', ctx: context('panel'), shape, policy })
    const stage = progressFamilyPlanner({ type: 'progress', ctx: context('stage'), shape, policy })
    expect(panel.interaction).toMatchObject({ trigger: 'hover', tooltip: { enabled: true, placement: 'fix' } })
    expect(stage.interaction).toMatchObject({ trigger: 'hover', tooltip: { enabled: true, placement: 'fluid' } })
    for (const plan of [micro, tile, strip, panel, stage]) {
      expect(plan.interaction.crosshair).toBe(false)
      expect(plan.interaction.brush).toBe(false)
      expect(plan.interaction.zoom).toBe(false)
      expect(plan.interaction.legendToggle).toBe(false)
      expect(plan.legend).toEqual({ placement: 'absent' })
    }
  })

  it('rejects another family instead of silently producing progress', () => {
    expect(() =>
      progressFamilyPlanner({
        type: 'kpi',
        ctx: context('panel'),
        shape,
        policy,
      } as never),
    ).toThrow(/progress planner does not accept chart type 'kpi'/)
  })
})
