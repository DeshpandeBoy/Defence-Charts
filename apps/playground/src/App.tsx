import type { SizeContext } from '@gx/core'
import {
  DEFAULT_POLICY,
  DEFAULT_NOMINAL_CELL_SIZE,
  sizeContextFromPixels,
  tickCountForWidth,
} from '@gx/core'
import { useState } from 'react'

import { LadderStrip } from './LadderStrip.tsx'
import type { PlaygroundChartType } from './PlanPanel.tsx'
import { PlanPanel, resolveForPlayground } from './PlanPanel.tsx'
import { TextMetricsPanel } from './TextMetricsPanel.tsx'
import { useElementSize } from './useElementSize.ts'

/**
 * The resize lab.
 *
 * ⚠ **There is still no chart here, and that is not an omission.** The renderer lands at A4;
 * what exists today is `@gx/core` through A3 — the plan contract, size classification, text
 * measurement, and now the resolver that turns the first two into a decision. Drawing a
 * placeholder chart would make the playground look further along than the library is, which
 * is the one thing a progress view must not do.
 *
 * What it shows is every input the resolver consults, every published threshold those inputs
 * cross, and the plan it resolves to — live, as you drag the handle.
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

  const ctx: SizeContext = sizeContextFromPixels(size.width, size.height)
  const resolved = resolveForPlayground(ctx, type, series)

  return (
    <main className="lab">
      <header className="lab__head">
        <h1>Resize lab</h1>
        <p>
          Drag the handle at the widget’s bottom-right corner. Everything on the right is a
          pure function of the two numbers a <code>ResizeObserver</code> reports — computed
          by <code>@gx/core</code>, which has never seen the DOM.
        </p>
        <p className="note">
          Milestone A3. The renderer arrives at A4, so there is deliberately no chart to look
          at — only the plan one would be drawn from.
        </p>
      </header>

      <div className="lab__stage">
        <div className="widget" ref={ref}>
          <div className="widget__label">
            <strong>{ctx.sizeClass}</strong>
            <span>
              {Math.round(size.width)} × {Math.round(size.height)} px
            </span>
            <span>
              {ctx.cols} × {ctx.rows} cells · {ctx.aspect}
            </span>
          </div>
        </div>
        <p className="note">
          The box is resized by the browser, not by JavaScript — <code>resize: both</code>.
          Nothing in this app tells it how big to be, which is the only honest way to test a
          resolver that must not influence its own container.
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
