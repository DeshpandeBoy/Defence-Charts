import { describe, expect, it } from 'vitest'

import { describeShape, planChart, resolveFrame, resolvePolicy, sizeContextFromPixels, type Series } from './index.ts'

const DAY = 86_400_000
const START = Date.UTC(2026, 0, 1)

const DATA = [
  {
    id: 'maintenance',
    points: [
      { x: new Date(START), y: 0 },
      { x: new Date(START + DAY), y: null },
      { x: new Date(START + DAY * 2), y: -2 },
    ],
  },
  {
    id: 'inspection',
    points: [
      { x: new Date(START + DAY * 2), y: 8 },
      { x: new Date(START), y: 4 },
    ],
  },
] as const

function panelFrame(data: readonly Series[] = DATA) {
  const ctx = sizeContextFromPixels(520, 300)
  const plan = planChart('heatmap', ctx, describeShape(data))
  return { plan, frame: resolveFrame(plan, data, ctx, resolvePolicy()) }
}

describe('heatmap frame seam', () => {
  it('builds a complete, finite grid with stable identity and explicit missing cells', () => {
    const first = panelFrame()
    const second = panelFrame()
    expect(first.plan.marks.primary).toEqual({ kind: 'cell', bandStart: 0, bandEnd: 1 })
    expect(first.frame.series).toHaveLength(2)

    const maintenance = first.frame.series[0]!
    expect(maintenance.cells).toHaveLength(3)
    expect(maintenance.cells.map((cell) => cell.id)).toEqual([
      `maintenance:${START}`,
      `maintenance:${START + DAY}`,
      `maintenance:${START + DAY * 2}`,
    ])
    expect(maintenance.cells[1]?.value).toBeNull()
    expect(maintenance.cells.every((cell) => Number.isFinite(cell.x) && Number.isFinite(cell.width))).toBe(true)
    expect(maintenance.cells.filter((cell) => cell.intensity !== null && cell.intensity !== undefined).length).toBe(2)
    expect(maintenance.cells.map((cell) => cell.id)).toEqual(second.frame.series[0]?.cells.map((cell) => cell.id))
    expect(JSON.parse(JSON.stringify(first.frame))).toEqual(first.frame)
  })

  it('rejects duplicate raw cells but aggregates distinct daily observations into weekly bins', () => {
    const duplicate = [
      { id: 'duplicate', points: [{ x: new Date(START), y: 1 }, { x: new Date(START), y: 2 }] },
    ] as const
    expect(() => panelFrame(duplicate)).toThrow(/duplicate cell/)

    const dense = [
      {
        id: 'dense',
        points: Array.from({ length: 100 }, (_, index) => ({
          x: new Date(START + index * DAY),
          y: index % 3,
        })),
      },
    ] as const
    const ctx = sizeContextFromPixels(300, 300)
    const plan = planChart('heatmap', ctx, describeShape(dense))
    expect(plan.aggregate.temporalBin).toBe('weekly')
    const frame = resolveFrame(plan, dense, ctx, resolvePolicy())
    expect(frame.series[0]?.cells.length).toBe(15)
    expect(frame.series[0]?.cells.every((cell) => cell.value !== null)).toBe(true)
  })

  it('keeps zero, negative, extreme, and empty inputs finite', () => {
    const data = [
      {
        id: 'edge',
        points: [
          { x: new Date(START), y: 0 },
          { x: new Date(START + DAY), y: -Number.MAX_VALUE },
          { x: new Date(START + DAY * 2), y: Number.MAX_VALUE },
        ],
      },
    ] as const
    const { frame } = panelFrame(data)
    expect(frame.series[0]?.cells.map((cell) => cell.value)).toEqual([0, -Number.MAX_VALUE, Number.MAX_VALUE])
    expect(frame.series[0]?.cells.every((cell) => cell.intensity === null || cell.intensity === undefined || (cell.intensity >= 0 && cell.intensity <= 1))).toBe(true)
    expect(resolveFrame(planChart('heatmap', sizeContextFromPixels(520, 300), describeShape([])), [], sizeContextFromPixels(520, 300), resolvePolicy()).series).toEqual([])
  })
})
