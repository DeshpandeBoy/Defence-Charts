# 017 — The transition is not the hysteresis mechanism, because a rung boundary mounts

**Status:** ✅ **measured** 2026-08-24 · probe `scripts/probe-flicker.mjs` (`pnpm probe:flicker`)
**Applied to:** nothing. This record discharges A6's owed measurement and hands **B1** a specified
deadband; it changes no code.
**Affects:** `../10-responsive-ladder.md` §8 item 1, `sizeContextFromPixels()` in `@gx/core`,
milestone **B1**
**Supersedes:** nothing. **Extends:** [016](016-what-svg-geometry-actually-transitions.md) — case 12
again, one level up the tree.

---

## Context

A6 shipped the motion block on the strength of a claim `../10-responsive-ladder.md` §7 makes and §8
item 1 leans on: the transition is *"the primary hysteresis mechanism"*, and a deadband is a
*possible* later addition rather than a requirement. `../30-implementation-plan.md` was honest that
this was untested and wrote the debt down in the milestone itself:

> **This is the primary hysteresis mechanism**, not a deadband. Measure whether flicker is still
> observable afterwards; only then consider a deadband, expressed as a fraction of the boundary
> width, never as an absolute px value.

Nothing in A6 measured it. The mechanism shipped; the evidence that it suffices did not exist.

The claim is plausible on its face. A rung change that animates over 1000 ms cannot flash, and a
container that wobbles across a boundary re-triggers a transition that had not finished, so the
chart never arrives anywhere long enough to be seen arriving. That reasoning is correct as far as it
goes. It goes two steps and stops one short.

---

## Evidence

Chromium 151.0.7922.34, driven through the real playground at the Panel → Canvas edge: height fixed
at 520 px (five rows), width swept across the sixth column. That is a `recompose` change, the
expensive one.

### 1. The boundary is one pixel wide

`sizeContextFromPixels()` is `Math.floor(width / 100)`. There is no tolerance anywhere in it, and
the sweep confirms the obvious: 601 px of widget width is `panel` and 602 px is `canvas`. (The
widget carries 2 px of chrome the chart's own box does not, so the classifier sees 600 px there.)
Any wobble at all crosses it.

### 2. Above ~0.33 Hz the transition does absorb the wobble

A ±6 px wobble around the boundary, 9 s per frequency, counting crossings from the width trace
rather than from `data-size-class` — the attribute lags a frame or two behind the resize, so a count
taken from it counts renders, not crossings. A crossing is **visible** only if the previous one had
finished animating; the motion envelope is the recompose duration plus its stage delay, 1500 ms.

| Wobble | Crossings | Gap min/max | Absorbed | **Visible moves** |
|---|---|---|---|---|
| 9 Hz | 162 | 45 / 72 ms | 161 | **1** |
| 4 Hz | 72 | 114 / 139 ms | 71 | **1** |
| 2 Hz | 36 | 232 / 268 ms | 35 | **1** |
| 1 Hz | 18 | 470 / 527 ms | 17 | **1** |
| 0.5 Hz | 9 | 942 / 1058 ms | 8 | **1** |
| 0.25 Hz | 5 | 1892 / 2109 ms | 0 | **5** |

A wobble of *f* Hz crosses the boundary every 1/(2*f*) seconds, so the crossover should sit at
1/(2 × 1500 ms) ≈ **0.33 Hz**. It is observed between 0.5 Hz (absorbed) and 0.25 Hz (visible).
Prediction and measurement agree, which is the reason to trust the number rather than the run.

⚠ **The first version of this probe stopped here and would have reported that the transition
suffices.** It ran one wobble at 9 Hz — physiological hand tremor — found 161 of 162 crossings
absorbed, and concluded. The measurement was true and it answered the easy question: at 9 Hz the
crossings are 45–72 ms apart and *any* envelope over about a tenth of a second absorbs them. The
adversarial case is the **slow** wobble, someone hunting for a size by nudging the handle back and
forth every few seconds, and that is precisely the frequency band where the envelope runs out.

### 3. What crosses the boundary is not a tween

This is the finding, and it makes the first two beside the point.

`../10-responsive-ladder.md` is emphatic that a rung changes **information content**, not scale. So
the thing that happens at a boundary is not that geometry moves — it is that *elements appear*. The
census across one crossing:

| | 601 px | 602 px |
|---|---|---|
| `gx-point` | 0 | **179** |

179 `<circle>` elements mount at once. Sampling every animation frame for 700 ms after the crossing,
the computed `opacity` of the first of them takes exactly one distinct value across 84 frames:

```
1
```

**No fade. Full strength on frame one.** `chart.css` declares
`transition: … opacity var(--gx-motion-duration) …` on `.gx-point`, and it does nothing, because a
transition needs a previous computed value and a node that has just mounted has none. That is
[016](016-what-svg-geometry-actually-transitions.md) case 12 — *"a replaced element never
transitions"* — reappearing one level up: 016 found it between two renders of the same chart, and
here it is between two rungs.

So the motion envelope is irrelevant to the visible part of a rung change. At **every** frequency in
the table above, including the five where the geometry wobble is fully absorbed, 179 dots blink on
and off with no intermediate frame.

---

## Decision

**The transition is not the hysteresis mechanism. It is the polish on top of one.** §8 item 1 may
stop treating a deadband as optional.

The transition remains correct and remains worth having — it absorbs the `rescale` wobble entirely,
and at a boundary it still carries the chrome smoothly under the mounting marks. What it cannot do
is what §7 assigned to it: prevent the *content* change from flickering. Nothing declared in a
stylesheet can, because the content change is a mount.

Two mechanisms, and they are not alternatives:

| Problem | Mechanism | Status |
|---|---|---|
| Geometry wobble within a rung | `transition` — measured absorbing ≥0.5 Hz | ✅ shipped at A6 |
| Rung boundary re-crossing | **Deadband in the classifier** | ⛔ **B1**, specified below |
| A rung change the user actually asked for | `transition` under the mount | ✅ shipped at A6 |

### The deadband, as the plan requires it to be expressed

Replaying the recorded width traces through a hysteresis of *d* px, the smallest *d* that reduces
the wobble to a single crossing is **3 px at a 600 px boundary — 0.50% of the boundary width.**

⚠ That is a floor from one boundary and one amplitude, not a recommendation. It is the number below
which a deadband demonstrably does not work; a shipped value wants margin over it and wants checking
at the Micro and Tile edges, where 0.50% is under half a pixel and the quantity that matters is
probably the cell size rather than the boundary. **B1 owns the value.** What this record fixes is
the *form* — a fraction, per the plan's own instruction that it be *"expressed as a fraction of the
boundary width, never as an absolute px value"* — and the fact that one is needed at all.

⚠ **A deadband belongs in the classifier, not in `<AutoChart>`.** `sizeContextFromPixels()` is pure
and its output is the input to `planChart()`. Hysteresis is stateful by definition — it depends on
which side you came from — so it cannot go inside a pure function without changing what that
function is. Decision 10 (no DOM measurement in the resolver) and decision 8 (plan is data) both
bear on where the previous rung is allowed to live, and B1 has to answer that before it picks a
number. This record does not answer it.

---

## Consequences

- **A6's owed measurement is discharged**, and it came back negative. That is a better outcome than
  a confirmation would have been: the mechanism A6 shipped is sound, and the thing it was *claimed*
  to make unnecessary turns out to be necessary.
- **`probe-flicker.mjs` is a probe, not a gate**, on the same reasoning as `probe-motion.mjs`. There
  is nothing here to regress yet — the deadband does not exist. When B1 ships one, the assertion
  worth gating is section 2's table, which is falsifiable and cheap.
- **The crossover frequency is a function of the envelope**, so a B1 tuning pass that shortens the
  recompose duration moves it upward and makes flicker *easier* to provoke. Anyone changing
  `--gx-motion-recompose-duration` should re-run the probe; the relationship is 1/(2 × envelope) and
  the probe prints it.
- **Fading a mount is possible but is not free.** It needs the element rendered at `opacity: 0` and
  raised on the next frame, which is a second render or a JS write — decision 7's zero-client-JS
  claim is what makes `<Chart>` an RSC, and 013 already narrowed that claim once. Not a stylesheet
  change, and not A6's to make.

---

## Amendments required elsewhere

| File | Change | Status |
|---|---|---|
| `../30-implementation-plan.md` A6 | Replace *"⚠ Still owed"* with the finding | ✅ |
| `../10-responsive-ladder.md` §8 item 1 | The deadband is required, not optional; §7's "primary mechanism" claim is corrected | ✅ |
| `../maps/04-ci-gate-map.md` | Nothing — this is a probe and takes no gate number | ✅ n/a |
| `@gx/core` `context.ts` | A deadband, and a decision about where the previous rung lives | ⛔ **B1** |
