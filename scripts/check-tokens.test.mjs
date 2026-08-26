/**
 * Gate **G7** — the token lint gate, asserted in BOTH directions.
 *
 * ⚠ `research/43-theming.md` §6.3: *"a gate never observed to fail is not a gate — it is
 * a job that exits 0."* The corpus originally planted only the deny direction. That is
 * the ceremonial half. When the regex implementation was actually run against the rule
 * §6.1 specifies, it produced six rejections of which two were correct — every one of
 * those four errors was a **false positive**, so a deny-only fixture would have caught
 * none of them and the gate would have shipped rejecting the tokens package it exists to
 * protect.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { TOKEN_GROUPS, collectDeclaredTokens, inspectCss, inspectTokenName } from './check-tokens.mjs'

const FIXTURES = fileURLToPath(new URL('./__fixtures__/', import.meta.url))
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

const THEME_PATH = join('packages', 'tokens', 'src', 'themes', 'theme.css')
const COMPONENT_PATH = join('packages', 'primitives', 'src', 'chart.css')

/** @param {string} name */
const fixture = (name) => readFile(join(FIXTURES, name), 'utf8')

describe('the allow direction', () => {
  it('passes a theme file whose every literal is a --shiftcharts-* token definition', async () => {
    const violations = inspectCss(await fixture('allow-theme.css'), THEME_PATH)
    expect(violations).toEqual([])
  })

  it('passes component CSS containing a data URI and a content string', async () => {
    // ⚠ The two parse-level false positives, both outside the allowlist entirely. A
    // `#ffffffBB` inside base64 is payload; a `#ff0000` inside `content` is text.
    const violations = inspectCss(await fixture('allow-component.css'), COMPONENT_PATH)
    expect(violations).toEqual([])
  })

  it('ships the real theme clean', async () => {
    const source = await readFile(
      join(fileURLToPath(new URL('..', import.meta.url)), THEME_PATH),
      'utf8',
    )
    expect(inspectCss(source, THEME_PATH)).toEqual([])
  })
})

describe('the deny direction', () => {
  it('rejects the literal classes the seed documents named', async () => {
    const violations = inspectCss(await fixture('deny-component.css'), COMPONENT_PATH)
    const details = violations.map((v) => v.detail)
    expect(details).toEqual(
      expect.arrayContaining(['#ff0000', 'rgba()', 'hsl()', '13px']),
    )
  })

  it('rejects the six literal classes decision 015 widened the rule set to cover', async () => {
    // ⚠ Every one of these passed the regex implementation clean, and DESIGN.md derives
    // the entire palette in OKLCH — so `oklch()` slipping through was the live hole, not
    // a hypothetical one.
    const violations = inspectCss(await fixture('deny-component.css'), COMPONENT_PATH)
    const details = violations.map((v) => v.detail)
    for (const widened of ['oklch()', 'lab()', 'hwb()', 'color()', 'red', '2rem', '0.5em']) {
      expect(details).toContain(widened)
    }
  })

  it('rejects a gradient', async () => {
    const violations = inspectCss(await fixture('deny-component.css'), COMPONENT_PATH)
    expect(violations.some((v) => v.rule === 'gradient')).toBe(true)
  })
})

describe('the allowlist is positional, not decorative', () => {
  it('rejects the same theme bytes at a non-allowlisted path', async () => {
    // If this ever passes, the allowlist has stopped changing the answer — which means
    // the deny direction is passing for a reason unrelated to the rule.
    const violations = inspectCss(await fixture('allow-theme.css'), COMPONENT_PATH)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations.map((v) => v.detail)).toContain('#b4e4fd')
  })

  it('rejects a non-token declaration inside an allowlisted file', async () => {
    // ⚠ The other half of "narrow in two dimensions at once". The tokens package is
    // exactly where someone drops a component style "just for now".
    const violations = inspectCss('.chart { color: #ff0000 }', THEME_PATH)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.detail).toBe('#ff0000')
  })

  it('rejects a gradient even on a token definition in an allowlisted file', async () => {
    // ⚠ Gradients have no allowlist anywhere. The ban is semantic, so it does not relax.
    const source = ':where(:root) { --shiftcharts-surface-color: linear-gradient(to top, #000, #fff) }'
    const violations = inspectCss(source, THEME_PATH)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.rule).toBe('gradient')
  })
})

describe('the traps', () => {
  it('permits currentColor, which §3.1 mandates rather than tolerates', () => {
    // A named-colour list that swallows this converts a requirement into a violation.
    expect(inspectCss('.g { stroke: currentColor }', COMPONENT_PATH)).toEqual([])
  })

  it('permits a unitless zero and a calc() multiplier', () => {
    const source = '.p { margin: 0; gap: calc(var(--shiftcharts-size-gap) * 2) }'
    expect(inspectCss(source, COMPONENT_PATH)).toEqual([])
  })

  it('permits color-mix(), which derives from tokens rather than replacing them', () => {
    // `color-mix(` must not match the `color(` rule.
    const source = '.d { background: color-mix(in oklch, var(--shiftcharts-a), var(--shiftcharts-b)) }'
    expect(inspectCss(source, COMPONENT_PATH)).toEqual([])
  })

  it('does not read a token name as a colour or a length', () => {
    const source = '.t { color: var(--shiftcharts-grid-color); padding: var(--shiftcharts-size-4px) }'
    expect(inspectCss(source, COMPONENT_PATH)).toEqual([])
  })
})

describe('durations, which this gate could not see until A6', () => {
  /**
   * ⚠ **The gap this closes was live in the repo, not hypothetical.** `chart.css` carried
   * `transition: opacity 120ms ease-out` from A4 onward, under a docblock promising that every
   * colour and every length in the file went through a token. Both halves of that promise were
   * kept; a duration is neither, so the one hardcoded value in the package sat in the file the
   * gate exists to protect and passed every run. A6 adds four motion tokens and would have
   * multiplied it.
   */
  it('rejects a raw duration in component CSS', () => {
    const violations = inspectCss(
      '.shiftcharts-line { transition: opacity 120ms ease-out; }',
      COMPONENT_PATH,
    )
    expect(violations.map((v) => `${v.rule}:${v.detail}`)).toEqual(['raw-duration:120ms'])
  })

  it('rejects seconds as readily as milliseconds', () => {
    const violations = inspectCss('.shiftcharts-line { transition-delay: 0.5s; }', COMPONENT_PATH)
    expect(violations.map((v) => v.detail)).toEqual(['0.5s'])
  })

  it('passes a duration that arrives through a token', () => {
    const violations = inspectCss(
      '.shiftcharts-line { transition: d var(--shiftcharts-motion-duration) var(--shiftcharts-motion-easing); }',
      COMPONENT_PATH,
    )
    expect(violations).toEqual([])
  })

  /**
   * ⚠ The zero exemption, in both directions. `transition-delay: 0` is invalid CSS — the
   * grammar requires the unit on a time where it forbids one on a length — so `0ms` is
   * syntax rather than a chosen value, and rejecting it would force a token whose entire
   * content is "nothing". The test that matters is the second one: the exemption must be
   * numeric, or `0.5s` walks through a rule written for `0s`.
   */
  it('exempts a zero duration and nothing that merely starts with zero', () => {
    expect(inspectCss('.a { transition-delay: 0ms; }', COMPONENT_PATH)).toEqual([])
    expect(inspectCss('.a { transition-delay: 0.0s; }', COMPONENT_PATH)).toEqual([])
    expect(inspectCss('.a { transition-delay: 0.05s; }', COMPONENT_PATH)).toHaveLength(1)
    expect(inspectCss('.a { transition-delay: 01ms; }', COMPONENT_PATH)).toHaveLength(1)
  })

  /**
   * The positional rule holds for durations exactly as it does for colours: a token
   * *definition* in the tokens package is where a real number is supposed to live, and a
   * *property* in the same file is not.
   */
  it('keeps the allowlist positional', () => {
    expect(
      inspectCss(':root { --shiftcharts-motion-duration-recompose: 1000ms; }', THEME_PATH),
    ).toEqual([])
    expect(inspectCss('.a { transition: opacity 300ms linear; }', THEME_PATH)).toHaveLength(1)
  })

  /** `calc(var(--shiftcharts-motion-duration) / 2)` must not read its divisor as a duration. */
  it('does not mistake a bare number in calc() for a time', () => {
    const violations = inspectCss(
      '.a { transition-delay: calc(var(--shiftcharts-motion-duration) / 2); }',
      COMPONENT_PATH,
    )
    expect(violations).toEqual([])
  })
})

describe('membership, the rule G14 was written because G7 lacked', () => {
  /**
   * ⚠ **The gate map's note on G14 opens: *"G7 checks that a `var()` was used; it has no way
   * to know whether the property that `var()` lands on exists."*** This rule closes the
   * neighbouring hole, which is one indirection earlier — whether the *token* exists. A
   * misspelt `var(--shiftcharts-serie-1)` parses, passes all four literal rules, builds, and paints
   * the property's initial value. Same species, third door.
   *
   * ⚠ Membership is a set of *names*, so it cannot be a regex over the tree. Grepping for
   * `--shiftcharts-[a-z-]+` across `packages/` reported `--shiftcharts-grid-width` and `--shiftcharts-tick-length` as
   * used-and-undeclared; all seven occurrences of the pair are **prose comments quoting
   * decision 012's counterexample** — the tokens it documents as deliberately absent. Two
   * findings, two false positives. That is why the rule walks declarations.
   */
  const KNOWN = new Set(['--shiftcharts-surface-text-color', '--shiftcharts-motion-duration'])

  it('accepts a var() naming a declared token', () => {
    expect(inspectCss('.a { color: var(--shiftcharts-surface-text-color) }', COMPONENT_PATH, KNOWN)).toEqual([])
  })

  it('rejects a var() naming a token nobody declares', () => {
    const violations = inspectCss('.a { color: var(--shiftcharts-inkk) }', COMPONENT_PATH, KNOWN)
    expect(violations.map((v) => `${v.rule}:${v.detail}`)).toEqual(['undefined-token:--shiftcharts-inkk'])
  })

  /**
   * ⚠ **The fallback is the case worth planting.** `var(--shiftcharts-typo-not-a-token, 4px)` renders
   * a perfectly good 4px forever, so nothing downstream looks wrong and no author ever finds
   * out the token was never real. The rule matches on the opening of the `var()` for exactly
   * this reason — the comma is not a terminator it respects.
   *
   * ⚠ **Two violations, and the second one surprised the test that was written first.** The
   * pre-existing `raw-length` rule fires on the `4px` as well, because a fallback literal is
   * a length this file chose and this file will paint. That is not double-counting: the two
   * findings have different fixes — declare the token, *and* stop hardcoding the fallback —
   * and a reader who saw only the first would fix the name and leave the literal behind. No
   * `var(--shiftcharts-*, <literal>)` exists anywhere in the tree today, which is why nothing had
   * exercised the interaction before.
   */
  it('rejects an undeclared token even when a fallback hides the miss', () => {
    const violations = inspectCss(
      '.a { padding: var(--shiftcharts-typo-not-a-token, 4px) }',
      COMPONENT_PATH,
      KNOWN,
    )
    expect(violations.map((v) => `${v.rule}:${v.detail}`)).toEqual([
      'undefined-token:--shiftcharts-typo-not-a-token',
      'raw-length:4px',
    ])
  })

  /**
   * ⚠ The rule sits **before** the allowlist early-return, so it applies inside the tokens
   * package too. `--shiftcharts-surface-text-color: var(--shiftcharts-ramp-neutral-9)` is a real chain in `theme.css`, and a
   * typo in the right-hand side there breaks every theme at once.
   */
  it('applies inside the allowlisted tokens directory, where the var() chains live', () => {
    expect(
      inspectCss(
        ':root { --shiftcharts-surface-text-color: var(--shiftcharts-nope) }',
        THEME_PATH,
        KNOWN,
      ).map((v) => v.rule),
    ).toEqual(['undefined-token'])
  })

  it('is inert when no set is supplied, so the other four rules stay testable alone', () => {
    // ⚠ If this ever fails, every `inspectCss(source, file)` call above has silently
    // acquired a fifth rule and the two-argument tests are asserting something else.
    expect(inspectCss('.a { color: var(--shiftcharts-not-a-token) }', COMPONENT_PATH)).toEqual([])
  })

  it('ships the real tree clean against the real declarations', async () => {
    const declared = await collectDeclaredTokens(
      join(fileURLToPath(new URL('..', import.meta.url)), 'packages', 'tokens', 'src', 'themes'),
    )
    expect(declared.size).toBeGreaterThan(0)
    const source = await readFile(
      join(fileURLToPath(new URL('..', import.meta.url)), COMPONENT_PATH),
      'utf8',
    )
    expect(inspectCss(source, COMPONENT_PATH, declared)).toEqual([])
  })
})

describe('the naming rule — G7 rule 6, added with the B1 slice 2 rename', () => {
  /**
   * ⚠ **The vocabulary is asserted against `raw/06` itself, and that is the reverse
   * direction the other five rules do not have.** `TOKEN_GROUPS` is a hand-kept union: 19
   * groups §6.0 publishes plus thirteen §6.2–§6.9 uses without publishing. A hand-kept union
   * is exactly the shape that drifts — `SHIFTCHARTS_TOKENS` was one, and it reached B1 seven tokens
   * behind the stylesheet. So this parses the specification and asserts containment. Add a
   * group to `raw/06` and the *test* names it; the gate can never quietly start rejecting a
   * name the document specifies.
   *
   * Sections are located by heading text rather than line number: `raw/06` is 1800+ lines and
   * anything anchored to a number there is anchored to nothing.
   */
  it('contains every first segment raw/06 §6.2–§6.9 actually uses', async () => {
    const raw = await readFile(
      join(REPO_ROOT, 'research', 'raw', '06-design-tokens-widgets.md'),
      'utf8',
    )
    const start = raw.indexOf('### 6.2 ')
    const end = raw.indexOf('### 6.10 ')
    expect(start).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(start)

    const used = new Set(
      [...raw.slice(start, end).matchAll(/--shiftcharts-([a-z][a-z0-9]*)/g)].map((m) => m[1]),
    )
    // `color` and `cat` are named in `raw/06` as the spellings to avoid, not to adopt —
    // see the ⚠ on TOKEN_GROUPS. They are not in this range, and this asserts it stays so.
    expect(used.has('color')).toBe(false)
    expect(used.has('cat')).toBe(false)

    const missing = [...used].filter((group) => !TOKEN_GROUPS.has(group)).sort()
    expect(missing).toEqual([])
  })

  it('accepts the shapes raw/06 §6.0 describes, including the ones it only implies', () => {
    // group+property, group+element+property, group+modifier, group alone, and a property
    // segment with no CSS property of that name (`grade` is a variable-font axis).
    for (const name of [
      '--shiftcharts-grid-color',
      '--shiftcharts-axis-title-font-size',
      '--shiftcharts-series-1',
      '--shiftcharts-surface',
      '--shiftcharts-label-landmark-grade',
      '--shiftcharts-motion-stage-delay-recompose',
      '--shiftcharts-widget-radius-inner',
    ]) {
      expect(inspectTokenName(name), name).toBeUndefined()
    }
  })

  it('rejects every first segment the slice 2 rename removed', () => {
    // ⚠ The ratchet. These seven are not hypothetical bad names — all seven shipped, and
    // this is the test that stops them coming back one at a time.
    for (const name of [
      '--shiftcharts-ground',
      '--shiftcharts-ink',
      '--shiftcharts-charcoal-900',
      '--shiftcharts-corner-radius',
      '--shiftcharts-elevation-raised',
      '--shiftcharts-band-alpha',
      '--shiftcharts-gap',
    ]) {
      expect(inspectTokenName(name), name).toMatch(/is not a group/)
    }
  })

  it('rejects a wrong property spelling even when the group is right', () => {
    expect(inspectTokenName('--shiftcharts-grid-alpha')).toMatch(/use 'opacity'/)
    expect(inspectTokenName('--shiftcharts-axis-colour')).toMatch(/use 'color'/)
  })

  it('rejects a prefix that recurs mid-name, which is what makes the rename one regex', () => {
    // raw/06 §6.0's whole argument for `s/--shiftcharts-/--<new>-/g` being a safe rename is that `gx`
    // appears in exactly one position. One token like this and the rename rewrites a middle
    // segment too, silently.
    expect(inspectTokenName('--shiftcharts-widget-shiftcharts-radius')).toMatch(/recurs mid-name/)
  })

  it('rejects the spellings CSS itself would not accept', () => {
    expect(inspectTokenName('--shiftcharts-Grid-Color')).toMatch(/lowercase kebab/)
    expect(inspectTokenName('--shiftcharts-grid_color')).toMatch(/lowercase kebab/)
    expect(inspectTokenName('--shiftcharts-grid--color')).toMatch(/lowercase kebab/)
    expect(inspectTokenName('--shiftcharts-grid-')).toMatch(/lowercase kebab/)
    expect(inspectTokenName('--shiftcharts-')).toBe('no name after the prefix')
  })

  it('fires on the declaration and stays silent on the reference', () => {
    // ⚠ Both halves matter. Reporting the reference would print one finding per `var()` site
    // for a single line anybody has to edit — `--shiftcharts-ink` had eleven. And a reference to a
    // badly-named token cannot escape: the membership rule above rejects it for not existing.
    expect(
      inspectCss(':root { --shiftcharts-nonsuch-color: red }', THEME_PATH).map((v) => v.rule),
    ).toEqual(['token-name'])
    expect(
      inspectCss('.a { color: var(--shiftcharts-nonsuch-color) }', COMPONENT_PATH).map((v) => v.rule),
    ).toEqual([])
  })

  it('ships both themes clean, which is the claim the rename was for', async () => {
    for (const sheet of ['theme.css', 'typography.css']) {
      const path = join('packages', 'tokens', 'src', 'themes', sheet)
      const source = await readFile(join(REPO_ROOT, path), 'utf8')
      expect(inspectCss(source, path).filter((v) => v.rule === 'token-name'), sheet).toEqual([])
    }
  })
})
