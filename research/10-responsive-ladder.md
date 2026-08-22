# The responsive semantics ladder

> **v2** — reconciled against `raw/05-theory-responsive-viz.md`.
> v1 was written from first principles + the Basedash frame evidence. The literature confirmed the
> structure, renamed most of the vocabulary, corrected four numbers, and **contradicted one
> structural assumption**. All changes are marked ⚠ below.

This is the core IP of the library. Everything else — grid, tokens, packaging — is plumbing that
exists to serve this document.

---

## 0. What the literature changed

| # | v1 said | Literature says | Status |
|---|---|---|---|
| 1 | The ladder is a **diff** — each rung lists what is *added* relative to the smaller one. | Kim et al.'s 378-pair corpus documents **additions that occur only at small size**: summary text, call-out lines, context views, and even legends. | ⚠ **Structural change.** Ladder is now a **per-rung complete spec**, not a diff. |
| 2 | Eight verbs, invented. | Two published taxonomies exist and nest. All eight map to published names; **ten more transformations exist that we had no verb for.** | ⚠ Vocabulary replaced with the published one. |
| 3 | "Legend is a last resort; prefer direct labelling whenever there is room." | Legends observed being *added* and *internalised* at small size (E222, E116, E158). The published pattern is externalise-at-large / internalise-or-add-at-small. | ⚠ Rule inverted at the small end. |
| 4 | `xTicks = clamp(floor(width/90), 2, 8)` | Talbot 2010 targets ~1 tick per **100 px**; lower bound of 2 confirmed *by name*; **no upper cap exists** — density is a continuous penalty. | ⚠ Divisor 90→100, upper clamp removed. |
| 5 | Labels collide → rotate 45°. | Talbot's published order is **abbreviate → split → rotate**, rotation "a last resort … penalized heavily". | ⚠ Two steps inserted. |
| 6 | `aggregateAfter: 8` implied as a perceptual threshold. | Bar and donut remain usable to **24 categories at 320×320 px**. 8 is a *legend-scannability* choice. Radial's real ceiling is ~7. | ⚠ Reclassified, not changed. |
| 7 | Line charts just get smaller at small rungs. | Below ~24 px plot height a line degrades measurably; the published fix is to **change encoding** (horizon/band), not shrink. | ⚠ New rung added. |
| 8 | Rescale is open-ended at large sizes. | "Little benefit for increasing chart height beyond **80 px**." | ⚠ **This is the strongest published argument for the entire library.** Past saturation, extra space must buy *content*, not plot area. |
| 9 | Hysteresis needs an ~8 px deadband. | No viz paper studies hysteresis at all. CSS prevents the cycle **structurally**; ResizeObserver **terminates and errors** rather than damping. Animation converts flicker into smear. | ⚠ Mechanism replaced; deadband demoted to fallback. |

---

## 1. The mechanism

A widget does **not** read the viewport. It reads **its own content box**.

```
grid cell size (w,h)  ─┐
                       ├─→  SizeContext  ─→  ChartPlan  ─→  render
measured px (via RO)  ─┘         ▲               ▲
                                 │               │
                        consumer override   per-type rules
```

1. `useElementSize()` — one `ResizeObserver` per widget, `contentBoxSize`, rAF-batched.
2. `resolveSizeClass({ cols, rows, width, height })` → a `SizeClass` plus an `aspect` bucket.
   Cells alone are not enough: 12 cells at 1440px is a very different box than 12 cells at 2560px.
3. `planChart(type, ctx, shape, overrides)` → a **`ChartPlan`**: a plain, serialisable,
   fully-overridable object of feature flags and numbers.
4. The renderer is dumb. It draws exactly what the plan says. No renderer ever calls `window`.

The `ChartPlan` being a plain object is the whole design. It makes the behaviour inspectable,
testable without a DOM, snapshot-able, isomorphic (see decision 7), and **overridable at any level**:

```tsx
<Chart plan={{ legend: 'hidden', ticks: { x: 4 } }} />        // hard override
<Chart planFn={(p, ctx) => ({ ...p, aggregateAfter: 5 })} />  // programmatic
```

### 1.1 ⚠ The containment rule — non-negotiable

The measured element's size **must be grid-determined, never content-determined**, and the plan may
only affect **descendants** of the measured box.

This is not a style preference; it is how CSS itself solves this exact problem. The Conditional Rules
spec refuses sibling-size queries precisely because "it would introduce layout cycles", and
`ResizeObserver` responds to an unresolved cycle by **throwing an error**, not by damping. If a plan
change can alter the size of the box being measured, we have built an infinite loop, and no deadband
will save us — it will only slow the loop down.

**Testable consequence:** a CI test drags a widget across every rung boundary of every chart type and
asserts the `ResizeObserver` loop error never fires. That single test protects the whole architecture.

---

## 2. The transformation vocabulary ⚠

v1 invented eight verbs. Two published taxonomies exist and they nest — Kim et al. explicitly extend
Hoffswell et al.'s Action dimension. **We adopt the published vocabulary**, because a library whose
central claim is "we change information with size" should speak the language the field already has.

- **Hoffswell, Li & Liu (CHI 2020)** — 6 actions × 5–6 components.
  Actions: `no change`, `resize`, `reposition`, `add`, `modify`, `remove`.
- **Kim, Moritz & Hullman (EuroVis 2021)** — 76 strategies = 5 Actions × 5 Targets.

### Actions (what happens)

| Action | Leaves | Our v1 verb | Notes |
|---|---|---|---|
| **Recompose** | `remove` · `add` · `replace` · `aggregate` | Reveal/Conceal, Substitute, Aggregate | `remove` is the most common action in **both** corpora. `aggregate` is data-specific — you cannot aggregate a layout. |
| **Rescale** | `bigger` · `smaller` | Rescale, Relabel (partly) | Label abbreviation lives here, not under a labelling verb. |
| **Transpose** | `serialize` · `parallelize` · `axis-transpose` | Reflow, Transpose | v1's "Transpose" was only their `axis-transpose` leaf. `serialize layout` is one of the most frequent strategies in the corpus. |
| **Reposition** | `externalize` · `internalize` · `fix` · `fluid` · `relocate` | Reflow (partly), Relabel (partly) | ⚠ **`fix`/`fluid` was entirely missing from v1** — see §5.4. |
| **Compensate** | `toggle` · `number` | *(none)* | ⚠ **Wholly missing from v1.** This is the published answer to our own rule "aggregation must be visible". |

### Targets (what it happens to)

`Data` (record / field / level) · `Encoding` · `Interaction` (feature / trigger / feedback) ·
`Narrative` (sequencing / annotations / emphases / text) · `References & Layout` (labels /
references / layout / size).

⚠ **`Interaction` and `Narrative` were not targets in v1 at all.** Both matter here: Hoffswell et al.
found most mobile versions *removed* interactivity rather than adapting it, and on a 1×1 tile a hover
target is below fat-finger thresholds.

### The two we most need to internalise

**`Compensate`.** When density forces removal, preserve the information rather than losing it — make
it `toggle`-able, or leave a **numeric marker at the original position** of the thing you moved.
v1's rule "aggregation must be visible" was correct but vague; this gives it two concrete mechanisms.

**`Fix` / `Fluid`.** Whether an element is pinned or flows. The corpus documents `fix tooltip
position` — pin the tooltip to an edge on small screens instead of floating it at the cursor. For a
1×1 widget, a floating tooltip is unusable. v1 had **no tooltip placement rule whatsoever**.

**All actions are invertible.** Kim et al. state the taxonomy works small→large as well as
large→small. The `ChartPlan` must express both directions, which is the formal reason §0.1 forced
per-rung specs.

---

## 3. Size families

Named after the information budget, not the pixels — the Apple widget-family idea applied to a
12-column grid. Ranges are in grid cells and assume a roughly square nominal cell.

| Family | Cells (w × h) | Information budget | Governing rule |
|---|---|---|---|
| **Micro** | 1×1 | One number. Maybe one glyph. | Glanceable. No axes ever. No hover. |
| **Tile** | 2×1 – 2×2 | One number + one supporting fact | Still glanceable. Tap, not hover. |
| **Strip** | 3×1 – 4×2 | Headline + compact chart, no y-axis | Trend shape, not values. |
| **Panel** | 3×3 – 6×4 | Real chart. Axes, ticks, direct labels. | The default. Most widgets live here. |
| **Canvas** | 6×5 – 8×6 | Chart + legend + values + annotations | Room to be explicit rather than implied. |
| **Stage** | 9×6 – 12×8+ | Everything, plus secondary detail | Small multiples, breakdown, footnotes. |

Aspect matters independently. A 6×2 is `Strip` even though it has 12 cells; a 2×6 is a portrait
oddity that should mostly `axis-transpose`.

⚠ **The families are now anchored to published plot-height numbers**, which is why they are not
arbitrary:

| Plot height | What the literature says | Family boundary it justifies |
|---|---|---|
| **6 px** | 2-band horizon still readable (Heer 2009) | absolute floor for any time-series mark |
| **24 px** | optimal for line / 1-band; **below this, change encoding** (Heer 2009) | Tile → Strip |
| **> 40 px** | below this, value estimation error rises significantly, p < 0.001 (Heer & Bostock 2010) | Strip → Panel — **this is where a chart earns the right to claim values** |
| **80 px** | "little benefit for increasing chart height beyond 80 px" (Heer & Bostock 2010) | Panel → Canvas — **past here, extra space buys content, not plot** |

That last row is the empirical justification for the entire library, and it should be quoted in the
README.

---

## 4. Per-type ladders ⚠

**Read as complete specs, not diffs.** Each row states everything that renders at that rung. A rung
may contain something a *larger* rung does not — that is the point of §0.1.

### Line / area

| Family | Renders |
|---|---|
| Micro | `replace` → single latest value. **+ summary phrase** ("↑ 12% this week") — the small-size-only `add`. |
| Tile | Value + delta + sparkline. No axes, ticks, or gridlines. **If plot height < 24 px: `replace` encoding with a 1-band horizon** rather than shrinking the line. |
| Strip | Line, x-axis endpoints only (first/last). No y-axis. Explicitly does **not** claim value legibility — plot height is under 40 px. |
| Panel | y-axis 3–4 ticks, horizontal gridlines only, x-axis ticks per §6, direct end-of-line series labels. |
| Canvas | Ticks per §6, y-axis title, point markers, legend if > 4 series, crosshair + tooltip. |
| Stage | Annotations, min/max/last call-outs, band/threshold shading, optional secondary axis, small multiples if series > 4. |

⚠ New rules: the 24 px encoding switch (Tier B, Heer 2009); the Micro summary phrase (Kim et al.'s
small-only `add`); horizon bands capped at **3** ("we discourage 4 or more bands").

### Bar (vertical) / timebar

| Family | Renders |
|---|---|
| Micro | `replace` → single total. |
| Tile | Total + micro bar strip, no labels. |
| Strip | Bars + first/last x label only. |
| Panel | y-axis 3–4 ticks, gridlines, x labels degraded per the §6 ladder, `axis-transpose` to horizontal as the final step. |
| Canvas | Value labels above each bar, legend for grouped/stacked, axis titles. |
| Stage | Grouped bars `serialize` into small multiples; error bars; per-bar annotations. |

⚠ Corrected: the transpose-above-10-categories heuristic is **UNVERIFIED** — it came from Basedash's
docs, which is a product convention, not research. Bars stay legible to 24 categories at 320 px. Keep
10 as a *default*, document it as taste, and let collision detection be the real trigger.

### Pie / donut ← the rung we have direct visual evidence for

| Family | Renders |
|---|---|
| Micro | `replace` → single total number. |
| Tile | Donut, no labels, centre total. |
| Panel (square) | Donut + centre total; slices ordered desc; **legend `internalize`d or absent**. |
| Canvas (landscape) | `serialize` → side-by-side: donut right, legend `externalize`d left with dot + name + value + percent. `aggregate` tail into "Other". |
| Stage | Leader-line direct labels on large slices, "Other" becomes expandable, prior-period comparison. |

`aggregate` rule: bucket into "Other" once `categories > aggregateAfter` (default 8) **or** any slice
`< 2%`. The observed frame showed exactly 8 named + `Other 19 (6%)`.

⚠ Both numbers are ours. 8 is legend scannability, **not** perception — donuts survive to 24
categories. The 2% minimum slice has no published basis. Document both as taste.

⚠ `aggregate` requires object constancy: slices must **visibly converge** into "Other". A silent
relabel violates semantic correspondence (Heer & Robertson 2007). This upgrades v1's "aggregation
must be visible" from a tooltip rule to an **animation requirement**.

### Scatter

| Family | Renders |
|---|---|
| Tile | `replace` → correlation value or point count. |
| Strip | Points only, no axes. |
| Panel | Both axes, 3–4 ticks each, no point labels. |
| Canvas | Legend for the colour dimension, trend line, axis titles. |
| Stage | Outlier labels only, marginal distributions, brush-to-zoom. |

Above `pointBudget` (default ~2000 in SVG) switch the renderer to canvas rather than dropping data —
**never silently sample**. ⚠ This is a *rendering-performance* threshold with no perceptual basis and
must be documented as one.

### Funnel

| Family | Renders |
|---|---|
| Tile | `replace` → overall conversion %. |
| Strip | `axis-transpose` to horizontal bars — funnels need height. |
| Panel | Vertical funnel, stage names + values. |
| Canvas | Per-stage drop-off deltas. |
| Stage | Absolute + relative conversion, per-stage breakdown. |

### KPI / number

| Family | Renders |
|---|---|
| Micro | Value only, auto-fit type size. |
| Tile | Value + delta + comparison basis (`+1%  (54.7K)`). |
| Strip | Value + delta + period label + sparkline beside the value. |
| Panel | Value block above a full chart — the composite widget seen in the demo. |

This type is the proof that widget = composition, not a single mark. `NumberDisplay` and `TimeBar`
are separate components the plan may combine.

### Activity heatmap

| Family | Renders |
|---|---|
| Tile | `replace` → total count. |
| Strip | Last N weeks only, no labels. |
| Panel | Full range, weekday axis, month labels. |
| Canvas | Intensity legend, day-of-week labels spelled out. |
| Stage | Per-cell values on hover, streak annotations. |

`aggregate` rule: cell size floor `minCell` (default 8px); below it, **bin weekly** rather than
shrinking further. ⚠ The 8 px is UNVERIFIED as a *cell* size — it coincides numerically with Heer &
Bostock's gridline result, but that finding is about tracing gridlines to labels. **Do not cite it.**

### Progress

| Family | Renders |
|---|---|
| Micro | Ring, no text. |
| Tile | Ring + percent. |
| Strip | `replace` → horizontal bar + current/target. |
| Panel | Bar + current/target/remaining + pace indicator. |

✅ The ring→bar substitution is **twice-replicated**: Blascheck 2018 and While et al. 2024 both rank
radial slowest. While et al.'s title is literally *"Radial is Preferable for Displaying Task Progress
and Completion"* — worth reading before assuming the ring is the worse choice everywhere.

---

## 5. Rules that apply to every type

### 5.1 Never overlap text ✅
Measure, then sparsify. Confirmed: Talbot 2010 forbids overlap outright and penalises labels closer
than **1.5 em**. Collision detection beats any breakpoint guess.

### 5.2 ⚠ Labels degrade in a published order
`abbreviate → split → rotate → axis-transpose`. Rotation is "a last resort … we penalize [it]
heavily". v1 jumped straight to rotation and skipped two steps. The final transpose step is ours.

### 5.3 ⚠ Legend placement is not monotonic
The published pattern is **externalise-at-large / internalise-or-add-at-small**. v1's "legend is a
last resort, prefer direct labels" holds in the middle of the range but is wrong at the small end,
where a compact internal legend is a documented strategy and direct labels do not fit.

### 5.4 ⚠ Interaction degrades on its own ladder
Not an afterthought — a first-class Target.

| Family | Interaction |
|---|---|
| Micro / Tile | None. Hover targets are below fat-finger thresholds. Whole widget is one tap target. |
| Strip | Tap-to-reveal value. Tooltip `fix`ed to the widget edge. |
| Panel | Hover crosshair; tooltip still `fix`ed. |
| Canvas / Stage | Tooltip goes `fluid` (follows cursor); brush, zoom, legend toggling. |

### 5.5 Compensate rather than lose ⚠
When something is removed for density, prefer `toggle` (it can be revealed) or `number` (a numeric
marker remains at its original position) over silent loss.

### 5.6 Substitution is capped ✅
A consumer can pin `substitute: false`. Confirmed in kind: Heer 2009 caps horizon bands at 3.

### 5.7 Past 80 px of plot height, spend space on content ⚠
Not more plot. This is the library's thesis, and it has a citation.

### 5.8 Every threshold is a token, and every token declares its provenance
See §6. No magic numbers in renderers.

---

## 6. Thresholds, with provenance ⚠

Every number ships in one of **four** tiers. **The tier is part of the public documentation.** A
library that claims to be principled about visual density must be honest about which of its numbers
are research and which are taste. This is a differentiator, not a disclaimer.

⚠ **Tier A splits in two** (adopted from `raw/06` §6.1, and applied retroactively here). The two
kinds of "verified" are not the same kind of evidence:

- **A-lit** — research literature or a W3C/CSS spec. Evidence about **human vision**.
- **A-impl** — verified source of a shipped library. Evidence about **convention**. Where ≥3
  independent libraries agree, note the convergence — it is the only extra evidence available.

Four libraries defaulting line stroke to `2px` tells you what looks *normal*, not what is *legible*.
Collapsing both into one tier would let convention masquerade as perception research — precisely the
overclaim this system exists to prevent. **Every token in this section is A-lit**; the A-impl tokens
live in `raw/06` §6 and dominate the presentation half of the tree.

### Tier A-lit — published perception research, citable

| Token | Value | Source |
|---|---|---|
| `gridline-min-spacing` | 8 px | Heer & Bostock 2010 |
| `gridline-alpha` | 0.2 | Heer & Bostock 2010 — ⚠ see conflict below |
| `label-min-spacing` | 1.5 em | Talbot 2010 |
| `ticks-min` | 2 | Talbot 2010 ("our lower bound") |
| `tick-target-spacing` | **100 px** | Talbot 2010 (~1 tick per 100 px) |
| `axis-min-length` | 30 px | Talbot 2010 |
| `domain-max-whitespace` | 20 % | Talbot 2010 |
| `plot-height-optimal` | 24 px | Heer, Kong & Agrawala 2009 |
| `plot-height-min-for-values` | 40 px | Heer & Bostock 2010 |
| `plot-height-saturation` | **80 px** | Heer & Bostock 2010 |
| `horizon-min-height` | 6 px | Heer 2009 |
| `horizon-max-bands` | 3 | Heer 2009 |
| `categories-max-legible` | 24 | Blascheck 2018; While et al. 2024 |
| `categories-max-radial` | 7 | Blascheck 2018; While et al. 2024 |
| `transition-duration` | ~1000 ms | Heer & Robertson 2007 |
| `widget-padding` | 16 px | Apple HIG (spec, not study): *"the standard margin width for widgets"* |

**Tick count is therefore `max(2, round(width / 100))` with no upper cap** — v1's `/90` and its
clamp of 8 are both gone.

⚠ **These are the plan-input tokens**, so per `20-architecture.md` §3.2 they ship as **TypeScript
token objects, not CSS custom properties** — they are arguments to a pure function and must be
identical on server and client. The A-impl tokens (stroke, colour, radius, gap) are the CSS half.

**A convergence worth naming:** Heer & Robertson 2007's ~1000 ms and Adobe Spectrum's shipped
`DRAW_IN_ANIMATION_DURATION_MS = 1000` agree *exactly* — one from a controlled study, one from
production code, arrived at independently. That is the strongest form of evidence the tier system can
produce, and the transition duration should be documented with both citations rather than one.

### ⚠ 6.1 Two verified tokens that cancel each other out

The single most important finding from `raw/06` §6, because it is a **shipped-default bug**, not a
documentation nicety:

| Token | Default | Tier | Source |
|---|---|---|---|
| `grid-color` | `#ddd` | A-impl | Vega, Nivo |
| `grid-opacity` | `0.2` | A-lit | Heer & Bostock 2010 |

These are **two independent solutions to the same problem** — *make gridlines recede so they do not
compete with the data*. Vega and Nivo solve it by desaturating the colour; Heer & Bostock solve it by
lowering the alpha. Each is correct alone. Composed, they multiply: `#ddd` at 20 % opacity on white is
effectively invisible, and both numbers would carry a Tier A label while producing a chart with no
visible grid.

**Resolution: `grid-color: currentColor` + `grid-opacity: 0.2`.** `currentColor` inherits the text
colour, so the gridline is a *dimmed version of the foreground* — which is what both sources were
approximating — and it adapts to light and dark themes for free, whereas `#ddd` inverts wrongly on
dark. The alpha token keeps the A-lit provenance; the colour token becomes B (ours, consistent).

**The general lesson, and it applies to the whole token tree:** provenance is per-token, but
*correctness is per-composition*. Two Tier A defaults can be individually citable and jointly wrong.
Any token pair that modulates the same perceptual channel — colour × opacity, stroke width × dash,
font size × weight — needs a composed check, not just two good citations. Add this to the token
review checklist in B1.

### ⚠ 6.2 A deliberate divergence from a verified source

Adobe Spectrum's `CHART_SIZE_SCALE_RATIOS` are `0.75 / 1 / 1.25` — numerically identical to Apple
visionOS's 75–125 % user-scaling range, another independent convergence. We adopt the ratios.

We do **not** adopt what Spectrum applies them to. Spectrum scales **stroke width down** at small
sizes. That is backwards:

- Okabe–Ito CUD guidance calls for *thicker* strokes where discrimination is hardest.
- CSS optical sizing follows the same principle typography does — small sizes need *more* weight, not
  less, to hold their edge.
- Our own §5.5 rule ("compensate rather than lose") says the same thing in ladder terms: a chart that
  is losing information to size should spend what it has left on legibility.

**Decision: the size ratio applies to gaps, padding and label offsets — never to stroke width, point
radius or tick length.** Spacing can shrink because whitespace degrades gracefully; a 1.5 px line does
not. Document this as a stated disagreement with a verified source, with the reasoning above, rather
than silently diverging — a reader who knows Spectrum will otherwise assume we got it wrong.

### Tier B — ours, consistent with published work
`label-degrade-order` (`abbreviate→split→rotate→transpose`) · `aggregate-after: 8`
(legend scannability, *not* perception) · `substitute-below-height: 24 px` (line→horizon).

### Tier C — ours, no published basis. Say so.
`transpose-after-categories: 10` · `aggregate-min-slice: 2%` · `donut-reflow-aspect: 1.4` ·
`heatmap-min-cell: 8px` · `point-budget: 2000` (rendering, not perception) ·
`legend-max-entries: 8` (**no published number for legend capacity exists**) ·
min bar width / bar gap / point separation / stroke width · `hysteresis-deadband`.

⚠ Several Tier C entries have an **A-impl** counterpart in `raw/06` §6 — stroke width, bar gap and
point separation all have convergent library defaults. Promote those from C to A-impl rather than
leaving them as invention, and say which kind of evidence backs each.

### ⚠ Cross-cutting caveat
Heer 2009 states thresholds in **millimetres**, Talbot 2010 in **labels per inch**. Every A-lit
token is an angular-size claim wearing pixel clothing. At 2× and typical viewing distance they align
reasonably, but print, kiosk, or watch output needs a density multiplier. Flagging now because all of
A-lit inherits the assumption.

---

## 7. Transitions ⚠

Wholly absent from v1, and it turns out to be the answer to v1's hardest open question.

- **Animate rung changes; do not cut.** ~300–1000 ms. Rescale-only changes are minimal-movement and
  belong at the fast end.
- **Stage any change that both rescales an axis and changes marks.** Stage 1 axis/ticks, stage 2
  marks. Never more than two stages.
- **Persist gridlines through a densify/sparsify change** — they are the landmarks that make an axis
  change comprehensible. Do not remove and redraw.
- **Object constancy is mandatory for `aggregate`** — slices must visibly merge into "Other".
- Fade for add/remove; grow-from-baseline for bars; avoid rotation.
- Respect `prefers-reduced-motion`: cut instead, and skip staging.

**⚠ Animation is the primary hysteresis mechanism.** A ~1 s eased transition means a boundary crossed
twice inside a second reads as one continuous motion rather than two jumps. Animation converts
flicker into smear. Combined with §1.1's containment rule — which prevents a true loop — a spatial
deadband may not be needed at all.

*(Flagged honestly: the research marks this inference as a design argument, not a citation. No paper
retrieved makes the claim.)*

---

## 8. What is still open

1. **Is the deadband needed at all?** Build containment + animation first, measure, and only add a
   deadband if flicker is still observable. If we keep one, express it as a **fraction of the
   boundary width** (~2–3%), not an absolute — 8 px means very different things at a 120 px boundary
   and a 1200 px one. ⚠ Corrects the architecture doc, which specified an absolute 8 px.
2. **Does `prevClass` still belong in the resolver?** If animation solves flicker, the resolver can
   stay a pure function of size alone — simpler, and it keeps server and client identical.
3. **Bar geometry has no published numbers.** Talbot, Setlur & Agrawala 2014, *Four Experiments on
   the Perception of Bar Charts*, is the most likely home for a minimum bar width. Confirmed to
   exist, no open-access PDF. Worth an ACM DL retrieval.
4. **Direct labelling over legends** — Cleveland & McGill, Ware, Munzner and Tufte were sought and
   **not retrieved**. Nothing above rests on them, and nothing should claim they support it.
5. **Container queries moved to CSS-CONDITIONAL-5.** `css-contain-3` is now an empty placeholder —
   any doc or blog post citing it is out of date.
