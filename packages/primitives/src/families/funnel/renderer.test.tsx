import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { MarkRendererInput } from '../../renderer-seam.ts'
import {
  FUNNEL_EMPTY_FRAME,
  FUNNEL_RENDERER_FRAME,
  FUNNEL_ZERO_BASELINE_FRAME,
} from './fixture.ts'
import { FUNNEL_MARK_RENDERERS, renderFunnel } from './renderer.tsx'

const input = {
  frame: {
    id: 'checkout',
    label: 'Checkout',
    index: 0,
    funnel: FUNNEL_RENDERER_FRAME,
  },
  plan: {
    type: 'funnel',
    marks: {
      primary: { kind: 'funnel', orientation: 'vertical', detail: 'stages' },
      renderer: 'svg',
    },
  },
  policy: {},
} as unknown as MarkRendererInput

describe('funnel family renderer', () => {
  it('registers only explicit empty and funnel marks', () => {
    expect(FUNNEL_MARK_RENDERERS.map((entry) => entry.markKinds)).toEqual([['none'], ['funnel']])
    expect(Object.isFrozen(FUNNEL_MARK_RENDERERS)).toBe(true)
  })

  it('renders stage geometry, stable IDs, values, and labels from the shared frame', () => {
    const html = renderToStaticMarkup(renderFunnel(input))

    expect(html).toContain('class="gx-funnel gx-funnel--vertical gx-funnel--stages"')
    expect(html).toContain('data-funnel-series-id="checkout"')
    expect(html).toContain('data-funnel-stage-id="checkout:landing"')
    expect(html).toContain('data-stage-id="checkout:details"')
    expect(html).toContain('data-funnel-stage-value="800"')
    expect(html).toContain('data-funnel-stage-label="Complete"')
    expect(html).toContain('>Landing: value 1000<')
    expect(html).toContain('>Details: value 800<')
    expect(html).toContain('x="40"')
    expect(html).toContain('width="128"')
    expect((html.match(/class="gx-funnel-stage gx-funnel-stage__mark"/g) ?? []).length).toBe(3)
  })

  it('renders the Tile summary without inventing stage rectangles', () => {
    const summary = {
      ...input,
      plan: {
        ...input.plan,
        marks: { ...input.plan.marks, primary: { kind: 'funnel', orientation: 'vertical', detail: 'summary' } },
      },
    } as MarkRendererInput
    const html = renderToStaticMarkup(renderFunnel(summary))

    expect(html).toContain('data-funnel-detail="summary"')
    expect(html).toContain('data-funnel-part="summary"')
    expect(html).toContain('data-funnel-overall-conversion="0.25"')
    expect(html).toContain('>Overall conversion: 25%<')
    expect(html).not.toContain('gx-funnel-stage__mark')
  })

  it('renders Canvas drop-off and Stage breakdown as visible text', () => {
    const dropoff = {
      ...input,
      plan: {
        ...input.plan,
        marks: { ...input.plan.marks, primary: { kind: 'funnel', orientation: 'horizontal', detail: 'dropoff' } },
      },
    } as MarkRendererInput
    const breakdown = {
      ...input,
      plan: {
        ...input.plan,
        marks: { ...input.plan.marks, primary: { kind: 'funnel', orientation: 'vertical', detail: 'breakdown' } },
      },
    } as MarkRendererInput

    const dropoffHtml = renderToStaticMarkup(renderFunnel(dropoff))
    const breakdownHtml = renderToStaticMarkup(renderFunnel(breakdown))

    expect(dropoffHtml).toContain('data-funnel-orientation="horizontal"')
    expect(dropoffHtml).toContain('>Details: value 800; drop-off 20%<')
    expect(dropoffHtml).toContain('data-funnel-stage-dropoff="0.2"')
    expect(breakdownHtml).toContain('>Details: value 800; share 80%; conversion 80%; drop-off 20%<')
    expect(breakdownHtml).toContain('data-funnel-stage-conversion="0.8"')
  })

  it('keeps zero-baseline conversion and zero-sized geometry explicit', () => {
    const zero = {
      ...input,
      frame: { ...input.frame, funnel: FUNNEL_ZERO_BASELINE_FRAME },
      plan: {
        ...input.plan,
        marks: { ...input.plan.marks, primary: { kind: 'funnel', orientation: 'vertical', detail: 'breakdown' } },
      },
    } as MarkRendererInput
    const html = renderToStaticMarkup(renderFunnel(zero))

    expect(html).toContain('data-funnel-overall-conversion="missing"')
    expect(html).toContain('data-funnel-stage-conversion="missing"')
    expect(html).toContain('conversion unavailable')
    expect(html).toContain('width="0"')
    expect(html).toContain('height="0"')
    expect(html).not.toMatch(/(?:NaN|Infinity)/)
  })

  it('returns no mark for an empty shared frame', () => {
    const empty = { ...input, frame: { ...input.frame, funnel: FUNNEL_EMPTY_FRAME } } as MarkRendererInput
    expect(renderToStaticMarkup(renderFunnel(empty))).toBe('')
  })

  it('is deterministic and preserves stage identity through repeated renders', () => {
    const first = renderToStaticMarkup(renderFunnel(input))
    const second = renderToStaticMarkup(renderFunnel(input))

    expect(first).toBe(second)
    expect((first.match(/data-funnel-stage-id=/g) ?? []).length).toBe(6)
    expect(JSON.parse(JSON.stringify(FUNNEL_RENDERER_FRAME))).toEqual(FUNNEL_RENDERER_FRAME)
  })

  it('rejects wrong plan, wrong mark, missing frame seam, and unsupported canvas output', () => {
    const wrongPlan = { ...input, plan: { ...input.plan, type: 'bar' } } as MarkRendererInput
    expect(() => renderFunnel(wrongPlan)).toThrow(/requires a funnel plan; received 'bar'/)

    const wrongMark = {
      ...input,
      plan: { ...input.plan, marks: { ...input.plan.marks, primary: { kind: 'bar', stacked: false, grouped: false } } },
    } as MarkRendererInput
    expect(() => renderFunnel(wrongMark)).toThrow(/requires a funnel mark; received 'bar'/)

    const missingFrame = { ...input, frame: { ...input.frame, funnel: null } } as MarkRendererInput
    expect(() => renderFunnel(missingFrame)).toThrow(/requires shared SeriesFrame\.funnel geometry/)

    const canvas = {
      ...input,
      plan: { ...input.plan, marks: { ...input.plan.marks, renderer: 'canvas' } },
    } as MarkRendererInput
    expect(() => renderFunnel(canvas)).toThrow(/refusing to rasterize stages/)
  })

  it('rejects negative, duplicate, non-finite, and malformed frame values explicitly', () => {
    const negative = {
      ...input,
      frame: {
        ...input.frame,
        funnel: {
          ...FUNNEL_RENDERER_FRAME,
          stages: [{ ...FUNNEL_RENDERER_FRAME.stages[0], value: -1 }],
        },
      },
    } as unknown as MarkRendererInput
    expect(() => renderFunnel(negative)).toThrow(/value must be finite and non-negative/)

    const duplicate = {
      ...input,
      frame: {
        ...input.frame,
        funnel: {
          ...FUNNEL_RENDERER_FRAME,
          stages: [FUNNEL_RENDERER_FRAME.stages[0], { ...FUNNEL_RENDERER_FRAME.stages[1], id: 'checkout:landing' }],
        },
      },
    } as unknown as MarkRendererInput
    expect(() => renderFunnel(duplicate)).toThrow(/stage id 'checkout:landing' is duplicated/)

    const nonFinite = {
      ...input,
      frame: {
        ...input.frame,
        funnel: {
          ...FUNNEL_RENDERER_FRAME,
          stages: [{ ...FUNNEL_RENDERER_FRAME.stages[0], x: Number.NaN }],
        },
      },
    } as unknown as MarkRendererInput
    expect(() => renderFunnel(nonFinite)).toThrow(/x geometry must be finite/)

    const negativeGeometry = {
      ...input,
      frame: {
        ...input.frame,
        funnel: {
          ...FUNNEL_RENDERER_FRAME,
          stages: [{ ...FUNNEL_RENDERER_FRAME.stages[0], width: -1 }],
        },
      },
    } as unknown as MarkRendererInput
    expect(() => renderFunnel(negativeGeometry)).toThrow(/geometry cannot have negative size/)

    const missingStages = {
      ...input,
      frame: { ...input.frame, funnel: { ...FUNNEL_RENDERER_FRAME, stages: undefined } },
    } as unknown as MarkRendererInput
    expect(() => renderFunnel(missingStages)).toThrow(/requires shared FunnelFrame\.stages geometry/)
  })
})
