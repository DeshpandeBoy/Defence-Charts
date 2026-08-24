/**
 * Gate **G17, pointed at the token generator** — the committed stylesheet is regenerated
 * from its typed source and compared byte-for-byte.
 *
 * ⚠ **What this gate protects is a direction, not a file.** Before B1 the token tree was
 * authored in CSS and every provenance tier was a comment. A comment is not checked, and
 * the cost showed up twice in one sitting: `theme.css` credited the gridline alpha to
 * Talbot 2010 from A1 onward when `10-responsive-ladder.md:373` attributes it to Heer &
 * Bostock — Talbot is the *tick-spacing* work and says nothing about alpha — and the
 * hand-maintained `GX_TOKENS` had fallen seven names behind the stylesheet, missing every
 * A6 motion token. Neither is the kind of mistake review catches; both are the kind a
 * generator makes impossible.
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { collectDeclaredTokens } from './check-tokens.mjs'
import { renderTokenNames, renderTokensCss } from './generate-tokens-css.mjs'
import { ALL_TOKENS, THEME_VARIANTS, TOKEN_GROUPS, tierCensus } from '../packages/tokens/src/tokens.ts'

const url = (path) => fileURLToPath(new URL(path, import.meta.url))

const CSS_TARGET = url('../packages/tokens/src/themes/theme.css')
const NAMES_TARGET = url('../packages/tokens/src/tokens.generated.ts')
const THEMES_DIR = url('../packages/tokens/src/themes/')

describe('the generated stylesheet', () => {
  it('is byte-for-byte current with the typed token tree', async () => {
    expect(await readFile(CSS_TARGET, 'utf8')).toBe(renderTokensCss())
  })

  it('declares exactly the tokens the tree declares, once each', async () => {
    // ⚠ The count, not just the equality above — a generator that dropped a whole group
    // would still be "current" with itself. This is the assertion that notices.
    const declared = [...(await collectDeclaredTokens(THEMES_DIR))]
    const authored = TOKEN_GROUPS.flatMap((g) => g.tokens).map((t) => `--gx-${t.name}`)
    expect(new Set(authored).size).toBe(authored.length)
    expect(authored.every((name) => declared.includes(name))).toBe(true)
  })
})

describe('the generated name list', () => {
  it('is byte-for-byte current with what the themes directory declares', async () => {
    expect(await readFile(NAMES_TARGET, 'utf8')).toBe(
      renderTokenNames(await collectDeclaredTokens(THEMES_DIR)),
    )
  })

  /**
   * ⚠ **This is why the list is parsed off disk rather than derived from `tokens.ts`.**
   * `typography.css` is a *different* generator's output — `generate-typography-css.mjs`,
   * from the fitted metrics in `@gx/core` — and its tokens are just as public. Deriving
   * the list from the typed tree alone would silently exclude them, which is the same
   * seven-token hole in a new shape.
   */
  it('spans the other generator too', async () => {
    const { GX_TOKENS } = await import('../packages/tokens/src/tokens.generated.ts')
    const authored = new Set(TOKEN_GROUPS.flatMap((g) => g.tokens).map((t) => t.name))
    const fromTypography = GX_TOKENS.filter((name) => !authored.has(name))
    expect(fromTypography).toContain('font-family')
    expect(fromTypography.length).toBeGreaterThan(0)
  })
})

describe('the theme variants', () => {
  /**
   * ⚠ The light overrides are emitted **twice** — once under
   * `@media (prefers-color-scheme: light)` and once under the explicit class — from one
   * authored list. Hand-maintained they had already diverged: the class copy carried bare
   * hex with the contrast ratios stripped off, so the block a consumer is most likely to
   * read was the block with the evidence missing.
   */
  it('emit each override identically in both blocks', async () => {
    const css = await readFile(CSS_TARGET, 'utf8')
    for (const variant of THEME_VARIANTS) {
      for (const token of variant.overrides) {
        const line = `--gx-${token.name}: ${token.value};`
        expect(css.split(line).length - 1, `${token.name} should appear twice`).toBe(2)
      }
    }
  })

  it('override only tokens the base tree already declares', () => {
    // A variant introducing a name the default theme lacks cannot be swapped by a class —
    // 43-theming.md §3.2, the same rule that keeps the two shadow tokens alive at `none`.
    const base = new Set(TOKEN_GROUPS.flatMap((g) => g.tokens).map((t) => t.name))
    for (const variant of THEME_VARIANTS) {
      for (const token of variant.overrides) expect(base.has(token.name)).toBe(true)
    }
  })
})

describe('the provenance census', () => {
  it('counts every token exactly once', () => {
    const census = tierCensus()
    const total = Object.values(census).reduce((a, b) => a + b, 0)
    expect(total).toBe(ALL_TOKENS.length)
  })

  /**
   * ⚠ **A ratchet, not a target.** `untiered` clears by transcribing `raw/06` §6.2–6.9;
   * `unverified` clears only by finding a source or taking a measurement. Neither is
   * allowed to grow, because the failure mode is a new token arriving with no tier and
   * nobody noticing — which is precisely how a tuned number acquires the authority of a
   * researched one (gate G8). Lower this number when the work is done; never raise it.
   */
  it('owes no more to B1 than it did when the tree was transcribed', () => {
    const census = tierCensus()
    expect(census.untiered + census.unverified).toBeLessThanOrEqual(9)
  })

  it('gives every token a tier from the closed set', () => {
    const tiers = new Set(['A-lit', 'A-impl', 'B', 'C', 'unverified', 'untiered'])
    for (const token of ALL_TOKENS) expect(tiers.has(token.tier)).toBe(true)
  })
})
