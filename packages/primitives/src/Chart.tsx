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
  resolvePolicy,
  type Series,
  type SizeContext,
} from '@shiftcharts/core'
import { useId, useMemo } from 'react'

import { Axis } from './Axis.tsx'
import { CompactSeriesKey, compactSeriesKeyLayout } from './CompactSeriesKey.tsx'
import { DataTable } from './DataTable.tsx'
import { Grid } from './Grid.tsx'
import { Labels, resolveLabelOffsets } from './Labels.tsx'
import { PointMarks } from './PointMarks.tsx'
import type { MarkRenderer } from './renderer-seam.ts'
import { renderBuiltInMark } from './renderer-registry.ts'
import { classes, roundCoord } from './svg.ts'
import { ValueDisplay } from './ValueDisplay.tsx'
import { Legend } from './Legend.tsx'

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
   * `@shiftcharts/react`'s `<AutoChart>` is the first wrapper here and it hit this immediately.
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

export type ChartViewProps = ChartProps & {
  /** Internal renderer seam used by the root and family-specific public entrypoints. */
  readonly renderMark: MarkRenderer
}

/** The generic root chart, backed by every built-in family renderer. */
export function Chart(props: ChartProps) {
  return <ChartView {...props} renderMark={renderBuiltInMark} />
}

export function ChartView({
  plan,
  data,
  ctx,
  title,
  description,
  policy,
  id,
  className,
  renderMark,
}: ChartViewProps) {
  const generated = useId()
  const base = id ?? generated
  const resolvedPolicy = useMemo(() => resolvePolicy(policy), [policy])
  const frame = useMemo(
    () => resolveFrame(plan, data, ctx, resolvedPolicy),
    [plan, data, ctx, resolvedPolicy],
  )

  const titleId = `${base}-title`
  const descId = `${base}-desc`
  const compactKey = compactSeriesKeyLayout(frame, plan, resolvedPolicy)

  return (
    <figure
      className={classes('shiftcharts-chart', className)}
      data-size-class={plan.sizeClass}
      data-chart-type={plan.type}
      /*
       * ⚠ **The only consumer `plan.motion` has, and the only one it should have.** Added
       * at A6; before it, the field was resolved on every plan and read by nothing.
       *
       * These are bindings, not behaviour. `chart.css` maps `data-motion-duration` to a
       * duration token and `data-motion-stages` to a stage delay, and the transitions
       * themselves live behind `@media (prefers-reduced-motion: no-preference)`. That
       * split is `40-chart-plan.md` §4's, and it is why there is no `motion.enabled` to
       * echo here: the server cannot read the preference, so anything derived from it
       * would differ between the server render and the client's and mismatch on hydration.
       * The plan carries structure; CSS carries the decision to move.
       *
       * ⚠ `objectConstancy` is deliberately NOT echoed. It is `false` at every line rung
       * and correctly so — `10-responsive-ladder.md` §7 scopes it to `aggregate`, where
       * slices must visibly converge into "Other", which no line chart does. Emitting it
       * would invite a stylesheet to treat it as "do elements keep identity", which is a
       * different property, is unconditionally true since A6, and is asserted by
       * `identity.test.tsx` rather than advertised by an attribute.
       */
      data-motion-duration={plan.motion.durationClass}
      data-motion-stages={plan.motion.stages}
      data-persist-gridlines={plan.motion.persistGridlines ? '' : undefined}
    >
      <svg
        className="shiftcharts-chart__svg"
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
            xDashPhase={plan.axes.x.dashPhase}
            xStrokeCap={plan.axes.x.strokeCap}
            yDashPhase={plan.axes.y.dashPhase}
            yStrokeCap={plan.axes.y.strokeCap}
            policy={resolvedPolicy}
          />
        ) : null}

        {/* ⚠ Marks carry **absolute** coordinates and therefore sit in no transform, while
            `<Grid>` and `<Axis>` translate to the plot origin because tick offsets are
            plot-relative. A core-reserved internal identity rail is painted above that origin;
            a legacy overlay or compact Tile fallback is moved into its remaining coordinates by
            the primitive so the key never sits on top of the marks. */}
        {compactKey === null || compactKey.plotTransform === null ? (
          <PlotContent
            base={base}
            frame={frame}
            plan={plan}
            policy={resolvedPolicy}
            renderMark={renderMark}
          />
        ) : (
          <g className="shiftcharts-compact-plot" data-compact-plot="" transform={compactKey.plotTransform}>
            <PlotContent
              base={base}
              frame={frame}
              plan={plan}
              policy={resolvedPolicy}
              renderMark={renderMark}
            />
          </g>
        )}

        {compactKey === null ? null : <CompactSeriesKey layout={compactKey} />}

        {/* ⚠ Last, and in no transform. Last because the value band is the one region that
            may legitimately be read over a mark — at Micro the plan's mark kind is `'none'`
            and the value display *is* the chart, but at Tile a line runs beneath it, and a
            number underneath a stroke is a number that cannot be read. In no transform
            because `fitValueDisplay()` works in the same absolute space the marks do; the
            band it paints into was subtracted off the top of the plot, so a translate to the
            plot origin would put it back inside the plot it was carved out of.

            ⚠ Mounted unconditionally, and `frame.value` is `null` whenever the plan asked for
            no value display. The branch lives in the component rather than here so that the
            single reading of `narrative.valueDisplay` stays in `@shiftcharts/core` — a second one here
            could disagree with the one that sized the band. */}
        <ValueDisplay value={frame.value} />
      </svg>

      {plan.legend.placement === 'external' ? (
        <Legend
          plan={plan.legend}
          series={data}
          arcs={plan.type === 'donut' ? frame.series[0]?.arcs : undefined}
          heatmapCells={plan.type === 'heatmap' ? frame.series.flatMap((item) => item.cells) : undefined}
          region={frame.legend}
        />
      ) : null}

      {plan.dataTable.present ? (
        <figcaption className="shiftcharts-chart__caption">
          <DataTable
            data={data}
            plan={plan.dataTable}
            caption={title}
            progress={plan.type === 'progress'}
            heatmap={plan.type === 'heatmap'}
            donut={plan.type === 'donut'}
            funnel={plan.type === 'funnel'}
          />
        </figcaption>
      ) : null}
    </figure>
  )
}

function PlotContent({
  base,
  frame,
  plan,
  policy,
  renderMark,
}: {
  readonly base: string
  readonly frame: ChartFrame
  readonly plan: ChartPlan
  readonly policy: PlanPolicy
  readonly renderMark: MarkRenderer
}) {
  const labelOffsets = resolveLabelOffsets(frame.series, plan.labels, frame.plot, policy)

  return (
    <>
      {frame.series.map((s) => (
        <SeriesMarks
          key={s.id}
          frame={s}
          plan={plan}
          policy={policy}
          labelOffsets={labelOffsets}
          renderMark={renderMark}
        />
      ))}

      {plan.axes.x.visible ? (
        <Axis
          orientation="x"
          ticks={frame.xTicks}
          plot={frame.plot}
          rule={plan.axes.x.domainLine}
          labels={plan.axes.x.ticks.mode !== 'none'}
          labelFlush={plan.axes.x.labelFlush}
          labelBound={plan.axes.x.labelBound}
          tickBand={plan.axes.x.tickBand}
          translateOffset={plan.axes.x.translate}
          clipId={`${base}-axis-x-bound`}
          policy={policy}
        />
      ) : null}
      {plan.axes.y.visible ? (
        <Axis
          orientation="y"
          ticks={frame.yTicks}
          plot={frame.plot}
          rule={plan.axes.y.domainLine}
          labels={plan.axes.y.ticks.mode !== 'none'}
          labelFlush={plan.axes.y.labelFlush}
          labelBound={plan.axes.y.labelBound}
          tickBand={plan.axes.y.tickBand}
          translateOffset={plan.axes.y.translate}
          clipId={`${base}-axis-y-bound`}
          policy={policy}
        />
      ) : null}
    </>
  )
}

/**
 * One series, in paint order: registered family marks, then points, then text.
 *
 * ⚠ **Grouped per series rather than per mark type**, which costs a little paint-order
 * fidelity when series overlap and buys a `[data-series-id]` subtree that a test, a legend
 * hover at A5, and a theme can all address as a unit. With the six-colour ramp the ladder caps
 * series at, overlap ordering has never been the readability problem; telling two series apart
 * has.
 *
 * ⚠ The mark kinds this package does *not* draw throw, naming the milestone that adds them —
 * the same contract `planChart()` holds. A silent fallback to a line would render another
 * family's data as a line chart, which is the project's recurring failure species with a chart
 * attached.
 */
function SeriesMarks({
  frame,
  plan,
  policy,
  labelOffsets,
  renderMark,
}: {
  readonly frame: ChartFrame['series'][number]
  readonly plan: ChartPlan
  readonly policy: PlanPolicy
  readonly labelOffsets: ReadonlyMap<string, number>
  readonly renderMark: MarkRenderer
}) {
  return (
    <g
      className="shiftcharts-series"
      data-series-id={frame.id}
      data-shiftcharts-series-id={frame.id}
      data-series-index={frame.index}
    >
      <title>{frame.label}</title>
      {renderMark({ frame, plan, policy })}
      <PointMarks
        seriesId={frame.id}
        points={frame.points}
        extrema={frame.extrema}
        mode={plan.marks.points.mode}
        budget={plan.marks.pointBudget}
        autoHideDensityThreshold={plan.marks.points.autoHideDensityThreshold}
      />
      <Labels
        series={frame}
        seriesLabels={plan.labels.seriesLabels}
        valueLabels={plan.labels.valueLabels}
        labelHalo={plan.labels.labelHalo}
        maxChars={plan.labels.seriesLabelMaxChars}
        policy={policy}
        offsets={labelOffsets}
      />
    </g>
  )
}
