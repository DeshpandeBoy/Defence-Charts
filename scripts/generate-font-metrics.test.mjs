/**
 * The generated `FontMetrics` table, asserted as **observable properties** rather than
 * trusted from its own docblock.
 *
 * ⚠ `research/43-theming.md` §6.3: *"a gate never observed to fail is not a gate — it is a
 * job that exits 0."* The obvious test here — "does the committed file match a fresh
 * run?" — cannot run in CI, because a fresh run needs a 1.7 MB font that
 * `research/41-text-metrics.md` §7 forbids vendoring or fetching at build time. So these
 * tests check the things that would actually break if the table were regenerated wrongly,
 * and they check them without a font:
 *
 *   - **The Tabular Rule, as arithmetic.** Roboto Flex has no `tnum`; its digits are
 *     tabular by default and its `pnum` feature is the switch AWAY from that. A
 *     regeneration under `pnum` would produce ten different digit widths and every other
 *     assertion in the suite would still pass. This one would not.
 *   - **The banded fallback really is a band.** `fallback.latin` is only safe if it is at
 *     least the widest advance the table itself carries.
 *   - **Serialisability.** `FontMetrics` travels in `PlanPolicy`, and `ChartPlan`'s
 *     round-trip constraint applies for the same reason: server and client must provably
 *     agree.
 */

import { describe, expect, it } from 'vitest'

import { ROBOTO_FLEX_METRICS } from '../packages/core/src/font-metrics.generated.ts'
import { measureText } from '../packages/core/src/text.ts'

/** @type {ReadonlyArray<'A' | 'B' | 'C' | 'D' | 'E'>} */
const RANKS = ['A', 'B', 'C', 'D', 'E']

const DIGITS = [...'0123456789']

/** `research/41-text-metrics.md` §5.2 — the arrows the Micro summary phrase needs. */
const ARROWS = ['↑', '↓', '→']

describe('the generated Roboto Flex table', () => {
  it('is total over the five ranks', () => {
    expect(Object.keys(ROBOTO_FLEX_METRICS.byRank).sort()).toEqual([...RANKS])
  })

  it('names the face it was measured from, not a placeholder', () => {
    expect(ROBOTO_FLEX_METRICS.family).toBe('Roboto Flex')
    expect(ROBOTO_FLEX_METRICS.family).not.toMatch(/UNVERIFIED/)
  })

  it('round-trips through JSON unchanged', () => {
    const copy = JSON.parse(JSON.stringify(ROBOTO_FLEX_METRICS))
    expect(copy).toEqual(ROBOTO_FLEX_METRICS)
  })

  it('holds no NaN, no Infinity, no undefined', () => {
    const seen = []
    const walk = (/** @type {unknown} */ value) => {
      if (typeof value === 'number') {
        seen.push(value)
        expect(Number.isFinite(value)).toBe(true)
        return
      }
      if (value !== null && typeof value === 'object') {
        for (const inner of Object.values(value)) walk(inner)
      } else {
        expect(value).not.toBeUndefined()
      }
    }
    walk(ROBOTO_FLEX_METRICS)
    expect(seen.length).toBeGreaterThan(800)
  })
})

describe('the Tabular Rule, as an observable property', () => {
  /**
   * ⚠ This is the assertion that catches a regeneration under `pnum`.
   *
   * `DESIGN.md:127` requires tabular figures. Roboto Flex satisfies it by having no `tnum`
   * at all and shipping tabular digits as the default — `pnum` substitutes
   * `uni0030 → uni0030.prop` and is the setting that breaks the table. Ten equal digit
   * advances is what "satisfied" looks like from outside the font.
   */
  it.each(RANKS)('gives every digit the same advance at rank %s', (rank) => {
    const advances = ROBOTO_FLEX_METRICS.byRank[rank].advances
    const widths = new Set(DIGITS.map((d) => advances[d]))
    expect([...widths]).toHaveLength(1)
    expect([...widths][0]).toBeGreaterThan(0)
  })

  it('records the feature settings the CSS must apply', () => {
    expect(ROBOTO_FLEX_METRICS.generatedWith.featureSettings).toBe("'tnum' 1")
    // ⚠ The load-bearing rule is the negative one, so it is spelled out here too.
    expect(ROBOTO_FLEX_METRICS.generatedWith.featureSettings).not.toMatch(/pnum|proportional/)
  })
})

describe('coverage', () => {
  it.each(RANKS)('covers ASCII printable at rank %s', (rank) => {
    const advances = ROBOTO_FLEX_METRICS.byRank[rank].advances
    for (let cp = 0x20; cp <= 0x7e; cp += 1) {
      expect(advances[String.fromCodePoint(cp)]).toBeTypeOf('number')
    }
  })

  it.each(RANKS)('covers the three summary-phrase arrows at rank %s', (rank) => {
    const advances = ROBOTO_FLEX_METRICS.byRank[rank].advances
    for (const arrow of ARROWS) expect(advances[arrow]).toBeGreaterThan(0)
  })

  it('keys the table by single code points', () => {
    // `measureText()` iterates code points and looks each one up directly. A two-character
    // key would be dead weight that never matches, and would do it silently.
    for (const rank of RANKS) {
      for (const key of Object.keys(ROBOTO_FLEX_METRICS.byRank[rank].advances)) {
        expect([...key]).toHaveLength(1)
      }
    }
  })
})

describe('the fallback band', () => {
  it.each(RANKS)('is at least as wide as every advance it backs, at rank %s', (rank) => {
    const { advances, fallback } = ROBOTO_FLEX_METRICS.byRank[rank]
    const widest = Math.max(...Object.values(advances))
    // ⚠ A band narrower than the table it backs is an under-estimate for every unknown
    // code point, and §6.1 forbids under-estimates in any amount.
    expect(fallback.latin).toBeGreaterThanOrEqual(widest)
    expect(fallback.cjk).toBeGreaterThanOrEqual(fallback.latin)
    // Absence is a zero here by measurement, not by omission: the marks are GDEF class 3.
    expect(fallback.combining).toBe(0)
  })
})

describe('safetyFactor', () => {
  it('over-estimates, because the error direction is the whole point', () => {
    // §4.2: narrower-than-the-table is safe, wider collides. A factor below 1 would mean
    // the table under-states a fallback face by construction.
    expect(ROBOTO_FLEX_METRICS.safetyFactor).toBeGreaterThan(1)
    expect(ROBOTO_FLEX_METRICS.safetyFactor).toBe(1.57)
  })
})

describe('vertical metrics', () => {
  it('are positive ratios of the font size, with lineGap absent as a zero', () => {
    const v = ROBOTO_FLEX_METRICS.vertical
    expect(v.ascent).toBeGreaterThan(0)
    expect(v.descent).toBeGreaterThan(0)
    expect(v.lineGap).toBe(0)
    expect(v.xHeight).toBeLessThan(v.capHeight)
    expect(v.capHeight).toBeLessThan(v.ascent)
    expect(v.ascent + v.descent).toBeGreaterThan(1)
  })
})

describe('measureText against the real table', () => {
  it('measures a tick label far tighter than the provisional 1 em band', () => {
    // The provisional table charged 1 em per character. Four characters at rank D would
    // have been 44 px; the real table plus safetyFactor lands well under that, which is
    // the whole point of doing the measurement.
    const measured = measureText('2024', 'D', ROBOTO_FLEX_METRICS)
    expect(measured).toBeLessThan(4 * 11)
    expect(measured).toBeGreaterThan(0)
  })

  it('charges the same width for every four-digit year', () => {
    const a = measureText('1999', 'D', ROBOTO_FLEX_METRICS)
    const b = measureText('2024', 'D', ROBOTO_FLEX_METRICS)
    expect(a).toBe(b)
  })

  it('still over-estimates an unknown code point, via the band', () => {
    const known = measureText('W', 'D', ROBOTO_FLEX_METRICS)
    // U+2202 PARTIAL DIFFERENTIAL is outside §5.2's covered set.
    const banded = measureText('∂', 'D', ROBOTO_FLEX_METRICS)
    expect(banded).toBeGreaterThanOrEqual(known)
  })
})
