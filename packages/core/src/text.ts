/**
 * `measureText()` and `FontMetrics` — text width without a DOM.
 *
 * Transcribed from `research/41-text-metrics.md` §5–§6.
 *
 * ⚠ This file is the reason gate **G2** exists. `@shiftcharts/core` may not call
 * `getComputedTextLength`, `getBBox`, `getTotalLength` or `getBoundingClientRect`, and
 * the ban is enforced three ways rather than trusted: an ESLint rule, `"types": []` in
 * this package's tsconfig so the DOM lib is not even in scope, and G15's ban on happy-dom.
 * The reason is asymmetric failure — jsdom THROWS on all four, while happy-dom returns
 * `0` for all four, which silently means *"every label fits"*. A label-collision test
 * written against a measuring resolver would pass forever while shipping the bug.
 *
 * So width comes from a character-advance model instead: font size × per-character
 * advances, summed. Pure, deterministic, and identical on a server, in a worker, and in a
 * browser — which is what makes decision 7's server-rendered path provable rather than
 * merely hoped for.
 *
 * ⚠ **The advance table itself is generated, not authored here.** It lives in
 * `./font-metrics.generated.ts`, measured offline from a content-pinned Roboto Flex by
 * `scripts/generate-font-metrics.mjs`. The types both files need sit in a third module,
 * `./text-types.ts`, which imports nothing — see the note there for why that separation is
 * structural rather than tidying.
 */

import { ROBOTO_FLEX_METRICS } from './font-metrics.generated.ts'
import type { FittingTypography, FontMetrics, FontRankStyle, TypeRank } from './text-types.ts'

// The typography types live in `./text-types.ts` — a module that imports nothing, so the
// generated table can `satisfies FontMetrics` without closing a cycle back through this
// file. Re-exported here because this is where a reader looks for them.
export type {
  FittingTypography,
  FontMetrics,
  FontRankStyle,
  GlyphAdvances,
  TypeRank,
  VerticalMetrics,
} from './text-types.ts'

// --- The default table -----------------------------------------------------------------

/**
 * The default fitting typography (`research/42-typography.md` §4).
 *
 * ⚠ **The four `generatedWith` values are read from the metrics table rather than authored
 * here, and that pairing is the point.** `FontMetrics` describes advances *under a specific
 * rendering configuration*; a table measured with one `font-feature-settings` and rendered
 * under another is the failure species this project keeps naming — a thing that looks like
 * it works and quietly doesn't. Reading them through means the CSS cannot drift from the
 * table by editing one of the two, because there is only one of them.
 *
 * ⚠ **`featureSettings` is `'tnum' 1`, and on the reference face that request does
 * nothing.** Roboto Flex ships no `tnum` (its GSUB carries `liga`, `locl`, `pnum`, `rvrn`)
 * — but its *default* figures are already the tabular set, all `1156/2048` em, and `pnum`
 * is the switch **away** from them. So the Tabular Rule holds on Roboto Flex by default,
 * and the declaration is load-bearing for the fallback faces instead: SF ships proportional
 * figures by default and a real `tnum` to fix them. The rule that actually protects this
 * table is the negative one — **never apply `pnum` / `proportional-nums`.**
 */
export const DEFAULT_TYPOGRAPHY: FittingTypography = Object.freeze({
  family: "'Roboto Flex', 'Roboto Flex Fallback', system-ui, sans-serif",
  featureSettings: ROBOTO_FLEX_METRICS.generatedWith.featureSettings,
  stretch: ROBOTO_FLEX_METRICS.generatedWith.stretch,
  opticalSizing: ROBOTO_FLEX_METRICS.generatedWith.opticalSizing,
  byRank: Object.freeze({
    A: Object.freeze({ fontSize: 13, fontWeight: 700, letterSpacing: 0 }),
    B: Object.freeze({ fontSize: 12, fontWeight: 700, letterSpacing: 0 }),
    C: Object.freeze({ fontSize: 11, fontWeight: 500, letterSpacing: 0 }),
    D: Object.freeze({ fontSize: 11, fontWeight: 400, letterSpacing: 0 }),
    E: Object.freeze({ fontSize: 10, fontWeight: 400, letterSpacing: 0 }),
  }),
  metrics: ROBOTO_FLEX_METRICS,
})

/** Rank-size compatibility view, derived rather than separately authored. */
export const RANK_FONT_SIZE: Readonly<Record<TypeRank, number>> = Object.freeze({
  A: DEFAULT_TYPOGRAPHY.byRank.A.fontSize,
  B: DEFAULT_TYPOGRAPHY.byRank.B.fontSize,
  C: DEFAULT_TYPOGRAPHY.byRank.C.fontSize,
  D: DEFAULT_TYPOGRAPHY.byRank.D.fontSize,
  E: DEFAULT_TYPOGRAPHY.byRank.E.fontSize,
})

// --- Measurement ---------------------------------------------------------------------

/** U+0300–U+036F, plus the three later combining blocks that reach Latin text. */
function isCombining(codePoint: number): boolean {
  return (
    (codePoint >= 0x0300 && codePoint <= 0x036f) ||
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
    (codePoint >= 0x20d0 && codePoint <= 0x20f0) ||
    (codePoint >= 0xfe20 && codePoint <= 0xfe2f)
  )
}

/**
 * Full-width and wide ranges: CJK ideographs, kana, Hangul, and the full-width forms
 * block. Deliberately coarse — this is a fallback band, not a shaping engine.
 */
function isWide(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) || // Hangul Jamo
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) || // CJK radicals … Yi
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) || // Hangul syllables
    (codePoint >= 0xf900 && codePoint <= 0xfaff) || // CJK compatibility ideographs
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) || // CJK compatibility forms
    (codePoint >= 0xff00 && codePoint <= 0xff60) || // full-width forms
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd) // CJK extension B and beyond
  )
}

/**
 * Rendered width of `text` in px, at type rank `rank`.
 *
 * Pure, deterministic, identical on server and client. The rules, in order
 * (`research/41-text-metrics.md` §6):
 *
 *   1. No DOM. Enforced by lint and by tsconfig, not by convention.
 *   2. **Iterate by code point**, never by index. UTF-16 indexing double-counts surrogate
 *      pairs, so every emoji and every astral-plane character would measure twice its
 *      width — a silent 2× under-count on width budgets, in the unsafe direction.
 *   3. Select `metrics.byRank[rank]` — total, so no fallback path and no nearest-size guess.
 *   4. Sum advances; unknown code points take the banded fallback.
 *   5. Add `letterSpacing × (codePointCount − 1)` when non-zero.
 *   6. Multiply by the supplied rank style's font size, then by `safetyFactor`.
 *
 * ⚠ **Kerning and ligatures are ignored, and that is deliberate.** Both normally REDUCE
 * rendered width, so summing bare advances over-estimates — the safe direction. The
 * planner degrades a label slightly earlier than strictly necessary rather than colliding.
 * Any future refinement must preserve that asymmetry; see `safetyFactor`.
 *
 * ⚠ Note step 5's `− 1`: letter-spacing applies BETWEEN characters, so an n-character
 * string has n−1 gaps. Browsers actually add a trailing gap after the final character too,
 * which means our figure is one gap NARROWER than the rendered box — the unsafe direction,
 * but bounded by a single `letterSpacing` and absorbed by `safetyFactor`. Following the
 * spec as written rather than silently improving on it; raised in `./text.test.ts`.
 *
 * ⚠ **One deliberate departure from the literal rule order.** Read as a sequence, rule 5's
 * addition happens before rule 6's multiplication, which would scale `letterSpacing` by
 * font size and by `safetyFactor`. That is dimensionally wrong: advances are ratios
 * awaiting a font size, whereas `letterSpacing` is already px. And `safetyFactor` exists
 * to absorb *glyph* drift between the reference face and a fallback — letter-spacing is a
 * CSS length that does not change with the face, so it has no drift to absorb. So the
 * arithmetic here is `sum × fontSize × safetyFactor + spacing`.
 * `research/41-text-metrics.md` §6 carries the same note.
 *
 * @param text The string to measure.
 * @param rank Type rank, which pins font size, weight and feature settings together.
 * @param metrics The plan-input metrics table.
 * @param style Optional plan-input font size and letter spacing for this rank. Missing fields
 *   default to the released typography scale, preserving the standalone convenience API.
 */
export function measureText(
  text: string,
  rank: TypeRank,
  metrics: FontMetrics,
  style: Partial<Pick<FontRankStyle, 'fontSize' | 'letterSpacing'>> = {},
): number {
  if (text === '') return 0

  const table = metrics.byRank[rank]
  const { advances, fallback } = table

  let sum = 0
  let codePointCount = 0

  // ⚠ `for…of` over a string iterates code points, not UTF-16 units. This is rule 2 and
  // it is the whole reason the loop is not a plain `for (let i = 0; ...)`.
  for (const ch of text) {
    codePointCount += 1

    const known = advances[ch]
    if (known !== undefined) {
      sum += known
      continue
    }

    const codePoint = ch.codePointAt(0)
    if (codePoint === undefined) continue
    if (isCombining(codePoint)) sum += fallback.combining
    else if (isWide(codePoint)) sum += fallback.cjk
    else sum += fallback.latin
  }

  const defaultStyle = DEFAULT_TYPOGRAPHY.byRank[rank]
  const fontSize = style.fontSize ?? defaultStyle.fontSize
  const letterSpacing = style.letterSpacing ?? defaultStyle.letterSpacing
  const spacing = letterSpacing === 0 ? 0 : letterSpacing * (codePointCount - 1)

  return sum * fontSize * metrics.safetyFactor + spacing
}
