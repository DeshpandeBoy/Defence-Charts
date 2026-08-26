import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { DataTable } from './DataTable.tsx'

const PLAN = {
  present: true,
  disclosure: 'button',
  initiallyExpanded: true,
  columns: 'all',
} as const

describe('family data tables', () => {
  it('uses donut category names instead of numeric x positions', () => {
    const html = renderToStaticMarkup(
      <DataTable
        data={[{ id: 'parts', points: [{ x: 0, category: 'North', y: 10 }, { x: 1, category: 'South', y: 20 }] }]}
        plan={PLAN}
        caption="Parts"
        donut
      />,
    )

    expect(html).toContain('<th scope="row">North</th>')
    expect(html).toContain('<th scope="row">South</th>')
    expect(html).not.toContain('<th scope="row">1</th>')
  })

  it('uses funnel stage names instead of numeric x positions', () => {
    const html = renderToStaticMarkup(
      <DataTable
        data={[{ id: 'funnel', points: [{ x: 0, category: 'Landing', y: 100 }, { x: 1, category: 'Complete', y: 40 }] }]}
        plan={PLAN}
        caption="Funnel"
        funnel
      />,
    )

    expect(html).toContain('<th scope="row">Landing</th>')
    expect(html).toContain('<th scope="row">Complete</th>')
  })
})
