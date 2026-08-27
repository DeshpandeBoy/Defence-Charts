/**
 * Focused tests for the B3 policy-threshold gate.
 *
 * The synthetic schemas below make each failure mode observable without editing core or
 * weakening the repository's current report while later chart families are still pending.
 */

import { describe, expect, it } from 'vitest'

import {
  auditPolicyThresholds,
  collectPlanPolicySchema,
  collectPlannerUses,
  formatPolicyThresholdReport,
} from './check-policy-thresholds.mjs'

const VALID_SOURCE = `
export type PlanPolicy = {
  /** px budget. **A-lit** — Fixture source. */
  readonly tickTargetSpacingX: number
  /** point budget. **C**. */
  readonly pointBudget: number
  readonly substitute: boolean
  readonly typography: object
}
`

const VALID_SCHEMA = collectPlanPolicySchema(VALID_SOURCE, 'fixture/policy.ts')
const VALID_DEFAULTS = {
  tickTargetSpacingX: 100,
  pointBudget: 2000,
  substitute: true,
  typography: { fontSize: 12 },
}
const VALID_PLANNER_SOURCES = [
  {
    path: 'fixture/planner.ts',
    source: `export function plan(policy) { return [policy.tickTargetSpacingX, policy['pointBudget']] }`,
  },
]

const FUTURE_SOURCE = `
export type PlanPolicy = {
  /** @future **A-lit** — Fixture source for the next resolver. */
  readonly futureLimit: number
  readonly substitute: boolean
}
`

function audit(overrides = {}) {
  return auditPolicyThresholds({
    schema: overrides.schema ?? VALID_SCHEMA,
    defaults: overrides.defaults ?? VALID_DEFAULTS,
    plannerSources: overrides.plannerSources ?? VALID_PLANNER_SOURCES,
  })
}

describe('B3 policy schema extraction', () => {
  it('derives numeric and numeric-literal thresholds without a duplicate list', () => {
    const source = `${VALID_SOURCE.replace('readonly pointBudget: number', 'readonly pointBudget: 1 | 2 | 3')}`
    const schema = collectPlanPolicySchema(source, 'fixture/policy.ts')
    expect(schema.fields.map((field) => field.name)).toEqual([
      'tickTargetSpacingX',
      'pointBudget',
      'substitute',
      'typography',
    ])
    expect(schema.thresholds.map((field) => field.name)).toEqual(['tickTargetSpacingX', 'pointBudget'])
  })

  it('reads explicit tier markers from the field JSDoc', () => {
    expect(VALID_SCHEMA.thresholds.map((field) => field.tier)).toEqual(['A-lit', 'C'])
  })
})

describe('B3 policy audit', () => {
  it('passes a total, serialisable, tiered policy consumed by core resolver source', () => {
    const report = audit()
    expect(report.issues).toEqual([])
    expect(formatPolicyThresholdReport(report)).toMatch(/^B3 policy threshold gate: PASS/)
  })

  it('fails when a threshold has no default', () => {
    const defaults = { ...VALID_DEFAULTS }
    delete defaults.pointBudget
    const report = audit({ defaults })
    expect(report.issues).toContainEqual({
      code: 'missing-default',
      subject: 'pointBudget',
      detail: 'no DEFAULT_POLICY value',
    })
  })

  it('fails when JSON would lose a default value', () => {
    const defaults = { ...VALID_DEFAULTS, pointBudget: Number.NaN }
    const report = audit({ defaults })
    expect(report.issues).toContainEqual({
      code: 'invalid-default',
      subject: 'pointBudget',
      detail: 'expected a finite number, received number',
    })
    expect(report.issues.some((issue) => issue.code === 'not-serialisable')).toBe(true)
  })

  it('fails when a threshold has no provenance tier', () => {
    const schema = collectPlanPolicySchema(
      VALID_SOURCE.replace('/** point budget. **C**. */', '/** point budget with no tier. */'),
      'fixture/policy.ts',
    )
    const report = audit({ schema })
    expect(report.issues).toContainEqual({
      code: 'missing-tier',
      subject: 'pointBudget',
      detail: 'JSDoc must carry **A-lit**, **A-impl**, **B**, or **C**',
    })
  })

  it('fails when a threshold is absent from core resolver reads', () => {
    const report = audit({
      plannerSources: [{ path: 'fixture/planner.ts', source: 'export function plan(policy) { return policy.tickTargetSpacingX }' }],
    })
    expect(report.issues).toContainEqual({
      code: 'unconsumed',
      subject: 'pointBudget',
      detail: 'no non-test core resolver source reads policy.pointBudget',
    })
  })

  it('allows an explicitly reserved future threshold when its tier remains present', () => {
    const schema = collectPlanPolicySchema(FUTURE_SOURCE, 'fixture/future-policy.ts')
    const report = auditPolicyThresholds({
      schema,
      defaults: { futureLimit: 8, substitute: true },
      plannerSources: [],
    })
    expect(schema.thresholds[0]).toMatchObject({ future: true, tier: 'A-lit' })
    expect(report.issues).toEqual([])
  })

  it('does not count comments as core resolver consumption', () => {
    const uses = collectPlannerUses(
      '// policy.pointBudget\nexport function plan(policy) { return policy.tickTargetSpacingX }',
      'fixture/planner.ts',
      new Set(['tickTargetSpacingX', 'pointBudget']),
    )
    expect(uses.has('tickTargetSpacingX')).toBe(true)
    expect(uses.has('pointBudget')).toBe(false)
  })

  it('counts a local alias only when it is explicitly resolved from policy', () => {
    const uses = collectPlannerUses(
      `const resolved = resolvePolicy(policy)\nconst unrelated = { pointBudget: 999 }\nexport const budget = resolved.pointBudget + unrelated.pointBudget`,
      'fixture/resolver.ts',
      new Set(['pointBudget']),
    )
    expect(uses.get('pointBudget')).toEqual([3])
  })

  it('reports issues in stable order', () => {
    const report = audit({
      defaults: { ...VALID_DEFAULTS, pointBudget: undefined },
      plannerSources: [],
    })
    const again = audit({
      defaults: { ...VALID_DEFAULTS, pointBudget: undefined },
      plannerSources: [],
    })
    expect(formatPolicyThresholdReport(report)).toBe(formatPolicyThresholdReport(again))
    expect(report.issues.map((issue) => issue.code)).toEqual([
      'invalid-default',
      'not-serialisable',
      'unconsumed',
      'unconsumed',
    ])
  })
})
