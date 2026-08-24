import type { Series } from '../../data.ts'

/**
 * Small, serialisable KPI data used only by the family-local planner tests.
 *
 * Unit, target, and status are existing `Series` metadata. The planner deliberately does not
 * inspect them: values and metric state enter at the frame/renderer boundary, while this fixture
 * proves that the family composition remains deterministic and RSC-safe.
 */
export const KPI_FAMILY_FIXTURE = Object.freeze({
  type: 'kpi' as const,
  series: Object.freeze({
    id: 'conversion',
    label: 'Conversion',
    unit: '%',
    target: 75,
    status: 'positive' as const,
    points: Object.freeze([
      Object.freeze({ x: 0, y: 68 }),
      Object.freeze({ x: 1, y: 71 }),
      Object.freeze({ x: 2, y: 74 }),
    ]),
  }) satisfies Series,
})
