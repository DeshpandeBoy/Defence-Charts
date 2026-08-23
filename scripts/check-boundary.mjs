/**
 * Gate **G3** — grep the BUILT OUTPUT for a surviving `"use client"`.
 *
 * ⚠ This gate asserts an **exact set**, not a presence. Both directions are failures and
 * they fail in opposite ways:
 *
 *   missing where required → `@gx/react` and `@gx/grid` stop being client components.
 *                            Every consumer's RSC page starts trying to run hooks on the
 *                            server. Loud, and someone notices within a day.
 *
 *   present where forbidden → `@gx/primitives` stops being RSC-safe. The page still
 *                             renders, still looks right, still passes every test — and
 *                             quietly ships JavaScript for a chart that was supposed to
 *                             need none. Nobody notices, because there is nothing to see.
 *
 * The second is the one this gate exists for, and it is why a presence-only grep would be
 * worse than useless: it would pass.
 *
 * ⚠ The directive is fragile in a specific, verified way. `unbundle: true` is the **only**
 * tsdown/Rolldown configuration in which `"use client"` survives on a non-entry file
 * (`research/30-implementation-plan.md` A1). A future config change that looks like a
 * pure optimisation — bundling, minifying, changing entry layout — silently deletes it.
 * That is what makes this a build-output check rather than a source check: the source
 * keeps saying `'use client'` long after the build has stopped emitting it.
 *
 * `research/maps/04-ci-gate-map.md` G3 — A1 (config), A4 (regression).
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

/**
 * The render boundary, declared once, as data.
 *
 * ⚠ Decision 7. `@gx/primitives` being on the `false` side is the whole point of the
 * package existing separately from `@gx/react` — it is what lets `<Chart plan={…}>`
 * render inside a server component with zero client JavaScript.
 */
const EXPECTED = {
  tokens: false,
  core: false,
  primitives: false,
  testing: false,
  react: true,
  grid: true,
}

const DIRECTIVE = /^\s*(['"])use client\1\s*;?\s*$/

/** @typedef {{ pkg: string, expected: boolean, actual: boolean | null }} BoundaryResult */

/**
 * ⚠ The directive is only honoured by bundlers at the TOP of a module, so that is the
 * only place worth looking. A `'use client'` on line 40 is a string expression, not a
 * directive — finding one there and reporting success would be its own silent failure.
 *
 * @param {string} source
 * @returns {boolean}
 */
export function hasClientDirective(source) {
  for (const line of source.split('\n')) {
    const text = line.trim()
    if (text === '' || text.startsWith('//')) continue
    if (text.startsWith('/*')) {
      if (!text.includes('*/')) return false // A block comment ahead of it: give up honestly.
      continue
    }
    return DIRECTIVE.test(text)
  }
  return false
}

/**
 * @returns {Promise<BoundaryResult[]>}
 */
export async function checkBoundary() {
  /** @type {BoundaryResult[]} */
  const results = []
  for (const [pkg, expected] of Object.entries(EXPECTED)) {
    const dist = join(REPO_ROOT, 'packages', pkg, 'dist', 'index.js')
    const source = await readFile(dist, 'utf8').catch(() => null)
    results.push({
      pkg,
      expected,
      actual: source === null ? null : hasClientDirective(source),
    })
  }
  return results
}

// --- CLI ---------------------------------------------------------------------------

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href

if (invokedDirectly) {
  const results = await checkBoundary()

  // ⚠ An unbuilt package is a failure, not a skip. `dist/` missing means the gate
  // inspected nothing, and a gate that inspects nothing exits 0 — indistinguishable from
  // a correct boundary. Run `pnpm build` first.
  const unbuilt = results.filter((r) => r.actual === null)
  const wrong = results.filter((r) => r.actual !== null && r.actual !== r.expected)

  if (unbuilt.length > 0 || wrong.length > 0) {
    console.error('boundary gate (G3): the "use client" set does not match\n')
    for (const r of unbuilt) {
      console.error(`  @gx/${r.pkg}  not built — run \`pnpm build\` before this gate`)
    }
    for (const r of wrong) {
      const verb = r.expected ? 'MISSING from' : 'PRESENT in'
      const why = r.expected
        ? 'the client boundary has collapsed — consumers will run hooks on the server'
        : 'RSC safety has been lost — this package now ships JS to every page that uses it'
      console.error(`  @gx/${r.pkg}  "use client" ${verb} dist/index.js — ${why}`)
    }
    console.error('\nSee research/maps/04-ci-gate-map.md G3 and decision 7.')
    process.exit(1)
  }

  const client = results.filter((r) => r.expected).map((r) => `@gx/${r.pkg}`)
  console.log(`boundary gate (G3): ${results.length} packages, client boundary = ${client.join(', ')}.`)
}
