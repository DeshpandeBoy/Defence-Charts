import {
  describeShape,
  planChart,
  sizeContextFromPixels,
  type ChartPlan,
  type Series,
  type SizeContext,
} from '@gx/core'

export const FAMILY_TYPES = ['line', 'area', 'bar', 'timebar', 'scatter', 'donut', 'kpi', 'progress', 'heatmap', 'funnel'] as const
export type FamilyType = (typeof FAMILY_TYPES)[number]

export const MATRIX_SERIES_IDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'] as const

export const MATRIX_DATA: readonly Series[] = Object.freeze(
  MATRIX_SERIES_IDS.map((id, seriesIndex) => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    points: Object.freeze(
      Array.from({ length: 8 }, (_, pointIndex) => ({
        x: pointIndex,
        y: (seriesIndex + 1) * 5 + pointIndex * (seriesIndex % 2 === 0 ? 1 : -1),
      })),
    ),
  })),
)

export const EMPTY_DATA: readonly Series[] = Object.freeze([])
export const ERROR_MESSAGE = 'Family fixture error: the host-owned state is announced here.'

export const DONUT_MATRIX_DATA: readonly Series[] = Object.freeze([
  {
    id: 'donut',
    label: 'Program mix',
    points: Object.freeze([
      { x: 0, y: 40 },
      { x: 1, y: 24 },
      { x: 2, y: 16 },
      { x: 3, y: 10 },
      { x: 4, y: 6 },
      { x: 5, y: 4 },
      { x: 6, y: 3 },
      { x: 7, y: 2 },
      { x: 8, y: 1 },
      { x: 9, y: 1 },
    ]),
  },
])

export const KPI_MATRIX_DATA: readonly Series[] = Object.freeze([
  {
    id: 'kpi',
    label: 'Readiness',
    unit: '%',
    target: 75,
    status: 'positive',
    points: Object.freeze([
      { x: 0, y: 68 },
      { x: 1, y: 71 },
      { x: 2, y: 74 },
    ]),
  },
])

export const PROGRESS_MATRIX_DATA: readonly Series[] = Object.freeze([
  {
    id: 'progress',
    label: 'Readiness',
    unit: '%',
    target: 100,
    status: 'positive',
    points: Object.freeze([{ x: 0, y: 74 }]),
  },
])

export const HEATMAP_MATRIX_DATA: readonly Series[] = Object.freeze([
  {
    id: 'heatmap-maintenance',
    label: 'Maintenance',
    points: Object.freeze(
      Array.from({ length: 8 }, (_, index) => ({
        x: new Date(Date.UTC(2026, 0, index + 1)),
        y: [0, 4, null, 12, -2, 9, 1, 6][index] ?? null,
      })),
    ),
  },
  {
    id: 'heatmap-inspection',
    label: 'Inspection',
    points: Object.freeze(
      Array.from({ length: 8 }, (_, index) => ({
        x: new Date(Date.UTC(2026, 0, index + 1)),
        y: [3, 7, 5, null, 18, 2, 4, 8][index] ?? null,
      })),
    ),
  },
])

export const FUNNEL_MATRIX_DATA: readonly Series[] = Object.freeze([
  {
    id: 'funnel',
    label: 'Readiness pipeline',
    points: Object.freeze([
      { x: 0, y: 100 },
      { x: 1, y: 76 },
      { x: 2, y: 54 },
      { x: 3, y: 31 },
      { x: 4, y: 12 },
    ]),
  },
])

export type ExpectedFamilyMetadata = {
  readonly primary: 'none' | 'line' | 'bar' | 'point' | 'arc' | 'progress' | 'cell' | 'funnel'
  readonly area: boolean | null
  readonly valueLegibility: 'single-value' | 'shape-only' | 'values'
  readonly interaction: 'none' | 'tap' | 'hover'
  readonly tooltip: 'disabled' | 'fix' | 'fluid'
  readonly crosshair: boolean
  readonly legend: 'absent' | 'direct' | 'internal' | 'external'
  readonly legendToggle: boolean
  readonly motionStages: 1 | 2
  readonly persistGridlines: boolean
  readonly regions: readonly string[]
  readonly y2: boolean
  readonly facet: 'none' | 'series'
}

export type FamilyMatrixRow = {
  readonly id: 'micro' | 'tile' | 'strip' | 'panel' | 'canvas' | 'stage'
  readonly label: string
  readonly width: number
  readonly height: number
  readonly ctx: SizeContext
  readonly expected: ExpectedFamilyMetadata
}

function context(width: number, height: number): SizeContext {
  return sizeContextFromPixels(width, height)
}

export const FAMILY_MATRIX: readonly FamilyMatrixRow[] = Object.freeze([
  {
    id: 'micro',
    label: 'Micro · 1×1',
    width: 100,
    height: 100,
    ctx: context(100, 100),
    expected: {
      primary: 'none',
      area: null,
      valueLegibility: 'single-value',
      interaction: 'none',
      tooltip: 'disabled',
      crosshair: false,
      legend: 'absent',
      legendToggle: false,
      motionStages: 1,
      persistGridlines: false,
      regions: ['value', 'table'],
      y2: false,
      facet: 'none',
    },
  },
  {
    id: 'tile',
    label: 'Tile · 2×2',
    width: 200,
    height: 200,
    ctx: context(200, 200),
    expected: {
      primary: 'line',
      area: false,
      valueLegibility: 'single-value',
      interaction: 'none',
      tooltip: 'disabled',
      crosshair: false,
      legend: 'absent',
      legendToggle: false,
      motionStages: 1,
      persistGridlines: false,
      regions: ['value', 'plot', 'table'],
      y2: false,
      facet: 'none',
    },
  },
  {
    id: 'strip',
    label: 'Strip · 4×2',
    width: 400,
    height: 200,
    ctx: context(400, 200),
    expected: {
      primary: 'line',
      area: false,
      valueLegibility: 'shape-only',
      interaction: 'tap',
      tooltip: 'fix',
      crosshair: false,
      legend: 'absent',
      legendToggle: false,
      motionStages: 1,
      persistGridlines: false,
      regions: ['plot', 'table'],
      y2: false,
      facet: 'none',
    },
  },
  {
    id: 'panel',
    label: 'Panel · 5×3',
    width: 500,
    height: 300,
    ctx: context(500, 300),
    expected: {
      primary: 'line',
      area: false,
      valueLegibility: 'values',
      interaction: 'hover',
      tooltip: 'fix',
      crosshair: true,
      legend: 'direct',
      legendToggle: false,
      motionStages: 2,
      persistGridlines: true,
      regions: ['plot', 'table'],
      y2: false,
      facet: 'none',
    },
  },
  {
    id: 'canvas',
    label: 'Canvas · 7×5',
    width: 700,
    height: 500,
    ctx: context(700, 500),
    expected: {
      primary: 'line',
      area: false,
      valueLegibility: 'values',
      interaction: 'hover',
      tooltip: 'fluid',
      crosshair: true,
      legend: 'external',
      legendToggle: true,
      motionStages: 2,
      persistGridlines: true,
      regions: ['plot', 'legend', 'table'],
      y2: false,
      facet: 'none',
    },
  },
  {
    id: 'stage',
    label: 'Stage · 10×7',
    width: 1000,
    height: 700,
    ctx: context(1000, 700),
    expected: {
      primary: 'line',
      area: false,
      valueLegibility: 'values',
      interaction: 'hover',
      tooltip: 'fluid',
      crosshair: true,
      legend: 'external',
      legendToggle: true,
      motionStages: 2,
      persistGridlines: true,
      regions: ['plot', 'legend', 'table'],
      y2: true,
      facet: 'series',
    },
  },
])

export type BoundaryCase = {
  readonly id: string
  readonly label: string
  readonly before: { readonly width: number; readonly height: number; readonly sizeClass: string }
  readonly at: { readonly width: number; readonly height: number; readonly sizeClass: string }
  readonly after: { readonly width: number; readonly height: number; readonly sizeClass: string }
}

export const RESIZE_BOUNDARIES: readonly BoundaryCase[] = Object.freeze([
  {
    id: 'micro-tile-inline',
    label: 'Micro → Tile at 2 columns',
    before: { width: 199, height: 110, sizeClass: 'micro' },
    at: { width: 200, height: 110, sizeClass: 'tile' },
    after: { width: 201, height: 110, sizeClass: 'tile' },
  },
  {
    id: 'tile-strip-inline',
    label: 'Tile → Strip at 3 columns',
    before: { width: 299, height: 110, sizeClass: 'tile' },
    at: { width: 300, height: 110, sizeClass: 'strip' },
    after: { width: 301, height: 110, sizeClass: 'strip' },
  },
  {
    id: 'strip-panel-block',
    label: 'Strip → Panel at 3 rows',
    before: { width: 310, height: 299, sizeClass: 'strip' },
    at: { width: 310, height: 300, sizeClass: 'panel' },
    after: { width: 310, height: 301, sizeClass: 'panel' },
  },
  {
    id: 'panel-canvas',
    label: 'Panel → Canvas at 6×5 cells',
    before: { width: 599, height: 499, sizeClass: 'panel' },
    at: { width: 600, height: 500, sizeClass: 'canvas' },
    after: { width: 601, height: 501, sizeClass: 'canvas' },
  },
  {
    id: 'canvas-stage',
    label: 'Canvas → Stage at 9×6 cells',
    before: { width: 899, height: 599, sizeClass: 'canvas' },
    at: { width: 900, height: 600, sizeClass: 'stage' },
    after: { width: 901, height: 601, sizeClass: 'stage' },
  },
])

export const FAMILY_STATES = ['normal', 'empty', 'error'] as const
export type FamilyState = (typeof FAMILY_STATES)[number]

export const MATRIX_SHAPE = describeShape(MATRIX_DATA)

export function dataForType(type: FamilyType): readonly Series[] {
  if (type === 'donut') return DONUT_MATRIX_DATA
  if (type === 'kpi') return KPI_MATRIX_DATA
  if (type === 'progress') return PROGRESS_MATRIX_DATA
  if (type === 'heatmap') return HEATMAP_MATRIX_DATA
  if (type === 'funnel') return FUNNEL_MATRIX_DATA
  return MATRIX_DATA
}

export function planForRow(type: FamilyType, row: FamilyMatrixRow, data = dataForType(type)): ChartPlan {
  return planChart(type, row.ctx, describeShape(data))
}

export function metadataForPlan(plan: ChartPlan): ExpectedFamilyMetadata & {
  readonly sizeClass: ChartPlan['sizeClass']
  readonly type: ChartPlan['type']
} {
  const primary = plan.marks.primary
  return {
    type: plan.type,
    sizeClass: plan.sizeClass,
    primary:
      primary.kind === 'line' || primary.kind === 'none' || primary.kind === 'bar' || primary.kind === 'point' || primary.kind === 'arc' || primary.kind === 'progress' || primary.kind === 'cell' || primary.kind === 'funnel'
        ? primary.kind
        : 'line',
    area: primary.kind === 'line' ? primary.area : null,
    valueLegibility: plan.valueLegibility,
    interaction: plan.interaction.trigger,
    tooltip: plan.interaction.tooltip.enabled ? plan.interaction.tooltip.placement : 'disabled',
    crosshair: plan.interaction.crosshair,
    legend: plan.legend.placement,
    legendToggle: plan.interaction.legendToggle,
    motionStages: plan.motion.stages,
    persistGridlines: plan.motion.persistGridlines,
    regions: plan.regionOrder,
    y2: plan.axes.y2 !== null,
    facet: plan.marks.facet.mode,
  }
}

export function identitySignature(data: readonly Series[] = MATRIX_DATA): string {
  return data.map((series) => series.id).join('|')
}
