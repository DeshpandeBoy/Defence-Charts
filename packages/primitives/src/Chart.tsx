/**
 * `<Chart>` — the root, and the only component in this package a consumer has to think about.
 *
 * ## `role="graphics-document"`, and never `role="img"`
 *
 * ⚠ `role="img"` is **Children Presentational: True**. It does not merely label the graphic; it
 * *erases every descendant* from the accessibility tree — including the `<title>` and `<desc>`
 * structure the graphics roles exist to expose. The chart announces as a single opaque image
 * with a name, and nothing inside it is reachable. That is the failure this whole file is
 * arranged around, and it is invisible in every screenshot.
 *
 * `research/20-architecture.md` §7.3 adds the sharper, more mechanical reason to adopt the
 * WAI-ARIA Graphics roles at all: axe's `svg-img-alt` rule only *matches* an `<svg>` that
 * already declares a role. Adopting them is what switches the automated checking on. Without a
 * role the element is not tested, and an untested element passes.
 *
 * Retrofitting the root later means rewriting every component beneath it, which is why this is
 * settled at A4 rather than at the accessibility milestone.
 *
 * ## What is inside the `<svg>` and what is beside it
 *
 * The `<figure>` holds two children: the graphic, and a `<figcaption>` carrying the data table.
 * The table is HTML and must stay outside the `<svg>` — see `DataTable.tsx` for why a
 * `<table>` in the SVG namespace is not a table.
 *
 * ## Hooks
 *
 * `useId` and `useMemo` only, both present in React 19's `react-server` build. No state, no
 * effects, no refs, no `react-dom` import — so this renders on a server with **zero client
 * JavaScript**, which is decision 7 and which a `renderToStaticMarkup` test asserts.
 *
 * ⚠ `useMemo` here is a hint, not a correctness mechanism. `resolveFrame()` is pure and
 * cheap; the memo exists so that a parent re-rendering on every `ResizeObserver` frame at A5
 * does not rebuild six path strings for an unchanged box. If the dependency list is ever
 * wrong the chart is stale, not broken — but it is worth saying that the list is wrong by
 * default under object identity, which is why `<AutoChart>` at A5 must not build its `ctx`
 * inline.
 */

import {
  type ChartPlan,
  type ChartFrame,
  type PlanPolicy,
  resolveFrame,
  type Series,
  type SizeContext,
} from '@gx/core'
import { useId, useMemo } from 'react'

import { AreaPath } from './AreaPath.tsx'
import { Axis } from './Axis.tsx'
import { DataTable } from './DataTable.tsx'
import { Grid } from './Grid.tsx'
import { HorizonBands } from './HorizonBands.tsx'
import { Labels } from './Labels.tsx'
import { LinePath } from './LinePath.tsx'
import { PointMarks } from './PointMarks.tsx'
import { classes, roundCoord } from './svg.ts'
import { ValueDisplay } from './ValueDisplay.tsx'

export type ChartProps = {
  readonly plan: ChartPlan
  readonly data: readonly Series[]
  /**
   * ⚠ **The `SizeContext`, not a `width`/`height` pair, and the difference is not cosmetic.**
   * `SizeContext` carries the grid `cols`/`rows` a widget occupies alongside its pixels, and
   * `resolveSizeClass()` reads both — a 400 px widget spanning one grid column is not the same
   * chart as a 400 px widget spanning four. Reconstructing a context from pixels alone would
   * invent those two numbers, and it would invent them *differently* from whatever produced
   * `plan`, so the frame and the plan would be answering about two different widgets.
   *
   * Pass the same object that produced the plan. `App.tsx:29` names the failure: *"two
   * components each resolving their own plan would put two disagreeing plot heights on one
   * page."*
   */
  readonly ctx: SizeContext
  /** Required. It is the chart's accessible name; there is no sensible default for it. */
  readonly title: string
  /**
   * ⚠ **Every optional prop below spells `| undefined` explicitly, and it is not noise.**
   * `tsconfig.base.json` sets `exactOptionalPropertyTypes`, which distinguishes *absent*
   * from *present and undefined*. That distinction earns its keep on a config object, where
   * `{ retries: undefined }` and `{}` can reasonably mean different things — and it is
   * meaningless on a React prop, because React itself treats the two identically.
   *
   * What it does instead is break every wrapper. A component that received `description?:
   * string` and forwards it has a `string | undefined` in hand, and passing that to a
   * `description?: string` is an error — so the wrapper is pushed toward conditional
   * spreads, which is ceremony in service of a distinction the runtime does not make.
   * `@gx/react`'s `<AutoChart>` is the first wrapper here and it hit this immediately.
   *
   * So on props, `?: T | undefined` is the correct spelling and bare `?: T` is the
   * accidental one. React's own `@types/react` writes it this way throughout.
   */
  readonly description?: string | undefined
  /** Must be the same policy the plan was resolved under, for the same reason as `ctx`. */
  readonly policy?: Partial<PlanPolicy> | undefined
  /**
   * Stabilises the generated element ids. Omitted, `useId()` supplies one — correct under
   * hydration, but it varies with tree position, so snapshot tests should pass this.
   */
  readonly id?: string | undefined
  readonly className?: string | undefined
}

export function Chart({
  plan,
  data,
  ctx,
  title,
  description,
  policy,
  id,
  className,
}: ChartProps) {
  const generated = useId()
  const base = id ?? generated
  const frame = useMemo(
    () => resolveFrame(plan, data, ctx, policy),
    [plan, data, ctx, policy],
  )

  const titleId = `${base}-title`
  const descId = `${base}-desc`

  return (
    <figure
      className={classes('gx-chart', className)}
      data-size-class={plan.sizeClass}
      data-chart-type={plan.type}
    >
      <svg
        className="gx-chart__svg"
        role="graphics-document"
        aria-labelledby={titleId}
        aria-describedby={description === undefined ? undefined : descId}
        viewBox={`0 0 ${roundCoord(frame.box.width)} ${roundCoord(frame.box.height)}`}
        width={roundCoord(frame.box.width)}
        height={roundCoord(frame.box.height)}
        xmlns="http://www.w3.org/2000/svg"
      >
        <title id={titleId}>{title}</title>
        {description === undefined ? null : <desc id={descId}>{description}</desc>}

        {plan.axes.x.gridlines || plan.axes.y.gridlines ? (
          <Grid
            plot={frame.plot}
            xTicks={plan.axes.x.gridlines ? frame.xTicks : []}
            yTicks={plan.axes.y.gridlines ? frame.yTicks : []}
            zeroLine={frame.zeroLine}
          />
        ) : null}

        {/* ⚠ Marks carry **absolute** coordinates and therefore sit in no transform, while
            `<Grid>` and `<Axis>` translate to the plot origin because tick offsets are
            plot-relative. Both facts are `frame.ts`'s, both are documented there, and the two
            groups are deliberately siblings so that neither inherits the other's frame of
            reference by accident. */}
        {frame.series.map((s) => (
          <SeriesMarks key={s.id} frame={s} plan={plan} />
        ))}

        {plan.axes.x.visible ? (
          <Axis
            orientation="x"
            ticks={frame.xTicks}
            plot={frame.plot}
            rule={plan.axes.x.domainLine}
            labels={plan.axes.x.ticks.mode !== 'none'}
          />
        ) : null}
        {plan.axes.y.visible ? (
          <Axis
            orientation="y"
            ticks={frame.yTicks}
            plot={frame.plot}
            rule={plan.axes.y.domainLine}
            labels={plan.axes.y.ticks.mode !== 'none'}
          />
        ) : null}

        {/* ⚠ Last, and in no transform. Last because the value band is the one region that
            may legitimately be read over a mark — at Micro the plan's mark kind is `'none'`
            and the value display *is* the chart, but at Tile a line runs beneath it, and a
            number underneath a stroke is a number that cannot be read. In no transform
            because `fitValueDisplay()` works in the same absolute space the marks do; the
            band it paints into was subtracted off the top of the plot, so a translate to the
            plot origin would put it back inside the plot it was carved out of.

            ⚠ Mounted unconditionally, and `frame.value` is `null` whenever the plan asked for
            no value display. The branch lives in the component rather than here so that the
            single reading of `narrative.valueDisplay` stays in `@gx/core` — a second one here
            could disagree with the one that sized the band. */}
        <ValueDisplay value={frame.value} />
      </svg>

      {plan.dataTable.present ? (
        <figcaption className="gx-chart__caption">
          <DataTable data={data} plan={plan.dataTable} caption={title} />
        </figcaption>
      ) : null}
    </figure>
  )
}

/**
 * One series, in paint order: area, then bands, then line, then points, then text.
 *
 * ⚠ **Grouped per series rather than per mark type**, which costs a little paint-order
 * fidelity when series overlap and buys a `[data-series-id]` subtree that a test, a legend
 * hover at A5, and a theme can all address as a unit. With the six-colour ramp the ladder caps
 * series at, overlap ordering has never been the readability problem; telling two series apart
 * has.
 *
 * ⚠ The mark kinds this package does *not* draw throw, naming the milestone that adds them —
 * the same contract `planChart()` holds. A silent fallback to a line would render bar data as
 * a line chart, which is the project's recurring failure species with a chart attached.
 */
function SeriesMarks({ frame, plan }: { frame: ChartFrame['series'][number]; plan: ChartPlan }) {
  const kind = plan.marks.primary.kind

  if (kind === 'bar' || kind === 'arc' || kind === 'cell' || kind === 'point') {
    throw new Error(
      `@gx/primitives: mark kind '${kind}' is not implemented. A4 renders 'line', 'horizon' and 'none' only; bar and arc land at B2.`,
    )
  }

  return (
    <g className="gx-series" data-series-id={frame.id} data-series-index={frame.index}>
      {kind === 'line' ? <AreaPath d={frame.area} /> : null}
      {kind === 'horizon' ? <HorizonBands bands={frame.bands} /> : null}
      {kind === 'line' ? <LinePath d={frame.line} /> : null}
      <PointMarks
        points={frame.points}
        extrema={frame.extrema}
        mode={plan.marks.points.mode}
        budget={plan.marks.pointBudget}
      />
      <Labels
        series={frame}
        seriesLabels={plan.labels.seriesLabels}
        valueLabels={plan.labels.valueLabels}
        maxChars={plan.labels.maxChars}
      />
    </g>
  )
}
