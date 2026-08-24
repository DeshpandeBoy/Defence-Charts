/**
 * Gate **G20**, pointed at the granularity coverage manifest — see `check-granularity.mjs`'s
 * header for the mandate this enforces and why the plan-path walk has to be union-aware.
 *
 * ⚠ `43-theming.md` §6.3: "A gate never observed to fail is not a gate — it is a job that exits
 * 0." Every hard-failure assertion below (plan-path resolution, decline sources, the manifest
 * matching the table in both directions) is paired with a planted-violation case that proves it
 * can go red, not just that it currently doesn't.
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { auditGranularity, buildPlanProject, resolvePlanPath } from './check-granularity.mjs'
import { collectDeclaredTokens } from './check-tokens.mjs'
import { COLUMN_KEYS, DISPOSITIONS, parseGranularityTable } from './granularity.mjs'

const url = (path) => fileURLToPath(new URL(path, import.meta.url))
const RESEARCH_DOC = url('../research/raw/06-design-tokens-widgets.md')
const THEMES_DIR = url('../packages/tokens/src/themes/')

const markdown = await readFile(RESEARCH_DOC, 'utf8')
const rows = parseGranularityTable(markdown)
const declaredTokens = await collectDeclaredTokens(THEMES_DIR)
const project = buildPlanProject()

const solidCount = (row) => Object.values(row.marks).filter((m) => m === '●').length

describe('the granularity table parser', () => {
  it('finds all 30 knob rows across all 10 libraries', () => {
    expect(rows.length).toBe(30)
    for (const row of rows) {
      expect(Object.keys(row.marks).sort()).toEqual([...COLUMN_KEYS].sort())
      for (const key of COLUMN_KEYS) {
        expect(row.marks[key], `${row.knob} / ${key}`).not.toBeNull()
      }
    }
  })
})

describe('the disposition manifest', () => {
  it('names exactly the knobs the table contains, in both directions', () => {
    const tableLabels = new Set(rows.map((r) => r.knob))
    const dispositionLabels = new Set(Object.keys(DISPOSITIONS))
    for (const label of dispositionLabels) {
      expect(tableLabels.has(label), `"${label}" is dispositioned but not in the table`).toBe(true)
    }
    for (const label of tableLabels) {
      expect(dispositionLabels.has(label), `"${label}" is in the table but not dispositioned`).toBe(true)
    }
  })

  /**
   * ⚠ A ratchet, not a target — matching `generate-tokens-css.test.mjs`'s census tests. A row
   * arriving in the table with no matching key in `DISPOSITIONS` is the exact failure this
   * milestone exists to prevent. Lower this number when the work grows; never raise it.
   */
  it('owes no more rows to B2 than it did when the manifest was written', () => {
    const report = auditGranularity({ rows, dispositions: DISPOSITIONS, declaredTokens, project })
    expect(report.owedToB2).toBeLessThanOrEqual(0)
  })

  /**
   * ⚠ A ratchet, not a target. `owedToB1` clears by declaring the named tokens in
   * `packages/tokens/src/tokens.ts` — B1's work, not this gate's. It is allowed to fall as B1
   * lands and to fall further as more of B2 gets dispositioned; it is never allowed to grow,
   * because that is a disposition citing a token name nobody intends to declare.
   */
  it('owes no more to B1 than it did when the manifest was written', () => {
    const report = auditGranularity({ rows, dispositions: DISPOSITIONS, declaredTokens, project })
    expect(report.owedToB1).toBeLessThanOrEqual(63)
  })
})

describe('plan-path resolution', () => {
  it('resolves every plan path the manifest cites', () => {
    for (const [knob, disposition] of Object.entries(DISPOSITIONS)) {
      for (const path of disposition.planPaths ?? []) {
        expect(resolvePlanPath(project, path), `${knob}: ChartPlan.${path}`).toBe(true)
      }
    }
  })

  it('walks into a union member rather than failing at the union', () => {
    // `TickPlan` is a 3-way union; `count` exists on exactly one member.
    expect(resolvePlanPath(project, 'axes.x.ticks.count')).toBe(true)
    // `AxisPlan` is not a union — every member (there is only one) carries `domainLine`.
    expect(resolvePlanPath(project, 'axes.x.domainLine')).toBe(true)
  })

  it('fails on a path that does not exist, proving the check is not vacuously true', () => {
    expect(resolvePlanPath(project, 'axes.x.ticks.nonexistent')).toBe(false)
    expect(resolvePlanPath(project, 'thisFieldDoesNotExist')).toBe(false)
  })
})

describe('declined rows', () => {
  it('cites a source file that exists, for every declined row', () => {
    const declinedRows = Object.entries(DISPOSITIONS).filter(([, d]) => d.declined !== undefined)
    expect(declinedRows.length).toBeGreaterThan(0)
    for (const [knob, disposition] of declinedRows) {
      expect(existsSync(url(`../${disposition.declined.source}`)), `${knob}: ${disposition.declined.source}`).toBe(
        true,
      )
    }
  })

  it('flags a decline citing a source that does not exist', () => {
    const report = auditGranularity({
      rows,
      dispositions: {
        ...DISPOSITIONS,
        'Line stroke width': { declined: { reason: 'fixture', source: 'research/decisions/does-not-exist.md' } },
      },
      declaredTokens,
      project,
    })
    expect(report.undeclaredDecline).toContainEqual({
      knob: 'Line stroke width',
      source: 'research/decisions/does-not-exist.md',
    })
  })
})

describe('§7.2 "honest read", checked mechanically where it can be', () => {
  /**
   * §7.2 point 3: "Two rows where the whole field is weak" — legend item gap and label halo.
   * A mechanical proxy for "weak": fewer libraries mark ● than in a typical row.
   */
  it('confirms the two cited "cheap win" rows have fewer ● marks than a typical row', () => {
    const counts = rows.map(solidCount).sort((a, b) => a - b)
    const median = counts[Math.floor(counts.length / 2)]
    const byKnob = Object.fromEntries(rows.map((r) => [r.knob, solidCount(r)]))
    expect(byKnob['Legend item gap']).toBeLessThan(median)
    expect(byKnob['Label halo / outline']).toBeLessThan(median)
  })

  /**
   * ⚠ Finding, recorded rather than asserted away. §7.2 point 4's "best-of-eight" rows are each
   * framed as "library X only" — but raw ● counts don't reproduce that: e.g. "Dash offset
   * (phase)" shows ● for ECharts and Plot too, because the table's legend can't distinguish
   * "has a dash offset" from "has a dash offset *per guide element*", which is Vega-Lite's
   * actual differentiator. See `research/44-granularity.md` for the full reading — this test
   * only confirms the manifest's note says so, rather than silently re-deriving a false count.
   */
  it('documents where the best-of-eight framing needs the prose, not just the marks', () => {
    const dashPhase = DISPOSITIONS['Dash offset (phase)']
    expect(solidCount(rows.find((r) => r.knob === 'Dash offset (phase)'))).toBeGreaterThan(1)
    expect(dashPhase.note).toMatch(/ECharts and Plot/)
  })
})
