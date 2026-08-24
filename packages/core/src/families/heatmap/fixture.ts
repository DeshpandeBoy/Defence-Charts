import type { Series } from '../../data.ts'

const DAY_MS = 86_400_000
const START = Date.UTC(2026, 0, 1)

/**
 * Deterministic activity input for the heatmap planner tests.
 *
 * Dates are intentionally unsorted in the second series and both series contain a null gap.
 * The planner receives only `describeShape()` output; the coordinator-owned frame must retain
 * `${series.id}:${x}` identity, reject duplicate x values within a series, and preserve gaps as
 * missing rather than zero.
 */
export const HEATMAP_FAMILY_FIXTURE = Object.freeze({
  type: 'heatmap' as const,
  sizeClass: 'panel' as const,
  series: Object.freeze([
    Object.freeze({
      id: 'maintenance',
      label: 'Maintenance',
      points: Object.freeze([
        Object.freeze({ x: new Date(START), y: 0 }),
        Object.freeze({ x: new Date(START + DAY_MS), y: 4 }),
        Object.freeze({ x: new Date(START + DAY_MS * 2), y: null }),
        Object.freeze({ x: new Date(START + DAY_MS * 3), y: 12 }),
        Object.freeze({ x: new Date(START + DAY_MS * 4), y: -2 }),
        Object.freeze({ x: new Date(START + DAY_MS * 5), y: 9 }),
        Object.freeze({ x: new Date(START + DAY_MS * 6), y: 1 }),
      ]),
    }),
    Object.freeze({
      id: 'inspection',
      label: 'Inspection',
      points: Object.freeze([
        Object.freeze({ x: new Date(START + DAY_MS * 6), y: 3 }),
        Object.freeze({ x: new Date(START + DAY_MS * 2), y: 7 }),
        Object.freeze({ x: new Date(START + DAY_MS * 7), y: 2 }),
        Object.freeze({ x: new Date(START + DAY_MS * 8), y: null }),
        Object.freeze({ x: new Date(START + DAY_MS * 9), y: 18 }),
      ]),
    }),
  ] satisfies readonly Series[]),
})
