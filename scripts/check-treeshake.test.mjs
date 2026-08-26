/**
 * Gate **G5** — *"import one chart, ship one chart"*, asserted in BOTH directions.
 *
 * ⚠ Decision 015: *a gate never observed to fail is not a gate — it is a job that exits 0.*
 *
 * The deny fixture went through two versions and the first one is the reason this file
 * exists. It planted a side-effecting registry module — the textbook tree-shaking defeat —
 * and the gate passed it, because the fixture manifest declared `"sideEffects": false` and
 * rolldown correctly dropped the module. Every package in this repo declares that. A gate
 * validated only against that fixture would have shipped green and stayed green through
 * any real leak.
 *
 * `it('is defeated by a manifest that every package here already sets')` pins the
 * measurement so the wrong fixture is not reinvented.
 */

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  COMPONENTS,
  EXPECTED,
  checkWorld,
  checkPrimitiveEntrypoints,
  discoverPackages,
  exportedValues,
  probeSymbol,
  symmetricDifference,
} from './check-treeshake.mjs'

const FIXTURES = fileURLToPath(new URL('./__fixtures__/', import.meta.url))
const PACKAGES = fileURLToPath(new URL('../packages/', import.meta.url))

/**
 * ⚠ A throw, not a `?.`. Every use below reaches into a fixture or a workspace package by
 * name, and optional chaining past a missing one turns "the fixture vanished" into an
 * assertion on `undefined` — a test that fails for a reason unrelated to the gate.
 *
 * @template T
 * @param {T | undefined} value
 * @param {string} what
 * @returns {T}
 */
function must(value, what) {
  if (value === undefined) throw new Error(`expected to find ${what}`)
  return value
}

/**
 * ⚠ The fixture's table is read from the fixture, not restated here. Each fixture ships an
 * `expected.mjs` so that `node scripts/check-treeshake.mjs <fixture> --table=<fixture>/expected.mjs`
 * and these tests exercise the same table. A copy in this file would let the two drift, and
 * the version that drifts is always the one nobody runs.
 *
 * @param {string} name
 */
async function fixtureTable(name) {
  const dir = join(FIXTURES, name)
  /** @type {{ EXPECTED: Record<string, Record<string, readonly string[]>>, COMPONENTS: readonly import('./check-treeshake.mjs').ComponentRule[] }} */
  const table = await import(join(dir, 'expected.mjs'))
  return { dir, expected: table.EXPECTED, components: table.COMPONENTS }
}

/** @param {string} name */
async function runFixture(name) {
  const { dir, expected, components } = await fixtureTable(name)
  return checkWorld({ world: await discoverPackages(dir), expected, components })
}

/**
 * The one package in a fixture, plus that fixture's component universe.
 *
 * @param {string} name
 */
async function fixtureProbe(name) {
  const { dir, components } = await fixtureTable(name)
  const world = await discoverPackages(dir)
  return { pkg: must(world[0], `a package in fixture ${name}`), components }
}

describe('the allow direction', () => {
  it('passes two charts that share a helper neither of them owns', async () => {
    const { failures, probes } = await runFixture('treeshake-allow')
    expect(failures).toEqual([])
    expect(probes).toBe(2)
  })

  it('lets shared infrastructure ride along without calling it a component', async () => {
    // ⚠ `shared.ts` is in both bundles and that is correct. A gate that counted surviving
    // *modules* would reject this, which is why the component universe exists at all.
    const { pkg, components: universe } = await fixtureProbe('treeshake-allow')
    const { components, modules } = await probeSymbol(pkg.barrel, 'lineChart', pkg.src, universe)
    expect(modules).toEqual(['line.ts', 'shared.ts'])
    expect(components).toEqual(['line'])
  })
})

describe('the deny direction', () => {
  it('rejects a line chart that drags the bar chart in', async () => {
    const { failures } = await runFixture('treeshake-deny')
    expect(failures).toHaveLength(1)
    expect(failures[0]?.symbol).toBe('lineChart')
    expect(failures[0]?.actual).toEqual(['bar', 'line'])
  })

  it('prints the symmetric difference, which is the whole value of the gate', async () => {
    // A bare "failed" tells the author that something they cannot see has changed.
    const { failures } = await runFixture('treeshake-deny')
    expect(failures[0]?.diff).toEqual({ only_in_expected: [], only_in_actual: ['bar'] })
    expect(await formatOf(failures)).toContain('symmetricDifference: -[] +[bar]')
  })

  it('leaves the chart that did nothing wrong alone', async () => {
    // If both probes failed, the fixture would be asserting "bundling is broken" rather
    // than "line reaches bar", and the diff would stop naming a cause.
    const { failures } = await runFixture('treeshake-deny')
    expect(failures.map((f) => f.symbol)).not.toContain('barChart')
  })
})

describe('the refusal to skip', () => {
  it('fails a package that is absent from EXPECTED rather than passing it', async () => {
    // A package nobody added to the table would otherwise be the one package in the repo
    // this gate never looks at — and it would look exactly like a package that is clean.
    const { failures, probes } = await checkWorld({
      world: await discoverPackages(join(FIXTURES, 'treeshake-deny')),
      expected: {},
    })
    expect(probes).toBe(0)
    expect(failures).toHaveLength(1)
    expect(failures[0]?.kind).toBe('undeclared')
  })

  it('does not print an empty diff for it, which would read as a leak of nothing', async () => {
    // ⚠ The leak shape emitted `expected: []` / `actual: []` / `-[] +[]` for this case, over
    // a headline that read `1 of 0 probe(s)`. Four lines of empty brackets and an impossible
    // count, in a gate whose entire value is the legibility of its diff.
    const { failures } = await checkWorld({
      world: await discoverPackages(join(FIXTURES, 'treeshake-deny')),
      expected: {},
    })
    const text = await formatOf(failures)
    expect(text).toBe('  @fixture/deny-treeshake  no entry in EXPECTED — add one, even if it is empty')
    expect(text).not.toContain('symmetricDifference')
  })
})

describe('the fixture that was rejected', () => {
  it('is defeated by a manifest that every package here already sets', async () => {
    // ⚠ The measurement, pinned. A side-effecting registry module is the textbook
    // tree-shaking defeat and it is the WRONG fixture for this repo: with
    // `"sideEffects": false` declared — as @shiftcharts/core, @shiftcharts/testing and the deny fixture all
    // do — rolldown drops the registry and the probe comes back clean. The shipped fixture
    // uses a genuine value dependency, which no manifest field can remove.
    const { pkg, components: universe } = await fixtureProbe('treeshake-deny')
    const manifest = await import(`${pkg.dir}/package.json`, { with: { type: 'json' } })
    expect(manifest.default.sideEffects).toBe(false)

    const { components } = await probeSymbol(pkg.barrel, 'lineChart', pkg.src, universe)
    expect(components).toContain('bar')
  })
})

describe('symmetricDifference', () => {
  it('reports both directions separately, because they mean different things', () => {
    // Only-in-actual is a leak. Only-in-expected is a component that stopped shipping —
    // just as wrong, and invisible if the two are merged into one list.
    expect(symmetricDifference(['line', 'planner'], ['line', 'bar'])).toEqual({
      only_in_expected: ['planner'],
      only_in_actual: ['bar'],
    })
  })

  it('is empty for equal sets regardless of order', () => {
    expect(symmetricDifference(['b', 'a'], ['a', 'b'])).toEqual({
      only_in_expected: [],
      only_in_actual: [],
    })
  })
})

describe('the real tree', () => {
  it('reads value exports off the bundle, so types cost nothing', async () => {
    // ⚠ `@shiftcharts/core`'s barrel exports 80 names; 34 of them can cost bytes. Reading the source
    // instead would make this gate probe 46 type aliases that are erased before a bundler
    // ever sees them, and it would tie G5's correctness to G6's parser.
    const world = await discoverPackages(PACKAGES)
    const core = must(
      world.find((p) => p.name === '@shiftcharts/core'),
      '@shiftcharts/core in the workspace',
    )
    const values = await exportedValues(core.barrel)
    expect(values).toContain('planChart')
    expect(values).not.toContain('ChartPlan')
  })

  it('declares an expectation for every package, so none is silently skipped', async () => {
    const world = await discoverPackages(PACKAGES)
    for (const pkg of world) {
      expect(Object.keys(EXPECTED)).toContain(pkg.name)
    }
  })

  it('ships the real tree carrying exactly its declared components', async () => {
    const world = await discoverPackages(PACKAGES)
    const { failures, probes } = await checkWorld({ world })
    expect(failures).toEqual([])
    expect(probes).toBeGreaterThan(40)
  })

  it('keeps one mark out of another mark’s bundle', async () => {
    // The product claim, at its narrowest. `<Chart plan={…}>` carries every mark and must;
    // `<LinePath>` carries one.
    const world = await discoverPackages(PACKAGES)
    const primitives = must(
      world.find((p) => p.name === '@shiftcharts/primitives'),
      '@shiftcharts/primitives in the workspace',
    )
    const { components } = await probeSymbol(
      primitives.barrel,
      'LinePath',
      primitives.src,
      COMPONENTS,
    )
    expect(components).toEqual(['line-path'])
  })

  it('keeps family entrypoints isolated from the other family renderers', async () => {
    const world = await discoverPackages(PACKAGES)
    const result = await checkPrimitiveEntrypoints({ world })
    expect(result.failures).toEqual([])
    expect(result.probes).toBe(3)
  })
})

/** @param {readonly import('./check-treeshake.mjs').Failure[]} failures */
async function formatOf(failures) {
  const { formatFailures } = await import('./check-treeshake.mjs')
  return formatFailures(failures)
}
