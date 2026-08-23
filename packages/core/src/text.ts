/**
 * `measureText()` and `FontMetrics` — text width without a DOM.
 *
 * Transcribed from `research/41-text-metrics.md` §5–§6.
 *
 * ⚠ This file is the reason gate **G2** exists. `@gx/core` may not call
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
 */

/**
 * The five type ranks (`research/42-typography.md` §2.1). A rank pins size, weight and
 * feature settings together — exactly the tuple that determines glyph advances.
 */
export type TypeRank = 'A' | 'B' | 'C' | 'D' | 'E'

/**
 * Rank → font size in px (`research/42-typography.md` §4, settled).
 *
 * A 13/700 · B 12/700 · C 11/500 · D 11/400 · E 10/400.
 *
 * ⚠ These are the same numbers `@gx/tokens` emits as `--gx-title-font-size` and friends.
 * At B1 the token generator must emit from this constant rather than restating it:
 * `research/41-text-metrics.md` — *"one authored value, two emitted forms; a consumer
 * cannot move one without the other."* Two hand-maintained copies of a font size is the
 * fit-or-collide bug with extra steps.
 */
export const RANK_FONT_SIZE: Readonly<Record<TypeRank, number>> = Object.freeze({
  A: 13,
  B: 12,
  C: 11,
  D: 11,
  E: 10,
})

/**
 * Per-rank advances, normalised to font size: rendered px = `fontSize × advance`.
 *
 * `advances` is **sparse** — it covers the ~250 code points of
 * `research/41-text-metrics.md` §5.2 (ASCII printable, the Latin-1 letters that appear in
 * ordinary category labels, `$ € £ ¥ ₹ %`, typographic punctuation, and the `↑ ↓ →`
 * arrows the Micro summary phrase needs). Everything else takes the banded fallback.
 *
 * ⚠ The fallback is **banded, not a single number**, because one number cannot serve both
 * Latin and full-width CJK without being wrong for one of them by a factor of two.
 */
export type GlyphAdvances = {
  readonly advances: Readonly<Record<string, number>>
  readonly fallback: {
    readonly latin: number
    /** Full-width; roughly 2× latin. */
    readonly cjk: number
    /** Zero-advance combining marks. */
    readonly combining: number
  }
}

/** All normalised to font size. */
export type VerticalMetrics = {
  readonly ascent: number
  readonly descent: number
  readonly lineGap: number
  readonly capHeight: number
  readonly xHeight: number
}

/**
 * Plain, serialisable, `JSON.stringify`-round-trippable — the same constraint as
 * `ChartPlan`, for the same reason: server and client must provably agree.
 *
 * ⚠ **This is a plan input, not a hidden constant** (`research/41-text-metrics.md`). Six
 * CSS properties change the outcome of a fit-or-collide decision — `font-family`,
 * `font-size`, `font-weight`, `font-feature-settings`, `font-stretch`, `letter-spacing` —
 * so a consumer who overrides `--gx-font-family` with a wider face and cannot also move
 * the metrics would get a planner that says the labels fit while the browser collides
 * them. That is decision 10's failure mode arriving through the other door, which is why
 * `fontMetrics` travels on `PlanPolicy` and reaches the resolver through `<GxConfig>`.
 */
export type FontMetrics = {
  /** Face these advances were measured from. Diagnostics and cache keys only; never parsed. */
  readonly family: string

  /**
   * The exact settings the table was generated under. Must match what the CSS applies.
   *
   * ⚠ The trap this field exists to catch: a table generated WITHOUT `'tnum' 1` describes
   * proportional figures, while CSS applying `font-variant-numeric: tabular-nums` renders
   * tabular ones. Digits are the majority of every axis label, so the two disagree on
   * nearly every measurement that matters — and they disagree quietly.
   */
  readonly generatedWith: {
    readonly featureSettings: string
    readonly variationSettings: string
    readonly opticalSizing: 'auto' | 'none'
  }

  /**
   * Keyed by rank, not by font size, for two independent reasons either of which alone
   * would rule out a single normalised table:
   *
   *   **Optical size.** `font-optical-sizing: auto` makes `opsz` track font size, and
   *   optical sizing at small sizes widens letterforms and loosens spacing. Advances at
   *   10 px are therefore NOT 10/13 of advances at 13 px — a single normalised table is
   *   wrong by construction the moment optical sizing is on.
   *
   *   **Weight.** The scale ships 400, 500 and 700, and `wght` changes advances. A table
   *   describing one weight cannot describe the others.
   *
   * Total over `TypeRank`, so there is no fallback path and no "nearest size" guess.
   */
  readonly byRank: Readonly<Record<TypeRank, GlyphAdvances>>

  /**
   * Multiplier applied to every measurement, to absorb fallback-face drift.
   *
   * ⚠ The library must not ship a multi-hundred-KB variable font, so `--gx-font-family`
   * names the reference face with a system fallback stack — which means **a consumer who
   * does not load the reference face renders in a fallback face against a reference-face
   * table.** The error direction is the whole point: if the actual face is NARROWER than
   * the table, labels fit with slack, which is safe; if WIDER, they collide.
   *
   * Consumers who genuinely load the reference face set this to `1.0`.
   */
  readonly safetyFactor: number

  readonly vertical: VerticalMetrics
}

// --- The provisional table -----------------------------------------------------------

/**
 * ⚠⚠ **UNVERIFIED PLACEHOLDER. This is a typed hole, not a measurement.**
 *
 * The real table cannot be generated yet. `research/41-text-metrics.md` §4.1 and §4.2 name
 * two things that block it, and neither is a documentation gap:
 *
 *   1. Whether the reference face actually ships `tnum` — inspect `GSUB` on the released
 *      variable TTF (`fonttools ttx -t GSUB`). The table must be generated under whatever
 *      is actually applied, so this blocks generation.
 *   2. `safetyFactor`, which must be calibrated by measuring the realistic fallback stack
 *      (SF/`-apple-system`, Segoe UI Variable, Roboto, DejaVu Sans) against the reference
 *      table across the real label character set, then set to the observed maximum ratio.
 *
 * So this ships **zero per-character coverage** and leans entirely on the banded fallback,
 * with `latin` set to ~1 em — an honest upper bound on the widest common Latin glyph
 * (`W`, `M`, `@`), not an average dressed up as one. Every measurement is therefore a
 * genuine over-estimate rather than a fabricated precision, which is the direction §6.1
 * mandates:
 *
 * > Where `measureText()` is inexact, it must err **wide**. A measurement that can
 * > under-report is a collision the test suite cannot see; a measurement that over-reports
 * > is a slightly conservative layout a human can see and file a bug about.
 *
 * ⚠ **What this costs, stated plainly so it is not discovered later:** roughly 1.7× the
 * true width for mixed-case Latin, so the planner will abbreviate and rotate labels
 * noticeably earlier than it should. **Any A3 plan snapshot involving `maxChars` or
 * `axisLabelDegrade` is provisional and must be regenerated when the real table lands.**
 *
 * `safetyFactor` is `1.0` deliberately: the band is already worst-case, and stacking a
 * second conservative factor on top would compound two over-estimates into an unusable one.
 */
export const PROVISIONAL_FONT_METRICS: FontMetrics = Object.freeze({
  family: 'UNVERIFIED — no table generated; see research/41-text-metrics.md §4',
  generatedWith: Object.freeze({
    featureSettings: '',
    variationSettings: '',
    opticalSizing: 'auto',
  }),
  byRank: Object.freeze({
    A: provisionalAdvances(),
    B: provisionalAdvances(),
    C: provisionalAdvances(),
    D: provisionalAdvances(),
    E: provisionalAdvances(),
  }),
  safetyFactor: 1.0,
  vertical: Object.freeze({
    ascent: 0.95,
    descent: 0.25,
    lineGap: 0,
    capHeight: 0.71,
    xHeight: 0.52,
  }),
}) satisfies FontMetrics

function provisionalAdvances(): GlyphAdvances {
  return Object.freeze({
    advances: Object.freeze({}),
    fallback: Object.freeze({ latin: 1.0, cjk: 2.0, combining: 0 }),
  })
}

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
 *   6. Multiply by the rank's font size, then by `safetyFactor`.
 *
 * ⚠ **Kerning and ligatures are ignored, and that is deliberate.** Both normally REDUCE
 * rendered width, so summing bare advances over-estimates — the safe direction. The
 * planner degrades a label slightly earlier than strictly necessary rather than colliding.
 * Any future refinement must preserve that asymmetry; see `PROVISIONAL_FONT_METRICS`.
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
 * @param letterSpacing Additional px per gap. Defaults to `0`.
 */
export function measureText(
  text: string,
  rank: TypeRank,
  metrics: FontMetrics,
  letterSpacing = 0,
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

  const fontSize = RANK_FONT_SIZE[rank]
  const spacing = letterSpacing === 0 ? 0 : letterSpacing * (codePointCount - 1)

  return sum * fontSize * metrics.safetyFactor + spacing
}
