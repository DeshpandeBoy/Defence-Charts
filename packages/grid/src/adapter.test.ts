import { describe, expect, it } from 'vitest'

import { createLayoutSnapshot, serializeLayoutSnapshot } from '@shiftcharts/core'
import {
  normalizeGridLayout,
  normalizeLayoutSnapshot,
  RGL_VERSION,
} from './adapter.ts'

const SALES = {
  id: 'sales',
  x: 0,
  y: 0,
  w: 4,
  h: 2,
  minW: 2,
  minH: 1,
  maxW: 8,
  maxH: null,
  draggable: true,
  resizable: false,
} as const

describe('RGL core adapter', () => {
  it('pins the verified engine release at the adapter boundary', () => {
    expect(RGL_VERSION).toBe('2.2.4')
  })

  it('preserves project-owned identity, constraints, and interaction flags', () => {
    const result = normalizeGridLayout([SALES], { compact: false })

    expect(result).toEqual([SALES])
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result[0])).toBe(true)
  })

  it('does not mutate caller-owned values while RGL corrects and compacts copies', () => {
    const input = [
      { ...SALES, y: 4 },
      { id: 'margin', x: 4, y: 8, w: 4, h: 1 },
    ]
    const before = JSON.stringify(input)

    const result = normalizeGridLayout(input)

    expect(JSON.stringify(input)).toBe(before)
    expect(result.map((item) => item.y)).toEqual([0, 0])
  })

  it('compacts a legal vertical gap without changing horizontal placement', () => {
    const result = normalizeGridLayout([
      { id: 'top', x: 0, y: 0, w: 3, h: 2 },
      { id: 'bottom', x: 0, y: 6, w: 3, h: 1 },
    ])

    expect(result).toMatchObject([
      { id: 'top', x: 0, y: 0, w: 3, h: 2 },
      { id: 'bottom', x: 0, y: 2, w: 3, h: 1 },
    ])
  })

  it('resolves a collision without overlapping the earlier widget', () => {
    const result = normalizeGridLayout([
      { id: 'first', x: 0, y: 0, w: 4, h: 2 },
      { id: 'second', x: 0, y: 0, w: 4, h: 1 },
    ])
    const first = result[0]!
    const second = result[1]!

    expect(second.y).toBeGreaterThanOrEqual(first.y + first.h)
    expect(second.x).toBe(first.x)
  })

  it('supports a deliberate no-compaction snapshot without leaking RGL fields', () => {
    const result = normalizeGridLayout([{ id: 'note', x: 8, y: 5, w: 4, h: 1 }], {
      compact: false,
    })

    expect(result).toEqual([
      {
        id: 'note',
        x: 8,
        y: 5,
        w: 4,
        h: 1,
        minW: 1,
        minH: 1,
        maxW: null,
        maxH: null,
        draggable: true,
        resizable: true,
      },
    ])
    expect(result[0]).not.toHaveProperty('i')
    expect(result[0]).not.toHaveProperty('isDraggable')
  })

  it('rejects duplicate IDs at the project boundary before RGL sees them', () => {
    expect(() => normalizeGridLayout([SALES, { ...SALES }])).toThrow(/duplicate widget id sales/)
  })

  it('produces deterministic output and snapshot JSON', () => {
    const input = [
      { id: 'a', x: 0, y: 4, w: 6, h: 2 },
      { id: 'b', x: 6, y: 7, w: 6, h: 1 },
    ]
    const first = normalizeGridLayout(input)
    const second = normalizeGridLayout(input)

    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    expect(serializeLayoutSnapshot(createLayoutSnapshot(first))).toBe(
      serializeLayoutSnapshot(createLayoutSnapshot(second)),
    )
  })

  it('normalises snapshots without changing the persistence contract', () => {
    const snapshot = createLayoutSnapshot([{ id: 'kpi', x: 2, y: 5, w: 2, h: 1 }])
    const result = normalizeLayoutSnapshot(snapshot)

    expect(result.version).toBe(1)
    expect(result.columns).toBe(12)
    expect(result.items[0]).toMatchObject({ id: 'kpi', x: 2, y: 0 })
    expect(Object.isFrozen(result)).toBe(true)
  })
})
