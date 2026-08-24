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
      'scatter',
      'scatter',
      'donut',
      'donut',
      'progress',
      'progress',
      'heatmap',
      'heatmap',
    ])
    expect(BUILT_IN_MARK_RENDERERS.flatMap((entry) => entry.markKinds)).toEqual([
      'none',
      'line',
      'horizon',
      'none',
      'bar',
      'none',
      'point',
      'none',
      'arc',
      'none',
      'progress',
      'none',
      'cell',
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

  it('renders registered scatter points from the shared frame point seam', () => {
    const ctx = sizeContextFromPixels(900, 520)
    const plan = planChart('scatter', ctx, describeShape(DATA))
    const frame = resolveFrame(plan, DATA, ctx, resolvePolicy()).series[0]
    expect(frame).toBeDefined()
    const html = renderToStaticMarkup(
      <svg>{renderBuiltInMark({ frame: frame!, plan, policy: resolvePolicy() })}</svg>,
    )
    expect(html).toContain('class="gx-point gx-scatter-point"')
    expect(html).toContain('data-scatter-index="0"')
  })

  it('renders registered donut arcs from the shared frame arc seam', () => {
    const ctx = sizeContextFromPixels(900, 520)
    const plan = planChart('donut', ctx, describeShape([{ id: 'sales', points: [{ x: 0, y: 3 }, { x: 1, y: 2 }] }]))
    const frame = resolveFrame(plan, [{ id: 'sales', points: [{ x: 0, y: 3 }, { x: 1, y: 2 }] }], ctx, resolvePolicy()).series[0]
    expect(frame).toBeDefined()
    const html = renderToStaticMarkup(
      <svg>{renderBuiltInMark({ frame: frame!, plan, policy: resolvePolicy() })}</svg>,
    )
    expect(html).toContain('class="gx-arc"')
    expect(html).toContain('data-slice-id="sales:number:0"')
  })

  it('renders registered progress geometry from the shared target-aware seam', () => {
    const data = [{ id: 'completion', points: [{ x: 0, y: 50 }], target: 100 }]
    const ctx = sizeContextFromPixels(900, 520)
    const plan = planChart('progress', ctx, describeShape(data))
    const frame = resolveFrame(plan, data, ctx, resolvePolicy()).series[0]
    expect(frame).toBeDefined()
    const html = renderToStaticMarkup(
      <svg>{renderBuiltInMark({ frame: frame!, plan, policy: resolvePolicy() })}</svg>,
    )
    expect(html).toContain('class="gx-progress')
    expect(html).toContain('data-progress-current="50"')
    expect(html).toContain('data-progress-target="100"')
    expect(html).not.toContain('gx-line')
  })

  it('preserves the explicit unsupported-mark failure path', () => {
    const ctx = sizeContextFromPixels(900, 520)
    const base = planChart('line', ctx, describeShape(DATA))
    const unsupported: ChartPlan = {
      ...base,
      marks: { ...base.marks, primary: { kind: 'cell', bandStart: 0, bandEnd: 1 } },
    }
    const frame = frameFor(unsupported)
    expect(frame).toBeDefined()
    expect(() =>
      renderBuiltInMark({ frame: frame!, plan: unsupported, policy: resolvePolicy() }),
    ).toThrow(/requires a heatmap plan/)
  })

  it('renders registered heatmap cells from the shared frame seam', () => {
    const data = [
      { id: 'activity', points: [{ x: new Date('2026-01-01'), y: 1 }, { x: new Date('2026-01-02'), y: 4 }] },
    ]
    const ctx = sizeContextFromPixels(900, 520)
    const plan = planChart('heatmap', ctx, describeShape(data))
    const frame = resolveFrame(plan, data, ctx, resolvePolicy()).series[0]
    expect(frame).toBeDefined()
    const html = renderToStaticMarkup(
      <svg>{renderBuiltInMark({ frame: frame!, plan, policy: resolvePolicy() })}</svg>,
    )
    expect(html).toContain('class="gx-cell gx-heatmap-cell"')
    expect(html).toContain('data-heatmap-cell-id="activity:1767225600000"')
    expect(html).not.toContain('gx-line')
  })
})
