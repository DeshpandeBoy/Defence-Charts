/**
 * Gate **G5** — *"import one chart, ship one chart."*
 *
 * The claim is a size claim, and a size claim that nothing measures is a marketing line.
 * If importing `LineChart` drags in the bar renderer, every consumer of this library pays
 * for charts they never named, the README is wrong, and nothing anywhere goes red. Same
 * failure species as the rest of this repo's gates: a thing that looks like it works and
 * quietly doesn't.
 *
 * `research/maps/04-ci-gate-map.md` G5: *"Bundle each exported symbol alone; assert the
 * component set equals a known set; print `symmetricDifference`."* The last clause is not
 * decoration. A bare `failed` tells the author that something they cannot see has changed;
 * the diff tells them which module started riding along and which stopped, which is the
 * entire value of running a bundler in a lint gate.
 *
 * ⚠ ROLLDOWN, AND WHY IT IS NOT A NEW DEPENDENCY.
 *
 * `pnpm-lock.yaml` already carried `rolldown@1.2.5` (via tsdown) and `esbuild@0.28.2` (via
 * vite). Neither was resolvable from the root under this workspace's `hoistPattern: []`, so
 * one had to be declared. Rolldown was declared **at the version already in the lockfile**,
 * which added four bytes of manifest and zero packages to the store — and it is the bundler
 * tsdown already uses to produce `dist/`, so the gate measures the same tree-shaker that
 * actually ships the library rather than a second opinion from a different one.
 *
 * ⚠ WHAT COUNTS AS A "COMPONENT", AND THE SET THAT WAS REJECTED.
 *
 * The obvious universe is *every package-owned module that survives*. Measured against
 * `@shiftcharts/core` that produces a table of thirty-four rows, twenty-three of which say the same
 * thing: `font-metrics.generated.ts` — a 26 KB advance table — rides along on almost
 * everything, because `DEFAULT_POLICY` references `DEFAULT_TYPOGRAPHY` references
 * `ROBOTO_FLEX_METRICS`, and that chain is a genuine value dependency no bundler can cut.
 * A table where twenty-three rows are noise hides the one row that is the actual claim.
 *
 * So `COMPONENTS` is the small set of modules whose presence *is* a product decision — one
 * chart type's ladder, the resolver, the frame solver. Everything else is measured and not
 * asserted. Adding a chart type is one line here and one line in `EXPECTED`.
 *
 * ⚠ Recorded so it is not rediscovered: the metrics table's reach was **measured, not
 * assumed**. `tickCountForWidth` alone carries `policy.ts`, `text.ts` and
 * `font-metrics.generated.ts`. If that ever becomes the size problem, the fix is to move
 * `DEFAULT_TYPOGRAPHY` off the metrics table, not to widen this gate.
 *
 * ⚠ Plain JavaScript with JSDoc types, deliberately, matching `check-tokens.mjs`. It runs
 * on the `engines.node` floor with no build step and no loader — a lint gate that needs the
 * build to work cannot check the build. Note that this gate reads `src/`, not `dist/`: it
 * has to run before and independently of `pnpm build`, and rolldown reads TypeScript
 * directly.
 */

import { readFile, readdir } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rolldown } from 'rolldown'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

/**
 * The component universe. One line per thing whose presence in a bundle is a decision.
 *
 * `module` is matched as a suffix of the path relative to the package's `src/`.
 *
 * @typedef {{ component: string, module: string }} ComponentRule
 */

/** @type {readonly ComponentRule[]} */
export const COMPONENTS = [
  // @shiftcharts/core — one chart type's semantics, and the two resolvers that reach them.
  { component: 'line', module: 'rungs/line.ts' },
  { component: 'planner', module: 'plan-chart.ts' },
  { component: 'frame', module: 'frame.ts' },

  // @shiftcharts/primitives — one chart type's marks.
  //
  // ⚠ `Axis.tsx`, `Labels.tsx`, `Grid.tsx`, `DataTable.tsx` and `svg.ts` are deliberately
  // absent. They are chrome: every chart type carries them, so their presence in a bundle
  // is never a decision anyone made and asserting it would only report that a shared module
  // is shared.
  { component: 'area-path', module: 'AreaPath.tsx' },
  { component: 'line-path', module: 'LinePath.tsx' },
  { component: 'point-marks', module: 'PointMarks.tsx' },
  { component: 'horizon-bands', module: 'HorizonBands.tsx' },
]

/**
 * What each exported symbol is allowed to carry. **Absent means the empty set** — the
 * default is the claim, and an entry here is an exception someone decided on.
 *
 * ⚠ Every package must appear as a key even when its table is empty. A package that is
 * merely missing would be skipped, and a skipped package is a gate that exits 0.
 *
 * ⚠ These values were recorded by running the gate, not predicted. `@shiftcharts/primitives` was
 * being written while this was authored; its components land when its chart modules do.
 *
 * @type {Record<string, Record<string, readonly string[]>>}
 */
export const EXPECTED = {
  '@shiftcharts/core': {
    // The six line/area rungs. Each one *is* the line chart's semantics, so each one
    // carrying `rungs/line.ts` is the claim holding, not failing.
    LINE_RUNGS: ['line'],
    microRung: ['line'],
    stripRung: ['line'],
    tileRung: ['line'],
    panelRung: ['line'],
    stageRung: ['line'],
    canvasRung: ['line'],

    // ⚠ The resolver reaches every rung it can produce. When `bar` lands, this line grows
    // and every one above it must NOT — that asymmetry is the whole gate.
    planChart: ['line', 'planner'],

    resolveFrame: ['frame'],
  },
  '@shiftcharts/tokens': {},
  '@shiftcharts/testing': {},
  '@shiftcharts/primitives': {
    // The claim, at the renderer. Each mark carries itself and the shared `svg.ts`, and
    // nothing else — measured, and the reason `import { LinePath }` is honest.
    AreaPath: ['area-path'],
    LinePath: ['line-path'],
    PointMarks: ['point-marks'],
    HorizonBands: ['horizon-bands'],

    // ⚠ `<Chart plan={…}>` carries every mark, and must: it dispatches on a plan resolved
    // at runtime, so it cannot know which mark it will need. That is the cost of the
    // plan-driven API and it is exactly what the `/line`, `/bar`, `/donut` subpath exports
    // in `research/maps/00-system-map.md` exist to let a consumer opt out of. This line
    // going up when a chart type lands is correct; the four above it going up is not.
    Chart: ['area-path', 'horizon-bands', 'line-path', 'point-marks'],
  },
  '@shiftcharts/react': {},
  '@shiftcharts/grid': {},
}

const VIRTUAL_ENTRY = '\0gx-treeshake-probe'

/**
 * ⚠ Bare specifiers are external and that is the point: `react`, `d3-scale` and
 * `@shiftcharts/core` are separately-resolved packages, and pulling them into the measurement
 * would make this gate report on somebody else's tree-shaking.
 *
 * ⚠ `.css` is external too. `sideEffects: ["*.css"]` in every manifest means a stylesheet
 * import is expected to survive; letting rolldown try to parse one would fail the gate with
 * a syntax error rather than an answer.
 *
 * @param {string} id
 * @returns {boolean}
 */
function isExternal(id) {
  if (id === VIRTUAL_ENTRY) return false
  if (id.endsWith('.css')) return true
  return !id.startsWith('.') && !id.startsWith('/')
}

/** @type {import('rolldown').InputOptions} */
const BASE_OPTIONS = {
  external: isExternal,
  treeshake: true,
  platform: 'neutral',
  logLevel: 'silent',
}

/**
 * @param {import('rolldown').InputOptions} options
 * @returns {Promise<import('rolldown').OutputChunk>}
 */
async function bundleOnce(options) {
  const bundle = await rolldown(options)
  try {
    const { output } = await bundle.generate({ format: 'esm' })
    const chunk = output.find((part) => part.type === 'chunk')
    if (chunk === undefined) throw new Error('rolldown produced no chunk')
    return chunk
  } finally {
    await bundle.close()
  }
}

/**
 * The exported **values** of a barrel.
 *
 * ⚠ Read off the bundle, not off the source, and not via ts-morph. Types are erased before
 * a bundler ever sees them, so this list is exactly the set of names that can cost bytes —
 * which is the only set this gate has an opinion about. It also keeps G5 independent of
 * G6: neither gate goes red because the other's parser did.
 *
 * @param {string} entry Absolute path to the package's `src/index.ts`.
 * @returns {Promise<string[]>}
 */
export async function exportedValues(entry) {
  const chunk = await bundleOnce({ ...BASE_OPTIONS, input: entry })
  return [...chunk.exports].sort()
}

/**
 * Bundle an entry that imports exactly one symbol, and report which components survived.
 *
 * ⚠ A virtual entry via a plugin, not a temp file. A temp file has to live somewhere, and
 * both available somewheres are wrong: inside the package it pollutes the tree the gate is
 * measuring, and in `os.tmpdir()` it makes the answer depend on a path outside the repo.
 *
 * ⚠ `export default` on the imported binding, not a bare import. A bare import of a
 * side-effect-free package tree-shakes to nothing at all, and the gate would then report a
 * clean empty set for every symbol — passing, permanently, while measuring nothing.
 *
 * @param {string} entry     Absolute path to the package's `src/index.ts`.
 * @param {string} symbol
 * @param {string} srcDir    Absolute path to the package's `src/`, for relativising modules.
 * @param {readonly ComponentRule[]} [components]
 * @returns {Promise<{ components: string[], modules: string[] }>}
 */
export async function probeSymbol(entry, symbol, srcDir, components = COMPONENTS) {
  const chunk = await bundleOnce({
    ...BASE_OPTIONS,
    input: VIRTUAL_ENTRY,
    plugins: [
      {
        name: 'shiftcharts-treeshake-probe',
        resolveId(id) {
          return id === VIRTUAL_ENTRY ? VIRTUAL_ENTRY : null
        },
        load(id) {
          if (id !== VIRTUAL_ENTRY) return null
          return `import { ${symbol} } from ${JSON.stringify(entry)}\nexport default ${symbol}\n`
        },
      },
    ],
  })

  const prefix = `${srcDir}/`
  const modules = chunk.moduleIds
    .filter((id) => id.startsWith(prefix))
    .map((id) => id.slice(prefix.length))
    .sort()

  const survived = new Set()
  for (const module of modules) {
    for (const rule of components) {
      if (module.endsWith(rule.module)) survived.add(rule.component)
    }
  }
  return { components: [...survived].sort(), modules }
}

/**
 * The diff, which is the reason this gate is worth its runtime.
 *
 * ⚠ Not `Set.prototype.symmetricDifference` — that is Node 22+, and this file holds the
 * `engines.node` floor along with the rest of the gates. Sorted output, because an
 * unordered diff read twice looks like two different diffs.
 *
 * @param {readonly string[]} a
 * @param {readonly string[]} b
 * @returns {{ only_in_expected: string[], only_in_actual: string[] }}
 */
export function symmetricDifference(a, b) {
  const left = new Set(a)
  const right = new Set(b)
  return {
    only_in_expected: [...left].filter((x) => !right.has(x)).sort(),
    only_in_actual: [...right].filter((x) => !left.has(x)).sort(),
  }
}

/**
 * @typedef {{ name: string, dir: string, barrel: string, src: string }} Pkg
 * @typedef {{ kind: 'leak' | 'undeclared', pkg: string, symbol: string, expected: string[], actual: string[], diff: ReturnType<typeof symmetricDifference>, modules: string[] }} Failure
 */

/**
 * @param {string} root
 * @returns {Promise<Pkg[]>}
 */
export async function discoverPackages(root) {
  const base = resolve(root)
  /** @type {Pkg[]} */
  const found = []
  let entries
  try {
    entries = await readdir(base, { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = join(base, entry.name)
    const manifest = await readFile(join(dir, 'package.json'), 'utf8').catch(() => null)
    if (manifest === null) continue
    const barrel = join(dir, 'src', 'index.ts')
    if ((await readFile(barrel, 'utf8').catch(() => null)) === null) continue
    /** @type {{ name?: string }} */
    const parsed = JSON.parse(manifest)
    found.push({ name: parsed.name ?? entry.name, dir, barrel, src: join(dir, 'src') })
  }
  return found.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * @param {{ world: readonly Pkg[], expected?: Record<string, Record<string, readonly string[]>>, components?: readonly ComponentRule[] }} input
 * @returns {Promise<{ failures: Failure[], probes: number }>}
 */
export async function checkWorld({ world, expected = EXPECTED, components = COMPONENTS }) {
  /** @type {Failure[]} */
  const failures = []
  let probes = 0

  for (const pkg of world) {
    const table = expected[pkg.name]

    // ⚠ An undeclared package is a failure, not a skip. A new package that nobody added to
    // EXPECTED would otherwise be the one package in the repo this gate never looks at.
    if (table === undefined) {
      failures.push({
        kind: 'undeclared',
        pkg: pkg.name,
        symbol: '<package>',
        expected: [],
        actual: [],
        diff: { only_in_expected: [], only_in_actual: [] },
        modules: [],
      })
      continue
    }

    for (const symbol of await exportedValues(pkg.barrel)) {
      probes += 1
      const { components: actual, modules } = await probeSymbol(
        pkg.barrel,
        symbol,
        pkg.src,
        components,
      )
      const want = [...(table[symbol] ?? [])].sort()
      const diff = symmetricDifference(want, actual)
      if (diff.only_in_expected.length > 0 || diff.only_in_actual.length > 0) {
        failures.push({ kind: 'leak', pkg: pkg.name, symbol, expected: want, actual, diff, modules })
      }
    }
  }

  return { failures, probes }
}

/**
 * ⚠ The two failure kinds print differently on purpose. A leak has a diff, and the diff is
 * the reason to run a bundler in a lint gate. An undeclared package has no diff — nothing
 * was measured — and printing it in the leak's shape emits four lines of empty brackets that
 * read like a leak of nothing, which is the least useful thing this file could say.
 *
 * @param {readonly Failure[]} failures
 * @returns {string}
 */
export function formatFailures(failures) {
  const lines = []
  for (const f of failures) {
    if (f.kind === 'undeclared') {
      lines.push(`  ${f.pkg}  no entry in EXPECTED — add one, even if it is empty`)
      continue
    }
    lines.push(`  ${f.pkg}  import { ${f.symbol} }`)
    lines.push(`      expected: [${f.expected.join(', ')}]`)
    lines.push(`      actual:   [${f.actual.join(', ')}]`)
    lines.push(
      `      symmetricDifference: -[${f.diff.only_in_expected.join(', ')}] +[${f.diff.only_in_actual.join(', ')}]`,
    )
    lines.push(`      surviving modules: ${f.modules.join(' ')}`)
  }
  return lines.join('\n')
}

// --- CLI ---------------------------------------------------------------------------

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href

if (invokedDirectly) {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
  const root = args[0] ?? join(REPO_ROOT, 'packages')

  // ⚠ `--table` exists so this gate can be run against a world that is not this repo —
  // which in practice means the fixtures under `scripts/__fixtures__/`. Decision 015 asks
  // for a gate observed to fail, and a gate whose table is hard-wired to `packages/` can
  // only ever be watched failing through its exports. A fixture that carries its own table
  // is a fixture the CLI can be pointed at, so the red run and the CI run are the same code
  // path rather than two things that resemble each other.
  const tableFlag = process.argv.slice(2).find((arg) => arg.startsWith('--table='))
  const table =
    tableFlag === undefined
      ? { EXPECTED, COMPONENTS }
      : await import(resolve(tableFlag.slice('--table='.length)))

  const world = await discoverPackages(root)

  // ⚠ The same refusal every gate here carries. A bundler that is handed no entry points
  // finds no leaks and exits 0, which is indistinguishable from a clean tree.
  if (world.length === 0) {
    console.error(
      `treeshake gate (G5): found 0 packages with a src/index.ts under ${relative(REPO_ROOT, resolve(root))} — refusing to pass.`,
    )
    process.exit(1)
  }

  const { failures, probes } = await checkWorld({
    world,
    expected: table.EXPECTED,
    components: table.COMPONENTS,
  })

  if (failures.length > 0) {
    // ⚠ Counted by kind. An undeclared package is not a probe, and folding it into the probe
    // count produced the headline `1 of 0 probe(s) carry the wrong set` — a number that
    // cannot be true, in the one line a reader sees before they stop reading.
    const leaks = failures.filter((f) => f.kind === 'leak').length
    const undeclared = failures.length - leaks
    const headline = [
      leaks > 0 ? `${leaks} of ${probes} probe(s) carry the wrong set` : null,
      undeclared > 0 ? `${undeclared} package(s) missing from EXPECTED` : null,
    ]
      .filter((part) => part !== null)
      .join(', ')

    console.error(`treeshake gate (G5): ${headline}\n`)
    console.error(formatFailures(failures))
    console.error('\nImport one chart, ship one chart. See research/maps/04-ci-gate-map.md G5.')
    process.exit(1)
  }

  console.log(`treeshake gate (G5): ${probes} symbol(s) across ${world.length} package(s) carry exactly their declared components.`)
}
