/**
 * Gate **G10** — the plan is a pure function of size, with no memory of approach direction.
 *
 * ⚠ **This is the gate most likely to be deleted as redundant, and it is not.**
 * `research/maps/04-ci-gate-map.md` says why: *"G9 asserts each rung is correct; G10 asserts
 * the path between rungs is memoryless."* A resolver can reproduce §6 perfectly at every
 * rung and still return a different plan at 640 px depending on whether you arrived from
 * 600 or from 700 — that is hysteresis, and it is the single most natural "small fix" for
 * flicker at a boundary.
 *
 * `research/40-chart-plan.md` §9 settles hysteresis out of the resolver and into animation
 * at A6. `SizeContext` therefore has no `prevClass`, and this file is what stops one being
 * added quietly.
 *
 * ⚠ **Not a monotonicity test.** The ladder is deliberately non-monotonic — Canvas keeps a
 * `'direct'` legend at four series and externalises at five, and `narrative.summaryPhrase`
 * peaks at the *smallest* rung. Asserting monotonicity would assert the opposite of the
 * literature. What is asserted is *path independence*, which is a different and weaker
 * claim, and the correct one.
 */

import { describe, expect, it } from 'vitest'

import { sizeContextFromPixels, type SizeContext } from './context.ts'
import { planChart } from './plan-chart.ts'
import type { SizeClass } from './plan.ts'
import { MANY_SERIES, SHAPE } from './rungs/fixtures.ts'

/** 4 px steps, so every published boundary is crossed rather than jumped over. */
const STEP = 4
const MIN_WIDTH = 40
const MAX_WIDTH = 1400

/**
 * Three heights, chosen so the sweep reaches every size family.
 *
 * `sizeContextFromPixels` derives rows from `height / 100`, and `resolveSizeClass` needs
 * rows ≥ 6 for Stage, ≥ 5 for Canvas, ≥ 3 for Panel, ≥ 1 for Strip and Tile. One height
 * cannot reach all six, which is why this is a list.
 */
const HEIGHTS = [140, 340, 700] as const

function sweep(height: number, ascending: boolean): Map<number, string> {
  const widths: number[] = []
  for (let w = MIN_WIDTH; w <= MAX_WIDTH; w += STEP) widths.push(w)
  if (!ascending) widths.reverse()

  const seen = new Map<number, string>()
  for (const w of widths) {
    const ctx = sizeContextFromPixels(w, height)
    seen.set(w, JSON.stringify(planChart('line', ctx, MANY_SERIES)))
  }
  return seen
}

describe('G10 — width swept up, then down', () => {
  for (const height of HEIGHTS) {
    it(`identical in both directions at ${height} px tall`, () => {
      const up = sweep(height, true)
      const down = sweep(height, false)

      expect(down.size).toBe(up.size)
      for (const [width, plan] of up) {
        // Compared as a string rather than with `toEqual` on purpose: a difference in key
        // ORDER would survive `toEqual` and break the server/client identity that decision
        // 7 rests on, since the client compares serialised plans.
        expect(plan, `width ${width} px`).toBe(down.get(width))
      }
    })
  }

  /**
   * ⚠ A sweep that never changes its answer proves nothing about memory. This asserts the
   * sweep is actually doing work — if a refactor collapsed the ladder to one plan, every
   * assertion above would still pass and this one would not.
   */
  it('the sweep actually crosses boundaries', () => {
    const distinct = new Set(sweep(700, true).values())
    expect(distinct.size).toBeGreaterThan(3)
  })

  it('the sweeps between them reach all six families', () => {
    const families = new Set<SizeClass>()
    for (const height of HEIGHTS) {
      for (let w = MIN_WIDTH; w <= MAX_WIDTH; w += STEP) {
        families.add(sizeContextFromPixels(w, height).sizeClass)
      }
    }
    expect([...families].sort()).toEqual([
      'canvas',
      'micro',
      'panel',
      'stage',
      'strip',
      'tile',
    ])
  })
})

describe('G10 — height swept up, then down', () => {
  it('identical in both directions, including through Tile’s three mark states', () => {
    const heights: number[] = []
    for (let h = 4; h <= 900; h += 2) heights.push(h)

    const up = new Map<number, string>()
    for (const h of heights) up.set(h, JSON.stringify(planChart('line', ctxAt(400, h), SHAPE)))

    const down = new Map<number, string>()
    for (const h of [...heights].reverse()) {
      down.set(h, JSON.stringify(planChart('line', ctxAt(400, h), SHAPE)))
    }

    for (const [h, plan] of up) expect(plan, `height ${h} px`).toBe(down.get(h))
  })

  /**
   * The specific transition G10 exists for. Tile's mark changes at 24 px and 6 px of *plot*
   * height, and a hysteretic resolver would place those switches at different box heights
   * going up than coming down.
   */
  it('Tile’s mark switches at the same height in both directions', () => {
    const boundaries = (ascending: boolean): number[] => {
      const found: number[] = []
      const range: number[] = []
      for (let h = 2; h <= 200; h += 1) range.push(h)
      if (!ascending) range.reverse()

      let previous: string | null = null
      for (const h of range) {
        const kind = planChart('line', tileAt(h), SHAPE).marks.primary.kind
        if (previous !== null && kind !== previous) found.push(h)
        previous = kind
      }
      return found.sort((a, b) => a - b)
    }

    const ascending = boundaries(true)
    // Descending records the height AFTER the switch, so the ascending run's boundaries are
    // one step higher. Compare the sets after normalising that one-step offset.
    const descending = boundaries(false).map((h) => h + 1)
    expect(ascending).toEqual(descending)
    expect(ascending).toHaveLength(2)
  })
})

/** A whole `SizeContext` at a fixed 4×3 footprint, so only px vary. */
function ctxAt(width: number, height: number): SizeContext {
  return sizeContextFromPixels(width, height)
}

/** A 2×1 Tile whose box height is the only thing moving. */
function tileAt(height: number): SizeContext {
  return Object.freeze({
    width: 200,
    height,
    cols: 2,
    rows: 1,
    aspect: 'ultrawide' as const,
    sizeClass: 'tile' as const,
  })
}

describe('G10 — the resolver has no state at all', () => {
  /**
   * ⚠ A Strip, not a Canvas, and the choice is load-bearing. Canvas already sets
   * `crosshair`, `legendToggle` and `points` on — so a resolver leaking state *toward* the
   * richer plan changes nothing observable there, and this test would pass while the sweep
   * above failed. A rung with most switches off is the one where a leak shows.
   */
  const REPEATED = sizeContextFromPixels(420, 140)

  it('a repeated call agrees with itself no matter what ran between', () => {
    const first = JSON.stringify(planChart('line', REPEATED, MANY_SERIES))
    expect(JSON.parse(first).sizeClass).toBe('strip')

    // Interleave unrelated calls between repeats. A memoised resolver keyed on the wrong
    // thing, or one carrying a previous size class, breaks here and nowhere else.
    for (let i = 0; i < 200; i += 1) {
      planChart('line', sizeContextFromPixels(100 + i * 7, 100 + i * 3), SHAPE)
      expect(JSON.stringify(planChart('line', REPEATED, MANY_SERIES))).toBe(first)
    }
  })

  it('does not mutate its inputs', () => {
    const ctx = sizeContextFromPixels(640, 480)
    const before = JSON.stringify({ ctx, shape: MANY_SERIES })
    planChart('line', ctx, MANY_SERIES, { substitute: false }, { legend: { placement: 'absent' } })
    expect(JSON.stringify({ ctx, shape: MANY_SERIES })).toBe(before)
  })
})
