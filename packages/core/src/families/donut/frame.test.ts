import { describe, expect, it } from 'vitest'

import { describeShape } from '../../data.ts'
import { resolveFrame } from '../../frame.ts'
import { planChart } from '../../plan-chart.ts'
import { resolvePolicy } from '../../policy.ts'
import { sizeContextFromPixels } from '../../context.ts'

const DATA = [
  {
    id: 'programs',
    points: [
      { x: 0, y: 40 },
      { x: 1, y: 24 },
      { x: 2, y: 16 },
      { x: 3, y: 10 },
      { x: 4, y: 6 },
      { x: 5, y: 4 },
      { x: 6, y: 3 },
      { x: 7, y: 2 },
      { x: 8, y: 1 },
      { x: 9, y: 1 },
    ],
  },
] as const

describe('donut frame geometry', () => {
  it('keeps all panel categories and preserves stable slice identity', () => {
    const ctx = sizeContextFromPixels(500, 300)
    const plan = planChart('donut', ctx, describeShape(DATA))
    const frame = resolveFrame(plan, DATA, ctx, resolvePolicy())
    const arcs = frame.series[0]?.arcs ?? []
    expect(arcs).toHaveLength(10)
    expect(arcs[0]?.id).toBe('programs:number:0')
    expect(arcs.at(-1)?.id).toBe('programs:number:9')
    expect(arcs.every((arc) => arc.d.length > 0 && arc.share > 0)).toBe(true)
    expect(JSON.parse(JSON.stringify(frame))).toEqual(frame)
  })

  it('makes Other visible at Canvas when category count and tiny shares exceed the contract', () => {
    const ctx = sizeContextFromPixels(700, 500)
    const plan = planChart('donut', ctx, describeShape(DATA))
    const arcs = resolveFrame(plan, DATA, ctx, resolvePolicy()).series[0]?.arcs ?? []
    expect(arcs.length).toBeLessThan(10)
    expect(arcs.at(-1)?.label).toBe('Other')
    expect(arcs.at(-1)?.other).toBe(true)
    expect(arcs.reduce((sum, arc) => sum + arc.share, 0)).toBeCloseTo(1)
  })

  it('keeps empty and missing data as an empty visible arc set', () => {
    const data = [{ id: 'empty', points: [{ x: 0, y: null }, { x: 1, y: 0 }] }] as const
    const ctx = sizeContextFromPixels(700, 500)
    const plan = planChart('donut', ctx, describeShape(data))
    expect(resolveFrame(plan, data, ctx, resolvePolicy()).series[0]?.arcs).toEqual([])
  })

  it('rejects negative values before geometry can misrepresent a part of a whole', () => {
    const data = [{ id: 'bad', points: [{ x: 0, y: -1 }] }] as const
    const ctx = sizeContextFromPixels(500, 300)
    expect(() => planChart('donut', ctx, describeShape(data))).toThrow(/non-negative/)
  })
})
