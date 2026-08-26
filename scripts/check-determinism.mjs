/**
 * Gates **G15** (happy-dom ban) and **G16** (accidental DOM environment).
 *
 * Both protect the same property from opposite directions: a test that believes it is
 * running without a DOM, and is wrong.
 *
 * ⚠ Plain JavaScript with JSDoc types, deliberately — see `check-tokens.mjs`.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

/**
 * ⚠ **G15.** happy-dom is banned; jsdom is permitted. The two look interchangeable and
 * are not, on precisely the APIs this library forbids itself:
 *
 *   `getComputedTextLength()`, `getBBox()`, `getTotalLength()`, `getBoundingClientRect()`
 *
 * jsdom **throws** on these. happy-dom returns **`0`**. A throw is a failing test with a
 * stack trace pointing at the violation. A `0` is a resolver that lays every chart out as
 * though every label were empty — it renders, it snapshots, it passes, and the labels
 * collide in a browser. There is no third outcome where the `0` is caught.
 *
 * So the ban is not a preference between two DOM shims. It is the difference between a
 * gate that fires and a gate that cannot.
 *
 * `research/20-architecture.md` §2; `research/30-implementation-plan.md` A1.
 */
const BANNED_PACKAGES = ['happy-dom']

/**
 * ⚠ **G16.** Vitest matches its environment docblock with a regex over the whole file,
 * comments included. A test file that merely *mentions* the directive in prose switches
 * itself into that environment silently.
 *
 * Measured on this repo: a single `//` comment containing the phrase turned a 0 ms node
 * run into 776 ms of jsdom setup, and `globalThis.document` became defined. Nothing in
 * the output says so — the environment is not printed, only its duration.
 *
 * That matters here more than in most repos, because these test files quote config keys
 * and token names back at the reader as documentation. The failure mode is specific: a
 * `@shiftcharts/core` test discussing the DOM-measurement ban acquires a DOM, and the ban's own
 * test starts evaluating in the environment it exists to prohibit.
 *
 * So: the directive is legal in the first three lines of a file — enough for both the
 * line-comment form and a JSDoc header — where it is unambiguously an instruction.
 * Anywhere else it is prose, and prose that changes behaviour is rejected. That is
 * stricter than Vitest, on purpose: Vitest's own rule cannot distinguish the two.
 */
const ENV_DIRECTIVE = /@(?:vitest|jest)-environment\s+[\w-]+/

/** Lines in which the directive reads as an instruction rather than as prose. */
const DIRECTIVE_HEADER_LINES = 3

/** @typedef {{ file: string, line: number, gate: 'G15' | 'G16', detail: string }} Violation */

/**
 * @param {string} dir
 * @param {(name: string) => boolean} match
 * @param {string[]} [acc]
 * @returns {Promise<string[]>}
 */
async function collect(dir, match, acc = []) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue
      await collect(path, match, acc)
    } else if (entry.isFile() && match(entry.name)) {
      acc.push(path)
    }
  }
  return acc
}

/**
 * G15 — the banned shim must not appear in any manifest or in the lockfile.
 *
 * ⚠ Checking manifests alone is not enough: a transitive dependency can pull happy-dom in
 * without any manifest here naming it, and Vitest resolves `environment: 'happy-dom'`
 * from whatever is present in the store. The lockfile is where that becomes visible.
 *
 * @returns {Promise<Violation[]>}
 */
export async function checkBannedPackages() {
  /** @type {Violation[]} */
  const violations = []

  const manifests = await collect(REPO_ROOT, (name) => name === 'package.json')
  for (const file of manifests) {
    const source = await readFile(file, 'utf8')
    const lines = source.split('\n')
    for (const banned of BANNED_PACKAGES) {
      lines.forEach((text, index) => {
        if (text.includes(`"${banned}"`)) {
          violations.push({
            file: relative(REPO_ROOT, file),
            line: index + 1,
            gate: 'G15',
            detail: `${banned} is banned as a dependency`,
          })
        }
      })
    }
  }

  const lockPath = join(REPO_ROOT, 'pnpm-lock.yaml')
  const lock = await readFile(lockPath, 'utf8').catch(() => '')
  for (const banned of BANNED_PACKAGES) {
    const index = lock.split('\n').findIndex((text) => text.trimStart().startsWith(`${banned}@`))
    if (index !== -1) {
      violations.push({
        file: 'pnpm-lock.yaml',
        line: index + 1,
        gate: 'G15',
        detail: `${banned} resolved transitively — Vitest can select it by name`,
      })
    }
  }

  return violations
}

/**
 * G16 — the environment directive is an instruction in the file header, and prose
 * everywhere else.
 *
 * @returns {Promise<Violation[]>}
 */
export async function checkEnvironmentDirectives() {
  /** @type {Violation[]} */
  const violations = []
  const files = await collect(
    REPO_ROOT,
    (name) => /\.(test|spec)\.(ts|tsx|mts|mjs|js)$/.test(name),
  )

  for (const file of files) {
    const lines = (await readFile(file, 'utf8')).split('\n')
    lines.forEach((text, index) => {
      if (index < DIRECTIVE_HEADER_LINES) return
      if (ENV_DIRECTIVE.test(text)) {
        violations.push({
          file: relative(REPO_ROOT, file),
          line: index + 1,
          gate: 'G16',
          detail: 'environment directive below the header — Vitest applies it anyway',
        })
      }
    })
  }

  return violations
}

/**
 * @param {readonly Violation[]} violations
 * @returns {string}
 */
export function formatViolations(violations) {
  return violations.map((v) => `  ${v.gate}  ${v.file}:${v.line}  ${v.detail}`).join('\n')
}

// --- CLI ---------------------------------------------------------------------------

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href

if (invokedDirectly) {
  const violations = [...(await checkBannedPackages()), ...(await checkEnvironmentDirectives())]

  if (violations.length > 0) {
    console.error(`determinism gate: ${violations.length} violation(s)\n`)
    console.error(formatViolations(violations))
    console.error('\nSee research/30-implementation-plan.md A1.')
    process.exit(1)
  }

  console.log('determinism gate: clean (G15 happy-dom ban, G16 environment directives).')
}
