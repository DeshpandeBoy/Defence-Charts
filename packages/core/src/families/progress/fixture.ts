import type { Series } from '../../data.ts'

/**
 * Deterministic progress input used by the family-local planner tests.
 *
 * The planner only receives `DataShape`, so it must not inspect this fixture's values. The
 * frame is the value-aware boundary: current is the latest finite `y`; a target is determinate
 * only when it is finite and strictly greater than zero. A finite negative current is allowed
 * as data and must clamp the visual ratio to zero; null/non-finite current values and missing,
 * zero, negative, or non-finite targets are explicit indeterminate cases for the frame.
 */
export const PROGRESS_FAMILY_FIXTURE = Object.freeze({
  type: 'progress' as const,
  series: Object.freeze({
    id: 'readiness',
    label: 'Readiness',
    unit: '%',
    target: 100,
    status: 'positive' as const,
    points: Object.freeze([
      Object.freeze({ x: 0, y: 64 }),
      Object.freeze({ x: 1, y: 78 }),
    ]),
  }) satisfies Series,
})

/** Value/target cases the shared frame must keep explicit rather than coercing or inferring. */
export const PROGRESS_VALIDATION_FIXTURES = Object.freeze([
  Object.freeze({ name: 'complete', current: 100, target: 100, state: 'determinate' as const }),
  Object.freeze({ name: 'partial', current: 40, target: 100, state: 'determinate' as const }),
  Object.freeze({ name: 'over-target', current: 120, target: 100, state: 'determinate' as const }),
  Object.freeze({ name: 'negative-current', current: -10, target: 100, state: 'determinate' as const }),
  Object.freeze({ name: 'missing-current', current: null, target: 100, state: 'indeterminate' as const }),
  Object.freeze({ name: 'missing-target', current: 40, target: null, state: 'indeterminate' as const }),
  Object.freeze({ name: 'zero-target', current: 40, target: 0, state: 'indeterminate' as const }),
  Object.freeze({ name: 'negative-target', current: 40, target: -1, state: 'indeterminate' as const }),
  Object.freeze({ name: 'non-finite-target', current: 40, target: Number.NaN, state: 'indeterminate' as const }),
] as const)
