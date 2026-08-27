import type { CSSProperties, ChangeEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type {
  ChartPlan,
  ChartType,
  DataPoint,
  PlanOverrides,
  PlanPolicy,
  Series,
} from '@shiftcharts/core'
import {
  DEFAULT_POLICY,
  describeShape,
  planChart,
  resolveFrame,
  sizeContextFromPixels,
} from '@shiftcharts/core'
import { AutoChart, LegendControl } from '@shiftcharts/react'
import {
  SHIFTCHARTS_THEMES,
  SHIFTCHARTS_TOKENS,
  TOKEN_GROUPS,
  toCustomProperty,
  type ShiftChartsTheme,
  type ShiftChartsTokenName,
  type Token,
} from '@shiftcharts/tokens'

const CHART_TYPES: readonly ChartType[] = [
  'line',
  'area',
  'bar',
  'timebar',
  'scatter',
  'donut',
  'kpi',
  'progress',
  'heatmap',
  'funnel',
]

type ChartPageDetails = {
  readonly label: string
  readonly defaultTitle: string
  readonly description: string
  readonly geometryFocus: string
}

const CHART_PAGE_DETAILS: Readonly<Record<ChartType, ChartPageDetails>> = {
  line: {
    label: 'Line',
    defaultTitle: 'ShiftCharts line geometry study',
    description: 'Inspect direct end labels, shared x positions, and the plot-to-axis relationship.',
    geometryFocus: 'Direct labels and time-series plot bounds',
  },
  area: {
    label: 'Area',
    defaultTitle: 'ShiftCharts area geometry study',
    description: 'Inspect stacked ink, baseline treatment, and label clearance around filled marks.',
    geometryFocus: 'Filled mark envelope and baseline clearance',
  },
  bar: {
    label: 'Bar',
    defaultTitle: 'ShiftCharts bar geometry study',
    description: 'Inspect category slots, bar widths, gaps, and value-label placement.',
    geometryFocus: 'Category slots, gaps, and bar envelopes',
  },
  timebar: {
    label: 'Timebar',
    defaultTitle: 'ShiftCharts timebar geometry study',
    description: 'Inspect temporal bins, interval widths, and axis density across a measured box.',
    geometryFocus: 'Temporal bins and interval geometry',
  },
  scatter: {
    label: 'Scatter',
    defaultTitle: 'ShiftCharts scatter geometry study',
    description: 'Inspect point density, plot bounds, and series separation without grid placement.',
    geometryFocus: 'Point bounds, density, and plot gutters',
  },
  donut: {
    label: 'Donut',
    defaultTitle: 'ShiftCharts donut geometry study',
    description: 'Inspect radial bounds, slice spacing, center value treatment, and legend demand.',
    geometryFocus: 'Radial bounds and slice/value clearance',
  },
  kpi: {
    label: 'KPI',
    defaultTitle: 'ShiftCharts KPI geometry study',
    description: 'Inspect the value region, supporting context, and status treatment inside a tile.',
    geometryFocus: 'Value region and supporting context',
  },
  progress: {
    label: 'Progress',
    defaultTitle: 'ShiftCharts progress geometry study',
    description: 'Inspect target-aware fill, track bounds, and the value-to-label relationship.',
    geometryFocus: 'Track, fill, target, and value geometry',
  },
  heatmap: {
    label: 'Heatmap',
    defaultTitle: 'ShiftCharts heatmap geometry study',
    description: 'Inspect temporal cell sizing, missing values, and the intensity legend seam.',
    geometryFocus: 'Temporal cell matrix and intensity scale',
  },
  funnel: {
    label: 'Funnel',
    defaultTitle: 'ShiftCharts funnel geometry study',
    description: 'Inspect ordered stage bands, conversion context, and label/value clearance.',
    geometryFocus: 'Ordered stage bands and conversion geometry',
  },
}

function chartPagePath(type: ChartType): string {
  return `/charts/${type}`
}

function chartTypeFromPath(pathname: string): ChartType {
  const candidate = pathname.match(/^\/charts\/([^/]+)\/?$/)?.[1]
  return CHART_TYPES.find((type) => type === candidate) ?? 'line'
}

function isTokenExplorerPath(pathname: string): boolean {
  return pathname === '/tokens' || pathname === '/tokens/'
}

const SIZE_PRESETS = [
  { id: 'micro', label: 'Micro', width: 150, height: 110 },
  { id: 'tile', label: 'Tile', width: 260, height: 180 },
  { id: 'strip', label: 'Strip', width: 420, height: 190 },
  { id: 'panel', label: 'Panel', width: 560, height: 320 },
  { id: 'canvas', label: 'Canvas', width: 760, height: 480 },
  { id: 'stage', label: 'Stage', width: 960, height: 620 },
] as const

type NumericPolicyKey =
  | 'tickTargetSpacingX'
  | 'ticksMin'
  | 'labelMinSpacing'
  | 'yTickCount'
  | 'directLabelMaxSeries'
  | 'secondaryAxisMinSeries'
  | 'tickLength'
  | 'tickLabelGap'
  | 'axisTitleGap'
  | 'axisRuleWidth'
  | 'regionGap'
  | 'plotHeightOptimal'
  | 'plotHeightMinValues'
  | 'plotHeightSaturation'
  | 'horizonMinHeight'
  | 'categoriesMaxRadial'
  | 'aggregateAfter'
  | 'legendMaxEntries'
  | 'pointBudget'
  | 'pointAutoHideDensityThreshold'
  | 'minCellSize'
  | 'valueRegionMaxShare'

type PolicyNumberField = {
  readonly key: NumericPolicyKey
  readonly label: string
  readonly min: number
  readonly max: number
  readonly step: number
  readonly unit?: string
}

const POLICY_NUMBER_FIELDS: readonly PolicyNumberField[] = [
  { key: 'tickTargetSpacingX', label: 'X tick target spacing', min: 40, max: 240, step: 1, unit: 'px' },
  { key: 'ticksMin', label: 'Minimum ticks', min: 2, max: 8, step: 1 },
  { key: 'labelMinSpacing', label: 'Minimum label spacing', min: 0.5, max: 4, step: 0.1, unit: 'em' },
  { key: 'yTickCount', label: 'Y tick count', min: 2, max: 8, step: 1 },
  { key: 'directLabelMaxSeries', label: 'Direct-label series limit', min: 1, max: 8, step: 1 },
  { key: 'secondaryAxisMinSeries', label: 'Secondary-axis series minimum', min: 1, max: 6, step: 1 },
  { key: 'tickLength', label: 'Tick length', min: 0, max: 16, step: 1, unit: 'px' },
  { key: 'tickLabelGap', label: 'Tick / label gap', min: 0, max: 16, step: 1, unit: 'px' },
  { key: 'axisTitleGap', label: 'Axis title gap', min: 0, max: 16, step: 1, unit: 'px' },
  { key: 'axisRuleWidth', label: 'Axis rule width', min: 0, max: 4, step: 0.5, unit: 'px' },
  { key: 'regionGap', label: 'Region gap', min: 0, max: 24, step: 1, unit: 'px' },
  { key: 'plotHeightOptimal', label: 'Optimal plot height', min: 8, max: 80, step: 1, unit: 'px' },
  { key: 'plotHeightMinValues', label: 'Minimum value height', min: 16, max: 120, step: 1, unit: 'px' },
  { key: 'plotHeightSaturation', label: 'Plot saturation height', min: 40, max: 200, step: 1, unit: 'px' },
  { key: 'horizonMinHeight', label: 'Horizon minimum height', min: 2, max: 24, step: 1, unit: 'px' },
  { key: 'categoriesMaxRadial', label: 'Radial category limit', min: 3, max: 24, step: 1 },
  { key: 'aggregateAfter', label: 'Aggregate after', min: 2, max: 24, step: 1 },
  { key: 'legendMaxEntries', label: 'Legend max entries', min: 1, max: 24, step: 1 },
  { key: 'pointBudget', label: 'Point budget', min: 10, max: 10000, step: 10 },
  { key: 'pointAutoHideDensityThreshold', label: 'Point hide density', min: 0, max: 16, step: 0.5, unit: 'px' },
  { key: 'minCellSize', label: 'Heatmap cell floor', min: 2, max: 32, step: 1, unit: 'px' },
  { key: 'valueRegionMaxShare', label: 'Value region max share', min: 0.1, max: 0.8, step: 0.05 },
]

const ASPECTS = ['portrait', 'square', 'landscape', 'ultrawide'] as const

const points = (values: readonly (number | null)[], categories?: readonly string[]): readonly DataPoint[] =>
  values.map((y, index) => ({
    x: index,
    y,
    ...(categories?.[index] === undefined ? {} : { category: categories[index] }),
  }))

const temporalPoints = (values: readonly (number | null)[]): readonly DataPoint[] =>
  values.map((y, index) => ({ x: new Date(Date.UTC(2026, 0, index + 1)), y }))

const lineData: readonly Series[] = [
  { id: 'readiness', label: 'Readiness', points: points([42, 46, 44, 52, 57, 55, 61, 68, 66, 74, 78, 82]) },
  { id: 'training', label: 'Training', points: points([28, 34, 32, 37, 41, 46, 44, 51, 55, 58, 63, 69]) },
  { id: 'maintenance', label: 'Maintenance', points: points([61, 58, 60, 57, null, 53, 50, 49, 45, 43, 46, 41]) },
]

const DATA_BY_TYPE: Readonly<Record<ChartType, readonly Series[]>> = {
  line: lineData,
  area: lineData,
  bar: [
    { id: 'north', label: 'North', points: points([42, 58, 47, 71, 63, 78]) },
    { id: 'south', label: 'South', points: points([35, 48, 55, 61, 57, 69]) },
    { id: 'west', label: 'West', points: points([27, 38, 44, 52, 49, 60]) },
  ],
  timebar: [
    { id: 'deployments', label: 'Deployments', points: points([12, 20, 16, 28, 25, 34, 31, 39]) },
  ],
  scatter: [
    { id: 'alpha', label: 'Alpha', points: points([12, 18, 16, 23, 28, 31, 34]) },
    { id: 'bravo', label: 'Bravo', points: points([7, 11, 15, 14, 21, 24, 27]) },
  ],
  donut: [
    {
      id: 'program-mix',
      label: 'Program mix',
      points: points([40, 24, 16, 10, 6, 4], ['Personnel', 'Training', 'Maintenance', 'Logistics', 'Medical', 'Other']),
    },
  ],
  kpi: [{ id: 'readiness', label: 'Readiness', unit: '%', target: 80, status: 'positive', points: points([74, 78, 82]) }],
  progress: [{ id: 'completion', label: 'Completion', unit: '%', target: 100, status: 'positive', points: points([74]) }],
  heatmap: [
    { id: 'maintenance', label: 'Maintenance', points: temporalPoints([0, 4, null, 12, -2, 9, 1, 6]) },
    { id: 'inspection', label: 'Inspection', points: temporalPoints([3, 7, 5, null, 18, 2, 4, 8]) },
  ],
  funnel: [
    { id: 'readiness-pipeline', label: 'Readiness pipeline', points: points([100, 76, 54, 31, 12], ['Assigned', 'Screened', 'Trained', 'Certified', 'Deployed']) },
  ],
}

const LEGEND_STUDY_DATA: readonly Series[] = [
  { id: 'alpha', label: 'Alpha', points: points([28, 34, 31, 42, 48, 54, 61, 66]) },
  { id: 'bravo', label: 'Bravo', points: points([46, 51, 49, 56, 61, 60, 68, 72]) },
  { id: 'charlie', label: 'Charlie', points: points([64, 61, 58, 55, 51, 47, 44, 41]) },
  { id: 'delta', label: 'Delta', points: points([18, 22, 29, 27, 35, 38, 45, 49]) },
  { id: 'echo', label: 'Echo', points: points([38, 42, 40, null, 46, 52, 50, 57]) },
]

const LEGEND_STUDY_PLAN = planChart(
  'line',
  sizeContextFromPixels(760, 480),
  describeShape(LEGEND_STUDY_DATA),
  DEFAULT_POLICY,
  {
    legend: { placement: 'external', position: 'bottom', maxEntries: 5, showValues: false, showPercent: false },
    interaction: { legendToggle: true },
  },
)

const SANDBOX_DEFAULT_OVERRIDES: PlanOverrides = {
  interaction: {
    trigger: 'hover',
    tooltip: { enabled: true, placement: 'fluid' },
    crosshair: true,
  },
}

type MeasuredSnapshot = {
  readonly signature: string
  readonly plan: ChartPlan
  readonly width: number
  readonly height: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseData(text: string): { readonly data: readonly Series[] | null; readonly error: string | null } {
  try {
    const parsed: unknown = JSON.parse(text)
    if (!Array.isArray(parsed)) return { data: null, error: 'Data must be a JSON array of series.' }

    const data: Series[] = []
    for (const [seriesIndex, item] of parsed.entries()) {
      if (!isRecord(item) || typeof item.id !== 'string' || !Array.isArray(item.points)) {
        return { data: null, error: `Series ${seriesIndex + 1} needs an id and points array.` }
      }
      const parsedPoints: DataPoint[] = []
      for (const [pointIndex, point] of item.points.entries()) {
        if (!isRecord(point) || (typeof point.x !== 'number' && typeof point.x !== 'string')) {
          return { data: null, error: `Series ${seriesIndex + 1}, point ${pointIndex + 1} needs numeric x or an ISO date string.` }
        }
        const parsedX = typeof point.x === 'number'
          ? point.x
          : Number.isFinite(Number(point.x))
            ? Number(point.x)
            : new Date(point.x)
        if (typeof parsedX === 'number' && !Number.isFinite(parsedX)) {
          return { data: null, error: `Series ${seriesIndex + 1}, point ${pointIndex + 1} has an invalid x value.` }
        }
        if (parsedX instanceof Date && !Number.isFinite(parsedX.getTime())) {
          return { data: null, error: `Series ${seriesIndex + 1}, point ${pointIndex + 1} has an invalid date.` }
        }
        const y = point.y === null ? null : asFiniteNumber(point.y)
        if (point.y !== null && y === null) {
          return { data: null, error: `Series ${seriesIndex + 1}, point ${pointIndex + 1} needs numeric y or null.` }
        }
        parsedPoints.push({
          x: parsedX,
          y,
          ...(typeof point.category === 'string' ? { category: point.category } : {}),
        })
      }
      data.push({
        id: item.id,
        ...(typeof item.label === 'string' ? { label: item.label } : {}),
        ...(typeof item.unit === 'string' ? { unit: item.unit } : {}),
        ...(asFiniteNumber(item.target) !== null ? { target: asFiniteNumber(item.target) } : {}),
        ...(item.status === 'positive' || item.status === 'negative' || item.status === 'neutral' || item.status === 'warning' || item.status === 'critical'
          ? { status: item.status }
          : {}),
        points: parsedPoints,
      })
    }
    return { data, error: null }
  } catch {
    return { data: null, error: 'Data JSON is not valid yet.' }
  }
}

function parseObject(text: string): { readonly value: Record<string, unknown> | null; readonly error: string | null } {
  if (text.trim() === '') return { value: {}, error: null }
  try {
    const parsed: unknown = JSON.parse(text)
    return isRecord(parsed)
      ? { value: parsed, error: null }
      : { value: null, error: 'JSON must be an object.' }
  } catch {
    return { value: null, error: 'JSON is not valid yet.' }
  }
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function normalizePolicy(value: Record<string, unknown>): PlanPolicy {
  const facetColumns = isRecord(value.facetColumnsByAspect) ? value.facetColumnsByAspect : {}
  return {
    ...DEFAULT_POLICY,
    ...value,
    facetColumnsByAspect: {
      ...DEFAULT_POLICY.facetColumnsByAspect,
      ...facetColumns,
    },
  } as PlanPolicy
}

function tokenGroup(name: string): string {
  if (name.startsWith('series-') || name.startsWith('ramp-') || name.includes('color')) return 'Colour'
  if (name.startsWith('font-') || name.includes('font') || name.includes('label')) return 'Type'
  if (name.startsWith('grid-') || name.startsWith('axis-') || name.startsWith('tick-')) return 'Axes and guides'
  if (name.startsWith('legend-')) return 'Legend'
  if (name.startsWith('tooltip-') || name.startsWith('crosshair-')) return 'Interaction'
  if (name.startsWith('motion-')) return 'Motion'
  if (name.startsWith('widget-') || name.startsWith('plot-') || name.startsWith('size-')) return 'Surface and spacing'
  return 'Other'
}

function fingerprint(text: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function displayValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : 'resolver default'
}

export function SandboxApp() {
  const initialChartType = chartTypeFromPath(typeof window === 'undefined' ? '/' : window.location.pathname)
  const [chartType, setChartType] = useState<ChartType>(initialChartType)
  const [isTokenExplorer, setIsTokenExplorer] = useState(() =>
    typeof window !== 'undefined' && isTokenExplorerPath(window.location.pathname),
  )
  const [theme, setTheme] = useState<ShiftChartsTheme>('rail-dark')
  const [width, setWidth] = useState(760)
  const [height, setHeight] = useState(480)
  const [title, setTitle] = useState(() => CHART_PAGE_DETAILS[initialChartType].defaultTitle)
  const [dataText, setDataText] = useState(() => json(DATA_BY_TYPE[initialChartType]))
  const [policy, setPolicy] = useState<PlanPolicy>(DEFAULT_POLICY)
  const [policyText, setPolicyText] = useState(() => json(DEFAULT_POLICY))
  const [policyError, setPolicyError] = useState<string | null>(null)
  const [overrideText, setOverrideText] = useState(() => json(SANDBOX_DEFAULT_OVERRIDES))
  const [overrideError, setOverrideError] = useState<string | null>(null)
  const [tokenOverrides, setTokenOverrides] = useState<Readonly<Record<string, string>>>({})
  const [tokenSearch, setTokenSearch] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [activePointHighlight, setActivePointHighlight] = useState(true)
  const [legendHiddenSeriesIds, setLegendHiddenSeriesIds] = useState<readonly string[]>([])
  const [measuredSnapshot, setMeasuredSnapshot] = useState<MeasuredSnapshot | null>(null)

  const loadChartPage = useCallback((nextType: ChartType, replace = false) => {
    if (typeof window !== 'undefined') {
      if (replace) window.history.replaceState({}, '', chartPagePath(nextType))
      else window.history.pushState({}, '', chartPagePath(nextType))
    }
    setIsTokenExplorer(false)
    setChartType(nextType)
    setTitle(CHART_PAGE_DETAILS[nextType].defaultTitle)
    setDataText(json(DATA_BY_TYPE[nextType]))
    setOverrideText(json(SANDBOX_DEFAULT_OVERRIDES))
    setOverrideError(null)
    setActivePointHighlight(true)
    setLegendHiddenSeriesIds([])
    setMeasuredSnapshot(null)
  }, [])

  const loadTokenExplorer = useCallback(() => {
    if (typeof window !== 'undefined') window.history.pushState({}, '', '/tokens')
    setIsTokenExplorer(true)
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      if (isTokenExplorerPath(window.location.pathname)) {
        setIsTokenExplorer(true)
        return
      }
      loadChartPage(chartTypeFromPath(window.location.pathname), true)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [loadChartPage])

  const parsedData = useMemo(() => parseData(dataText), [dataText])
  const data = parsedData.data ?? DATA_BY_TYPE[chartType]
  const context = useMemo(() => sizeContextFromPixels(width, height), [height, width])
  const parsedOverrides = useMemo(() => parseObject(overrideText), [overrideText])
  const requestSignature = useMemo(
    () => fingerprint(json({ chartType, width, height, title, data, policy, overrides: parsedOverrides.value ?? {} })),
    [chartType, data, height, parsedOverrides.value, policy, title, width],
  )

  const handleResolvedPlan = useCallback((plan: ChartPlan, size: { readonly width: number; readonly height: number }) => {
    setMeasuredSnapshot({ signature: requestSignature, plan, width: size.width, height: size.height })
  }, [requestSignature])

  const resolved = useMemo((): { readonly plan: ChartPlan | null; readonly error: string | null } => {
    if (parsedData.error !== null) return { plan: null, error: parsedData.error }
    if (parsedOverrides.error !== null) return { plan: null, error: parsedOverrides.error }
    try {
      return {
        plan: planChart(
          chartType,
          context,
          describeShape(data),
          policy,
          parsedOverrides.value as PlanOverrides | undefined,
        ),
        error: null,
      }
    } catch (error) {
      return { plan: null, error: error instanceof Error ? error.message : 'The plan could not be resolved.' }
    }
  }, [chartType, context, data, parsedData.error, parsedOverrides, policy])

  const currentSnapshot = measuredSnapshot?.signature === requestSignature ? measuredSnapshot : null
  const displayPlan = currentSnapshot?.plan ?? resolved.plan
  const planJson = displayPlan === null ? '{}' : json(displayPlan)
  const configJson = json({
    chartType,
    size: { width, height },
    title,
    data,
    policy,
    overrides: parsedOverrides.value ?? {},
    tokenOverrides,
    activePointHighlight,
  })
  const cssOutput = Object.entries(tokenOverrides)
    .map(([name, value]) => `  --shiftcharts-${name}: ${value};`)
    .join('\n')
  const tokenGroups = useMemo(() => {
    const groups = new Map<string, readonly string[]>()
    for (const name of SHIFTCHARTS_TOKENS) {
      const group = tokenGroup(name)
      const existing = groups.get(group) ?? []
      groups.set(group, [...existing, name])
    }
    return groups
  }, [])

  const updatePolicy = (next: PlanPolicy) => {
    setPolicy(next)
    setPolicyText(json(next))
    setPolicyError(null)
  }

  const updatePolicyNumber = (key: NumericPolicyKey, value: number) => {
    updatePolicy({ ...policy, [key]: value })
  }

  const updateFacetColumns = (aspect: (typeof ASPECTS)[number], value: number) => {
    updatePolicy({
      ...policy,
      facetColumnsByAspect: { ...policy.facetColumnsByAspect, [aspect]: value },
    })
  }

  const updatePolicyText = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextText = event.target.value
    setPolicyText(nextText)
    const parsed = parseObject(nextText)
    if (parsed.error !== null || parsed.value === null) {
      setPolicyError(parsed.error)
      return
    }
    updatePolicy(normalizePolicy(parsed.value))
  }

  const updateOverride = (next: Record<string, unknown>) => {
    setOverrideText(json(next))
    setOverrideError(null)
  }

  const updateNestedOverride = (section: string, key: string, value: unknown) => {
    const base = parsedOverrides.value ?? {}
    const currentSection = isRecord(base[section]) ? base[section] : {}
    updateOverride({ ...base, [section]: { ...currentSection, [key]: value } })
  }

  const removeNestedOverride = (section: string, key: string) => {
    const base = parsedOverrides.value ?? {}
    const currentSection = isRecord(base[section]) ? { ...base[section] } : {}
    delete currentSection[key]
    const next = { ...base }
    if (Object.keys(currentSection).length === 0) delete next[section]
    else next[section] = currentSection
    updateOverride(next)
  }

  const updateTooltipOverride = (key: string, value: unknown) => {
    const base = parsedOverrides.value ?? {}
    const interaction = isRecord(base.interaction) ? base.interaction : {}
    const tooltip = isRecord(interaction.tooltip) ? interaction.tooltip : {}
    updateOverride({
      ...base,
      interaction: { ...interaction, tooltip: { ...tooltip, [key]: value } },
    })
  }

  const removeTooltipOverride = (key: string) => {
    const base = parsedOverrides.value ?? {}
    const interaction = isRecord(base.interaction) ? { ...base.interaction } : {}
    const tooltip = isRecord(interaction.tooltip) ? { ...interaction.tooltip } : {}
    delete tooltip[key]
    if (Object.keys(tooltip).length === 0) delete interaction.tooltip
    else interaction.tooltip = tooltip
    const next = { ...base }
    if (Object.keys(interaction).length === 0) delete next.interaction
    else next.interaction = interaction
    updateOverride(next)
  }

  const updateOverrideText = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextText = event.target.value
    setOverrideText(nextText)
    const parsed = parseObject(nextText)
    setOverrideError(parsed.error)
  }

  const updateToken = (name: string, value: string) => {
    setTokenOverrides((current) => {
      const next = { ...current }
      if (value.trim() === '') delete next[name]
      else next[name] = value
      return next
    })
  }

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(null), 1400)
    } catch {
      setCopied(null)
    }
  }

  const reset = () => {
    loadChartPage('line', true)
    setTheme('rail-dark')
    setWidth(760)
    setHeight(480)
    updatePolicy(DEFAULT_POLICY)
    setTokenOverrides({})
    setTokenSearch('')
  }

  const pageDetails = CHART_PAGE_DETAILS[chartType]

  const setLegendVisibility = useCallback((seriesId: string, visible: boolean) => {
    setLegendHiddenSeriesIds((current) => {
      const next = new Set(current)
      if (visible) next.delete(seriesId)
      else next.add(seriesId)
      return [...next]
    })
  }, [])

  const selectedSize = SIZE_PRESETS.find((preset) => preset.width === width && preset.height === height)?.id
  const overrideObject = parsedOverrides.value ?? {}
  const narrativeOverride = isRecord(overrideObject.narrative) ? overrideObject.narrative : {}
  const labelsOverride = isRecord(overrideObject.labels) ? overrideObject.labels : {}
  const legendOverride = isRecord(overrideObject.legend) ? overrideObject.legend : {}
  const interactionOverride = isRecord(overrideObject.interaction) ? overrideObject.interaction : {}
  const tooltipOverride = isRecord(interactionOverride.tooltip) ? interactionOverride.tooltip : {}
  const axesOverride = isRecord(overrideObject.axes) ? overrideObject.axes : {}
  const xAxisOverride = isRecord(axesOverride.x) ? axesOverride.x : {}
  const yAxisOverride = isRecord(axesOverride.y) ? axesOverride.y : {}
  const tableOverride = isRecord(overrideObject.dataTable) ? overrideObject.dataTable : {}
  const geometryFrame = useMemo(() => {
    if (currentSnapshot === null || displayPlan === null || parsedData.error !== null) return null
    try {
      return resolveFrame(
        displayPlan,
        data,
        sizeContextFromPixels(currentSnapshot.width, currentSnapshot.height),
        policy,
      )
    } catch {
      return null
    }
  }, [currentSnapshot, data, displayPlan, parsedData.error, policy])
  const geometryJson = json({
    page: chartPagePath(chartType),
    scope: 'standalone measured pixels; React-grid placement deferred',
    measuredContentBox: currentSnapshot === null
      ? null
      : { width: currentSnapshot.width, height: currentSnapshot.height },
    svgViewBox: currentSnapshot === null ? null : `0 0 ${currentSnapshot.width} ${currentSnapshot.height}`,
    frameBox: geometryFrame === null ? null : geometryFrame.box,
    plotBox: geometryFrame === null ? null : geometryFrame.plot,
    legend: displayPlan?.legend ?? null,
  })

  if (isTokenExplorer) {
    return <TokenExplorer theme={theme} onThemeChange={setTheme} onOpenChart={() => loadChartPage('line')} />
  }

  return (
    <main
      className={`sandbox shiftcharts-theme-${theme}`}
      data-shiftcharts-theme={theme}
      style={Object.fromEntries(
        Object.entries(tokenOverrides).map(([name, value]) => [toCustomProperty(name as ShiftChartsTokenName), value]),
      ) as CSSProperties}
    >
      <nav className="sandbox__family-nav" aria-label="Chart family pages">
        <div className="sandbox__family-nav-intro">
          <p className="sandbox__section-label">Chart family pages</p>
          <strong>Geometry first · grid later</strong>
        </div>
        <div className="sandbox__family-links">
          <a href="/tokens" onClick={(event) => { event.preventDefault(); loadTokenExplorer() }}>Tokens</a>
          {CHART_TYPES.map((type) => (
            <a
              key={type}
              href={chartPagePath(type)}
              aria-current={type === chartType ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault()
                loadChartPage(type)
              }}
            >
              {CHART_PAGE_DETAILS[type].label}
            </a>
          ))}
        </div>
      </nav>
      <header className="sandbox__header">
        <div>
          <p className="sandbox__eyebrow">ShiftCharts / {pageDetails.label} page</p>
          <h1>{pageDetails.label} geometry.<br /><em>Measure it before we place it.</em></h1>
          <p className="sandbox__lede">
            {pageDetails.description} Every plan below is resolved by <code>@shiftcharts/core</code>;
            React-grid placement follows in a later pass.
          </p>
        </div>
        <div className="sandbox__header-actions">
          <span className="sandbox__status" role="status" aria-live="polite">
            <span className="sandbox__status-dot" aria-hidden="true" />
            {resolved.plan === null ? 'Plan needs attention' : currentSnapshot === null ? 'Core plan live · measuring' : 'Core plan live'}
          </span>
          <button type="button" className="sandbox__button sandbox__button--quiet" onClick={reset}>Reset sandbox</button>
        </div>
      </header>

      <div className="sandbox__layout">
        <section className="sandbox__preview-panel" aria-labelledby="sandbox-preview-title">
          <div className="sandbox__section-heading">
            <div>
              <p className="sandbox__section-label">Live preview</p>
              <h2 id="sandbox-preview-title">The {pageDetails.label} is the source of truth</h2>
            </div>
            <span className="sandbox__fingerprint">{fingerprint(planJson)}</span>
          </div>

          {(chartType === 'bar' || chartType === 'timebar') ? (
            <div className="sandbox__bar-toolbar" role="group" aria-label="Bar orientation">
              <span>Bar orientation</span>
              {(['vertical', 'horizontal'] as const).map((orientation) => (
                <button
                  type="button"
                  key={orientation}
                  aria-pressed={displayPlan?.orientation === orientation}
                  onClick={() => updateOverride({
                    ...overrideObject,
                    orientation,
                    legend: { placement: 'external', position: 'right', maxEntries: 8, showValues: false, showPercent: false },
                  })}
                >
                  {orientation}
                </button>
              ))}
            </div>
          ) : null}

          <div className="sandbox__preview-wrap">
            <div
              className="sandbox__chart-frame"
              style={{ inlineSize: `min(${width}px, 100%)`, blockSize: `${height}px` }}
            >
              {resolved.plan === null ? (
                <div className="sandbox__preview-error" role="alert">{resolved.error}</div>
              ) : (
                <AutoChart
                  type={chartType}
                  data={data}
                  title={title}
                  description="A measured ShiftCharts sandbox preview generated from the current design controls."
                  policy={policy}
                  overrides={parsedOverrides.value as PlanOverrides | undefined}
                  onResolvedPlan={handleResolvedPlan}
                  activePointHighlight={activePointHighlight}
                  id="sandbox-chart"
                />
              )}
            </div>
          </div>

          <div className="sandbox__preview-meta" aria-label="Resolved chart summary">
            <span><small>Chart</small><strong>{chartType}</strong></span>
            <span><small>Size class</small><strong>{displayPlan?.sizeClass ?? '—'}</strong></span>
            <span><small>Mark</small><strong>{displayPlan?.marks.primary.kind ?? '—'}</strong></span>
            <span><small>Value</small><strong>{displayPlan?.narrative.valueDisplay ?? '—'}</strong></span>
            <span><small>Legend</small><strong>{displayPlan?.legend.placement ?? '—'}</strong></span>
            <span><small>Measured box</small><strong>{currentSnapshot === null ? 'waiting' : `${Math.round(currentSnapshot.width)} × ${Math.round(currentSnapshot.height)}`}</strong></span>
          </div>

          <section className="sandbox__geometry-study" aria-labelledby="sandbox-geometry-study-title">
            <div className="sandbox__geometry-heading">
              <div>
                <p className="sandbox__section-label">Geometry inspector</p>
                <h3 id="sandbox-geometry-study-title">{pageDetails.geometryFocus}</h3>
              </div>
              <span className="sandbox__geometry-route">{chartPagePath(chartType)}</span>
            </div>
            <div className="sandbox__geometry-grid">
              <GeometryMetric label="Measured content" value={currentSnapshot === null ? 'waiting' : `${Math.round(currentSnapshot.width)} × ${Math.round(currentSnapshot.height)} px`} />
              <GeometryMetric label="SVG viewBox" value={currentSnapshot === null ? 'waiting' : `0 0 ${Math.round(currentSnapshot.width)} ${Math.round(currentSnapshot.height)}`} />
              <GeometryMetric label="Plot box" value={geometryFrame === null ? 'waiting' : `${Math.round(geometryFrame.plot.width)} × ${Math.round(geometryFrame.plot.height)} px`} />
              <GeometryMetric label="Legend mode" value={displayPlan?.legend.placement ?? 'waiting'} />
            </div>
            <pre className="sandbox__geometry-output" aria-label="Measured chart geometry JSON">{geometryJson}</pre>
            <p className="sandbox__help">This page records standalone pixel geometry only. The later grid pass will supply widget placement and cell constraints without changing this chart geometry contract.</p>
          </section>

          <section className="sandbox__legend-study" aria-labelledby="sandbox-legend-study-title">
            <div>
              <p className="sandbox__section-label">Controlled legend study</p>
              <h3 id="sandbox-legend-study-title">Visibility state stays with the consumer</h3>
              <p className="sandbox__help">Toggle a series to exercise the shipped `LegendControl` contract. The parent owns the state so it can later connect to filtering without changing the chart renderer.</p>
            </div>
            <LegendControl
              plan={LEGEND_STUDY_PLAN}
              series={LEGEND_STUDY_DATA}
              hiddenSeriesIds={legendHiddenSeriesIds}
              onVisibilityChange={setLegendVisibility}
            />
            <output className="sandbox__legend-state" aria-live="polite">
              hidden: {legendHiddenSeriesIds.length === 0 ? 'none' : legendHiddenSeriesIds.join(', ')}
            </output>
          </section>

          <div className="sandbox__output-bar">
            <span>Copy a working snapshot when a direction feels right.</span>
            <div className="sandbox__output-actions">
              <CopyButton label="config" copied={copied} onCopy={() => copy('config', configJson)}>Copy config</CopyButton>
              <CopyButton label="plan" copied={copied} onCopy={() => copy('plan', planJson)}>Copy plan</CopyButton>
              <CopyButton label="css" copied={copied} onCopy={() => copy('css', cssOutput || '/* No token overrides yet. */')}>Copy CSS</CopyButton>
            </div>
          </div>
        </section>

        <aside className="sandbox__controls" aria-label="ShiftCharts design controls">
          <section className="sandbox__control-section">
            <SectionTitle eyebrow="01 / composition" title="Chart and canvas" />
            <label className="sandbox__field">
              <span>Chart type</span>
              <select aria-label="Chart type" value={chartType} onChange={(event) => loadChartPage(event.target.value as ChartType)}>
                {CHART_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="sandbox__field">
              <span>Chart title</span>
              <input aria-label="Chart title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <div className="sandbox__field">
              <span>Size preset</span>
              <div className="sandbox__segmented" role="group" aria-label="Chart size preset">
                {SIZE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={selectedSize === preset.id ? 'is-active' : ''}
                    aria-pressed={selectedSize === preset.id}
                    onClick={() => { setWidth(preset.width); setHeight(preset.height) }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="sandbox__field-grid">
              <label className="sandbox__field"><span>Width <small>px</small></span><input aria-label="Width px" type="number" min="100" max="1200" value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label>
              <label className="sandbox__field"><span>Height <small>px</small></span><input aria-label="Height px" type="number" min="80" max="800" value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label>
            </div>
            <label className="sandbox__field">
              <span>Theme</span>
              <select aria-label="Theme" value={theme} onChange={(event) => setTheme(event.target.value as ShiftChartsTheme)}>
                {SHIFTCHARTS_THEMES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </section>

          <section className="sandbox__control-section">
            <SectionTitle eyebrow="02 / information" title="What the chart says" />
            <div className="sandbox__quick-grid">
              <OverrideSelect
                label="Value display"
                value={displayValue(narrativeOverride.valueDisplay)}
                options={['resolver default', 'none', 'latest', 'latest+delta']}
                onChange={(value) => value === 'resolver default' ? removeNestedOverride('narrative', 'valueDisplay') : updateNestedOverride('narrative', 'valueDisplay', value)}
              />
              <OverrideSelect
                label="Value labels"
                value={displayValue(labelsOverride.valueLabels)}
                options={['resolver default', 'none', 'all', 'extrema']}
                onChange={(value) => value === 'resolver default' ? removeNestedOverride('labels', 'valueLabels') : updateNestedOverride('labels', 'valueLabels', value)}
              />
              <OverrideSelect
                label="Series labels"
                value={displayValue(labelsOverride.seriesLabels)}
                options={['resolver default', 'none', 'direct-end']}
                onChange={(value) => value === 'resolver default' ? removeNestedOverride('labels', 'seriesLabels') : updateNestedOverride('labels', 'seriesLabels', value)}
              />
              <OverrideSelect
                label="Axis label mode"
                value={displayValue(labelsOverride.axisLabelDegrade)}
                options={['resolver default', 'none', 'abbreviate', 'split', 'rotate', 'axis-transpose']}
                onChange={(value) => value === 'resolver default' ? removeNestedOverride('labels', 'axisLabelDegrade') : updateNestedOverride('labels', 'axisLabelDegrade', value)}
              />
              <OverrideSelect
                label="Legend placement"
                value={displayValue(legendOverride.placement)}
                options={['resolver default', 'absent', 'direct', 'internal', 'external']}
                onChange={(value) => {
                  if (value === 'resolver default') removeNestedOverride('legend', 'placement')
                  else if (value === 'external') updateOverride({ ...overrideObject, legend: { placement: 'external', position: 'right', maxEntries: 8, showValues: false, showPercent: false } })
                  else if (value === 'internal') updateOverride({ ...overrideObject, legend: { placement: 'internal', maxEntries: 8, flow: 'reserved' } })
                  else if (value === 'direct') updateOverride({ ...overrideObject, legend: { placement: 'direct' } })
                  else updateOverride({ ...overrideObject, legend: { placement: 'absent' } })
                }}
              />
              <OverrideSelect
                label="Data table"
                value={tableOverride.present === undefined ? 'resolver default' : tableOverride.present ? 'on' : 'off'}
                options={['resolver default', 'on', 'off']}
                onChange={(value) => value === 'resolver default' ? removeNestedOverride('dataTable', 'present') : updateNestedOverride('dataTable', 'present', value === 'on')}
              />
            </div>
            <div className="sandbox__toggle-row">
              <ToggleOverride label="X gridlines" value={xAxisOverride.gridlines} onChange={(value) => value === null ? removeNestedOverride('axes', 'x') : updateNestedOverride('axes', 'x', { ...xAxisOverride, gridlines: value })} />
              <ToggleOverride label="Y gridlines" value={yAxisOverride.gridlines} onChange={(value) => value === null ? removeNestedOverride('axes', 'y') : updateNestedOverride('axes', 'y', { ...yAxisOverride, gridlines: value })} />
            </div>
            <p className="sandbox__help">Quick controls write the same serialisable `PlanOverrides` object shown below. Use the JSON editor for any field not promoted into a quick control.</p>
          </section>

          <section className="sandbox__control-section">
            <SectionTitle eyebrow="03 / interaction" title="Tooltip and focus" />
            <div className="sandbox__quick-grid">
              <OverrideSelect
                label="Interaction trigger"
                value={displayValue(interactionOverride.trigger)}
                options={['resolver default', 'none', 'hover', 'tap']}
                onChange={(value) => value === 'resolver default' ? removeNestedOverride('interaction', 'trigger') : updateNestedOverride('interaction', 'trigger', value)}
              />
              <OverrideSelect
                label="Tooltip placement"
                value={displayValue(tooltipOverride.placement)}
                options={['resolver default', 'fix', 'fluid']}
                onChange={(value) => value === 'resolver default' ? removeTooltipOverride('placement') : updateTooltipOverride('placement', value)}
              />
            </div>
            <div className="sandbox__toggle-row">
              <ToggleOverride label="Tooltip" value={tooltipOverride.enabled} onChange={(value) => value === null ? removeTooltipOverride('enabled') : updateTooltipOverride('enabled', value)} />
              <ToggleOverride label="Crosshair" value={interactionOverride.crosshair} onChange={(value) => value === null ? removeNestedOverride('interaction', 'crosshair') : updateNestedOverride('interaction', 'crosshair', value)} />
              <ToggleOverride label="Legend controls" value={interactionOverride.legendToggle} onChange={(value) => value === null ? removeNestedOverride('interaction', 'legendToggle') : updateNestedOverride('interaction', 'legendToggle', value)} />
              <ToggleOverride label="Active points" value={activePointHighlight} onChange={(value) => { if (value !== null) setActivePointHighlight(value) }} />
            </div>
            <p className="sandbox__help">Hover, tap, and keyboard focus share one tooltip surface. Use Tab, Enter, Arrow keys, Home, End, and Escape to inspect the accessible interaction path.</p>
          </section>

          <section className="sandbox__control-section">
            <SectionTitle eyebrow="04 / resolver" title="Every policy input" />
            <p className="sandbox__help">Policy changes what the resolver decides. The ranges are editing aids; the full JSON remains the authority for typography, facet maps, and future fields.</p>
            <div className="sandbox__policy-fields">
              {POLICY_NUMBER_FIELDS.map((field) => (
                <label className="sandbox__range" key={field.key}>
                  <span><b>{field.label}</b><output>{policy[field.key]}{field.unit === undefined ? '' : ` ${field.unit}`}</output></span>
                  <input aria-label={field.label} type="range" min={field.min} max={field.max} step={field.step} value={policy[field.key]} onChange={(event) => updatePolicyNumber(field.key, Number(event.target.value))} />
                </label>
              ))}
            </div>
            <div className="sandbox__field-grid">
              <label className="sandbox__field"><span>Horizon bands</span><select aria-label="Horizon bands" value={policy.horizonMaxBands} onChange={(event) => updatePolicy({ ...policy, horizonMaxBands: Number(event.target.value) as 1 | 2 | 3 })}><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label>
              <label className="sandbox__field"><span>Substitute marks</span><select aria-label="Substitute marks" value={String(policy.substitute)} onChange={(event) => updatePolicy({ ...policy, substitute: event.target.value === 'true' })}><option value="true">allowed</option><option value="false">locked</option></select></label>
            </div>
            <div className="sandbox__field-grid sandbox__field-grid--four">
              {ASPECTS.map((aspect) => <label className="sandbox__field" key={aspect}><span>{aspect} facets</span><input aria-label={`${aspect} facets`} type="number" min="1" max="6" value={policy.facetColumnsByAspect[aspect]} onChange={(event) => updateFacetColumns(aspect, Number(event.target.value))} /></label>)}
            </div>
            <label className="sandbox__field"><span>Policy JSON</span><textarea aria-label="Policy JSON" className="sandbox__code" value={policyText} onChange={updatePolicyText} spellCheck={false} /></label>
            {policyError === null ? null : <p className="sandbox__error" role="alert">{policyError}</p>}
          </section>

          <section className="sandbox__control-section">
            <SectionTitle eyebrow="05 / visual system" title="CSS token overrides" />
            <p className="sandbox__help">Overrides are scoped to this sandbox root, so you can change every exposed `--shiftcharts-*` value without changing the package theme or the existing app.</p>
            <label className="sandbox__field"><span>Find a token</span><input aria-label="Find a token" value={tokenSearch} onChange={(event) => setTokenSearch(event.target.value)} placeholder="series, grid, radius…" /></label>
            <div className="sandbox__token-groups">
              {[...tokenGroups.entries()].map(([group, names]) => {
                const visible = names.filter((name) => name.includes(tokenSearch.toLowerCase()))
                if (visible.length === 0) return null
                return (
                  <details key={group} open={tokenSearch.trim() !== '' || group === 'Colour'}>
                    <summary>{group}<span>{visible.length}</span></summary>
                    <div className="sandbox__token-list">
                      {visible.map((name) => {
                        const property = toCustomProperty(name as ShiftChartsTokenName)
                        const value = tokenOverrides[name] ?? ''
                        const swatch = name.includes('color') || name.startsWith('series-') || name.startsWith('ramp-')
                        return (
                          <label className="sandbox__token" key={name}>
                            {swatch ? <span className="sandbox__swatch" style={{ background: `var(${property})` }} aria-hidden="true" /> : null}
                            <span className="sandbox__token-name">{name}</span>
                            <input aria-label={name} value={value} placeholder="inherit" onChange={(event) => updateToken(name, event.target.value)} />
                            {value === '' ? null : <button type="button" aria-label={`Reset ${name}`} onClick={() => updateToken(name, '')}>×</button>}
                          </label>
                        )
                      })}
                    </div>
                  </details>
                )
              })}
            </div>
          </section>

          <section className="sandbox__control-section">
            <SectionTitle eyebrow="06 / source data" title="Data and raw overrides" />
            <div className="sandbox__data-toolbar">
              <button type="button" className="sandbox__button" onClick={() => setDataText(json(DATA_BY_TYPE[chartType]))}>Use {chartType} sample</button>
              <span>{parsedData.error === null ? `${data.length} series · ${describeShape(data).points} points` : 'Using the last valid sample while editing'}</span>
            </div>
            <label className="sandbox__field"><span>Series JSON</span><textarea aria-label="Series JSON" className="sandbox__code sandbox__code--data" value={dataText} onChange={(event) => setDataText(event.target.value)} spellCheck={false} /></label>
            {parsedData.error === null ? null : <p className="sandbox__error" role="alert">{parsedData.error}</p>}
            <label className="sandbox__field"><span>Plan overrides JSON</span><textarea aria-label="Plan overrides JSON" className="sandbox__code sandbox__code--data" value={overrideText} onChange={updateOverrideText} spellCheck={false} /></label>
            {overrideError === null ? null : <p className="sandbox__error" role="alert">{overrideError}</p>}
            <pre className="sandbox__plan-output" aria-label="Resolved ChartPlan JSON">{planJson}</pre>
          </section>
        </aside>
      </div>
    </main>
  )
}

function tokenPurpose(token: Token, group: string): string {
  const label = token.name.replaceAll('-', ' ')
  if (token.name.startsWith('series-')) return 'Assigns one stable data-series identity colour.'
  if (token.name.startsWith('ramp-')) return 'Defines one step in the shared neutral or sequential colour ramp.'
  if (token.name.endsWith('-color')) return `Sets the colour used for ${label.replace(/ color$/, '')}.`
  if (token.name.includes('font-') || token.name.includes('letter-spacing')) return `Controls the typography used for ${label.replace(/ font /, ' ')}.`
  if (token.name.includes('radius')) return `Sets the corner treatment for ${label.replace(/ radius$/, '')}.`
  if (token.name.includes('shadow')) return `Sets the elevation treatment for ${label.replace(/ shadow$/, '')}.`
  if (token.name.startsWith('motion-')) return `Controls the timing or movement behaviour for ${label.replace(/^motion /, '')}.`
  if (token.name.startsWith('legend-')) return `Controls the legend's ${label.replace(/^legend /, '')}.`
  if (token.name.startsWith('tooltip-') || token.name.startsWith('crosshair-')) return `Controls the interaction-layer ${label.replace(/^(tooltip|crosshair) /, '')}.`
  if (token.name.startsWith('axis-') || token.name.startsWith('grid-') || token.name.startsWith('tick-')) return `Controls axis or guide ${label.replace(/^(axis|grid|tick) /, '')}.`
  return `Controls ${label} in the ${group.toLowerCase()} system.`
}

function TokenExplorer({
  theme,
  onThemeChange,
  onOpenChart,
}: {
  readonly theme: ShiftChartsTheme
  readonly onThemeChange: (theme: ShiftChartsTheme) => void
  readonly onOpenChart: () => void
}) {
  const rootRef = useRef<HTMLElement>(null)
  const [query, setQuery] = useState('')
  const [activeGroup, setActiveGroup] = useState('All groups')
  const [copied, setCopied] = useState<string | null>(null)
  const [computedValues, setComputedValues] = useState<Readonly<Record<string, string>>>({})
  const tokenCount = TOKEN_GROUPS.reduce((total, group) => total + group.tokens.length, 0)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const root = rootRef.current
      if (root === null) return
      const styles = window.getComputedStyle(root)
      setComputedValues(Object.fromEntries(
        TOKEN_GROUPS.flatMap((group) => group.tokens.map((token) => [token.name, styles.getPropertyValue(`--shiftcharts-${token.name}`).trim()])),
      ))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [theme])

  const visibleGroups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return TOKEN_GROUPS.flatMap((group) => {
      if (activeGroup !== 'All groups' && activeGroup !== group.title) return []
      const tokens = group.tokens.filter((token) => {
        const searchable = [token.name, token.value, token.source, token.note, token.aside, tokenPurpose(token, group.title)]
          .filter((value): value is string => value !== undefined)
          .join(' ')
          .toLowerCase()
        return needle === '' || searchable.includes(needle)
      })
      return tokens.length === 0 ? [] : [{ ...group, tokens }]
    })
  }, [activeGroup, query])

  const copy = async (name: string) => {
    try {
      await navigator.clipboard.writeText(`var(--shiftcharts-${name})`)
      setCopied(name)
      window.setTimeout(() => setCopied(null), 1400)
    } catch {
      setCopied(null)
    }
  }

  const visibleTokenCount = visibleGroups.reduce((total, group) => total + group.tokens.length, 0)

  return (
    <main ref={rootRef} className={`sandbox sandbox--tokens shiftcharts-theme-${theme}`} data-shiftcharts-theme={theme}>
      <nav className="sandbox__family-nav" aria-label="Sandbox pages">
        <div className="sandbox__family-nav-intro"><strong>ShiftCharts sandbox</strong></div>
        <div className="sandbox__family-links"><a href="/charts/line" onClick={(event) => { event.preventDefault(); onOpenChart() }}>Chart studio</a><a href="/tokens" aria-current="page">Tokens</a></div>
      </nav>

      <header className="sandbox__token-header">
        <div>
          <h1>Every visual control.<br /><em>Named before you need it.</em></h1>
          <p>Browse the complete shipped CSS token system. Each entry shows the custom property, the live theme value, its purpose, and the evidence behind it.</p>
        </div>
        <dl className="sandbox__token-summary" aria-label="Token explorer summary"><div><dt>Shipped tokens</dt><dd>{tokenCount}</dd></div><div><dt>Visible now</dt><dd>{visibleTokenCount}</dd></div><div><dt>Theme</dt><dd>{theme}</dd></div></dl>
      </header>

      <section className="sandbox__token-toolbar" aria-label="Token filters">
        <label className="sandbox__token-search"><span>Search tokens</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="colour, tooltip, spacing, source…" /></label>
        <label className="sandbox__token-filter"><span>Group</span><select value={activeGroup} onChange={(event) => setActiveGroup(event.target.value)}><option>All groups</option>{TOKEN_GROUPS.map((group) => <option key={group.title}>{group.title}</option>)}</select></label>
        <label className="sandbox__token-filter"><span>Theme preview</span><select value={theme} onChange={(event) => onThemeChange(event.target.value as ShiftChartsTheme)}>{SHIFTCHARTS_THEMES.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
      </section>

      <section className="sandbox__token-catalogue" aria-live="polite">
        {visibleGroups.length === 0 ? <p className="sandbox__token-empty">No token matches “{query}”. Try a token name, a group, or a source term.</p> : visibleGroups.map((group) => (
          <section className="sandbox__token-group" key={group.title} aria-labelledby={`token-group-${group.title}`}>
            <header><div><h2 id={`token-group-${group.title}`}>{group.title}</h2>{group.note === undefined ? null : <p>{group.note}</p>}</div><span>{group.tokens.length} tokens</span></header>
            <div className="sandbox__token-cards">
              {group.tokens.map((token) => {
                const property = `--shiftcharts-${token.name}`
                const currentValue = computedValues[token.name] || token.value
                const swatch = token.name.includes('color') || token.name.startsWith('series-') || token.name.startsWith('ramp-')
                return <article className="sandbox__token-card" key={token.name}>
                  <div className="sandbox__token-card-head">{swatch ? <span className="sandbox__token-card-swatch" style={{ background: `var(${property})` }} aria-hidden="true" /> : null}<code>{property}</code><span className={`sandbox__token-tier sandbox__token-tier--${token.tier}`}>{token.tier}</span></div>
                  <p className="sandbox__token-purpose">{tokenPurpose(token, group.title)}</p>
                  <dl><div><dt>Live value</dt><dd><code>{currentValue}</code></dd></div><div><dt>Source value</dt><dd><code>{token.value}</code></dd></div><div><dt>Evidence</dt><dd>{token.source}</dd></div>{token.aside === undefined ? null : <div><dt>Detail</dt><dd>{token.aside}</dd></div>}</dl>
                  {token.note === undefined ? null : <details className="sandbox__token-note"><summary>Why this exists</summary><p>{token.note}</p></details>}
                  <button type="button" className="sandbox__button sandbox__button--quiet" onClick={() => copy(token.name)}>{copied === token.name ? 'Copied CSS reference' : 'Copy var() reference'}</button>
                </article>
              })}
            </div>
          </section>
        ))}
      </section>
    </main>
  )
}

function SectionTitle({ eyebrow, title }: { readonly eyebrow: string; readonly title: string }) {
  return <div className="sandbox__section-title"><p className="sandbox__section-label">{eyebrow}</p><h2>{title}</h2></div>
}

function OverrideSelect({ label, value, options, onChange }: { readonly label: string; readonly value: string; readonly options: readonly string[]; readonly onChange: (value: string) => void }) {
  return <label className="sandbox__field"><span>{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
}

function GeometryMetric({ label, value }: { readonly label: string; readonly value: string }) {
  return <span className="sandbox__geometry-metric"><small>{label}</small><strong>{value}</strong></span>
}

function ToggleOverride({ label, value, onChange }: { readonly label: string; readonly value: unknown; readonly onChange: (value: boolean | null) => void }) {
  const selected = typeof value === 'boolean' ? value : null
  return <div className="sandbox__toggle"><span>{label}</span><div role="group" aria-label={label}>{(['resolver', 'on', 'off'] as const).map((option) => <button key={option} type="button" className={(selected === null && option === 'resolver') || (selected === true && option === 'on') || (selected === false && option === 'off') ? 'is-active' : ''} aria-pressed={(selected === null && option === 'resolver') || (selected === true && option === 'on') || (selected === false && option === 'off')} onClick={() => onChange(option === 'resolver' ? null : option === 'on')}>{option}</button>)}</div></div>
}

function CopyButton({ label, copied, onCopy, children }: { readonly label: string; readonly copied: string | null; readonly onCopy: () => void; readonly children: string }) {
  return <button type="button" className="sandbox__button" onClick={onCopy}>{copied === label ? 'Copied' : children}</button>
}
