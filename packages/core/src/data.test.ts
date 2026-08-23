/**
 * `describeShape()` — real data reduced to the counts the resolver accepts.
 *
 * ⚠ The test that matters most here is the `temporal` one. A mixed number/Date series
 * answering `true` would build a time scale over numbers, and d3 does that without complaint
 * — producing an axis labelled with instants near the Unix epoch. That is *"a chart that
 * renders, looks plausible, and is wrong"*, which is the failure species this repo keeps
 * naming and the reason the field is conservative.
 */

import { describe, expect, it } from 'vitest'

import { describeShape, type Series } from './data.ts'

const JAN = new Date(Date.UTC(2024, 0, 1))
const FEB = new Date(Date.UTC(2024, 1, 1))
const MAR = new Date(Date.UTC(2024, 2, 1))

describe('describeShape', () => {
  it('counts series, distinct x positions, and total points', () => {
    const data: Series[] = [
      { id: 'a', points: [{ x: JAN, y: 1 }, { x: FEB, y: 2 }, { x: MAR, y: 3 }] },
      { id: 'b', points: [{ x: JAN, y: 4 }, { x: FEB, y: 5 }, { x: MAR, y: 6 }] },
    ]
    const shape = describeShape(data)
    expect(shape.series).toBe(2)
    // Distinct x positions — the number of slots an axis has to label, not points per series.
    expect(shape.categories).toBe(3)
    expect(shape.points).toBe(6)
  })

  /**
   * ⚠ **`points` is the total across series, not the longest series.** It is compared against
   * `policy.pointBudget`, which guards *rendering* cost, and the renderer draws every point of
   * every series. Reading it per-series would let six series of 4,000 points each pass a 5,000
   * budget as SVG.
   */
  it('totals points across series rather than reporting the longest', () => {
    const many: Series[] = Array.from({ length: 6 }, (_, i) => ({
      id: `s${String(i)}`,
      points: Array.from({ length: 1000 }, (_, j) => ({ x: j, y: j })),
    }))
    expect(describeShape(many).points).toBe(6000)
    expect(describeShape(many).categories).toBe(1000)
  })

  it('reports a negative anywhere', () => {
    expect(describeShape([{ id: 'a', points: [{ x: 0, y: 1 }] }]).hasNegative).toBe(false)
    expect(describeShape([{ id: 'a', points: [{ x: 0, y: -1 }] }]).hasNegative).toBe(true)
  })

  it('does not read a null as a negative', () => {
    expect(describeShape([{ id: 'a', points: [{ x: 0, y: null }] }]).hasNegative).toBe(false)
  })

  describe('temporal', () => {
    it('is true when every x is a Date', () => {
      expect(describeShape([{ id: 'a', points: [{ x: JAN, y: 1 }] }]).temporal).toBe(true)
    })

    it('is false when any x is a number', () => {
      const mixed: Series[] = [{ id: 'a', points: [{ x: JAN, y: 1 }, { x: 2, y: 2 }] }]
      expect(describeShape(mixed).temporal).toBe(false)
    })

    it('is false across series, not only within one', () => {
      const mixed: Series[] = [
        { id: 'a', points: [{ x: JAN, y: 1 }] },
        { id: 'b', points: [{ x: 7, y: 2 }] },
      ]
      expect(describeShape(mixed).temporal).toBe(false)
    })

    it('is false for no data at all', () => {
      expect(describeShape([]).temporal).toBe(false)
    })
  })

  /**
   * ⚠ Measured through the same `formatXLabel()` the renderer uses, so the resolver degrades
   * against the width of a label that will actually be drawn. `./layout.ts` still expands the
   * count back into `M`s — `DataShape` carries no strings — but the count it expands is now
   * the true length of the true label rather than of some upstream field.
   */
  it('measures labels as they will be formatted, not as they were supplied', () => {
    // `Date.UTC(2024, 0, 1)` formats as `'2024'` (4), `Date.UTC(2024, 1, 15)` as `'Feb 15'` (6).
    const data: Series[] = [
      { id: 'a', points: [{ x: JAN, y: 1 }, { x: new Date(Date.UTC(2024, 1, 15)), y: 2 }] },
    ]
    expect(describeShape(data).labelMaxChars).toBe(6)
  })

  it('is empty and well-formed for no series', () => {
    expect(describeShape([])).toEqual({
      series: 0,
      categories: 0,
      points: 0,
      hasNegative: false,
      labelMaxChars: 0,
      temporal: false,
    })
  })

  it('is frozen, like every other plan-shaped value in this package', () => {
    expect(Object.isFrozen(describeShape([]))).toBe(true)
  })

  it('is pure — the same data twice gives the same shape', () => {
    const data: Series[] = [{ id: 'a', points: [{ x: JAN, y: 1 }, { x: FEB, y: null }] }]
    expect(describeShape(data)).toEqual(describeShape(data))
  })
})
