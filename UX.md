# UX

Who this library is for, what hurts today, what we give them instead, and how we hand it over so it
is understood rather than merely documented.

Companion to [`PRODUCT.md`](PRODUCT.md) (*what* we are building) and [`DESIGN.md`](DESIGN.md) (*how it
looks*). The engineering explanation — architecture, packages, testing — lives in
[`research/01-plain-english.md`](research/01-plain-english.md), which is thorough about *how the
system works* and deliberately says nothing about *who it is for*. This file is that missing half.

---

## ⚠ What this document stands on

**There are no users yet.** No product, no code, no `package.json`, nobody to interview. Everything
below is inferred from artefacts and literature, not reported by people:

| Evidence | What it is |
|---|---|
| [`research/00-source-analysis.md`](research/00-source-analysis.md) | One shipping competitor (Basedash) studied frame by frame, its docs read, and its shipped bundle disassembled. |
| [`research/raw/05-theory-responsive-viz.md`](research/raw/05-theory-responsive-viz.md) | Published perception research — Heer, Talbot, Kim et al., Hoffswell et al. Numbers about human vision, not taste. |
| [`research/raw/03-landscape-charting.md`](research/raw/03-landscape-charting.md) | Eleven React charting libraries surveyed for what they do and do not offer. |
| [`research/decisions/`](research/decisions/) | Three claims we checked empirically and had to narrow when they came back weaker than written. |

So: **read the roles below as roles the evidence implies, not as researched segments.** Two things in
particular are unvalidated and marked ⚠ where they appear — that the pain is felt often enough to
drive adoption, and that developers want the library to make these decisions rather than expose more
knobs. Both are the kind of thing a first real user answers in an afternoon and no amount of desk
research settles.

---

## 1. Two users, and only one of them can call the API

Almost every chart library is designed for one person. This one has two, and the gap between them is
the entire product.

**The builder.** A frontend or app developer embedding charts and dashboard widgets into their own
product. They write the code, choose the props, and ship. They make their decisions **once**, at
**one** size, on **their** machine, usually a wide one.

**The viewer.** Whoever opens the dashboard afterwards. Usually a different person. Often on a
narrower screen, and — the part that matters — free to drag any widget to any size the grid allows,
including sizes the builder never previewed and never will.

The builder configures once. The viewer meets the result at every size. Conventional chart libraries
resolve that asymmetry in the builder's favour: they take `width` and `height` and render whatever
was configured, scaled to fit. The viewer absorbs the difference, and they have no way to report it —
they are not the customer, they do not file issues, and a chart that has quietly become unreadable
still looks like a chart.

**The library's job is to act for the viewer, at the moment the builder is not there.** That is the
whole design brief, and every rule further down is a consequence of it.

There is a third role, smaller but real:

**The design-system owner.** Cares that charts obey the same tokens as everything else in the
product, and that one widget can diverge — the alert dashboard, the embedded white-label view —
without a second component or a second provider.

---

## 2. What hurts today

Five problems. Each is grounded in something observed, not assumed.

### P1 — The chart that lies when it gets small

Squeeze a line chart into a 3×1 strip and most libraries render the same chart, smaller: axis,
ticks, gridlines, all of it, at a third of the height.

That chart is not ugly. It is **dishonest**. It draws a y-axis, which is a promise that you can read
values off it, at a size where you provably cannot:

- Below **40 px** of plot height, value-estimation error rises significantly — Heer & Bostock 2010,
  p < 0.001.
- Below **24 px**, a line mark degrades measurably, and the published fix is to *change the encoding*
  (to a horizon or band), not to shrink the line — Heer 2009.

Nobody notices, which is the problem. The viewer reads a number off an axis that cannot support it.
The chart looks fine. There is no error, no warning, and no bug report.

*Today's answer: none. The chart scales.*

### P2 — The breakpoint tax

Builders already want smaller-means-simpler. We know because a competitor demonstrates it out loud:

> "Let's make it a little bit more responsive to the side there, and **we get a better visualization
> depending on the size of the card** that you have inside of your dashboard."
> — Basedash demo, [03:45–04:10](research/00-source-analysis.md)

Three separate transformations happen in that one drag — the donut *repositions* centre to right, a
legend *appears* with values and percentages, and the tail of small categories *aggregates* into
`Other 19 (6%)`. All three are visible in the captured frames.

None of it is specified, documented, or exposed as an API anywhere in their product. It is wanted
enough to lead a demo and hand-rolled anyway.

So each builder rebuilds it: a `ResizeObserver` per widget, a chain of `if (width < …)` per chart
type, re-derived per project, untested because testing it needs a browser, and the first thing cut
under deadline. ⚠ *How often builders actually pay this tax rather than shipping the shrunken chart is
the assumption a real user settles.*

### P3 — Restyling one widget means threading JavaScript

The design-system owner wants the dashboard's charts to match the product. Today that is a theme
object in JS, passed through props or a context provider, and changing it re-renders. Wanting *one*
widget to differ means prop-drilling or a second provider around a subtree.

⚠ **State this one narrowly.** Highcharts styled mode already exposes stroke width, dash style,
gridline width, tick colour and width, plot lines, zones and typography from CSS, and ships indexed
colour custom properties — we checked, and the earlier "colours only" claim was wrong
([decision 014](research/decisions/014-highcharts-styled-mode-correction.md)). What survives is
narrower and still real: **one namespace covering every knob rather than a colour-indexed subset, and
per-widget scope on a shared dashboard.**

### P4 — The dashboard that is a hole until the JavaScript lands

A chart that needs a client runtime leaves an empty rectangle through first paint. On a dashboard
that is most of the page.

⚠ **Also narrower than it first looked.** Server-side SVG on its own is table stakes; visx renders
inside a React Server Component today at 124 B of page JS
([decision 013](research/decisions/013-zero-js-claim-narrowed.md)). What is genuinely absent is the
*combination*: planned, size-adaptive, zero-JS, **and still themeable after render**. Vega's `toSVG()`
is zero-JS but bakes presentation into attributes, so the output is inert; nivo fails at import inside
an RSC; Observable Plot returns a DOM node and structurally cannot.

### P5 — The viewer can destroy their own widget

A grid that lets you drag freely lets you drag a widget down to a size where it means nothing. The
reference implementation we studied has **no per-widget minimum size** — nothing lets a widget say
*"below 2×2 I am meaningless."*

That is a small hole with an outsized effect: the failure looks like the chart's fault.

---

## 3. What we give instead

> **You give a chart a box. It decides what it can honestly say at that size — and tells you what it
> decided.**

Not *"it resizes."* Every library resizes. The difference is that a smaller chart here is a
**different chart chosen for that size**, and the choice is inspectable.

### The ladder, in plain language

Six size families, named for the information budget rather than a pixel count — because you size
widgets in grid cells and the names should be in the same unit as your thinking.

| Family | Roughly | What it says | What it refuses to claim |
|---|---|---|---|
| **Micro** | 1×1 | One number, maybe a summary phrase — *"↑ 12% this week"* | Everything else. No axes, ever. No hover. |
| **Tile** | 2×1 – 2×2 | A number, a delta, a sparkline | No values off the chart. Below 24 px of plot height the line is *replaced* by a horizon band, not shrunk. |
| **Strip** | 3×1 – 4×2 | Trend shape; first and last x-labels only | **No y-axis.** Under 40 px it has not earned the right to imply readable values. |
| **Panel** | 3×3 – 6×4 | A real chart: axes, ticks, gridlines, direct labels | The default. Most widgets live here. |
| **Canvas** | 6×5 – 8×6 | Chart plus legend, values, annotations, crosshair | Room to be explicit instead of implied. |
| **Stage** | 9×6 – 12×8+ | Call-outs, threshold bands, small multiples, footnotes | Extra space buys *content*, not a taller plot. |

Full per-type specifications, with citations, in
[`research/10-responsive-ladder.md`](research/10-responsive-ladder.md).

### The four rules that make it predictable rather than magic

1. **A rung is a complete description, not a diff.** Going up is not "everything below, plus more."
   Small sizes carry content large sizes have no reason to show — a Micro chart's summary phrase has
   no place on a Stage. (`DESIGN.md`, the Complete Rung Rule.)
2. **Below 40 px of plot height, no y-axis.** The chart may not make a claim its size cannot support.
   This is enforced in CI, not just documented: `valueLegibility !== 'values'` must imply
   `!axes.y.visible`, or the build fails.
3. **Past 80 px of plot height, space buys content, not plot.** *"Little benefit for increasing chart
   height beyond 80 px"* (Heer & Bostock 2010) is the single strongest published argument for this
   library existing at all.
4. **Concealed means gone.** A dropped element is removed, not greyed out, not faded to zero, not
   left in the DOM. A ghost of a label costs space, adds accessibility-tree noise, and implies
   information nobody is showing. When something must go, we **compensate**: make it toggleable, or
   leave a numeric marker where it was. (`DESIGN.md`, the Conceal Means Gone Rule.)

### One thing that is not intuitive, and matters

**The legend does not move in one direction.** Going up, it externalises — out of the plot, into its
own column. Going down, the published pattern is to *internalise or add* it, because at small sizes
direct labels stop fitting and a compact internal legend is the documented answer
(`research/raw/05`). So the legend can be absent in the middle of the range and present at both ends.
It is expressed as a discriminated union of placements, never a boolean, precisely because a boolean
cannot say that.

---

## 4. Use cases

Each one: the situation, what happens today, what happens with this, and what actually changed for
the person looking at the screen.

### UC1 — The resizable dashboard

**Situation.** An analytics product where users arrange their own widgets and drag them freely.

**Today.** Each widget renders the same chart at whatever size it is given. The 2×1 tiles are
unreadable; the 12×8 hero is a Panel chart with acres of empty plot.

**With this.** Drag a line widget from Panel down to Strip: the y-axis leaves, the x-axis keeps only
its endpoints, the plan's `valueLegibility` flips from `'values'` to `'shape-only'`. Drag it down
again to Tile: the line is *replaced* by a horizon band, and a value with a delta appears above it.
Drag it up to Stage: min/max/last call-outs, threshold shading, small multiples past four series. The
change animates — roughly 300 ms for a rescale, roughly 1000 ms when marks actually move — so
crossing a boundary twice reads as one continuous motion instead of two jumps.

**What changed.** The small widget stopped pretending to be the large one. Nothing was hidden; things
were decided.

### UC2 — The KPI tile that must stay meaningful

**Situation.** A revenue number that has to survive being dragged into a corner.

**Today.** It becomes a chart with three illegible ticks, or the user drags it to 1×1 and it renders
a clipped mess.

**With this.** Two mechanisms, together. The widget declares a **minimum size** and the grid refuses
to go below it — a per-widget minimum the reference implementation does not have. Above that
minimum, the Micro rung is a designed state, not a degradation: the value alone, auto-fit type size,
no axes, whole widget as one tap target because hover targets at that size are below fat-finger
thresholds.

**What changed.** The tile has a floor and a designed bottom rung. The viewer cannot break it by
accident.

### UC3 — The report that has to render without JavaScript

**Situation.** A server-rendered summary page, a scheduled PDF, an emailed digest.

**Today.** Pick a library that renders on the server and accept that the output is inert — geometry
and colour baked into attributes, un-restylable afterwards. Or ship a client runtime and accept the
blank rectangles.

**With this.** `planChart()` is a pure function of size, a data-*shape* description, and preferences.
It runs on the server, returns a plain serialisable object, and `<Chart>` is hook-free — so the SVG is
in the HTML with JavaScript disabled, **and** still carries classes rather than baked attributes, so a
stylesheet can restyle it after the fact. Interactivity (`<AutoChart>`, tooltips, crosshairs,
brushing) is a separate opt-in layer.

**What changed.** The dashboard has content at first paint, and that content is still yours to theme.

### UC4 — The white-label embed

**Situation.** Your charts run inside a customer's product and must look like theirs, not like ours.

**Today.** Override a theme object, discover the parts it does not reach, fork.

**With this.** Two themes ship: *The Emission-Line Rail* as the default, and a documented **neutral
escape hatch** that resets to field-convention defaults for anyone who wants the ladder without the
visual world. Selected by class or stylesheet import, never by a JS prop.

**⚠ The honest limit.** Geometry-via-CSS is real but restricted. `x1`/`y1`/`x2`/`y2` on `<line>` are
not CSS-settable in any browser and none plan to be, so we never emit `<line>` for anything a token
must control ([decision 012](research/decisions/012-no-line-element-for-tokened-geometry.md)). A CI
gate checks the emitted element set, because a `var()` landing on a property that does not exist
parses cleanly, builds cleanly, and silently does nothing.

### UC5 — The one widget that has to look different

**Situation.** On an otherwise uniform dashboard, the incident panel needs alert colouring.

**Today.** A second provider, a prop threaded down, or a divergent component.

**With this.** A class on that widget. CSS custom properties cascade; there is no re-render, because
nothing about the *plan* changed — only presentation did. Alert colours live in their own namespace
and are never drawn from the series ramp, so a red series can never be mistaken for a failure state
(`DESIGN.md`, the Separate Alarm Rule).

**⚠ The one exception, and it is load-bearing.** Six properties — `font-family`, `font-size`,
`font-weight`, `font-feature-settings`, `font-stretch`, `letter-spacing` — change the outcome of a
fit-or-collide decision. Overriding them in CSS alone would let the planner keep predicting that
labels fit while the browser collides them. They are authored as typed values and their custom
properties are *generated* from those values, so the two cannot drift
([`research/41-text-metrics.md`](research/41-text-metrics.md)). Everything else — every colour,
length, opacity, dash, radius — restyles from CSS exactly as claimed.

### UC6 — The viewer who cannot see the chart

**Situation.** Someone using a screen reader, or someone who needs the numbers rather than the shape.

**Today.** `role="img"` and an `aria-label` summarising the chart in a sentence — which is worse than
it looks, because `role="img"` triggers Children Presentational True and erases everything inside the
SVG from the accessibility tree. Any data table you carefully provided stops existing.

**With this.** `role="graphics-document"`, never `role="img"`. A visible, collapsible data table in a
`<figcaption>` inside a `<figure>` — and the table is treated as **another rung of the ladder**, not a
bolted-on compliance artefact. Animation is opted *into* via
`@media (prefers-reduced-motion: no-preference)`, so a reduced-motion viewer gets a still chart rather
than a differently-animated one.

⚠ Best-effort and research-driven. No formal compliance level is claimed.

---

## 5. How we hand it over so it is understood

Documentation is the last resort, not the mechanism. Five things do the work before anyone reads a
page.

### 5.1 The reasoning is a plain object you can print

This is the largest comprehension lever available, and it comes free with the architecture.

```js
console.log(plan)
// {
//   valueLegibility: 'shape-only',
//   axes: { y: { visible: false }, x: { ticks: { mode: 'endpoints' } } },
//   legend: { placement: 'absent' },
//   marks: { kind: 'line' },
//   …
// }
```

Most chart libraries cannot tell you *why* they drew what they drew — the decision is distributed
across render code and never named. Here the decision is made first, by a pure function, and returned
as data before anything is drawn. You can log it, diff it across two sizes, snapshot it in a test, and
serialise it from server to client.

`valueLegibility` is the field to look at first. It has three values — `'values'`, `'shape-only'`,
`'single-value'` — and it is the chart stating, in the open, what kind of reading it supports. It is
also the field CI asserts against, so it cannot drift away from what actually renders.

### 5.2 Four escape hatches, in the order you will need them

Progressive disclosure, arranged so that the hatch you reach for first is the one you find first, and
none of them require understanding the ones below.

| Step | You write | You are saying |
|---|---|---|
| 1 | `<AutoChart type="line" data={…} />` | *Nothing.* Measure the box, decide, draw. |
| 2 | `policy={{ … }}` | *Decide with different thresholds.* Applied **before** resolution. |
| 3 | `plan={{ … }}` | *I want this specific field regardless.* Applied **after** resolution. |
| 4 | `planFn={(p, ctx) => …}` | *I will make the decision myself.* |

The before/after split is the part worth internalising: a `policy` participates in the reasoning, an
override replaces its conclusion. Confusing the two is the most likely source of "why did my setting
not stick." Precedence runs defaults → `<GxConfig>` → props → `planFn`
([`research/maps/01-runtime-flow.md`](research/maps/01-runtime-flow.md)).

Most integrations should never leave step 1. ⚠ Whether that holds is untested, and §8 names it as the
signal to watch.

### 5.3 Every number says where it came from

Four provenance tiers, and **the tier is part of the public documentation, not an internal note**:

- **A-lit** — published perception research or a W3C spec. Evidence about human vision.
- **A-impl** — verified source of a shipped library. Evidence about convention.
- **B** — ours, consistent with published work.
- **C** — ours, no published basis. Says so plainly.

Splitting A in two is deliberate. Four libraries defaulting a line stroke to `2px` tells you what
looks *normal*, not what is *legible*; collapsing both into one tier would let convention wear the
authority of research.

The point for you is practical: you can tell which numbers to argue with. `aggregate-after: 8` is a
legend-scannability preference, not perception — donuts stay readable to 24 categories — so change it
freely. `plot-height-min-for-values: 40` has a p-value behind it. Same token tree, different weight,
and the tree says which is which.

One consequence worth stating because it will bite someone: **provenance is per-token, correctness is
per-composition.** Two individually citable defaults can be jointly wrong. Gridline colour `#ddd`
(A-impl, Vega and nivo) and gridline opacity `0.2` (A-lit, Heer & Bostock) are two solutions to the
same problem, and composing them yields an invisible grid with two Tier A labels on it. Resolved to
`currentColor` + `0.2`.

### 5.4 The vocabulary is borrowed, not invented

Recompose, Rescale, Transpose, Reposition, Compensate come from Hoffswell et al. (CHI 2020) and Kim
et al. (EuroVis 2021). A first draft invented eight verbs; the literature had names for all of them
and ten more transformations we had no verb for at all.

A library whose central claim is *"we change information with size"* should speak the language the
field already uses. It also means a reader who knows the research can predict what we will do.

### 5.5 The failure states are designed, not incidental

The moments most likely to make someone give up, and what each does:

| Situation | What happens |
|---|---|
| Box below the widget's declared minimum | The grid refuses the resize. The widget is never rendered into a size it declared meaningless. |
| Empty data | A designed empty state at every rung — not a blank box, not a zero-height axis. |
| One data point, one category | A designed rung, not a degenerate chart. Micro and Tile already are single-value states. |
| An override the size cannot honour | The override wins — it is a hard override by definition — and the honesty invariant is what CI holds, so an override that would make the chart claim unreadable values fails the gate rather than shipping quietly. |
| A boundary crossed repeatedly while dragging | Absorbed in order: containment prevents a true loop, animation smooths geometry, and the live classifier's shipped 1% fractional deadband prevents mounted rung content from blinking — never a fixed pixel count. |

### 5.6 And then the docs page, which has exactly one job

Land the idea in five seconds, without a paragraph.

A widget with a live resize handle, and beside it the plan, updating as you drag, with changed fields
highlighted. Drag, watch the chart become a different chart, watch `valueLegibility` flip from
`'values'` to `'shape-only'`. That is the product.

If a visitor has to read prose before they understand what this is, the demo has failed and no amount
of writing rescues it.

---

## 6. What you have to learn, and what you never do

**Never:** breakpoint math. `ResizeObserver` wiring. When a line should become a horizon band. How
many x-ticks fit at 340 px. Whether a label will collide at this font. How to make a chart render on
the server. What a chart should stop claiming as it shrinks.

**Once, and it is small:** the six family names, as vocabulary rather than API — you never type them.
That `valueLegibility` exists and what its three values mean. The four escape hatches, in order, and
that `policy` is before and `plan` is after.

That is the whole surface for a normal integration. Everything else is available and nothing else is
required.

---

## 7. What we deliberately do not do

- **No data.** Presentational only — no fetching, no SQL, no AI, no persistence. You supply
  already-shaped data.
- **The grid never decides what a chart shows.** It reports box size and nothing else. That boundary
  is what lets these charts work inside your own CSS grid, or a flexbox, with no grid package
  installed at all.
- **We do not compete on knob count.** Highcharts has more. We do not compete on axis-API richness
  either — Vega-Lite's is better and should be partly copied.
- **We do not claim server-side SVG as a differentiator.** It is table stakes; the combination is
  not.
- **A widget's box is decided by the grid, never by its contents.** Not a preference — structural
  prevention of an infinite measure-plan-resize loop. `ResizeObserver` throws on an unresolved cycle
  rather than damping it, so there is no "small enough" version of this bug.

---

## 8. How we will know this worked

Named in advance, so the answer is not chosen after the fact. All of it is unvalidated by definition
until there is a user.

**Signals it is working**

- Someone drags the demo widget and understands the product before reading anything. That is the one
  test that matters, and Milestone A1 exists to reach it — one line chart, one draggable box, end to
  end, before any breadth.
- A team deletes hand-rolled breakpoint code from their chart wrappers.
- Someone argues with a threshold *by citing its provenance tier*. That means the honesty mechanism
  is doing real work rather than decorating the docs.
- Nobody reports "the chart looks broken at small sizes" — because at small sizes it is a different
  chart, not a broken one.

**Signals it is not**

- ⚠ **Integrations reach for `planFn` immediately.** The most informative failure available. It means
  either the defaults are wrong or the ladder is unreadable, and the fix is different in each case —
  so instrument which fields get overridden, not just how often.
- People ask what size class they are in. If that question needs asking, the rung is not legible from
  the chart itself.
- The first question about a small chart is "where did the axis go" rather than "what is it showing
  me." The removal was correct and the communication was not.
- `valueLegibility` gets ignored. It is the honesty claim made inspectable; if nobody looks at it, the
  honesty is ours alone and not the user's.

---

## Related

| | |
|---|---|
| [`PRODUCT.md`](PRODUCT.md) | What we are building, the positioning, and the constraints. |
| [`DESIGN.md`](DESIGN.md) | The visual world — palette derivation, type ranks, the named rules cited above. |
| [`research/01-plain-english.md`](research/01-plain-english.md) | How the system works, in full, without jargon. |
| [`research/10-responsive-ladder.md`](research/10-responsive-ladder.md) | The ladder itself, per chart type, with citations and provenance tiers. |
| [`research/40-chart-plan.md`](research/40-chart-plan.md) | The `ChartPlan` field contract — the public API this document describes in prose. |
| [`research/maps/`](research/maps/) | Flow maps: package graph, runtime flow, milestone DAG, token flow, CI gates. |
| [`research/decisions/`](research/decisions/) | Why a claim is worded the way it is, and what would overturn it. |
