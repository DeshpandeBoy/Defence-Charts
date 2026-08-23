# 012 — No `<line>` element for anything a token must control

**Status:** ✅ **applied** 2026-08-23 · found 2026-08-23
**Applied to:** `../20-architecture.md` §2 (two invariant rows), `../30-implementation-plan.md` A1 + A4,
`../43-theming.md` §6.2, `../maps/04-ci-gate-map.md` (gate **G14**), `../01-plain-english.md`,
`../00-decisions.md`. Remaining: the per-token element column in the token tree itself, which lands
with the tree at **B1**.
**Affects:** `@gx/primitives` render tree, the `--gx-*` geometry tokens, milestone A4
**Supersedes:** nothing. **Constrains:** decision 4 (CSS custom properties as the theming mechanism)

---

## Context

Decision 4 makes CSS custom properties the theming mechanism, and the pitch built on it is *"every
knob, reachable from CSS, per widget, without JavaScript."* The token tree accordingly specifies
geometry tokens — tick length, gridline extent, crosshair length, threshold-marker size.

The unexamined assumption underneath: **that a CSS custom property can drive any SVG geometry.** It
cannot, and the exception lands precisely on the elements a chart uses most.

This surfaced sideways. The question being investigated was *why does Highcharts styled mode stop
where it stops* — it exposes tick **colour** and tick **width**, but not tick **length**. That looked
like a Highcharts limitation. It is not.

---

## Evidence

SVG2 promotes a specific list of geometry attributes to CSS properties:

| Attribute | CSS-settable | Support |
|---|---|---|
| `cx`, `cy`, `r`, `rx`, `ry` | **yes** | broad |
| `x`, `y`, `width`, `height` | **yes** | broad |
| `d` | **yes** | Chrome 79+, Safari 10.1+, Firefox 97+ |
| **`x1`, `y1`, `x2`, `y2` on `<line>`** | **no** | **not in any browser, none planned** |

Highcharts' own documentation states the reason in the same terms, and is worth quoting because it is
a shipped library conceding the point rather than a spec reading:

> *"layout and positioning of elements like the title or legend cannot be controlled by CSS"* — because
> CSS for SVG *"does not (yet …) allow geometric attributes like `x`, `y`, `width` or `height`."*

So Highcharts exposes `.highcharts-tick` replacing `tickColor` and `tickWidth`, and leaves `tickLength`
in the JavaScript options object. That is the platform boundary, drawn by a library that had every
commercial incentive to push past it.

**Independent corroboration from a second direction.** An element census of rendered output from two
libraries:

| Library | `<line>` elements | Note |
|---|---|---|
| **Vega** | **28** | ticks and gridlines, `class="mark-rule role-axis-grid"` |
| **Observable Plot** | **0** | all 8 marks are `<path>` |

A Vega chart's tick length and gridline extent are therefore structurally unreachable from CSS — an
observed instance of the failure mode, not a theoretical one. Plot, having chosen `<path>`, is not
exposed to it.

---

## The failure mode, precisely

This is what makes it worth a decision record rather than a footnote:

```
--gx-tick-length: 6px;   →   line { y2: var(--gx-tick-length); }
```

- the CSS parses
- the token lint gate passes — a `var()` was used, no raw `px` was emitted
- the build succeeds
- no console warning, no error, no devtools strikethrough on the declaration
- **the tick does not change length**

The declaration is simply not applied. A token can ship, be documented, appear in the generated token
table, be listed in the "183 specified tokens" count — and do nothing. That is the same shape as the
happy-dom failure this project already caught once: *a thing that looks like it works and quietly
doesn't.* The corpus has a name for why that class is uniquely expensive — you don't discover it, you
inherit it.

---

## Decision

**The render tree must never emit `<line>` for anything a token is expected to control.**

Three viable substitutions, all verified to accept CSS:

| Approach | Mechanism | Best for |
|---|---|---|
| `<rect>` | `width` / `height` are CSS geometry properties | Ticks, gridlines — anything axis-aligned |
| `<path>` | `d` is a CSS geometry property (Chrome 79+ / Safari 10.1+ / Firefox 97+) | Anything already path-shaped; also what Observable Plot chose |
| unit `<line>` + `transform` | `transform: scaleY(var(--gx-tick-length))` — transforms **do** apply to SVG | Retrofit, where the element must stay a `<line>` |

**Recommended default: `<rect>` for ticks and gridlines, `<path>` where a path already exists.**

`<rect>` wins for ticks on three grounds: the widest browser support of the three, no dependence on the
`d` property's narrower floor, and geometry that reads directly — `width` is the stroke thickness,
`height` is the tick length, both plain CSS lengths. The `transform: scaleY()` route works but scales
the stroke with it unless `vector-effect: non-scaling-stroke` is added, which is a second thing to
remember and therefore a second thing to forget.

**A `<line>` remains legal for anything no token controls.** This is a constraint on tokened geometry,
not a ban on the element.

---

## Consequences

- **This is a milestone A4 decision, not a milestone B cleanup.** A4 builds `@gx/primitives`; the
  element choice is baked into `Axis` and `Grid` there. Discovering it at B1 means rewriting the
  render tree with thirty tokens already documented as working.
- **The token lint gate cannot catch this**, in either direction. It checks that a `var()` was used,
  not that the property it lands on exists. A new check is needed — see below.
- **It slightly weakens the CSS-native theming pitch**, which is the correct outcome given 013 and
  014: geometry-via-CSS is possible but only on a restricted element set, and saying so is more
  credible than the unqualified claim.

### The gate this needs

⚠ **New, and not yet in [`../maps/04-ci-gate-map.md`](../maps/04-ci-gate-map.md).** A lint rule over
`@gx/primitives` source: no `<line>` element may carry `x1`/`y1`/`x2`/`y2` sourced from a `var(--gx-*)`
value, and — the stronger form — a snapshot of the emitted element set per chart type, so a `<line>`
appearing where a `<rect>` was is a reviewable diff rather than a silent regression.

Cheap to write at A4. Nearly impossible to retrofit once the tokens are published as working.

---

## Amendments required elsewhere

| File | Change |
|---|---|
| `../20-architecture.md` | Add as a hard constraint **alongside** decision 10's no-DOM-measurement rule — the two are the same species: platform facts that push the architecture somewhere better rather than obstacles to route around |
| `../43-theming.md` | Any geometry token's row should name the element it targets |
| `../30-implementation-plan.md` A4 | Add the element-set snapshot gate |
| `../maps/04-ci-gate-map.md` | Add the new gate to the register |
| `../maps/00-system-map.md` | ✅ already carries the rule, pointing here |
| `../maps/03-token-flow.md` | ✅ already carries it at step 5 |

---

## What would overturn this

A browser shipping CSS-settable `x1`/`y1`/`x2`/`y2`. **There is no such proposal**, so this is not a
"wait and see" — but if one appeared, the decision would relax rather than reverse: `<rect>` ticks
would keep working, and `<line>` would merely stop being disqualified.

The narrower thing worth re-checking before A4 lands: whether the `d`-as-CSS-property floor
(Firefox 97) is still relevant to our stated browser support. If it is not, `<path>` becomes as safe
as `<rect>` and the recommendation simplifies to one option.
