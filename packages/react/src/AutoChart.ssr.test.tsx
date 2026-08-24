/**
 * `<AutoChart>` on a server, where there is no box to measure.
 *
 * ⚠ **A separate file from `AutoChart.test.tsx` because it must run without a DOM, and that
 * is the whole assertion.** `useElementSize` picks its effect hook at module scope from
 * `typeof window`, so importing it here binds the server branch; and `renderToStaticMarkup`
 * never runs effects at all. If any part of the measure-plan-render path reached for
 * `document`, a ref's `.getBoundingClientRect()`, or a layout effect's return value, it would
 * fail on the first render below rather than in a consumer's RSC page six months later.
 *
 * ⚠ This is the same proof `@gx/primitives`' `Chart.test.tsx` makes for the hook-free tree,
 * repeated one layer up where the hooks actually are. It does **not** prove a bundler cannot
 * break the boundary — that is gate **G4**, the Next.js App Router fixture with JS disabled,
 * deferred to share a CI browser job with G11's browser half. This is the half that costs
 * nothing and catches the common case.
 *
 * The interesting question this file settles is what the server should emit when nobody said
 * how big the chart is. The answer is: the wrapper, and nothing in it. See the `initialSize`
 * docblock in `useElementSize.ts` for why a plausible default would be worse than an empty
 * one — a guessed size paints a chart at the wrong rung and then visibly re-plans on hydrate,
 * which is precisely the flash `initialSize` exists to remove.
 */

import { describeShape, planChart, resolveSizeClass, sizeContextFromPixels } from '@gx/core'
import type { Series } from '@gx/core'
import { Chart } from '@gx/primitives'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AutoChart } from './AutoChart.tsx'

const DAY = 86_400_000
const START = Date.UTC(2024, 0, 1)

function series(id: string, values: readonly number[]): Series {
  return { id, label: id.toUpperCase(), points: values.map((y, i) => ({ x: new Date(START + i * DAY), y })) }
}

const DATA: readonly Series[] = [
  series('alpha', [10, 14, 9, 22, 18, 30, 27]),
  series('beta', [4, 6, 5, 9, 7, 11, 12]),
]

describe('the DOM is genuinely absent while this renders', () => {
  it('has no window and no document to reach for', () => {
    // ⚠ Asserted rather than assumed. A shared setup file, a stray import with a side
    // effect, or a future change to the Vitest defaults could hand this file a DOM, and
    // every test below would keep passing while proving nothing.
    expect(typeof globalThis.window).toBe('undefined')
    expect(typeof globalThis.document).toBe('undefined')
  })
})

describe('with no declared size, the server emits the wrapper and stops', () => {
  const html = renderToStaticMarkup(<AutoChart type="line" data={DATA} title="Revenue" id="t" />)

  it('emits the wrapper', () => {
    expect(html).toContain('class="gx-auto-chart"')
  })

  it('emits no chart, because it has no idea what size to draw one at', () => {
    expect(html).not.toContain('<svg')
    expect(html).not.toContain('<figure')
  })

  it('emits an empty wrapper rather than a placeholder with a height', () => {
    // ⚠ No skeleton, no spinner, no reserved box. A placeholder sized by the library is a
    // guess at a rung, and it is a guess the consumer's own CSS is better placed to make —
    // they are the ones who know how tall the container is. `overflow: hidden` and
    // `display: block` are all `auto-chart.css` asserts about this element.
    expect(html).toBe('<div class="gx-auto-chart"></div>')
  })
})

describe('with a declared size, the server emits a real chart at that rung', () => {
  const SIZE = { width: 700, height: 520 } as const
  const html = renderToStaticMarkup(
    <AutoChart type="line" data={DATA} title="Revenue" initialSize={SIZE} id="t" />,
  )

  it('emits an svg inside the wrapper', () => {
    expect(html).toContain('class="gx-auto-chart"')
    expect(html).toContain('<svg')
    expect(html).toContain('role="graphics-document"')
  })

  it('draws at the rung the resolver picks for that box, not a default one', () => {
    const ctx = sizeContextFromPixels(SIZE.width, SIZE.height)
    expect(html).toContain(`data-size-class="${resolveSizeClass(ctx.cols, ctx.rows)}"`)
  })

  it('is byte-identical to hand-wiring the same plan through <Chart>', () => {
    // ⚠ The claim `<AutoChart>` makes is that it adds *nothing* to the pipeline but the
    // measurement. This is that claim, stated so it can fail: any policy this component
    // applied on its own — a default, a clamp, a fallback rung — would show up as a
    // difference here.
    const ctx = sizeContextFromPixels(SIZE.width, SIZE.height)
    const plan = planChart('line', ctx, describeShape(DATA))
    const direct = renderToStaticMarkup(
      <div className="gx-auto-chart">
        <Chart plan={plan} data={DATA} ctx={ctx} title="Revenue" id="t" />
      </div>,
    )
    expect(html).toBe(direct)
  })

  it('does not serialize the client interaction layer into the static path', () => {
    expect(html).not.toContain('gx-interaction')
  })

  it('honours nominalCellSize, so a standalone chart can be told what a cell is', () => {
    const big = renderToStaticMarkup(
      <AutoChart
        type="line"
        data={DATA}
        title="Revenue"
        initialSize={SIZE}
        nominalCellSize={400}
        id="t"
      />,
    )
    // 700 × 520 is 6 × 5 cells at 100 and well under 3 × 3 at 400 — different families,
    // and therefore different charts. If this were equal, the prop would be decorative.
    expect(big).not.toBe(html)
    const ctx = sizeContextFromPixels(SIZE.width, SIZE.height, 400)
    expect(big).toContain(`data-size-class="${resolveSizeClass(ctx.cols, ctx.rows)}"`)
  })

  it('uses a supplied grid footprint instead of deriving cells from standalone pixels', () => {
    const dashboard = renderToStaticMarkup(
      <AutoChart
        type="line"
        data={DATA}
        title="Revenue"
        initialSize={{ width: 240, height: 88 }}
        gridSize={{ cols: 6, rows: 5 }}
        id="t-grid"
      />,
    )

    expect(dashboard).toContain(`data-size-class="${resolveSizeClass(6, 5)}"`)
    expect(dashboard).toContain('viewBox="0 0 240 88"')
  })

  it('composes a consumer class alongside its own rather than replacing it', () => {
    const themed = renderToStaticMarkup(
      <AutoChart
        type="line"
        data={DATA}
        title="Revenue"
        initialSize={SIZE}
        className="dashboard-tile"
        id="t"
      />,
    )
    expect(themed).toContain('class="gx-auto-chart dashboard-tile"')
  })
})

describe('the contract the resolver holds is the contract this holds', () => {
  it('renders the registered donut type on the measured SSR path', () => {
    const html = renderToStaticMarkup(
      <AutoChart
        type="donut"
        data={DATA}
        title="Revenue"
        initialSize={{ width: 700, height: 520 }}
        id="t"
      />,
    )
    expect(html).toContain('data-chart-type="donut"')
    expect(html).toContain('gx-arc')
  })

  it('renders the registered donut type even with no size', () => {
    // `planChart()` still runs synchronously on the first render, before a ResizeObserver
    // supplies a measured box; registered families must remain safe on this path.
    const html = renderToStaticMarkup(<AutoChart type="donut" data={DATA} title="Revenue" id="t" />)
    expect(html).toBe('<div class="gx-auto-chart"></div>')
  })
})
