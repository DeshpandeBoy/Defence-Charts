/**
 * The token lint gate.
 *
 * Six rules answering three questions, each one a different way for a value to escape the
 * token tree.
 *
 * **Does every value go through a token?** Rejects raw colour and length literals and
 * gradients, requiring `var(--gx-*)` instead. Specified in `research/43-theming.md` §6; the
 * implementation choice and the evidence behind it are in
 * `research/decisions/015-token-gate-is-a-parser.md`.
 *
 * **Does every token exist?** ⚠ Added at **B1**, which `maps/04-ci-gate-map.md:94` always had
 * as G7's second delivery. An undefined `var(--gx-…)` resolves to nothing and fails silently —
 * `30-implementation-plan.md` §B1 asks for it as *"a build-time check, not a review item"*.
 * The first rule can only see that a `var()` was used; it never asked whether the name
 * resolved, so a token could be documented, referenced, and absent.
 *
 * **Is every token named the way the rule says?** ⚠ Added at **B1 slice 2**, alongside the
 * rename that made the tree conform. `raw/06` §6.0's grammar was a paragraph in a research file
 * for the whole of milestone A, and in that time the tree accumulated `--gx-ground`, `--gx-ink`,
 * `--gx-charcoal-900`, `--gx-corner-radius`, `--gx-elevation-raised`, `--gx-band-alpha` and
 * `--gx-gap` — seven first segments the rule does not contain. None was a mistake anyone made
 * twice; they were made once each, at different times, which is what an unenforced convention
 * produces.
 *
 * ⚠ Those seven names are spelled here in the past tense and **must not be renamed with the
 * tree** — the sentence is the evidence for the rule, so a codemod that helpfully updates them
 * turns it into the claim that seven conforming names do not conform. It did, once, and this
 * note is why it was caught. See `inspectTokenName` for which clause of §6.0 is enforced and,
 * more importantly, which is not.
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
 * ⚠ Plain JavaScript with JSDoc types, deliberately. It runs on the `engines.node` floor with
 * no build step and no loader — a lint gate that needs the build to work cannot check the build.
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

/**
 * ⚠ **Time units, added at A6 — and until then this gate could not see a duration at all.**
 *
 * `chart.css` carried `transition: opacity 120ms ease-out` from A4, in a file whose own
 * docblock promises that *"every colour and every length below is a `var(--gx-*)`"*. It was
 * true and it was insufficient: a duration is neither, so the one hardcoded value in the
 * package sat in the file the gate exists to protect and passed every run. A6 adds four
 * motion tokens, which multiplies the opportunity by four.
 *
 * Written `ms|s` rather than `s|ms` for directness. Both work — the engine backtracks out of
 * the short branch on `120ms` — so this is a preference and not a fix; do not "correct" it in
 * either direction expecting a behaviour change.
 */
const TIME_UNITS = ['ms', 's']

/** `12px`, `1.5rem`, `.5em` — but never the `2` in `calc(var(--gx-size-gap) * 2)`. */
const LENGTH_RE = new RegExp(
  String.raw`(?<![\w.#-])\d*\.?\d+(${LENGTH_UNITS.join('|')})\b`,
  'gi',
)

/** `120ms`, `0.5s`, `2s` — and never the `2` in `calc(var(--gx-motion-duration) / 2)`. */
const TIME_RE = new RegExp(
  String.raw`(?<![\w.#-])\d*\.?\d+(${TIME_UNITS.join('|')})\b`,
  'gi',
)

/**
 * ⚠ **Zero is exempt, and the reason is grammatical rather than a concession.**
 *
 * `43-theming.md` §6.2's standing rule is that unitless `0` is not a literal — `margin: 0`
 * needs no token because zero is the absence of a length, not a choice of one. CSS extends
 * that to lengths and refuses it to times: `transition-delay: 0` is invalid, `0ms` is
 * required. The unit there is syntax the grammar demands, not a value anyone picked, so
 * rejecting it would force `--gx-motion-stage-delay-none: 0ms` into the token tree — a token
 * whose entire content is "nothing", existing to satisfy a parser.
 *
 * Tested numerically rather than by string, so `0.5s` and `0.0001s` are still violations and
 * `00ms` and `0.0s` are still exempt.
 */
const ZERO_TIME_RE = /^0*\.?0*$/

/**
 * ⚠ **`var(--gx-foo` and NOT `var\(--gx-foo\)`.** The closing paren is deliberately not
 * matched, because a reference may legally carry a fallback — `var(--gx-size-gap, 4px)` — and a
 * pattern anchored on `)` silently skips exactly the references most likely to be masking a
 * missing token, since the fallback is what hides the absence.
 */
const VAR_REF_RE = /var\(\s*(--gx-[a-z0-9-]+)/gi

/**
 * The `<group>` vocabulary — the ONE closed set in the naming rule.
 *
 * ⚠ **This is not `raw/06` §6.0's list, and copying that list verbatim would have been a
 * gate that rejects the specification it enforces.** §6.0 publishes 19 groups. §6.2–§6.9
 * then ship table rows under thirteen more — `value`, `title`, `subtitle`, `horizon`,
 * `scale`, `aggregate`, `substitute`, `transpose`, `heatmap`, `stroke`, plus `font` and
 * `numeric` reached through §6.5's own pointer at `raw/06:1761` and `alert` at `:1762`.
 * Measured, not assumed: 205 distinct names across those sections use 32 distinct first
 * segments, of which 13 are outside the published list. A literal gate fails on
 * `--gx-title-font-size`, which §6.5 specifies and this repo ships.
 *
 * So the set below is the **union actually in use**, and the direction that keeps it honest
 * is a test rather than a rule: `check-tokens.test.mjs` asserts every first segment `raw/06`
 * §6.2–§6.9 uses appears here, so the document can never quietly grow a group this gate
 * would reject. §6.0's own prose carries a ⚠ recording the contradiction.
 *
 * Two names are deliberately absent and must stay absent. `color` — `raw/06:1021` names
 * `--gx-color-1 … --gx-color-20` as *"the failure mode to avoid"*, a palette with no
 * semantics. `cat` — `raw/06:873`, an abbreviation that breaks §6.0's own no-abbreviations
 * rule and is superseded by `--gx-series-N` at `:1025`.
 */
export const TOKEN_GROUPS = new Set([
  // The 19 published in §6.0.
  'surface', 'plot', 'widget', 'grid', 'axis', 'tick', 'label', 'line', 'area',
  'bar', 'point', 'arc', 'legend', 'tooltip', 'crosshair', 'motion', 'series',
  'ramp', 'size',
  // Chart *behaviour* and *thresholds*, §6.9's carry-over table. §6.0's vocabulary
  // covers chart anatomy only, which is the structural reason these are missing there.
  'aggregate', 'substitute', 'transpose', 'scale', 'horizon', 'heatmap', 'stroke',
  // Text, §6.5 and the §5.5 table it points at.
  'title', 'subtitle', 'value', 'font', 'numeric',
  // Colour, §3.7 — reached from §6.5:1731 rather than tabled in §6.
  'palette', 'alert',
  // ⚠ Ours, and the only member with no `raw/06` basis at all: `--gx-annotation-*` is
  // specified by `research/42-typography.md:233` and already emitted by
  // `generate-typography-css.mjs`. A gate derived from `raw/06` alone rejects three tokens
  // this repo ships today.
  'annotation',
])

/**
 * Segment spellings that are wrong rather than merely unfamiliar, each one observed.
 *
 * ⚠ **A ratchet, not a style guide.** Every entry here names something B1 slice 2 actually
 * removed — `--gx-grid-alpha`, `--gx-area-alpha` and `--gx-band-alpha` all shipped, and `alpha` is
 * not a CSS property while `opacity` is. (Past tense, and deliberately not renamed with the tree.) Without this the rename is a one-time
 * tidy that decays; with it, reintroducing the old spelling fails CI with the replacement
 * named. `colour` is here for the same reason from the other direction: it is the spelling a
 * British-English contributor reaches for first, and it resolves to nothing.
 */
const BANNED_SEGMENTS = new Map([
  ['alpha', 'opacity'],
  ['colour', 'color'],
  ['bg', 'background — §6.0 bans abbreviations CSS does not use'],
])

/** The prefix without its dashes — `--gx-` → `gx`. */
const PREFIX_BODY = TOKEN_PREFIX.replaceAll('-', '')

/**
 * Test one custom-property name against `raw/06` §6.0.
 *
 * ⚠ **Only `<group>` is enforced, and that restraint is the finding rather than a shortcut.**
 * §6.0 marks exactly one segment *"closed set"*. Its `<element>` and `<property>` lists read as
 * closed but are illustrative, and §6.2–§6.9 prove it: `--gx-crosshair-label-font-size`
 * (`:1811`), `--gx-legend-symbol-gap` (`:1775`) and `--gx-tick-offset-band` (`:1625`) all use
 * element words outside the six, and `--gx-label-landmark-grade` has no CSS property called
 * `grade` because `GRAD` is a variable-font axis. Enforcing the parentheticals would reject all
 * four. The mechanical rules below hold everywhere; the vocabulary holds in one position.
 *
 * @param {string} prop A full custom-property name, `--gx-…`.
 * @returns {string | undefined} Why it is wrong, or `undefined` if it is fine.
 */
export function inspectTokenName(prop) {
  const name = prop.slice(TOKEN_PREFIX.length)
  if (name === '') return 'no name after the prefix'
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    return `not lowercase kebab-case: ${prop}`
  }

  const segments = name.split('-')
  const group = segments[0] ?? ''
  if (!TOKEN_GROUPS.has(group)) {
    return `first segment '${group}' is not a group — raw/06 §6.0`
  }

  // ⚠ The prefix *"never recurs anywhere else in a name"* (§6.0), and that clause is the
  // whole reason a project rename is one regex. A single `--gx-widget-gx-radius` would turn
  // `s/--gx-/--<new>-/g` into a rename that also silently rewrites a middle segment.
  for (const segment of segments) {
    if (segment === PREFIX_BODY) return `the prefix '${PREFIX_BODY}' recurs mid-name — raw/06 §6.0`
  }

  for (const segment of segments) {
    const better = BANNED_SEGMENTS.get(segment)
    if (better !== undefined) return `'${segment}' is banned — use '${better}'`
  }

  return undefined
}

/**
 * Every `--gx-*` a theme actually declares — the membership set the rule below tests against.
 *
 * ⚠ **Derived by parsing, never hand-listed.** Two generators write into this directory:
 * `generate-tokens-css.mjs` emits `theme.css` from typed TS, and `generate-typography-css.mjs`
 * emits `typography.css` from `@gx/core`'s font metrics. Neither knows about the other, so any
 * hand-kept union of the two would be a third copy free to drift from both. Reading what is
 * declared answers the question directly and cannot go stale.
 *
 * @param {string} dir
 * @returns {Promise<Set<string>>}
 */
export async function collectDeclaredTokens(dir) {
  /** @type {Set<string>} */
  const declared = new Set()
  for (const file of await collectCss(dir)) {
    const source = await readFile(file, 'utf8')
    let root
    try {
      root = postcss.parse(source, { from: file })
    } catch {
      continue
    }
    root.walkDecls((decl) => {
      if (decl.prop.startsWith(TOKEN_PREFIX)) declared.add(decl.prop)
    })
  }
  return declared
}

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
 * ⚠ A deny-list, not the full CSS colour keyword set — the narrower option recorded in
 * `43-theming.md` §9 item 7. These are the common authored values this gate catches. The full
 * set is more correct and risks colliding with future keywords, so the broader keyword census
 * remains deliberately out of scope rather than being silently treated as complete.
 */
const NAMED_COLORS = new Set([
  'red', 'blue', 'green', 'white', 'black', 'grey', 'gray', 'yellow', 'orange',
  'purple', 'pink', 'brown', 'cyan', 'magenta', 'silver', 'gold', 'navy', 'teal',
  'olive', 'maroon', 'lime', 'aqua', 'fuchsia', 'indigo', 'violet', 'beige', 'ivory',
])

/**
 * @typedef {'raw-color' | 'raw-length' | 'raw-duration' | 'gradient' | 'undefined-token' | 'token-name'} RuleId
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
 * @param {Set<string>} [knownTokens] Every declared `--gx-*`. ⚠ **Omitting it disables the
 *   membership rule entirely**, which only a unit test exercising the other four rules in
 *   isolation may do. `checkTree()` always supplies it, and the CLI refuses to run on an empty
 *   set — a membership rule with nothing to be a member of passes everything.
 * @returns {Violation[]}
 */
export function inspectCss(source, file, knownTokens) {
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

    // ⚠ **Membership runs BEFORE the allowlist return, and the order is the rule.** The
    // themes directory is exempt from *literals*, not from resolving: `--gx-surface-text-color:
    // var(--gx-ramp-neutral-9)` is a token definition whose own reference has to exist, and
    // placing this after the return below would exempt the one file where a dangling
    // reference breaks every consumer at once.
    //
    // ⚠ **Declarations, not text — and this gate has the receipts.** Seven places in this
    // repo quote `var(--gx-tick-length)` and `var(--gx-grid-width)` in prose, as decision
    // 012's counterexample of a token that parses and does nothing. Neither is declared
    // anywhere. A grep-shaped version of this rule reports both on its first run: two false
    // positives out of two findings, which is how a gate gets switched off in week one.
    // PostCSS hands over declarations, and a comment is not one.
    if (knownTokens !== undefined) {
      for (const match of value.matchAll(VAR_REF_RE)) {
        const name = (match[1] ?? '').toLowerCase()
        if (knownTokens.has(name)) continue
        violations.push({ file, line, rule: 'undefined-token', prop: decl.prop, detail: name })
      }
    }

    // ⚠ **The naming rule fires on the DECLARATION and never on a reference, which is what
    // makes the report actionable.** A token is named once and read many times: `--gx-surface-text-color` had
    // eleven `var()` sites, so a reference-side check would print eleven findings for one line
    // anybody has to edit, and bury it. Declarations are also the only place a *new* bad name
    // can enter — you cannot reference a token nobody declared without the membership rule
    // above catching it first.
    //
    // Placed before the positional return for the same reason membership is: the themes
    // directory is exempt from *literals*, not from the grammar. It is the one directory where
    // every token in the tree is named.
    if (decl.prop.startsWith(TOKEN_PREFIX)) {
      const wrong = inspectTokenName(decl.prop)
      if (wrong !== undefined) {
        violations.push({ file, line, rule: 'token-name', prop: decl.prop, detail: wrong })
      }
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
    for (const match of value.matchAll(TIME_RE)) {
      const unit = match[1] ?? ''
      if (ZERO_TIME_RE.test(match[0].slice(0, match[0].length - unit.length))) continue
      violations.push({ file, line, rule: 'raw-duration', prop: decl.prop, detail: match[0] })
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
  const knownTokens = await collectDeclaredTokens(join(REPO_ROOT, ALLOWLIST_DIR))
  /** @type {Violation[]} */
  const violations = []
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    violations.push(...inspectCss(source, relative(REPO_ROOT, file), knownTokens))
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

  // ⚠ The same refusal as above, for the second rule. A membership test against an empty set
  // reports every reference as fine, exits 0, and is indistinguishable from a clean tree — the
  // *precise* failure the zero-files check exists to stop, one rule over. Moving or renaming
  // the themes directory is all it would take.
  const knownTokens = await collectDeclaredTokens(join(REPO_ROOT, ALLOWLIST_DIR))
  if (knownTokens.size === 0) {
    console.error(
      `token gate: 0 tokens declared under ${ALLOWLIST_DIR} — refusing to pass.\n` +
        'Every var(--gx-*) would be a member of nothing and the membership rule would be inert.',
    )
    process.exit(1)
  }

  const violations = await checkTree(target)
  if (violations.length > 0) {
    console.error(`token gate: ${violations.length} violation(s) across ${scanned} stylesheet(s)\n`)
    console.error(formatViolations(violations))
    console.error(
      '\nEvery value goes through a --gx-* token, and every --gx-* token exists.' +
        '\nSee research/43-theming.md §6. To add one, edit packages/tokens/src/tokens.ts' +
        ' and run `pnpm generate:tokens` — theme.css is generated.',
    )
    process.exit(1)
  }

  console.log(
    `token gate: ${scanned} stylesheet(s) clean against ${knownTokens.size} declared token(s).`,
  )
}
