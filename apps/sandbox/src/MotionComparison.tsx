import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import type { ChartPlan, ChartType, DataPoint, PlanPolicy, Series } from '@shiftcharts/core'
import { DEFAULT_POLICY, describeShape, planChart, sizeContextFromPixels } from '@shiftcharts/core'
import { AutoChart } from '@shiftcharts/react'
import {
  MotionBoundary,
  type MotionDiagnostics,
  type MotionPhase,
  type MotionPreset,
} from '@shiftcharts/motion'

type MotionChartType = Extract<ChartType, 'line' | 'bar' | 'timebar' | 'donut'>

const WIDTH_MIN = 180
const WIDTH_MAX = 960
const HEIGHT_MIN = 100
const HEIGHT_MAX = 620

const points = (values: readonly number[], categories?: readonly string[]): readonly DataPoint[] =>
  values.map((y, index) => ({
    x: index,
    y,
    ...(categories?.[index] === undefined ? {} : { category: categories[index] }),
  }))

const MOTION_DATA: Readonly<Record<MotionChartType, readonly Series[]>> = {
  line: [
    { id: 'readiness', label: 'Readiness', points: points([42, 46, 44, 52, 57, 55, 61, 68, 66, 74, 78, 82]) },
    { id: 'training', label: 'Training', points: points([28, 34, 32, 37, 41, 46, 44, 51, 55, 58, 63, 69]) },
    { id: 'maintenance', label: 'Maintenance', points: points([61, 58, 60, 57, 54, 53, 50, 49, 45, 43, 46, 41]) },
  ],
  bar: [
    { id: 'north', label: 'North', points: points([42, 58, 47, 71, 63, 78]) },
    { id: 'south', label: 'South', points: points([35, 48, 55, 61, 57, 69]) },
    { id: 'west', label: 'West', points: points([27, 38, 44, 52, 49, 60]) },
  ],
  timebar: [
    { id: 'deployments', label: 'Deployments', points: points([12, 20, 16, 28, 25, 34, 31, 39]) },
  ],
  donut: [
    {
      id: 'program-mix',
      label: 'Program mix',
      points: points([40, 24, 16, 10, 6, 4], ['Personnel', 'Training', 'Maintenance', 'Logistics', 'Medical', 'Other']),
    },
  ],
}

const PRESETS = [
  { id: 'tile', label: 'Tile', width: 260, height: 180 },
  { id: 'panel', label: 'Panel', width: 560, height: 320 },
  { id: 'canvas', label: 'Canvas', width: 760, height: 480 },
  { id: 'stage', label: 'Stage', width: 960, height: 620 },
] as const

type MotionComparisonProps = {
  readonly theme: string
  readonly onOpenChart: () => void
  readonly onOpenTokens: () => void
}

type MotionCardProps = {
  readonly label: string
  readonly description: string
  readonly chartType: MotionChartType
  readonly data: readonly Series[]
  readonly width: number
  readonly height: number
  readonly policy: PlanPolicy
  readonly preset?: MotionPreset
  readonly phase?: MotionPhase
  readonly diagnostics?: MotionDiagnostics | undefined
  readonly onDiagnostics?: ((diagnostics: MotionDiagnostics) => void) | undefined
}

function timingFor(plan: ChartPlan, preset: MotionPreset, phase: MotionPhase): { duration: number; stageDelay: number } {
  if (preset === 'cinematic') {
    return { duration: phase === 'preview' ? 120 : 420, stageDelay: 0 }
  }
  const duration = plan.motion.durationClass === 'recompose' ? 1000 : 300
  return { duration, stageDelay: plan.motion.stages === 1 ? 0 : duration / 2 }
}

function strategyLabel(strategy: MotionDiagnostics['strategy'] | undefined): string {
  if (strategy === 'geometry') return 'interpolating'
  if (strategy === 'crossfade') return 'crossfading'
  if (strategy === 'presence') return 'enter/exit'
  if (strategy === 'none') return 'still'
  return 'waiting'
}

function planFor(chartType: MotionChartType, data: readonly Series[], width: number, height: number): ChartPlan {
  return planChart(chartType, sizeContextFromPixels(width, height), describeShape(data), DEFAULT_POLICY)
}

function MotionCard({
  label,
  description,
  chartType,
  data,
  width,
  height,
  policy,
  preset = 'core',
  phase = 'idle',
  diagnostics,
  onDiagnostics,
}: MotionCardProps) {
  const plan = useMemo(() => planFor(chartType, data, width, height), [chartType, data, height, width])
  const timing = timingFor(plan, preset, phase)
  const style = { inlineSize: `min(${width}px, 100%)`, blockSize: `${height}px` } as CSSProperties
  const chart = (
    <AutoChart
      type={chartType}
      data={data}
      title={`${label} ${chartType} resize comparison`}
      description={`${description} This chart uses the same data and geometry as the paired comparison.`}
      policy={policy}
      id={`motion-${label.toLowerCase().replaceAll(' ', '-')}`}
    />
  )

  return (
    <article
      className={`motion-comparison__card motion-comparison__card--${label.toLowerCase().replaceAll(' ', '-')}`}
      data-shiftcharts-interaction-kind={preset === 'cinematic' ? 'resize' : undefined}
      data-shiftcharts-interaction-phase={phase}
    >
      <header className="motion-comparison__card-header">
        <div>
          <p className="sandbox__section-label">{label}</p>
          <h2>{description}</h2>
        </div>
        <span className="motion-comparison__badge">{preset}</span>
      </header>
      <div className="motion-comparison__chart-frame" style={style}>
        {preset === 'cinematic' ? <MotionBoundary preset="cinematic" quality="auto" debug onDiagnostics={onDiagnostics}>{chart}</MotionBoundary> : chart}
      </div>
      <dl className="motion-comparison__stats" aria-label={`${label} motion diagnostics`}>
        <div><dt>Plan</dt><dd>{plan.sizeClass} · {plan.motion.durationClass}</dd></div>
        <div><dt>Phase</dt><dd>{phase}</dd></div>
        <div><dt>Duration</dt><dd>{timing.duration} ms</dd></div>
        <div><dt>Stage delay</dt><dd>{timing.stageDelay} ms</dd></div>
        <div><dt>Strategy</dt><dd>{strategyLabel(diagnostics?.strategy)}</dd></div>
        <div><dt>Marks</dt><dd>{diagnostics?.animatedMarks ?? 0} / {diagnostics?.totalMarks ?? 0}</dd></div>
        <div><dt>Presence</dt><dd>+{diagnostics?.enteringMarks ?? 0} / −{diagnostics?.exitingMarks ?? 0}</dd></div>
      </dl>
    </article>
  )
}

export function MotionComparison({ theme, onOpenChart, onOpenTokens }: MotionComparisonProps) {
  const [chartType, setChartType] = useState<MotionChartType>('timebar')
  const [width, setWidth] = useState(560)
  const [height, setHeight] = useState(320)
  const [newPreset, setNewPreset] = useState<MotionPreset>('cinematic')
  const [phase, setPhase] = useState<MotionPhase>('idle')
  const [diagnostics, setDiagnostics] = useState<MotionDiagnostics | undefined>(undefined)
  const settleTimerRef = useRef<number | null>(null)
  const data = MOTION_DATA[chartType]

  const markPreview = useCallback(() => {
    setPhase('preview')
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null
      setPhase('idle')
    }, 160)
  }, [])

  useEffect(() => () => {
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
  }, [])

  const setSize = (nextWidth: number, nextHeight: number) => {
    setWidth(Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, nextWidth)))
    setHeight(Math.max(HEIGHT_MIN, Math.min(HEIGHT_MAX, nextHeight)))
    markPreview()
  }

  return (
    <main className={`sandbox sandbox--motion-comparison shiftcharts-theme-${theme}`} data-shiftcharts-theme={theme}>
      <nav className="sandbox__family-nav" aria-label="Motion comparison navigation">
        <div className="sandbox__family-nav-intro">
          <p className="sandbox__section-label">ShiftCharts / Motion lab</p>
          <strong>Resize motion, side by side</strong>
        </div>
        <div className="sandbox__family-links">
          <button type="button" onClick={onOpenChart}>Chart studio</button>
          <button type="button" onClick={onOpenTokens}>Tokens</button>
        </div>
      </nav>

      <header className="motion-comparison__header">
        <div>
          <p className="sandbox__eyebrow">Motion / old versus new</p>
          <h1>Make the resize feel<br /><em>connected to the handle.</em></h1>
          <p className="sandbox__lede">
            Both charts share the same data, planner, measured box, and size presets. Move the sliders
            quickly across a boundary to see the old delayed transition beside the interruptible motion path.
          </p>
        </div>
        <div className="motion-comparison__header-note">
          <span className="sandbox__status"><span className="sandbox__status-dot" aria-hidden="true" />Live comparison</span>
          <span>Current theme: {theme}</span>
        </div>
      </header>

      <section className="motion-comparison__controls" aria-label="Motion comparison controls">
        <label className="sandbox__field">
          <span>Chart family</span>
          <select value={chartType} onChange={(event) => { setChartType(event.target.value as MotionChartType); markPreview() }}>
            <option value="timebar">Timebar / bars</option>
            <option value="line">Line</option>
            <option value="donut">Donut</option>
          </select>
        </label>
        <label className="motion-comparison__range">
          <span>Width <output>{width}px</output></span>
          <input type="range" min={WIDTH_MIN} max={WIDTH_MAX} value={width} onChange={(event) => setSize(Number(event.target.value), height)} />
        </label>
        <label className="motion-comparison__range">
          <span>Height <output>{height}px</output></span>
          <input type="range" min={HEIGHT_MIN} max={HEIGHT_MAX} value={height} onChange={(event) => setSize(width, Number(event.target.value))} />
        </label>
        <div className="motion-comparison__preset-control">
          <span>Presets</span>
          <div className="sandbox__segmented" role="group" aria-label="Motion comparison size presets">
            {PRESETS.map((preset) => (
              <button key={preset.id} type="button" onClick={() => setSize(preset.width, preset.height)} aria-pressed={width === preset.width && height === preset.height}>
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <div className="motion-comparison__preset-control">
          <span>New path</span>
          <div className="sandbox__segmented" role="group" aria-label="New motion mode">
            {(['core', 'cinematic'] as const).map((preset) => (
              <button key={preset} type="button" onClick={() => setNewPreset(preset)} aria-pressed={newPreset === preset}>{preset}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="motion-comparison__grid" aria-label="Old and new resize behavior">
        <div className="motion-comparison__legacy">
          <MotionCard
            label="Current behavior"
            description="Delayed CSS staging"
            chartType={chartType}
            data={data}
            width={width}
            height={height}
            policy={DEFAULT_POLICY}
          />
        </div>
        <MotionCard
          label="New behavior"
          description="Interruptible resize motion"
          chartType={chartType}
          data={data}
          width={width}
          height={height}
          policy={DEFAULT_POLICY}
          preset={newPreset}
          phase={phase}
          diagnostics={diagnostics}
          onDiagnostics={setDiagnostics}
        />
      </section>

      <section className="motion-comparison__readout" aria-live="polite">
        <span><strong>{phase === 'preview' ? 'Previewing' : 'Settled'}</strong> · {width} × {height}px</span>
        <span>New path: {newPreset}</span>
        <span>Look for: bar/arc geometry, path continuity, and the absence of a dead wait.</span>
      </section>

      <footer className="motion-comparison__footer">
        <span>Old remains scoped to this fixture so the comparison survives future core fixes.</span>
        <span>Reduced motion uses the same final geometry with no animation.</span>
      </footer>
    </main>
  )
}
