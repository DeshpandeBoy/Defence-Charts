import type { FunnelFrame, FunnelStageFrame } from '@shiftcharts/core'

const stages: readonly FunnelStageFrame[] = Object.freeze([
  Object.freeze({
    id: 'checkout:landing',
    label: 'Landing',
    index: 0,
    value: 1000,
    share: 1,
    conversion: 1,
    dropoff: null,
    x: 24,
    y: 12,
    width: 160,
    height: 18,
    labelWidth: 600,
  }),
  Object.freeze({
    id: 'checkout:details',
    label: 'Details',
    index: 1,
    value: 800,
    share: 0.8,
    conversion: 0.8,
    dropoff: 0.2,
    x: 40,
    y: 42,
    width: 128,
    height: 18,
    labelWidth: 600,
  }),
  Object.freeze({
    id: 'checkout:complete',
    label: 'Complete',
    index: 2,
    value: 250,
    share: 0.25,
    conversion: 0.25,
    dropoff: 0.6875,
    x: 72,
    y: 72,
    width: 64,
    height: 18,
    labelWidth: 600,
  }),
])

/** Deterministic shared-frame geometry and semantics for the funnel renderer tests. */
export const FUNNEL_RENDERER_FRAME: FunnelFrame = Object.freeze({
  stages,
  overallConversion: 0.25,
})

export const FUNNEL_ZERO_BASELINE_FRAME: FunnelFrame = Object.freeze({
  stages: Object.freeze([
    Object.freeze({
      id: 'zero:first',
      label: 'First',
      index: 0,
      value: 0,
      share: 0,
      conversion: null,
      dropoff: null,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      labelWidth: 600,
    }),
    Object.freeze({
      id: 'zero:last',
      label: 'Last',
      index: 1,
      value: 0,
      share: 0,
      conversion: null,
      dropoff: null,
      x: 0,
      y: 20,
      width: 0,
      height: 0,
      labelWidth: 600,
    }),
  ]),
  overallConversion: null,
})

export const FUNNEL_EMPTY_FRAME: FunnelFrame = Object.freeze({
  stages: Object.freeze([]),
  overallConversion: null,
})
