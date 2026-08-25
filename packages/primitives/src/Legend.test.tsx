import {
  describeShape,
  planChart,
  sizeContextFromPixels,
  type ArcFrame,
  type CellFrame,
  type Series,
} from '@gx/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Chart } from './Chart.tsx'
import { Legend, legendEntries } from './Legend.tsx'

function series(id: string, label: string | undefined, value: number | null): Series {
  return label === undefined
    ? { id, points: [{ x: 0, y: value }] }
    : { id, label, points: [{ x: 0, y: value }] }
}

const DATA: readonly Series[] = [
  series('alpha', 'Shared', 10),
  series('beta', 'Shared', 20),
  series('gamma', undefined, null),
]

function stagePlan(data: readonly Series[] = DATA) {
  return planChart('line', sizeContextFromPixels(1000, 700), describeShape(data))
}

describe('static legend', () => {
  it('renders no output for absent and direct plans', () => {
    expect(renderToStaticMarkup(<Legend plan={{ placement: 'absent' }} series={DATA} />)).toBe('')
    expect(renderToStaticMarkup(<Legend plan={{ placement: 'direct' }} series={DATA} />)).toBe('')
  })

  it('renders internal entries in stable series order and preserves duplicate labels', () => {
    const plan = { placement: 'internal', maxEntries: 2 } as const
    const html = renderToStaticMarkup(<Legend plan={plan} series={DATA} />)
    expect(html).toContain('data-legend-placement="internal"')
    expect([...html.matchAll(/data-series-id="([^"]+)"/g)].map((match) => match[1])).toEqual([
      'alpha',
      'beta',
    ])
    expect((html.match(/>Shared</g) ?? []).length).toBe(2)
    expect(html).not.toContain('data-series-id="gamma"')
  })

  it('uses stable IDs for missing or whitespace-only labels', () => {
    const data = [series('missing', undefined, null), series('blank', '   ', null)]
    const plan = { placement: 'internal', maxEntries: 8 } as const
    const html = renderToStaticMarkup(<Legend plan={plan} series={data} />)
    expect(html).toContain('title="missing">missing</span>')
    expect(html).toContain('title="blank">blank</span>')
  })

  it('honours external value and percentage detail without changing entry order', () => {
    const plan = {
      placement: 'external',
      position: 'right',
      maxEntries: 8,
      showValues: true,
      showPercent: true,
    } as const
    const html = renderToStaticMarkup(<Legend plan={plan} series={DATA} />)
    expect(html).toContain('data-legend-position="right"')
    expect(html).toContain('>10 · 33%</span>')
    expect(html).toContain('>20 · 67%</span>')
    expect(html).toContain('>— · —</span>')
  })

  it('identifies donut slices rather than repeating the source series label', () => {
    const arcs = [
      {
        id: 'slice:alpha',
        label: 'Alpha',
        value: 40,
        share: 0.8,
        startAngle: 0,
        endAngle: 1,
        cx: 20,
        cy: 20,
        innerRadius: 8,
        outerRadius: 18,
        d: 'M0 0',
        other: false,
      },
      {
        id: 'slice:other',
        label: 'Other',
        value: 10,
        share: 0.2,
        startAngle: 1,
        endAngle: 2,
        cx: 20,
        cy: 20,
        innerRadius: 8,
        outerRadius: 18,
        d: 'M0 0',
        other: true,
      },
    ] satisfies readonly ArcFrame[]
    const plan = {
      placement: 'external',
      position: 'right',
      maxEntries: 8,
      showValues: true,
      showPercent: true,
    } as const
    const html = renderToStaticMarkup(<Legend plan={plan} series={DATA} arcs={arcs} />)

    expect(html).toContain('data-legend-family="donut"')
    expect(html).toContain('aria-label="Donut categories"')
    expect(html).toContain('data-slice-label="Alpha"')
    expect(html).toContain('data-slice-label="Other"')
    expect(html).toContain('>40 · 80%</span>')
    expect(html).not.toContain('data-series-id=')
  })

  it('renders a shared heatmap intensity scale with the observed minimum and maximum', () => {
    const cells = [
      { x: 0, y: 0, width: 10, height: 10, value: -2, intensity: 0, column: 0, row: 0 },
      { x: 10, y: 0, width: 10, height: 10, value: 18, intensity: 4, column: 1, row: 0 },
      { x: 20, y: 0, width: 10, height: 10, value: null, intensity: null, column: 2, row: 0 },
    ] satisfies readonly CellFrame[]
    const plan = {
      placement: 'external',
      position: 'right',
      maxEntries: 8,
      showValues: true,
      showPercent: false,
    } as const
    const html = renderToStaticMarkup(<Legend plan={plan} series={DATA} heatmapCells={cells} />)

    expect(html).toContain('data-legend-family="heatmap"')
    expect(html).toContain('aria-label="Heatmap intensity"')
    expect((html.match(/data-heatmap-intensity=/g) ?? []).length).toBe(5)
    expect(html).toContain('>Low</span><span class="gx-legend__detail">−2</span>')
    expect(html).toContain('>High</span><span class="gx-legend__detail">18</span>')
    expect(html).not.toContain('data-series-id=')
  })

  it('caps fractional and zero capacities without mutating source data', () => {
    const plan = { placement: 'internal', maxEntries: 1.9 } as const
    expect(legendEntries(plan, DATA).map((entry) => entry.series.id)).toEqual(['alpha'])
    expect(DATA).toHaveLength(3)
    expect(legendEntries({ placement: 'internal', maxEntries: 0 }, DATA)).toEqual([])
  })

  it('integrates the external legend into static Chart output without duplicating direct labels', () => {
    const many = Array.from({ length: 5 }, (_, index) => series(`series-${index}`, `S${index}`, index + 1))
    const ctx = sizeContextFromPixels(1000, 700)
    const plan = planChart('line', ctx, describeShape(many))
    expect(plan.legend.placement).toBe('external')
    expect(plan.labels.seriesLabels).toBe('direct-end')
    const html = renderToStaticMarkup(
      <Chart plan={plan} data={many} ctx={ctx} title='Legend chart' id='legend' />,
    )
    expect(html).toContain('data-legend-placement="external"')
    expect(html).toContain('data-series-id="series-4"')

    const directPlan = stagePlan()
    const directCtx = sizeContextFromPixels(1000, 700)
    const directHtml = renderToStaticMarkup(
      <Chart plan={directPlan} data={DATA} ctx={directCtx} title='Direct chart' id='direct' />,
    )
    expect(directPlan.legend.placement).toBe('direct')
    expect(directHtml).not.toContain('data-legend-placement=')
  })
})
