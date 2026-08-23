/**
 * The token lint gate.
 *
 * Rejects raw colour and length literals and gradients in CSS, requiring `var(--gx-*)`
 * instead. Specified in `research/43-theming.md` §6; the implementation choice and the
 * evidence behind it are in `research/decisions/015-token-gate-is-a-parser.md`.
 *
 * ⚠ THIS IS NOT A PORT, AND THE DIFFERENCE IS THE POINT.
 *
 * The corpus described this gate as a port of `check-css-module-tokens.mjs`, which runs
 * three global regexes over whole-file text. Running that script against the rule §6.1
 * actually specifies produced SIX rejections of which TWO were correct:
 *
 *   `--gx-series-1: #b4e4fd`                       → flagged. It is a token definition.
 *   `--gx-label-font-size: 11px`                   → flagged. Same.
 *   `url("data:image/svg+xml;base64,AA#ffffffBB")` → flagged. That is base64 payload.
 *   `content: "#ff0000"`                           → flagged. That is string content.
 *
 * The last two are not allowlist failures; they are regexes failing to parse CSS. And in
 * the other direction every one of `oklch()`, `oklab()`, `lab()`, `lch()`, `hwb()`,
 * `color()` and every named colour passed clean — which matters because DESIGN.md
 * derives the entire palette in OKLCH.
 *
 * So: a real parser, and a rule set wider than the `hex/rgb/hsl` + `px` the three seed
 * documents agreed on. PostCSS gives `prop` and `value` as separate fields, which makes
 * §6.1's positional half stop being a rule to implement and start being a `startsWith`.
 *
 * ⚠ Plain JavaScript with JSDoc types, deliberately. It runs on the `engines.node >= 20`
 * floor with no build step and no loader — a lint gate that needs the build to work
 * cannot check the build.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

/**
 * The allowlist, narrow in two dimensions at once (§6.1).
 *
 * ⚠ Both halves are load-bearing. A file-only allowlist would let any stylesheet that
 * happens to live in the tokens package author arbitrary raw CSS, and the tokens package
 * is precisely where someone would drop a component style "just for now".
 */
const ALLOWLIST_DIR = 'packages/tokens/src/themes'
const TOKEN_PREFIX = '--gx-'

/**
 * Length units that count as literals. Viewport and container units are absent on
 * purpose: they are relative to something the author does not control, so they are not
 * the hardcoding this gate exists to stop.
 */
const LENGTH_UNITS = ['px', 'rem', 'em', 'pt', 'pc', 'in', 'cm', 'mm', 'q', 'ex', 'ch']

/** `12px`, `1.5rem`, `.5em` — but never the `2` in `calc(var(--gx-gap) * 2)`. */
const LENGTH_RE = new RegExp(
  String.raw`(?<![\w.#-])\d*\.?\d+(${LENGTH_UNITS.join('|')})\b`,
  'gi',
)

const HEX_RE = /(?<![\w-])#[\da-f]{3,8}(?![\w-])/gi

/**
 * ⚠ `oklch|oklab|lab|lch|hwb|color` are the widening decision 015 turned on. The
 * trailing `\(` stops `color(` matching a bare `color:` property, and the leading
 * boundary stops `--gx-grid-color` and `background-color` matching.
 */
const COLOR_FN_RE = /(?<![\w-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/gi

const GRADIENT_RE = /(?<![\w-])(repeating-)?(linear|radial|conic)-gradient\s*\(/gi

/**
 * ⚠ THE TRAP, named in `30-implementation-plan.md` A1.
 *
 * `currentColor` is *mandated* for chrome by 43-theming.md §3.1 — grid and axis colour
 * derive from it so re-themed widgets stay coherent. A named-colour list that swallows
 * it converts a mandate into a violation. Same for `transparent` and the CSS-wide
 * keywords. Checked before the named-colour list; these always pass.
 */
const ALWAYS_LEGAL = new Set([
  'currentcolor',
  'transparent',
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
  'none',
  'auto',
])

/**
 * ⚠ A deny-list, not the full CSS colour keyword set — the narrower of the two options
 * `43-theming.md` §9 item 7 leaves open until B1. These are the ones that actually get
 * typed. The full set is more correct and risks colliding with future keywords; this
 * list is honest about what it catches, and the open question stays recorded rather than
 * quietly resolved here.
 */
const NAMED_COLORS = new Set([
  'red', 'blue', 'green', 'white', 'black', 'grey', 'gray', 'yellow', 'orange',
  'purple', 'pink', 'brown', 'cyan', 'magenta', 'silver', 'gold', 'navy', 'teal',
  'olive', 'maroon', 'lime', 'aqua', 'fuchsia', 'indigo', 'violet', 'beige', 'ivory',
])

/**
 * @typedef {'raw-color' | 'raw-length' | 'gradient'} RuleId
 * @typedef {{ file: string, line: number, rule: RuleId, prop: string, detail: string }} Violation
 */

/**
 * Strip the parts of a value a literal may legally hide inside.
 *
 * ⚠ This is the fix for the two false positives that had nothing to do with the
 * allowlist. A `#ffffffBB` inside a base64 data URI is payload; a `#ff0000` inside a
 * `content` string is text. Neither is a colour, and no amount of regex tuning tells the
 * difference from outside a parser.
 *
 * @param {string} value
 * @returns {string}
 */
function stripNonValueText(value) {
  return value
    .replace(/url\(\s*(['"])[\s\S]*?\1\s*\)/gi, 'url()')
    .replace(/url\(\s*[^'")]*\s*\)/gi, 'url()')
    .replace(/(['"])(?:\\.|(?!\1)[\s\S])*?\1/g, '""')
}

/**
 * @param {string} value
 * @returns {string | undefined}
 */
function findNamedColor(value) {
  const words = value.toLowerCase().match(/[a-z-]{3,}/g) ?? []
  for (const word of words) {
    if (ALWAYS_LEGAL.has(word)) continue
    if (NAMED_COLORS.has(word)) return word
  }
  return undefined
}

/**
 * Inspect one stylesheet.
 *
 * @param {string} source CSS text.
 * @param {string} file   Repo-relative path — drives both the allowlist test and the report.
 * @returns {Violation[]}
 */
export function inspectCss(source, file) {
  /** @type {Violation[]} */
  const violations = []
  const posix = file.split(sep).join('/')
  const inAllowlistedFile = posix.startsWith(ALLOWLIST_DIR)

  let root
  try {
    root = postcss.parse(source, { from: file })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return [{ file, line: 0, rule: 'raw-color', prop: '', detail: `unparseable CSS: ${message}` }]
  }

  root.walkDecls((decl) => {
    const line = decl.source?.start?.line ?? 0
    const value = stripNonValueText(decl.value)

    // Gradients have NO allowlist, anywhere, in any position — not even on a token
    // definition in the tokens package. The ban is semantic ("a gradient encodes a value
    // that varies where no value varies"), so it does not relax. 43-theming.md §3.1.
    for (const match of value.matchAll(GRADIENT_RE)) {
      violations.push({ file, line, rule: 'gradient', prop: decl.prop, detail: match[0] })
    }

    // THE POSITIONAL RULE, in full. Everything the regex script structurally could not
    // express is this one line, because the parser already separated prop from value.
    if (inAllowlistedFile && decl.prop.startsWith(TOKEN_PREFIX)) return

    for (const match of value.matchAll(HEX_RE)) {
      violations.push({ file, line, rule: 'raw-color', prop: decl.prop, detail: match[0] })
    }
    for (const match of value.matchAll(COLOR_FN_RE)) {
      violations.push({ file, line, rule: 'raw-color', prop: decl.prop, detail: `${match[1]}()` })
    }
    const named = findNamedColor(value)
    if (named !== undefined) {
      violations.push({ file, line, rule: 'raw-color', prop: decl.prop, detail: named })
    }
    for (const match of value.matchAll(LENGTH_RE)) {
      violations.push({ file, line, rule: 'raw-length', prop: decl.prop, detail: match[0] })
    }
  })

  return violations
}

/**
 * ⚠ `.css`, not `.module.css`. The ported script collected modules only, and the
 * allowlisted theme files are plain `.css` — so ported unchanged it would never have
 * opened the one file set the allowlist exists for, and would have passed trivially.
 * That is `43-theming.md` §6.3's failure exactly.
 *
 * @param {string} dir
 * @param {string[]} [acc]
 * @returns {Promise<string[]>}
 */
export async function collectCss(dir, acc = []) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      await collectCss(path, acc)
    } else if (entry.isFile() && entry.name.endsWith('.css')) {
      acc.push(path)
    }
  }
  return acc
}

/**
 * Run the gate over a directory tree.
 *
 * @param {string} root
 * @returns {Promise<Violation[]>}
 */
export async function checkTree(root) {
  const files = (await collectCss(root)).sort()
  /** @type {Violation[]} */
  const violations = []
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    violations.push(...inspectCss(source, relative(REPO_ROOT, file)))
  }
  return violations
}

/**
 * @param {readonly Violation[]} violations
 * @returns {string}
 */
export function formatViolations(violations) {
  return violations
    .map((v) => `  ${v.file}:${v.line}  ${v.rule}  ${v.prop || '<at-rule>'}: ${v.detail}`)
    .join('\n')
}

// --- CLI ---------------------------------------------------------------------------

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href

if (invokedDirectly) {
  const target = process.argv[2] ?? join(REPO_ROOT, 'packages')
  const scanned = (await collectCss(target)).length

  // ⚠ Zero files scanned is this gate's most likely silent failure, and it is exactly
  // what the ported version would have done. A gate that opens nothing exits 0 and looks
  // identical to a clean tree. Refuse instead.
  if (scanned === 0) {
    console.error(`token gate: scanned 0 stylesheets under ${target} — refusing to pass.`)
    process.exit(1)
  }

  const violations = await checkTree(target)
  if (violations.length > 0) {
    console.error(`token gate: ${violations.length} violation(s) across ${scanned} stylesheet(s)\n`)
    console.error(formatViolations(violations))
    console.error('\nEvery value goes through a --gx-* token. See research/43-theming.md §6.')
    process.exit(1)
  }

  console.log(`token gate: ${scanned} stylesheet(s) clean.`)
}
