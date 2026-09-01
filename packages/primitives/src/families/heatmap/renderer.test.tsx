import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { MarkRendererInput } from '../../renderer-seam.ts'
import { HEATMAP_RENDERER_FIXTURE, HEATMAP_SOURCE_OBSERVATIONS } from './fixture.ts'
import { HEATMAP_MARK_RENDERERS, renderHeatmap } from './renderer.tsx'

const input = {
  frame: HEATMAP_RENDERER_FIXTURE,
  plan: {
    type: 'heatmap',
    marks: {
      primary: { kind: 'cell', bandStart: 0, bandEnd: 1 },
      renderer: 'svg',
    },
  },
  policy: {},
} as unknown as MarkRendererInput

describe('heatmap family renderer', () => {
  it('registers only explicit empty and cell marks', () => {
    expect(HEATMAP_MARK_RENDERERS.map((entry) => entry.markKinds)).toEqual([['none'], ['cell']])
    expect(Object.isFrozen(HEATMAP_MARK_RENDERERS)).toBe(true)
  })

  it('renders every finite shared-frame cell with supplied identity and value metadata', () => {
    const html = renderToStaticMarkup(renderHeatmap(input))

    expect((html.match(/class="shiftcharts-cell shiftcharts-heatmap-cell"/g) ?? []).length).toBe(4)
    expect(html).toContain('data-cell-id="activity:missing"')
    expect(html).toContain('data-shiftcharts-mark-id="activity:cell:activity:missing"')
    expect(html).toContain('data-cell-id="activity:extreme"')
    expect(html).toContain('data-cell-series-id="activity"')
    expect(html).toContain('data-heatmap-cell-id="activity:missing"')
    expect(html).toContain('data-heatmap-state="missing"')
    expect(html).toContain('data-heatmap-value="0"')
    expect(html).toContain('data-heatmap-value="-7"')
    expect(html).toContain(`data-heatmap-value="${Number.MAX_VALUE}"`)
    expect(html).toContain('data-heatmap-intensity="1"')
    expect(html).toContain('data-heatmap-intensity="4"')
    expect(html).toContain('data-cell-value="missing"')
    expect(html).toContain('data-cell-value="0"')
    expect(html).toContain('data-cell-value="-7"')
    expect(html).toContain(`data-cell-value="${Number.MAX_VALUE}"`)
    expect(html).toContain('x="8"')
    expect(html).toContain('y="-4"')
    expect(html).toContain('width="8"')
    expect(html).toContain('data-cell-intensity="0.25"')
  })

  it('preserves duplicate geometry as distinct deterministic fallback cells', () => {
    const duplicate = {
      ...input,
      frame: {
        ...HEATMAP_RENDERER_FIXTURE,
        cells: [
          { ...HEATMAP_RENDERER_FIXTURE.cells[0], id: undefined },
          { ...HEATMAP_RENDERER_FIXTURE.cells[0], id: undefined },
        ],
      },
    } as unknown as MarkRendererInput
    const html = renderToStaticMarkup(renderHeatmap(duplicate))

    expect((html.match(/class="shiftcharts-cell shiftcharts-heatmap-cell"/g) ?? []).length).toBe(2)
    expect(html).toContain('data-cell-id="activity:cell:0"')
    expect(html).toContain('data-cell-id="activity:cell:1"')
    expect(html).toContain('data-heatmap-cell-id="activity:cell:0"')
  })

  it('renders geometry-only cells without requiring optional metadata', () => {
    const geometryOnly = {
      ...input,
      frame: {
        ...HEATMAP_RENDERER_FIXTURE,
        cells: HEATMAP_RENDERER_FIXTURE.cells.map((cell) => ({
          x: cell.x,
          y: cell.y,
          width: cell.width,
          height: cell.height,
        })),
      },
    } as unknown as MarkRendererInput
    const html = renderToStaticMarkup(renderHeatmap(geometryOnly))

    expect((html.match(/class="shiftcharts-cell shiftcharts-heatmap-cell"/g) ?? []).length).toBe(4)
    expect(html).toContain('data-heatmap-cell-id="activity:cell:0"')
    expect(html).not.toContain('data-heatmap-state=')
    expect(html).not.toContain('data-heatmap-value=')
    expect(html).not.toContain('data-heatmap-intensity=')
  })

  it('rejects duplicate supplied cell identity instead of collapsing a cell', () => {
    const duplicateId = {
      ...input,
      frame: {
        ...HEATMAP_RENDERER_FIXTURE,
        cells: [
          HEATMAP_RENDERER_FIXTURE.cells[0],
          { ...HEATMAP_RENDERER_FIXTURE.cells[1], id: 'activity:missing' },
        ],
      },
    } as unknown as MarkRendererInput

    expect(() => renderHeatmap(duplicateId)).toThrow(/cell identities must be unique/)
  })

  it('keeps missing, zero, negative, and extreme source cases explicit in the fixture contract', () => {
    expect(HEATMAP_SOURCE_OBSERVATIONS.map((observation) => observation.value)).toEqual([
      null,
      0,
      -7,
      Number.MAX_VALUE,
    ])
    expect(HEATMAP_SOURCE_OBSERVATIONS[0]?.cellIndex).toBe(0)
    expect(HEATMAP_RENDERER_FIXTURE.cells).toHaveLength(4)
    expect(renderToStaticMarkup(renderHeatmap(input))).not.toContain('NaN')
  })

  it('returns empty output for an empty shared frame', () => {
    const empty = {
      ...input,
      frame: { ...HEATMAP_RENDERER_FIXTURE, cells: [] },
    } as unknown as MarkRendererInput

    expect(renderToStaticMarkup(renderHeatmap(empty))).toBe('')
  })

  it('is deterministic and JSON-safe', () => {
    const first = renderToStaticMarkup(renderHeatmap(input))
    const second = renderToStaticMarkup(renderHeatmap(input))

    expect(first).toBe(second)
    expect(JSON.parse(JSON.stringify(HEATMAP_RENDERER_FIXTURE.cells))).toEqual(
      HEATMAP_RENDERER_FIXTURE.cells,
    )
    expect(first).not.toMatch(/(?:NaN|Infinity)/)
  })

  it('fails explicitly for missing or malformed shared geometry', () => {
    const missing = {
      ...input,
      frame: { ...HEATMAP_RENDERER_FIXTURE, cells: undefined },
    } as unknown as MarkRendererInput
    expect(() => renderHeatmap(missing)).toThrow(/requires shared SeriesFrame\.cells geometry/)

    const nonFinite = {
      ...input,
      frame: {
        ...HEATMAP_RENDERER_FIXTURE,
        cells: [{ ...HEATMAP_RENDERER_FIXTURE.cells[0], x: Number.NaN }],
      },
    } as unknown as MarkRendererInput
    expect(() => renderHeatmap(nonFinite)).toThrow(/cell 0 x geometry must be finite/)

    const negativeSize = {
      ...input,
      frame: {
        ...HEATMAP_RENDERER_FIXTURE,
        cells: [{ ...HEATMAP_RENDERER_FIXTURE.cells[0], height: -1 }],
      },
    } as unknown as MarkRendererInput
    expect(() => renderHeatmap(negativeSize)).toThrow(/cell 0 geometry cannot have negative size/)

    const invalidIntensity = {
      ...input,
      frame: {
        ...HEATMAP_RENDERER_FIXTURE,
        cells: [{ ...HEATMAP_RENDERER_FIXTURE.cells[0], intensity: 2 }],
      },
    } as unknown as MarkRendererInput
    expect(() => renderHeatmap(invalidIntensity)).toThrow(/intensity must be between 0 and 1/)
  })

  it('rejects unsupported canvas and non-cell renderer modes instead of falling back', () => {
    const canvas = {
      ...input,
      plan: { ...input.plan, marks: { ...input.plan.marks, renderer: 'canvas' } },
    } as MarkRendererInput
    expect(() => renderHeatmap(canvas)).toThrow(/mode 'canvas' is not implemented.*rasterize cells/)

    const line = {
      ...input,
      plan: { ...input.plan, marks: { ...input.plan.marks, primary: { kind: 'line', area: false } } },
    } as MarkRendererInput
    expect(() => renderHeatmap(line)).toThrow(/requires a cell mark; received 'line'/)

    const otherType = {
      ...input,
      plan: { ...input.plan, type: 'bar' },
    } as MarkRendererInput
    expect(() => renderHeatmap(otherType)).toThrow(/requires a heatmap plan; received 'bar'/)
  })
})
