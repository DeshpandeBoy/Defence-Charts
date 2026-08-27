import {
  describeShape,
  planChart,
  resolveFrame,
  sizeContextFromPixels,
  type Series,
} from '@shiftcharts/core'
import { describe, expect, it } from 'vitest'

import {
  nearestIndexedPoint,
  prepareInteractionIndex,
} from './interaction-index.ts'

const DAY = 86_400_000
const START = Date.UTC(2024, 0, 1)

function frameFor(data: readonly Series[]) {
  const ctx = sizeContextFromPixels(520, 320)
  return resolveFrame(planChart('line', ctx, describeShape(data)), data, ctx)
}

describe('prepareInteractionIndex', () => {
  it('pairs rendered points with stable source indexes and normalized domain lookup', () => {
    const data: readonly Series[] = [
      {
        id: 'alpha',
        points: [
          { x: new Date(START), y: 10 },
          { x: new Date(START + DAY), y: null },
          { x: new Date(START + 2 * DAY), y: Number.NaN },
          { x: Number.NaN, y: 20 },
          { x: new Date(START + 3 * DAY), y: 30 },
        ],
      },
      {
        id: 'beta',
        points: [
          { x: new Date(START), y: 4 },
          { x: new Date(START + DAY), y: 6 },
          { x: new Date(START + 2 * DAY), y: 8 },
          { x: new Date(START + 3 * DAY), y: 12 },
        ],
      },
    ]
    const frame = frameFor(data)
    const index = prepareInteractionIndex(frame, data)
    const alpha = index.byId.get('alpha')

    expect(index.frame).toBe(frame)
    expect(index.dataById.get('alpha')).toBe(data[0])
    expect(alpha?.source).toBe(data[0])
    expect(alpha?.frame).toBe(frame.series[0])
    expect(alpha?.points.map((point) => point.pointIndex)).toEqual([0, 4])
    expect(alpha?.points.map((point) => point.domainX)).toEqual([START, START + 3 * DAY])
    expect(alpha?.byPointIndex.get(4)?.sourcePoint.y).toBe(30)
    expect(alpha?.byPointIndex.get(1)).toBeUndefined()
    expect(alpha?.byDomainX.get(START + 3 * DAY)?.[0]?.pointIndex).toBe(4)
    expect(index.byDomainX.get(START + 3 * DAY)?.map((point) => point.seriesId)).toEqual([
      'alpha',
      'beta',
    ])
  })

  it('sorts pixel-x points without changing source identity', () => {
    const data: readonly Series[] = [
      {
        id: 'alpha',
        points: [
          { x: 300, y: 3 },
          { x: 100, y: 1 },
          { x: 200, y: 2 },
        ],
      },
    ]
    const index = prepareInteractionIndex(frameFor(data), data)
    const alpha = index.byId.get('alpha')

    expect(alpha?.points.map((point) => point.pointIndex)).toEqual([0, 1, 2])
    expect(alpha?.sortedByX.map((point) => point.domainX)).toEqual([100, 200, 300])
    expect(alpha?.sortedByX.map((point) => point.pointIndex)).toEqual([1, 2, 0])
  })
})

describe('nearestIndexedPoint', () => {
  it('uses logarithmic nearest-x candidates for line-like interaction', () => {
    const data: readonly Series[] = [
      {
        id: 'alpha',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 100 },
          { x: 2, y: 0 },
        ],
      },
    ]
    const index = prepareInteractionIndex(frameFor(data), data)
    const alpha = index.byId.get('alpha')
    const first = alpha?.byPointIndex.get(0)
    const middle = alpha?.byPointIndex.get(1)
    if (first === undefined || middle === undefined) throw new Error('indexed fixture point missing')

    const nearestX = nearestIndexedPoint(index, first.x, middle.y, 'x')
    const nearestXY = nearestIndexedPoint(index, first.x, middle.y, 'xy')

    expect(nearestX?.pointIndex).toBe(0)
    expect(nearestXY?.pointIndex).toBe(1)
  })

  it('keeps scatter fallback exhaustive and handles invalid coordinates deterministically', () => {
    const data: readonly Series[] = [
      {
        id: 'alpha',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 5 },
        ],
      },
    ]
    const index = prepareInteractionIndex(frameFor(data), data)

    expect(nearestIndexedPoint(index, Number.NaN, 0, 'x')).toBeNull()
    expect(nearestIndexedPoint(index, 0, Number.NaN, 'xy')).toBeNull()
    expect(nearestIndexedPoint(index, 0, 0, 'x')?.pointIndex).toBe(0)
  })

  it('returns null for an empty prepared index', () => {
    const data: readonly Series[] = []
    const index = prepareInteractionIndex(frameFor(data), data)

    expect(index.points).toHaveLength(0)
    expect(nearestIndexedPoint(index, 10, 10, 'x')).toBeNull()
    expect(nearestIndexedPoint(index, 10, 10, 'xy')).toBeNull()
  })
})
