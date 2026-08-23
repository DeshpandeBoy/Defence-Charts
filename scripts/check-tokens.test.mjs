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
import { inspectCss } from './check-tokens.mjs'

const FIXTURES = fileURLToPath(new URL('./__fixtures__/', import.meta.url))

const THEME_PATH = join('packages', 'tokens', 'src', 'themes', 'theme.css')
const COMPONENT_PATH = join('packages', 'primitives', 'src', 'chart.css')

/** @param {string} name */
const fixture = (name) => readFile(join(FIXTURES, name), 'utf8')

describe('the allow direction', () => {
  it('passes a theme file whose every literal is a --gx-* token definition', async () => {
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
    const source = ':where(:root) { --gx-ground: linear-gradient(to top, #000, #fff) }'
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
    const source = '.p { margin: 0; gap: calc(var(--gx-gap) * 2) }'
    expect(inspectCss(source, COMPONENT_PATH)).toEqual([])
  })

  it('permits color-mix(), which derives from tokens rather than replacing them', () => {
    // `color-mix(` must not match the `color(` rule.
    const source = '.d { background: color-mix(in oklch, var(--gx-a), var(--gx-b)) }'
    expect(inspectCss(source, COMPONENT_PATH)).toEqual([])
  })

  it('does not read a token name as a colour or a length', () => {
    const source = '.t { color: var(--gx-grid-color); padding: var(--gx-size-4px) }'
    expect(inspectCss(source, COMPONENT_PATH)).toEqual([])
  })
})
