import { describe, expect, it } from 'vitest'

import { KPI_PRIMITIVE_FIXTURE } from './fixture.ts'

describe('KPI primitive composition contract', () => {
  it('keeps the deterministic value metadata separate and serialisable', () => {
    const entry = KPI_PRIMITIVE_FIXTURE.value.entries[0]

    expect(entry).toMatchObject({
      seriesId: 'revenue',
      text: '58',
      unit: 'USD',
      target: { value: 60, text: '60' },
      status: 'positive',
      delta: { text: '+4', direction: 'up' },
      comparison: '54',
    })
    expect(JSON.parse(JSON.stringify(KPI_PRIMITIVE_FIXTURE))).toEqual(KPI_PRIMITIVE_FIXTURE)
  })

  it('documents composition through existing hook-free primitives', () => {
    expect(KPI_PRIMITIVE_FIXTURE.composition).toEqual({
      chartType: 'kpi',
      value: 'ValueDisplay',
      trend: 'line-axes-off',
      table: 'DataTable',
      primaryMark: 'line',
      statusTextRequired: true,
    })
    expect(KPI_PRIMITIVE_FIXTURE.composition.primaryMark).toBe('line')
  })

  it('preserves stable series identity between data and value frame', () => {
    expect(KPI_PRIMITIVE_FIXTURE.data[0]?.id).toBe(KPI_PRIMITIVE_FIXTURE.value.entries[0]?.seriesId)
  })
})
