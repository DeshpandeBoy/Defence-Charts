/**
 * The typography types, in a module that imports nothing.
 *
 * ⚠ **This file exists to break a cycle, and the cycle is worth naming so it is not
 * reintroduced.** `./font-metrics.generated.ts` is a *generated data file* — it needs
 * `FontMetrics` to write `satisfies FontMetrics` at its foot, which is the only thing
 * checking that the generator emitted the shape the resolver reads. `./text.ts` in turn
 * needs the generated table for `DEFAULT_TYPOGRAPHY`. Declaring both types and values in
 * `./text.ts` therefore closed a loop.
 *
 * That loop was **type-only and erased at emit**, so it could have been excused. It was not
 * excused, for two reasons. `no-circular` fired on it, and a gate turned off for the first
 * cycle it catches is decision 015 running backwards. And the erasure is a property of the
 * *current* imports, not of the arrangement: change one `import type` to a value import and
 * a real initialisation cycle appears with the gate already disabled.
 *
 * Splitting the types out costs one file and removes the loop instead of tolerating it. A
 * generated file that depends on nothing but type declarations is also simply the better
 * shape — it can be emitted, checked, and read without pulling in `measureText`.
 *
 * ⚠ `./text.ts` re-exports everything here, so `import type { FontMetrics } from './text.ts'`
 * keeps working. Import from whichever reads better at the call site; they are the same
 * declarations.
 */

/**
 * The five type ranks (`research/42-typography.md` §2.1). A rank pins size, weight and
 * feature settings together — exactly the tuple that determines glyph advances.
 */
export type TypeRank = 'A' | 'B' | 'C' | 'D' | 'E'

/**
 * The fit-sensitive CSS values for one rank. These values travel with the metrics table:
 * replacing either half alone would let the planner and browser disagree about width.
 */
export type FontRankStyle = {
  /** px. */
  readonly fontSize: number
  readonly fontWeight: number
  /** px between adjacent code points. */
  readonly letterSpacing: number
}

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
 * The metrics travel atomically with those rendered values as `PlanPolicy.typography`.
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
    readonly stretch: string
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

/**
 * The complete typography input to a fit-or-collide decision.
 *
 * Atomic on purpose: `PlanPolicy` accepts this object whole, never as a deep partial.
 * `@gx/tokens` generates the corresponding CSS custom properties from the default object,
 * so these six values and the table measured under them have one authored source.
 */
export type FittingTypography = {
  readonly family: string
  readonly featureSettings: string
  readonly stretch: string
  readonly opticalSizing: 'auto' | 'none'
  readonly byRank: Readonly<Record<TypeRank, FontRankStyle>>
  readonly metrics: FontMetrics
}
