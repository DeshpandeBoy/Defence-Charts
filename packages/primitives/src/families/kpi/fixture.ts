import type { Series, ValueFrame } from '@shiftcharts/core'

/**
 * A deterministic post-frame KPI input for primitive contract tests.
 *
 * The value entry keeps metric qualifiers as data instead of baking them into the formatted
 * number: `unit`, `target`, `status`, `delta`, and `comparison` are all serialisable metadata
 * that a hook-free composition can render as visible text. The trend remains an existing line
 * plan with axes off; this family does not introduce a new mark kind.
 */
const KPI_SERIES = Object.freeze({
  id: 'revenue',
  label: 'Revenue',
  unit: 'USD',
  target: 60,
  status: 'positive',
  points: Object.freeze([
    Object.freeze({ x: 1, y: 48 }),
    Object.freeze({ x: 2, y: 54 }),
    Object.freeze({ x: 3, y: 58 }),
  ]),
} satisfies Series)

const KPI_VALUE = Object.freeze({
  region: Object.freeze({ x: 0, y: 0, width: 240, height: 48 }),
  presentation: Object.freeze({ label: 'series', context: 'delta' }),
  fontSize: 28,
  entries: Object.freeze([
    Object.freeze({
      seriesId: 'revenue',
      seriesIndex: 0,
      label: 'Revenue',
      text: '58',
      unit: 'USD',
      target: Object.freeze({ value: 60, text: '60' }),
      status: 'positive',
      delta: Object.freeze({ text: '+4', direction: 'up' }),
      comparison: '54',
      x: 120,
      y: 24,
    }),
  ]),
  overflow: null,
} satisfies ValueFrame)

/**
 * The primitive-facing KPI composition contract.
 *
 * `value` is painted by the existing `ValueDisplay`; `trend` is the existing line mark with
 * axes suppressed; and `table` is the existing `DataTable`. The descriptor is test metadata,
 * not a runtime registry entry.
 */
export const KPI_PRIMITIVE_FIXTURE = Object.freeze({
  data: Object.freeze([KPI_SERIES]),
  value: KPI_VALUE,
  composition: Object.freeze({
    chartType: 'kpi',
    value: 'ValueDisplay',
    trend: 'line-axes-off',
    table: 'DataTable',
    primaryMark: 'line',
    statusTextRequired: true,
  }),
})
