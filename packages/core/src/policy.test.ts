import { describe, expect, it } from 'vitest'

import { ROBOTO_FLEX_METRICS } from './font-metrics.generated.ts'
import type { PlanOverrides, PlanPolicy } from './policy.ts'
import { DEFAULT_POLICY, resolvePolicy } from './policy.ts'
import { DEFAULT_TYPOGRAPHY } from './text.ts'

describe('DEFAULT_POLICY', () => {
  describe('the A-lit numbers, which are findings rather than preferences', () => {
    // ⚠ Each of these discards a published result if moved. They are asserted individually
    // and by value so that a diff which changes one is a diff which changes a test with a
    // citation in it — not a silent edit to an object literal.

    it('tickTargetSpacingX is 100 px — Talbot 2010', () => {
      expect(DEFAULT_POLICY.tickTargetSpacingX).toBe(100)
    })

    it('ticksMin is 2 — Talbot 2010', () => {
      expect(DEFAULT_POLICY.ticksMin).toBe(2)
    })

    it('labelMinSpacing is 1.5, in em rather than px — Talbot 2010', () => {
      // ⚠ The unit is the trap. Read as px it is a sixty-seventh of the tick budget, which
      // would never trigger, and the label-collision rule would quietly never fire.
      expect(DEFAULT_POLICY.labelMinSpacing).toBe(1.5)
    })

    it('plotHeightOptimal is 24 px — Heer 2009, below which encoding changes', () => {
      expect(DEFAULT_POLICY.plotHeightOptimal).toBe(24)
    })

    it('plotHeightMinValues is 40 px — Heer & Bostock 2010, p < 0.001', () => {
      expect(DEFAULT_POLICY.plotHeightMinValues).toBe(40)
    })

    it('plotHeightSaturation is 80 px — Heer & Bostock 2010', () => {
      // The empirical justification for the whole library: past 80 px, extra space buys
      // content, not plot.
      expect(DEFAULT_POLICY.plotHeightSaturation).toBe(80)
    })

    it('horizonMinHeight is 6 px — Heer 2009, the absolute floor', () => {
      expect(DEFAULT_POLICY.horizonMinHeight).toBe(6)
    })

    it('horizonMaxBands is 3 — Heer 2009, a cap and not a style choice', () => {
      expect(DEFAULT_POLICY.horizonMaxBands).toBe(3)
    })

    it('categoriesMaxRadial is 7', () => {
      expect(DEFAULT_POLICY.categoriesMaxRadial).toBe(7)
    })
  })

  describe('the plot-height ladder is ordered', () => {
    it('floor < optimal < min-values < saturation', () => {
      // ⚠ An out-of-order ladder produces a resolver whose thresholds shadow each other:
      // if `plotHeightMinValues` ever sank below `plotHeightOptimal`, the "show values"
      // branch would be unreachable and no test asserting a *plan* would notice, because
      // the plan it produced would still be internally valid.
      const { horizonMinHeight, plotHeightOptimal, plotHeightMinValues, plotHeightSaturation } =
        DEFAULT_POLICY
      expect(horizonMinHeight).toBeLessThan(plotHeightOptimal)
      expect(plotHeightOptimal).toBeLessThan(plotHeightMinValues)
      expect(plotHeightMinValues).toBeLessThan(plotHeightSaturation)
    })
  })

  describe('the tiers below A-lit', () => {
    it('aggregateAfter is 8 — tier B, ours and consistent', () => {
      expect(DEFAULT_POLICY.aggregateAfter).toBe(8)
    })

    it('legendMaxEntries is 8 — tier C', () => {
      expect(DEFAULT_POLICY.legendMaxEntries).toBe(8)
    })

    it('pointBudget is 2000 — tier C', () => {
      expect(DEFAULT_POLICY.pointBudget).toBe(2000)
    })

    it('pointAutoHideDensityThreshold is 2 px — Highcharts', () => {
      expect(DEFAULT_POLICY.pointAutoHideDensityThreshold).toBe(2)
    })

    it('barCategoryShare is 0.8 — Highcharts groupPadding: 0.2, stored as the content side', () => {
      expect(DEFAULT_POLICY.barCategoryShare).toBe(0.8)
    })

    it('barFillShare is 0.9 — Highcharts pointPadding: 0.1, stored as the content side', () => {
      expect(DEFAULT_POLICY.barFillShare).toBe(0.9)
    })

    it('minCellSize is 8 — tier C, and the citation stays absent on purpose', () => {
      // ⚠ `research/10-responsive-ladder.md` §4 is explicit that the 8 px *"coincides
      // numerically with Heer & Bostock's gridline result, but that finding is about
      // tracing gridlines to labels. Do not cite it."* A plausible citation attached to
      // the wrong finding is worse than an admitted gap, because it stops anyone checking.
      expect(DEFAULT_POLICY.minCellSize).toBe(8)
    })

    it('substitute defaults on', () => {
      // Encoding substitution is the ladder's central move — line becomes horizon becomes
      // nothing. Defaulting it off would make the library a fixed-encoding chart library
      // with extra configuration.
      expect(DEFAULT_POLICY.substitute).toBe(true)
    })
  })

  it('defaults typography to the atomic default with the measured table', () => {
    // ⚠ Identity, not deep equality. Any *other* table in this slot would be numbers we
    // made up, and it would look exactly as authoritative as a measured one.
    expect(DEFAULT_POLICY.typography).toBe(DEFAULT_TYPOGRAPHY)
    expect(DEFAULT_POLICY.typography.metrics).toBe(ROBOTO_FLEX_METRICS)
  })

  it('is frozen, so one consumer cannot move the library default for every other', () => {
    expect(Object.isFrozen(DEFAULT_POLICY)).toBe(true)
  })

  it('is plain and serialisable, so it can cross a server/client boundary', () => {
    const revived = JSON.parse(JSON.stringify(DEFAULT_POLICY)) as PlanPolicy
    expect(revived).toStrictEqual({ ...DEFAULT_POLICY })
  })
})

describe('resolvePolicy', () => {
  it('returns the shared default object when given nothing', () => {
    expect(resolvePolicy()).toBe(DEFAULT_POLICY)
  })

  it('overlays only the fields supplied', () => {
    const resolved = resolvePolicy({ pointBudget: 500 })
    expect(resolved.pointBudget).toBe(500)
    expect(resolved.tickTargetSpacingX).toBe(DEFAULT_POLICY.tickTargetSpacingX)
    expect(resolved.typography).toBe(DEFAULT_POLICY.typography)
  })

  it('does not mutate DEFAULT_POLICY', () => {
    resolvePolicy({ pointBudget: 500 })
    expect(DEFAULT_POLICY.pointBudget).toBe(2000)
  })

  it('freezes what it returns', () => {
    expect(Object.isFrozen(resolvePolicy({ pointBudget: 500 }))).toBe(true)
  })

  it('replaces typography whole rather than merging it', () => {
    const mine = {
      ...DEFAULT_TYPOGRAPHY,
      family: 'Mine, sans-serif',
      metrics: { ...ROBOTO_FLEX_METRICS, family: 'Mine', safetyFactor: 1.2 },
    }
    const resolved = resolvePolicy({ typography: mine })
    expect(resolved.typography).toBe(mine)
    expect(resolved.typography.metrics.family).toBe('Mine')
  })

  it('is pure across repeated calls', () => {
    const a = resolvePolicy({ legendMaxEntries: 3 })
    const b = resolvePolicy({ legendMaxEntries: 3 })
    expect(a).toStrictEqual(b)
  })
})

describe('PlanOverrides — DeepPartial', () => {
  // ⚠ These are compile-time assertions wearing a runtime test as a jacket. The `satisfies`
  // clauses are what actually run the check; the `expect` calls exist so the file has a
  // reason to be in the suite and so a regression shows up as a *failing test*, not just a
  // red squiggle someone can ignore.

  it('lets a nested scalar be overridden on its own', () => {
    const overrides = {
      axes: { y: { gridlines: false } },
      marks: { pointBudget: 100 },
    } satisfies PlanOverrides
    expect(overrides.axes.y.gridlines).toBe(false)
  })

  it('requires a discriminated union to be supplied whole', () => {
    // ⚠ The soundness property. A naive deep-partial would admit
    // `{ legend: { position: 'right' } }` — a LegendPlan with a position and no placement,
    // which after merging matches no variant at all. That breaks §1.4 (absence is spelled
    // explicitly, never by a missing key) and §1.2 (a plan names states, so a half-named
    // state is not a weaker statement, it is an invalid one).
    const whole = {
      legend: { placement: 'external', position: 'right', maxEntries: 5, showValues: true, showPercent: false },
    } satisfies PlanOverrides
    expect(whole.legend.placement).toBe('external')

    // @ts-expect-error — a partial union member is not assignable, and must not be.
    const partial = { legend: { position: 'right' } } satisfies PlanOverrides
    expect(partial).toBeDefined()
  })

  /**
   * ⚠ The counterweight to the test above, and the pair has to be read together. `AxisPlan |
   * null` is a union too, so the atomicity rule as first written forbade this — which would
   * have been the wrong answer, because `null` is not a variant a key could have belonged to
   * and so a partial here is unambiguous about what it completes. `./overrides.ts` merges it
   * onto a declared base and returns a total `AxisPlan`.
   *
   * Both tests exist because the fix is a *weakening*: without the one above, the weakening
   * could widen to admit half a `LegendPlan` and nothing would fail.
   */
  it('lets a nullable object take a partial, unlike a union of variants', () => {
    const partial = { axes: { y2: { visible: true } } } satisfies PlanOverrides
    expect(partial.axes.y2.visible).toBe(true)

    // And `null` survives the weakening — it is a value, not a missing key (§1.4).
    const off = { axes: { y2: null } } satisfies PlanOverrides
    expect(off.axes.y2).toBeNull()
  })

  it('keeps a nullable *union* atomic, so the exception is exactly one clause wide', () => {
    // `marks.primary` is a `MarkSpec` union. Nullability is not what makes a partial safe —
    // having a single object member is — so a nullable union must stay whole.
    // @ts-expect-error — a partial `MarkSpec` is not assignable, with or without a `| null`.
    const partial = { marks: { primary: { area: true } } } satisfies PlanOverrides
    expect(partial).toBeDefined()
  })

  it('requires a TickPlan to name its mode', () => {    const whole = { axes: { x: { ticks: { mode: 'count', count: 4 } } } } satisfies PlanOverrides
    expect(whole.axes.x.ticks.count).toBe(4)

    // @ts-expect-error — `count` without `mode` would produce a tick plan nothing can read.
    const partial = { axes: { x: { ticks: { count: 4 } } } } satisfies PlanOverrides
    expect(partial).toBeDefined()
  })

  it('distinguishes endpoints from a count of two', () => {
    // ⚠ `{ mode: 'endpoints' }` and `{ mode: 'count', count: 2 }` are different states, not
    // two spellings of one. Endpoints pins first and last; a count of two lets the tick
    // algorithm choose two *nice* values, which are usually neither.
    const endpoints = { axes: { x: { ticks: { mode: 'endpoints' } } } } satisfies PlanOverrides
    const two = { axes: { x: { ticks: { mode: 'count', count: 2 } } } } satisfies PlanOverrides
    expect(endpoints.axes.x.ticks).not.toStrictEqual(two.axes.x.ticks)
  })

  it('replaces regionOrder whole rather than partially', () => {
    // An order is not a set of independent facts. A partial order is a different order.
    const overrides = { regionOrder: ['value', 'plot'] } satisfies PlanOverrides
    expect(overrides.regionOrder).toStrictEqual(['value', 'plot'])
  })

  it('rejects a field that is not part of the plan', () => {
    // @ts-expect-error — overrides are forced onto a ChartPlan, so an unknown key would be
    // silently dropped at merge time. Better a type error than a setting that appears to
    // work and does nothing.
    const bogus = { axes: { x: { showTheThing: true } } } satisfies PlanOverrides
    expect(bogus).toBeDefined()
  })
})
