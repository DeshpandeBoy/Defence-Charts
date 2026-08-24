# 50 — The viewer: what we know, what we don't, and how to find out

Every other document in this corpus is about the **builder** — the developer who calls the API — or
about human vision in the abstract. This one is about the **viewer**: the person who opens the
dashboard, drags a widget, and has to make sense of what happens.

[`../UX.md`](../UX.md) §1 argues the viewer is the person the library actually acts for. This file
audits whether we have any evidence about them.

**Headline: the two halves are not equally evidenced, and the gap is not where it looks.**

| | Status |
|---|---|
| **How they visualize** — what a viewer can read at a given size | **Well evidenced.** Measured on real people, with times and error rates, at the exact sizes our Micro and Tile rungs use. Better than this corpus has been giving itself credit for. |
| **How they interact** — hover, tap, tooltip, and reading a chart *while dragging it* | **Barely evidenced.** Derived from what designers did, not what viewers could do. One load-bearing claim was uncited entirely. |

---

## 1. How they visualize — what we actually have

This is stronger than the open lists suggest, because the strongest sources measured **viewers**, not
artefacts.

### 1.1 Measured on people, with numbers

**Blascheck et al. 2018**, *Glanceable Visualization: Studies of Data Comparison Performance on
Smartwatches* (InfoVis/TVCG) — the single most viewer-centred source in the corpus. A 2AFC weighted
up/down staircase, 15 reversals or 150 trials, on a 320×320 px / 28.73 mm display subtending ~6° of
visual angle.

| Chart type | Study 1 threshold | Study 2 | At 24 values |
|---|---|---|---|
| Bar | < 300 ms | 245 ms | ~450 ms |
| Donut | < 220 ms | **159 ms** | ~270 ms |
| Radial bar | < 1780 ms | 1548 ms | — |

Accuracy 70–92 %. Preference ranking **donut > bar > radial**, except at 7 values where bar ranked
first.

Two things this settles that folk wisdom gets wrong:

- **The donut is the fastest mark at glanceable size**, not the worst. Our Tile rung ("donut, no
  labels, centre total") is supported by measurement, against the common rule that donuts are always
  inferior to bars.
- **Radial bars are unusable past ~7 categories**, for a stated geometric reason — the bars are
  roughly half the size of a plain bar chart for the same item count. That is a published number that
  goes straight into a token.

**Blascheck et al. 2023**, *Part-to-Whole Glanceable Visualizations on Smartwatch Faces*
(PacificVis) — an **8 mm** ring (~89 px at that density), bars 33–100 px. Ring and bar both beat a
text representation for proportion judgement. An analog clock dial as visual distractor did **not**
degrade performance. Real worn-watch viewing angle measured at mean **50° (SD 14)**, and only the
most extreme angle degraded results. This supports the Progress rung directly: a ~89 px ring is a
validated size for a proportion judgement.

**Heer, Kong & Agrawala 2009** and **Heer & Bostock 2010** give the height thresholds the ladder is
built on — 24 px diminishing returns, 40 px before value-estimation error rises significantly
(p < 0.001), 80 px saturation, 6 px horizon floor. Heer 2009 also contributes **"virtual
resolution"**, which is worth more than it currently gets: a horizon graph at 24 px with 2 bands has
the virtual resolution of a 48 px line chart. *A rung's information budget is not its pixel height —
it is its virtual resolution.*

### 1.2 The caveat that applies to all of it

**While et al. 2024** replicated the smartwatch thresholds with older adults and found them **not
universal**. Every number in §1.1 is a threshold for a population, measured on a small physical
display at a stated viewing angle. `10-responsive-ladder.md` §6 already flags the units problem —
Heer states thresholds in millimetres, Talbot in labels per inch, and every A-lit token is an angular
claim wearing pixel clothing. Print, kiosk, and watch output need a density multiplier we have not
specified.

### 1.3 What is missing, and it is narrow

All of these were requested during research and explicitly came back empty (`raw/05` §4.6). Do not
cite anything here:

minimum readable text size in px · minimum distinguishable stroke width · minimum bar width ·
minimum gap between bars · minimum scatter point separation · maximum legend entries ·
direct labelling vs legends at matched size

Only two of these are load-bearing. **Bar geometry** is currently Tier C invention, and Talbot,
Setlur & Agrawala 2014 is the likely home for a real number — confirmed to exist, no open-access PDF,
worth an ACM DL retrieval. **Legend capacity** has no published number at all; our 8 is ours and says
so.

Worth noting what this list means: nothing in the ladder's spine rests on an unretrieved source. The
gaps are in the *presentation* half of the token tree, not the semantic half.

---

## 2. How they interact — the actual hole

### 2.1 ⚠ Correction: "fat-finger thresholds" was uncited

The phrase **"hover targets are below fat-finger thresholds"** appears six times across
`10-responsive-ladder.md` §2/§5.4, `40-chart-plan.md`, and `raw/05`. It is the entire justification
for the Micro and Tile rungs having **no interaction at all** — one of the more consequential rules in
the ladder.

It has no number and no source. It traces back to `raw/05`:368, where the finding is that Kim et al.
*mention* the fat-finger problem. A mention is not a measurement. This is precisely the failure mode
the A-lit / A-impl split exists to prevent: a phrase that sounds like perception research, carrying
the authority of one, resting on nothing.

**Retrieved 2026-08-23, and the honest answer is that the specs decline to claim research
provenance too:**

| Source | Requirement | Level |
|---|---|---|
| **WCAG 2.2 SC 2.5.8** Target Size (Minimum) | **24 × 24 CSS px** | AA |
| **WCAG 2.1/2.2 SC 2.5.5** Target Size (Enhanced) | **44 × 44 CSS px** | AAA |

Both Understanding documents were read in full. **Neither derives its number from a named study.**
2.5.8 justifies 24 px in general terms — hand tremors, spasticity, quadriplegia, specialised input
devices — and lists exactly one Related Resource, *"Target size study for one-handed thumb use on
small touchscreen devices"*, with no authors, no year, and an explicit disclaimer that resources
imply no endorsement. 2.5.5 links Apple HIG, Microsoft UWP, Material Design, MIT TouchLab and the
Maryland HCIL thumb study, and **reproduces none of their numbers**.

**Therefore: these are Tier A-impl — spec and convention, evidence about what is agreed, not about
what a finger can do.** That is a real tier and a real citation, and it is a strict improvement on an
uncited phrase. It is not Tier A-lit and must not be written as though it were.

### 2.2 The finding that matters most: WCAG carves out charts

SC 2.5.8's **Essential** exception names, verbatim as examples, *closely spaced map pins* and **dense
data visualizations**.

This is unusually direct guidance for us:

- A chart's **data marks** are not required to meet 24 × 24. A scatter point, a stacked-bar segment,
  a donut slice at Tile — the criterion does not demand we inflate them.
- The **controls** around the chart are not exempt. Legend toggles, a brush handle, an expand
  affordance, the resize grip itself.

So the ladder's interaction rule is correct and its scope should be stated more precisely than
"no interaction": *marks are exempt, controls are not, and below the rung where a control can be
24 × 24 the control does not ship.*

### 2.3 The 24 px collision — two thresholds, one number, unrelated reasons

`plot-height-optimal` is **24 px** (Heer 2009, A-lit — below it, change the encoding). SC 2.5.8's
minimum target is **24 CSS px** (A-impl).

They share a number by coincidence and they interact anyway: **a mark inside a 24 px-tall plot has at
most 24 px of vertical target, so at Tile and below an individual mark cannot meet 2.5.8 on the
vertical axis.** The existing rule — *"the whole widget is one tap target"* — is the right answer, and
it now has a criterion and a number behind it instead of a phrase.

This is the same species as the gridline `#ddd` × `0.2` finding in `10-responsive-ladder.md` §6.1:
**provenance is per-token, correctness is per-composition.** Add it to the B1 token-review checklist
as a second worked example.

### 2.4 The rest of the interaction ladder is derived from artefacts, not viewers

`10-responsive-ladder.md` §5.4 — Micro/Tile none, Strip tap-to-reveal with the tooltip `fix`ed to the
widget edge, Panel hover crosshair, Canvas/Stage `fluid` tooltip plus brush, zoom and legend
toggling — comes from two corpus studies:

- **Hoffswell et al. 2020** coded 231 visualizations and found most mobile versions *removed*
  interactivity rather than adapting it (A1, A14), with a small subset adding it (A2, A23).
- **Kim et al. 2021** named `fix tooltip position`, `disable hover interactions`, `change trigger`,
  `remove trigger`, `remove feedback` as observed strategies across 378 pairs.

Both are observations of **what designers shipped**. `raw/05` §4.6 states the caution exactly right,
about legends: *"observed in practice is not shown to be better."* **Nobody applied that same caution
to the interaction ladder, and it needs applying.** The strategies are a defensible prior. They are
not evidence that a viewer succeeds with them.

### 2.5 Three interaction questions with no source at all

1. **Is there a perceptual deadband?** *"How much re-layout during a drag is tolerable?"* — requested
   during research, **no source found**. This is the interaction question at the very centre of the
   product, and the literature is silent.
2. **Does animation actually absorb boundary flicker?** The claim that a ~1 s eased transition turns
   a boundary crossed twice into one continuous motion is flagged in `raw/05` §6 as *"this inference
   is mine — no paper I retrieved makes this claim. It is a design argument, not a citation."* The
   browser probe showed that mounted rung content still flickers, so the implementation now keeps
   `prevClass` out of the resolver and uses a 1% fractional deadband at the live client boundary.
   The number remains a project-owned interaction policy, not viewer evidence.
3. **What does the level-of-detail literature already know?** Real-time 3D graphics has used
   hysteresis in LOD switching as standard practice for decades. `raw/05` §5.4 says the literature is
   believed to exist but was **not retrieved**, so it is not cited. This is the cheapest remaining
   retrieval in the whole corpus and it addresses question 1 directly, from an adjacent field.

---

## 3. The gap underneath both halves

Every perception study in §1 measured a **static** chart at a **fixed** size that the viewer **did not
cause**.

Heer & Robertson 2007 is the one transition study, and it constrains us usefully — staging works
modestly and should be timed around a full second per stage, axis rescaling is the expensive
operation, gridlines must persist as landmarks through a rescale, object constancy is mandatory for
aggregation. But its transitions were **system-initiated**. The viewer watched a change happen to
them.

**Nobody has studied a viewer who changes the chart themselves, by dragging, and must then re-read
it.** That is not a variation on the existing research. Two things differ, and both are structural:

- **Intent.** The viewer *knows* they made it smaller. A y-axis disappearing may read as a
  consequence of their own action rather than as a defect — which is the entire bet in `UX.md` §8's
  failure signal, *"the first question is 'where did the axis go' rather than 'what is it showing
  me.'"*
- **Attention.** During a drag, the viewer is looking at the resize handle and their pointer, not at
  the plot. The transition they are supposed to comprehend happens largely outside foveal attention.

⚠ **Both plausibly cut in our favour, which is exactly why they must not be assumed.** A design whose
central claim is validated only by arguments that happen to favour it has not been validated.

---

## 4. The instrument — A1 answers this, cheaply

Milestone A1 is one line chart in one draggable box, built to prove the idea end to end. It is
already the right apparatus. Three additions turn it into the study, and none of them is product work
thrown away:

**Instrument it.** Log every plan diff with the size that caused it, the dwell time at each rung, and
every boundary crossing including reversals. This is the `<ChartSizeDimensions />` debug overlay
`raw/07` already recommends building early, plus a transcript. It answers §2.5's question 1 with
observed data — how often does a real hand oscillate across a boundary, and at what speed — which no
paper is going to provide.

**Ask before explaining.** At three rungs, unprompted and before any explanation: *"What does this
chart tell you?"* and *"What can't you tell from it?"* The second question is the one that matters,
because it tests whether `valueLegibility` is legible to anyone but us.

**Watch the hands.** Do they overshoot and correct? Do they settle at boundaries or drag straight
through? Do they ever try to hover a mark at Tile — the interaction we removed on an uncited claim
and have now justified with a spec?

Five people, one afternoon. It closes the three interaction questions in §2.5, both halves of §3, and
`UX.md`'s two flagged assumptions. **No amount of further desk research closes any of them**, and the
literature searches to date have been thorough enough to say that with some confidence.

---

## 5. Amendments this implies elsewhere

Written, **not applied** — same two-step as `decisions/012`–`014`.

| File | Change |
|---|---|
| `10-responsive-ladder.md` §2, §5.4 | Replace *"below fat-finger thresholds"* with the WCAG numbers and the A-impl tier. Add the marks-exempt / controls-not scoping from §2.2. |
| `10-responsive-ladder.md` §6 | Add `target-size-min: 24px` and `target-size-enhanced: 44px` as **A-impl** tokens, with the note that the specs themselves cite no study. |
| `10-responsive-ladder.md` §6.1 | Add the 24 px × 24 px collision as a second worked example of *provenance is per-token, correctness is per-composition*. |
| `40-chart-plan.md` (interaction table) | Same phrase replacement; scope `'none'` to controls rather than to all pointer response. |
| `30-implementation-plan.md` A1 | Add the three instrumentation items above as A1 deliverables, not a follow-on. |
| `../UX.md` §5.5, §8 | The "box below minimum" row and the `planFn` failure signal both become measurable at A1 rather than aspirational. |

**One retrieval still worth doing:** the LOD-hysteresis literature from real-time rendering (§2.5,
question 3). It is the only adjacent field that has solved this exact problem, and it has not been
looked at once.

---

## Related

[`../UX.md`](../UX.md) · [`10-responsive-ladder.md`](10-responsive-ladder.md) §5.4, §6, §7 ·
[`raw/05-theory-responsive-viz.md`](raw/05-theory-responsive-viz.md) §3.1, §4.6, §5.4, §6 ·
[`40-chart-plan.md`](40-chart-plan.md) · [`decisions/`](decisions/)
