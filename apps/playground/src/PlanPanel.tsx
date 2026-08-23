import type { ChartPlan, ChromeSpec, DataShape, PlotBox, SizeContext } from '@gx/core'
import { DEFAULT_POLICY, planChart, resolvePlotBox } from '@gx/core'

export const CHART_TYPES = ['line', 'area'] as const
export type PlaygroundChartType = (typeof CHART_TYPES)[number]

/** What the playground resolves, and the box it resolved it in. */
export type Resolved = { readonly plan: ChartPlan; readonly box: PlotBox }

/**
 * The plan and its plot box, for one size and one shape.
 *
 * Lives beside the panel rather than inside it because `App` needs the same plot box for the
 * threshold list — and *the same one*, not a second one computed from slightly different
 * inputs. Two plot heights on one page, disagreeing by a few px, would be a worse lie than
 * the widget height this replaces.
 */
export function resolveForPlayground(
  ctx: SizeContext,
  type: PlaygroundChartType,
  series: number,
): Resolved {
  // ⚠ Everything but `series` is a fixed probe shape, and `labelMaxChars: 5` is the one to
  // know about: short labels, so the horizontal chain's degrade step never fires and what you
  // see changing is the *size* response alone. Long-label degradation is real and is asserted
  // in `rungs/line.snapshot.test.ts`; it is held still here so one variable moves at a time.
  const shape: DataShape = {
    series,
    categories: 12,
    points: 120,
    hasNegative: false,
    labelMaxChars: 5,
    temporal: true,
  }
  const plan = planChart(type, ctx, shape)
  return { plan, box: resolvePlotBox(ctx, chromeOf(plan), series, DEFAULT_POLICY) }
}

/**
 * The decision itself — `planChart()` output, live, as you drag the corner.
 *
 * This is the panel A2 could not have: the library had a plan *contract* and nothing that
 * produced one. Everything below is a pure function of the two numbers a `ResizeObserver`
 * reported plus the two shape controls, computed by a module that has never seen the DOM.
 *
 * ⚠ **Still no chart.** The renderer is A4. Drawing a placeholder here would make the
 * library look further along than it is, which is the one thing a progress view must not do.
 */
export function PlanPanel({
  resolved,
  type,
  series,
  onType,
  onSeries,
}: {
  readonly resolved: Resolved
  readonly type: PlaygroundChartType
  readonly series: number
  readonly onType: (next: PlaygroundChartType) => void
  readonly onSeries: (next: number) => void
}) {
  const json = JSON.stringify(resolved.plan, null, 2)

  return (
    <section>
      <h2>planChart()</h2>

      <div className="control control--ranks" role="group" aria-label="Chart type">
        {CHART_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={t === type ? 'rank rank--active' : 'rank'}
            aria-pressed={t === type}
            onClick={() => {
              onType(t)
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <label className="control">
        <span className="control__label">series · {series}</span>
        <input
          type="range"
          min={1}
          max={8}
          step={1}
          value={series}
          onChange={(e) => {
            onSeries(Number(e.target.value))
          }}
        />
      </label>
      <p className="note">
        ⚠ Series count is not a size, and it changes the plan anyway. Cross <strong>4</strong>{' '}
        at Canvas and the legend leaves the plot to become its own region; cross it at Stage
        and the marks facet. §4.4&apos;s non-monotonic rule in one drag: a bigger rung does
        not automatically get <em>more</em> legend than a smaller one.
      </p>

      <dl className="kv">
        <dt>plan fingerprint</dt>
        <dd>
          <code>{fingerprint(json)}</code>
        </dd>
      </dl>
      <p className="note">
        ⚠ The fingerprint is a hash of the JSON below, and it exists to make one claim
        checkable by eye: drag <em>out</em> past a boundary and back <em>in</em>, and it must
        return to exactly what it was. A plan is a pure function of size and shape with no
        memory of which direction you approached from — that is gate <strong>G10</strong>,
        asserted in CI, and this is the same claim with your hand on the handle.
      </p>

      <pre className="plan-json" aria-label="Resolved ChartPlan as JSON">
        {json}
      </pre>
    </section>
  )
}

/**
 * The chrome a plan describes, re-read off the plan.
 *
 * ⚠ Exact here, and not exact in general. Each rung builds this spec, sizes the plot from
 * it, and only then decides the marks — so reading it back off the finished plan reproduces
 * the resolver's own input. `applyOverrides` runs *after* all of that, so a plan carrying
 * forced values could describe chrome the box was never computed from. This playground
 * forces nothing, which is the only reason the plot height it reports is the resolver's own.
 *
 * If `ChromeSpec` ever gains a field, this fails to typecheck rather than drifting.
 */
function chromeOf(plan: ChartPlan): ChromeSpec {
  return {
    x: plan.axes.x,
    y: plan.axes.y,
    y2: plan.axes.y2,
    legend: plan.legend,
    valueDisplay: plan.narrative.valueDisplay,
    valueTypeScale: plan.narrative.valueTypeScale,
    tableDisclosure: plan.dataTable.disclosure,
    tablePresent: plan.dataTable.present,
  }
}

/** FNV-1a, 32-bit. Deterministic and dependency-free; a display aid, not a digest. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
