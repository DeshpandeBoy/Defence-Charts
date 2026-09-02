import type { ReactElement } from 'react'
import { useCallback, useMemo, useRef, useState } from 'react'

import type { ChartType, DataPoint, LayoutSnapshot, Series, WidgetLayout, WidgetLayoutInput } from '@shiftcharts/core'
import { AutoChart, useElementSize } from '@shiftcharts/react'
import { MotionBoundary, type MotionPreset } from '@shiftcharts/motion'
import {
  WidgetGrid,
  WidgetShell,
  WidgetStates,
  type WidgetGridMode,
  type WidgetStateKind,
} from '@shiftcharts/grid'
import { SHIFTCHARTS_THEMES, type ShiftChartsTheme } from '@shiftcharts/tokens'

type DashboardPageProps = {
  readonly theme: ShiftChartsTheme
  readonly motionPreset: MotionPreset
  readonly onThemeChange: (theme: ShiftChartsTheme) => void
  readonly onMotionPresetChange: (preset: MotionPreset) => void
  readonly onOpenChart: () => void
  readonly onOpenTokens: () => void
  readonly onOpenInteraction: () => void
  readonly onOpenMotion: () => void
  readonly onOpenPerformance: () => void
}

type DashboardWidget = {
  readonly id: string
  readonly type: ChartType
  readonly title: string
  readonly context: string
  readonly data: readonly Series[]
  readonly layout: WidgetLayoutInput
}

type FootprintVariation = {
  readonly label: string
  readonly cols: number
  readonly rows: number
  readonly width: number
  readonly height: number
  readonly description: string
}

const pointData = (values: readonly (number | null)[], categories?: readonly string[]): readonly DataPoint[] =>
  values.map((y, index) => ({
    x: index,
    y,
    ...(categories?.[index] === undefined ? {} : { category: categories[index] }),
  }))

const temporalData = (values: readonly (number | null)[]): readonly DataPoint[] =>
  values.map((y, index) => ({ x: new Date(Date.UTC(2026, 0, index + 1)), y }))

const dashboardLine: readonly Series[] = [
  { id: 'readiness', label: 'Readiness', points: pointData([42, 46, 44, 52, 57, 55, 61, 68, 66, 74, 78, 82]) },
  { id: 'training', label: 'Training', points: pointData([28, 34, 32, 37, 41, 46, 44, 51, 55, 58, 63, 69]) },
  { id: 'maintenance', label: 'Maintenance', points: pointData([61, 58, 60, 57, null, 53, 50, 49, 45, 43, 46, 41]) },
]

const dashboardArea: readonly Series[] = [
  { id: 'capacity', label: 'Capacity', points: pointData([38, 44, 49, 53, 58, 63, 68, 72, 76, 80]) },
  { id: 'demand', label: 'Demand', points: pointData([24, 28, 34, 42, 45, 51, 57, 61, 67, 74]) },
]

const dashboardWidgets: readonly DashboardWidget[] = [
  {
    id: 'readiness-trend',
    type: 'line',
    title: 'Readiness trend',
    context: '8-week operating view',
    data: dashboardLine,
    layout: { id: 'readiness-trend', x: 0, y: 0, w: 8, h: 4, minW: 6, minH: 3 },
  },
  {
    id: 'program-mix',
    type: 'donut',
    title: 'Program mix',
    context: 'Allocation by workstream',
    data: [{
      id: 'program-mix',
      label: 'Program mix',
      points: pointData([40, 24, 16, 10, 6, 4], ['Personnel', 'Training', 'Maintenance', 'Logistics', 'Medical', 'Other']),
    }],
    layout: { id: 'program-mix', x: 8, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
  },
  {
    id: 'capacity-envelope',
    type: 'area',
    title: 'Capacity envelope',
    context: 'Planned versus demand',
    data: dashboardArea,
    layout: { id: 'capacity-envelope', x: 0, y: 4, w: 6, h: 4, minW: 4, minH: 3 },
  },
  {
    id: 'regional-output',
    type: 'bar',
    title: 'Regional output',
    context: 'Three-unit comparison',
    data: [
      { id: 'north', label: 'North', points: pointData([42, 58, 47, 71, 63, 78]) },
      { id: 'south', label: 'South', points: pointData([35, 48, 55, 61, 57, 69]) },
      { id: 'west', label: 'West', points: pointData([27, 38, 44, 52, 49, 60]) },
    ],
    layout: { id: 'regional-output', x: 6, y: 4, w: 3, h: 4, minW: 3, minH: 3 },
  },
  {
    id: 'deployment-tempo',
    type: 'timebar',
    title: 'Deployment tempo',
    context: 'Daily intervals',
    data: [{ id: 'deployments', label: 'Deployments', points: temporalData([12, 20, 16, 28, 25, 34, 31, 39]) }],
    layout: { id: 'deployment-tempo', x: 9, y: 4, w: 3, h: 4, minW: 3, minH: 3 },
  },
  {
    id: 'signal-density',
    type: 'scatter',
    title: 'Signal density',
    context: 'Two-unit observation field',
    data: [
      { id: 'alpha', label: 'Alpha', points: pointData([12, 18, 16, 23, 28, 31, 34]) },
      { id: 'bravo', label: 'Bravo', points: pointData([7, 11, 15, 14, 21, 24, 27]) },
    ],
    layout: { id: 'signal-density', x: 0, y: 8, w: 4, h: 4, minW: 3, minH: 3 },
  },
  {
    id: 'maintenance-heatmap',
    type: 'heatmap',
    title: 'Maintenance heatmap',
    context: 'Intensity by day',
    data: [
      { id: 'maintenance', label: 'Maintenance', points: temporalData([0, 4, null, 12, -2, 9, 1, 6]) },
      { id: 'inspection', label: 'Inspection', points: temporalData([3, 7, 5, null, 18, 2, 4, 8]) },
    ],
    layout: { id: 'maintenance-heatmap', x: 4, y: 8, w: 4, h: 4, minW: 3, minH: 3 },
  },
  {
    id: 'readiness-pipeline',
    type: 'funnel',
    title: 'Readiness pipeline',
    context: 'Assigned to deployed',
    data: [{
      id: 'readiness-pipeline',
      label: 'Readiness pipeline',
      points: pointData([100, 76, 54, 31, 12], ['Assigned', 'Screened', 'Trained', 'Certified', 'Deployed']),
    }],
    layout: { id: 'readiness-pipeline', x: 8, y: 8, w: 4, h: 4, minW: 3, minH: 3 },
  },
  {
    id: 'readiness-kpi',
    type: 'kpi',
    title: 'Readiness score',
    context: 'Current operating level',
    data: [{ id: 'readiness', label: 'Readiness', unit: '%', target: 80, status: 'positive', points: pointData([82]) }],
    layout: { id: 'readiness-kpi', x: 0, y: 12, w: 2, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 3 },
  },
  {
    id: 'training-progress',
    type: 'progress',
    title: 'Training completion',
    context: 'Target 100%',
    data: [{ id: 'completion', label: 'Completion', unit: '%', target: 100, status: 'positive', points: pointData([74]) }],
    layout: { id: 'training-progress', x: 2, y: 12, w: 2, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 3 },
  },
]

const dashboardWidgetById = new Map(dashboardWidgets.map((widget) => [widget.id, widget]))

const initialDashboardLayout: readonly WidgetLayoutInput[] = dashboardWidgets.map((widget) => widget.layout)

const footprintVariations: readonly FootprintVariation[] = [
  { label: '1 × 1', cols: 1, rows: 1, width: 150, height: 100, description: 'Micro metric' },
  { label: '2 × 1', cols: 2, rows: 1, width: 190, height: 100, description: 'Tile comparison' },
  { label: '2 × 2', cols: 2, rows: 2, width: 190, height: 150, description: 'Compact card' },
  { label: '3 × 1', cols: 3, rows: 1, width: 250, height: 100, description: 'Strip trend' },
  { label: '3 × 3', cols: 3, rows: 3, width: 250, height: 180, description: 'Panel study' },
  { label: '4 × 4', cols: 4, rows: 4, width: 290, height: 220, description: 'Bento feature' },
  { label: '6 × 5', cols: 6, rows: 5, width: 360, height: 260, description: 'Canvas analysis' },
  { label: '9 × 6', cols: 9, rows: 6, width: 440, height: 300, description: 'Stage overview' },
]

const motionModes: readonly { readonly id: MotionPreset; readonly label: string }[] = [
  { id: 'core', label: 'Core CSS' },
  { id: 'cinematic', label: 'Cinematic' },
]

function toLayoutInput(item: WidgetLayout): WidgetLayoutInput {
  return {
    id: item.id,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: item.minW,
    minH: item.minH,
    maxW: item.maxW,
    maxH: item.maxH,
    draggable: item.draggable,
    resizable: item.resizable,
  }
}

function layoutInputs(snapshot: LayoutSnapshot): readonly WidgetLayoutInput[] {
  return snapshot.items.map(toLayoutInput)
}

function DashboardNav({
  onOpenChart,
  onOpenTokens,
  onOpenInteraction,
  onOpenMotion,
  onOpenPerformance,
}: Pick<DashboardPageProps, 'onOpenChart' | 'onOpenTokens' | 'onOpenInteraction' | 'onOpenMotion' | 'onOpenPerformance'>): ReactElement {
  return (
    <nav className="sandbox__family-nav dashboard__nav" aria-label="Sandbox pages">
      <div className="sandbox__family-nav-intro">
        <p className="sandbox__section-label">ShiftCharts sandbox</p>
        <strong>Final product V1 demo</strong>
      </div>
      <div className="sandbox__family-links">
        <a href="/dashboard" aria-current="page">Dashboard</a>
        <a href="/charts/line" onClick={(event) => { event.preventDefault(); onOpenChart() }}>Chart studio</a>
        <a href="/tokens" onClick={(event) => { event.preventDefault(); onOpenTokens() }}>Tokens</a>
        <a href="/interaction" onClick={(event) => { event.preventDefault(); onOpenInteraction() }}>Interaction</a>
        <a href="/motion" onClick={(event) => { event.preventDefault(); onOpenMotion() }}>Motion lab</a>
        <a href="/performance" onClick={(event) => { event.preventDefault(); onOpenPerformance() }}>Performance</a>
      </div>
    </nav>
  )
}

function DashboardWidgetCard({
  widget,
  item,
  motionPreset,
  state,
}: {
  readonly widget: DashboardWidget
  readonly item: WidgetLayout
  readonly motionPreset: MotionPreset
  readonly state: WidgetStateKind | null
}): ReactElement {
  const chart = (
    <div className="dashboard__chart-frame">
      <MotionBoundary preset={motionPreset} quality="auto" debug>
        <AutoChart
          id={`dashboard-${widget.id}`}
          type={widget.type}
          data={widget.data}
          title={widget.title}
          description={`${widget.context}. Dashboard footprint ${item.w} by ${item.h} grid cells.`}
          gridSize={{ cols: item.w, rows: item.h }}
          activePointHighlight
        />
      </MotionBoundary>
    </div>
  )

  return (
    <WidgetShell
      widgetId={widget.id}
      title={widget.title}
      context={`${item.w} × ${item.h} · ${widget.context}`}
      actions={<span className="dashboard__widget-kind">{widget.type}</span>}
      dragHandleLabel={`Move ${widget.title} widget`}
      footer={<span>ShiftCharts · size-aware frame</span>}
      className="dashboard__widget-shell"
    >
      {state === null ? chart : (
        <WidgetStates
          state={state}
          message={state === 'stale' ? 'Showing cached result' : undefined}
          description={state === 'error' ? 'The chart remains in place while the host handles recovery.' : 'Host-owned state; layout identity is preserved.'}
          action={state === 'error' ? <button type="button" className="dashboard__state-action">Retry</button> : undefined}
        >
          {chart}
        </WidgetStates>
      )}
    </WidgetShell>
  )
}

function FootprintPreview({ variation, motionPreset }: { readonly variation: FootprintVariation; readonly motionPreset: MotionPreset }): ReactElement {
  return (
    <article className="dashboard__variation-card">
      <div className="dashboard__variation-heading">
        <strong>{variation.label}</strong>
        <span>{variation.description}</span>
      </div>
      <div className="dashboard__variation-stage" style={{ inlineSize: variation.width, blockSize: variation.height }}>
        <MotionBoundary preset={motionPreset} quality="auto">
          <AutoChart
            id={`variation-${variation.cols}x${variation.rows}`}
            type="line"
            data={dashboardLine}
            title={`${variation.label} line preview`}
            description={`Line chart at the ${variation.description.toLowerCase()} footprint.`}
            gridSize={{ cols: variation.cols, rows: variation.rows }}
          />
        </MotionBoundary>
      </div>
    </article>
  )
}

export function DashboardPage({
  theme,
  motionPreset,
  onThemeChange,
  onMotionPresetChange,
  onOpenChart,
  onOpenTokens,
  onOpenInteraction,
  onOpenMotion,
  onOpenPerformance,
}: DashboardPageProps): ReactElement {
  const [layout, setLayout] = useState<readonly WidgetLayoutInput[]>(initialDashboardLayout)
  const [mode, setMode] = useState<WidgetGridMode>('edit')
  const [layoutVersion, setLayoutVersion] = useState(0)
  const [lastAction, setLastAction] = useState('Ready · drag, resize, or use keyboard controls')
  const [stateWidgetId, setStateWidgetId] = useState('training-progress')
  const [widgetState, setWidgetState] = useState<WidgetStateKind | null>(null)
  const initialCommitRef = useRef(true)
  const resetIntentRef = useRef(false)
  const [gridRef, measuredGridSize] = useElementSize<HTMLDivElement>({
    initialSize: { width: 1200, height: 840 },
  })
  const gridWidth = measuredGridSize.width > 0 ? measuredGridSize.width : 1200
  const layoutById = useMemo(() => new Map(layout.map((item) => [item.id, item])), [layout])

  const handleLayoutCommit = useCallback((snapshot: LayoutSnapshot) => {
    setLayout(layoutInputs(snapshot))
    if (initialCommitRef.current) {
      initialCommitRef.current = false
      return
    }
    if (resetIntentRef.current) {
      resetIntentRef.current = false
      return
    }
    setLastAction(`Saved · ${snapshot.items.length} widget footprints committed`)
  }, [])

  const handleLayoutCancel = useCallback(() => {
    setLastAction('Cancelled · the previous layout was restored')
  }, [])

  const resetLayout = useCallback(() => {
    resetIntentRef.current = true
    setLayout(initialDashboardLayout)
    setLayoutVersion((version) => version + 1)
    setLastAction('Reset · the V1 bento layout is active')
  }, [])

  const renderWidget = useCallback((item: WidgetLayout): ReactElement => {
    const widget = dashboardWidgetById.get(item.id)
    if (widget === undefined) {
      return <WidgetShell widgetId={item.id} title="Unknown widget">This widget is not registered.</WidgetShell>
    }
    return (
      <DashboardWidgetCard
        widget={widget}
        item={item}
        motionPreset={motionPreset}
        state={item.id === stateWidgetId ? widgetState : null}
      />
    )
  }, [motionPreset, stateWidgetId, widgetState])

  return (
    <main className={`sandbox shiftcharts-theme-${theme} sandbox--dashboard`} data-shiftcharts-theme={theme}>
      <DashboardNav
        onOpenChart={onOpenChart}
        onOpenTokens={onOpenTokens}
        onOpenInteraction={onOpenInteraction}
        onOpenMotion={onOpenMotion}
        onOpenPerformance={onOpenPerformance}
      />
      <header className="dashboard__hero">
        <div>
          <p className="sandbox__eyebrow">ShiftCharts / dashboard V1</p>
          <h1>All the families.<br /><em>One bento canvas.</em></h1>
          <p className="sandbox__lede">
            A complete dashboard consumer for the current packages: ten chart families, stable widget
            identity, grid-authoritative size semantics, and motion that stays inside the existing render boundary.
          </p>
        </div>
        <div className="dashboard__hero-summary" aria-label="Dashboard summary">
          <strong>10</strong>
          <span>chart families</span>
          <strong>12</strong>
          <span>grid columns</span>
          <strong>2 × 2</strong>
          <span>compact examples</span>
          <strong>4 × 4</strong>
          <span>bento examples</span>
        </div>
      </header>

      <section className="dashboard__workspace" aria-labelledby="dashboard-workspace-title">
        <div className="dashboard__section-heading">
          <div>
            <p className="sandbox__section-label">Responsive grid workbench</p>
            <h2 id="dashboard-workspace-title">Arrange the product surface</h2>
            <p>Every chart gets its real <code>cols × rows</code> footprint. The grid owns placement; the chart still owns information.</p>
          </div>
          <div className="dashboard__toolbar" role="toolbar" aria-label="Dashboard controls">
            <div className="dashboard__segmented-control" role="group" aria-label="Grid mode">
              {(['edit', 'read-only'] as const).map((nextMode) => (
                <button
                  key={nextMode}
                  type="button"
                  className={mode === nextMode ? 'is-active' : ''}
                  aria-pressed={mode === nextMode}
                  onClick={() => setMode(nextMode)}
                >
                  {nextMode === 'edit' ? 'Edit layout' : 'Read only'}
                </button>
              ))}
            </div>
            <button type="button" className="sandbox__button sandbox__button--quiet" onClick={resetLayout}>Reset layout</button>
          </div>
        </div>

        <div className="dashboard__control-row">
          <label className="dashboard__control-field">
            <span>Theme</span>
            <select value={theme} onChange={(event) => onThemeChange(event.target.value as ShiftChartsTheme)}>
              {SHIFTCHARTS_THEMES.map((nextTheme) => <option key={nextTheme} value={nextTheme}>{nextTheme}</option>)}
            </select>
          </label>
          <div className="dashboard__control-field">
            <span>Motion</span>
            <div className="dashboard__segmented-control" role="group" aria-label="Dashboard motion">
              {motionModes.map((motion) => (
                <button
                  key={motion.id}
                  type="button"
                  className={motionPreset === motion.id ? 'is-active' : ''}
                  aria-pressed={motionPreset === motion.id}
                  onClick={() => onMotionPresetChange(motion.id)}
                >
                  {motion.label}
                </button>
              ))}
            </div>
          </div>
          <label className="dashboard__control-field">
            <span>Widget state preview</span>
            <select value={stateWidgetId} onChange={(event) => setStateWidgetId(event.target.value)}>
              {dashboardWidgets.map((widget) => <option key={widget.id} value={widget.id}>{widget.title}</option>)}
            </select>
          </label>
          <label className="dashboard__control-field">
            <span>State</span>
            <select value={widgetState ?? 'ready'} onChange={(event) => setWidgetState(event.target.value === 'ready' ? null : event.target.value as WidgetStateKind)}>
              <option value="ready">Ready</option>
              <option value="loading">Loading</option>
              <option value="stale">Stale</option>
              <option value="empty">Empty</option>
              <option value="error">Error</option>
            </select>
          </label>
          <span className="dashboard__layout-status" role="status" aria-live="polite">{lastAction}</span>
        </div>

        <div ref={gridRef} className="dashboard__grid-host">
          <WidgetGrid
            layout={layout}
            width={gridWidth}
            mode={mode}
            rowHeight={84}
            margin={[12, 12]}
            containerPadding={[0, 0]}
            cancelInteractionToken={layoutVersion}
            renderItem={renderWidget}
            onDragStart={({ id }) => setLastAction(`Moving · ${id}`)}
            onResizeStart={({ id }) => setLastAction(`Resizing · ${id}`)}
            onLayoutCommit={handleLayoutCommit}
            onLayoutCancel={handleLayoutCancel}
          />
        </div>

        <div className="dashboard__grid-legend" aria-label="Grid capability summary">
          <span><i className="dashboard__legend-swatch dashboard__legend-swatch--drag" aria-hidden="true" />Drag handle moves a widget</span>
          <span><i className="dashboard__legend-swatch dashboard__legend-swatch--resize" aria-hidden="true" />Corner handle resizes it</span>
          <span><i className="dashboard__legend-swatch dashboard__legend-swatch--keyboard" aria-hidden="true" />Keyboard controls support move and resize</span>
          <span><i className="dashboard__legend-swatch dashboard__legend-swatch--motion" aria-hidden="true" />Motion follows the current preset</span>
        </div>
      </section>

      <section className="dashboard__variations" aria-labelledby="dashboard-variations-title">
        <div className="dashboard__section-heading">
          <div>
            <p className="sandbox__section-label">Footprint variation matrix</p>
            <h2 id="dashboard-variations-title">The same chart, eight information budgets</h2>
            <p>These previews make the complete size ladder inspectable alongside the live bento layout.</p>
          </div>
          <span className="dashboard__variation-note">line family · grid size forced</span>
        </div>
        <div className="dashboard__variation-grid">
          {footprintVariations.map((variation) => <FootprintPreview key={variation.label} variation={variation} motionPreset={motionPreset} />)}
        </div>
      </section>

      <footer className="dashboard__footer">
        <span>Built from @shiftcharts/core, primitives, react, grid, motion, and tokens.</span>
        <span>{layoutById.size} stable widget IDs · {measuredGridSize.width > 0 ? `${Math.round(measuredGridSize.width)}px measured grid` : 'measuring grid'}</span>
      </footer>
    </main>
  )
}
