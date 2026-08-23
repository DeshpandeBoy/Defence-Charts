# 016 — What SVG geometry actually transitions, and what has to crossfade instead

**Status:** ✅ **measured** 2026-08-24 · probe `scripts/probe-motion.mjs` (`pnpm probe:motion`)
**Applied to:** nothing yet — this record is the input to **A6**, not a report of it.
**Affects:** `@gx/primitives` `chart.css` and the `<Grid>`/`<Axis>` element keys, `MotionPlan`,
milestone **A6**
**Supersedes:** nothing. **Extends:** [012](012-no-line-element-for-tokened-geometry.md) — same
question one step further along.

---

## Context

`../20-architecture.md` §7.4 sketches A6's mechanism in a single line:

```css
@media (prefers-reduced-motion: no-preference) {
  .series { transition: d var(--gx-motion-duration) ease; }
}
```

If that works, A6 costs a stylesheet and **zero new JavaScript in the render path** — which is the
only version compatible with decision 7 and with 013's narrowed zero-JS claim. If it does not, A6
needs a client-side tween library, `<Chart>` stops being hook-free, and the 124 B page-JS number dies.
The whole milestone turns on it, and it was written as an assumption.

**012 does not answer it.** 012 asked *"can a custom property set this geometry?"* and answered by
element. This asks *"if React sets the **attribute**, does a `transition` on the mapped property
produce intermediate frames?"* Those come apart in three places: a property can be settable and still
not interpolate; interpolation can depend on the *shape* of the two values rather than on the property;
and a transition needs a previous computed value on **the same element**, which React only provides if
the element's key is stable.

That third one is not hypothetical here. `<Grid>` and `<Axis>` key their children by `tick.offset` —
a **pixel** position — so every resize changes every key and React replaces every gridline. If a
replaced element cannot transition, §7.4's snippet describes something that cannot happen in our tree
regardless of what `d` does.

---

## Evidence

`scripts/probe-motion.mjs`, run against **Chromium 151.0.7922.34**. Each case sets an initial
attribute, arms a `transition` on the mapped property, forces a style flush, changes the **attribute**,
and samples the computed value across 8 animation frames at 600 ms linear. Every case runs twice — once
default, once under Playwright's `reducedMotion: 'reduce'`.

The verdict is *"did any sampled value differ from **both** endpoints"*. That phrasing is load-bearing:
the first sampled frame is usually still the start value, because a transition begins on the frame
after the change, so *"differs from final"* alone would report a snap as a tween.

| Case | Animates | `reduce` suppresses | Same final value | Mid-flight sample |
|---|---|---|---|---|
| **CONTROL** — `opacity` on `<rect>` | **yes** | yes | yes | `0.983776` |
| `d` on `<path>` — **equal** command count | **yes** | yes | yes | `path("M 0 0 L 10.2783 20.5567 …")` |
| `d` on `<path>` — **unequal** command count | **no** | yes | yes | none |
| `x` on `<rect>` | **yes** | yes | yes | `0.625px` |
| `y` on `<rect>` | **yes** | yes | yes | `0.84px` |
| `width` on `<rect>` | **yes** | yes | yes | `21.1163px` |
| `height` on `<rect>` | **yes** | yes | yes | `6.334px` |
| `cx` on `<circle>` | **yes** | yes | yes | `11.1133px` |
| `cy` on `<circle>` | **yes** | yes | yes | `10.84px` |
| `r` on `<circle>` | **yes** | yes | yes | `3.07944px` |
| `transform` on `<g>` | **yes** | yes | yes | `matrix(1, 0, 0, 1, 1.11067, 0.6…)` |
| **REPLACED element** — new node, final value | **no** | yes | yes | none |

The control interpolated, so the harness is sound and the two `no` rows are findings rather than
instrument failure. That check is in the script and prints a warning if it ever inverts.

### The three results that matter

**1. `d` tweens on a resize.** `path("M 0 0 L 10.2783 20.5567 …")` is a real interpolated frame between
`M0,0L10,20L20,15` and `M0,0L20,40L40,30`. §7.4's snippet is correct as written, for the case it will
spend almost all of its time in — a drag changes the *coordinates* of a series, not the number of
points. **A6 needs no tween library and no new hook.**

**2. `d` snaps when the command count changes.** No intermediate value at all. This is exactly a
point-budget change or a mark substitution — a *rung* change rather than a *size* change.

⚠ Notice that this lands precisely on a seam `MotionPlan` already draws. `durationClass: 'rescale'`
is the equal-command-count case and `'recompose'` is the unequal one. The type was designed before this
was measured, from Heer & Robertson's staged-transition work, and the platform turns out to split in
the same place. That is a coincidence worth banking rather than a design to redo.

**3. A replaced element does not transition, ever.** Confirmed directly. Every gridline in the current
tree is replaced on every resize, so **the keys are a prerequisite for A6, not an optimisation
alongside it.** `MotionPlan.persistGridlines: true` — already `true` from the Panel rung up — is
unimplementable until they change.

**4. Reduced motion is clean in every row.** `reduce` suppressed the tween in all twelve cases, and the
final computed value was identical with and without it in all twelve. The invariant A6 rests on holds:
reduced motion removes the tween and never changes the result. Note *how* that was obtained — the page
puts `transition-duration` **inside** `@media (prefers-reduced-motion: no-preference)` and nothing
outside it, so `reduce` is the *absence* of a rule rather than a second rule. That is the opt-IN
polarity `chart.css` already uses, and it is why the column is trustworthy: there is no second code
path that could drift.

---

## Decision

**A6 animates in CSS. No tween library, no new hook, no client JavaScript in the render path.**

Three mechanisms, chosen per case by what the probe found:

| Situation | Mechanism | Why |
|---|---|---|
| Size change at the same rung (`rescale`) | `transition` on `d`, `x`/`y`/`width`/`height`, `cx`/`cy`/`r`, `transform` | All measured interpolating |
| Rung change altering the command count (`recompose`) | **Crossfade on `opacity`** between outgoing and incoming marks | `d` is discrete here; `opacity` is the control case and is known-good |
| Anything a token must also control | unchanged — 012 still governs the element choice | `<rect>` for ticks and gridlines, `<path>` for lines |

**The named substitution for the discrete case is a crossfade, not a padded command list.** Padding
both paths to a common command count would make `d` interpolate — it is what a tween library does — but
it requires computing the padding, which is JavaScript in the render path, and it produces a shape that
is briefly neither the old nor the new chart. A crossfade is one property, already proven, and it reads
as *"this became a different chart"*, which at a rung boundary is the honest thing to say.

**Prerequisite, not a parallel task: `<Grid>` and `<Axis>` must key by `ComputedTick.value`, not by
`tick.offset`.** Result 3 makes this blocking.

---

## Consequences

- **§7.4's snippet is validated and needs one caveat added**, not a rewrite. It is correct for
  `rescale` and silently wrong for `recompose`.
- **Decision 7 and 013 survive A6 intact.** This was the risk; it did not materialise.
- **The `stages: 2` half of `MotionPlan` is a `transition-delay`**, which needs no new evidence — it is
  a second declaration on the same properties already measured.
- **This probe is not a gate and does not run in CI.** Nothing currently stops a future edit from
  transitioning a property that does not animate, which would fail exactly the way 012 describes: the
  CSS parses, the token gate passes, and nothing moves. A gate is proposed below.
- **Chromium only.** Firefox and Safari are inference from the SVG2 property list, not measurement.
  `d`-as-CSS-property has the narrowest floor of everything tested (Firefox 97+), and it is the one
  case where a browser difference would be invisible rather than loud — the chart would simply snap.

---

## Amendments required elsewhere

All seven landed at **A6**, on 2026-08-24. The status column is kept rather than deleted because
the interesting column is the third one: two rows turned out to require more than they asked for.

| File | Change | Status |
|---|---|---|
| `../20-architecture.md` §7.4 | Add the equal-command-count caveat to the `transition: d` snippet | ✅ — and the snippet itself was wrong: `.series` is not a class we emit, and the section asserted that declaring a transition suffices, which is what case 12 falsifies |
| `../30-implementation-plan.md` A6 | Record the mechanism, and that the keys are a prerequisite | ✅ |
| `packages/primitives/src/{Grid,Axis}.tsx` | Key by `ComputedTick.value`. **Blocking.** | ✅ — and `computeTicks()` in `@gx/core` had to de-duplicate by value first, or the new key collides where the old index suffix used to cover it |
| `packages/primitives/src/chart.css` | The real transitions; the existing block says it is "the affordance, not the animation" | ✅ |
| `packages/tokens/src/themes/theme.css` | A `--gx-motion-*` group; there is none today | ✅ — seven tokens, and the stage delay had to be named per duration class rather than derived from `--gx-motion-duration`; see the ⚠ there |
| `../maps/04-ci-gate-map.md` | A motion gate. ⚠ **Number it G19** — `../60-commercial-model.md` §7 already claims G18 | ✅ — G19 it is, `scripts/check-motion.mjs`, in CI |
| `scripts/check-tokens.mjs` | Its `LENGTH_UNITS` has no **time** units, so `120ms` in `chart.css` is an untokened literal it cannot see. A6 adds more | ✅ — `TIME_UNITS`, with a `0`/`0ms` exemption so `--gx-motion-stage-delay: 0ms` needs no token of its own |

---

## What would overturn this

- **A browser shipping interpolation between unequal command lists.** The CSS Shapes/`d` interpolation
  rules permit it in principle where the path segments correspond; if Chromium implemented it, the
  crossfade would become an optimisation rather than a necessity. Re-run the probe.
- **A measured difference in Firefox or Safari.** Extending the probe to the other two engines is
  cheap — `openChromium()`'s sibling launchers already exist in Playwright — and is the obvious next
  pass if any of this reaches a public claim.
- **Findings with a shelf life.** As `013` notes about its own tests: this is a measurement of one
  browser on one date, and the version is recorded above precisely so a future reader can tell whether
  it is still current.
