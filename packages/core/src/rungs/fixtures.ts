/**
 * Shared fixtures and structural helpers for the A3 gates.
 *
 * ⚠ Not a test file and not part of the published surface — nothing in `./../index.ts`
 * imports it, so it is typechecked but never built. It exists because G9, G10 and G12 all
 * need the same six size contexts, and three copies of them would drift.
 *
 * ⚠ **Every context here is stated as a whole `SizeContext`, not derived from pixels.** A
 * grid-owned chart's `cols`/`rows` come from its layout footprint and its px come from the
 * `ResizeObserver`; the two are independent, which is the situation `sizeContextFromPixels()`
 * *simulates* for standalone charts rather than the situation itself. Tile's short-box cases
 * below are unreachable through that helper — a 200×40 box classifies as Micro because
 * `rows = floor(40 / 100)` is zero — yet a 2×1 widget in a dense grid with a small row
 * height is exactly 200×40. Deriving the fixtures would have quietly deleted the three-state
 * Tile case, which is the one thing in §6 that motivated `SizeContext` carrying raw px.
 */

import type { DataShape, SizeContext } from './../context.ts'
import { resolveAspect } from './../context.ts'

/**
 * The canonical data shape: a small multi-series time series with short labels.
 *
 * `labelMaxChars: 5` is deliberate and load-bearing — `"Jan 1"`, `"2024"`, `"Q3 24"` are the
 * labels a temporal line chart actually carries, and §6 hand-authors `axisLabelDegrade:
 * 'none'` and `maxChars: null` at every rung. A longer fixture would degrade and stop
 * reproducing §6, which would make every snapshot in this directory a test of the label
 * budget rather than of the ladder. `degrade.test.ts` exercises the long-label path on
 * purpose, where it is the subject rather than a confound.
 */
export const SHAPE: DataShape = Object.freeze({
  series: 3,
  categories: 12,
  points: 120,
  hasNegative: false,
  labelMaxChars: 5,
  yLabelMaxChars: 3,
  temporal: true,
})

/** Past the default direct-label threshold, so Canvas externalises its legend and Stage facets. */
export const MANY_SERIES: DataShape = Object.freeze({ ...SHAPE, series: 6 })

/** One series — the shape for which Stage's optional secondary axis is indefensible. */
export const ONE_SERIES: DataShape = Object.freeze({ ...SHAPE, series: 1 })

/** A whole `SizeContext`, with `aspect` derived so the fixtures cannot disagree with it. */
export function ctxOf(
  width: number,
  height: number,
  cols: number,
  rows: number,
  sizeClass: SizeContext['sizeClass'],
): SizeContext {
  return Object.freeze({
    width,
    height,
    cols,
    rows,
    aspect: resolveAspect(width, height),
    sizeClass,
  })
}

/** 1×1. */
export const MICRO = ctxOf(100, 100, 1, 1, 'micro')
/** 2×2, tall enough that the plot clears `plotHeightOptimal`. */
export const TILE = ctxOf(200, 200, 2, 2, 'tile')
/** 2×1 in a dense grid: plot height lands between 6 and 24 px. Horizon territory. */
export const TILE_SHORT = ctxOf(200, 40, 2, 1, 'tile')
/** 2×1, flatter still: plot height below `horizonMinHeight`. No mark at all. */
export const TILE_FLAT = ctxOf(200, 10, 2, 1, 'tile')
/** 4×2. */
export const STRIP = ctxOf(400, 200, 4, 2, 'strip')
/** 5×3. Plot width lands at 394 px → `round(394 / 100)` = 4 x ticks, as §6 authors. */
export const PANEL = ctxOf(500, 300, 5, 3, 'panel')
/** 7×5. */
export const CANVAS = ctxOf(700, 500, 7, 5, 'canvas')
/** 10×7. */
export const STAGE = ctxOf(1000, 700, 10, 7, 'stage')

/** The six rungs, one representative context each. */
export const SIX: readonly (readonly [name: string, ctx: SizeContext, shape: DataShape])[] =
  Object.freeze([
    ['micro', MICRO, SHAPE],
    ['tile', TILE, SHAPE],
    ['strip', STRIP, SHAPE],
    ['panel', PANEL, SHAPE],
    ['canvas', CANVAS, MANY_SERIES],
    ['stage', STAGE, MANY_SERIES],
  ] as const)

// --- Structural walk -------------------------------------------------------------------

/**
 * How a value behaves under `applyOverrides()`, which is the only distinction the gates
 * need: objects merge key by key, arrays and everything else replace whole.
 *
 * ⚠ `null` is a **leaf**, not a fourth kind, and getting that wrong makes the divergence
 * walk cry wolf. `labels.maxChars` is `null` at some rungs and a number at others — both
 * replace, so nothing structural differs. Where `null` *does* matter is `axes.y2`, which is
 * a leaf at five rungs and an object at Stage: leaf-versus-object is a real divergence and
 * this classification catches it while ignoring the harmless one.
 */
export type NodeKind = 'object' | 'array' | 'leaf'

export type NodeShape = {
  readonly kind: NodeKind
  /** Direct child keys, sorted and joined. Empty for anything but an object. */
  readonly keys: string
}

function kindOf(value: unknown): NodeKind {
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object' && value !== null) return 'object'
  return 'leaf'
}

/** Every dotted path in `value`, mapped to its shape. The root itself is not included. */
export function describeNodes(value: unknown): Map<string, NodeShape> {
  const out = new Map<string, NodeShape>()
  const visit = (node: unknown, path: string): void => {
    const kind = kindOf(node)
    const keys =
      kind === 'object' ? Object.keys(node as Record<string, unknown>).sort().join(',') : ''
    if (path !== '') out.set(path, { kind, keys })
    if (kind === 'object') {
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
        visit(child, path === '' ? key : `${path}.${key}`)
      }
    }
  }
  visit(value, '')
  return out
}

/**
 * Paths whose *shape* differs between two of the given plans.
 *
 * §1.1 forbids optional fields, so a key set that varies across rungs is a discriminated
 * union by definition — there is no other way for one plan to have a key another lacks. That
 * is what makes this walk a union detector rather than a heuristic: it does not guess from
 * key names, it derives from the constraint.
 *
 * ⚠ Only unions that two rungs actually exercise are visible here. A union every rung
 * happens to instantiate the same way looks like a plain object, and this returns nothing
 * for it. `overrides.ts` says which one that is today.
 */
export function divergentPaths(plans: readonly unknown[]): readonly string[] {
  const first = new Map<string, NodeShape>()
  const divergent = new Set<string>()
  for (const plan of plans) {
    for (const [path, node] of describeNodes(plan)) {
      const seen = first.get(path)
      if (seen === undefined) {
        first.set(path, node)
        continue
      }
      if (seen.kind !== node.kind || seen.keys !== node.keys) divergent.add(path)
    }
  }
  return Object.freeze([...divergent].sort())
}

/** `true` if `path`, or any ancestor of it, is in `declared`. */
export function coveredBy(path: string, declared: ReadonlySet<string>): boolean {
  const parts = path.split('.')
  for (let i = parts.length; i > 0; i -= 1) {
    if (declared.has(parts.slice(0, i).join('.'))) return true
  }
  return false
}
