import type { CellFrame, SeriesFrame } from '@shiftcharts/core'

type HeatmapFixtureCell = CellFrame & {
  readonly id?: string | undefined
  readonly value?: number | null | undefined
  readonly intensity?: number | null | undefined
}

/**
 * Deterministic post-frame geometry for the heatmap renderer tests.
 *
 * The optional value/intensity fields are read as semantic metadata when the coordinator's frame
 * seam supplies them; the renderer still treats geometry as its source of truth for painting.
 */
export const HEATMAP_SOURCE_OBSERVATIONS = Object.freeze([
  Object.freeze({ key: 'missing', value: null, cellIndex: 0 }),
  Object.freeze({ key: 'zero', value: 0, cellIndex: 1 }),
  Object.freeze({ key: 'negative', value: -7, cellIndex: 2 }),
  Object.freeze({ key: 'extreme', value: Number.MAX_VALUE, cellIndex: 3 }),
])

export const HEATMAP_RENDERER_FIXTURE: Pick<
  SeriesFrame,
  'id' | 'label' | 'index' | 'cells'
> = Object.freeze({
  id: 'activity',
  label: 'Activity',
  index: 0,
  cells: Object.freeze([
    Object.freeze({
      id: 'activity:missing',
      x: 0,
      y: 0,
      width: 8,
      height: 8,
      value: null,
      intensity: null,
    } satisfies HeatmapFixtureCell),
    Object.freeze({
      id: 'activity:zero',
      x: 8,
      y: 0,
      width: 8,
      height: 8,
      value: 0,
      intensity: 0,
    } satisfies HeatmapFixtureCell),
    Object.freeze({
      id: 'activity:negative',
      x: 16,
      y: -4,
      width: 8,
      height: 8,
      value: -7,
      intensity: 0.25,
    } satisfies HeatmapFixtureCell),
    Object.freeze({
      id: 'activity:extreme',
      x: 24,
      y: 0,
      width: 8,
      height: 8,
      value: Number.MAX_VALUE,
      intensity: 1,
    } satisfies HeatmapFixtureCell),
  ]),
})
