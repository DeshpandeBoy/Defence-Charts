import {
  describeShape,
  planChart,
  sizeContextFromPixels,
  type Series,
} from '@shiftcharts/core'
import { Chart } from '@shiftcharts/primitives'
import { AutoChart, LegendControl } from '@shiftcharts/react'
import { useMemo, useState, type CSSProperties, type ReactElement } from 'react'

const DATA: readonly Series[] = [
  {
    id: 'alpha',
    label: 'Alpha',
    points: Array.from({ length: 8 }, (_, index) => ({ x: index, y: 28 + index * 4 })),
  },
  {
    id: 'bravo',
    label: 'Bravo',
    points: Array.from({ length: 8 }, (_, index) => ({ x: index, y: 46 + (index % 4) * 5 })),
  },
  {
    id: 'charlie',
    label: 'Charlie',
    points: Array.from({ length: 8 }, (_, index) => ({ x: index, y: 64 - (index % 5) * 3 })),
  },
  {
    id: 'delta',
    label: 'Delta',
    points: Array.from({ length: 8 }, (_, index) => ({ x: index, y: 18 + (index % 3) * 8 })),
  },
  {
    id: 'echo',
    label: 'Echo',
    points: Array.from({ length: 8 }, (_, index) => ({
      x: index,
      y: index === 3 ? null : 38 + (index % 2) * 9,
    })),
  },
]

/**
 * Dense enough to exercise the hover loop without crossing the current 2,000-point SVG budget.
 * One series keeps this fixture focused on point lookup rather than shared-tooltip row count.
 */
const PERFORMANCE_DATA: readonly Series[] = [
  {
    id: 'performance',
    label: 'Performance',
    points: Array.from({ length: 1_000 }, (_, index) => ({
      x: index,
      y: 50 + Math.sin(index / 31) * 24 + Math.cos(index / 17) * 8,
    })),
  },
]

/**
 * Near the default 2,000-point SVG budget so the scatter benchmark exercises the current
 * exhaustive 2D fallback at a realistic supported density. Keep this separate from the line
 * fixture: the line path uses sorted-X lookup while scatter is intentionally still exhaustive.
 */
const SCATTER_PERFORMANCE_DATA: readonly Series[] = [
  {
    id: 'scatter-performance',
    label: 'Scatter performance',
    points: Array.from({ length: 1_900 }, (_, index) => ({
      x: index,
      y: 50 + Math.sin(index / 19) * 28 + Math.cos(index / 43) * 12,
    })),
  },
]

const PANEL_GRID = { cols: 3, rows: 3 } as const
const CANVAS_GRID = { cols: 6, rows: 5 } as const
const STRIP_GRID = { cols: 3, rows: 1 } as const

const PANEL_STYLE: CSSProperties = { inlineSize: 520, blockSize: 320 }
const CANVAS_STYLE: CSSProperties = { inlineSize: 760, blockSize: 520 }
const STRIP_STYLE: CSSProperties = { inlineSize: 520, blockSize: 150 }
const PERFORMANCE_STYLE: CSSProperties = { inlineSize: 760, blockSize: 360 }

const CANVAS_CONTEXT = sizeContextFromPixels(CANVAS_STYLE.inlineSize as number, CANVAS_STYLE.blockSize as number)
const STATIC_PLAN = planChart('line', CANVAS_CONTEXT, describeShape(DATA))

export function InteractionFixture(): ReactElement {
  const [resized, setResized] = useState(false)
  const [hiddenSeriesIds, setHiddenSeriesIds] = useState<readonly string[]>([])

  const resizableGrid = resized ? CANVAS_GRID : PANEL_GRID
  const resizableStyle = resized ? CANVAS_STYLE : PANEL_STYLE
  const legendPlan = useMemo(
    () => planChart('line', CANVAS_CONTEXT, describeShape(DATA)),
    [],
  )

  function setVisibility(seriesId: string, visible: boolean): void {
    setHiddenSeriesIds((current) => {
      const next = new Set(current)
      if (visible) next.delete(seriesId)
      else next.add(seriesId)
      return DATA.filter((series) => next.has(series.id)).map((series) => series.id)
    })
  }

  return (
    <main className="interaction-fixture" data-shiftcharts-fixture="interaction">
      <header className="interaction-fixture__header">
        <h1>Interaction browser fixture</h1>
        <p>
          Strip, Panel, Canvas, static Chart, and the controlled legend are rendered from the
          shipped interaction surfaces.
        </p>
      </header>

      <section className="interaction-fixture__section" aria-labelledby="static-title">
        <h2 id="static-title">Static Chart / RSC surface</h2>
        <div className="interaction-fixture__static-frame" data-shiftcharts-static-chart>
          <Chart
            plan={STATIC_PLAN}
            data={DATA}
            ctx={CANVAS_CONTEXT}
            title="Static chart"
            description="Static chart browser contract."
            id="static-chart"
          />
        </div>
      </section>

      <section className="interaction-fixture__section" aria-labelledby="tap-title">
        <h2 id="tap-title">Strip / touch tap lock</h2>
        <div className="interaction-fixture__chart-frame" style={STRIP_STYLE} data-shiftcharts-tap-chart>
          <AutoChart
            type="line"
            data={DATA}
            title="Tap chart"
            description="Strip chart for touch and fixed tooltip verification."
            gridSize={STRIP_GRID}
            id="tap-chart"
          />
        </div>
      </section>

      <section className="interaction-fixture__section" aria-labelledby="panel-title">
        <h2 id="panel-title">Panel → Canvas / open overlay resize</h2>
        <button
          type="button"
          data-shiftcharts-resize-toggle
          aria-pressed={resized}
          onClick={() => setResized((current) => !current)}
        >
          resize:{resized ? 'canvas' : 'panel'}
        </button>
        <div
          className="interaction-fixture__chart-frame"
          style={resizableStyle}
          data-shiftcharts-resizable-chart
          data-shiftcharts-size-class={resized ? 'canvas' : 'panel'}
        >
          <AutoChart
            type="line"
            data={DATA}
            title="Resizable chart"
            description="Panel to Canvas chart for open-overlay resize verification."
            gridSize={resizableGrid}
            id="resizable-chart"
          />
        </div>
      </section>

      <section className="interaction-fixture__section" aria-labelledby="canvas-title">
        <h2 id="canvas-title">Canvas / controlled legend</h2>
        <div className="interaction-fixture__chart-frame" style={CANVAS_STYLE} data-shiftcharts-canvas-chart>
          <AutoChart
            type="line"
            data={DATA}
            title="Canvas chart"
            description="Canvas chart for fluid tooltip and legend verification."
            gridSize={CANVAS_GRID}
            id="canvas-chart"
          />
        </div>
        <div data-shiftcharts-legend-control>
          <LegendControl
            plan={legendPlan}
            series={DATA}
            hiddenSeriesIds={hiddenSeriesIds}
            onVisibilityChange={setVisibility}
          />
        </div>
      </section>

      <section className="interaction-fixture__section" aria-labelledby="performance-title">
        <h2 id="performance-title">Hover performance evidence</h2>
        <div
          className="interaction-fixture__chart-frame"
          style={PERFORMANCE_STYLE}
          data-shiftcharts-performance-chart
        >
          <AutoChart
            type="line"
            data={PERFORMANCE_DATA}
            title="Hover performance chart"
            description="One thousand points for client hover-path evidence."
            gridSize={CANVAS_GRID}
            id="performance-chart"
          />
        </div>
      </section>

      <section className="interaction-fixture__section" aria-labelledby="scatter-performance-title">
        <h2 id="scatter-performance-title">Scatter hover performance evidence</h2>
        <div
          className="interaction-fixture__chart-frame"
          style={PERFORMANCE_STYLE}
          data-shiftcharts-scatter-performance-chart
        >
          <AutoChart
            type="scatter"
            data={SCATTER_PERFORMANCE_DATA}
            title="Scatter hover performance chart"
            description="One thousand nine hundred points for the exhaustive scatter hover-path evidence."
            gridSize={CANVAS_GRID}
            id="scatter-performance-chart"
          />
        </div>
      </section>

      <output data-shiftcharts-interaction-state>
        hidden-series:{hiddenSeriesIds.join(',') || 'none'}; resize:{resized ? 'canvas' : 'panel'}
      </output>
    </main>
  )
}
