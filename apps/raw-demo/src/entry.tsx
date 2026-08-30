import {
  DEFAULT_POLICY,
  type ChartPlan,
  type ChartType,
  type DataPoint,
  type PlanOverrides,
  type PlanPolicy,
  type Series,
} from '@shiftcharts/core'
import { AutoChart } from '@shiftcharts/react'
import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'

const points = (values: readonly (number | null)[]): readonly DataPoint[] =>
  values.map((y, index) => ({ x: index, y }))

const categoryPoints = (
  values: readonly (number | null)[],
  categories: readonly string[],
): readonly DataPoint[] => values.map((y, index) => ({ x: index, y, category: categories[index] }))

const temporalPoints = (values: readonly (number | null)[]): readonly DataPoint[] =>
  values.map((y, index) => ({ x: new Date(Date.UTC(2026, 0, index + 1)), y }))

const READINESS: readonly Series[] = [
  { id: 'readiness', label: 'Readiness', points: points([42, 46, 44, 52, 57, 55, 61, 68, 66, 74, 78, 82]) },
  { id: 'training', label: 'Training', points: points([28, 34, 32, 37, 41, 46, 44, 51, 55, 58, 63, 69]) },
  { id: 'maintenance', label: 'Maintenance', points: points([61, 58, 60, 57, null, 53, 50, 49, 45, 43, 46, 41]) },
]

const UNIT_OUTPUT: readonly Series[] = [
  { id: 'north', label: 'North', points: points([42, 58, 47, 71, 63, 78]) },
  { id: 'south', label: 'South', points: points([35, 48, 55, 61, 57, 69]) },
  { id: 'west', label: 'West', points: points([27, 38, 44, 52, 49, 60]) },
]

const FLEET_READINESS: readonly Series[] = [
  { id: 'fleet', label: 'Fleet readiness', unit: '%', target: 90, status: 'positive', points: points([74, 78, 82]) },
]

const SORTIE_TEMPO: readonly Series[] = [
  { id: 'alpha-sqn', label: 'Alpha Squadron', points: temporalPoints([4, 6, 5, 8, 7, 9, 6, 10, 8, 11]) },
  { id: 'bravo-sqn', label: 'Bravo Squadron', points: temporalPoints([3, 4, 6, 5, 7, 6, 8, 7, 9, 10]) },
]

const TRAINING_VS_READINESS: readonly Series[] = [
  { id: 'alpha', label: 'Alpha', points: points([12, 18, 16, 23, 28, 31, 34, 30]) },
  { id: 'bravo', label: 'Bravo', points: points([7, 11, 15, 14, 21, 24, 27, 26]) },
]

const FLEET_COMPOSITION: readonly Series[] = [
  {
    id: 'fleet-mix',
    label: 'Fleet composition',
    points: categoryPoints(
      [38, 26, 18, 10, 8],
      ['Armor', 'Infantry', 'Artillery', 'Logistics', 'Medical'],
    ),
  },
]

const READINESS_KPIS: readonly Series[] = [
  { id: 'fleet', label: 'Fleet readiness', unit: '%', target: 90, status: 'positive', points: points([74, 78, 82]) },
  { id: 'crew', label: 'Crew certification', unit: '%', target: 95, status: 'warning', points: points([81, 83, 86]) },
]

const REFIT_PROGRESS: readonly Series[] = [
  { id: 'overhaul', label: 'Fleet overhaul', unit: '%', target: 100, status: 'positive', points: points([64]) },
  { id: 'recert', label: 'Crew recertification', unit: '%', target: 100, status: 'warning', points: points([38]) },
]

const MAINTENANCE_ACTIVITY: readonly Series[] = [
  { id: 'maintenance', label: 'Maintenance', points: temporalPoints([0, 4, null, 12, 2, 9, 1, 6, 3, 7]) },
  { id: 'inspection', label: 'Inspection', points: temporalPoints([3, 7, 5, null, 18, 2, 4, 8, 6, 5]) },
]

const READINESS_PIPELINE: readonly Series[] = [
  {
    id: 'readiness-pipeline',
    label: 'Readiness pipeline',
    points: categoryPoints(
      [1000, 620, 400, 260, 130, 52],
      ['Assigned', 'Screened', 'Trained', 'Certified', 'Deployable', 'Deployed'],
    ),
  },
]

type CardSize = { readonly width: number; readonly height: number }

const SHOWCASE_CARDS: readonly {
  readonly title: string
  readonly type: ChartType
  readonly data: readonly Series[]
  readonly size: CardSize
}[] = [
  { title: 'Fleet readiness · Tile (2×1)', type: 'line', data: FLEET_READINESS, size: { width: 260, height: 150 } },
  { title: 'Unit output · Strip (3×1)', type: 'bar', data: UNIT_OUTPUT, size: { width: 420, height: 190 } },
  { title: 'Readiness trend · Panel (3×3)', type: 'line', data: READINESS, size: { width: 560, height: 320 } },
  { title: 'Readiness trend · Canvas (6×5)', type: 'area', data: READINESS, size: { width: 760, height: 480 } },
  { title: 'Sortie tempo · Strip (3×1)', type: 'timebar', data: SORTIE_TEMPO, size: { width: 420, height: 190 } },
  { title: 'Training vs readiness · Panel (3×3)', type: 'scatter', data: TRAINING_VS_READINESS, size: { width: 560, height: 320 } },
  { title: 'Fleet composition · Panel (3×3)', type: 'donut', data: FLEET_COMPOSITION, size: { width: 420, height: 360 } },
  { title: 'Readiness KPIs · Tile (2×1)', type: 'kpi', data: READINESS_KPIS, size: { width: 260, height: 150 } },
  { title: 'Refit progress · Strip (3×1)', type: 'progress', data: REFIT_PROGRESS, size: { width: 420, height: 190 } },
  { title: 'Maintenance activity · Canvas (6×5)', type: 'heatmap', data: MAINTENANCE_ACTIVITY, size: { width: 760, height: 480 } },
  { title: 'Readiness pipeline · Panel (3×3)', type: 'funnel', data: READINESS_PIPELINE, size: { width: 420, height: 420 } },
]

function ShowcaseGrid() {
  return (
    <section className="raw-demo__section">
      <h2>As-shipped — zero overrides</h2>
      <p>
        Every card renders <code>&lt;AutoChart&gt;</code> with <code>DEFAULT_POLICY</code> and no overrides.
        This is exactly what a consumer sees the moment the package is imported and a box is sized — nothing
        here is sandbox-only styling.
      </p>
      <div className="raw-demo__grid">
        {SHOWCASE_CARDS.map((card) => (
          <div className="raw-demo__card" key={card.title}>
            <h3>{card.title}</h3>
            <div className="raw-demo__frame" style={{ width: card.size.width, height: card.size.height }}>
              <AutoChart type={card.type} data={card.data} title={card.title} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

type LegendChoice = 'resolver' | 'external' | 'internal' | 'direct' | 'absent'

function TweakConsole() {
  const [type, setType] = useState<ChartType>('line')
  const [width, setWidth] = useState(640)
  const [height, setHeight] = useState(360)
  const [tickTargetSpacingX, setTickTargetSpacingX] = useState(DEFAULT_POLICY.tickTargetSpacingX)
  const [yTickCount, setYTickCount] = useState(DEFAULT_POLICY.yTickCount)
  const [directLabelMaxSeries, setDirectLabelMaxSeries] = useState(DEFAULT_POLICY.directLabelMaxSeries)
  const [regionGap, setRegionGap] = useState(DEFAULT_POLICY.regionGap)
  const [valueRegionMaxShare, setValueRegionMaxShare] = useState(DEFAULT_POLICY.valueRegionMaxShare)
  const [gridlines, setGridlines] = useState(false)
  const [legendPlacement, setLegendPlacement] = useState<LegendChoice>('resolver')
  const [plan, setPlan] = useState<ChartPlan | null>(null)

  const policy: Partial<PlanPolicy> = useMemo(
    () => ({ tickTargetSpacingX, yTickCount, directLabelMaxSeries, regionGap, valueRegionMaxShare }),
    [tickTargetSpacingX, yTickCount, directLabelMaxSeries, regionGap, valueRegionMaxShare],
  )

  const overrides: PlanOverrides | undefined = useMemo(() => {
    const axes = gridlines ? { x: { gridlines: true }, y: { gridlines: true } } : undefined
    const legend =
      legendPlacement === 'resolver'
        ? undefined
        : legendPlacement === 'external'
          ? { placement: 'external' as const, position: 'right' as const, maxEntries: 8, showValues: false, showPercent: false }
          : legendPlacement === 'internal'
            ? { placement: 'internal' as const, maxEntries: 8 }
            : { placement: legendPlacement }
    if (axes === undefined && legend === undefined) return undefined
    return { ...(axes === undefined ? {} : { axes }), ...(legend === undefined ? {} : { legend }) }
  }, [gridlines, legendPlacement])

  return (
    <section className="raw-demo__section">
      <h2>Live tweak console</h2>
      <p>
        A focused subset of <code>PlanPolicy</code> and <code>PlanOverrides</code> — the full surface (every
        policy field, the token catalogue, raw data/JSON editors) lives in <code>apps/sandbox</code>. This
        panel is for a fast "does this still look right" pass against the raw package.
      </p>
      <div className="raw-demo__tweak">
        <div className="raw-demo__controls">
          <label>
            Chart type
            <select value={type} onChange={(event) => setType(event.target.value as ChartType)}>
              {(['line', 'area', 'bar', 'scatter'] as const).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            Width
            <input type="number" min={150} max={1100} value={width} onChange={(event) => setWidth(Number(event.target.value))} />
          </label>
          <label>
            Height
            <input type="number" min={100} max={700} value={height} onChange={(event) => setHeight(Number(event.target.value))} />
          </label>
          <label>
            X tick spacing <output>{tickTargetSpacingX}px</output>
            <input type="range" min={40} max={240} value={tickTargetSpacingX} onChange={(event) => setTickTargetSpacingX(Number(event.target.value))} />
          </label>
          <label>
            Y tick count <output>{yTickCount}</output>
            <input type="range" min={2} max={8} value={yTickCount} onChange={(event) => setYTickCount(Number(event.target.value))} />
          </label>
          <label>
            Direct-label series limit <output>{directLabelMaxSeries}</output>
            <input type="range" min={1} max={8} value={directLabelMaxSeries} onChange={(event) => setDirectLabelMaxSeries(Number(event.target.value))} />
          </label>
          <label>
            Region gap <output>{regionGap}px</output>
            <input type="range" min={0} max={24} value={regionGap} onChange={(event) => setRegionGap(Number(event.target.value))} />
          </label>
          <label>
            Value region max share <output>{valueRegionMaxShare.toFixed(2)}</output>
            <input type="range" min={0.1} max={0.8} step={0.05} value={valueRegionMaxShare} onChange={(event) => setValueRegionMaxShare(Number(event.target.value))} />
          </label>
          <label className="raw-demo__checkbox">
            <input type="checkbox" checked={gridlines} onChange={(event) => setGridlines(event.target.checked)} />
            Gridlines
          </label>
          <label>
            Legend placement
            <select value={legendPlacement} onChange={(event) => setLegendPlacement(event.target.value as LegendChoice)}>
              {(['resolver', 'external', 'internal', 'direct', 'absent'] as const).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="raw-demo__preview">
          <div className="raw-demo__frame" style={{ width, height }}>
            <AutoChart
              type={type}
              data={READINESS}
              title="Tweak console preview"
              policy={policy}
              overrides={overrides}
              onResolvedPlan={setPlan}
            />
          </div>
        </div>
      </div>
      <details className="raw-demo__plan">
        <summary>Resolved ChartPlan JSON</summary>
        <pre>{plan === null ? 'waiting for first measurement…' : JSON.stringify(plan, null, 2)}</pre>
      </details>
    </section>
  )
}

function RawDemo() {
  return (
    <main className="raw-demo">
      <header className="raw-demo__header">
        <p className="raw-demo__eyebrow">@shiftcharts/react + @shiftcharts/core + @shiftcharts/tokens</p>
        <h1>The raw package, no dev sandbox.</h1>
        <p>
          This page imports the same packages a consumer's own app would, bundled once with esbuild into{' '}
          <code>dist/entry.js</code> and loaded by a plain <code>index.html</code>. Nothing here runs Vite,
          the sandbox React app, or any dev-only tooling.
        </p>
      </header>
      <ShowcaseGrid />
      <TweakConsole />
      <footer className="raw-demo__footer">
        <h2>Other ways to inspect and tweak the geometry</h2>
        <ul>
          <li>
            Open devtools and select the <code>&lt;svg class="shiftcharts-chart__svg"&gt;</code> — every
            colour, gap, and radius is a <code>var(--shiftcharts-*)</code> custom property on{' '}
            <code>:root</code>; edit it live in the Styles pane.
          </li>
          <li>
            Resize the browser window (or the devtools device toolbar) across the card widths above to sweep
            the size-class ladder (<code>micro → tile → strip → panel → canvas → stage</code>) live.
          </li>
          <li>
            The full policy surface, token catalogue, and JSON editors live in <code>apps/sandbox</code> (
            <code>pnpm --filter @shiftcharts/sandbox dev</code>) — this page is the lighter, framework-adjacent
            counterpart to that engineering workbench.
          </li>
          <li>
            Rebuild after a source change with <code>node apps/raw-demo/build.mjs</code>, then reload — there
            is no watch mode, so the rebuild-and-refresh loop stays visible rather than automatic.
          </li>
        </ul>
      </footer>
    </main>
  )
}

const container = document.getElementById('root')
if (container === null) throw new Error('#root not found')
createRoot(container).render(<RawDemo />)
