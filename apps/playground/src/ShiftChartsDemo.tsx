import type { ChartType, LayoutSnapshot, Series, WidgetLayoutInput } from '@shiftcharts/core'
import { AutoChart, useElementSize } from '@shiftcharts/react'
import { useCallback, useMemo, useState } from 'react'

import { WidgetGrid, WidgetShell } from '../../../packages/grid/src/index.ts'

type DemoWidget = {
  readonly id: string
  readonly title: string
  readonly context: string
  readonly type: ChartType
  readonly metric: string
  readonly delta: string
  readonly deltaLabel: string
  readonly data: readonly Series[]
}

const points = (values: readonly number[]) => values.map((y, x) => ({ x, y }))

const WIDGETS: readonly DemoWidget[] = [
  {
    id: 'net-revenue',
    title: 'Net revenue',
    context: 'Last 12 weeks',
    type: 'area',
    metric: '$48.2k',
    delta: '+12.8%',
    deltaLabel: 'up from previous period',
    data: [{ id: 'revenue', label: 'Revenue', points: points([28, 31, 29, 35, 38, 36, 41, 44, 42, 48, 46, 53]) }],
  },
  {
    id: 'active-accounts',
    title: 'Active accounts',
    context: 'Rolling 30 days',
    type: 'line',
    metric: '2,846',
    delta: '+8.4%',
    deltaLabel: 'up from previous period',
    data: [{ id: 'accounts', label: 'Accounts', points: points([35, 37, 36, 39, 41, 40, 43, 45, 44, 47, 49, 52]) }],
  },
  {
    id: 'conversion-rate',
    title: 'Conversion rate',
    context: 'Weekly average',
    type: 'line',
    metric: '6.8%',
    delta: '+1.2 pts',
    deltaLabel: 'above target',
    data: [{ id: 'conversion', label: 'Conversion', points: points([4.1, 4.7, 4.4, 5.1, 5.4, 5.2, 5.9, 6.1, 5.8, 6.4, 6.3, 6.8]) }],
  },
] as const

const INITIAL_LAYOUT: readonly WidgetLayoutInput[] = [
  { id: 'net-revenue', x: 0, y: 0, w: 8, h: 4, minW: 4, minH: 3, maxW: 12, maxH: 6 },
  { id: 'active-accounts', x: 8, y: 0, w: 4, h: 4, minW: 3, minH: 3, maxW: 8, maxH: 6 },
  { id: 'conversion-rate', x: 0, y: 4, w: 12, h: 3, minW: 4, minH: 2, maxW: 12, maxH: 5 },
]

const WIDGET_BY_ID = new Map(WIDGETS.map((widget) => [widget.id, widget]))

function inputsFromSnapshot(snapshot: LayoutSnapshot): readonly WidgetLayoutInput[] {
  return snapshot.items.map((item) => ({
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
  }))
}

function widgetFor(id: string): DemoWidget {
  const widget = WIDGET_BY_ID.get(id)
  if (widget === undefined) throw new Error(`Unknown demo widget: ${id}`)
  return widget
}

export function ShiftChartsDemo() {
  const [layout, setLayout] = useState<readonly WidgetLayoutInput[]>(INITIAL_LAYOUT)
  const [mode, setMode] = useState<'edit' | 'read-only'>('edit')
  const [showInspector, setShowInspector] = useState(false)
  const [cancelInteractionToken, setCancelInteractionToken] = useState(0)
  const [lastAction, setLastAction] = useState('Ready to explore')
  const [gridRef, gridSize] = useElementSize<HTMLDivElement>({
    initialSize: { width: 960, height: 640 },
  })

  const gridWidth = Math.max(1, Math.floor(gridSize.width))
  const activeWidgets = useMemo(
    () => layout.map((item) => `${item.id}:${item.w}×${item.h}`),
    [layout],
  )

  const commitLayout = useCallback((snapshot: LayoutSnapshot) => {
    setLayout(inputsFromSnapshot(snapshot))
    setLastAction('Layout saved')
  }, [])

  const resetLayout = useCallback(() => {
    setCancelInteractionToken((token) => token + 1)
    setLayout(INITIAL_LAYOUT)
    setLastAction('Layout reset')
  }, [])

  return (
    <main className="demo" data-shiftcharts-demo data-shiftcharts-mode={mode}>
      <nav className="demo__nav" aria-label="ShiftCharts demo navigation">
        <a className="demo__brand" href="/" aria-label="ShiftCharts home">
          <span>ShiftCharts</span>
        </a>
        <div className="demo__nav-actions">
          <span className="demo__save-state" role="status" aria-live="polite">
            <span className="demo__status-dot" aria-hidden="true" />
            {lastAction}
          </span>
          <button
            type="button"
            className="demo__button demo__button--quiet"
            aria-pressed={showInspector}
            aria-controls="shiftcharts-demo-inspector"
            onClick={() => setShowInspector((visible) => !visible)}
          >
            {showInspector ? 'Hide details' : 'View details'}
          </button>
          <button
            type="button"
            className={`demo__button ${mode === 'edit' ? 'demo__button--active' : ''}`}
            aria-pressed={mode === 'edit'}
            onClick={() => setMode((current) => current === 'edit' ? 'read-only' : 'edit')}
          >
            {mode === 'edit' ? 'Done editing' : 'Edit dashboard'}
          </button>
        </div>
      </nav>

      <div className="demo__main">
        <header className="demo__hero">
          <div>
            <p className="demo__eyebrow">Responsive charting, made tangible</p>
            <h1>Shape your dashboard.<br /><em>Charts follow.</em></h1>
            <p className="demo__lede">
              Drag a widget or resize it from the corner. ShiftCharts adapts the chart’s
              information density to the space you give it.
            </p>
          </div>
          <div className="demo__hero-note" aria-label="How to try the demo">
            <span className="demo__hero-note-index">01</span>
            <p>Try moving <strong>Net revenue</strong>, then make it smaller. Watch the chart change.</p>
          </div>
        </header>

        <section className="demo__workspace" aria-label="Interactive ShiftCharts dashboard">
          <div className="demo__grid-region">
            <div className="demo__grid-toolbar">
              <div>
                <span className="demo__section-label">Live dashboard</span>
                <span className="demo__section-meta">3 widgets · 12-column grid</span>
              </div>
              <button type="button" className="demo__reset" onClick={resetLayout}>
                Reset layout
              </button>
            </div>

            <div className="demo__interaction-cue" data-shiftcharts-interaction-cue>
              <span className="demo__cue-label">How to interact</span>
              {mode === 'edit'
                ? 'Drag the grip to move · pull the corner to resize'
                : 'Read-only preview · turn on Edit dashboard to rearrange'}
            </div>

            <div ref={gridRef} className={`demo__grid-frame ${mode === 'edit' ? 'demo__grid-frame--editing' : ''}`}>
              <WidgetGrid
                layout={layout}
                width={gridWidth}
                rowHeight={76}
                margin={[12, 12]}
                mode={mode}
                cancelInteractionToken={cancelInteractionToken}
                className="demo__grid"
                style={{ width: '100%' }}
                renderItem={(item) => {
                  const widget = widgetFor(item.id)
                  return (
                    <div className="demo__slot" data-shiftcharts-slot={widget.id}>
                      <WidgetShell
                        widgetId={widget.id}
                        className="demo-widget"
                        title={widget.title}
                        context={widget.context}
                        actions={<span className="demo-widget__live">Live</span>}
                        dragHandleLabel={`Move ${widget.title}; ${item.w} by ${item.h} grid cells`}
                        footer={<span>Updated just now</span>}
                      >
                        <div className="demo-widget__body">
                          <div className="demo-widget__summary">
                            <strong>{widget.metric}</strong>
                            <span className="demo-widget__delta">{widget.delta}</span>
                            <span className="demo-widget__delta-label">{widget.deltaLabel}</span>
                          </div>
                          <div className="demo-widget__chart">
                            <AutoChart
                              type={widget.type}
                              data={widget.data}
                              title={`${widget.title}, ${widget.context}`}
                              description={`${widget.metric}, ${widget.delta} ${widget.deltaLabel}.`}
                              gridSize={{ cols: item.w, rows: item.h }}
                              id={`demo-${widget.id}`}
                            />
                          </div>
                        </div>
                      </WidgetShell>
                    </div>
                  )
                }}
                onLayoutCommit={commitLayout}
                onLayoutCancel={() => setLastAction('Layout cancelled')}
              />
            </div>
          </div>

          {showInspector ? (
            <aside id="shiftcharts-demo-inspector" className="demo__inspector" aria-label="Dashboard details">
              <div className="demo__inspector-heading">
                <span className="demo__section-label">Under the hood</span>
              </div>
              <p>
                The grid owns placement. Each chart receives its real footprint and plans its
                information density from that space.
              </p>
              <dl className="demo__inspector-list">
                <div><dt>Layout</dt><dd>Controlled</dd></div>
                <div><dt>Chart planner</dt><dd>Data-blind</dd></div>
                <div><dt>Identity</dt><dd>Stable IDs</dd></div>
              </dl>
              <div className="demo__inspector-layout">
                <span>Current footprints</span>
                <code>{activeWidgets.join(' · ')}</code>
              </div>
              <a className="demo__lab-link" href="/?lab=1">Open the measurement lab</a>
            </aside>
          ) : null}
        </section>

        <footer className="demo__footer">
          <span>ShiftCharts / Local demo</span>
          <span>Charts that shift with their space.</span>
        </footer>
      </div>
    </main>
  )
}
