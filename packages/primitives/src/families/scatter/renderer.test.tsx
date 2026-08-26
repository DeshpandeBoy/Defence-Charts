import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { MarkRendererInput } from '../../renderer-seam.ts'
import { SCATTER_MARK_RENDERERS, renderScatter } from './renderer.tsx'
import { SCATTER_RENDERER_FIXTURE } from './fixture.ts'

const base = {
  frame: {
    id: 'risk',
    label: 'Risk',
    index: 0,
    line: null,
    area: null,
    bands: [],
    cells: [],
    points: SCATTER_RENDERER_FIXTURE.points,
    extrema: null,
  },
  plan: { type: 'scatter', marks: { primary: { kind: 'point' }, renderer: 'svg' } },
  policy: {},
} as unknown as MarkRendererInput

describe('scatter family renderer', () => {
  it('registers explicit none and point marks', () => {
    expect(SCATTER_MARK_RENDERERS.map((entry) => entry.markKinds)).toEqual([['none'], ['point']])
  })

  it('renders every defined point with stable data identity', () => {
    const html = renderToStaticMarkup(renderScatter(base))
    expect((html.match(/shiftcharts-scatter-point/g) ?? []).length).toBe(3)
    expect(html).toContain('data-scatter-index="0"')
    expect(html).toContain('data-scatter-index="2"')
  })

  it('refuses the unimplemented canvas boundary instead of sampling', () => {
    const canvas = {
      ...base,
      plan: { ...base.plan, marks: { ...base.plan.marks, renderer: 'canvas' } },
    } as MarkRendererInput
    expect(() => renderScatter(canvas)).toThrow(/canvas rendering is not implemented.*sample points/)
  })
})
