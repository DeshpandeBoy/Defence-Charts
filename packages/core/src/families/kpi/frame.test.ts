import { describe, expect, it } from 'vitest'

import { describeShape } from '../../data.ts'
import { planChart } from '../../plan-chart.ts'
import { resolveFrame } from '../../frame.ts'
import { sizeContextFromPixels } from '../../context.ts'

const DATA = [
  {
    id: 'readiness',
    label: 'Readiness',
    unit: '%',
    target: 75,
    status: 'positive' as const,
    points: [
      { x: 0, y: 68 },
      { x: 1, y: 71 },
      { x: 2, y: 74 },
    ],
  },
] as const

describe('KPI frame composition', () => {
  it('keeps metric qualifiers in the serialisable value frame', () => {
    const ctx = sizeContextFromPixels(240, 80)
    const frame = resolveFrame(planChart('kpi', ctx, describeShape(DATA)), DATA, ctx)
    const entry = frame.value?.entries[0]

    expect(entry).toMatchObject({
      seriesId: 'readiness',
      text: '74',
      unit: '%',
      target: { value: 75, text: '75' },
      status: 'positive',
      delta: { text: '+3', direction: 'up' },
      comparison: '71',
    })
    expect(JSON.parse(JSON.stringify(frame))).toEqual(frame)
  })

  it('keeps direction explicit for down and flat changes', () => {
    const ctx = sizeContextFromPixels(240, 80)
    const down = [{ id: 'down', points: [{ x: 0, y: 10 }, { x: 1, y: 8 }] }] as const
    const flat = [{ id: 'flat', points: [{ x: 0, y: 10 }, { x: 1, y: 10 }] }] as const
    const downFrame = resolveFrame(planChart('kpi', ctx, describeShape(down)), down, ctx)
    const flatFrame = resolveFrame(planChart('kpi', ctx, describeShape(flat)), flat, ctx)

    expect(downFrame.value?.entries[0]?.delta).toEqual({ text: '−2', direction: 'down' })
    expect(flatFrame.value?.entries[0]?.delta).toEqual({ text: '0', direction: 'flat' })
  })

  it('renders a missing target/status as explicit absence rather than an inferred value', () => {
    const data = [{ id: 'unknown', points: [{ x: 0, y: null }, { x: 1, y: 4 }] }] as const
    const ctx = sizeContextFromPixels(100, 100)
    const frame = resolveFrame(planChart('kpi', ctx, describeShape(data)), data, ctx)
    const entry = frame.value?.entries[0]

    expect(entry?.target).toBeNull()
    expect(entry?.status).toBeNull()
    expect(entry?.delta).toBeNull()
  })
})
