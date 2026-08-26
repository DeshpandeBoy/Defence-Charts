import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { MarkRendererInput } from '../../renderer-seam.ts'
import {
  PROGRESS_HORIZONTAL_FIXTURE,
  PROGRESS_INDETERMINATE_FIXTURE,
  PROGRESS_RADIAL_OVER_TARGET_FIXTURE,
  PROGRESS_RENDERER_FRAME,
} from './fixture.ts'
import { PROGRESS_MARK_RENDERERS, renderProgress } from './renderer.tsx'

const input = {
  frame: PROGRESS_RENDERER_FRAME,
  plan: {
    type: 'progress',
    marks: {
      primary: { kind: 'progress', orientation: 'horizontal' },
    },
  },
  policy: {},
} as unknown as MarkRendererInput

describe('progress family renderer', () => {
  it('registers explicit empty and progress boundaries only', () => {
    expect(PROGRESS_MARK_RENDERERS.map((entry) => entry.markKinds)).toEqual([['none'], ['progress']])
    expect(Object.isFrozen(PROGRESS_MARK_RENDERERS)).toBe(true)
  })

  it('renders horizontal track and fill geometry with stable semantic attributes', () => {
    const html = renderToStaticMarkup(renderProgress(input))

    expect(html).toContain('class="shiftcharts-progress shiftcharts-progress--horizontal shiftcharts-progress--partial"')
    expect(html).toContain('data-progress-series-id="completion"')
    expect(html).toContain('data-progress-orientation="horizontal"')
    expect(html).toContain('data-progress-current="50"')
    expect(html).toContain('data-progress-target="100"')
    expect(html).toContain('data-progress-part="track"')
    expect(html).toContain('data-progress-part="fill"')
    expect(html).toContain('x="12"')
    expect(html).toContain('width="88"')
    expect(html).not.toContain('data-progress-part="state"')
  })

  it('renders radial paths and visible over-target text without relying on colour', () => {
    const radial = {
      ...input,
      frame: { ...PROGRESS_RENDERER_FRAME, progress: PROGRESS_RADIAL_OVER_TARGET_FIXTURE },
      plan: {
        ...input.plan,
        marks: { primary: { kind: 'progress', orientation: 'radial' } },
      },
    } as unknown as MarkRendererInput
    const html = renderToStaticMarkup(renderProgress(radial))

    expect(html).toContain('class="shiftcharts-progress shiftcharts-progress--radial shiftcharts-progress--over-target"')
    expect(html).toContain('data-progress-over-target="25"')
    expect(html).toContain('data-progress-state="over-target"')
    expect(html).toContain('transform="translate(64, 64)"')
    expect((html.match(/class="shiftcharts-progress__track"/g) ?? []).length).toBe(1)
    expect((html.match(/class="shiftcharts-progress__fill"/g) ?? []).length).toBe(1)
    expect(html).toContain('data-progress-part="state"')
    expect(html).toContain('>Over target<')
  })

  it('keeps indeterminate/missing target visible and does not emit fill geometry', () => {
    const indeterminate = {
      ...input,
      frame: { ...PROGRESS_RENDERER_FRAME, progress: PROGRESS_INDETERMINATE_FIXTURE },
    } as unknown as MarkRendererInput
    const html = renderToStaticMarkup(renderProgress(indeterminate))

    expect(html).toContain('data-progress-state="missing-target"')
    expect(html).toContain('data-progress-target="missing"')
    expect(html).toContain('data-progress-indeterminate="true"')
    expect(html).toContain('data-progress-part="state"')
    expect(html).toContain('>Target unavailable<')
    expect(html).toContain('data-progress-part="track"')
    expect(html).not.toContain('class="shiftcharts-progress__fill"')
  })

  it('fails explicitly when the shared frame geometry is absent or invalid', () => {
    expect(() => renderProgress({ ...input, frame: { ...input.frame, progress: null } })).toThrow(
      /requires shared SeriesFrame\.progress geometry/,
    )

    const invalid = {
      ...input,
      frame: {
        ...PROGRESS_RENDERER_FRAME,
        progress: { ...PROGRESS_HORIZONTAL_FIXTURE, ratio: 2 },
      },
    } as unknown as MarkRendererInput
    expect(() => renderProgress(invalid)).toThrow(/ratio must be clamped/)
  })

  it('rejects a plan/frame orientation mismatch instead of drawing the wrong geometry', () => {
    const radial = {
      ...input,
      frame: { ...PROGRESS_RENDERER_FRAME, progress: PROGRESS_RADIAL_OVER_TARGET_FIXTURE },
    } as unknown as MarkRendererInput
    expect(() => renderProgress(radial)).toThrow(/does not match mark 'horizontal'/)
  })
})
