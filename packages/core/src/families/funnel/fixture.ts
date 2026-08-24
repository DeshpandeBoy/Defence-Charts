import type { Series } from '../../data.ts'

/**
 * Deterministic ordered-stage input for the funnel planner tests.
 *
 * The x values are intentionally numeric because the current Series contract uses x as the
 * canonical stage label. The frame/renderer seam may later accept a dedicated stage label field;
 * this fixture does not pretend that one exists today.
 */
const FUNNEL_SERIES: readonly Series[] = Object.freeze([
  Object.freeze({
    id: 'delivery-pipeline',
    label: 'Delivery pipeline',
    points: Object.freeze([
      Object.freeze({ x: 0, y: 1000 }),
      Object.freeze({ x: 1, y: 620 }),
      Object.freeze({ x: 2, y: 260 }),
      Object.freeze({ x: 3, y: 130 }),
      Object.freeze({ x: 4, y: 52 }),
    ]),
  }),
])

export const FUNNEL_FAMILY_FIXTURE = Object.freeze({
  type: 'funnel' as const,
  series: FUNNEL_SERIES,
  values: Object.freeze([1000, 620, 260, 130, 52]),
})

/** Value-aware cases the coordinator-owned frame must keep explicit. */
export const FUNNEL_VALUE_CASES = Object.freeze({
  empty: Object.freeze([]) as readonly Series[],
  nullStage: Object.freeze([
    Object.freeze({ id: 'null-stage', points: Object.freeze([{ x: 0, y: 100 }, { x: 1, y: null }]) }),
  ]) as readonly Series[],
  zeroBaseline: Object.freeze([
    Object.freeze({ id: 'zero-baseline', points: Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 10 }]) }),
  ]) as readonly Series[],
  unsorted: Object.freeze([
    Object.freeze({ id: 'unsorted', points: Object.freeze([{ x: 2, y: 10 }, { x: 0, y: 20 }, { x: 1, y: 15 }]) }),
  ]) as readonly Series[],
  duplicateStage: Object.freeze([
    Object.freeze({ id: 'duplicate-stage', points: Object.freeze([{ x: 0, y: 20 }, { x: 0, y: 10 }]) }),
  ]) as readonly Series[],
  negative: Object.freeze([
    Object.freeze({ id: 'negative', points: Object.freeze([{ x: 0, y: 20 }, { x: 1, y: -1 }]) }),
  ]) as readonly Series[],
  singleStage: Object.freeze([
    Object.freeze({ id: 'single-stage', points: Object.freeze([{ x: 0, y: 20 }]) }),
  ]) as readonly Series[],
  extreme: Object.freeze([
    Object.freeze({ id: 'extreme', points: Object.freeze([{ x: 0, y: Number.MAX_VALUE }]) }),
  ]) as readonly Series[],
})
