# 05 — Academic & published theory of responsive data visualization

> Status: **COMPLETE** — all six topics written, verdict and tokens table done.
> Rule for this file: every number and every name is either (a) traced to a citation with a URL that
> I actually opened, or (b) explicitly marked **UNVERIFIED**. Nothing here is invented. Where I could
> not retrieve a source I say "could not retrieve".

---

## Retrieval log

| Source | Status |
|---|---|
| Hoffswell, Li, Liu — *Techniques for Flexible Responsive Visualization Design*, CHI 2020 | **Full text retrieved & read** (author's PDF, jhoffswell.github.io) |
| Kim, Moritz, Hullman — *Design Patterns and Trade-Offs in Responsive Visualization for Communication*, CGF/EuroVis 2021 | **Full text retrieved & read** (arXiv:2104.07724v2) |
| Heer, Kong, Agrawala — *Sizing the Horizon*, CHI 2009 | **Full text retrieved & read** (idl.cs.washington.edu) |
| Heer, Bostock — *Crowdsourcing Graphical Perception*, CHI 2010 | **Full text retrieved & read** (idl.cs.washington.edu) |
| Talbot, Lin, Hanrahan — *An Extension of Wilkinson's Algorithm for Optimal Axis Labeling*, InfoVis 2010 | **Full text retrieved & read** (justintalbot.com) |
| Talbot, Gerth, Hanrahan — *Arc Length-Based Aspect Ratio Selection*, InfoVis 2011 | **Full text retrieved & read** (justintalbot.com) |
| Heer, Robertson — *Animated Transitions in Statistical Data Graphics*, InfoVis 2007 | **Full text retrieved & read** |
| Blascheck et al. — glanceable smartwatch visualization, InfoVis 2018 | **Full text retrieved & read** (Microsoft Research mirror; HAL blocked by bot check) |
| Blascheck et al. — part-to-whole smartwatch charts, PacificVis 2023 | **Full text retrieved & read** (Microsoft Research mirror) |
| While, Blascheck, Gong, Isenberg, Sarvghad — *Glanceable Data Visualizations for Older Adults*, CHI 2024 | **Full text retrieved & read** (arXiv:2403.12343) |
| W3C **CSS Conditional Rules 5** (container queries) | **Retrieved & read** — see the correction below |
| W3C **ResizeObserver** | **Retrieved & read** |
| Talbot, Setlur, Agrawala — *Four Experiments on the Perception of Bar Charts*, InfoVis 2014 | **Existence confirmed (OpenAlex); no OA PDF; NOT READ.** All its findings are UNVERIFIED here. |
| Grioui, Blascheck, Yao — *Micro Visualizations on a Smartwatch … While Walking*, 2024 | **Could not retrieve** (HAL returned HTTP 500 / bot check). |
| Tufte, *Beautiful Evidence* (sparklines) · Goffin (word-scale) · Islam (micro-vis) · Fuchs (data glyphs) · Cleveland & McGill 1984 · Ware · Munzner · Mayer · Stone & Bartram | **Not retrieved.** Each is marked UNVERIFIED at its point of use; several are quoted only *second-hand* via papers I did read, and are labelled as such. |

**Correction to the brief:** topic 2 was requested as "Kim, Setlur, Agrawala". The EuroVis 2021 paper
is by **Hyeok Kim, Dominik Moritz, Jessica Hullman**. Setlur and Agrawala are not authors on it.
(Vidya Setlur & Maneesh Agrawala *are* co-authors of *Four Experiments on the Perception of Bar
Charts* with Justin Talbot, InfoVis 2014 — a different, also-relevant paper, cited under topic 4.)

**Second correction, for anyone reading our own docs:** container queries are specified in
**CSS-CONDITIONAL-5**, not css-contain-3. The css-contain-3 draft is now an empty placeholder
("Having moved these features to other specifications, this document is now empty"; changelog:
"Move Container Queries to [CSS-CONDITIONAL-5]"). Any document citing css-contain-3 for container
queries is out of date. See topic 5.

---

# VERDICT ON OUR DRAFT

## A. Our eight verbs mapped to published names

Two independent taxonomies exist, and they nest: Kim et al. 2021 explicitly say they "extend"
Hoffswell et al. 2020's Action dimension.

- **Hoffswell, Li & Liu (CHI 2020)** — 6 *actions* x 5–6 *components*.
  Actions: `no change`, `resize`, `reposition`, `add`, `modify`, `remove`.
  Components: `axes`, `legends`, `marks`, `labels`, `title` (+ `view` used in Fig. 1).
- **Kim, Moritz & Hullman (EuroVis 2021)** — 76 *strategies* = 5 *Target* categories x 5 *Action*
  categories. Actions: `Recompose` (remove / add / replace / aggregate), `Rescale` (bigger /
  smaller), `Transpose` (serialize / parallelize / axis-transpose), `Reposition` (externalize /
  internalize / fix / fluid / relocate), `Compensate` (toggle / number).
  Targets: `Data` (record / field / level), `Encoding`, `Interaction` (feature / trigger / feedback),
  `Narrative` (sequencing / annotations / emphases / text), `References & Layout` (labels /
  references / layout / size).

| Our verb | Hoffswell 2020 | Kim 2021 | Verdict |
|---|---|---|---|
| **Rescale** | `resize` | `Rescale` → `bigger` / `smaller`; pattern *reduce width* | **Confirmed**, same name in Kim et al. |
| **Reflow** | `reposition` (partly) | `Transpose` → `serialize` / `parallelize`; pattern *serialize layout* | **Confirmed but mis-scoped.** Published work splits this into (a) serialize/parallelize = axis of arrangement, and (b) reposition = move a thing. Kim et al. found *serialize layout* to be one of the single most frequent strategies in a 378-pair corpus. |
| **Reveal / Conceal** | `add` / `remove` | `Recompose` → `add` / `remove` | **Confirmed.** `remove` is the single most common action in *both* corpora. |
| **Relabel** | `modify` on component `label` | `Rescale` → *simplify labels* / *elaborate labels*; `Reposition` → *externalize labels* / *incorporate labels* | **Partly confirmed but split.** The literature treats label shortening as a *Rescale* and legend-vs-direct-label as a *Reposition* (externalize/internalize). Our single "Relabel" verb conflates two published axes. |
| **Densify / Sparsify** | `modify` on `axes` | pattern *adjust ticks* (under Rescale/Ref.&Layout) | **Confirmed as a named pattern** (`adjust ticks`), though it is a leaf pattern, not a top-level action, in both taxonomies. |
| **Aggregate** | not a distinct action (falls under `modify`) | `Recompose` → `aggregate`; also Target `Data` → `level` | **Confirmed and named.** Kim et al. treat it as a first-class action and note it is *data-specific*: "authors cannot aggregate interaction or layout because aggregation is a data-specific action". |
| **Substitute** | `modify` (and the "completely redesign" cases A19, A23, A36) | `Recompose` → `replace`; also `change encoding`, `change measurements` | **Confirmed** under the name **`replace`**. Kim et al.: "We observed a few instances of `replace` actions, referring to strategies that substitute a target in LS with another target in SS." |
| **Transpose** | not distinct | `Transpose` → `axis-transpose`, pattern *transpose axes* | **Confirmed**, same name. But note Kim et al. use `Transpose` as a *parent* category that also contains serialize/parallelize; our "Transpose" = their `axis-transpose` leaf only. |

## B. What we MISSED — published transformations with no verb in our draft

Ordered by how load-bearing they are for a dashboard-widget library.

1. **`Compensate` (toggle / number)** — a whole top-level Action category in Kim et al. that we have
   no verb for. When density forces you to remove something, you can preserve the information by
   making it *toggleable* (`toggle annotations`, `toggle interaction widget`, toggling an axis in a
   parallel-coordinates plot) or by leaving a **numeric marker at the original position** of an
   externalized annotation (`number annotations`). This is the direct answer to our own rule
   "Aggregation must be visible" — the literature has a name and two mechanisms for it.
   **Recommendation: add a 9th verb, `Compensate`.**
2. **`Externalize` / `Internalize` as a named, invertible pair** — moving labels/legends/annotations
   *out of* vs. *into* the plotting area. Our draft only has "legend appears/disappears". The
   published framing is richer: `externalize labels`, `externalize legends`, `externalize
   annotations`, `incorporate labels`, `internalize legends`. Internalising a legend at *small*
   size (to save the external strip) is a real observed strategy we have not modelled.
3. **`Fix` / `Fluid`** — whether an element is pinned or flows. Observed patterns: `fix tooltip
   position` (pin the tooltip to the bottom edge on small screens instead of floating it next to the
   cursor — observed in E1, E129, E204), `fluid small multiples`, `fluid layout`. **We have no
   tooltip-placement rule at all in the draft.** For a grid widget that can be 1x1, a floating
   tooltip is unusable; the literature says pin it.
4. **`Relocate` (self-inverse)** — moving a target to vacant chart space, e.g. `relocate
   annotations`, `move marks` (non-contiguous map territories moved into whitespace).
5. **`Parallelize`** — the *inverse* of serialize: putting serially-arranged LS elements
   side-by-side. Observed for legends (E1) and labels (E41). Our ladder is monotonic
   (bigger = more), but Kim et al. note **all actions are invertible** and that the whole taxonomy
   works SS→LS as well as LS→SS. Our `ChartPlan` should be able to express both directions.
6. **`Sequencing` as a Target** — splitting states into panels / an interactive slideshow.
   Pattern `split states into panels` (E125, E132), `remove panels`. For a widget library the
   analogue is: at Stage size show small multiples; at Panel size show one panel + a selector.
   Our draft mentions small multiples at Stage but never the reverse (collapse multiples into a
   sequenced/selectable single panel).
7. **`Interaction` as a first-class Target** — `disable hover interactions`, `change trigger`,
   `remove trigger`, `remove feedback`, `add GPS`. Hoffswell et al. also coded interaction and found
   most mobile versions *removed* interactivity rather than adapting it. Our draft mentions "hover
   crosshair + tooltip" appearing at Canvas but has no interaction-degradation model. On a 1x1 or
   2x1 tile, hover targets are below fat-finger thresholds.
8. **`Text` / narrative targets** — `reduce text`, and notably **`add` summary text at small size**
   (E21: adding a summary sentence "for fast reading"). This inverts our assumption that small =
   strictly less. Kim et al. explicitly list `add` targets observed *only* on small screens:
   call-out line (E267), legend (E222), summary text (E21), location finder (E2), context view
   (E126, E202).
9. **`Change measurements`** — transform the *values* encoded, e.g. raw values → ranks (E18).
   A cheap density reduction we don't have.
10. **`Remove fields` / `Remove records` as separate data-level verbs** — Kim et al. separate
    `record`, `field`, and `level` as distinct Data sub-targets. Our "Aggregate" conflates
    `aggregate` (level) with what they call `remove records` (e.g. Bond Yield drops line marks).

## C. Which of our numeric thresholds are confirmed or contradicted

**Headline finding: neither key paper publishes any pixel threshold.** Both are corpus/qualitative
studies. There is no published number for "drop a tick at N px" in Hoffswell et al. or Kim et al. —
I searched the full text of both for `px`, `pixel`, `breakpoint`, `threshold`, `320`, `375`, `768`.
The only pixel-related content in Hoffswell et al. is *practitioner quotes about the difficulty of
choosing thresholds* (see §1 below).

**Where the numbers actually live** is the graphical-perception literature, not the responsive
literature — Heer/Kong/Agrawala 2009, Heer & Bostock 2010, Talbot/Lin/Hanrahan 2010, Blascheck 2018.
Topic 4 mines them. The results below are the reconciliation.

### C.1 Confirmed by published work

| Our number / rule | Verdict |
|---|---|
| `xTicks` lower clamp of **2** | **CONFIRMED by name.** Talbot 2010: "at least two labels (our lower bound)". |
| Zero ticks at Micro/Tile | **CONFIRMED.** Talbot 2010's algorithm may legally return no labelling "when the plot is so small that having no labeling is visually preferable". |
| "Never overlap text. Measure, then Sparsify." | **CONFIRMED.** Talbot 2010 forbids overlap outright and penalizes below **1.5 em** separation. |
| "Substitution is capped." | **CONFIRMED in kind.** Heer 2009: "We discourage the use of 4 or more bands." |
| Progress: ring for one value, **Substitute to a bar** for comparison | **CONFIRMED, twice-replicated.** Blascheck 2018 + While et al. 2024 both rank radial slowest; While et al.: "*Radial* is Preferable for Displaying Task Progress and Completion." |
| Strip = "trend shape, not values" | **CONFIRMED with a mechanism.** Heer & Bostock 2010: charts 40 px tall have significantly more estimation error (p < 0.001). Short rungs *should* stop claiming value legibility. |

### C.2 Contradicted or needing revision (numeric)

| Our number | Verdict |
|---|---|
| `xTicks = clamp(floor(width/90), 2, 8)` | **Divisor should be 100, not 90**, to be citable — Talbot 2010 targets "about 1 tick per 100 pixels". **The upper clamp of 8 is unsupported** and should be removed; density is a continuous penalty in the published algorithm, not a cap. |
| Relabel ladder jumps straight to "rotate 45°" | **Two published steps are missing.** Talbot 2010's order is **abbreviate → split → rotate**, and rotation is "a last resort … we penalize [it] heavily". Insert `abbreviate` and `split` before `rotate`; Transpose comes after rotate. |
| `aggregateAfter` default **8** | **Not a perceptual threshold.** Blascheck 2018 (replicated 2024) shows bar and donut usable to **24** categories at 320x320 px. Our 8 is a legend-scannability choice and must be documented as such. Radial's real ceiling is ~**7**. |
| Line chart just gets smaller at small rungs | **A published rung is missing.** Heer 2009: below ~24 px of plot height a line chart degrades measurably, and the published fix is to **change encoding to recover virtual resolution** (1- or 2-band horizon), not to shrink. Add a Substitute rung at 24 px. |
| Rescale is open-ended at large sizes | **Contradicted in spirit.** Heer & Bostock 2010: "little benefit for increasing chart height beyond 80 pixels". Past saturation, extra space should buy **content** (Reveal), not plot area. This is a published justification for the library's core premise — use it. |

### C.3 Still UNVERIFIED after full retrieval — these are ours

| Our number | Status |
|---|---|
| Transpose above ~10 categories | **UNVERIFIED / practitioner-only.** Not in any paper retrieved. |
| Slices `< 2%` → "Other" | **UNVERIFIED.** No paper proposes a minimum angular slice. |
| Reflow to side-by-side at `aspect >= 1.4` and `width >= 2 x donutDiameter` | **UNVERIFIED.** No published aspect-ratio *reflow* breakpoint. Aspect ratio has a large literature (banking to 45°, arc length — topic 4.4) but it optimizes plot aspect **from the data**, which a fixed grid cell forbids. See §4.4 for the tension this creates. |
| Heatmap `minCell` 8 px | **UNVERIFIED.** Numerically equal to Heer & Bostock's gridline spacing, but that result is about tracing gridlines to labels — the coincidence is not evidence. |
| SVG `pointBudget` ~2000 | **UNVERIFIED** — engineering heuristic, not a perceptual result. Document it as a rendering threshold. |
| Legend max entries | **UNVERIFIED.** I could find **no published number** for legend capacity at all. |
| Min bar width / bar gap / point separation / stroke width | **No published values found.** See §4.6. |
| Deadband ~8 px for hysteresis | **UNVERIFIED** — see topic 5. No viz paper studies hysteresis; the web platform solves the cycle structurally instead. |
- Our draft's ladder is strictly monotonic ("what is *added* at each rung"). Kim et al.'s corpus
  contains a documented class of **additions that happen only at small size** (summary text,
  call-out lines, context views, and even *legends*). A strictly monotonic ladder cannot express
  "at Tile we add a summary sentence that the Panel doesn't need". Recommend the ladder be a
  per-rung spec, not a diff-from-previous.
- Our claim "Legend is a last resort … prefer direct labelling whenever there is room" is
  **directionally supported but not as a size rule**: Kim et al. observed *legends being added on
  small screens* (E222) and *internalized legends* (E116, E158). The published pattern is
  externalize-at-large / internalize-or-add-at-small, which is the opposite of our monotonic rule.

---

# 1. Hoffswell, Li & Liu — *Techniques for Flexible Responsive Visualization Design* (CHI 2020)

**Citation.** Jane Hoffswell (University of Washington), Wilmot Li (Adobe Research), Zhicheng Liu
(Adobe Research). "Techniques for Flexible Responsive Visualization Design." *CHI '20*, April 25–30
2020, Honolulu, HI. ACM ISBN 978-1-4503-6708-0/20/04.
DOI <http://dx.doi.org/10.1145/3313831.3376777> ·
PDF <https://jhoffswell.github.io/website/resources/papers/2020-ResponsiveVisualization-CHI.pdf>
(this URL worked; the ACM DL landing page is <https://dl.acm.org/doi/10.1145/3313831.3376777>).

**What kind of paper it is.** It is *not* a perceptual-threshold paper. It is: (a) a corpus study,
(b) five formative interviews, (c) a prototype authoring system. If you are looking for pixel numbers
here, they do not exist.

### Method / corpus
- **53 news articles** from **12 sources** → **231 visualizations** coded.
- **46 of the 231** visualizations were **small multiples**.
- Mobile version obtained via **Chrome DevTools Device Mode simulating an iPhone X**; both
  **portrait and landscape** orientations were examined separately.
- Open coding by two authors with inter-coder agreement discussion; codes then grouped by
  behavioural similarity into an *editing action* + a *visualization component*.

### The taxonomy (verbatim)
> "The responsive techniques generally fall along a spectrum of simple editing actions: **no changes,
> resize, reposition, add, modify, and remove**. These techniques may independently impact different
> visualization components (e.g., **axes, legends, marks, labels, and title**), allowing for complex
> and varied modifications based on the underlying device context."

The modifications "may also apply to either a single component, several components, or all
components in the view." Figure 1's own coding labels show the pairing in practice:

| Action | Component | Description (their label) |
|---|---|---|
| resize | view | compress width |
| reposition | title | unwrap and move title text |
| remove | label | delete disaster cost label |
| modify | label | simplify text |
| add | mark | add lines |

A subset of visualizations (A19, A23, A36) went further and **completely redesigned the encoding** —
i.e. what our draft calls *Substitute*.

### Published counts (the only numbers in the paper)
| Finding | Number |
|---|---|
| Visualizations with **no changes**, landscape orientation | **69 (29.9%)** |
| Visualizations with **no changes**, portrait orientation | **6** |
| **remove** actions, portrait | **87 (37.7%)** — most common action |
| **add** actions, portrait | **26 (11.3%)** |

Direct quote on the asymmetry: "it was much more common to **remove** elements from the view (87 or
37.7%, portrait orientation) than to **add** new elements (26 or 11.3%, portrait orientation)."

**Design implication for us:** the *landscape* result is the interesting one for a 12-column grid.
Nearly 30% of charts needed **no change at all** when the screen was wide-but-short, versus almost
none in portrait. That maps directly onto our `aspect` bucket: portrait cells are where the
transformation work is, landscape cells mostly just Rescale.

### Interaction findings
Most visualizations were static or "did not change the core interaction type, aside from using tap
rather than click." Many **removed interactivity completely** from the mobile version (A1, A14)
rather than adapting it; a small subset introduced or updated interaction (A2, A23).

### The four design guidelines (from the interviews)
1. **enable simultaneous cross-device edits**
2. **facilitate device-specific customization**
3. **show cross-device previews**
4. **support propagation of edits**

For our library these translate to: the `ChartPlan` must be inspectable at every size simultaneously
(guideline 3), and an override at one size class must be able to propagate to others (guideline 4).

### Interview findings relevant to our open questions
- **Information hierarchy is the mental model, and it is explicitly size-ordered.** P3: *"There's a
  hierarchy of information, right? So as you go down in the artboard size you make the decision
  about what information can be cut first."* This is precisely the ladder concept — published,
  from a practising news graphics designer. Cite this as the justification for the whole design.
- **Removal-first workflow.** P2: *"I think it's easier to eliminate things when you have
  everything."* Most workflows start with the full desktop design and subtract.
- **Continuous responsiveness is considered error-prone by practitioners** (see topic 5).

**No pixel thresholds, no breakpoint values, and no minimum sizes are published in this paper.**

---

# 2. Kim, Moritz & Hullman — *Design Patterns and Trade-Offs in Responsive Visualization for Communication* (EuroVis 2021)

**Citation.** Hyeok Kim (Northwestern), Dominik Moritz (CMU), Jessica Hullman (Northwestern).
"Design Patterns and Trade-Offs in Responsive Visualization for Communication." *Computer Graphics
Forum* 40(3) (EuroVis 2021). arXiv:2104.07724.
<https://arxiv.org/abs/2104.07724> · PDF <https://arxiv.org/pdf/2104.07724v2>
Supplementary/survey data: <https://osf.io/zrqfy/>. They also publish an **explorable online gallery**
with pictograms and descriptions of the entire pattern set (referenced in-paper; I have not opened
the gallery URL itself — **UNVERIFIED** whether it is still live).

### Method
- **378 pairs** of large-screen (LS) and small-screen (SS) visualizations.
- Multiple coding passes → **76 design patterns / strategies**.
- Supplemented by a survey of **19 visualization authors** (mean 4.8 years' experience).
- **11 of 19 (58%)** created the SS visualization *after* the LS view — matching Hoffswell et al.
- Authors ranked "maintaining takeaways", "maintaining information", and "changing the design to
  acknowledge greater interaction difficulty on an SS" as the most important guidelines.
- **10 of 19 (53%)** described strategies/concerns about adjusting information density.

### Corpus composition (useful for knowing which chart types are actually studied)
Chart types counted in the sample: Bar/histogram **135**, Line/area **113**, Map/cartogram **82**,
Scatter/dot plot **47**, Bubble/treemap **30**, Heatmap **14**, Pie/polar **13**, Icon array **9**,
Network **8**, Etc **9**. Format: Static **192** (single view 131, multiple views 41, small multiples
20, animation 11) / Interactive **175** (single view 76, multiple views 24, small multiples 8,
interactive slideshow 20, parallax 14, map with pan/zoom 8, dynamic query 25).

> Note for us: **pie/polar is one of the *least* studied types (13 of 378)** — our donut ladder,
> which is the rung we have the most visual evidence for, is the rung the literature has the least
> to say about.

### The two dimensions

**Dim. 1 — Target (what is changed).** Five categories:

| Target category | Sub-targets |
|---|---|
| **Data** | Record, Field, Level |
| **Encoding** | (encoding channels) |
| **Interaction** | Feature, Trigger, Feedback |
| **Narrative** | Sequencing, Annotations, Emphases, Text |
| **References / Layout** | Labels, References, Layout, Size |

**Dim. 2 — Action (how it is changed).** Five categories, each defined as a *function with input and
output states*, which is why they are **invertible** — the paper's stated reason for this framing:

| Action category | Sub-actions | Input → Output state |
|---|---|---|
| **Recompose** | `Remove` | Exist → Not exist |
| | `Add` | Not exist → Exist |
| | `Replace` | A → B |
| | `Aggregate` | Atomic → Aggregated |
| **Rescale** | `Bigger` / `Smaller` | — |
| **Transpose** | `Serialize` | Parallel → Serial |
| | `Parallelize` | Serial → Parallel |
| | `Axis-Transpose` | X-Y → Y-X |
| **Reposition** | `Externalize` | In the area of → Outside of |
| | `Internalize` | Outside of → In the area of |
| | `Fix` | Flexible → At fixed |
| | `Fluid` | At fixed → Flexible |
| | `Relocate` | at A → at B |
| **Compensate** | `Toggle` | — |
| | `Number` | — |

### Named concrete patterns appearing in the paper (partial list, verbatim names)
`remove records`, `remove fields`, `remove encoding`, `remove annotations`, `remove emphases`,
`remove panels`, `remove trigger`, `remove feedback`, `reduce width`, `reduce text`,
`simplify labels`, `elaborate labels`, `adjust ticks`, `transpose axes`,
`transpose interaction widget`, `serialize layout`, `serialize label-marks`, `parallelize` (legends,
labels), `externalize labels`, `externalize legends`, `externalize annotations`, `incorporate
labels`, `internalize legends`, `fix tooltip position`, `unhide text`, `fluid small multiples`,
`fluid layout`, `relocate annotations`, `move marks`, `split states into panels`,
`disable hover interactions`, `change trigger`, `change encoding`, `change measurements`,
`add encoding`, `add GPS`, `toggle annotations`, `toggle interaction widget`, `number annotations`,
`aggregate`, `Disable X` (a pattern schema where X ∈ {hypothesis, search, filter, sort, …}).

### Frequency findings (from Figure 7's matrix)
> "Overall, **rescale** and **remove** actions were most commonly used, with **reducing size** being
> most common, followed by **transpose** actions specifically involving **serializing layout**."

Transformations were applied "most frequently to **Reference/Layout** targets, followed by
**Interaction** and **Narrative** targets. Transforming **Data** and **Encoding** targets was less
frequent."

They also note **impossible combinations by definition**: you cannot `externalize` data records or
`parallelize` data fields, because Reposition and Transpose are *spatially* defined while Data
targets are not; and you cannot `aggregate` interaction or layout, because aggregation is
data-specific (though it can cascade downstream into labels).

> **Direct design guidance for us:** this is a validity constraint for the `ChartPlan` type. The
> Target x Action matrix has cells that are *impossible*, not merely unobserved. Encoding that as a
> type-level constraint (e.g. `aggregate` only accepts a Data target) is a published-backed API
> decision.

### The trade-off framing

Central thesis: a **density–message trade-off**. "Information density" is defined as
**"the amount of information per pixel"**. "Message" is "a viewer's ability to recognize certain
comparisons or relationships in data."

**Three density challenges:**
1. **Graphical density** — too many objects (marks, labels, annotations) in a small view makes it
   hard to identify or perceive differences. (They cite Heer/Kong/Agrawala 2009 here — see topic 3.)
2. **Layout** — big objects (whole visualizations, legends, interaction widgets) can't be arranged;
   fixed-position elements eat a larger *proportion* of a small screen; proportional rescaling can
   overflow a scroll height, "diminish the perceptibility of differences between values on a vertical
   scale," or reduce the visualization's impact by reducing its relative size.
3. **Interaction complexity** — a feature may be infeasible on SS because it needs immediate
   rendering of many objects, or more precise manipulation than possible (they cite the fat-finger
   problem).

**Five forms of message loss:**
1. **Loss of information** — removing data/encodings/panels/annotations removes takeaways. Special
   case called out: "when authors **aggregate** data to adjust graphical density …, the viewer can no
   longer make inferences about the **distribution** of aggregated variables unless the author takes
   specific steps to encode distribution through summary marks (e.g., error bars), changes encodings,
   or adds details-on-demand."
2. **Loss of interaction** — states reachable only by interacting on LS become unreachable.
3. **Reduced discoverability** — toggles and tabs preserve the information but hide it.
4. **Reduced concurrency of elements** — serializing means things no longer co-occur in one
   viewport, hampering comparison. **Explicitly includes axis transposition**: "Transposing x- and
   y-axes … can also lead to a visualization that is too long to fit within a single scroll height,
   hampering the viewer's ability to compare different values and assess high-level trends."
5. **Changes in graphical perception** — from disproportionate rescaling, increased bin size,
   transposed axes, or serialized labels/marks. Their Figure 9 enumerates four concrete distortions:
   - **(A) Disproportionate rescaling (reducing width)**: "Steep slope" → "Shallow slope".
   - **(B) Increasing bin size**: a bimodal distribution collapses into a "skewed unimodal dist."
   - **(C) Transposing axes**: "Exchanging x and y positions results in different shapes."
   - **(D) Serializing labels and marks**: "Margin between marks is increased" — "the ratio of x and
     y position changes."

> **This is the single most important correction to our draft.** Four of our eight verbs are
> documented as *message-destroying* under specific conditions:
> - `Rescale` non-uniformly ⇒ slope illusion (this is the banking-to-45° problem, topic 4).
> - `Aggregate` ⇒ destroys distributional shape. Our draft's "daily → weekly bins" rung is exactly
>   Figure 9(B). Mitigation named in the paper: add summary marks (error bars), change the encoding,
>   or add details-on-demand.
> - `Transpose` ⇒ changes perceived shape *and* can break single-viewport concurrency.
> - `Reflow`/serialize ⇒ changes the effective mark spacing, hence perceived density.
>
> Our draft's rule "Aggregation must be visible" is right but under-specified. The literature's
> mitigation is stronger: when you aggregate, *encode the lost distribution* (error bars / range
> bands), don't merely flag it in a tooltip.

They also note the relationship is not monotone: "In some cases, **removing information or
interactivity may strengthen a message**, if that information was not critical to it."

---

# 3. Small multiples, mobile, glanceable, micro-visualization

## 3.1 The best empirical source for "how small can a chart get": smartwatch studies

**Citation.** Tanja Blascheck, Lonni Besançon, Anastasia Bezerianos, Bongshin Lee, Petra Isenberg.
"Glanceable Visualization: Studies of Data Comparison Performance on Smartwatches." *IEEE
InfoVis 2018 / TVCG*.
PDF (Microsoft Research mirror, retrieved & read):
<https://www.microsoft.com/en-us/research/wp-content/uploads/2018/08/GlanceableVis-InfoVis2018.pdf>
(The Inria HAL copy <https://inria.hal.science/hal-01851306> is behind a bot check and could not be
fetched directly.)

**Why this paper matters more than anything else for our Micro/Tile rungs:** it is the only source I
retrieved that publishes a *measured* physical display size, a *measured* pixel budget, and an
*author-reported legibility failure point*, all for the exact chart types in our ladder.

### The apparatus (this is our ground truth for "Micro")
| Fact | Value |
|---|---|
| Device | Sony SmartWatch 3, Android Wear 2.8.0 |
| Viewable screen area | **28.73 mm x 28.73 mm** |
| Screen resolution | **320 px x 320 px** (pixel size ~0.0898 mm) |
| Visual angle subtended by the whole visualization | **~6 degrees**, "with targets being in the central vision field", seeable "with little to no eye movement" |
| Typical smartwatches as of March 2018 | **128–480 px per side**, viewable area **~30–40 mm** |
| Example device cited | Fitbit Ionic, 348 px x 250 px, 302 PPI |

### The published cardinality thresholds (THE key numbers for `aggregateAfter`)
They tested **3 chart types** (bar, donut, radial bar) x **3 data sizes** (**7, 12, 24** values).

> "We initially also considered **30 data values** (e.g., 30 days per month), but with our chosen
> chart types this led to **illegible charts on the smartwatch**."

At 320 px that is ~**10.7 px per category** = illegible; **24 categories = ~13.3 px per category** =
legible and fast. This is the closest thing in the literature to a published minimum bar pitch, but
be honest about what it is: an **authors' design judgement stated in a methods section, not a
measured psychophysical threshold.** Treat it as a defensible default, not a proven limit.

Conclusion, verbatim:
> "the heights of individual bars or donut sectors **up to 24 data values** can be assessed within a
> few hundred milliseconds. **Radial bars up to 7 data values** can also be assessed quickly."
> … "radial bar charts seem **unsuitable** for smartwatch applications that require quick
> comparisons if the number of data values is **higher than seven**."

Reason given for the radial ceiling — a real geometric argument we can reuse:
> "Due to its encoding, the bars in radial bar charts are roughly **half the size** of a bar chart
> for the same number of items."

### Measured task-time thresholds (2AFC, weighted up/down staircase, 15 reversals or 150 trials)
| Chart type | Study 1 (controlled 25% difference) | Study 2 (randomised differences) |
|---|---|---|
| Bar | < **300 ms** | **245 ms** |
| Donut | < **220 ms** | **159 ms** |
| Radial bar | < **1780 ms** | **1548 ms** |

At 24 data values: bar ~**450 ms**, donut ~**270 ms**. For 7 and 12 values, thresholds as low as
**160–210 ms** for bar and donut. Study-2 thresholds were **1.14–1.35x** study-1 thresholds.
Overall accuracy range 70–92%. Preference ranking across both studies: **Donut > Bar > Radial**
(except at 7 values, where Bar was ranked first).

**Direct consequences for our draft.**
- Our Tile rung says "donut, no labels, centre total". The literature supports the donut *strongly*
  at glanceable size — donut had the **lowest** time threshold of the three, contradicting the
  common folk rule that donuts are always worse than bars. At smartwatch scale the donut wins.
- Our library must **not** offer a radial-bar / "activity ring stack" mark above ~7 categories.
  That is a published number we can put straight into a token.
- 300 ms is the empirical justification for calling Micro/Tile "glanceable": at this size the whole
  chart is a ~6-degree object read in one fixation. Any rung whose contents cannot be read in one
  fixation is not a Micro rung.

## 3.2 Part-to-whole proportion representations at watch-complication size

**Citation.** Tanja Blascheck, Lonni Besançon, Anastasia Bezerianos, Bongshin Lee, Alaul Islam,
Tingying He, Petra Isenberg. "Studies of Part-to-Whole Glanceable Visualizations on Smartwatch
Faces." *IEEE PacificVis 2023*. Supplementary: <https://osf.io/ad2z7/>.
PDF (MSR mirror, retrieved & read):
<https://www.microsoft.com/en-us/research/wp-content/uploads/2023/02/ProportionOnSmartwatches-PacificVis2023.pdf>

Published sizes — the smallest chart dimensions I found anywhere in the literature:
> "Our radial bar chart has a diameter of **8 mm** and the stacked bar chart is **8 mm** long"
> — versus prior part-to-whole studies which used circles **45–160 mm** in diameter and stacked bars
> **50–200 mm** in length.

On a 320 px / 28.73 mm display, **8 mm ≈ 89 px**. Bars encoding values were **33–100 px** long.
Findings: bar and radial bar both **outperformed text** representations for proportion judgement;
adding an analog clock dial as a visual distractor did **not** degrade performance; only the most
extreme viewing angle degraded performance. Reported real-world worn-watch viewing angle: mean
**50 degrees (SD 14)**, range 36–64.

**Consequence for our draft:** our Progress rung ("Micro: ring, no text") is supported —
a **~89 px** ring is a validated size for a proportion judgement, and the ring beat text. Our
"Tile: ring + percent" is also supported since bar/radial beat text *as the primary encoding*, not
as a replacement for the number.

## 3.3 Chart *height* specifically — the one paper with hard pixel numbers

**Citation.** Jeffrey Heer, Nicholas Kong, Maneesh Agrawala. "Sizing the Horizon: The Effects of
Chart Size and Layering on the Graphical Perception of Time Series Visualizations." *CHI 2009*,
pp. 1303–1312. <https://idl.cs.washington.edu/files/2009-TimeSeries-CHI.pdf>

This is cited by Kim et al. 2021 as the evidence for their "graphical density" challenge, and it is
the only responsive-relevant paper I retrieved that publishes chart dimensions in pixels.

Its published anchors (see topic 4 for the full treatment): chart heights were varied down to
**24 px**, **12 px** and lower; **24 px was found to be about the point of diminishing returns** —
below it, estimation error rises. It also introduces **"virtual resolution"**: the *un-mirrored,
un-layered* height a chart effectively has. A horizon graph at 24 px with 2 bands has the virtual
resolution of a 48 px filled line chart. **That concept is directly reusable by our library**: a
rung's information budget is not its pixel height but its virtual resolution.

## 3.4 Small multiples in the responsive corpora
- Hoffswell et al. 2020: **46 of 231** coded visualizations were small multiples.
- Kim et al. 2021 corpus: small multiples appear in **20 static** + **8 interactive** of 378 pairs;
  named patterns `fluid small multiples`, `split states into panels`, `remove panels`.

So the published responsive strategy for small multiples is **reflow-to-fluid-wrap** or
**collapse-to-sequenced-panels**, not "shrink each multiple". Our draft only has the Stage rung
adding small multiples and never describes their collapse. See Verdict §B.6.

## 3.5 The thresholds are not universal: the age replication

**Citation.** Zack While, Tanja Blascheck, Yuanyuan Gong, Petra Isenberg, Ali Sarvghad.
"Glanceable Data Visualizations for Older Adults: Establishing Thresholds and Examining
Disparities Between Age Groups." *CHI 2024*, Honolulu.
DOI <https://doi.org/10.1145/3613904.3642776> · preprint <https://arxiv.org/abs/2403.12343> ·
supplementary <https://osf.io/7x4hq/>

A **conceptual replication of Blascheck et al. 2018 with adults aged 65+** (n = 24, ages 65–96,
mean 73.3). Same Sony SmartWatch 3, same 320x320 px display, same three chart types (Bar, Donut,
Radial), same three data sizes (7, 12, 24), same weighted 3-down/1-up staircase.

Published numbers I can quote directly:

| Finding | Value |
|---|---|
| Older-adult overall time thresholds | Donut **312 ms**, Bar **485 ms**, Radial **2211 ms** |
| Radial, by data size (older adults) | **943 ms** (7 points) → **5460 ms** (24 points) |
| Bar at 24 points | younger adults **< 500 ms**; *old-old* (75+) **1005 ms** |
| Evidence of an age difference | **strong in 5/9** conditions, weak in 2/9 (younger vs. 65+) |
| Radial at 24 points | **7 of 22** participants quit the condition as infeasible |

Two things matter for us.

1. **The chart-type ranking replicates.** Donut < Bar < Radial in reading time, in both age groups.
   Combined with Blascheck 2018, that is now a *twice-replicated* ordering, and it is the strongest
   published support for a substitution ladder that prefers donut/bar and treats radial/progress-ring
   marks as a **display** form rather than a **comparison** form. The paper says this explicitly:
   > "*Radial* is Preferable for Displaying Task Progress and Completion."

   Our draft's Progress ladder (`Micro: ring, no text` → `Strip: Substitute to a horizontal bar`)
   is therefore **confirmed** by two studies: a ring is fine for one value, and comparison work
   should leave the radial encoding.

2. **The scaling with data size is age-dependent, and it is non-linear.**
   > "The performance gap widened with increasing data size (7→12→24) for all visualization types,
   > hinting at a steeper performance decline in older adults as visual complexity grew."

   and

   > "the relationship between the two variables might be non-linear, and the rate of performance
   > decline may accelerate with advancing age."

   The practical consequence for the library: **`aggregateAfter` is not one number.** The 24-category
   ceiling that Blascheck 2018 supports for younger adults is, for the 75+ group, the point at which
   a bar chart takes twice as long to read. If the library ever exposes an accessibility/density
   preference, `aggregateAfter` is the token it should move — this is the one published result that
   gives an audience-dependent reason to change a responsive threshold rather than a size-dependent
   one. The paper's own advice:
   > "visualization designers should ensure adequate perceptibility of information for older adults
   > by either using charts less affected by data size (e.g., Donut charts) or considering
   > recommendations from existing work aimed at displaying large amounts of [data]"

   Caveat the authors state themselves: "Our current knowledge of empirically derived glanceable
   visualization design guidelines for older adults is lacking."

## 3.6 What I could NOT retrieve for this topic — explicitly UNVERIFIED
| Item requested | Status |
|---|---|
| A paper literally titled "Responsive Visualization Design for Mobile Devices" | **Could not retrieve / could not confirm it exists under that exact title.** Do not cite it. The nearest real works are Hoffswell 2020, Kim 2021, and Kim et al.'s *Cicero* (CHI 2022). |
| Tufte, *Beautiful Evidence* (2006), sparklines — "small, intense, simple, word-sized graphics" | **Definition verified only second-hand**, via the quotation of it inside Blascheck et al. 2018. I did not open Tufte. Tufte's specific sparkline sizing advice (e.g. "as tall as a line of text") is **UNVERIFIED**. |
| Goffin et al., word-scale visualizations | Known to me only as cited by Blascheck et al. 2018 ("word-scale graphics"). Study sizes quoted there: display sizes ranging **20x15 to 80x60 px**; participants "always ranked the smallest designs the least preferred". Primary source **not retrieved**. |
| Alaul Islam et al. on smartwatch/micro-visualization design space | **Not retrieved.** Islam is a co-author on the 2023 paper above but I did not obtain his own survey papers. |
| Fuchs et al., systematic review of 64 data-glyph studies | Known only second-hand from Blascheck 2018, which reports the review "found **no studies on data glyphs that specifically used display size or viewing time as a study factor**." Primary source not retrieved. |

---

# 4. Published perceptual thresholds

### Headline

The request was for numbers convertible to tokens: minimum readable text size, minimum stroke
width, minimum bar width, minimum gap between bars, minimum scatter point separation, maximum
legend entries, and evidence for direct labelling over legends.

**I found hard, quotable, published numbers for roughly half of that list, and they all come from
the same two research groups (Heer/Bostock/Kong/Agrawala at Stanford–UW, and Talbot/Lin/Hanrahan
at Stanford–Tableau).** The other half — bar width, bar gap, point separation, stroke width, legend
capacity — I could **not** find published thresholds for, and I am marking them UNVERIFIED rather
than inventing them. That is itself a finding: **our draft's most-quoted numbers are in the
un-researched half.**

A second headline, which is the single most useful sentence in this whole topic: the 2009 paper
that gives us our chart-height numbers *explicitly names our tick-spacing problem as unsolved*.

> **Heer, Kong & Agrawala, CHI 2009:** "A potentially fruitful direction for future work is to
> evaluate if our optimal height results also imply an optimal physical spacing for tick marks and
> gridlines."

Heer & Bostock partially answered it one year later (see §4.2). Nobody has answered it for the
horizontal axis. So the draft's `xTicks = clamp(floor(width / 90), 2, 8)` is not contradicting a
literature — it is filling a gap the literature itself flagged. Keep it, but label it as ours.

---

## 4.1 Minimum chart HEIGHT — verified, with numbers

**Citation.** Jeffrey Heer, Nicholas Kong, Maneesh Agrawala. "Sizing the Horizon: The Effects of
Chart Size and Layering on the Graphical Perception of Time Series Visualizations." *CHI 2009*,
pp. 1303–1312. <https://idl.cs.washington.edu/files/2009-TimeSeries-CHI.pdf>

Method: charts **500 px wide**; heights **48, 24, 12, 6 px**, with a follow-up study going down to
**2 px**. Displays were 14.1" 1024x768, so the authors give physical equivalents.

Verified quotes:

> "for both normal line charts and 1-band mirror charts, we found a chart height of **24 pixels**
> (6.8 mm on our 14.1" 1024x768 pixel displays) **to be optimal**. For 2-band line charts, we found
> optima at **12 and 6 pixels** (3.4 and 1.7 mm)."

> "At resolutions below 24 pixels, error appears to increase linearly as the virtual resolution
> halves." (regression R² = 0.986, slope −4.1 units per log₂ pixel)

> "we recommend using 2-band charts for chart heights of **6 pixels (1.7 mm) or more**."

> "We discourage the use of **4 or more bands**."

**"Virtual resolution"** is the load-bearing concept. It is the *un-mirrored, un-layered* height a
chart effectively has: a 2-band horizon graph 12 px tall has the virtual resolution of a 48 px line
chart. Error tracks virtual resolution, not literal pixel height.

**Direct application to our ladder.** The size families in the draft are defined in grid cells. This
paper says the thing that actually governs legibility is *effective vertical resolution of the plot
area*, in physical millimetres, after layering. So:

- Our `Tile` rung (sparkline, no axes) sits in the 24 px zone. That is the *optimal*, not the floor.
- Below ~24 px of plot area, a plain line chart is measurably degrading, and the published fix is
  **not** "shrink further" — it is **change the encoding to recover virtual resolution** (mirror,
  or band). That is a published instance of our **Substitute** verb with a quantitative trigger,
  and our draft does not have it. Recommend adding a rung: below ~24 px of plot height, a line
  chart should become a **1- or 2-band horizon**, not a smaller line.
- The 4-band discouragement gives us a cap on how far Substitute may go — matching our own
  "Substitution is capped" universal rule, now with a citation.

## 4.2 Gridline spacing, gridline contrast, and the height floor — verified, with numbers

**Citation.** Jeffrey Heer, Michael Bostock. "Crowdsourcing Graphical Perception: Using Mechanical
Turk to Assess Visualization Design." *CHI 2010*, pp. 203–212.
<https://idl.cs.washington.edu/files/2010-MTurk-CHI.pdf>

Experiment 3, "Chart Size and Gridline Spacing": 2 (chart type) x 3 (height: **40 / 80 / 160 px**)
x 4 (gridline spacing: 10 / 20 / 50 / 100 data units), plus a run 3B at **160 and 320 px**; 12
values on a 0–100 scale; **2,880 responses**.

Verified quotes:

> "charts **40 pixels tall resulted in significantly more error** (p < 0.001 in all cases), but
> found no significant difference between the other heights"

> "little benefit for increasing chart height beyond **80 pixels** when using a 0-100 scale. This
> size roughly coincides with the point at which the pixel and data resolutions match"

> "Adding gridlines improved accuracy" — but with **no significant difference between 10 and 20
> gridlines (p = 0.887)**, nor between **50 and 100 (p = 0.905)**.

> "Error increased steeply in charts with a height of 40 pixels and gridline spacing of 10 units.
> Presumably the dense packing of gridlines impedes accurate tracing to their labels. **The results
> suggest that gridlines be separated by at least 8 pixels.**"

> "Our results corroborate Stone & Bartram's recommendation of **alpha = 0.2 as a 'safe' default**"
> [for gridline contrast].

**This is the closest thing in the literature to a `--chart-tick-min-spacing` token, and it is
8 px, on the value axis.** Note precisely what it is and is not:
- It IS a *perpendicular-to-the-axis* spacing for **gridlines you must trace to a label**.
- It is NOT a *label*-collision threshold (that is Talbot, §4.3) and it is NOT an x-axis result.
- The mechanism given is tracing, not overlap. So it is a real perceptual floor, not a typography
  one, and it applies even when labels are omitted entirely.

Also from the same paper, the Cleveland & McGill replication (charts **380x380 px**): position was
significantly more accurate than angle and area; **area was worse than angle**; and the theory's
prediction that angle would be worse than length **was not supported**. This is the only
Cleveland–McGill number I can vouch for first-hand — see §4.6 on what I could not retrieve.

**Contradiction with our draft.** Our `Strip` family is "3x1 – 4x2 … wide and short". If a 4x1 cell
lands under ~40 px of plot height, this paper says value estimation is significantly degraded.
Our draft treats Strip as "trend shape, not values", which is the *right* response — but we never
state the pixel reason. Recommend Strip explicitly sets `values: 'shape-only'` and the docs cite
this paper. Similarly, "no benefit beyond 80 px" is a *ceiling on the value of Rescale*: past that,
extra height should buy new **content** (our Reveal verb), not a taller plot area. That is a
published justification for the library's entire premise.

## 4.3 Axis labels, tick counts, and label rotation — verified, with numbers

**Citation.** Justin Talbot, Sharon Lin, Pat Hanrahan. "An Extension of Wilkinson's Algorithm for
Optimal Axis Labeling." *IEEE InfoVis 2010* / *TVCG* 16(6), pp. 1036–1043.
<https://www.justintalbot.com/wp-content/uploads/2010/10/labeling.pdf>

The algorithm scores a candidate labelling as a weighted sum:

> `score = 0.2 · simplicity + 0.25 · coverage + 0.5 · density + 0.05 · legibility`

with "scores above 0.75 are quite good". **Density carries half the weight** — i.e. the published
optimum for axis labelling is dominated by *how many labels per unit length*, exactly the quantity
our Densify/Sparsify verb controls.

Verified quotes, each of which maps to a token:

| Quote | Token it implies |
|---|---|
| "We begin penalizing labels if they are closer than **1.5em** apart and we forbid overlapping labels" | label min spacing = **1.5em**, and *hard* overlap prohibition |
| "at least **two labels** (our lower bound)" | min tick count = **2** |
| "Axis sizes are around 300 pixels. The desired density was adjusted to be about **1 tick per 100 pixels**, so each axis should have 3–4 labels" | target tick density ≈ **1 per 100 px** |
| font-size ladder **{5, 7, 9, 10, 12, 14, 18, 20, 24} pt** (LaTeX defaults) | min font size = **5 pt** at the extreme, practical floor higher |
| `orientation = 1 if horizontal, −0.5 otherwise` — "We consider orientation changes to be **a last resort** … we penalize them heavily" | rotation is a *scored penalty*, not a step |
| "By choosing **abbreviated label formats, splitting labels, and finally rotating labels**" | ordered degradation: abbreviate → split → rotate |
| "If no labeling is returned, we simply **don't display one** … only occurs when the plot is so small that having no labeling is visually preferable" | zero ticks is a legal terminal state |
| good labelings "even as the plot size shrinks to **30 pixels**" | axis labelling survives to ~**30 px** |
| coverage weights tuned so "almost all labelings have **less than 20% whitespace**" | domain padding ≤ **20%** |

Note the target density is expressed by the authors in **labels per inch**, i.e. physically, not in
device pixels — same posture as Heer 2009's millimetres.

**Verdict on our draft's tick formula.** `xTicks = clamp(floor(width / 90), 2, 8)`:

- The **lower clamp of 2 is confirmed**, and it is confirmed by name — Talbot's stated lower bound
  is exactly two labels.
- The **90 px divisor is very close to Talbot's ~100 px** target density. Our number is slightly
  denser than the published target. That is defensible (they were labelling 300 px axes with 3–4
  labels; a 900 px dashboard axis with 10 labels is normal practice) but the honest statement is:
  **the divisor should default to 100, not 90, if we want to claim a citation.** Changing 90 → 100
  makes the formula quotable. I recommend it.
- The **upper clamp of 8 is unsupported.** Nothing in Talbot caps label count; density is a
  continuous penalty, so a 1600 px axis should legitimately carry more than 8 labels. Recommend
  removing the hard cap and deriving it from spacing instead.
- **We are missing two published rungs.** Our draft goes straight from "ticks" to "rotate 45°".
  Talbot's ordering is **abbreviate → split → rotate**, with rotation "a last resort … penalized
  heavily". So our Relabel verb should have `abbreviate` and `split` steps *before* `rotate`, and
  Transpose should come after rotate, not instead of the missing steps.
- **Zero ticks is legitimate.** Talbot's algorithm is allowed to return nothing. Our Micro/Tile
  rungs already do this; now it has a citation.

## 4.4 Aspect ratio — the literature says "derive it from data", the grid says "you get what you get"

**Citation.** Justin Talbot, John Gerth, Pat Hanrahan. "Arc Length-Based Aspect Ratio Selection."
*IEEE InfoVis 2011* / *TVCG* 17(12), pp. 2276–2282.
<https://www.justintalbot.com/wp-content/uploads/2011/10/arclength.pdf>

Reviews and compares the published family: Cleveland's **banking to 45°**, average-absolute-orientation
(**AAO**), median-slope (**MS**), and Heer & Agrawala's **global/local orientation resolution
(GOR/LOR)**; proposes minimizing **arc length** at constant plot area, and concludes:

> "We believe arc length should become the default aspect ratio selection method."

**This is a genuine tension with our architecture and the draft does not acknowledge it.** The
literature's whole framing is that aspect ratio is a *free variable to be optimized from the data*.
A 12-column grid **imposes** aspect ratio from layout. So:

- Our `aspect` bucket (`portrait | square | landscape | ultrawide`) is a **constraint being read**,
  not a variable being chosen. That is a legitimate and defensible inversion, but it should be
  stated, because it means we are knowingly forgoing an optimization the literature recommends.
- Consequence: **non-uniform rescaling across rungs literally changes perceived slope.** Kim et al.
  2021 make exactly this point (their Figure 9A distortion). A user dragging a line chart from 4x3
  to 8x3 has changed the visual message, not just the size, and no verb in our list names that.
- Recommended mitigation, which is ours and not published: when a chart is `ultrawide`, the plan
  should be permitted to **constrain the plot area's aspect** and pad, rather than stretching the
  data region — i.e. treat extreme aspect as a trigger for **Reflow** (put the freed space into
  legend/labels/annotation) rather than **Rescale**. This is consistent with the published advice
  without claiming it.

## 4.5 Category-count ceilings — verified, but only for smartwatch-sized charts

From Blascheck et al. 2018 and the While et al. 2024 replication (both detailed in Topic 3, with
full citations there):

| Chart | Published ceiling | Caveat |
|---|---|---|
| Bar | usable to **24 categories** at 320x320 px | ≈ 10.7 px per category |
| Donut | usable to **24 categories** | fastest type at every size, both age groups |
| Radial | degrades hard; unusable above ~**7** | 7/22 older adults *quit* the 24-category condition |
| Any | **30 categories described as illegible** at that size | this is the *authors' methods-section judgement* for why they stopped at 24, **not a measured threshold** |

**Verdict on `aggregateAfter` (draft default 8).** The published evidence does **not** support 8 as
a legibility ceiling — bar and donut both survive to 24 at *smartwatch* size. Our 8 is a
*communication* choice (a legend of 8 is scannable; 24 is not), which is a fine reason, but it is
**not a perceptual threshold and must not be presented as one.** The defensible split:

- `aggregateAfter` for **legend-bearing** charts: **8**, our choice, UNVERIFIED as a threshold.
- `aggregateAfter` as a **legibility** ceiling: **24** (bar, donut), **7** (radial), Blascheck 2018,
  replicated 2024.

Our draft's "or any slice < 2%" rule has **no published basis whatsoever**. I could find no paper
proposing a minimum angular slice. Mark it as ours.

## 4.6 What I could NOT verify — explicit UNVERIFIED list

Per the rigor constraint, these were all requested and I am reporting failure rather than guessing.
**Do not cite anything in this table.**

| Requested threshold | Status |
|---|---|
| **Minimum readable text size in px** | **UNVERIFIED as a perceptual number.** The only figure I have is Talbot 2010's font ladder bottoming at **5 pt**, which is a *search-space bound in a typesetting system*, not a legibility study. WCAG has no minimum font size requirement (it requires resizability, not a size). Do not claim a px floor. |
| **Minimum distinguishable stroke width** | **Could not retrieve.** No paper found. |
| **Minimum bar width** | **Could not retrieve.** No paper found. Blascheck 2018's 24-bars-in-320px implies ~10.7 px/bar *including gap* is legible for a comparison task, but the authors do not state a bar-width threshold and I will not derive one as if they had. |
| **Minimum gap between bars** | **Could not retrieve.** No paper found. |
| **Minimum scatter point separation** | **Could not retrieve.** No paper found. (Overplotting/density literature exists — e.g. splatterplots, binned aggregation — but it addresses *what to draw when points overlap*, not a minimum separation threshold. I did not retrieve those papers either.) |
| **Maximum legend entries before a legend hurts** | **Could not retrieve. No published number found.** This is a genuine gap. Our 8 is ours. |
| **Evidence for direct labelling over legends** | **Not retrieved as a primary source.** I could not obtain a study that directly compares direct labels vs. legends at matched sizes. The *rationale* usually invoked is Mayer's spatial-contiguity principle from multimedia learning; **I did not read Mayer** and am not citing him. Note the responsive corpora do document the *transformation* — Hoffswell 2020 and Kim 2021 both record moving/removing legends and adding in-place labels as observed strategies — but "observed in practice" is not "shown to be better". |
| **Cleveland & McGill 1984, primary source** | **Not retrieved.** The rankings I can vouch for come *second-hand* through Heer & Bostock's 2010 replication (§4.2), which notably found the original theory's angle-vs-length prediction **not supported**. Cite Heer & Bostock, not Cleveland & McGill. |
| **Colin Ware, *Information Visualization*** | **Not retrieved.** No claim from Ware appears in this document. |
| **Munzner's rules** (*Visualization Analysis and Design*) | **Not retrieved.** No claim from Munzner appears in this document. |
| **Talbot, Setlur & Agrawala, "Four Experiments on the Perception of Bar Charts" (InfoVis 2014)** | **Paper confirmed to exist** via OpenAlex; **no open-access PDF available**, could not read. Its findings are therefore **UNVERIFIED**. This is the most likely place a published bar-width or bar-spacing number would live — worth a library/ACM-DL retrieval later. |
| **Stone & Bartram, gridline alpha** | **Known only second-hand**, via Heer & Bostock's corroboration of "alpha = 0.2 as a safe default". The number is verified as *quoted by Heer & Bostock*; I did not read Stone & Bartram. |


# 5. Hysteresis / flicker

### Confirmed prior art so far: practitioners already framed this exact problem

Hoffswell, Li & Liu (CHI 2020) contains a direct, citable statement of the continuous-vs-discrete
tension, from a working news-graphics designer:

> P5: *"We more just change the width of the screen pixel by pixel to make sure every pixel is
> properly looking okay."*
>
> P3: *"dynamically positioning things like labels and annotations at every possible screen width is
> very easy for that to go wrong and having a **fixed number of breakpoints tends to be a little bit
> less error-prone**."*

The authors' own gloss: "While the ability to make designs dynamic could be helpful for producing
visualizations that work for any screen size, testing all possibilities was a common source of
difficulty and undesirable user effort."

**Interpretation for us:** this is published evidence *for* our discrete size-class ladder over
continuous interpolation — a small number of named rungs is defensible on the grounds of testability
and authoring predictability, not just implementation convenience. It is *not* yet evidence about
hysteresis at the boundary itself.

### Headline verdict on the open question

**No paper I retrieved studies hysteresis, deadbanding, or flicker in responsive visualization.**
Our draft's proposed "~8 px deadband" has **no published precedent that I could find**, in either the
visualization literature or the CSS specifications. I searched Hoffswell 2020 and Kim 2021 full text
for `hysteresis`, `flicker`, `oscillat`, `threshold`, `breakpoint` — nothing. **Mark the 8 px
deadband as an invention of ours.**

**But** the web platform specs answer a *different and more important* question, and their answer is
architecturally decisive. They do not damp the oscillation. They make it **structurally impossible**,
or they **terminate it and report an error**. Both strategies are directly applicable.

### 5.1 CSS's answer: prevent the cycle by containment, not by a deadband

**Citation.** *CSS Conditional Rules Module Level 5*, W3C Editor's Draft (retrieved 2026-08-22).
<https://drafts.csswg.org/css-conditional-5/>
(Important correction for our notes: **container queries are no longer in CSS Containment Level 3.**
css-contain-3 is now an empty placeholder — "Having moved these features to other specifications,
this document is now empty" — with the changelog entry "Move Container Queries to
[CSS-CONDITIONAL-5] (Issue 10433)". Any doc of ours citing css-contain-3 for container queries is
out of date. <https://drafts.csswg.org/css-contain-3/>)

The normative mechanism, from the `container-type` definition:

> `size` — "Establishes a query container for container size queries on both the inline and block
> axis. Applies **style containment and size containment** to the principal box, and establishes an
> **independent formatting context**."
>
> `inline-size` — "Applies style containment and **inline-size containment** … "

The rationale is stated explicitly where the spec forbids querying a sibling box:

> "An ancestor element that generates a box is **not an eligible container** for container size
> queries if that box is not an ancestor box of any boxes generated by the querying element. … If we
> allowed querying the size of a sibling box, it would **introduce layout cycles**."

**This is the answer to our open question.** The platform's position is: *a size query is only safe
if the queried size cannot be affected by the result of the query.* Size containment guarantees that
— the container's size is computed as if it had no contents.

**Direct consequence for our library.** Our pipeline is
`measure box → resolveSizeClass → planChart → render`. That loop is safe **if and only if** the
rendered output cannot change the measured box. Concretely:

- The measured element **must** have its size determined by the grid cell, never by chart content.
  No `height: auto`, no intrinsic sizing, no `min-content`, no wrapping text that grows the box.
- If a `ChartPlan` at rung N produces content taller than the box, and that content is allowed to
  push the box taller, and the taller box resolves to rung N+1, whose content is shorter, and the
  shorter content lets the box shrink back to rung N — **that is a genuine infinite loop, and no
  deadband fixes it.** The deadband only slows it down. Containment fixes it.
- Practical rule: put `contain: size` (or `contain: inline-size` for width-only ladders), or
  `container-type: size`, or simply an explicit pixel/grid-derived height, on the measured element.
  We should ship this as part of the widget's own stylesheet, not leave it to the consumer.

### 5.2 The second CSS mechanism: snapshot the state, don't read it continuously

For scroll-state container queries the spec faces the same feedback problem and solves it by
**quantising in time** rather than in space:

> "Scroll state may cause layout cycles since queried scroll state may cause style changes, which may
> lead to scroll state changes as a result of layout. To avoid such layout cycles, scroll-state query
> containers **update their current state as part of run snapshot post-layout state steps** which is
> only run at specific points in the HTML event loop processing model. … **This snapshotted state
> will be used for any style and layout updates until the next time these steps are run.**"

**Consequence:** the temporal analogue of a deadband is a *snapshot point*. Our draft already
rAF-batches the ResizeObserver callback; the spec-blessed framing for that is "the size class is a
snapshot taken once per frame and held constant for the whole frame", which is a stronger and more
testable statement than "we debounce".

### 5.3 ResizeObserver's answer: bounded passes, then an explicit error — never damping

**Citation.** *Resize Observer*, W3C Editor's Draft (retrieved 2026-08-22).
<https://drafts.csswg.org/resize-observer/>

The algorithms, verbatim from §3.4:
- **Gather active resize observations at depth** — "If `targetDepth` is greater than `depth` then add
  observation to `[[activeTargets]]`. Else add observation to `[[skippedTargets]]`."
- **Broadcast active resize observations** — "returns the depth of the **shallowest** broadcast
  target depth."
- **Deliver Resize Loop Error** — "Initialize event's message slot to
  **`"ResizeObserver loop completed with undelivered notifications."`** Report the exception event."

So the platform's loop-breaking design is: process observations in **strictly increasing DOM depth**
order within a single `update the rendering` pass, so a callback that resizes a *deeper* element gets
handled in the same frame, but a callback that resizes a *shallower or sibling* element is deferred
and, if it never settles, produces an **error rather than an infinite loop**. There is no damping,
no deadband, no debounce anywhere in the spec.

**Two hard consequences for us:**
1. A `ChartPlan` change must never resize an ancestor of the observed element. If a rung change makes
   the widget's own container grow, we will produce `ResizeObserver loop completed with undelivered
   notifications` in the console of every consumer. This is a **test we should write**: assert the
   error event is never fired while dragging a widget across every rung boundary.
2. Observing **one** element per widget and writing only to its *descendants* is the depth-ordered
   pattern the spec is designed around. Our draft already says "one ResizeObserver per widget,
   contentBoxSize" — that is correct; the missing half of the rule is "and the plan only ever
   affects that element's descendants."

### 5.4 What remains genuinely open

| Question | Status |
|---|---|
| Is there a published *perceptual* deadband — how much re-layout during a drag is tolerable? | **UNVERIFIED. Could not find any source.** |
| Is 8 px the right deadband? | **No published basis.** It is our invention. If we keep it, express it as a fraction (e.g. 2–3% of the boundary width) rather than an absolute, since a 8 px band means something very different at a 120 px boundary and a 1200 px one. |
| Prior art on hysteresis in level-of-detail switching (3D graphics "LOD popping") | **Not retrieved.** I believe this literature exists (LOD hysteresis is standard practice in real-time rendering) but I did not obtain a citable source, so **do not cite it**. |
| Whether animation should mask the switch instead of a deadband | See topic 6 — this is probably the better answer, and it *does* have published support. |

---

# 6. Animation / transition between responsive states

**Citation.** Jeffrey Heer, George G. Robertson. "Animated Transitions in Statistical Data Graphics."
*IEEE InfoVis 2007* / *TVCG* 13(6).
PDF (retrieved & read): <https://idl.cs.washington.edu/files/2007-AnimatedTransitions-InfoVis.pdf>

### Does the literature say animate or cut?

**Animate.** The paper's own summary of its two controlled experiments (24 subjects, 288 trials):
> "significant advantages for animation across both syntactic and semantic tasks"

and subjects "were highly enthusiastic about animated data graphics, and felt that it facilitated
both impr[oved]…". Animated transitions were **1.25 seconds** in duration; static transitions were
immediate. So: **cut is the worse option**, on measured object-tracking and change-estimation
performance, not just preference.

### The two principle families (from Tversky et al., as adopted by Heer & Robertson)

**Congruence** — the structure and content of the animation should correspond to the structure of
the data:
- **Maintain valid data graphics during transitions.** "as much as possible, intermediate
  interpolation states remain valid data graphics."
- **Use consistent semantic-syntactic mappings.**
- **Respect semantic correspondence** — a mark representing a given data point must not be reused to
  depict a *different* data point across the transition.
- **Avoid ambiguity.**

**Apprehension** — the animation should be readily and accurately perceived:
- **Group similar transitions** (Gestalt common fate).
- **Minimize occlusion.**
- **Maximize predictability** — "This suggests **slow-in slow-out timing**".
- **Use simple transitions** — "translation and divergence (expand/contract) motions are easier to
  understand than rotat[ion]".
- **Use staging for complex transitions** — "break up the transition into a set of simple
  sub-transitions … For example, **separating axis rescaling from value changes** may help."
- **Make transitions as long as needed, but no longer** — "**recommend transition times around 1
  second**, though transitions with minimal movement can likely be performed faster."

### Their taxonomy of transition types (§3.1) mapped onto our eight verbs

| Heer & Robertson type | Our verb |
|---|---|
| View Transformation (pan/zoom) | — (we have no viewport) |
| **Substrate Transformation** (axis rescaling, linear↔log, fisheye) | **Densify/Sparsify**, and the axis half of **Rescale** |
| **Filtering** (entry/exit of items) | **Reveal/Conceal**, **Aggregate** |
| **Ordering** | (implicit in our "slices ordered desc") |
| Timestep | — |
| **Visualization Change** (bar→pie, palette edits) | **Substitute** |
| **Data Schema Change** (roll-up / drill-down; orthogonal vs. nested) | **Aggregate** |

That mapping is a real validation result: **every mark-level verb in our draft corresponds to a
transition type this paper has already designed and tested an animation for.** Their concrete
recipes, from §4.1:
- **Filtering:** "bars in a bar chart may grow up from a baseline"; layers in a stacked area chart
  "might fall from" the top. Consistent presentation across types was chosen.
- **Substrate transformation:** "axis labels and gridlines move to depict scale changes, smoothly
  fading in and out when added and removed. For example, when changing from a quantitative to an
  ordinal scale, **old labels and gridlines first fade out and then new ones fade in**."
- **Scatter → bar (Fig. 1), staged:** first move points to their x-coordinates and update the x-axis;
  *then* morph to bars. The un-staged version directly interpolates and is worse.
- **Stacked bars → grouped bars, staged:** "first changing the widths of bars, then having them fall
  into place."
- **Donut/pie value changes:** items "translate while also changing size"; to separate those they
  used a **multi-ring configuration** to avoid occlusion (their Figure 3).

### The empirical findings that constrain our design

1. **Staging works, but modestly, and it is slower than you think.**
   > "Except for value changes in scatter plots, staging had lower error rates for object tracking,
   > in some cases significantly so. We suspect this was largely due to minimizing occlusion."
   > "Simple staging (e.g., separating axis rescaling from value changes) also had significantly
   > higher preference ratings and lower (though not significantly so) error rates for change
   > estimation. As a result, we **recommend the use of simple staging**."
   And on timing: "Multiple subjects further commented that staging was less demanding and that they
   preferred slower animations (stages were faster in Experiment 1). As a result, we endorse the use
   of staged animation for scatter plots, but **recommend timing each stage around a full second**,
   rather than around a half-second each."
   > Caveat they raise themselves: heavy multi-stage transitions were disliked; "it is preferable to
   > minimize" them.

2. **Axis rescaling is the expensive operation.**
   > "Axis rescaling made change estimation difficult, increasing overall [error]… of animation
   > tempered these effects, suggesting that movement helped subjects make sense of scale changes.
   > The results suggest that, if possible, common scales should [be used]…"
   And in the conclusion: "**avoiding axis rescaling when possible, and persisting axis gridlines as
   landmarks when rescaling is unavoidable**."

3. An observed interaction: "a potentially interesting interaction was observed between **smaller
   mark sizes and increased accuracy of change estimation**."

### Direct instructions this gives our library

- **Animate rung changes; do not cut.** Default duration **~300–1000 ms**; the published anchor is
  ~1 s for a transition with real movement and "minimal movement can likely be performed faster".
  Our Rescale-only rung changes are minimal-movement and should be at the fast end.
- **Stage any rung change that both rescales an axis and changes marks.** Stage 1: axis/tick change.
  Stage 2: mark change. Each stage ~1 s if it is a scatter-plot-scale movement; shorter otherwise.
  Do not exceed two stages.
- **Persist gridlines through a Densify/Sparsify change** rather than removing and redrawing them —
  they are the landmarks that make an axis change comprehensible.
- **Object constancy is a hard requirement for `Aggregate`.** "Respect semantic correspondence"
  means the mark that was "Category G" must not silently become the mark that is now "Other". The
  transition into an "Other" bucket has to be a visible merge (the slices converge), not a relabel.
  This is a much stronger version of our draft's "aggregation must be visible" rule — it makes it an
  *animation* requirement, not a tooltip requirement.
- **Fade in/out for Reveal/Conceal; grow-from-baseline for bars; avoid rotation.**
- **This is also the best available answer to the hysteresis question (topic 5).** A ~1 s eased
  transition means a boundary crossed twice in under a second is visually one continuous motion
  rather than two discrete jumps. Animation converts flicker into smear. It does not remove the need
  for the containment fix in §5.1 (which prevents a true infinite loop), but it very likely removes
  the need for a spatial deadband at all. **NOTE: this inference is mine — no paper I retrieved makes
  this claim. It is a design argument, not a citation.**

---

## Tokens implied by the literature

Three tiers. **Tier A** tokens can be defended in the README with a citation. **Tier B** are ours
but are *consistent with* something published. **Tier C** are pure invention — they may still be
correct, but the docs must not imply a source.

### Tier A — published value, direct citation

| Token | Value | Source |
|---|---|---|
| `--chart-gridline-min-spacing` | **8 px** | Heer & Bostock, CHI 2010, Exp. 3: "The results suggest that gridlines be separated by at least 8 pixels." <https://idl.cs.washington.edu/files/2010-MTurk-CHI.pdf> |
| `--chart-gridline-alpha` | **0.2** | Heer & Bostock, CHI 2010, corroborating Stone & Bartram's "safe default" (Stone & Bartram not read directly) |
| `--chart-label-min-spacing` | **1.5 em** | Talbot, Lin & Hanrahan, InfoVis 2010: "We begin penalizing labels if they are closer than 1.5em apart and we forbid overlapping labels" |
| `--chart-ticks-min` | **2** | Talbot 2010: "at least two labels (our lower bound)" |
| `--chart-tick-target-spacing` | **100 px** *(recommend changing from our 90)* | Talbot 2010: "The desired density was adjusted to be about 1 tick per 100 pixels" |
| `--chart-axis-min-length` | **30 px** | Talbot 2010: produces good labelings "even as the plot size shrinks to 30 pixels" |
| `--chart-domain-max-whitespace` | **20 %** | Talbot 2010: coverage weights tuned so "almost all labelings have less than 20% whitespace" |
| `--chart-font-size-min` | **5 pt** *(search-space bound, NOT a legibility floor — see §4.6)* | Talbot 2010 font ladder {5,7,9,10,12,14,18,20,24} pt |
| `--chart-plot-height-optimal` | **24 px** (line / 1-band) | Heer, Kong & Agrawala, CHI 2009: "a chart height of 24 pixels (6.8 mm) to be optimal" |
| `--chart-plot-height-min-for-values` | **> 40 px** | Heer & Bostock 2010: "charts 40 pixels tall resulted in significantly more error (p < 0.001 in all cases)" |
| `--chart-plot-height-saturation` | **80 px** | Heer & Bostock 2010: "little benefit for increasing chart height beyond 80 pixels when using a 0-100 scale" |
| `--chart-horizon-min-height` | **6 px** (2-band) | Heer 2009: "we recommend using 2-band charts for chart heights of 6 pixels (1.7 mm) or more" |
| `--chart-horizon-max-bands` | **3** | Heer 2009: "We discourage the use of 4 or more bands" |
| `--chart-categories-max-legible` | **24** (bar, donut) | Blascheck et al., InfoVis 2018, 320x320 px smartwatch; replicated by While et al., CHI 2024 |
| `--chart-categories-max-radial` | **7** | Blascheck 2018; While et al. 2024 (7/22 older adults quit the 24-category radial condition) |
| `--chart-transition-duration` | **~1000 ms** | Heer & Robertson, InfoVis 2007 — see Topic 6 for the staging/timing detail |

### Tier B — ours, but consistent with published work

| Token | Value | Nearest published support |
|---|---|---|
| `--chart-label-degrade-order` | `abbreviate → split → rotate → transpose` | Talbot 2010: "By choosing abbreviated label formats, splitting labels, and finally rotating labels"; rotation is "a last resort … we penalize [it] heavily". The final `transpose` step is ours. |
| `--chart-ticks-max` | *(recommend REMOVING the hard cap of 8)* | Talbot 2010 caps nothing; density is a continuous penalty. Derive from `--chart-tick-target-spacing` instead. |
| `--chart-aggregate-after` (legend-bearing charts) | **8** | A communication choice, not a perceptual one. Legibility ceiling is 24 (§4.5). Must not be presented as a threshold. |
| `--chart-substitute-below-height` | **24 px** → switch line to horizon/band | Heer 2009 gives the error curve and the encoding fix; the *rule* of wiring it to a rung is ours. **This rung is missing from the draft — recommend adding.** |

### Tier C — no published basis found. Ours. Label as such.

| Token | Draft value | Status |
|---|---|---|
| `--chart-tick-spacing` divisor | `width / 90` | **UNVERIFIED.** Closest published figure is 100 px (Talbot 2010). Recommend 100. |
| `--chart-transpose-after-categories` | **10** | **UNVERIFIED.** No paper found. Draft attributes it to Basedash docs — that is a product convention, not research. |
| `--chart-aggregate-min-slice` | **2 %** | **UNVERIFIED.** No paper proposes a minimum angular slice. |
| `--chart-donut-reflow-aspect` | **1.4** | **UNVERIFIED.** No paper found. Aspect-ratio literature (Talbot 2011) optimizes plot aspect from data, not layout reflow. |
| `--chart-heatmap-min-cell` | **8 px** | **UNVERIFIED as a cell size.** Numerically coincides with Heer & Bostock's 8 px gridline spacing, but that result is about *tracing gridlines to labels*, not cell legibility. Do not cite it as support — the coincidence is not evidence. |
| `--chart-point-budget` | **2000** (SVG → canvas) | **UNVERIFIED as perception.** This is a *rendering-performance* threshold, and it should be documented as one. No perceptual basis claimed or found. |
| `--chart-legend-max-entries` | **8** | **UNVERIFIED.** §4.6: no published number for legend capacity exists that I could find. |
| `--chart-bar-min-width`, `--chart-bar-min-gap`, `--chart-point-min-separation`, `--chart-stroke-min-width` | — | **No published values found.** If we ship these, they are engineering defaults. See §4.6. |
| `--chart-hysteresis-deadband` | **8 px** | **UNVERIFIED — and see Topic 5.** No visualization paper studies hysteresis. The web platform prevents the cycle *structurally* (size containment) rather than by damping. Recommend solving it with containment + animation, and treating the deadband as a fallback, not a primary mechanism. |

### Cross-cutting note on units

Two of the three source groups express their thresholds **physically** — Heer 2009 in millimetres
("24 pixels (6.8 mm) on our 14.1" 1024x768 displays"), Talbot 2010 in **labels per inch**. Our
tokens are in CSS px. On a 2x display at typical viewing distance the two happen to align
reasonably, but the published numbers are *angular-size* claims wearing pixel clothing. If the
library ever cares about print, kiosk, or watch output, these tokens need a density multiplier.
Flagging this now because every number in Tier A inherits the assumption.
