import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { MarkRendererInput } from '../../renderer-seam.ts'
import { DONUT_RENDERER_FIXTURE } from './fixture.ts'
import { DONUT_MARK_RENDERERS, renderDonut } from './renderer.tsx'

const input = {
  frame: DONUT_RENDERER_FIXTURE,
  plan: {
    type: 'donut',
    marks: {
      primary: { kind: 'arc', donut: true },
      renderer: 'svg',
    },
  },
  policy: {},
} as unknown as MarkRendererInput

describe('donut family renderer', () => {
  it('registers explicit empty and arc boundaries only', () => {
    expect(DONUT_MARK_RENDERERS.map((entry) => entry.markKinds)).toEqual([['none'], ['arc']])
    expect(Object.isFrozen(DONUT_MARK_RENDERERS)).toBe(true)
  })

  it('renders every supplied slice with stable IDs and a visible Other bucket', () => {
    const html = renderToStaticMarkup(renderDonut(input))

    expect((html.match(/class="shiftcharts-arc/g) ?? []).length).toBe(3)
    expect(html).toContain('data-slice-id="sales:north"')
    expect(html).toContain('data-shiftcharts-mark-id="arc:sales:north"')
    expect(html).toContain('data-slice-id="sales:south"')
    expect(html).toContain('data-slice-id="sales:other"')
    expect(html).toContain('data-slice-kind="other"')
    expect(html).toContain('data-slice-label="Other"')
    expect(html).toContain('transform="translate(96, 72)"')
    expect(html).toContain('d="M0,-48A48,48 0 0 1 45.65,14.77L22.83,7.38A24,24 0 0 0 0,-24Z"')
  })

  it('returns empty output when the shared frame has no visible arcs', () => {
    const empty = {
      ...input,
      frame: { ...DONUT_RENDERER_FIXTURE, arcs: [] },
    } as unknown as MarkRendererInput

    expect(renderToStaticMarkup(renderDonut(empty))).toBe('')
  })

  it('does not invent geometry when the shared frame seam is missing', () => {
    const missing = {
      ...input,
      frame: { ...DONUT_RENDERER_FIXTURE, arcs: undefined },
    } as unknown as MarkRendererInput

    expect(() => renderDonut(missing)).toThrow(/requires shared SeriesFrame\.arcs geometry/)
  })

  it('rejects the unimplemented canvas renderer and non-donut arc presentation', () => {
    const canvas = {
      ...input,
      plan: { ...input.plan, marks: { ...input.plan.marks, renderer: 'canvas' } },
    } as MarkRendererInput
    expect(() => renderDonut(canvas)).toThrow(/canvas rendering is not implemented.*rasterize arcs/)

    const pie = {
      ...input,
      plan: { ...input.plan, marks: { ...input.plan.marks, primary: { kind: 'arc', donut: false } } },
    } as MarkRendererInput
    expect(() => renderDonut(pie)).toThrow(/non-donut arc\/pie rendering is not implemented/)
  })

  it('rejects invalid geometry and duplicate slice identity instead of emitting misleading marks', () => {
    const negative = {
      ...input,
      frame: {
        ...DONUT_RENDERER_FIXTURE,
        arcs: [{ ...DONUT_RENDERER_FIXTURE.arcs[0], value: -1 }],
      },
    } as unknown as MarkRendererInput
    expect(() => renderDonut(negative)).toThrow(/finite non-negative value/)

    const duplicate = {
      ...input,
      frame: {
        ...DONUT_RENDERER_FIXTURE,
        arcs: [DONUT_RENDERER_FIXTURE.arcs[0], { ...DONUT_RENDERER_FIXTURE.arcs[1], id: 'sales:north' }],
      },
    } as unknown as MarkRendererInput
    expect(() => renderDonut(duplicate)).toThrow(/donut slice id 'sales:north' is duplicated/)

    const invalidPath = {
      ...input,
      frame: {
        ...DONUT_RENDERER_FIXTURE,
        arcs: [{ ...DONUT_RENDERER_FIXTURE.arcs[0], d: '' }],
      },
    } as unknown as MarkRendererInput
    expect(() => renderDonut(invalidPath)).toThrow(/requires shared local path geometry/)
  })

  it('keeps the existing Chart data table as the non-color equivalent', () => {
    const html = renderToStaticMarkup(renderDonut(input))

    expect(html).not.toContain('<text')
    expect(html).not.toContain('aria-label=')
  })
})
