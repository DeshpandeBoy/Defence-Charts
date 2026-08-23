# Text measurement — `FontMetrics` as a plan input

> Closes the gap at `30-implementation-plan.md:37` (A2 requires a character-advance model) and the
> unresolved typeface at `DESIGN.md:125`.
>
> ⚠ This document turned out to be a **correction**, not an addition. The token-split table at
> `20-architecture.md:127` classes `font family` as presentation-only and *"Never"* allowed to feed
> `planChart()`. That is wrong, and §2 below shows the class of tokens affected is larger than
> `font-family` alone.

---

## 1. Why this is a correctness bug and not a convenience

Decision 10 forbids DOM measurement in the resolver. `planChart()` may not call
`getComputedTextLength`, `getBBox`, `getTotalLength`, or `getBoundingClientRect` — jsdom throws on
all four and happy-dom returns `0`, which silently means *"every label fits"* and would let broken
collision layouts pass tests forever. That is why happy-dom is banned outright.

So label width comes from a character-advance table. Fine. But then:

> A consumer overrides `--gx-font-family` with a wider face. Rendered text gets wider. The planner
> keeps using its built-in table, concludes the labels fit, and emits `axes.x.ticks.count: 8`.
> The browser collides them.

The plan is not merely suboptimal — **it is false**, and nothing in the system can detect it. The
snapshot tests pass (the plan is what the resolver intended), the type checks pass, the axe run
passes. The failure is visible only to a human looking at the chart in the one configuration nobody
tested.

This is the exact failure mode decision 10 exists to prevent, arriving through the other door.

---

## 2. The real split is per *consequence*, not per token name

`20-architecture.md` §3.2 splits tokens into **presentation** (CSS custom properties, never feed the
resolver) and **plan-input** (typed values via `<GxConfig>`). The split is right. The *assignment* is
wrong, because it was made by asking "is this a visual property?" rather than the question that
actually matters:

> **Does this token's value change the outcome of a fit-or-collide decision?**

Everything that does must be a plan input. Auditing the token tree against that question:

| Token | Changes measured text width? | Correct class |
|---|---|---|
| `--gx-font-family` | **Yes** — different advances entirely | **plan input** |
| `--gx-*-font-size` | **Yes** — width scales with it | **plan input** |
| `--gx-*-font-weight` (`wght`) | **Yes** — heavier weights have wider advances | **plan input** |
| `font-feature-settings` (`tnum`) | **Yes** — tabular figures are wider than proportional `1` | **plan input** |
| `font-stretch` / `wdth` | **Yes**, by definition | **plan input** |
| `letter-spacing`, `word-spacing` | **Yes** — additive per character | **plan input** |
| `--gx-*-color`, opacity | No | presentation |
| mark stroke width, point radius | No (not text) | presentation |
| transition duration, easing | No | presentation |
| **`GRAD`** | **No** — see §3 | **presentation** |

⚠ **`font-feature-settings` is the sharpest of these, and it fails in the *unsafe* direction.** With
proportional figures `1` is narrower than `0`; with `tnum` every digit takes the widest digit's
advance. A table generated without `tnum`, rendered with `tnum` on, under-predicts the width of every
numeric axis label in the library. Under-prediction is collision. The table must be generated with
**exactly** the feature settings the CSS applies, and that pairing must be verified, not assumed.

⚠ **This narrows a product claim, and `PRODUCT.md` should say so.** `PRODUCT.md:28` promises *"any
single widget can be restyled from a stylesheet with no JS and no re-render."* That survives intact
for colour, stroke, gap, opacity, motion, and grade — which is nearly the whole visual surface. It
does **not** survive for the six measured-text tokens above. Discovering that at A4 would be much
worse than writing it down now.

### 2.1 The mechanism that avoids two sources of truth

The obvious fix — "make them plan inputs" — leaves a CSS custom property and a typed value that must
agree, which is a bug waiting for its first consumer.

**Instead: the typed token objects are the single source of truth, and the CSS custom properties for
these six tokens are *generated from them* by `@gx/tokens`.** One authored value, two emitted forms.
A consumer who sets them through `<GxConfig>` updates both; a consumer who overrides the generated
CSS variable directly has taken the documented footgun, and the docs must name it as such rather than
leaving it to be discovered.

**Amendment required** to the `20-architecture.md` §3.2 table: replace the `font family` cell in the
Presentation row, add the six tokens above to the Plan-input row, and state the generated-CSS
mechanism. Note the table's existing Plan-input examples (`tick-target-spacing`,
`plot-height-saturation`, `categories-max-radial`, `aggregate-after`, minimum cell size) are all
**thresholds**; these are the first plan inputs that are also *rendered*, which is why the original
assignment went wrong.

---

## 3. `GRAD` — verified, and architecturally load-bearing

**Verified** against the Google Fonts axis registry (primary source, `google/fonts`
`axisregistry/.../grade.textproto`):

| | |
|---|---|
| Tag | `GRAD` |
| Registry range | min −1000 · default 0 · max 1000 · precision 0 |
| Fallback | "Normal" at 0 |
| Description | lets you *"Finesse the style from lighter to bolder in typographic color, without"* … any *"changes overall width, line breaks or page layout"* |
| Units | *"The units are the same as in the Weight axis."* |

**This is the only axis that changes apparent stroke weight without invalidating the advance table.**
`wght` reflows; `GRAD` does not. Two consequences, both real:

1. `DESIGN.md:175` — *"Stroke weights **increase** as size decreases"* — has a type analogue: small
   labels should thicken rather than merely shrink. Doing that with `wght` would mean regenerating
   advances per weight per size. Doing it with `GRAD` costs nothing, because advances are invariant.
   **`GRAD` is the correct mechanism, and it stays a presentation token.**

2. ⚠ **The landmark-emphasis token should use `GRAD`, not `font-weight`.** `raw/06:1712` specifies
   `--gx-label-landmark-weight: 600` (A-impl, Carbon) — bumping `wght` from 400 to 600 on the *first
   and last* axis labels. Those are exactly the labels at the ends of the axis, where the collision
   budget is tightest, and a `wght` bump silently widens them past what the table predicted.
   Re-specifying the emphasis as a grade offset preserves the table. **Settled in `42-typography.md`
   §3–§3.1: the token is `--gx-label-landmark-grade: 150`, and that name supersedes both
   `--gx-label-landmark-weight` and `--gx-axis-label-landmark-weight` at all four occurrences.**

⚠ Carbon's shipped value is a `font-weight`, so re-specifying it as `GRAD` is a **deliberate
divergence** and the token drops from **A-impl to B** — same §6.2 pattern as the Spectrum stroke-weight
divergence. It is not a free swap: it inherits `DESIGN.md`'s requirement of a variable face with a
real `GRAD` axis, and degrades to *no emphasis at all* (not to a `wght` bump) when the face lacks one.
A static fallback face therefore renders landmark labels unemphasised, which is a graceful loss.

---

## 4. The reference typeface: **Roboto Flex**

`DESIGN.md:125` states the requirement without naming a face: *"a variable grotesque with true
tabular figures and a genuine optical-size axis… `font-optical-sizing: auto` is expected to be on
globally so that small labels thicken correctly rather than being scaled-down large type."*

Two candidates were checked against Google Fonts `METADATA.pb` — plain text, machine-readable,
primary source. (An earlier attempt via the Inter README and the Google Fonts specimen page failed:
the README is prose with no axis tags, and the specimen page is a JS-rendered SPA that returns only
its title.)

| | **Roboto Flex** | **Inter** |
|---|---|---|
| `opsz` | **8.0 – 144.0** | **14.0 – 32.0** |
| `wght` | 100 – 1000 | 100 – 900 |
| `GRAD` | −200 → 150 | **absent** |
| Total axes | 13 (`wdth` 25–151, XOPQ, XTRA, YOPQ, YTAS, YTDE, YTFI, YTLC, YTUC, slnt) | 2 |
| Licence | OFL | OFL |

**Decided: Roboto Flex**, on two independent grounds.

1. **`opsz` range.** Our label default is 11 px with a 10 px floor (`raw/06:1700`, `:1701`).
   **Inter's optical range bottoms out at 14** — the entire small end of our type scale sits below it,
   where `font-optical-sizing: auto` clamps and does nothing. That is precisely the range
   `DESIGN.md:125` cares about, so Inter fails the requirement exactly where it was written to apply.

2. **`GRAD`.** Inter has no grade axis, so §3's mechanism is unavailable and landmark emphasis would
   have to go through `wght` and invalidate the table.

Sources: `raw.githubusercontent.com/google/fonts/main/ofl/robotoflex/METADATA.pb` and
`.../ofl/inter/METADATA.pb`.

### 4.1 ⚠ UNVERIFIED — tabular figures

`DESIGN.md:125` requires *"true tabular figures"* and `:127` makes it a rule. **Roboto Flex's `tnum`
support is not verified.** The Roboto Flex README was fetched and mentions no OpenType features at
all — not `tnum`, not tabular figures, nothing. `METADATA.pb` lists axes, not features.

Do not assert it. **Resolution path, before A2 ships a metrics table:** run
`fonttools ttx -t GSUB RobotoFlex[...].ttf` on the released variable font and grep the feature list
for `tnum`. If absent, either the Tabular Rule is satisfied another way (a `wdth`-locked digit set,
or a second face for figures) or the rule needs restating — but the table must be generated with
whatever is actually applied (§2), so this blocks generation, not merely documentation.

### 4.2 ⚠ The library must not ship the font — and that is a real problem

Bundling a multi-hundred-KB variable font in a chart library is hostile, so `--gx-font-family` will
name Roboto Flex with a system fallback stack. **A consumer who does not load Roboto Flex renders in
a fallback face against a Roboto Flex table.**

The error direction is what matters. If the actual face is *narrower* than the table, labels fit with
slack — safe. If *wider*, they collide — unsafe. So the shipped default cannot be a bare
reference-face table.

`FontMetrics` therefore carries an explicit `safetyFactor`, and **its value is UNVERIFIED.** It must
be calibrated at A2 by measuring the realistic fallback stack (SF/`-apple-system`, Segoe UI Variable,
Roboto, DejaVu Sans) against the Roboto Flex table across the actual label character set, and set to
the observed maximum ratio. Consumers who genuinely load the reference face set it to `1.0`. Picking
a number here without doing that measurement would be inventing exactly the kind of default this
corpus labels Tier C and then regrets.

---

## 5. The `FontMetrics` type

Plain, serialisable, `JSON.stringify`-round-trippable — same constraint as `ChartPlan`
(`40-chart-plan.md` §1.4), for the same reason: server and client must provably agree.

```ts
type FontMetrics = {
  /** Face these advances were measured from. Diagnostics and cache keys only; never parsed. */
  readonly family: string;

  /** Exact settings the table was generated under. Must match what the CSS applies (§2). */
  readonly generatedWith: {
    readonly featureSettings: string;        // e.g. "'tnum' 1"
    readonly variationSettings: string;      // e.g. "'wdth' 100"
    readonly opticalSizing: 'auto' | 'none';
  };

  /**
   * Advances normalised to font size: rendered px = fontSize * advance.
   * Keyed by type rank, not by font size — a rank pins size + weight + features together,
   * and that tuple is exactly what determines advances. See §5.1.
   */
  readonly byRank: Readonly<Record<TypeRank, GlyphAdvances>>;   // 'A'|'B'|'C'|'D'|'E'

  /** Multiplier applied to every measurement to absorb fallback-face drift. §4.2. */
  readonly safetyFactor: number;

  readonly vertical: VerticalMetrics;
};

type GlyphAdvances = {
  /** Single code point → advance / fontSize. Sparse: covers §5.2's character set only. */
  readonly advances: Readonly<Record<string, number>>;
  /** Used for code points absent from `advances`. Banded, because one number cannot serve both. */
  readonly fallback: {
    readonly latin: number;
    readonly cjk: number;         // full-width, ~2x latin
    readonly combining: number;   // 0 — zero-advance marks
  };
};

type VerticalMetrics = {
  readonly ascent: number;      // all normalised to font size
  readonly descent: number;
  readonly lineGap: number;
  readonly capHeight: number;
  readonly xHeight: number;
};
```

### 5.1 ⚠ Why the table is keyed by rank

Two independent reasons, either of which alone would rule out a single normalised table.

**Optical size.** `font-optical-sizing: auto` — required by `DESIGN.md:125` — makes `opsz` track font
size automatically, and optical sizing at small sizes typically widens letterforms and loosens
spacing. **Advances at 10 px are therefore not 10/13 of advances at 13 px.** A single normalised table
is wrong by construction the moment optical sizing is on.

**Weight.** `42-typography.md` §2.1 ships text at weights 400, 500 and 700, and `wght` changes
advances (§3). A table describing one weight cannot describe the others.

Rank pins size, weight, and feature settings together — exactly the tuple that determines advances —
so keying by rank covers both, makes an unmeasurable combination unrepresentable, and needs no
"nearest size" fallback. Five entries, one per rank.

⚠ **Ordering dependency: `42-typography.md` must settle the rank sizes and weights before the default
table can be generated.** That is not a blocker for A1, but it is a blocker for A2. (Settled: A 13/700,
B 12/700, C 11/500, D 11/400, E 10/400.)

⚠ **The magnitude of the opsz spread is UNVERIFIED.** It may be 1% or it may be 8%. The generation
script (§6) must *report* the maximum spread across ranks, so we learn empirically whether the
per-rank keying was necessary on optical grounds as well as weight grounds. If it turns out negligible
the type can collapse later; guessing it away now would be unfalsifiable.

### 5.2 Character coverage

The table is sparse. Covered:

- ASCII printable `U+0020`–`U+007E`
- Latin-1 letters that appear in ordinary category labels
- Currency `$ € £ ¥ ₹` and `%`
- Typographic punctuation `– — ‘ ’ “ ” … ·`
- ⚠ The arrows used by the Micro summary phrase — `10-responsive-ladder.md` §4 gives the literal
  example *"↑ 12% this week"*

Roughly 250 code points, ~4 KB of JSON per size entry. Everything else falls to the banded fallback.

⚠ **UNVERIFIED: arrow coverage.** If Roboto Flex has no `↑`/`↓` glyph, the browser silently
substitutes another font for that character and its advance is not the one in our table. Since the
arrow leads the string, a wrong advance shifts the whole phrase. Verify glyph coverage for `↑ ↓ →`
alongside the `tnum` check in §4.1; if absent, the summary phrase uses a drawn SVG mark rather than a
character, which is arguably better anyway — `DESIGN.md` treats direction as signal.

---

## 6. `measureText()`

```ts
function measureText(
  text: string,
  rank: TypeRank,            // 'A' | 'B' | 'C' | 'D' | 'E' — see 42-typography.md §2.1
  metrics: FontMetrics,
  letterSpacing?: number,    // px; default 0
): number;
```

Pure, deterministic, identical on server and client. Rules:

1. **No DOM.** `getComputedTextLength`, `getBBox`, `getTotalLength`, `getBoundingClientRect` are
   forbidden — enforced by lint, not convention (decision 10). The `@gx/core`-imports-no-React CI
   rule at `20-architecture.md:308` is the natural home for a companion no-DOM rule.
2. **Iterate by code point**, via `Array.from(text)` or a `for…of` loop — never by index. UTF-16
   indexing double-counts surrogate pairs, so every emoji and every astral-plane character would
   measure twice its width.
3. Select `metrics.byRank[rank]` — total, so there is no fallback path and no "nearest size" guess.
4. Sum advances; unknown code points take the banded fallback.
5. Add `letterSpacing × (codePointCount − 1)` when non-zero.
6. Multiply by the rank's font size, then by `safetyFactor`.

⚠ Rules 5 and 6 are stated in the order a reader expects, not the order the arithmetic takes. Applied
literally as a sequence, rule 6 would scale `letterSpacing` by font size and by `safetyFactor`, and
both are wrong: advances are ratios *awaiting* a font size whereas `letterSpacing` is already px, and
`safetyFactor` exists to absorb **glyph** drift between the reference face and a fallback — a CSS
length does not drift with the face. The implementation is therefore
`sum × fontSize × safetyFactor + spacing`. `packages/core/src/text.ts` carries the same note, and
`text.test.ts` pins the distinction so a later "tidy-up" cannot fold the spacing back inside.

⚠ Rule 5's `− 1` is followed as written, and it under-reports by one gap: browsers add a trailing gap
after the final character too. That is the *unsafe* direction per §6.1, but it is bounded by a single
`letterSpacing` and absorbed by `safetyFactor`. Recorded rather than silently corrected, because the
correction would need to come with evidence about how the rendered box is actually measured at the
call sites that matter.

### 6.1 What it deliberately gets wrong, and in which direction

**Kerning and ligatures are ignored.** Both normally *reduce* rendered width, so summing bare advances
**over-estimates**. That is the safe direction: the planner degrades a label slightly earlier than
strictly necessary rather than colliding.

**This asymmetry is a design rule, not an excuse.** Any future refinement to `measureText()` must
preserve it:

> Where `measureText()` is inexact, it must err **wide**. A measurement that can under-report is a
> collision the test suite cannot see; a measurement that over-reports is a slightly conservative
> layout a human can see and file a bug about.

`safetyFactor` (§4.2) is the same principle made adjustable. The `tnum` trap in §2 is the same
principle violated — which is why it is the one flagged with a warning.

---

## 7. Generating the default table

**Offline script, committed output.** Not a build-time dependency on a font file — `raw/07` is
explicit that build inputs must be reproducible, and a font fetched at build time is neither pinned
nor auditable.

- Reads the released Roboto Flex variable TTF once per rank, with `opsz` and `wght` set from that
  rank's row in `42-typography.md` §2.1 and the feature / variation settings from `generatedWith`.
- Emits a typed `.ts` module (tree-shakeable, so a consumer supplying their own table pays nothing
  for the default) and a `.json` for the generator's own snapshot test.
- **Reports the maximum per-glyph advance spread across ranks** — the §5.1 open question.
- Deterministic. CI regenerates and asserts an empty diff, so the committed table can never drift
  from the script that claims to produce it.

⚠ **Open: consumers with a custom face need this script published**, and there are currently six
packages (`20-architecture.md` §2) with no home for it. It is a repo script for now. Publishing it —
as `@gx/metrics-gen` or a `@gx/tokens` bin — is a Milestone D/E decision, not an A decision, but
`<GxConfig fontMetrics={…}>` is a half-usable API until it exists: consumers can *pass* a table but
have no supported way to *make* one.

---

## 8. Amendments this document required elsewhere — ✅ all applied

| File | Change |
|---|---|
| `20-architecture.md` §3.2 table (`:125`–`:128`) | `font family` moves out of Presentation/*"Never"*; the six measured-text tokens (§2) join Plan-input; the generated-CSS mechanism (§2.1) is stated |
| `20-architecture.md` §3.1 | `PlanPolicy.fontMetrics` — already carried in `40-chart-plan.md` §5 |
| `DESIGN.md:125` | typeface resolved to **Roboto Flex**, with the `opsz` 8–144 vs 14–32 reasoning |
| `DESIGN.md:240` | drop "typeface pairing" from the unresolved list |
| `PRODUCT.md:28` / `:63` | the CSS-restyle claim is narrowed for measured-text tokens (§2) |
| `42-typography.md` | landmark emphasis re-specified as `GRAD`, tier A-impl → B (§3) |

## 9. Open, and deliberately not invented

1. **`tnum` support in Roboto Flex** (§4.1) — blocks table generation, not A1.
2. **`safetyFactor` default** (§4.2) — requires a measurement, not a guess. Calibrate at A2.
3. **`opsz` advance spread** (§5.1) — the generator reports it; the type is built to survive either
   answer.
4. **Arrow glyph coverage** (§5.2) — with a good fallback (draw it) if absent.
5. **Publishing the generator** (§7) — Milestone D/E.
6. ~~Rank sizes~~ — **settled** by `42-typography.md` §2.1 (A 13/700 · B 12/700 · C 11/500 ·
   D 11/400 · E 10/400). The table is now generatable as soon as (1) resolves.
