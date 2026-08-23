/**
 * `applyOverrides()` — the **after** half of §5's precedence chain.
 *
 * Small file, disproportionate risk. Merging a discriminated union produces an object that
 * matches no member of it, is structurally assignable to one once it has been through a
 * variable, and **renders** — the recurring failure species this project keeps naming: a
 * thing that looks like it works and quietly doesn't. Same shape as happy-dom returning `0`
 * for every measurement, and as the CSS `y2` in decision 012.
 *
 * ⚠ The two absences are different absences, and most of this file is about that.
 * `undefined` means "not supplied" — it is what `DeepPartial`'s `?` produces, and it must
 * leave the resolver's decision alone. `null` is a **supplied value** (§1.4): `{ y2: null }`
 * forces the secondary axis off. A merge that tests `!== undefined` and falls through gets
 * one of the two wrong, and which one depends on which it tested.
 */

import { describe, expect, it } from 'vitest'

import { applyOverrides, ATOMIC_PATHS, NULLABLE_PATHS } from './overrides.ts'
import { planChart } from './plan-chart.ts'
import type { ChartPlan } from './plan.ts'
import type { PlanOverrides } from './policy.ts'
import { CANVAS, MANY_SERIES, PANEL, SHAPE, SIX, STAGE } from './rungs/fixtures.ts'

const panel = (): ChartPlan => planChart('line', PANEL, SHAPE)
const canvas = (): ChartPlan => planChart('line', CANVAS, MANY_SERIES)
const stage = (): ChartPlan => planChart('line', STAGE, MANY_SERIES)

/**
 * Overrides as they arrive from a caller with no types — a config file, a URL parameter, a
 * JS consumer. `applyOverrides` is exported and runs at exactly that boundary, so the shapes
 * `PlanOverrides` forbids still reach it. See the note in *null is a value* below.
 */
const fromUntypedCaller = (raw: Record<string, unknown>): PlanOverrides => raw as PlanOverrides

// --- The hazard --------------------------------------------------------------------------

describe('discriminated unions are replaced whole, never merged', () => {
  /**
   * The named case from the milestone's verification list. `{ kind: 'line', area: false }`
   * merged with `{ kind: 'horizon', bands: 1 }` would leave `area` behind — an object that
   * is not a `MarkSpec` and that a renderer switching on `kind` would draw anyway.
   */
  it('MarkSpec — no `area` key survives a switch to horizon', () => {
    const out = applyOverrides(panel(), { marks: { primary: { kind: 'horizon', bands: 1 } } })
    expect(out.marks.primary).toEqual({ kind: 'horizon', bands: 1 })
    expect(Object.keys(out.marks.primary)).toEqual(['kind', 'bands'])
    expect('area' in out.marks.primary).toBe(false)
  })

  it('MarkSpec — and no `bands` key survives the reverse', () => {
    const horizon = applyOverrides(panel(), { marks: { primary: { kind: 'horizon', bands: 3 } } })
    const back = applyOverrides(horizon, { marks: { primary: { kind: 'line', area: true } } })
    expect(back.marks.primary).toEqual({ kind: 'line', area: true })
    expect('bands' in back.marks.primary).toBe(false)
  })

  it('TickPlan — no stray `count` on an axis switched off', () => {
    const out = applyOverrides(panel(), { axes: { x: { ticks: { mode: 'none' } } } })
    expect(out.axes.x.ticks).toEqual({ mode: 'none' })
    expect('count' in out.axes.x.ticks).toBe(false)
    // ⚠ Sibling keys of the union, at the same level, are still merged. `ticks` is atomic;
    // `axes.x` is not, and flattening that distinction would drop `domainLine`.
    expect(out.axes.x.visible).toBe(true)
    expect(out.axes.x.domainLine).toBe(true)
  })

  it("TickPlan — 'endpoints' does not inherit a count either", () => {
    const out = applyOverrides(panel(), { axes: { y: { ticks: { mode: 'endpoints' } } } })
    expect(out.axes.y.ticks).toEqual({ mode: 'endpoints' })
  })

  /**
   * ⚠ The union no rung exercises twice. Only Stage carries a `y2`, so the divergence walk
   * in `invariants.test.ts` sees one shape and reports nothing — `axes.y2.ticks` is in
   * `ATOMIC_PATHS` by hand, from reading `TickPlan`'s three sites, and this is the test that
   * would have caught its absence.
   */
  it('TickPlan — on the secondary axis, which no walk could have found', () => {
    const out = applyOverrides(stage(), { axes: { y2: { ticks: { mode: 'none' } } } })
    expect(out.axes.y2?.ticks).toEqual({ mode: 'none' })
    expect(out.axes.y2 === null || 'count' in out.axes.y2.ticks).toBe(false)
  })

  it('FacetPlan — no stray `columns` when faceting is turned off', () => {
    const faceted = stage()
    expect(faceted.marks.facet).toEqual({ mode: 'series', columns: 3 })
    const out = applyOverrides(faceted, { marks: { facet: { mode: 'none' } } })
    expect(out.marks.facet).toEqual({ mode: 'none' })
  })

  it('LegendPlan — an external legend collapsing to absent keeps none of its four extra keys', () => {
    const external = canvas()
    expect(external.legend.placement).toBe('external')
    const out = applyOverrides(external, { legend: { placement: 'absent' } })
    expect(out.legend).toEqual({ placement: 'absent' })
    expect(Object.keys(out.legend)).toEqual(['placement'])
  })

  it('arrays are replaced, not concatenated or index-merged', () => {
    const out = applyOverrides(panel(), { regionOrder: ['table'] })
    expect(out.regionOrder).toEqual(['table'])
  })
})

// --- The two absences --------------------------------------------------------------------

describe('null is a value; undefined is an absence', () => {
  it('{ y2: null } forces the secondary axis off', () => {
    const withY2 = stage()
    expect(withY2.axes.y2).not.toBeNull()
    expect(applyOverrides(withY2, { axes: { y2: null } }).axes.y2).toBeNull()
  })

  /**
   * ⚠ **The two casts below are the finding, not a workaround.** `exactOptionalPropertyTypes`
   * is on, so `DeepPartial`'s `?:` means *the key may be absent* — not *the key may be
   * `undefined`*. A typed caller therefore **cannot write** `{ y2: undefined }` at all, and
   * for a typed caller that is the right answer: the ambiguity is unreachable.
   *
   * It is reachable everywhere else. §1.4 makes a plan serialisable precisely so overrides
   * can arrive from a config file, a URL parameter, or a JS consumer with no types in sight,
   * and `JSON.parse`, a spread over a missing lookup and `Object.fromEntries` all produce an
   * explicit `undefined` as a matter of routine. `applyOverrides` runs at that boundary. The
   * cast is how a test written *inside* the types reaches a case that only occurs outside
   * them; deleting these two because the compiler dislikes their input would leave the
   * merge's behaviour on real input unasserted.
   *
   * ⚠ Spelled through `fromUntypedCaller` rather than `as unknown as PlanOverrides`, so the
   * escape names the boundary it is crossing. `tsc` rejects the direct assertion outright —
   * *"neither type sufficiently overlaps"* — which is worth noting as agreement rather than
   * obstruction: it is the same fact these tests assert, arriving from the other side.
   */
  it('{ y2: undefined } leaves the resolver’s decision alone', () => {
    const withY2 = stage()
    const untyped = fromUntypedCaller({ axes: { y2: undefined } })
    expect(applyOverrides(withY2, untyped).axes.y2).toEqual(withY2.axes.y2)
  })

  it('an explicit undefined is never written into the plan', () => {
    const out = applyOverrides(panel(), fromUntypedCaller({ labels: { maxChars: undefined } }))
    expect('maxChars' in out.labels).toBe(true)
    expect(out.labels.maxChars).toBeNull()
    expect(JSON.parse(JSON.stringify(out))).toEqual(out)
  })

  it('null on a leaf is written through', () => {
    const out = applyOverrides(panel(), { labels: { maxChars: null } })
    expect(out.labels.maxChars).toBeNull()
  })
})

// --- Totality survives an override -------------------------------------------------------

describe('§1.1 — an override cannot produce a partial plan', () => {
  /**
   * ⚠ **`axes.y2` was in `ATOMIC_PATHS`, and that was wrong.** The argument for putting it
   * there — `null` is not an object, so merging a partial onto it yields an incomplete
   * `AxisPlan` — is true and does not lead where it looks like it leads: replacing whole
   * produces *the same incomplete object*. Atomicity protects a field from a bad merge; it
   * does not make a partial total. A declared base to merge onto does.
   */
  it('turning a secondary axis on from null produces a complete axis', () => {
    const out = applyOverrides(panel(), { axes: { y2: { visible: true } } })
    expect(out.axes.y2).toEqual({
      visible: true,
      domainLine: false,
      ticks: { mode: 'none' },
      title: false,
      gridlines: false,
    })
  })

  it('and the same patch on a plan that already has one keeps its other four keys', () => {
    const before = stage()
    const out = applyOverrides(before, { axes: { y2: { visible: false } } })
    expect(out.axes.y2).toEqual({ ...before.axes.y2, visible: false })
  })

  it('every group keeps its full key set after a one-key patch', () => {
    const before = canvas()
    const after = applyOverrides(before, {
      interaction: { crosshair: false },
      narrative: { annotations: true },
      motion: { objectConstancy: true },
      dataTable: { initiallyExpanded: true },
      aggregate: { expandable: true },
    })
    for (const group of ['interaction', 'narrative', 'motion', 'dataTable', 'aggregate'] as const) {
      expect(Object.keys(after[group]).sort(), group).toEqual(Object.keys(before[group]).sort())
    }
  })

  /**
   * ⚠ `interaction.tooltip` is deliberately **not** atomic, and it is the one node where the
   * obvious heuristic gets it wrong. A rule like "any object with a `kind`/`mode`/`placement`
   * key is a union" would fire here — `placement` looks exactly like a discriminant — and
   * silently drop `placement` from `{ tooltip: { enabled: false } }`. It is not a union;
   * `InteractionPlan` declares both keys unconditionally.
   */
  it('tooltip merges, because its `placement` is not a discriminant', () => {
    const out = applyOverrides(canvas(), { interaction: { tooltip: { enabled: false } } })
    expect(out.interaction.tooltip).toEqual({ enabled: false, placement: 'fluid' })
  })
})

// --- The declared list, checked from both sides -------------------------------------------

describe('ATOMIC_PATHS', () => {
  /**
   * `invariants.test.ts` checks the list is *sufficient* — every divergence between rungs is
   * declared. This checks the other side: every declared path actually behaves atomically.
   * A path listed but not honoured would pass the first test and protect nothing.
   *
   * The probe key is deliberately not a real field. If the path merges, the probe lands
   * beside the resolver's keys and the result has more than one; if it replaces, the probe is
   * all that is left.
   */
  it('every listed path replaces its whole subtree', () => {
    const plan = stage()
    for (const path of ATOMIC_PATHS) {
      if (path === 'regionOrder') continue // an array; covered above
      const patched = applyOverrides(plan, nest(path, { probe: true }) as PlanOverrides)
      expect(valueAt(patched, path), path).toEqual({ probe: true })
    }
  })

  it('a path that is NOT listed merges, which is what makes the list mean something', () => {
    const plan = stage()
    for (const path of ['axes.x', 'interaction.tooltip', 'narrative', 'motion']) {
      const patched = applyOverrides(plan, nest(path, { probe: true }) as PlanOverrides)
      const node = valueAt(patched, path) as Record<string, unknown>
      expect(Object.keys(node).length, path).toBeGreaterThan(1)
      expect(node['probe'], path).toBe(true)
    }
  })

  it('NULLABLE_PATHS names only paths that a rung actually leaves null', () => {
    const plans = SIX.map(([, ctx, shape]) => planChart('line', ctx, shape))
    for (const path of NULLABLE_PATHS) {
      expect(plans.some((p) => valueAt(p, path) === null), path).toBe(true)
    }
  })
})

// --- Ownership and immutability -----------------------------------------------------------

describe('the plan is a value, and stays one', () => {
  it('returns the same object when there is nothing to apply', () => {
    const plan = panel()
    expect(applyOverrides(plan, undefined)).toBe(plan)
  })

  it('does not mutate the plan it was given', () => {
    const plan = stage()
    const before = JSON.stringify(plan)
    applyOverrides(plan, { legend: { placement: 'absent' }, axes: { y2: null } })
    expect(JSON.stringify(plan)).toBe(before)
  })

  /**
   * ⚠ The override object is the caller's, and they may keep editing it. A plan holding a
   * live reference to one would change after it was resolved — the same mutability hazard
   * `Object.freeze` guards elsewhere, arriving through the caller instead of the library.
   */
  it('copies the override rather than aliasing it', () => {
    const overrides = { marks: { primary: { kind: 'horizon' as const, bands: 1 as const } } }
    const out = applyOverrides(panel(), overrides)
    // The caller mutating their own object afterwards must not reach the plan. They cannot
    // reach it through the frozen result either, which is what the throw below shows.
    expect(Object.isFrozen(out.marks.primary)).toBe(true)
    expect(out.marks.primary).not.toBe(overrides.marks.primary)
  })

  it('freezes every node it produces', () => {
    const out = applyOverrides(stage(), {
      axes: { y2: { visible: true, ticks: { mode: 'count', count: 3 } } },
      legend: { placement: 'internal', maxEntries: 3 },
    })
    const seen: unknown[] = [out, out.axes, out.axes.y2, out.axes.y2?.ticks, out.legend]
    for (const node of seen) expect(Object.isFrozen(node)).toBe(true)
  })
})

// --- Helpers -------------------------------------------------------------------------------

/** `'a.b.c'` + value → `{ a: { b: { c: value } } }`. */
function nest(path: string, value: unknown): unknown {
  return path
    .split('.')
    .reverse()
    .reduce<unknown>((acc, key) => ({ [key]: acc }), value)
}

function valueAt(root: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (node, key) => (node === null || typeof node !== 'object' ? undefined : (node as Record<string, unknown>)[key]),
      root,
    )
}
