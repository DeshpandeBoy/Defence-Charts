/**
 * `formatXLabel()` — the one place a value becomes a string.
 *
 * ⚠ **The load-bearing test in this file is the timezone one**, and it is deliberately not a
 * test that `TZ=UTC` took. `packages/testing/src/determinism.test.ts` asserts the pin already,
 * and under the pin a `timeFormat()` bug is *invisible* — CI is green and every deployment is
 * broken. What is asserted here is the stronger property the pin cannot check: that the output
 * is a function of the instant rather than of the host, so a server in one zone and a browser
 * in another emit byte-identical markup.
 *
 * The failure that guards against arrives as a React hydration warning about text content,
 * six frames from the chart, never mentioning a timezone.
 */

import { describe, expect, it } from 'vitest'

import { formatXLabel, formatYLabel } from './format.ts'

describe('the time ladder', () => {
  /**
   * d3-time-format's own multi-scale example, in its UTC variant. Tier **A-impl** — the
   * boundaries between scales are d3's judgement, not ours. Read as: the first unit the
   * instant is *not* aligned to wins.
   */
  it.each([
    ['start of a year', Date.UTC(2024, 0, 1), '2024'],
    ['start of a month', Date.UTC(2024, 5, 1), 'Jun'],
    ['a day', Date.UTC(2024, 5, 14), 'Jun 14'],
    ['an hour', Date.UTC(2024, 5, 14, 9), '09:00'],
    ['a minute', Date.UTC(2024, 5, 14, 9, 30), '09:30'],
    ['a second', Date.UTC(2024, 5, 14, 9, 30, 15), ':15'],
    ['a millisecond', Date.UTC(2024, 5, 14, 9, 30, 15, 250), '.250'],
  ])('%s → %s', (_name, ms, expected) => {
    expect(formatXLabel(new Date(ms))).toBe(expected)
  })
})

describe('timezone independence', () => {
  /**
   * ⚠ Every one of these instants is on a different *local* date in some inhabited zone. A
   * `timeFormat()` implementation passes the ladder tests above on a UTC machine and fails
   * these the moment `TZ` moves — which is why they are stated as instants rather than as
   * local wall-clock times.
   */
  it('reads midnight UTC as the start of that day everywhere', () => {
    // 2024-01-01T00:00:00Z is 2023-12-31 across the Americas. A local formatter would say
    // "Dec 31" west of Greenwich and "2024" east of it, from the same input.
    expect(formatXLabel(new Date('2024-01-01T00:00:00Z'))).toBe('2024')
    // 23:00Z on the 30th is already the 1st in Tokyo.
    expect(formatXLabel(new Date('2024-06-30T23:00:00Z'))).toBe('23:00')
  })

  /**
   * ⚠ **`process` is reached through `globalThis` with a local structural type, rather than by
   * installing `@types/node`.** `packages/core/tsconfig.json` sets `"types": []` and its
   * docblock calls that gate **G2** at the type level — the resolver must not be able to *name*
   * a host global, let alone call one. Adding Node types to make one test compile would delete
   * that guarantee for the whole package, and a test is not worth a gate. The narrow cast keeps
   * the escape hatch visible and confined to four lines.
   */
  it('does not vary with the process timezone', () => {
    const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
      ?.env
    if (env === undefined) return

    const instant = new Date('2024-03-15T04:00:00Z')
    const before = formatXLabel(instant)
    const previous = env['TZ']
    try {
      // Assigning `process.env.TZ` in Node invalidates V8's date-time cache, so subsequent
      // local-time formatting really does move. That is what makes this a regression guard
      // against `timeFormat()` rather than a restatement of vitest's `TZ: 'UTC'` pin — under
      // the pin alone, a local formatter passes every other test in this file.
      env['TZ'] = 'America/Los_Angeles'
      expect(new Date(instant).getHours()).not.toBe(instant.getUTCHours())
      expect(formatXLabel(instant)).toBe(before)

      env['TZ'] = 'Asia/Tokyo'
      expect(formatXLabel(instant)).toBe(before)
    } finally {
      env['TZ'] = previous
    }
  })
})

describe('numbers on the x axis', () => {
  /**
   * ⚠ **Grouping, because `~g` and `~r` both silently round to 6 significant digits.** `~r`
   * turns `1234567` into `1234570` — a plain-looking integer, on an axis, that is not the
   * number in the data. `~g` turns it into `1.23457e+6`, which is at least visibly odd. Both
   * are wrong; only one of them announces it.
   */
  it.each([
    [0, '0'],
    [1, '1'],
    [1.5, '1.5'],
    [999, '999'],
    [1000, '1,000'],
    [2024, '2,024'],
    [1_000_000, '1,000,000'],
  ])('%s → %s', (value, expected) => {
    expect(formatXLabel(value)).toBe(expected)
  })

  it('is exact at magnitudes where the significant-digit specs round', () => {
    expect(formatXLabel(1234567)).toBe('1,234,567')
    expect(formatXLabel(123456789012)).toBe('123,456,789,012')
    expect(formatXLabel(0.000123456789)).toBe('0.000123456789')
  })

  it('never emits an exponent for a plausible axis value', () => {
    for (const v of [1e6, 2.5e9, 1e-6]) expect(formatXLabel(v)).not.toContain('e')
  })
})

describe('numbers on the y axis', () => {
  /**
   * ⚠ SI prefixes here and not on x, for two reasons that hold together: y ticks come off a
   * `.nice()`d scale so they are always round, and `layout.ts`'s `Y_TICK_LABEL_SAMPLE` is
   * `'-1,234.5M'` — a trailing `M` that is only there if SI-suffixed y labels were expected.
   */
  it.each([
    [0, '0'],
    [500, '500'],
    [1000, '1k'],
    [1500, '1.5k'],
    [1_000_000, '1M'],
    [2.5e9, '2.5G'],
  ])('%s → %s', (value, expected) => {
    expect(formatYLabel(value)).toBe(expected)
  })

  it('stays short for every tick a niced scale produces', () => {
    const niced = [0, 250_000, 500_000, 750_000, 1_000_000]
    for (const v of niced) expect(formatYLabel(v).length).toBeLessThanOrEqual(4)
  })
})

describe('the minus sign', () => {
  /**
   * ⚠ **`U+2212` MINUS SIGN, not `U+002D` HYPHEN-MINUS** — d3-format's default locale, and
   * `Intl.NumberFormat`'s. Typographically correct, and not optional short of overriding the
   * locale. `research/41-text-metrics.md` §9 recorded this as an open question because
   * `U+2212` is absent from the charset `scripts/generate-font-metrics.mjs` measures.
   *
   * This asserts the character so the assumption is pinned rather than discovered again, and
   * `format.ts` records why the charset gap is benign: an unknown codepoint takes
   * `fallback.latin`, documented as the *widest* advance in the covered set, so a negative
   * label is predicted too wide — §6.1's recoverable direction.
   */
  it('is U+2212 on both axes', () => {
    expect(formatXLabel(-42)).toBe('−42')
    expect(formatYLabel(-1500)).toBe('−1.5k')
    expect(formatXLabel(-42).codePointAt(0)).toBe(0x2212)
    expect(formatXLabel(-42)).not.toContain('-')
  })
})

describe('non-finite input', () => {
  /**
   * ⚠ Empty string, not `"NaN"` or `"Invalid Date"`. A transient `0 × 0` measurement is
   * routine, and a domain derived from an empty box is degenerate; painting `NaN` on an axis
   * is the loud version of a bug whose quiet version — an empty label — is the correct
   * rendering of "no value here".
   */
  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ])('%s → the empty string', (_name, value) => {
    expect(formatXLabel(value)).toBe('')
    expect(formatYLabel(value)).toBe('')
  })

  it('returns the empty string for an invalid Date', () => {
    expect(formatXLabel(new Date('not a date'))).toBe('')
  })
})

describe('purity', () => {
  it('is a function of its argument alone', () => {
    const instant = new Date('2024-07-04T12:34:56.789Z')
    expect(formatXLabel(instant)).toBe(formatXLabel(instant))
    expect(formatXLabel(new Date(instant.getTime()))).toBe(formatXLabel(instant))
  })
})
