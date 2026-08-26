import type { ProgressFrame } from '@shiftcharts/core'

const HORIZONTAL_TRACK = Object.freeze({ x: 12, y: 28, width: 176, height: 12 })
const HORIZONTAL_FILL = Object.freeze({ x: 12, y: 28, width: 88, height: 12 })

/** Deterministic horizontal geometry for the progress renderer contract tests. */
export const PROGRESS_HORIZONTAL_FIXTURE = Object.freeze({
  orientation: 'horizontal',
  current: 50,
  target: 100,
  ratio: 0.5,
  remaining: 50,
  overTarget: null,
  indeterminate: false,
  track: HORIZONTAL_TRACK,
  fill: HORIZONTAL_FILL,
  trackPath: null,
  fillPath: null,
  cx: null,
  cy: null,
  innerRadius: null,
  outerRadius: null,
} satisfies ProgressFrame)

/** Deterministic radial geometry for the over-target renderer contract test. */
export const PROGRESS_RADIAL_OVER_TARGET_FIXTURE = Object.freeze({
  orientation: 'radial',
  current: 125,
  target: 100,
  ratio: 1,
  remaining: 0,
  overTarget: 25,
  indeterminate: false,
  track: null,
  fill: null,
  trackPath: 'M0,-42A42,42 0 1 1 0,42A42,42 0 1 1 0,-42Z',
  fillPath: 'M0,-42A42,42 0 1 1 0,42A42,42 0 1 1 0,-42Z',
  cx: 64,
  cy: 64,
  innerRadius: 30,
  outerRadius: 42,
} satisfies ProgressFrame)

/** Missing target is explicit: no fill geometry is allowed to imply completion. */
export const PROGRESS_INDETERMINATE_FIXTURE = Object.freeze({
  orientation: 'horizontal',
  current: 50,
  target: null,
  ratio: null,
  remaining: null,
  overTarget: null,
  indeterminate: true,
  track: HORIZONTAL_TRACK,
  fill: null,
  trackPath: null,
  fillPath: null,
  cx: null,
  cy: null,
  innerRadius: null,
  outerRadius: null,
} satisfies ProgressFrame)

export type ProgressFixtureFrame = {
  readonly id: string
  readonly label: string
  readonly index: number
  readonly progress: ProgressFrame
}

export const PROGRESS_RENDERER_FRAME = Object.freeze({
  id: 'completion',
  label: 'Completion',
  index: 0,
  progress: PROGRESS_HORIZONTAL_FIXTURE,
} satisfies ProgressFixtureFrame)
