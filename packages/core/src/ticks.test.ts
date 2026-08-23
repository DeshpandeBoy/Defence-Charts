import { describe, expect, it } from 'vitest'

import { DEFAULT_POLICY } from './policy.ts'
import { tickCountForWidth } from './ticks.ts'

describe('tickCountForWidth', () => {
  it.each([
    [100, 2],
    [200, 2],
    [250, 3],
    [300, 3],
    [1000, 10],
    [4000, 40],
  ])('%i px → %i ticks', (width, expected) => {
    expect(tickCountForWidth(width)).toBe(expected)
  })

  it('never returns fewer than two', () => {
    // Talbot 2010's floor. One tick is not an axis; it is a label with no scale.
    for (const width of [1, 10, 49, 50, 99]) {
      expect(tickCountForWidth(width)).toBe(2)
    }
  })

  it('has no upper cap', () => {
    // ⚠ The absent cap is the specified behaviour, not an oversight
    // (`research/10-responsive-ladder.md` §6). The ladder densifies continuously rather
    // than snapping between breakpoints, and a cap would reintroduce the breakpoint by the
    // back door — the widest charts would all get the same axis, which is what "responsive"
    // was supposed to stop doing.
    expect(tickCountForWidth(100_000)).toBe(1000)
  })

  it('is monotone non-decreasing in width', () => {
    let previous = tickCountForWidth(1)
    for (let width = 2; width <= 3000; width += 1) {
      const here = tickCountForWidth(width)
      expect(here, `width ${width}`).toBeGreaterThanOrEqual(previous)
      previous = here
    }
  })

  it.each([
    [0],
    [-1],
    [Number.NaN],
    [Number.POSITIVE_INFINITY],
  ])('returns the floor of 2 for a degenerate width of %p', (width) => {
    // Same `ResizeObserver` argument as `resolveSizeClass`: a transient 0 is normal, and a
    // throw inside the callback takes the widget down.
    expect(tickCountForWidth(width)).toBe(2)
  })

  it('agrees with the policy constants it currently hardcodes', () => {
    // ⚠ This is a **failing-later** test on purpose. `tickCountForWidth` predates
    // `planChart()` and bakes in `tickTargetSpacing` and `ticksMin` as literals. A3 must
    // route them through `PlanPolicy` instead — until then, a consumer who moves
    // `tickTargetSpacing` finds it silently ignored on the one axis that uses it. This
    // asserts the two are still in sync so the drift cannot happen unnoticed in the
    // meantime.
    expect(tickCountForWidth(DEFAULT_POLICY.tickTargetSpacing * 7)).toBe(7)
    expect(tickCountForWidth(1)).toBe(DEFAULT_POLICY.ticksMin)
  })
})
