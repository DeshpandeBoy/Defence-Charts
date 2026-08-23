import { describe, expect, it } from 'vitest'

import { ROBOTO_FLEX_METRICS } from './font-metrics.generated.ts'
import type { FontMetrics, GlyphAdvances, TypeRank } from './text.ts'
import { DEFAULT_TYPOGRAPHY, measureText, RANK_FONT_SIZE } from './text.ts'

/**
 * A deliberately tiny, fully-known table, so every assertion below is arithmetic rather
 * than a guess about a real typeface.
 *
 * `i` is narrow, `W` is wide, `0` sits between them — enough to tell "summed the advances"
 * apart from "counted the characters", which is the mistake a constant-width model hides.
 */
function tableWith(advances: Record<string, number>): GlyphAdvances {
  return {
    advances,
    fallback: { latin: 0.5, cjk: 1.0, combining: 0 },
  }
}

const TEST_METRICS: FontMetrics = {
  family: 'test',
  generatedWith: {
    featureSettings: "'tnum' 1",
    variationSettings: '',
    opticalSizing: 'none',
    stretch: 'normal',
  },
  byRank: {
    A: tableWith({ i: 0.2, W: 0.9, '0': 0.6 }),
    B: tableWith({ i: 0.2, W: 0.9, '0': 0.6 }),
    C: tableWith({ i: 0.2, W: 0.9, '0': 0.6 }),
    // ⚠ D is given *different* advances on purpose. A table keyed by rank is only
    // meaningful if the rank actually selects it, and a resolver that quietly reads rank A
    // for everything would pass every other test in this file.
    D: tableWith({ i: 0.3, W: 1.1, '0': 0.7 }),
    E: tableWith({ i: 0.2, W: 0.9, '0': 0.6 }),
  },
  safetyFactor: 1,
  vertical: { ascent: 1, descent: 0.25, lineGap: 0, capHeight: 0.7, xHeight: 0.5 },
}

/** `TEST_METRICS` with one field replaced. */
function withSafetyFactor(safetyFactor: number): FontMetrics {
  return { ...TEST_METRICS, safetyFactor }
}

describe('measureText', () => {
  it('returns 0 for the empty string', () => {
    expect(measureText('', 'C', TEST_METRICS)).toBe(0)
  })

  it('sums per-character advances and scales by the rank font size', () => {
    // 0.2 + 0.9 + 0.6 = 1.7 advances, at rank C = 11 px.
    expect(measureText('iW0', 'C', TEST_METRICS)).toBeCloseTo(1.7 * 11, 10)
  })

  it('selects the table by rank, not by font size alone', () => {
    // ⚠ The two reasons a single normalised table cannot work are optical sizing and
    // weight, and both mean rank C and rank D have different advances *at the same 11 px*.
    // This is the test that fails if `byRank` is ever collapsed into one table plus a
    // scale factor.
    expect(RANK_FONT_SIZE.C).toBe(RANK_FONT_SIZE.D)
    expect(measureText('iW0', 'C', TEST_METRICS)).not.toBeCloseTo(
      measureText('iW0', 'D', TEST_METRICS),
      10,
    )
  })

  it.each(['A', 'B', 'C', 'D', 'E'] as const satisfies readonly TypeRank[])(
    'scales by the rank font size for rank %s',
    (rank) => {
      const advance = rank === 'D' ? 0.3 : 0.2
      expect(measureText('i', rank, TEST_METRICS)).toBeCloseTo(advance * RANK_FONT_SIZE[rank], 10)
    },
  )

  it('multiplies the whole measurement by safetyFactor', () => {
    const plain = measureText('iW0', 'C', TEST_METRICS)
    expect(measureText('iW0', 'C', withSafetyFactor(1.15))).toBeCloseTo(plain * 1.15, 10)
  })

  describe('code-point iteration — rule 2', () => {
    it('counts an astral-plane character once, not twice', () => {
      // ⚠ The bug this exists to catch: `for (let i = 0; i < text.length; i++)` walks
      // UTF-16 units, so U+1D11E (two units) measures as two characters — a silent 2×
      // over-count. Over-counting is the *safe* direction here, which is exactly why it
      // would never surface as a visible collision; it would just make every label
      // containing an emoji degrade a rung early, forever, for no stated reason.
      const oneAstral = measureText('\u{1D11E}', 'C', TEST_METRICS)
      const oneFallbackLatin = measureText('?', 'C', TEST_METRICS)
      expect(oneAstral).toBeCloseTo(oneFallbackLatin, 10)
      expect(oneAstral).toBeCloseTo(0.5 * 11, 10)
    })

    it('measures a surrogate pair identically whether written escaped or literal', () => {
      expect(measureText('\u{1F600}', 'C', TEST_METRICS)).toBeCloseTo(
        measureText('😀', 'C', TEST_METRICS),
        10,
      )
    })
  })

  describe('the banded fallback — rule 4', () => {
    it('gives unknown Latin the latin band', () => {
      expect(measureText('q', 'C', TEST_METRICS)).toBeCloseTo(0.5 * 11, 10)
    })

    it('gives a full-width CJK ideograph the cjk band, roughly double latin', () => {
      // ⚠ This is why the fallback is banded rather than a single number. One value cannot
      // serve both without being wrong for one of them by a factor of two — and the
      // direction it is wrong for CJK is *narrow*, which collides.
      expect(measureText('中', 'C', TEST_METRICS)).toBeCloseTo(1.0 * 11, 10)
      expect(measureText('中', 'C', TEST_METRICS)).toBeCloseTo(
        2 * measureText('q', 'C', TEST_METRICS),
        10,
      )
    })

    it.each([
      ['가', 'Hangul syllable'],
      ['あ', 'Hiragana'],
      ['Ａ', 'full-width Latin A'],
    ])('gives %s (%s) the cjk band', (ch) => {
      expect(measureText(ch, 'C', TEST_METRICS)).toBeCloseTo(1.0 * 11, 10)
    })

    it('gives a combining mark zero advance', () => {
      // A decomposed e-acute is two code points but one glyph cluster and one advance.
      // Charging for the mark would make every accented label — that is, most non-English
      // labels — measure wide by a whole character.
      //
      // ⚠ Spelled with an explicit \u0301 escape rather than typed as a literal glyph.
      // Editors, formatters and git filters all normalise text, and the composed form
      // (U+00E9, a single code point) passes this assertion without ever reaching the
      // combining branch. This repo has already been bitten twice by a file whose *bytes*
      // changed its meaning; an escape cannot be normalised out from under it.
      const decomposed = 'e\u0301'
      expect(Array.from(decomposed)).toHaveLength(2)
      expect(measureText(decomposed, 'C', TEST_METRICS)).toBeCloseTo(
        measureText('e', 'C', TEST_METRICS),
        10,
      )
    })

    it('prefers an explicit advance over the band when the character is in the table', () => {
      expect(measureText('i', 'C', TEST_METRICS)).toBeCloseTo(0.2 * 11, 10)
      expect(measureText('i', 'C', TEST_METRICS)).toBeLessThan(measureText('q', 'C', TEST_METRICS))
    })
  })

  describe('letterSpacing — rule 5', () => {
    it('adds one gap per inter-character boundary, not per character', () => {
      // Three code points → two gaps. Charging three would over-report by a full gap on
      // every label; the `− 1` is the entire content of rule 5.
      expect(measureText('iii', 'C', TEST_METRICS, 2)).toBeCloseTo(3 * 0.2 * 11 + 2 * 2, 10)
    })

    it('adds nothing for a single character', () => {
      expect(measureText('i', 'C', TEST_METRICS, 2)).toBeCloseTo(measureText('i', 'C', TEST_METRICS), 10)
    })

    it('counts gaps by code point, so an astral character contributes one gap', () => {
      expect(measureText('\u{1D11E}\u{1D11E}', 'C', TEST_METRICS, 3)).toBeCloseTo(
        2 * 0.5 * 11 + 1 * 3,
        10,
      )
    })

    it('does not scale letterSpacing by font size or by safetyFactor', () => {
      // ⚠ The one deliberate departure from the literal order of rules 5 and 6. Advances
      // are ratios awaiting a font size; `letterSpacing` is already px. And `safetyFactor`
      // absorbs *glyph* drift between the reference face and a fallback — a CSS length
      // does not drift with the face. Pinned here so a later tidy-up cannot fold the
      // spacing back inside the multiplication without a failing test.
      const glyphs = 3 * 0.2 * 11
      expect(measureText('iii', 'C', withSafetyFactor(2), 2)).toBeCloseTo(glyphs * 2 + 2 * 2, 10)
    })

    it('defaults letterSpacing to 0', () => {
      expect(measureText('iii', 'C', TEST_METRICS)).toBeCloseTo(measureText('iii', 'C', TEST_METRICS, 0), 10)
    })
  })

  describe('purity', () => {
    it('is referentially transparent across repeated calls', () => {
      const once = measureText('Revenue 2026', 'C', TEST_METRICS, 0.5)
      for (let i = 0; i < 5; i += 1) {
        expect(measureText('Revenue 2026', 'C', TEST_METRICS, 0.5)).toBe(once)
      }
    })

    it('does not mutate the metrics it is given', () => {
      const before = JSON.stringify(TEST_METRICS)
      measureText('Revenue 2026', 'C', TEST_METRICS, 0.5)
      expect(JSON.stringify(TEST_METRICS)).toBe(before)
    })

    it('round-trips its metrics through JSON unchanged', () => {
      // ⚠ `FontMetrics` travels from a server-rendered plan to the client. If it did not
      // survive `JSON.stringify`, the two would silently disagree about label widths — the
      // hydration-mismatch failure mode, arriving through the metrics door.
      const revived = JSON.parse(JSON.stringify(TEST_METRICS)) as FontMetrics
      expect(measureText('Revenue 2026', 'C', revived, 0.5)).toBe(
        measureText('Revenue 2026', 'C', TEST_METRICS, 0.5),
      )
    })
  })
})

describe('DEFAULT_TYPOGRAPHY', () => {
  it('keeps every fit-sensitive input and its metrics together', () => {
    expect(DEFAULT_TYPOGRAPHY).toMatchObject({
      family: expect.any(String),
      featureSettings: ROBOTO_FLEX_METRICS.generatedWith.featureSettings,
      stretch: ROBOTO_FLEX_METRICS.generatedWith.stretch,
      opticalSizing: ROBOTO_FLEX_METRICS.generatedWith.opticalSizing,
      metrics: ROBOTO_FLEX_METRICS,
    })
  })

  /**
   * ⚠ The pairing above is the whole safety property, so it is worth saying what breaks
   * without it. `FontMetrics` describes advances measured *under a specific rendering
   * configuration*. Author `featureSettings` here as a literal and someone can change the
   * CSS without regenerating the table; the planner then measures one rendering and the
   * browser draws another, and every label is off by an amount nothing reports. Reading
   * both from one object means there is nothing to keep in sync.
   */
  it('does not author the feature settings separately from the table', () => {
    expect(DEFAULT_TYPOGRAPHY.featureSettings).toBe("'tnum' 1")
    expect(DEFAULT_TYPOGRAPHY.featureSettings).not.toBe('normal')
  })

  it('is the source of the rank-size compatibility view', () => {
    for (const rank of ['A', 'B', 'C', 'D', 'E'] as const satisfies readonly TypeRank[]) {
      expect(RANK_FONT_SIZE[rank]).toBe(DEFAULT_TYPOGRAPHY.byRank[rank].fontSize)
    }
  })

  it('is frozen through every authored rank', () => {
    expect(Object.isFrozen(DEFAULT_TYPOGRAPHY)).toBe(true)
    expect(Object.isFrozen(DEFAULT_TYPOGRAPHY.byRank)).toBe(true)
    for (const style of Object.values(DEFAULT_TYPOGRAPHY.byRank)) {
      expect(Object.isFrozen(style)).toBe(true)
    }
  })
})

describe('ROBOTO_FLEX_METRICS', () => {
  // ⚠ `scripts/generate-font-metrics.test.mjs` checks the *generator*. These check the
  // shipped constant — the thing `measureText()` actually reads — for the two properties
  // the resolver depends on and a generator change could quietly drop.

  it('names the face it was measured from, so a debugger shows it', () => {
    // The predecessor of this constant was a placeholder whose family string read
    // `UNVERIFIED — no table generated`. That string was the only place the hole was
    // visible at runtime, and this is its replacement: a real face name means a real table.
    expect(ROBOTO_FLEX_METRICS.family).toBe('Roboto Flex')
    expect(ROBOTO_FLEX_METRICS.family).not.toMatch(/UNVERIFIED/)
  })

  it('covers every rank with a real per-character table', () => {
    // ⚠ Per rank, not once. Optical sizing and weight both move advances, so a table that
    // covered rank C and fell back to a band for rank D would produce a width that looks
    // calibrated and is not — precisely what the placeholder refused to fake.
    for (const rank of ['A', 'B', 'C', 'D', 'E'] as const satisfies readonly TypeRank[]) {
      expect(Object.keys(ROBOTO_FLEX_METRICS.byRank[rank].advances).length).toBeGreaterThan(60)
    }
  })

  it('the five ranks are genuinely different tables, not one table copied', () => {
    // If the generator ever collapsed to a single measurement pass, every rank would agree
    // and every assertion above would still pass.
    const widths = (['A', 'B', 'C', 'D', 'E'] as const).map(
      (rank) => ROBOTO_FLEX_METRICS.byRank[rank].advances['M'],
    )
    expect(new Set(widths).size).toBeGreaterThan(1)
  })

  /**
   * ⚠ §6.1 — *"where `measureText()` is inexact, it must err **wide**."* With a real
   * advance table the guarantee no longer comes from a worst-case band; it comes from
   * `safetyFactor`, calibrated against the reachable fallback faces. A value below 1 would
   * turn every measurement into a potential collision, and it is exactly the kind of number
   * a well-meaning "the labels look too spaced out" change would reach for first.
   */
  it('errs wide by calibration rather than by band', () => {
    expect(ROBOTO_FLEX_METRICS.safetyFactor).toBeGreaterThan(1)
    expect(ROBOTO_FLEX_METRICS.safetyFactor).toBe(1.57)
  })

  it('a measured string comes out wider than the bare advances predict', () => {
    // The safety factor is applied, not merely stored. A generator that emitted the field
    // while `measureText` ignored it would pass every test above.
    const bare = [...'Revenue'].reduce(
      (sum, ch) => sum + (ROBOTO_FLEX_METRICS.byRank.C.advances[ch] ?? 0),
      0,
    )
    expect(measureText('Revenue', 'C', ROBOTO_FLEX_METRICS)).toBeCloseTo(
      bare * RANK_FONT_SIZE.C * ROBOTO_FLEX_METRICS.safetyFactor,
      6,
    )
  })

  it('is frozen, so a consumer cannot mutate the shared default in place', () => {
    expect(Object.isFrozen(ROBOTO_FLEX_METRICS)).toBe(true)
  })
})

describe('RANK_FONT_SIZE', () => {
  it('matches the settled scale in research/42-typography.md §4', () => {
    // A 13/700 · B 12/700 · C 11/500 · D 11/400 · E 10/400. Weight lives in the token
    // layer; only size is needed to turn an advance ratio into pixels.
    expect(RANK_FONT_SIZE).toStrictEqual({ A: 13, B: 12, C: 11, D: 11, E: 10 })
  })

  it.each([
    ['A', 'B'],
    ['B', 'C'],
    ['C', 'D'],
    ['D', 'E'],
  ] as const satisfies readonly (readonly [TypeRank, TypeRank])[])(
    'rank %s is not smaller than rank %s',
    (larger, smaller) => {
      // ⚠ The ordering is what `research/42-typography.md` had to *resolve*: DESIGN.md's
      // stated ordering and the Nivo-sourced legend default disagreed about where the
      // legend sits. If a later edit reintroduces an inversion, this fails — rather than
      // the disagreement resurfacing as a rendering oddity nobody traces back to a doc.
      expect(RANK_FONT_SIZE[larger]).toBeGreaterThanOrEqual(RANK_FONT_SIZE[smaller])
    },
  )
})
