import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { describeShape, planChart, sizeContextFromPixels } from '@shiftcharts/core'

import { Chart } from '../../Chart.tsx'

const DATA = [
  {
    id: 'revenue',
    label: 'Revenue',
    unit: 'USD',
    target: 60,
    status: 'positive' as const,
    points: [
      { x: 1, y: 48 },
      { x: 2, y: 54 },
      { x: 3, y: 58 },
    ],
  },
] as const

describe('KPI hook-free composition', () => {
  it('renders value metadata and its accessible table equivalent without a client boundary', () => {
    const ctx = sizeContextFromPixels(240, 80)
    const plan = planChart('kpi', ctx, describeShape(DATA))
    const html = renderToStaticMarkup(
      <Chart plan={plan} data={DATA} ctx={ctx} title="Revenue" id="kpi" />,
    )

    expect(html).toContain('data-chart-type="kpi"')
    expect(html).toContain('shiftcharts-value__unit')
    expect(html).toContain(' USD')
    expect(html).toContain('shiftcharts-value__delta')
    expect(html).toContain('+4 (54)')
    expect(html).toContain('target 60')
    expect(html).toContain('status positive')
    expect(html).toContain('<th scope="col">Unit</th>')
    expect(html).toContain('<th scope="col">Target</th>')
    expect(html).toContain('<th scope="col">Status</th>')
    expect(html).toContain('<th scope="col">Direction</th>')
    expect(html).toContain('>up<')
  })
})
