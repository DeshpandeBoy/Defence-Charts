/**
 * Gate **G6** — the public API surface, asserted in BOTH directions.
 *
 * ⚠ Decision 015: *a gate never observed to fail is not a gate — it is a job that exits 0.*
 *
 * For this gate the allow direction is the load-bearing half, not the ceremonial one. The
 * first implementation — api-extractor's reachability rule, every declaration reachable
 * from a public one — was run against the real tree and produced four reports of which
 * three were **false positives**: a body-local `const` annotation and two operands of a
 * conditional type. A deny-only fixture would have caught none of them, and the gate would
 * have shipped demanding exports for three types no consumer can ever be in a position to
 * write. `describe('the exclusions')` is that failure, pinned.
 */

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkWorld, discoverPackages } from './check-api.mjs'

const FIXTURES = fileURLToPath(new URL('./__fixtures__/', import.meta.url))
const PACKAGES = fileURLToPath(new URL('../packages/', import.meta.url))

/** @param {string} name */
async function report(name) {
  return checkWorld(await discoverPackages(join(FIXTURES, name)))
}

describe('the allow direction', () => {
  it('passes a package whose every reachable type is on its barrel', async () => {
    const { missingExports, forbiddenExports } = await report('api-allow')
    expect(missingExports).toEqual([])
    expect(forbiddenExports).toEqual([])
  })

  it('opened something — two fixture packages, not zero', async () => {
    // A walk that finds no barrel reports no violation, which reads identically to a clean
    // tree. This is the assertion that tells the two apart.
    const world = await discoverPackages(join(FIXTURES, 'api-allow'))
    expect(world.map((p) => p.name)).toEqual([
      '@fixture/allow-api',
      '@fixture/allow-api-consumer',
    ])
  })
})

describe('the deny direction', () => {
  it('reports a prop type that is not on its own package barrel', async () => {
    const { missingExports } = await report('api-deny')
    const own = missingExports.filter((m) => m.pkg === '@fixture/deny-api')
    expect(own).toHaveLength(1)
    expect(own[0]?.type).toBe('SeriesStyle')
    expect(own[0]?.reason).toContain("not exported from @fixture/deny-api's own barrel")
  })

  it('names the first barrel export that reaches it, so the report is actionable', async () => {
    const { missingExports } = await report('api-deny')
    const own = missingExports.find((m) => m.pkg === '@fixture/deny-api')
    expect(own?.via).toBe('ChartProps')
  })

  it('rejects an export whose name ends in Internal', async () => {
    const { forbiddenExports } = await report('api-deny')
    const hit = forbiddenExports.find((f) => f.symbol === 'renderInternal')
    expect(hit?.rule).toBe('internal-suffix')
  })

  it('rejects an unallowlisted symbol from a .generated module', async () => {
    const { forbiddenExports } = await report('api-deny')
    const hit = forbiddenExports.find((f) => f.symbol === 'RAW_ADVANCES')
    expect(hit?.rule).toBe('generated-module')
  })

  it('permits the one generated symbol that is on the allowlist', async () => {
    // ⚠ If this ever fails, the generated rule has stopped being an allowlist and become a
    // ban — and `ROBOTO_FLEX_METRICS` is a published part of `@shiftcharts/core`.
    const { forbiddenExports } = await report('api-deny')
    expect(forbiddenExports.map((f) => f.symbol)).not.toContain('ROBOTO_FLEX_METRICS')
  })
})

describe('the origin rule', () => {
  it('permits a type owned by a declared dependency and on that dependency’s barrel', async () => {
    // `@shiftcharts/primitives` is this shape at scale: thirty-five `@shiftcharts/core` types reachable from
    // its props. Demanding it re-export them would be thirty-five reports about nothing.
    const { missingExports } = await report('api-allow')
    expect(missingExports.filter((m) => m.pkg === '@fixture/allow-api-consumer')).toEqual([])
  })

  it('rejects reaching past a declared dependency’s barrel', async () => {
    const { missingExports } = await report('api-deny')
    const cross = missingExports.find((m) => m.pkg === '@fixture/deny-api-consumer')
    expect(cross?.type).toBe('SeriesStyle')
    expect(cross?.reason).toBe('declared in @fixture/deny-api but not on its barrel')
  })

  it('is what distinguishes the two fixture consumers, which are otherwise identical', async () => {
    // If this ever stops being true, one of the two consumer fixtures has stopped
    // exercising the rule and the pair no longer isolates a single variable.
    const allow = await report('api-allow')
    const deny = await report('api-deny')
    expect(allow.missingExports).toHaveLength(0)
    expect(deny.missingExports.filter((m) => m.pkg.endsWith('-consumer'))).toHaveLength(1)
  })
})

describe('the exclusions', () => {
  it('does not report a type used only inside a function body', async () => {
    // ⚠ `AxisScale`, the first false positive. It is a `const` annotation forty lines
    // inside `@shiftcharts/core`'s `resolveFrame`. A function body is not a public signature.
    const { missingExports } = await report('api-deny')
    expect(missingExports.map((m) => m.type)).not.toContain('BodyLocal')
  })

  it('does not report an operand of a conditional type', async () => {
    // ⚠ `DeepPartialOf` and `IsUnion`, the other two. TypeScript evaluates them away; the
    // .d.ts rollup emits them in-file; no consumer can be in a position to write either.
    const { missingExports } = await report('api-deny')
    expect(missingExports.map((m) => m.type)).not.toContain('Widen')
  })

  it('does not report lib types the package has no business exporting', async () => {
    const { missingExports } = await report('api-deny')
    const types = missingExports.map((m) => m.type)
    expect(types).not.toContain('ReadonlyArray')
    expect(types).not.toContain('Date')
  })

  it('reports exactly two things and no more, so the exclusions are not vacuous', async () => {
    // Four candidates are planted in `api-deny`; two are violations and two are exclusions.
    // A count assertion is the only thing that catches an exclusion silently widening.
    const { missingExports } = await report('api-deny')
    expect(missingExports).toHaveLength(2)
  })
})

describe('the real tree', () => {
  it('walks every workspace package rather than a subset', async () => {
    const world = await discoverPackages(PACKAGES)
    expect(world.map((p) => p.name).sort()).toEqual([
      '@shiftcharts/core',
      '@shiftcharts/grid',
      '@shiftcharts/primitives',
      '@shiftcharts/react',
      '@shiftcharts/testing',
      '@shiftcharts/tokens',
    ])
  })

  it('ships @shiftcharts/tokens and @shiftcharts/core clean', async () => {
    // ⚠ Two packages, not all six. `@shiftcharts/testing` is knowingly red — `Callback` is
    // `FakeResizeObserver`'s constructor parameter type and is not on the barrel, which is
    // the exact papercut this gate exists for and a one-word fix in that package. Asserting
    // the whole tree here would encode that bug as expected.
    const world = await discoverPackages(PACKAGES)
    const subset = world.filter((p) => p.name === '@shiftcharts/tokens' || p.name === '@shiftcharts/core')
    const { missingExports, forbiddenExports } = checkWorld(subset)
    expect(missingExports).toEqual([])
    expect(forbiddenExports).toEqual([])
  })
})
