'use client'

/**
 * `<AutoChart>` — measure, plan, render. Nothing else.
 *
 * ⚠ **The entire adaptive thesis is four lines of this component**, and it is worth naming
 * how little it does: it observes a box, converts two pixel numbers into a `SizeContext`,
 * hands that to `planChart()`, and passes the result to `<Chart>`. There is no breakpoint
 * table, no media query, no debounce, no hysteresis and no special case. Every decision about
 * what a chart at this size should contain was made in `@gx/core` by a module that has
 * never seen the DOM, and this component's only privilege is knowing the size.
 *
 * That is also the design constraint. Anything this component *decides* is a decision made
 * on the client, in a package that ships JavaScript, outside every test that runs without a
 * browser — so the correct amount for it to decide is none.
 *
 * ## Containment: the one thing a consumer must get right
 *
 * ⚠ **The measured element must be sized by its container, never by its content.** This
 * component observes its own wrapper `<div>` and renders the chart inside it. A `<div>` with
 * `block-size: auto` takes its height *from* that chart — so the chart's height sets the
 * box's height, which sets the chart's height. The browser cuts that loop with a console
 * error rather than a crash (`"ResizeObserver loop completed with undelivered
 * notifications"`), so nothing visibly breaks and the widget is simply wrong at some sizes.
 *
 * `auto-chart.css` closes the half of this that a library can close: the wrapper is
 * `display: block` with `overflow: hidden`, so the chart cannot raise a scrollbar — and a
 * scrollbar is the sneakiest entry point, because it shrinks the content box by ~15 px in
 * response to content the chart itself drew. The other half is the consumer's: **give the
 * wrapper a height.** A grid cell, an explicit `block-size`, a flex child — anything whose
 * size is decided before the chart is drawn.
 *
 * ⚠ `contain: size` is the exact CSS spelling of this rule and it is deliberately *not*
 * applied by default. It tells the browser to size the element as if it were empty, which
 * is precisely the containment guarantee — but on an auto-height parent it collapses the
 * box to zero, and a chart that silently renders nothing is a worse failure than one that
 * loops loudly enough for gate **G11** to catch. A consumer who has already committed to
 * sizing the container should add it; it is the strongest guarantee available.
 *
 * Gate **G11** is what proves any of this, in both halves: a fake-driven sweep asserting the
 * reported box reaches a fixed point, and a real browser dragged across every rung boundary
 * asserting the loop error never fires.
 *
 * ## Server rendering
 *
 * This file carries no `"use client"` of its own beyond the one at the top of the module —
 * `./index.ts` declares the boundary for the package and CI greps the built output for it
 * (gate **G3**). What matters here is that the *server* render is correct rather than blank:
 * pass `initialSize` and the HTML that arrives is a real chart planned for that size, so
 * first paint is a chart. Omit it and the server emits the wrapper alone, which is honest —
 * see `useElementSize`'s `initialSize` docblock for why a guessed default would be worse
 * than nothing.
 */

import type { ChartType, PlanOverrides, PlanPolicy, Series, SizeContext } from '@gx/core'
import { describeShape, planChart, sizeContextFromPixels } from '@gx/core'
import { Chart } from '@gx/primitives'
import { useMemo } from 'react'

import type { Size } from './useElementSize.ts'
import { useElementSize } from './useElementSize.ts'

export type AutoChartProps = {
  readonly type: ChartType
  readonly data: readonly Series[]
  /** Required. It is the chart's accessible name; there is no sensible default for it. */
  readonly title: string
  /** ⚠ `| undefined` throughout — see `ChartProps` in `@gx/primitives` for why. */
  readonly description?: string | undefined
  readonly policy?: Partial<PlanPolicy> | undefined
  readonly overrides?: PlanOverrides | undefined
  /**
   * The square cell a standalone chart is measured in. **Tier C** — ours and unsourced.
   * A chart inside `@gx/grid` never uses it, because its real `cols`/`rows` footprint is
   * authoritative. `DEFAULT_NOMINAL_CELL_SIZE` is 100.
   */
  readonly nominalCellSize?: number | undefined
  /** The declared size the server renders for. See the module docblock. */
  readonly initialSize?: Size | undefined
  readonly className?: string | undefined
  /** Forwarded to `<Chart>` to stabilise generated ids. Snapshot tests should pass it. */
  readonly id?: string | undefined
}

export function AutoChart({
  type,
  data,
  title,
  description,
  policy,
  overrides,
  nominalCellSize,
  initialSize,
  className,
  id,
}: AutoChartProps) {
  const [ref, size] = useElementSize<HTMLDivElement>({ initialSize })

  // ⚠ Three memos rather than one, and the split is the dependency graph rather than
  // taste. `ctx` changes only when the box does; `shape` only when the data does; `plan`
  // when either does. Fused into one memo, a parent re-rendering with an unchanged box but
  // a new `data` array identity would re-derive the size context too — cheap, but it would
  // also produce a new `ctx` *object*, and `<Chart>` memoises its frame on `ctx` identity.
  // The plan would be equal and the frame would be rebuilt anyway.
  const ctx: SizeContext = useMemo(
    () => sizeContextFromPixels(size.width, size.height, nominalCellSize),
    [size.width, size.height, nominalCellSize],
  )
  const shape = useMemo(() => describeShape(data), [data])
  const plan = useMemo(
    () => planChart(type, ctx, shape, policy, overrides),
    [type, ctx, shape, policy, overrides],
  )

  // ⚠ **The plan is resolved even when the box is `0 × 0`, and that is not an oversight.**
  // The Rules of Hooks put `useMemo` in the unconditional body, so the only way to skip
  // planning while unmeasured is to return `null` from the memo — and that trade is worse
  // than it looks. `planChart()` throws for every chart type that has no rung set yet, so
  // an eager plan means a consumer who writes `<AutoChart type="bar">` gets a build that
  // stops. The lazy version gets a build that succeeds, a page that ships, an empty div
  // that looks like a loading state, and a throw inside a client render the instant a
  // `ResizeObserver` delivers a box — a blank widget at one breakpoint on someone else's
  // machine. The cost of being eager is one pure call on a meaningless box; the cost of
  // being lazy is paid by whoever has to reproduce that.
  const measured = size.width > 0 && size.height > 0

  return (
    <div
      ref={ref}
      className={className === undefined ? 'gx-auto-chart' : `gx-auto-chart ${className}`}
    >
      {/*
        ⚠ The chart is the wrapper's **only** child, and that is structural rather than
        tidy. A sibling in normal flow — a caption, a title, a size readout — contributes to
        the content box the observer reports, so the chart would be planned for a height
        that sibling had already taken a bite out of; and shrinking the widget past the
        sibling's own height would stop the box shrinking at all. That is the containment
        loop arriving through the least interesting door, and it is how it actually showed
        up in the playground.

        ⚠ Rendered only once a real measurement exists. `0 × 0` is what every browser
        delivers at least once — a detached element, `display: none`, print layout — and
        `resolveSizeClass()` reads it as *"not measured"* rather than as a real box. Drawing
        it anyway would flash a Micro rung on load and then jump.
      */}
      {measured ? (
        <Chart
          plan={plan}
          data={data}
          ctx={ctx}
          title={title}
          description={description}
          policy={policy}
          id={id}
        />
      ) : null}
    </div>
  )
}
