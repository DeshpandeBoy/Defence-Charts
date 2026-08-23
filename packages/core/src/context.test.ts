import { describe, expect, it } from 'vitest'

import { resolveAspect, resolveSizeClass } from './context.ts'
import type { SizeClass } from './plan.ts'

/**
 * The published anchors from `research/10-responsive-ladder.md` §3, every one of them.
 *
 * ⚠ These are the *whole* point of the file. `resolveSizeClass` is implemented as
 * descending minima rather than as the ranges the table is written in, because the table
 * leaves two quadrants unaddressed. A restructuring like that is only legitimate if it
 * reproduces every documented case exactly — so every documented case is asserted, rather
 * than a representative sample.
 */
const PUBLISHED_ANCHORS: readonly (readonly [cols: number, rows: number, expected: SizeClass])[] = [
  [1, 1, 'micro'],
  [2, 1, 'tile'],
  [2, 2, 'tile'],
  [3, 1, 'strip'],
  [4, 2, 'strip'],
  [3, 3, 'panel'],
  [6, 4, 'panel'],
  [6, 5, 'canvas'],
  [8, 6, 'canvas'],
  [9, 6, 'stage'],
  [12, 8, 'stage'],
]

/** Small → large. Used to state monotonicity as an inequality rather than by cases. */
const RANK: Readonly<Record<SizeClass, number>> = {
  micro: 0,
  tile: 1,
  strip: 2,
  panel: 3,
  canvas: 4,
  stage: 5,
}

describe('resolveSizeClass', () => {
  it.each(PUBLISHED_ANCHORS)('%i×%i → %s', (cols, rows, expected) => {
    expect(resolveSizeClass(cols, rows)).toBe(expected)
  })

  it('classifies a 6×2 as strip, not canvas — aspect beats cell count', () => {
    // `research/10-responsive-ladder.md` §3, stated explicitly: *"a 6×2 is Strip even
    // though it has 12 cells"*. A naive area-based classifier gets this wrong, and gets it
    // wrong in the direction that puts a full axis into two rows of pixels.
    expect(resolveSizeClass(6, 2)).toBe('strip')
  })

  it('classifies a 2×6 portrait oddity as tile', () => {
    // §3 calls this *"a portrait oddity that should mostly axis-transpose"*. The rung is
    // the modest one; the transpose is `labels.axisLabelDegrade`'s job, not this
    // function's.
    expect(resolveSizeClass(2, 6)).toBe('tile')
  })

  describe('the two quadrants the published table does not address', () => {
    // ⚠ Neither of these appears in §3. They are the reason the implementation is minima
    // rather than ranges: a range-matching classifier either fails to classify them or
    // classifies them absurdly, and both failures happen at runtime in a consumer's
    // dashboard rather than here.

    it('classifies a very wide and short 12×3 as panel', () => {
      // Not canvas: canvas assumes 5 rows, and the Panel→Canvas boundary is a *plot
      // height* result (80 px, Heer & Bostock 2010). Extra columns do not buy plot height.
      expect(resolveSizeClass(12, 3)).toBe('panel')
    })

    it('classifies a very narrow and tall 1×8 as micro', () => {
      // A single column cannot carry an axis at any height.
      expect(resolveSizeClass(1, 8)).toBe('micro')
    })
  })

  describe('monotonicity — gate G10 in miniature', () => {
    // ⚠ A resolver whose output can go *down* a rung as the widget gets *bigger* produces
    // a chart that flickers between encodings while a user drags a resize handle. Asserted
    // exhaustively over the grid rather than spot-checked, because the failure is a single
    // mis-ordered entry in `FAMILY_MINIMA` and a sample would miss it.

    it('never decreases as columns increase', () => {
      for (let rows = 1; rows <= 12; rows += 1) {
        for (let cols = 1; cols < 12; cols += 1) {
          const here = RANK[resolveSizeClass(cols, rows)]
          const wider = RANK[resolveSizeClass(cols + 1, rows)]
          expect(wider, `${cols}×${rows} → ${cols + 1}×${rows}`).toBeGreaterThanOrEqual(here)
        }
      }
    })

    it('never decreases as rows increase', () => {
      for (let cols = 1; cols <= 12; cols += 1) {
        for (let rows = 1; rows < 12; rows += 1) {
          const here = RANK[resolveSizeClass(cols, rows)]
          const taller = RANK[resolveSizeClass(cols, rows + 1)]
          expect(taller, `${cols}×${rows} → ${cols}×${rows + 1}`).toBeGreaterThanOrEqual(here)
        }
      }
    })
  })

  describe('degenerate footprints collapse rather than throw', () => {
    // ⚠ Every browser delivers a transient 0×0 at least once — on `display: none`, during
    // a print layout, and on the first frame of a detached element. A resolver that throws
    // inside a `ResizeObserver` callback takes the whole widget down for it.

    it.each([
      [0, 0],
      [-1, -1],
      [Number.NaN, 4],
      [4, Number.NaN],
      [Number.POSITIVE_INFINITY, Number.NaN],
    ])('%p×%p → micro', (cols, rows) => {
      expect(resolveSizeClass(cols, rows)).toBe('micro')
    })

    it('floors fractional footprints rather than rounding up into a rung', () => {
      // 2.9 columns is two whole columns of usable space. Rounding to 3 would promote a
      // widget to `strip` on the strength of a column it does not have.
      expect(resolveSizeClass(2.9, 1)).toBe('tile')
      expect(resolveSizeClass(3, 1)).toBe('strip')
    })

    it('treats an infinite footprint as degenerate, not as the largest rung', () => {
      // ⚠ Deliberate, and the less obvious choice. `Infinity >= 9` is true, so a naive
      // implementation returns `stage` — a plan with per-point hover and annotations, for
      // a box whose size is not a number. `Number.isFinite` runs first precisely so that
      // an unmeasurable container gets the *cheapest* rung rather than the richest one.
      expect(resolveSizeClass(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)).toBe('micro')
    })
  })

  it('is pure — same input, same output, no accumulated state', () => {
    // ⚠ There is no `prevClass` and there will not be one
    // (`research/40-chart-plan.md` §9). Hysteresis is animation's job at A6. This asserts
    // the absence observably: walking up the ladder and back down must retrace exactly.
    const up = Array.from({ length: 12 }, (_, i) => resolveSizeClass(i + 1, i + 1))
    const down = Array.from({ length: 12 }, (_, i) => resolveSizeClass(12 - i, 12 - i))
    expect(down).toStrictEqual([...up].reverse())
  })
})

describe('resolveAspect', () => {
  // ⚠ Tier C throughout — the four names and all three cut points are ours. These tests
  // pin behaviour so a change is visible in a diff; they do not claim the numbers are
  // right. See the docblock on `resolveAspect`.

  it.each([
    [300, 100, 'ultrawide'], // exactly 3.0 — the boundary belongs to the wider band
    [400, 100, 'ultrawide'],
    [299, 100, 'landscape'],
    [120, 100, 'landscape'], // exactly 1.2
    [119, 100, 'square'],
    [100, 100, 'square'],
    [81, 100, 'square'],
    [80, 100, 'portrait'], // exactly 0.8
    [50, 100, 'portrait'],
  ] as const)('%i×%i → %s', (width, height, expected) => {
    expect(resolveAspect(width, height)).toBe(expected)
  })

  it.each([
    [0, 100],
    [100, 0],
    [-100, 100],
    [Number.NaN, 100],
    [100, Number.POSITIVE_INFINITY],
  ])('falls back to square for a degenerate %p×%p box', (width, height) => {
    // ⚠ `square` rather than a throw, for the same `ResizeObserver` reason as above — and
    // `square` specifically because it is the band that triggers no special handling.
    // Falling back to `ultrawide` would make a 0-height widget try to facet.
    expect(resolveAspect(width, height)).toBe('square')
  })
})
