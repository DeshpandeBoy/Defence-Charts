import {
  describeShape,
  planChart,
  resolveFrame,
  resolvePolicy,
  sizeContextFromPixels,
  type ChartPlan,
  type Series,
} from '@gx/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { BUILT_IN_MARK_RENDERERS, renderBuiltInMark } from './renderer-registry.ts'

const DATA: readonly Series[] = [
  { id: 'alpha', points: [{ x: 0, y: 1 }, { x: 1, y: 4 }, { x: 2, y: 2 }] },
]

function frameFor(plan: ChartPlan) {
  const ctx = sizeContextFromPixels(900, 520)
  return resolveFrame(plan, DATA, ctx, resolvePolicy()).series[0]
}

describe('D0.1 renderer seam', () => {
  it('keeps built-in renderer registration immutable and family-local', () => {
    expect(Object.isFrozen(BUILT_IN_MARK_RENDERERS)).toBe(true)
    expect(BUILT_IN_MARK_RENDERERS.map((entry) => entry.family)).toEqual([
      'line',
      'line',
      'line',
      'bar',
      'bar',
    ])
    expect(BUILT_IN_MARK_RENDERERS.flatMap((entry) => entry.markKinds)).toEqual([
      'none',
      'line',
      'horizon',
      'none',
      'bar',
    ])
  })

  it('preserves the line mark element output through the registered renderer', () => {
    const ctx = sizeContextFromPixels(900, 520)
    const plan = planChart('line', ctx, describeShape(DATA))
    const frame = resolveFrame(plan, DATA, ctx, resolvePolicy()).series[0]
    expect(frame).toBeDefined()
    const html = renderToStaticMarkup(
      <svg>{renderBuiltInMark({ frame: frame!, plan, policy: resolvePolicy() })}</svg>,
    )
    expect(html).toContain('class="gx-line"')
    expect(html).not.toContain('class="gx-area"')
  })

  it('renders registered bar geometry from the shared frame cell seam', () => {
    const ctx = sizeContextFromPixels(900, 520)
    const plan = planChart('bar', ctx, describeShape(DATA))
    const frame = resolveFrame(plan, DATA, ctx, resolvePolicy()).series[0]
    expect(frame).toBeDefined()
    const html = renderToStaticMarkup(
      <svg>{renderBuiltInMark({ frame: frame!, plan, policy: resolvePolicy() })}</svg>,
    )
    expect(html).toContain('class="gx-bar"')
    expect(html).not.toContain('class="gx-line"')
  })

  it('preserves the explicit unsupported-mark failure path', () => {
    const ctx = sizeContextFromPixels(900, 520)
    const base = planChart('line', ctx, describeShape(DATA))
    const unsupported: ChartPlan = {
      ...base,
      marks: { ...base.marks, primary: { kind: 'arc', donut: true } },
    }
    const frame = frameFor(unsupported)
    expect(frame).toBeDefined()
    expect(() =>
      renderBuiltInMark({ frame: frame!, plan: unsupported, policy: resolvePolicy() }),
    ).toThrow(/'arc' is not implemented.*later chart breadth/s)
  })
})
