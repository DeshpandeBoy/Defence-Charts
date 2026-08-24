import { describe, expect, it } from 'vitest'

import { describeShape, planChart, resolveFrame, resolvePolicy, sizeContextFromPixels } from './index.ts'

const DATA = [{
  id: 'pipeline',
  points: [
    { x: 2, y: 40 },
    { x: 0, y: 100 },
    { x: 1, y: 75 },
    { x: 3, y: 10 },
  ],
}]

describe('D6.1 funnel frame', () => {
  it('orders stages canonically and resolves stable conversion/drop-off geometry', () => {
    const ctx = sizeContextFromPixels(900, 520)
    const plan = planChart('funnel', ctx, describeShape(DATA))
    const frame = resolveFrame(plan, DATA, ctx, resolvePolicy()).series[0]?.funnel

    expect(plan.marks.primary).toEqual({ kind: 'funnel', orientation: 'vertical', detail: 'dropoff' })
    expect(frame?.stages.map((stage) => stage.id)).toEqual([
      'pipeline:0',
      'pipeline:1',
      'pipeline:2',
      'pipeline:3',
    ])
    expect(frame?.stages.map((stage) => stage.value)).toEqual([100, 75, 40, 10])
    expect(frame?.stages[1]?.conversion).toBe(0.75)
    expect(frame?.stages[1]?.dropoff).toBe(0.25)
    expect(frame?.overallConversion).toBe(0.1)
    for (const stage of frame?.stages ?? []) {
      expect(Number.isFinite(stage.x)).toBe(true)
      expect(Number.isFinite(stage.y)).toBe(true)
      expect(stage.width).toBeGreaterThanOrEqual(0)
      expect(stage.height).toBeGreaterThanOrEqual(0)
    }
    expect(JSON.parse(JSON.stringify(frame))).toEqual(frame)
  })

  it('uses horizontal bars for Strip and an explicit summary for Tile', () => {
    const stripCtx = sizeContextFromPixels(400, 200)
    const stripPlan = planChart('funnel', stripCtx, describeShape(DATA))
    const stripFrame = resolveFrame(stripPlan, DATA, stripCtx, resolvePolicy()).series[0]?.funnel
    expect(stripPlan.marks.primary).toEqual({ kind: 'funnel', orientation: 'horizontal', detail: 'stages' })
    expect(stripFrame?.stages.every((stage) => stage.width >= 0 && stage.height >= 0)).toBe(true)

    const tileCtx = sizeContextFromPixels(200, 200)
    const tilePlan = planChart('funnel', tileCtx, describeShape(DATA))
    expect(tilePlan.marks.primary).toEqual({ kind: 'funnel', orientation: 'vertical', detail: 'summary' })
    expect(tilePlan.narrative.valueDisplay).toBe('none')
    expect(tilePlan.funnel?.summary).toBe('conversion')
  })

  it('keeps empty and zero-baseline semantics explicit', () => {
    const ctx = sizeContextFromPixels(900, 520)
    const empty = [{ id: 'empty', points: [] }]
    const emptyPlan = planChart('funnel', ctx, describeShape(empty))
    const emptyFrame = resolveFrame(emptyPlan, empty, ctx, resolvePolicy()).series[0]?.funnel
    expect(emptyFrame).toEqual({ stages: [], overallConversion: null })

    const zero = [{ id: 'zero', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }]
    const zeroPlan = planChart('funnel', ctx, describeShape(zero))
    const zeroFrame = resolveFrame(zeroPlan, zero, ctx, resolvePolicy()).series[0]?.funnel
    expect(zeroFrame?.overallConversion).toBeNull()
    expect(zeroFrame?.stages.every((stage) => stage.conversion === null)).toBe(true)
  })

  it('rejects negative, duplicate, and ambiguous multi-series inputs', () => {
    const ctx = sizeContextFromPixels(900, 520)
    expect(() => planChart('funnel', ctx, describeShape([{ id: 'negative', points: [{ x: 0, y: -1 }] }]))).toThrow(
      /funnel requires finite non-negative stage values/,
    )
    expect(() => planChart('funnel', ctx, describeShape([{ id: 'duplicate', points: [{ x: 0, y: 1 }, { x: 0, y: 2 }] }]))).toThrow(
      /duplicate x values are ambiguous/,
    )
    expect(() => planChart('funnel', ctx, describeShape([
      { id: 'one', points: [{ x: 0, y: 1 }] },
      { id: 'two', points: [{ x: 0, y: 1 }] },
    ]))).toThrow(/exactly one series/)
  })
})
