# Text measurement — `FontMetrics` as a plan input

> Closes the gap at `30-implementation-plan.md:152` (A2 requires a character-advance model) and the
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

2. ⚠ **The landmark-emphasis token should use `GRAD`, not `font-weight`.** `raw/06:1743` specifies
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

1. **`opsz` range.** Our label default is 11 px with a 10 px floor (`raw/06:1731`, `:1732`).
   **Inter's optical range bottoms out at 14** — the entire small end of our type scale sits below it,
   where `font-optical-sizing: auto` clamps and does nothing. That is precisely the range
   `DESIGN.md:125` cares about, so Inter fails the requirement exactly where it was written to apply.

2. **`GRAD`.** Inter has no grade axis, so §3's mechanism is unavailable and landmark emphasis would
   have to go through `wght` and invalidate the table.

Sources: `raw.githubusercontent.com/google/fonts/main/ofl/robotoflex/METADATA.pb` and
`.../ofl/inter/METADATA.pb`.

### 4.1 ✅ Tabular figures — satisfied, but **not** by `tnum`

`DESIGN.md:125` requires *"true tabular figures"* and `:127` makes it a rule. The rule is satisfied.
The mechanism is not the one the rule assumed, and the difference is load-bearing rather than
pedantic.

**Roboto Flex ships no `tnum`.** `fonttools ttx -t GSUB` and `-t GPOS` on the released variable TTF
(`Version 3.200;gftools[0.9.32]`, sha256 `9b523f7d…810c8281`) give the complete feature list, and it
is short:

| Table | Every feature tag present |
|---|---|
| `GSUB` | `liga` · `locl` · `pnum` · `rvrn` |
| `GPOS` | `kern` · `mark` · `mkmk` |

No `tnum`. No `lnum` and no `onum` either. **A-impl** — read out of the shipped binary, not out of a
README.

**`pnum` is the finding.** Its one lookup is ten single substitutions, digits only:
`uni0030 → uni0030.prop`, `uni0031 → uni0031.prop`, and so on. So the **default** figures are the
tabular set and `pnum` is the switch *away* from them. Measured at the default instance: every
default digit is `1156/2048 = 0.5645 em`, while the `.prop` variants spread from `0.3594` (`1`) to
`0.5645` (`0`, `8`). **A-impl.** `pnum` is not default-on in any shaper, so the default rendering is
the tabular one.

Three consequences, none of them cosmetic:

1. **No restating, and no second face.** The fallback plan this section held open — a `wdth`-locked
   digit set, or a separate face for figures — is not needed, and is dropped.

2. ⚠ **The rule inverts into a prohibition, and the prohibition is what has to be enforced.**
   `font-variant-numeric: tabular-nums` requests `tnum`, which this face does not have, so the
   declaration is **inert on the reference face**. It is still not safe to delete, because it is
   load-bearing on the *fallbacks*: SF's default figures are **proportional** (nine distinct digit
   widths, measured) and SF does ship a real `tnum`. So the declaration stays, and the actual
   invariant is the negative one:

   > **`proportional-nums` / `pnum` must never be applied to text measured against this table.** On
   > this face it is the single setting that invalidates every digit in it.

   This is §2's `tnum` trap with its sign flipped. §2 warned that a table generated *without* `tnum`
   and rendered *with* it under-predicts. Here the table is generated under the tabular default and
   only `pnum` can break it — but the failure mode is identical: quiet, digit-wide, and present on
   every numeric axis label in the library.

3. ⚠ **The rule is satisfied by a default, so nothing inside the font enforces it.** A stray `pnum` —
   from a host stylesheet, a CSS reset, a `font-feature-settings` shorthand that overwrites rather
   than composes — would produce ten different digit widths and no error anywhere.
   `scripts/generate-font-metrics.test.mjs` therefore asserts *ten equal digit advances at every
   rank* against the committed table, which is the same fact restated somewhere a bad regeneration
   can trip over it.

**What would falsify this.** Google Fonts republishes Roboto Flex to the same path, so a future build
could add `tnum`, or change what `pnum` covers. The generator pins the font by content hash and
refuses to run on a mismatch, so the answer cannot go stale in silence — but it is an answer about
*these bytes*, not about "Roboto Flex" in the abstract.

### 4.1b ✅ Arrow glyph coverage — present

`cmap` lookup on the same pinned binary, answering §5.2's open item. **A-impl.**

| Code point | Glyph | Advance, default instance |
|---|---|---|
| `U+2191` ↑ | `uni2191` | `1286/2048 = 0.6279 em` |
| `U+2193` ↓ | `uni2193` | `1286/2048 = 0.6279 em` |
| `U+2192` → | `uni2192` | `1723/2048 = 0.8413 em` |

All three present, so `10-responsive-ladder.md` §4's *"↑ 12% this week"* stays a character, the
drawn-SVG-mark fallback §5.2 held in reserve is not needed, and all three are covered per rank in the
generated table. (`U+2190` ← is present too, though nothing asks for it.)

⚠ **But the fallback stack does not agree, and the arrow leads the phrase.** Measured: SF has all
three, DejaVu Sans has all three, **Roboto has none of them** — `U+2191`, `U+2192` and `U+2193` are
absent from its `cmap` entirely. A consumer who lands on Roboto gets a third-font substitution for
the first character of the phrase, at an advance no table here predicts. Not fatal — §4.2's
`safetyFactor` is a bound over the *reachable* faces, and a face reached by per-glyph substitution is
not one of them — but it is the only hole in §5.2's character set, and worth knowing before the Micro
summary phrase is built.

### 4.2 ✅ `safetyFactor` — calibrated at **1.57**

Bundling a multi-hundred-KB variable font in a chart library is hostile, so `--gx-font-family` names
Roboto Flex with a system fallback stack. **A consumer who does not load Roboto Flex renders in a
fallback face against a Roboto Flex table.**

The error direction is what matters. If the actual face is *narrower* than the table, labels fit with
slack — safe. If *wider*, they collide — unsafe. So the shipped default cannot be a bare
reference-face table, and `safetyFactor` is the **observed maximum** ratio
`fallback advance ÷ Roboto Flex advance` over the label character set — a maximum, not a mean, so
the table always over-estimates.

**Method.** Advances from `hmtx ÷ head.unitsPerEm`, each variable face instantiated *per rank* at
that rank's `opsz` and `wght` (`42-typography.md` §2.1 — A 13/700, B 12/700, C 11/500, D 11/400,
E 10/400), axes outside a face's range clamped, `tnum` applied where the face has it, and macOS
`trak` tracking folded into SF. Character set: `0`–`9`, `.,-+%$€£`, space, upper and lower Latin, and
the three arrows.

| Face | Provenance | Worst rank | Max ratio | At |
|---|---|---|---|---|
| **DejaVu Sans** 2.35 Book | **A-impl** — measured | D (11/400) | **1.5643** | `+` |
| DejaVu Sans 2.35 Bold | **A-impl** — measured | A (13/700) | 1.5079 | `+` |
| **SF** / `system-ui` (`SFNS.ttf` 21.4d2e1) | **A-impl** — measured | B (12/700) | 1.3992 | `-` |
| **Roboto** 3.015, variable | **A-impl** — measured | A (13/700) | 1.1512 | `-` |
| **Segoe UI Variable** | ⚠ **UNVERIFIED** | — | — | — |

**`safetyFactor = 1.57`**, the observed maximum `1.5643` rounded **up**. Rounding a bound to nearest
stops it being a bound.

⚠ **Segoe UI Variable is Windows-only and was not obtainable on the machine that ran this.** It is
not estimated, not substituted with a lookalike, and not quietly dropped from the stack. The Windows
arm remains **UNVERIFIED**, and `1.57` is a bound over three faces rather than four.

#### 4.2.1 Why a per-character maximum, and what the choice costs

For any string, `sum(fallback) / sum(reference) ≤ max_char(fallback / reference)`. So a per-character
maximum is a genuine bound on whole labels rather than a sample of them — which is the property §6.1
demands, and which a corpus of "realistic label strings" cannot supply at any sample size.

It is also **loose**, because equality needs a string made entirely of the worst character. Two
numbers make the looseness visible rather than leaving it to be discovered later:

- The maximum is driven by **one glyph in one face**. DejaVu Sans draws `+` at `0.8379 em` against
  Roboto Flex's `0.5356 em` — it sets math operators near a fixed width. Drop DejaVu Sans from the
  stack and the bound falls to SF's **1.3992**. **A-impl.**
- Across 36 realistic label strings (`2024`, `1,000`, `-0.5%`, `$1.2M`, `North America`,
  `↑ 12% this week`, …) the worst **whole-string** ratio observed was **1.33**; typical strings sit
  at 1.03–1.13. **A-impl.**

So `1.57` costs roughly 18% of conservatism over the worst realistic string and about 40% over a
typical one. That is still far better than the ~1.7× provisional 1-em band it replaces — which had
zero per-character coverage — and it is a bound rather than a hope. **Consumers who genuinely load
the reference face set it to `1.0` and pay none of it**, which is now a meaningful thing to do and
worth documenting as the recommended configuration.

⚠ **A second-order effect that was measured and does not move the number.** macOS applies the `trak`
table to `system-ui`, and SF's normal track *widens* at our sizes — `+24` font units at 10 px, `+12`
at 11 px, `0` at 12 px, `−12` at 13 px (`upm` 2048), i.e. up to `+0.0117 em` per glyph, in the
**unsafe** direction. Folding it in raises SF's rank-E maximum from 1.3287 to 1.3618 and leaves the
overall bound untouched. ⚠ Whether a given browser applies `trak` at all was **not** verified; the
measurement assumes it does, which is the only assumption that is safe here.

**What would falsify this.** A fallback face wider than DejaVu Sans on any covered character; Segoe
UI Variable exceeding 1.5643 once someone measures it on Windows; or a `--gx-font-family` override
that introduces a face nobody measured — which is the case §5's `PlanPolicy.typography` exists to
make the consumer's problem rather than ours, since the metrics travel with the family. Re-derive
with `node scripts/generate-font-metrics.mjs --calibrate`, which exits non-zero if the committed
constant and a fresh measurement disagree.

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

✅ **The opsz spread was measured, and it is not negligible — per-rank keying is justified on optical
grounds as well as weight grounds.** Holding `wght` at 400 and moving `opsz` from 10 to 13 shifts the
worst glyph by **8.87%** (`~`, `U+007E`); digits move 1.61% and letters 2.5–3.5%. Including weight,
the total spread across the five ranks reaches **36.83%** (`‘`, `U+2018`), and weight alone at
`opsz` 11 across 400→700 accounts for 32.68% of it. **A-impl** — measured from the per-rank instances
the generator builds. So optical sizing is the smaller effect but is an order of magnitude above
rounding noise at the sizes we ship, and the type does not collapse.

⚠ **Roboto Flex's own default `opsz` is 14, above the whole 10–13 px scale.** Reading advances from
the uninstantiated font would therefore have described a size the library never renders at, in the
direction that makes small text look narrower than it is. The generator pins `opsz` and `wght` per
rank for exactly this reason, and deliberately omits both from `generatedWith.variationSettings` —
`font-optical-sizing: auto` sets `opsz` from the rendered font size and the rank stylesheet sets
`wght`, so naming them again in CSS would be a second source of truth for a value the browser already
derives.

### 5.2 Character coverage

The table is sparse. Covered:

- ASCII printable `U+0020`–`U+007E`
- Latin-1 letters that appear in ordinary category labels
- Currency `$ € £ ¥ ₹` and `%`
- Typographic punctuation `– — ‘ ’ “ ” … ·`
- The arrows used by the Micro summary phrase — `10-responsive-ladder.md` §4 gives the literal
  example *"↑ 12% this week"*

172 code points as generated, ~4 KB of JSON per rank entry. Everything else falls to the banded
fallback.

✅ **Arrow coverage: verified present** — see §4.1b for the glyphs and advances. Roboto Flex has all
three, so the summary phrase keeps the character and the drawn-SVG-mark alternative is not needed.
⚠ Roboto, one of the fallback faces, has none of the three; §4.1b states what that does and does not
cost.

---

## 6. `measureText()`

```ts
function measureText(
  text: string,
  rank: TypeRank,            // 'A' | 'B' | 'C' | 'D' | 'E' — see 42-typography.md §2.1
  metrics: FontMetrics,
  style?: {                  // partial rank style; omitted fields use the released defaults
    fontSize?: number,       // px
    letterSpacing?: number,  // px
  },
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
6. Multiply by the supplied rank style's font size, then by `safetyFactor`.

When `style` is omitted, `measureText()` uses the released `DEFAULT_TYPOGRAPHY.byRank[rank]`.
The planner passes the matching `PlanPolicy.typography.byRank[rank]` object, including custom
font size and letter spacing, so its width model and the rendered CSS stay on the same policy.

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
  for the default).
- **Reports the maximum per-glyph advance spread across ranks** — the §5.1 open question, now
  answered there.
- Deterministic: re-running with the same pinned font reproduces the committed file byte for byte.

✅ **Built as `scripts/generate-font-metrics.mjs`**, emitting
`packages/core/src/font-metrics.generated.ts`. Two details of the spec above changed on contact with
the problem, and both are worth stating rather than leaving as a silent divergence:

⚠ **"CI regenerates and asserts an empty diff" cannot exist here.** A regenerate-and-diff step needs
the font, and this same section forbids vendoring it or fetching it at build time — so the gate would
have to violate the constraint it is protecting. `43-theming.md` §6.3 is the relevant warning: *"a
gate never observed to fail is not a gate — it is a job that exits 0."* A CI step that silently skips
when the font is missing is precisely that. So drift is caught three other ways instead: the font is
pinned by **sha256** and the generator refuses to run on a mismatch; `--calibrate` re-derives
`safetyFactor` and exits non-zero if it disagrees with the committed constant; and
`scripts/generate-font-metrics.test.mjs` asserts the table's *observable properties* — ten equal digit
advances per rank, `fallback.latin ≥ every advance it backs`, JSON round-trip, single-code-point keys
— which needs no font and does run in CI. The regeneration command lives in the generated file's
docblock.

⚠ **No `.json` snapshot is emitted.** It would have been a second artifact asserting the same facts
as the first; the property tests cover what a snapshot would have caught, and cover it against
regeneration rather than against editing.

⚠ **Open: consumers with a custom face need this script published**, and there are currently six
packages (`20-architecture.md` §2) with no home for it. It is a repo script for now. Publishing it —
as `@gx/metrics-gen` or a `@gx/tokens` bin — is a Milestone D/E decision, not an A decision, but
`<GxConfig typography={…}>` is a half-usable API until it exists: consumers can *pass* a matching
style-and-table object but have no supported way to *make* the table.

---

## 8. Amendments this document required elsewhere — ✅ all applied

| File | Change |
|---|---|
| `20-architecture.md` §3.2 table (`:125`–`:128`) | `font family` moves out of Presentation/*"Never"*; the six measured-text tokens (§2) join Plan-input; the generated-CSS mechanism (§2.1) is stated |
| `20-architecture.md` §3.1 | `PlanPolicy.typography` — six fitting values and `FontMetrics`, replaced atomically |
| `DESIGN.md:125` | typeface resolved to **Roboto Flex**, with the `opsz` 8–144 vs 14–32 reasoning |
| `DESIGN.md:240` | drop "typeface pairing" from the unresolved list |
| `PRODUCT.md:28` / `:63` | the CSS-restyle claim is narrowed for measured-text tokens (§2) |
| `42-typography.md` | landmark emphasis re-specified as `GRAD`, tier A-impl → B (§3) |

## 9. Open, and deliberately not invented

1. ~~**`tnum` support in Roboto Flex**~~ — **settled** (§4.1). The face has no `tnum`; its digits are
   tabular *by default* and `pnum` is the switch away. The rule survives as a prohibition on `pnum`.
2. ~~**`safetyFactor` default**~~ — **settled** at **1.57** (§4.2), the observed maximum over SF,
   Roboto and DejaVu Sans. ⚠ **Still open within it: Segoe UI Variable**, which is Windows-only and
   was not obtainable. The bound covers three of the four faces in the stack, and the fourth is
   labelled rather than estimated.
3. ~~**`opsz` advance spread**~~ — **settled** (§5.1): 8.87% optical alone over 10→13 px, 36.83%
   including weight. Per-rank keying stands.
4. ~~**Arrow glyph coverage**~~ — **settled** (§4.1b): all three present in Roboto Flex, so no drawn
   SVG mark. ⚠ Absent from Roboto in the fallback stack.
5. **Publishing the generator** (§7) — Milestone D/E. Unchanged, and now more pressing: the generator
   exists and works, so the only thing between a consumer with a custom face and a correct table is
   distribution.
6. ~~Rank sizes~~ — **settled** by `42-typography.md` §2.1 (A 13/700 · B 12/700 · C 11/500 ·
   D 11/400 · E 10/400).
7. ⚠ **New: `U+2212` MINUS SIGN is not in §5.2's character set.** It is what a locale-aware number
   formatter emits for negatives — `Intl.NumberFormat` uses it, not ASCII `-` — and it produced the
   worst *whole-string* ratio observed in calibration (1.3288, for `−5` in DejaVu Sans). It is safe
   today because it falls to the banded fallback, which over-estimates by more than that. Adding it
   to the covered set would tighten the measurement; it is recorded rather than added, because
   widening the character set is a spec change and this note is not one.
