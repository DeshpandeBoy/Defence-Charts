/**
 * The resolver's two inputs: what the container is, and what the data looks like.
 *
 * `research/20-architecture.md` §3.1.
 */

import type { SizeClass } from './plan.ts'

/**
 * What the container is.
 *
 * ⚠ Carries **both** grid units and raw pixels, and both are load-bearing.
 * `research/40-chart-plan.md` §6 Tile: the mark at that rung has three possible states
 * (`line`, 1-band `horizon`, `none`) chosen by *measured plot height*, not by size class —
 * *"which is why `sizeClass` alone is not sufficient input to the resolver, and why
 * `SizeContext` carries raw px."*
 *
 * ⚠ There is no `prevClass`, and there will not be one (`research/40-chart-plan.md` §9).
 * Hysteresis is handled by animation at A6, not by memory in the resolver: a resolver that
 * remembers is a resolver whose output depends on the direction you approached from, which
 * gate **G10** exists to catch.
 */
export type SizeContext = {
  /** px, content box. */
  readonly width: number
  /** px, content box. */
  readonly height: number
  /** Grid units, 1..12. */
  readonly cols: number
  /** Grid units. */
  readonly rows: number
  readonly aspect: 'portrait' | 'square' | 'landscape' | 'ultrawide'
  readonly sizeClass: SizeClass
}

/**
 * What the data looks like — **not the data itself**. The resolver never sees values.
 *
 * Deliberate (`research/20-architecture.md` §3.1): it keeps the resolver cheap, keeps it
 * pure, and means a plan can be computed server-side from metadata alone.
 */
export type DataShape = {
  readonly series: number
  readonly categories: number
  readonly points: number
  readonly hasNegative: boolean
  readonly labelMaxChars: number
  readonly temporal: boolean
}

// --- Size classification -------------------------------------------------------------

/**
 * The documented cell ranges (`research/10-responsive-ladder.md` §3), expressed as the
 * MINIMUM each family requires. Descending, so the first match wins.
 *
 * | Family | Cells (w × h) |
 * |--------|---------------|
 * | Micro  | 1×1           |
 * | Tile   | 2×1 – 2×2     |
 * | Strip  | 3×1 – 4×2     |
 * | Panel  | 3×3 – 6×4     |
 * | Canvas | 6×5 – 8×6     |
 * | Stage  | 9×6 – 12×8+   |
 *
 * ⚠ Stated as minima rather than as ranges on purpose. The published table is written for
 * landscape-ish widgets and leaves two quadrants unaddressed — very wide and short
 * (12×3), very narrow and tall (1×8) — which a range-matching implementation would either
 * fail to classify or classify absurdly. Minima are total, monotone in both dimensions,
 * and reproduce every documented anchor exactly. The tests in `./context.test.ts` assert
 * both halves of that claim.
 */
const FAMILY_MINIMA = [
  { sizeClass: 'stage', cols: 9, rows: 6 },
  { sizeClass: 'canvas', cols: 6, rows: 5 },
  { sizeClass: 'panel', cols: 3, rows: 3 },
  { sizeClass: 'strip', cols: 3, rows: 1 },
  { sizeClass: 'tile', cols: 2, rows: 1 },
] as const satisfies readonly { sizeClass: SizeClass; cols: number; rows: number }[]

/**
 * Grid footprint → size family.
 *
 * The families are named after the **information budget**, not the pixels, but they are
 * not arbitrary — each boundary is anchored to a published plot-height result
 * (`research/10-responsive-ladder.md` §3):
 *
 * | Plot height | Finding                                                          | Boundary        |
 * |-------------|------------------------------------------------------------------|-----------------|
 * | 6 px        | 2-band horizon still readable (Heer 2009)                         | absolute floor  |
 * | 24 px       | optimal for line; below this **change encoding** (Heer 2009)       | Tile → Strip    |
 * | 40 px       | below this, value-estimation error rises, p < 0.001 (H&B 2010)    | Strip → Panel   |
 * | 80 px       | little benefit beyond (Heer & Bostock 2010)                       | Panel → Canvas  |
 *
 * That last row is the empirical justification for the entire library: past 80 px, extra
 * space buys **content**, not plot.
 *
 * ⚠ The classification input is **cells, not pixels**, and that is the specified design —
 * §3 says the ranges *"assume a roughly square nominal cell"*, and the px numbers above
 * explain where the cell boundaries fall rather than replacing them. Plot height in px
 * refines decisions *within* a rung (see `SizeContext`), it does not choose the rung.
 *
 * A chart rendered outside a grid gets a virtual footprint from
 * `sizeContextFromPixels()`. Its nominal cell size is an explicit Tier C policy rather
 * than a second, hidden size ladder.
 *
 * Pure: no measurement, no state, no clock.
 *
 * @param cols Grid units wide, 1..12.
 * @param rows Grid units tall.
 */
export function resolveSizeClass(cols: number, rows: number): SizeClass {
  // ⚠ Non-finite and sub-1 footprints collapse to the smallest family rather than
  // throwing. A resolver that throws inside a `ResizeObserver` callback takes the whole
  // widget down for a transient measurement of 0, which every browser delivers at least
  // once — on `display: none`, during a print layout, and on the first frame of a
  // detached element.
  const c = Number.isFinite(cols) ? Math.floor(cols) : 0
  const r = Number.isFinite(rows) ? Math.floor(rows) : 0

  for (const family of FAMILY_MINIMA) {
    if (c >= family.cols && r >= family.rows) return family.sizeClass
  }
  return 'micro'
}

/**
 * Nominal square cell used by standalone charts. **C** — ours and unsourced.
 *
 * Exported so `<AutoChart>` can expose the default and a consumer can replace it without
 * recreating the conversion. Grid-owned charts never use this value; their real `w`/`h`
 * footprint remains authoritative.
 */
export const DEFAULT_NOMINAL_CELL_SIZE = 100

/**
 * Measured pixels → complete standalone `SizeContext`.
 *
 * The virtual grid is capped at twelve columns to preserve the dashboard model. Rows are
 * intentionally unbounded: `resolveSizeClass()` already saturates at Stage, while raw
 * height remains available for within-rung planning.
 */
export function sizeContextFromPixels(
  width: number,
  height: number,
  nominalCellSize = DEFAULT_NOMINAL_CELL_SIZE,
): SizeContext {
  const measurable =
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    Number.isFinite(nominalCellSize) &&
    width > 0 &&
    height > 0 &&
    nominalCellSize > 0

  const cols = measurable ? Math.min(12, Math.floor(width / nominalCellSize)) : 0
  const rows = measurable ? Math.floor(height / nominalCellSize) : 0

  return Object.freeze({
    width,
    height,
    cols,
    rows,
    aspect: resolveAspect(width, height),
    sizeClass: resolveSizeClass(cols, rows),
  })
}

/**
 * Width ÷ height → the independent aspect axis.
 *
 * `research/10-responsive-ladder.md` §3: *"Aspect matters independently. A 6×2 is `Strip`
 * even though it has 12 cells; a 2×6 is a portrait oddity that should mostly
 * `axis-transpose`."*
 *
 * ⚠ Tier **C** — the four names are ours and the three cut points are ours. No published
 * source gives aspect bands for widgets. They are here because `marks.facet.columns` and
 * the transpose decision both need an aspect input, and a named band is easier to argue
 * with later than a bare ratio scattered through the resolver.
 */
export function resolveAspect(width: number, height: number): SizeContext['aspect'] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'square'
  }
  const ratio = width / height
  if (ratio >= 3) return 'ultrawide'
  if (ratio >= 1.2) return 'landscape'
  if (ratio <= 0.8) return 'portrait'
  return 'square'
}
