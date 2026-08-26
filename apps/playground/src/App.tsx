import type { SizeClass, SizeContext } from '@shiftcharts/core'
import {
  DEFAULT_POLICY,
  DEFAULT_NOMINAL_CELL_SIZE,
  resolveSizeClassWithDeadband,
  sizeContextFromPixels,
  tickCountForWidth,
} from '@shiftcharts/core'
import { AutoChart, useElementSize } from '@shiftcharts/react'
import { useEffect, useMemo, useState } from 'react'

import { LadderStrip } from './LadderStrip.tsx'
import type { PlaygroundChartType } from './PlanPanel.tsx'
import { PlanPanel, resolveForPlayground } from './PlanPanel.tsx'
import { TextMetricsPanel } from './TextMetricsPanel.tsx'

/**
 * The resize lab.
 *
 * ⚠ **There is a chart now, and it is the whole thesis in one gesture.** Through A3 this
 * page deliberately drew nothing — the library had a plan contract and a resolver, and a
 * placeholder chart would have made it look further along than it was. A4 supplies the
 * renderer, so the plan on the right and the SVG on the left are now the same object twice:
 * printed and drawn. Drag the corner and the mark kind, the axes, the legend placement and
 * the data table all change in both at the same frame.
 *
 * ⚠ **A5 replaced the hand-wiring with `<AutoChart>`, and the deletion is the point.** This
 * file used to own a local `useElementSize.ts`, call `sizeContextFromPixels()` on its output,
 * pass the result to `resolveForPlayground()`, and hand the plan to `<Chart>` — the measure /
 * plan / render pipeline, spelled out by the app. All three steps now live inside one
 * component in `@shiftcharts/react`, and the app supplies data and a box. Whatever this page still
 * computes, it computes to *display*, not to draw.
 *
 * ## ⚠ Two observers, on purpose, and the CSS rule that keeps them honest
 *
 * `useElementSize` here observes `.widget`, because the panels on the right print those
 * numbers and a lab that cannot report its own instrument is not a lab. `<AutoChart>`
 * observes its own wrapper, inside it, because that is the library's real path and driving
 * anything else would be testing the playground.
 *
 * Those are two different elements, so they are two different content boxes — and if they
 * ever disagreed, every number on the right would be describing a box the chart was not
 * planned for. One rule in `playground.css` pins them together: `.widget .shiftcharts-auto-chart`
 * gets `block-size: 100%`. That is not a workaround. It is *precisely* the containment
 * contract `<AutoChart>`'s docblock states for every consumer — **give the wrapper a
 * height** — so the playground demonstrates the rule rather than dodging it. Delete that
 * rule and the wrapper takes its height from the chart it contains, which is the loop, and
 * gate **G11**'s browser half is what notices.
 *
 * ⚠ **The chart type and series count live here, not in `PlanPanel`.** They are plan
 * *inputs*, exactly like the size this component already owns, and the threshold list needs
 * the plot box they produce. Two components each resolving their own plan would put two
 * disagreeing plot heights on one page.
 */
export function App() {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const [type, setType] = useState<PlaygroundChartType>('line')
  const [series, setSeries] = useState(3)

  // ⚠ Resolved a second time, here, and it is a *display* copy rather than the one drawn.
  // `<AutoChart>` resolves its own from its own measurement; this one feeds the JSON panel
  // and the threshold list. They agree because both are `planChart()` over the same pure
  // inputs — same data, same default nominal cell size, same box. If the fingerprint in
  // `PlanPanel` ever stops matching the chart beside it, that agreement has broken and the
  // `block-size: 100%` rule above is the first thing to check.
  const rawCtx: SizeContext = useMemo(
    () => sizeContextFromPixels(size.width, size.height),
    [size.height, size.width],
  )
  const [previousClass, setPreviousClass] = useState<SizeClass | undefined>(undefined)
  const measured = size.width > 0 && size.height > 0
  const nextClass = useMemo(
    () =>
      resolveSizeClassWithDeadband(
        rawCtx.width,
        rawCtx.height,
        measured ? previousClass : undefined,
      ),
    [measured, previousClass, rawCtx.height, rawCtx.width],
  )
  useEffect(() => {
    if (measured && previousClass !== nextClass) setPreviousClass(nextClass)
  }, [measured, nextClass, previousClass])
  const ctx: SizeContext = useMemo(() => {
    const sizeClass = nextClass
    if (sizeClass === rawCtx.sizeClass) return rawCtx
    return Object.freeze({ ...rawCtx, sizeClass })
  }, [nextClass, rawCtx])
  const resolved = resolveForPlayground(ctx, type, series)

  return (
    <main className="lab">
      <header className="lab__head">
        <h1>Resize lab</h1>
        <p>
          Drag the handle at the widget’s bottom-right corner. Everything on the right is a
          pure function of the two numbers a <code>ResizeObserver</code> reports — computed
          by <code>@shiftcharts/core</code>, which has never seen the DOM.
        </p>
        <p className="note">
          Milestone A6 / B1-B3. The chart is a single <code>&lt;AutoChart&gt;</code> — it measures
          its own box, resolves the plan beside it, and renders it with hook-free components
          that work on a server with no client bundle. Watch the mark kind flip from{' '}
          <code>line</code> to <code>horizon</code> as you drag the widget short.
        </p>
      </header>

      <div className="lab__stage">
        <div className="widget" ref={ref}>
          {/*
            ⚠ `<AutoChart>` is the only child, and the guard that used to stand here is
            gone because the component owns it. It renders nothing until a real measurement
            has arrived — the first frame reports 0 × 0 on every browser, and a chart
            planned for a zero box is a Micro rung that would flash on load and be gone.

            ⚠ The size readout used to live in here, centred; it now sits outside the box.
            A sibling in normal flow contributes to the content box the observer reports, so
            the chart would have been planned for a height the label had already taken a
            bite out of — and shrinking the widget past the label's own height would have
            stopped the box shrinking at all. That is the containment loop, arriving through
            the least interesting door.
          */}
          <AutoChart
            type={type}
            data={resolved.data}
            title={`${type} chart, ${resolved.data.length} series`}
            description="Demo data. Deterministic, so the same drag draws the same picture."
          />
        </div>

        <div className="widget__label">
          <strong>{ctx.sizeClass}</strong>
          <span>
            {Math.round(size.width)} × {Math.round(size.height)} px
          </span>
          <span>
            {ctx.cols} × {ctx.rows} cells · {ctx.aspect}
          </span>
        </div>

        <p className="note">
          The box is resized by the browser, not by JavaScript — <code>resize: both</code>.
          Nothing in this app tells it how big to be, which is the only honest way to test a
          resolver that must not influence its own container.
        </p>
        <p className="note">
          ⚠ The last series has a deliberate gap at its fourth point. It breaks the line
          rather than diving to the axis, because <code>y: null</code> is a gap and not a
          zero — “no reading was taken” and “the reading was nothing” are different claims.
        </p>
        <p className="note">
          ⚠ <strong>Two things are clipped, and you are meant to see that.</strong> At Canvas
          and above, the direct end-of-line series labels are drawn at x&nbsp;706 on a 702 px
          plot, and the topmost y tick label straddles y&nbsp;0 by about 8 px. Both are one
          omission: <code>resolvePlotBox()</code> reserves a gutter on the left and nothing
          on the right or the top, so §1.3’s horizontal chain — <em>y gutter → plot width →
          x tick count → x label degrade</em> — has no step that pays for either. The
          library’s answer today is <code>overflow: visible</code> on the{' '}
          <code>&lt;svg&gt;</code>, which works when the chart has room around it and does
          nothing in a dashboard cell, where the widget <em>is</em> the room. That gutter is
          current grid/chrome work’s, written down in <code>chart.css</code> since A4. This box is{' '}
          <code>overflow: hidden</code>, so the shortfall shows as clipping instead of hiding
          behind a scrollbar — and a scrollbar here would feed the resize observer that
          produced the box.
        </p>
      </div>

      <aside className="lab__panel">
        <LadderStrip current={ctx.sizeClass} />

        <section>
          <h2>SizeContext</h2>
          <p className="note">
            The resolver’s first input. Carries <em>both</em> cells and raw pixels: the rung
            comes from cells, but several decisions inside a rung are made on measured plot
            height.
          </p>
          <dl className="kv">
            <Row k="width" v={`${size.width.toFixed(1)} px`} />
            <Row k="height" v={`${size.height.toFixed(1)} px`} />
            <Row k="cols" v={String(ctx.cols)} />
            <Row k="rows" v={String(ctx.rows)} />
            <Row k="aspect" v={ctx.aspect} />
            <Row k="sizeClass" v={ctx.sizeClass} />
          </dl>
        </section>

        <section>
          <h2>Nominal cell size</h2>
          <dl className="kv">
            <Row k="standalone default" v={`${DEFAULT_NOMINAL_CELL_SIZE} px`} />
          </dl>
          <p className="note">
            <code>sizeContextFromPixels()</code> converts a standalone chart into a virtual
            square-cell footprint. The 100 px default is explicitly Tier C: a project-owned,
            configurable policy rather than a research finding. Dashboard charts bypass it
            and use the grid’s real columns and rows.
          </p>
        </section>

        <section>
          <h2>Published thresholds</h2>
          <p className="note">
            Plot height, in px. These are findings, not preferences — each one is why a
            boundary sits where it does.
          </p>
          <ul className="thresholds">
            <Threshold
              height={resolved.box.height}
              at={DEFAULT_POLICY.horizonMinHeight}
              label="a 2-band horizon is still readable"
              cite="Heer 2009"
            />
            <Threshold
              height={resolved.box.height}
              at={DEFAULT_POLICY.plotHeightOptimal}
              label="optimal for a line; below this, change encoding"
              cite="Heer 2009"
            />
            <Threshold
              height={resolved.box.height}
              at={DEFAULT_POLICY.plotHeightMinValues}
              label="below this, value-estimation error rises (p < 0.001)"
              cite="Heer & Bostock 2010"
            />
            <Threshold
              height={resolved.box.height}
              at={DEFAULT_POLICY.plotHeightSaturation}
              label="little benefit beyond; extra space buys content, not plot"
              cite="Heer & Bostock 2010"
            />
          </ul>
          <dl className="kv">
            <Row
              k="plot box"
              v={`${resolved.box.width.toFixed(1)} × ${resolved.box.height.toFixed(1)} px`}
            />
            <Row k="widget height" v={`${size.height.toFixed(1)} px`} />
          </dl>
          <p className="note">
            ⚠ Compared against <em>plot</em> height, which is what the resolver compares
            against — not the widget height beside it. The difference between those two
            numbers is everything the chrome takes: the value region, the x-axis band and the
            legend band, resolved in that fixed order by <code>resolvePlotBox()</code>. A2
            could only show the widget height and said so; the gap is why that was a
            placeholder rather than an approximation.
          </p>
          <p className="note">
            ⚠ The vertical chain is <strong>Tier B</strong> — ours, consistent with the
            corpus but not drawn from it. The published work fixes the <em>horizontal</em>
            order and is silent on how a widget box becomes a plot box, so these four
            thresholds are findings being applied to a height of our own construction.
          </p>
        </section>

        <section>
          <h2>Axis ticks</h2>
          <dl className="kv">
            <Row k="tickCountForWidth(width)" v={String(tickCountForWidth(size.width))} />
          </dl>
          <p className="note">
            <code>max(2, round(width / 100))</code>, with no upper cap. The absent cap is
            the specification: the ladder densifies continuously instead of snapping, and a
            cap would put the breakpoint back in through the side door. Drag slowly and
            watch it step one at a time.
          </p>
        </section>

        <PlanPanel
          resolved={resolved}
          type={type}
          series={series}
          onType={setType}
          onSeries={setSeries}
        />

        <TextMetricsPanel />
      </aside>
    </main>
  )
}

function Row({ k, v }: { readonly k: string; readonly v: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </>
  )
}

function Threshold({
  height,
  at,
  label,
  cite,
}: {
  readonly height: number
  readonly at: number
  readonly label: string
  readonly cite: string
}) {
  const cleared = height >= at
  return (
    <li className={cleared ? 'threshold threshold--cleared' : 'threshold'}>
      <span className="threshold__px">{at} px</span>
      <span className="threshold__label">{label}</span>
      <span className="threshold__cite">{cite}</span>
    </li>
  )
}
