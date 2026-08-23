/**
 * Tick label formatting — the one place a value becomes a string.
 *
 * ⚠ **This module exists so that two callers cannot disagree about what a label says.**
 * `describeShape()` (`./data.ts`) reports `labelMaxChars` to the resolver, and
 * `resolveFrame()` (`./frame.ts`) puts the actual glyphs on the axis. If those two formatted
 * differently, the resolver would degrade labels against a width that no rendered label ever
 * has — a chart that lays itself out for text it does not draw. Same failure species as a
 * metrics table generated under the wrong feature settings: an instrument that looks
 * calibrated and is not.
 *
 * So both import from here, and neither formats anything itself.
 *
 * ## Why every time formatter is a UTC formatter
 *
 * ⚠ `d3-time-format`'s `timeFormat()` reads the host timezone. Decision 7 renders a chart on
 * a server and ships the markup to a browser; if the two are in different zones — which for
 * any deployed application they always are — `timeFormat()` produces different strings at
 * each end. That is a hydration mismatch on **every** time axis, arriving as a React warning
 * about text content and not as anything that names a timezone.
 *
 * `utcFormat()` is a pure function of the instant. It cannot vary by host, so the server's
 * markup and the client's expectation are byte-identical by construction rather than by
 * configuration.
 *
 * ⚠ `vitest.config.ts` pins `TZ: 'UTC'` and `packages/testing/src/determinism.test.ts`
 * proves it took — but that pin protects tests, not production. It would make a
 * `timeFormat()` bug invisible in CI and live in every deployment. The pin and this choice
 * are belt and braces for two different failure paths; neither replaces the other.
 */

import { format } from 'd3-format'
import { utcFormat } from 'd3-time-format'

/**
 * The multi-scale time format, in `d3-time-format`'s own documented shape and its UTC
 * variant. Tier **A-impl** — this is d3's example, not ours, and the boundaries between
 * scales are its judgement.
 *
 * Read top to bottom: the first unit the instant is *not* aligned to wins, so an instant on
 * an exact hour formats as an hour and one 30 seconds later formats as a second.
 */
const FORMAT_MILLISECOND = utcFormat('.%L')
const FORMAT_SECOND = utcFormat(':%S')
const FORMAT_MINUTE = utcFormat('%H:%M')
const FORMAT_HOUR = utcFormat('%H:%M')
const FORMAT_DAY = utcFormat('%b %d')
const FORMAT_MONTH = utcFormat('%b')
const FORMAT_YEAR = utcFormat('%Y')

/**
 * ⚠ **`,` and not `~g` or `~r`, because both of those silently round.** d3-format's general
 * and significant-digit specs default to 6 significant digits, so `1234567` formats as
 * `1.23457e+6` under `~g` and as `1234570` under `~r`. The second is the dangerous one: it is
 * a plain-looking integer, it is on an axis, and it is **not the number in the data**. A wrong
 * value that looks right is worse than an ugly one that is right, which is the same standard
 * `./data.ts` applies to `temporal`.
 *
 * Grouping is exact at every magnitude — `1,234,567`, `123,456,789,012`, `0.000123456789` —
 * and it is what d3's own `scale.tickFormat()` emits, so this matches d3-axis rather than
 * departing from it.
 *
 * ⚠ **Grouping widens labels, and that is not the objection it first appears to be.** The
 * concern would be that `degradeXLabels()` reads the width — but it reads it *from this same
 * function*, via `describeShape()`. A wide label truthfully reported as wide degrades a rung
 * early at worst. A wide label reported as narrow collides in production with no test able to
 * see it. Consistency between the two halves is the property that matters, and it holds by
 * construction because there is only one formatter.
 */
const FORMAT_NUMBER = format(',')

/**
 * ⚠ **SI prefixes on the y axis, plain grouping on the x axis, and the asymmetry is earned.**
 *
 * Two reasons, and either alone would be thin:
 *
 * 1. **y tick values are always nice, x endpoint labels are raw data.** `resolveFrame()` calls
 *    `.nice()` on the y scale, so its ticks are round — `2k`, `1.5M`, `500` — and an SI suffix
 *    on a round number is compact and never ragged. The same suffix on an arbitrary datum is
 *    not: `2024` becomes `2.024k`, which is longer than what it replaced and reads worse.
 * 2. **`./layout.ts` already assumes it.** Its `Y_TICK_LABEL_SAMPLE` is `'-1,234.5M'` — a
 *    trailing `M`, which is only there if the author expected SI-suffixed y labels. Formatting
 *    them any other way would make the gutter that sample sizes wrong for the labels that go
 *    in it.
 */
const FORMAT_SI = format('~s')

/**
 * An instant → its axis label, chosen by the finest unit it is aligned to.
 *
 * ⚠ Uses UTC accessors throughout, for the reason in the module docblock. `getMonth()` here
 * instead of `getUTCMonth()` would reintroduce the host dependency this module exists to
 * remove, and would do it silently — the strings look right on the machine you wrote them on.
 */
function formatInstant(date: Date): string {
  if (date.getUTCMilliseconds() !== 0) return FORMAT_MILLISECOND(date)
  if (date.getUTCSeconds() !== 0) return FORMAT_SECOND(date)
  if (date.getUTCMinutes() !== 0) return FORMAT_MINUTE(date)
  if (date.getUTCHours() !== 0) return FORMAT_HOUR(date)
  if (date.getUTCDate() !== 1) return FORMAT_DAY(date)
  if (date.getUTCMonth() !== 0) return FORMAT_MONTH(date)
  return FORMAT_YEAR(date)
}

/**
 * An x value → the string an axis tick would show for it.
 *
 * ⚠ Non-finite input returns the empty string rather than `"NaN"` or `"Invalid Date"`.
 * A transient `0 × 0` measurement is routine (`resolvePlotBox()` says why), and a domain
 * derived from an empty box is degenerate; painting `NaN` on an axis is the loud version of
 * a bug whose quiet version — an empty label — is the correct rendering of "no value here".
 *
 * @param value A `Date` for a temporal axis, a `number` otherwise.
 */
export function formatXLabel(value: number | Date): string {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? formatInstant(value) : ''
  }
  return Number.isFinite(value) ? FORMAT_NUMBER(value) : ''
}

/**
 * A y tick value → its label. SI-suffixed; see `FORMAT_SI` for why this differs from x.
 *
 * ⚠ **Both this and `formatXLabel()` emit `U+2212` MINUS SIGN for negatives, not `U+002D`
 * HYPHEN-MINUS**, because that is d3-format's default locale and `Intl.NumberFormat`'s. It is
 * typographically correct — `U+2212` is designed to align with `+` and `=` where the hyphen is
 * not — and it is not optional short of overriding the locale.
 *
 * `research/41-text-metrics.md` §9 recorded the consequence as an open question: `U+2212` is
 * **not** in the charset `scripts/generate-font-metrics.mjs` measures, so it is absent from
 * `./font-metrics.generated.ts` and every negative label falls through `measureText()`'s
 * unknown-codepoint path.
 *
 * ⚠ **That path is `fallback.latin`, which the generated table documents as *"widest advance
 * in the covered set, at that rank"*. So an unknown glyph is charged the widest advance the
 * face has — an over-estimate, which is the direction §6.1 mandates.** The gap is therefore
 * benign rather than latent: a negative label is predicted slightly too wide and degrades a
 * rung early at worst. Adding `U+2212` to the charset would tighten the estimate and cannot
 * be done here, because §7 keeps font files out of the build and the table is regenerated
 * offline. Recorded as measured, not as unknown.
 */
export function formatYLabel(value: number): string {
  return Number.isFinite(value) ? FORMAT_SI(value) : ''
}
