/**
 * `applyOverrides()` — forcing decided values onto a resolved plan.
 *
 * The **after** half of §5's precedence chain. Policy is applied before resolution and
 * changes how the resolver decides; overrides are applied after and change what it decided.
 * That split is why `planChart()` takes five parameters rather than four, and this file is
 * the smaller, more dangerous half of it.
 *
 * ⚠ **Discriminated unions are replaced whole, never merged, and this is the entire reason
 * the file exists.** Merging `{ kind: 'horizon', bands: 1 }` onto `{ kind: 'line', area:
 * false }` yields `{ kind: 'horizon', bands: 1, area: false }` — an object that matches no
 * `MarkSpec` member, is structurally assignable to one under TypeScript's excess-property
 * rules once it has been through a variable, and **renders**. That is the recurring failure
 * species this project keeps naming: a thing that looks like it works and quietly doesn't.
 * Same shape as happy-dom returning `0` for every measurement.
 *
 * ⚠ **`null` is a value, not an absence** (§1.4). `{ axes: { y2: null } }` forces the
 * secondary axis off; it is not "nothing supplied". `undefined` is the absence, because
 * that is what `DeepPartial`'s `?` produces — and it is dropped rather than written through,
 * since a plan containing `undefined` cannot survive `JSON.parse(JSON.stringify(plan))`.
 */

import type { ChartPlan } from './plan.ts'
import { AXIS_OFF } from './plan.ts'
import type { PlanOverrides } from './policy.ts'

/**
 * Paths whose value is a discriminated union (or an array), replaced whole.
 *
 * ⚠ **This list is not maintained by hand alone.** `overrides.test.ts` walks the six rungs
 * and flags any node whose key set differs between two of them — a key set that varies is a
 * union by definition, since §1.1 forbids optional fields — then asserts every such path
 * appears here. A union added to `ChartPlan` and exercised by any rung therefore cannot be
 * forgotten.
 *
 * ⚠ **A union that no rung exercises still can be forgotten, and no test can see that.**
 * `axes.y2.ticks` is exactly that case and is the reason this warning is not hypothetical:
 * only Stage carries a `y2`, so the walk sees one shape and finds no divergence, while
 * `{ y2: { ticks: { mode: 'none' } } }` merged onto `{ mode: 'count', count: 4 }` would
 * leave a stray `count` behind. It is listed by hand, from reading `TickPlan`'s three sites
 * in `./plan.ts`. When a union is added there, add its path here.
 *
 * `interaction.tooltip` is deliberately **absent**: it has a `placement` key, which looks
 * like a discriminant and is not. `{ tooltip: { enabled: false } }` must keep its
 * `placement`, so treating it as atomic would silently drop a field.
 */
export const ATOMIC_PATHS: ReadonlySet<string> = new Set([
  'regionOrder',
  'axes.x.ticks',
  'axes.y.ticks',
  'axes.y2.ticks',
  'legend',
  'marks.primary',
  'marks.facet',
])

/**
 * What to merge onto when the resolver said `null` and the override supplies a partial.
 *
 * ⚠ **`axes.y2` was in `ATOMIC_PATHS` and that was wrong in both directions**, which is
 * worth recording because the reasoning that put it there is superficially sound. The
 * argument was: `null` is not an object, so a partial merged onto it yields an incomplete
 * `AxisPlan`. True — but replacing whole yields *the same incomplete object*, so atomicity
 * bought nothing there; and where the base *is* a full axis, atomicity actively destroyed
 * it, turning `{ y2: { visible: false } }` on a Stage plan into a one-key axis. Marking a
 * field atomic protects it from a bad merge; it does not make a partial total.
 *
 * The thing that does: a base to merge onto. Turning a secondary axis on from `null` starts
 * from the all-off axis, so `{ axes: { y2: { visible: true } } }` produces a complete
 * `AxisPlan` and §1.1 totality survives an override — which `invariants.test.ts` asserts
 * over override-applied plans, not just resolver output.
 */
const NULL_BASE_DEFAULTS: Readonly<Record<string, unknown>> = Object.freeze({
  'axes.y2': AXIS_OFF,
})

/**
 * The paths `NULL_BASE_DEFAULTS` covers. Exported for the same reason `ATOMIC_PATHS` is:
 * `invariants.test.ts` proves §1.1 totality by asserting that every structural divergence
 * between two rungs is declared in one of these two sets, so both have to be readable from
 * the test.
 */
export const NULLABLE_PATHS: ReadonlySet<string> = new Set(Object.keys(NULL_BASE_DEFAULTS))

/**
 * `plan` with `overrides` forced onto it.
 *
 * Returns `plan` itself when there is nothing to apply, so the common path allocates
 * nothing. The result is frozen at every level, for the reason `ChartPlan`'s `readonly`
 * exists: a plan is snapshot-tested in isolation and sent server to client without its
 * inputs, so a mutable one can be edited between those points and still look like the
 * resolver's output.
 */
export function applyOverrides(plan: ChartPlan, overrides?: PlanOverrides): ChartPlan {
  if (overrides === undefined) return plan
  return mergeNode(plan, overrides, '') as ChartPlan
}

function mergeNode(base: unknown, patch: unknown, path: string): unknown {
  // `undefined` means "not supplied" — the meaning of `DeepPartial`'s `?`. It is never
  // written into the result; §1.4 bans it from a plan outright.
  if (patch === undefined) return base

  // `null` IS supplied. This branch is why the loop below cannot test `!== undefined` and
  // then fall through — the two absences are different absences.
  if (patch === null) return null

  if (Array.isArray(patch)) return deepFreeze(patch.slice())
  if (!isPlainObject(patch)) return patch

  // A whole union member. No merge, at any depth below it.
  if (ATOMIC_PATHS.has(path)) return deepFreeze(structuredCopy(patch))

  // The resolver said `null` and the consumer supplied a partial. Merging onto the declared
  // base keeps the result total; without one there is nothing to complete it from.
  const base_ = isPlainObject(base)
    ? base
    : base === null
      ? NULL_BASE_DEFAULTS[path]
      : undefined
  if (!isPlainObject(base_)) return deepFreeze(structuredCopy(patch))

  const out: Record<string, unknown> = { ...base_ }
  for (const key of Object.keys(patch)) {
    const child = (patch as Record<string, unknown>)[key]
    if (child === undefined) continue
    out[key] = mergeNode(base_[key], child, path === '' ? key : `${path}.${key}`)
  }
  return Object.freeze(out)
}

/**
 * ⚠ Copied, not aliased. An override object handed in by a consumer is theirs to mutate
 * afterwards, and a plan holding a live reference to it would change after it was resolved
 * — which is the same mutability hazard `Object.freeze` guards elsewhere, arriving through
 * the caller instead of through the library.
 */
function structuredCopy(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(structuredCopy)
  if (!isPlainObject(value)) return value
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(value)) {
    const child = (value as Record<string, unknown>)[key]
    if (child === undefined) continue
    out[key] = structuredCopy(child)
  }
  return out
}

function deepFreeze(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  return Object.freeze(value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
