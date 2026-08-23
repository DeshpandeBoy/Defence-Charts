import type { SizeContext } from '@gx/core'
import {
  DEFAULT_POLICY,
  resolveAspect,
  resolveSizeClass,
  tickCountForWidth,
} from '@gx/core'
import { useState } from 'react'

import { LadderStrip } from './LadderStrip.tsx'
import { TextMetricsPanel } from './TextMetricsPanel.tsx'
import { useElementSize } from './useElementSize.ts'

/**
 * The resize lab.
 *
 * ⚠ **There is no chart here, and that is not an omission.** `planChart()` lands at A3 and
 * the renderer at A4; what exists today is `@gx/core`'s A2 surface — the plan *contract*,
 * size classification, and text measurement. Drawing a placeholder chart would make the
 * playground look further along than the library is, which is the one thing a progress
 * view must not do.
 *
 * What it does show is every input the resolver will consult and every published threshold
 * those inputs cross, live, as you drag the handle.
 */
export function App() {
  const [ref, size] = useElementSize<HTMLDivElement>()
  const [cellSize, setCellSize] = useState(100)

  const cols = cellSize > 0 ? Math.floor(size.width / cellSize) : 0
  const rows = cellSize > 0 ? Math.floor(size.height / cellSize) : 0

  const ctx: SizeContext = {
    width: size.width,
    height: size.height,
    cols,
    rows,
    aspect: resolveAspect(size.width, size.height),
    sizeClass: resolveSizeClass(cols, rows),
  }

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
          Milestone A2. <code>planChart()</code> arrives at A3 and the renderer at A4, so
          there is deliberately no chart to look at yet.
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
              {cols} × {rows} cells · {ctx.aspect}
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
            <Row k="cols" v={String(cols)} />
            <Row k="rows" v={String(rows)} />
            <Row k="aspect" v={ctx.aspect} />
            <Row k="sizeClass" v={ctx.sizeClass} />
          </dl>
        </section>

        <section>
          <h2>Nominal cell size</h2>
          <label className="control">
            <input
              type="range"
              min={40}
              max={200}
              step={5}
              value={cellSize}
              onChange={(e) => {
                setCellSize(Number(e.target.value))
              }}
            />
            <output>{cellSize} px</output>
          </label>
          <p className="warn">
            <strong>This control is an open question, not a feature.</strong>{' '}
            <code>resolveSizeClass()</code> takes grid <em>cells</em>, because that is what
            the published ladder is written in. A chart rendered outside a dashboard grid
            has no cells, and no document in the corpus says what one pixel-derived cell is
            worth. Rather than pick a number and let it harden into a default, the
            playground makes the conversion something you have to move by hand — so the gap
            is visible every time anyone uses it.
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
              height={size.height}
              at={DEFAULT_POLICY.horizonMinHeight}
              label="a 2-band horizon is still readable"
              cite="Heer 2009"
            />
            <Threshold
              height={size.height}
              at={DEFAULT_POLICY.plotHeightOptimal}
              label="optimal for a line; below this, change encoding"
              cite="Heer 2009"
            />
            <Threshold
              height={size.height}
              at={DEFAULT_POLICY.plotHeightMinValues}
              label="below this, value-estimation error rises (p < 0.001)"
              cite="Heer & Bostock 2010"
            />
            <Threshold
              height={size.height}
              at={DEFAULT_POLICY.plotHeightSaturation}
              label="little benefit beyond; extra space buys content, not plot"
              cite="Heer & Bostock 2010"
            />
          </ul>
          <p className="note">
            ⚠ Compared against the <em>widget</em> height here. The real resolver compares
            against <em>plot</em> height — what is left after axes and labels take their
            share — which A3 computes and A2 cannot.
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
