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
  --gx-surface-color: #141618;
  --gx-series-1: #b4e4fd;   /* H-beta 486.1nm */
  /* … */
}

@media (prefers-color-scheme: light) {
  :where(:root) { --gx-surface-color: #f4f3ef; /* … */ }
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

**Consequence for the token tree:** `--gx-widget-shadow`, `--gx-tooltip-shadow` and
`--gx-widget-radius` must exist as names in **both** themes, resolving to `none` and `0` in the
default. A token that exists in one theme only cannot be swapped by a class.

⚠ **Those three were `--gx-elevation-raised`, `--gx-elevation-overlay` and `--gx-corner-radius` until
the B1 slice-2 rename** (§6.1d). The requirement above is about *arity and presence* — two shadow
names, one radius name, all three in both themes — so the rename satisfies it unchanged. It also made
the pair say which surface it raises, which the escape-hatch theme has to know before it can pick a
shadow: a theme resolving `--gx-tooltip-shadow` is told it is styling a tooltip. Both had zero
`var()` consumers at the time, so this cost nothing to correct.

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

**The neutral hex values are not stated here.** They were computed alongside the sequential and
diverging ramps during Milestone B1, from the derivation above. Writing six hexes into this document
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
simulation, not eyeballing. That check was identified during Milestone B1, but the list belongs here because it is
the neutral theme's acceptance criteria, and a palette that ships without it is a palette that ships
the `#ddd × 0.2` bug in a new costume.

---

## 6. The token lint-gate allowlist — the A1 deliverable, widened at A6 and B1

The gate is specified consistently in three places:

> Rejects raw hex/rgb/hsl colours, raw `px` values, and gradients; requires `var(--...)`.
> — `20-architecture.md:223`, `:307`, `30-implementation-plan.md:28`

and `20-architecture.md:53` states the invariant as *"No package emits a raw hex, rgb, hsl, or `px`
literal in CSS."* ⚠ **No allowlist is specified anywhere.** As written the gate fails on the tokens
package itself on the day it is required to ship.

⚠ **This section previously said that scope was "unambiguous". It was retired on 2026-08-23 after the
rule was executed rather than read.** It is unambiguous and *incomplete in both directions*: it rejects
things it should permit, and permits an entire class it should reject —
`oklch()`, `lab()`, `hwb()`, `color()` and every named colour pass it today, which matters because
`DESIGN.md` derives its palette in exactly that space. Three documents restating one rule read as
consensus; they are one source cited three times. See
[`decisions/015-token-gate-is-a-parser.md`](decisions/015-token-gate-is-a-parser.md) for the probe
results. §6.1's positional rule below is unaffected and correct; what changed is the literal classes it
ranges over (§6.1a) and how it is implemented (§6.1b).

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

### 6.1a What counts as a literal — widened 2026-08-23

The rule above says *"a raw colour or length literal"*. The corpus's three statements spell that out as
`hex/rgb/hsl` and `px`, and probing found that spelling lets an entire class through untouched.

| Class | Rejected outside an allowlisted position |
|---|---|
| **Colour** | `#hex` · `rgb()`/`rgba()` · `hsl()`/`hsla()` · **`oklch()` · `oklab()` · `lab()` · `lch()` · `hwb()` · `color()`** · **named colours** |
| **Length** | `px` · **`rem` `em` `pt` `pc` `in` `cm` `mm` `q` `ex` `ch`** — unitless `0` legal, viewport and container units legal |
| **Gradient** | `linear-` / `radial-` / `conic-` and repeating variants — **no allowlist anywhere** (§3.1) |

Two notes on why each widening is not scope creep:

- **The modern colour functions are the important half.** `DESIGN.md` derives every series hue through
  OKLCH, so `oklch()` is the notation this design system most invites and the one the stated rule was
  blindest to. A gate that catches `#b4e4fd` but waves through `oklch(0.87 0.07 220)` is not enforcing
  the discipline, it is enforcing a notation preference.
- **`rem`/`em`/`pt` are the same rule, not a new one.** The intent behind "raw `px`" is *raw length*;
  `px` is simply the one that gets typed most. `2rem` hardcoded in a component stylesheet is the same
  breach in different units.

⚠ **`currentColor`, `transparent`, `inherit` and the CSS-wide keywords stay permitted** — §6.2 already
says so, and `currentColor` is *mandated* for chrome by §3.1. A named-colour list that swallows them
converts a mandate into a violation, which is the one way this widening could do harm.

### 6.1b The gate parses CSS; it does not grep it

⚠ **The gate is described everywhere as a *port*, and the source cannot express §6.1's rule.**
`raw/04:353` names it: `check-css-module-tokens.mjs`. That script runs three global regexes over
whole-file text with **no notion of a declaration**, and collects `*.module.css` only — while the
allowlisted theme files are plain `.css`, so ported unchanged it never opens them and passes trivially,
which is §6.3's failure exactly.

Executed against theme-shaped CSS it produced **six rejections of which two were correct**. Two of the
four false positives are the positional gap; the other two — a `#ffffffBB` inside a base64 data URI and
a `#ff0000` inside a `content` string — are regexes failing to parse CSS, and neither has anything to
do with the allowlist.

**Decided: build it on PostCSS.** `walkDecls()` hands back `prop` and `value` separately and custom
properties arrive as ordinary declarations whose `prop` begins `--`, so the positional half of §6.1
stops being a rule to implement and becomes `decl.prop.startsWith('--gx-')`. Strings and URLs come back
as distinct token types, so both parse-level false positives vanish without a special case.

⚠ **PostCSS is a new dependency, not one already present** — `@tsdown/css` uses **lightningcss** as its
engine and only *loads* a PostCSS config. Taken anyway: `postcss` is three small pure-JS packages where
`lightningcss` is a per-platform native binary, and the gate is a standalone CI check that should not be
coupled to the bundler's engine. Budget it as new code at A1 — full evidence and rule set in
[`decisions/015-token-gate-is-a-parser.md`](decisions/015-token-gate-is-a-parser.md).

### 6.1c Membership — the fifth rule, and the one that is not positional — added at B1

The four rules above all ask *"is this value a literal that should have been a token?"* None of them
asks the question one step earlier: **does the token exist?** `var(--gx-serie-1)` parses, satisfies
every rule on this page, builds, emits no warning, and paints the property's initial value. A chart
loses a series colour and nothing anywhere says so.

> Every `var(--gx-*)` in any authored stylesheet must name a custom property that some file under
> `packages/tokens/src/themes/` declares.

Three things make this rule shaped differently from the other four:

- **It is not positional.** It applies *inside* the allowlisted directory too, because the theme
  source is full of `var()` chains — `--gx-surface-text-color: var(--gx-ramp-neutral-9)` is the whole mechanism by
  which the ramp is absolute and the theme picks an index (§3.2). A typo on the right-hand side there
  breaks every theme at once, so the rule runs before the allowlist early-return, not after it.
- **It needs a set, so it can be inert.** The other four are decidable from one file. This one needs
  every declared name, which means it has a failure mode they do not: given an empty set, every
  `var()` is undeclared, so the natural implementation of "skip if we found nothing" turns the rule
  off while still exiting 0. The CLI therefore **refuses to run** on an empty set rather than passing
  — §6.3's principle applied to a gate that can be disabled by its own input.
- **§6.1b's lesson had to be learned a second time.** The obvious implementation greps
  `--gx-[a-z-]+` across `packages/` and diffs. Run against this tree it reports two undeclared
  tokens, `--gx-grid-width` and `--gx-tick-length`, and **both are false positives**: all seven
  occurrences are prose comments quoting [decision 012](decisions/012-no-line-element-for-tokened-geometry.md)'s
  counterexample — the tokens that decision documents as deliberately *absent*. Two findings, two
  wrong, which is the same ratio the regex script scored in §6.1b. It walks declarations.

⚠ **The case worth planting is the fallback.** `var(--gx-typo-not-a-token, 4px)` renders a perfectly
good 4px forever, so nothing downstream looks wrong and no author ever finds out the token was never
real; the rule matches on the *opening* of the `var()` for exactly that reason. It reports **two**
violations there, not one — the missing token and the hardcoded `4px` — because the two have different
fixes and a reader who saw only the first would fix the name and leave the literal behind.

⚠ **This rule is why `theme.css` is generated rather than authored**, and the two arrived together at
B1. The source of truth is `packages/tokens/src/tokens.ts`, where a token's tier and source are
**fields**; `pnpm generate:tokens` emits the stylesheet and the name list. The reason is on this page:
§6.1's whole subject is which values may be written by hand, and until B1 the *provenance* of those
values was written by hand too — as comments. `--gx-grid-opacity` carried a citation to Talbot 2010 from
A1 onward when [`10-responsive-ladder.md:373`](10-responsive-ladder.md) attributes it to Heer &
Bostock; Talbot is the tick-spacing work. Nothing caught it for the whole of milestone A, because in
CSS a citation is a comment and a comment is not checked. Gate G17 now compares the committed
stylesheet against the typed tree on every run.

### 6.1d Naming — the sixth rule, and the only one about the left-hand side — added at B1 slice 2

The five rules above are all about the **value**. This one is about the **name**, and it is the only
rule on this page that can fire on a line containing no literal at all.

> Every `--gx-*` custom-property **declaration** must obey `raw/06` §6.0's grammar —
> `--<prefix>-<group>[-<element>]-<property>[-<modifier>]`, lowercase kebab, no abbreviation CSS does
> not itself use — of which the machine-checkable clause is that **`<group>` is a closed set**.

§6.0 published that grammar during milestone A and nothing enforced it. In that time the tree
accumulated `--gx-ground`, `--gx-ink`, `--gx-charcoal-*`, `--gx-corner-radius`, `--gx-elevation-*`,
`--gx-band-alpha` and `--gx-gap` — seven first segments the closed set does not contain. None was a
mistake anyone made twice. They were made once each, months apart, which is what an unenforced
convention produces rather than what a careless author does. **Slice 2 renamed all 24 tokens and added
this rule in the same change**, and the rule is the half that matters: the rename fixes the tree once,
the rule fixes it from now on.

⚠ **The enforced vocabulary is 34 groups, not §6.0's published 19, and the discrepancy is a finding
about `raw/06` rather than a relaxation of it.** §6.2–§6.9 of that same document specify 205 distinct
`--gx-*` names using 32 distinct first segments, and **13 of them are outside the closed set §6.0
publishes** — `aggregate`, `alert`, `font`, `heatmap`, `horizon`, `numeric`, `scale`, `stroke`,
`substitute`, `subtitle`, `title`, `transpose`, `value`. §6.0's list covers chart *anatomy*; the
missing ones are chart *behaviour* (§6.9's carry-over table), *text* (§6.5), and *colour* (§3.7).
A gate that copied §6.0's table verbatim would reject `--gx-title-font-size` — a name `raw/06` itself
specifies and this repo ships today. So the gate enforces the union actually in use, and the
anti-drift direction moved into a **test that parses `raw/06` §6.2–§6.9 and asserts the set contains
every first segment those sections use**. Widening the vocabulary is a code change with a reason
attached; it is not something that happens by writing a token.

One member has no `raw/06` basis at all: `annotation`, specified by
[`42-typography.md:233`](42-typography.md) and already emitted by `generate-typography-css.mjs`. It is
marked as ours in the source. The set deliberately excludes `color` — which `raw/06:1021` names as *the
failure mode to avoid* — and `cat`, an abbreviation `raw/06:873` uses in passing and §6.0 bans.

**Only `<group>` is enforced, and the restraint is the finding.** §6.0 marks exactly one segment
"closed set"; `<element>` and `<property>` are given as illustrations. A gate reading them as closed
rejects `--gx-crosshair-label-font-size`, `--gx-legend-symbol-gap` and `--gx-tick-offset-band` — all
three specified in `raw/06` — plus `--gx-label-landmark-grade`, where `grade` is a variable-font axis
and no CSS property at all. Enforcing a convention past the point its author closed it produces a gate
that is wrong more often than the code it checks.

Three further constraints are mechanical and are enforced: the name is lowercase kebab with no doubled
or trailing hyphen; the prefix may not recur mid-name (`--gx-widget-gx-radius`); and a small
**banned-segment ratchet** rejects `alpha` (→ `opacity`), `colour` (→ `color`) and `bg`
(→ `background`). The ratchet exists because `--gx-grid-alpha`, `--gx-area-alpha` and `--gx-band-alpha`
all shipped while `alpha` is not a CSS property and `opacity` is — the closed-set rule alone would not
have caught any of the three, since `grid`, `area` and `horizon` are all legal groups.

⚠ **It fires on the declaration and never on a `var()` reference**, which is what makes the report
actionable. A token is named once and read many times: `--gx-ink` had eleven reference sites, so a
reference-side check would print eleven findings for one line anybody has to edit and bury it. A
declaration is also the only place a *new* bad name can enter — a reference to a token nobody declared
is already caught one rule earlier, by §6.1c. Like §6.1c it runs **before** the positional
early-return, because the themes directory is exempt from *literals*, not from the grammar. It is the
one directory where every token in the tree is named.

### 6.2 Edge cases that must be decided now, not argued about in review

- **Unitless `0`** is not a `px` literal. Permitted everywhere. `--gx-widget-radius: 0` needs no
  exemption — which is convenient, since the default theme sets it that way (`DESIGN.md:196`).
- **Unitless numbers in `calc()`** (`calc(var(--gx-size-gap) * 2)`) are permitted. The multiplier is not a
  length.
- **`currentColor`**, `transparent`, `inherit` are keywords, not literals. Permitted everywhere —
  and `currentColor` is *mandated* for chrome (§3.1).
- **Media-query values** (`@media (prefers-color-scheme: light)`) are not declarations. Out of scope.
- ✅ **SVG presentation attributes authored in TSX are CSS-shaped but are not CSS** — a
  `<line stroke="#ddd" />` in `@gx/primitives` passes a CSS-only gate cleanly, because the gate never
  parses `.tsx`. **Decided at A1: primitives carry no visual attributes at all and take everything
  from classes.** Same discipline that makes per-widget CSS theming work, and it closes the hole
  rather than documenting it (`30-implementation-plan.md` A1, `20-architecture.md` §2).
- ⚠ **And a token can pass this gate and still do nothing.** The gate checks that a `var()` was used.
  It cannot check that the property the `var()` lands on exists. `x1`/`y1`/`x2`/`y2` on `<line>` are
  not CSS-settable in **any** browser, so a geometry token targeting them ships, is documented, is
  counted, and has no effect. This is out of reach of *any* CSS lint rule and needs gate **G14** — an
  element-set snapshot at A4. Two consequences for this document:
  - **Every geometry token's row must name the element it targets**, so the substitution is visible at
    specification time rather than discovered at render time.
  - **`<rect>` for ticks and gridlines, `<path>` where a path already exists.** See
    [`decisions/012-no-line-element-for-tokened-geometry.md`](decisions/012-no-line-element-for-tokened-geometry.md).

### 6.3 The gate must be seen to fail

CI asserts **both** directions, and both are planted:

1. The gate **passes** on `@gx/tokens` via the allowlist — asserted against a fixture theme file
   containing a token definition, a `calc()` multiplier, a unitless `0`, a `currentColor`, and a data
   URI. Every one of those is a case the regex implementation got wrong.
2. The gate **fails** on a deliberately planted raw hex in a non-allowlisted package.

A gate never observed to fail is not a gate — it is a job that exits 0.

⚠ **And the allow direction is not the ceremonial one.** It is tempting to treat (1) as a formality and
(2) as the real test. The probe in §6.1b found four false positives against two true ones: this gate's
observed failure mode is rejecting valid CSS, not missing invalid CSS. A gate that cries wolf four times
in six gets switched off by the first contributor it blocks, which fails just as completely as exiting 0
and takes longer to notice.

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

**Currency note (2026-08-24):** B1 is closed for the current line/area token tree: the neutral ramp
and named-colour gate inputs now exist in `packages/tokens/src/tokens.ts`. Items 1 and 7 below are
therefore stale wording and should be read as repository evidence to verify, not future work. The
five composition pairs in item 3 remain open until independently checked against the generated theme
compositions; the neutral-light simulation, cascade-layer, and elevation questions remain open.

1. **The six neutral hex values** (§4) — **closed for the current line/area tree**; see
   `packages/tokens/src/tokens.ts` and `30-implementation-plan.md` §B1.
2. **Whether the neutral light theme collapses like the Rail light theme does** to ΔE 5.0 (§4).
   Must be simulated, not assumed.
3. **The five unguaranteed composition pairs** (§5) — B1, per theme, per ground.
4. **Cascade layers** (§2) — Tier C, no surveyed precedent.
5. **The elevation reading** (§3.2) — an interpretation of `DESIGN.md:190`, flagged as such. Worth a
   sentence in `DESIGN.md` either way so the next reader does not have to re-derive it.
6. ✅ **SVG presentation attributes** (§6.2) — was a real hole in the gate as specified. **Closed at
   A1:** primitives carry no visual attributes at all. The residue is the *platform* half — geometry
   that CSS cannot set on `<line>` — which is [`decisions/012`](decisions/012-no-line-element-for-tokened-geometry.md)
   and gate **G14** at A4, not a theming open question.
7. **The named-colour list's shape** (§6.1a) — **closed for the current B1 gate**; the implemented
   parser and allowlist are the evidence. The full CSS colour keyword set, or a short deny-list of
   the five or six that actually get typed, remains a future maintenance choice if the token gate's
   vocabulary expands.
