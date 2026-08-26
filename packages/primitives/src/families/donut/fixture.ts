import type { ArcFrame, ChartFrame } from '@shiftcharts/core'

/** Deterministic shared-frame geometry used by the donut renderer tests. */
export const DONUT_RENDERER_FIXTURE: Pick<ChartFrame['series'][number], 'id' | 'label' | 'index' | 'arcs'> =
  Object.freeze({
    id: 'sales',
    label: 'Sales',
    index: 0,
    arcs: Object.freeze([
      Object.freeze({
        id: 'sales:north',
        label: 'North',
        value: 60,
        share: 0.6,
        startAngle: -Math.PI / 2,
        endAngle: Math.PI * 0.7,
        cx: 96,
        cy: 72,
        innerRadius: 24,
        outerRadius: 48,
        d: 'M0,-48A48,48 0 0 1 45.65,14.77L22.83,7.38A24,24 0 0 0 0,-24Z',
        other: false,
      } satisfies ArcFrame),
      Object.freeze({
        id: 'sales:south',
        label: 'South',
        value: 30,
        share: 0.3,
        startAngle: Math.PI * 0.7,
        endAngle: Math.PI * 1.3,
        cx: 96,
        cy: 72,
        innerRadius: 24,
        outerRadius: 48,
        d: 'M45.65,14.77A48,48 0 0 1 -45.65,14.77L-22.83,7.38A24,24 0 0 0 22.83,7.38Z',
        other: false,
      } satisfies ArcFrame),
      Object.freeze({
        id: 'sales:other',
        label: 'Other',
        value: 10,
        share: 0.1,
        startAngle: Math.PI * 1.3,
        endAngle: Math.PI * 1.5,
        cx: 96,
        cy: 72,
        innerRadius: 24,
        outerRadius: 48,
        d: 'M-45.65,14.77A48,48 0 0 1 0,48L0,24A24,24 0 0 0 -22.83,7.38Z',
        other: true,
      } satisfies ArcFrame),
    ]),
  })
