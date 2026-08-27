import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { MarkRendererInput } from '../../renderer-seam.ts'
import { BAR_RENDERER_FIXTURE } from './fixture.ts'
import { BAR_MARK_RENDERERS, renderBar } from './renderer.tsx'

const input = {
  frame: {
    id: 'north',
    label: 'North',
    index: 0,
    line: null,
    area: null,
    bands: [],
    cells: BAR_RENDERER_FIXTURE.cells,
    points: [],
    extrema: null,
  },
  plan: {
    type: 'bar',
    marks: { primary: { kind: 'bar', stacked: false, grouped: false } },
  },
  policy: {},
} as unknown as MarkRendererInput

describe('bar family renderer', () => {
  it('registers only explicit none and bar marks', () => {
    expect(BAR_MARK_RENDERERS.map((entry) => entry.markKinds)).toEqual([['none'], ['bar']])
  })

  it('renders stable keyed rectangles from frame cells', () => {
    const html = renderToStaticMarkup(renderBar(input))
    expect(html).toContain('class="shiftcharts-bar"')
    expect(html).toContain('data-bar-index="0"')
    expect(html).toContain('data-series-id="north"')
    expect(html).toContain('data-series-index="0"')
    expect(html).toContain('x="10"')
    expect(html).toContain('width="18"')
  })

  it('returns no geometry when the shared frame has not populated cells', () => {
    const empty = { ...input, frame: { ...input.frame, cells: [] } } as MarkRendererInput
    expect(renderToStaticMarkup(renderBar(empty))).toBe('')
  })
})
