# Theming — two themes, and the token lint-gate allowlist

> Implements the decision that "The Emission-Line Rail" ships as the **default** theme alongside a
> documented **neutral escape hatch** resetting to field-convention defaults.
>
> §6 is the only part of Phase 1 that Milestone A1 actually blocks on: `30-implementation-plan.md:28`
> and `20-architecture.md:223` both require the token lint gate *"on day one, not later"*, and
> `DESIGN.md:222` bans raw hex from stylesheets — but the tokens package is the one place literal
> values must live, and **no allowlist is specified anywhere in the corpus.** Without it the gate is
> unshippable on the day it is mandated.

---

## 1. What a theme is — and the boundary that is not negotiable

A theme is a set of `--gx-*` custom property values. Selecting one is a class or a stylesheet
import. Never a JS prop (`PRODUCT.md:17`), never a runtime style provider
(`20-architecture.md` §2).

⚠ **A theme may only change tokens that do not affect measurement.** This is forced, not chosen.
`41-text-metrics.md` §2 establishes that `font-family`, `font-size`, `font-weight`,
`font-feature-settings`, `font-stretch`, and `letter-spacing` are **plan inputs** — typed values,
because `planChart()` must know them to decide whether labels collide. If a theme changed any of
them, selecting it would require re-running the resolver, and "one class, no JS, no re-render" would
be false.

So:

| | |
|---|---|
| **Themes change** | colour, ground, opacity, corner radius, elevation, state treatment, dash and point-shape assignment, stroke widths of marks |
| **Themes never change** | anything in the type scale (`42-typography.md`), anything in `PlanPolicy` (`40-chart-plan.md` §5), or any threshold |

**Both themes therefore ship the same typeface (Roboto Flex) and the same A–E type scale.** A consumer
who wants a different face is not switching themes — they are supplying
`<GxConfig fontMetrics={…} typography={…}>`, which is a third mechanism with a different cost. Saying
so plainly is better than shipping a theme switch that silently invalidates the advance table.

---

## 2. Selection

```css
/* @gx/tokens/theme.css — both themes, one file */

:where(:root) {
  /* The Emission-Line Rail, dark ground. Specificity 0,0,0. */
  --gx-ground: #141618;
  --gx-series-1: #b4e4fd;   /* H-beta 486.1nm */
  /* … */
}

@media (prefers-color-scheme: light) {
  :where(:root) { --gx-ground: #f4f3ef; /* … */ }
}

:where(:root)[data-gx-theme='rail-light'],
.gx-theme-rail-light      { /* … */ }

.gx-theme-neutral         { /* … */ }
.gx-theme-neutral-light   { /* … */ }
```

Two details that matter more than they look:

- **`:where(:root)` for the default, a bare class for the overrides.** `:where()` has specificity
  `0,0,0`, so *any* selector beats it — a theme class, a consumer's own `--gx-*` override, an inline
  style. A plain `:root` would tie with `.gx-theme-neutral` (both `0,1,0`) and leave the outcome to
  source order, which breaks the moment a bundler reorders imports.
- **Four combinations, not two.** `DESIGN.md` ships both a dark ground (`#141618`) and a light one
  (`#f4f3ef`), so the matrix is {Rail, Neutral} × {dark, light}. `prefers-color-scheme` picks the
  ground; the class picks the world. A consumer pinning both writes one class.

⚠ **Cascade layers are the right container** — `@layer gx.tokens, gx.theme, gx.overrides;` — because
the product promise is that a consumer restyles a single widget from their own stylesheet. Without a
layer, a library selector that happens to be more specific than the consumer's silently wins, and the
promise fails in exactly the case it was made for. **Tier C** — no surveyed system in `raw/06` uses
layers for this, so it is ours and should ship labelled as such.

---

## 3. Which tokens are shared, and which are theme-scoped

The split is not arbitrary. `DESIGN.md`'s Do/Don't list turns out to contain two different kinds of
rule, and separating them is what makes an escape hatch coherent rather than a free-for-all.

### 3.1 Cross-theme invariants — these hold in the neutral theme too

These protect **correctness and accessibility**, not the visual world. `DESIGN.md` says so itself in
two places: *"Encode series identity redundantly — hue and dash and point shape — **in every theme**,
at every size"*, and *"Drive grid and axis chrome from `currentColor` at low opacity so **re-themed**
widgets stay coherent"*. Both sentences were written anticipating a second theme.

- **Redundant encoding is on by default in both themes.** Hue *and* dash *and* point shape,
  simultaneously. Not an accessibility toggle.
- **Hue alone never carries identity past six series.**
- **Never hold all series at equal lightness** — it collapsed to ΔE 0.2 under deuteranopia and a
  greyscale spread of 0.0008 (`DESIGN.md:93`).
- **Grid and axis chrome derive from `currentColor` at low opacity** (`DESIGN.md:101`).
- **No gradients, anywhere, for any reason.** The stated reason is semantic — *"a gradient encodes a
  value that varies where no value varies"* — so it is not a stylistic preference and does not relax.
- **The Separate Alarm Rule** (`DESIGN.md:103`) — alert colours never come from the series ramp, and
  series colours never come from the alert namespace. Both themes need an alert namespace; the values
  differ, the separation does not.
- **An element the ladder has dropped is removed, not greyed or zero-opacity'd** (Conceal Means Gone).
- **`tabular-nums` per role, never globally.**
- **No CSS custom property may influence `planChart()`** — §1.
- **Every value referenced through a token.**

### 3.2 Emission-Line Rail specifics — the neutral theme is free to differ

These are the visual world, and they are what "escape hatch" means:

| Rule | Default (Rail) | Neutral |
|---|---|---|
| Series hues | Named emission lines at stated wavelengths, wavelength → CIE 1931 XYZ → linear sRGB → OKLCH (`DESIGN.md:42`) | Derived without the wavelength constraint — §4 |
| Corner radius | **Zero everywhere** (Square Corner Rule, `DESIGN.md:196`) | Field convention: a small radius on bars and tooltips |
| Elevation | *"Elevation tokens exist in name only and resolve to nothing"* (`DESIGN.md:190`) | Resolve to real shadows |
| State | Left-edge coloured bar + dashed border, never a fill (`DESIGN.md:200`) | Field convention: fill or border |
| Charcoal ramp | Hue 248.1°, chroma 0.0051 — a faintly cool grey (`DESIGN.md:99`) | True neutral, chroma 0 |

⚠ **On elevation, this document takes an interpretive position and should be read as doing so.**
`DESIGN.md:190` says *"a widget cannot opt into a shadow"*. Read literally against a two-theme
system: a **widget** cannot, a **theme** can. That reading is what makes the sentence's first half
load-bearing — keeping the token *names* alive while resolving them to nothing is exactly the
affordance a second theme needs, and there is no other reason to name a token that resolves to
nothing. If that reading is wrong, the neutral theme has no shadows and only §6 of this document
survives; nothing else depends on it.

**Consequence for the token tree:** `--gx-elevation-*` and `--gx-*-corner-radius` must exist as names
in **both** themes, resolving to `none` and `0` in the default. A token that exists in one theme only
cannot be swapped by a class.

---

## 4. The neutral palette — derivation, not invention

The neutral theme cannot simply adopt a well-known categorical palette. ⚠ `DESIGN.md:248` records
that **the Okabe-Ito hex values and ColorBrewer's colour-blind-safe flags remain unverified against
primary sources, and neither is relied on for any value in that document.** Shipping unverified
hexes in a second theme would reintroduce exactly what the first theme was careful to avoid.

**So the neutral palette uses the same method with one constraint removed.**

| | Rail | Neutral |
|---|---|---|
| Hue selection | inherited from physics — a named emission line's wavelength | evenly spaced in OKLCH |
| Lightness / chroma | tuned per hue against the ground | same |
| Contrast floor | ≥ 4.5 against ground | same |
| Pairwise separation | ΔE targets (dark min 11.6; light min 5.0) | same |
| Colour-blind + greyscale simulation before shipping | required | required |

Same rigour, no spectroscope — which is a precise statement of what the escape hatch is for.

⚠ **The acceptance criteria themselves carry no external authority.** `DESIGN.md:247`: *"No
minimum-contrast or minimum-colour-separation threshold exists anywhere in the research. The 4.5
contrast floor and the ΔE separation targets used to derive this palette are this project's own
choices."* Reusing them for the neutral theme does not make them more authoritative — it makes both
themes consistently ours.

**The neutral hex values are not stated here.** They are computed alongside the sequential and
diverging ramps at Milestone B1, from the derivation above. Writing six hexes into this document
without running the simulations would be the invention the corpus keeps refusing to make.

⚠ **The light Rail theme's minimum separation falls to ΔE 5.0** (`DESIGN.md:74`) — less than half the
dark theme's 11.6 — which is why `DESIGN.md` requires form differentiation from the *second* series
onward on light grounds. The neutral light theme must be checked for the same collapse; an evenly-
spaced hue circle is not automatically better-separated on a light ground than a wavelength-derived
one, and assuming it would be is precisely the composition error §5 is about.

---

## 5. Composition review — both palettes

`10-responsive-ladder.md` §6.1 documents the failure this exists to prevent: `grid-color: #ddd`
(A-impl) × `grid-opacity: 0.2` (A-lit) composed to an **invisible gridline**. Two impeccably sourced
tokens, one broken pair. `00-decisions.md` states the standing limit — *provenance is per-token;
correctness is per-composition* — and `DESIGN.md` makes it a Do: *"Check token pairs that modulate
the same perceptual channel … as a composed result, not as two separately-sourced values."*

**A second palette is exactly what re-introduces this class of bug**, because every colour × opacity
pair gets new inputs while the opacity side keeps its published authority.

Pairs to check, per theme, per ground:

| Pair | Channel | Failure mode |
|---|---|---|
| gridline colour × `gridline-alpha: 0.2` | luminance | invisible gridline — the known bug |
| axis rule colour × opacity | luminance | axis disappears against ground |
| series hue × mark opacity (area fills) | luminance + chroma | overlapping areas become indistinguishable |
| stroke width × dash array | form | dashes vanish at small stroke widths, so the redundancy channel silently dies |
| point shape × point radius | form | shapes become indistinguishable discs below a radius |
| font size × weight (`GRAD 150` at 11 px) | typographic colour | landmark labels stop reading as landmarks — `42-typography.md` §3 |

**Gridlines specifically are safe in both themes by construction.** `DESIGN.md:101` resolves grid and
axis chrome to `currentColor` at low opacity, and `currentColor` inherits the text colour of whatever
theme is active. The composed result therefore tracks the theme automatically — which is why
`DESIGN.md` phrases the Do as *"so **re-themed** widgets stay coherent"*. The alpha keeps its A-lit
provenance (0.2, Talbot); the colour becomes **B**, ours.

⚠ The other five pairs have **no such structural guarantee** and must be checked per theme with
simulation, not eyeballing. That check is Milestone B1 work, but the list belongs here because it is
the neutral theme's acceptance criteria, and a palette that ships without it is a palette that ships
the `#ddd × 0.2` bug in a new costume.

---

## 6. The token lint-gate allowlist — the A1 deliverable

The gate is specified consistently in three places and its scope is unambiguous:

> Rejects raw hex/rgb/hsl colours, raw `px` values, and gradients; requires `var(--...)`.
> — `20-architecture.md:223`, `:307`, `30-implementation-plan.md:28`

and `20-architecture.md:53` states the invariant as *"No package emits a raw hex, rgb, hsl, or `px`
literal in CSS."* ⚠ **No allowlist is specified anywhere.** As written the gate fails on the tokens
package itself on the day it is required to ship.

### 6.1 The rule

The allowlist is **narrow in two dimensions at once** — where, and in what syntactic position:

> A raw colour or length literal is permitted **only** in the theme source files of `@gx/tokens`, and
> **only** as the value of a `--gx-*` custom property declaration.

```
allowlist:
  files:  packages/tokens/src/themes/**/*.css
  position: custom-property declaration value only
```

So, inside an allowlisted file:

| | |
|---|---|
| `--gx-series-1: #b4e4fd;` | ✅ permitted — a token definition, the one place literals must live |
| `--gx-label-font-size: 11px;` | ✅ permitted |
| `color: #b4e4fd;` | ❌ rejected — a normal declaration, even in the tokens file |
| `--gx-plot-bg: linear-gradient(...)` | ❌ rejected — the gradient ban has no allowlist at all |

The positional half is what makes this a real gate rather than a hole. A file-only allowlist would let
any stylesheet that happens to live in the tokens package author arbitrary raw CSS, and the tokens
package is precisely where someone would put a component style "just for now".

### 6.2 Edge cases that must be decided now, not argued about in review

- **Unitless `0`** is not a `px` literal. Permitted everywhere. `--gx-corner-radius: 0` needs no
  exemption — which is convenient, since the default theme sets it that way (`DESIGN.md:196`).
- **Unitless numbers in `calc()`** (`calc(var(--gx-gap) * 2)`) are permitted. The multiplier is not a
  length.
- **`currentColor`**, `transparent`, `inherit` are keywords, not literals. Permitted everywhere —
  and `currentColor` is *mandated* for chrome (§3.1).
- **Media-query values** (`@media (prefers-color-scheme: light)`) are not declarations. Out of scope.
- ⚠ **SVG presentation attributes authored in TSX are not CSS and stylelint will not see them.** A
  `<line stroke="#ddd" />` in `@gx/primitives` passes a CSS-only gate cleanly. Either the gate gains a
  companion rule over `.tsx` attribute values, or primitives are required to carry no visual
  attributes at all and take everything from classes. **The latter is better** — it is the same
  discipline that makes per-widget CSS theming work — but it needs stating in A1, because a gate with
  a known hole is worse than a documented absence.

### 6.3 The gate must be seen to fail

CI asserts **both** directions:

1. The gate **passes** on `@gx/tokens` via the allowlist.
2. The gate **fails** on a deliberately planted raw hex in a non-allowlisted package.

A gate never observed to fail is not a gate — it is a job that exits 0.

---

## 7. Deliberate divergences from field convention

Per the `§6.2` pattern, divergences are recorded rather than silently taken:

| Ours | Field convention | Note |
|---|---|---|
| No shadows anywhere in the default theme | ⚠ **Carbon ships `box-shadow: 0 1px 6px 0 rgba(0,0,0,0.2)`** on threshold labels (`raw/06:283`) | Deliberate. The neutral theme is where that convention is available again — §3.2 |
| Corner radius zero | Rounded bar caps and tooltips are near-universal | Deliberate. Restored in neutral |
| Stroke weights **increase** as size decreases | ⚠ Spectrum verifiably scales them **down** | Deliberate, `PRODUCT.md:77`. **Cross-theme** — it is a legibility rule, not a stylistic one, so the neutral theme keeps it |
| Left-edge bar + dashed border for state | Fill or border | Rail only |
| Landmark emphasis via `GRAD`, not `font-weight` | Carbon uses semibold | Deliberate and **cross-theme**, because it is a measurement constraint (`42-typography.md` §3), not an aesthetic |

⚠ Note the pattern: **every divergence that exists for a measurement or legibility reason is
cross-theme; every divergence that exists for a visual reason is Rail-only.** That is the same line
drawn in §1 and §3, and it is the test to apply to any future divergence.

---

## 8. Amendments this document required elsewhere — ✅ all applied

| File | Change |
|---|---|
| `DESIGN.md:190` | note that the elevation token *names* are what the neutral theme resolves differently (§3.2) |
| `20-architecture.md:53`, `:223`, `:307` | the gate statement gains the §6.1 allowlist and the §6.3 both-directions assertion |
| `30-implementation-plan.md:28` | A1's token-gate task gains the allowlist and the planted-hex test |
| `30-implementation-plan.md` A1 | add the §6.2 decision on SVG presentation attributes in `@gx/primitives` — carried as a *recommendation with a stated default*, since it is A1's call to make, not this document's |

## 9. Open, and deliberately not invented

1. **The six neutral hex values** (§4) — derivable, not guessable. Milestone B1, with the ramps.
2. **Whether the neutral light theme collapses like the Rail light theme does** to ΔE 5.0 (§4).
   Must be simulated, not assumed.
3. **The five unguaranteed composition pairs** (§5) — B1, per theme, per ground.
4. **Cascade layers** (§2) — Tier C, no surveyed precedent.
5. **The elevation reading** (§3.2) — an interpretation of `DESIGN.md:190`, flagged as such. Worth a
   sentence in `DESIGN.md` either way so the next reader does not have to re-derive it.
6. **SVG presentation attributes** (§6.2) — a real hole in the gate as currently specified. Needs an
   A1 decision, and the recommendation here is that primitives carry no visual attributes at all.
