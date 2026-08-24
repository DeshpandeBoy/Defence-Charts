# How this whole thing works, in plain English

Everything else in this folder is precise, cited, and dense. This file is the same design explained
the way you would explain it to a colleague at a whiteboard. No new decisions here — if this file and
any other file disagree, the other file is right.

---

## 1. What we are building

A chart library you install from npm. Nothing new so far.

The difference is what happens when a chart gets bigger or smaller. In every other library, a chart
resizes like a photo: same picture, different dimensions. Text gets cramped, labels collide, and at
small sizes it becomes an unreadable smudge.

Ours changes **what it tells you**, not just how big it is.

Take one line chart. Make it tiny — it becomes a single number and the phrase "↑ 12% this week". Make
it a bit bigger — the number gets a sparkline under it. Bigger again — a real line with the first and
last dates on the bottom. Bigger — a proper y-axis, gridlines, and labels sitting at the end of each
line. Bigger still — point markers, a legend, a tooltip that follows your cursor. At the largest size
— call-outs on the highest and lowest points, shaded threshold bands, and footnotes.

Every one of those is a *sensible chart for that amount of space*. None of them is a shrunk version of
the one above it. That progression is what we call **the ladder**, and it is the actual product.

The second half of the product is control. Every stroke width, every gap, every tick length, every
colour is something you can change from CSS — for one chart on the page, without touching the others.
The shipped presentation surface currently declares 198 of those knobs, all named consistently.

---

## 2. The one idea everything else hangs off

Here is the whole architecture in one sentence:

> **We separate deciding what to draw from actually drawing it.**

Deciding is a function called `planChart()`. Drawing is a component called `<Chart>`.

The useful analogy is a **recipe**:

- `planChart()` **writes the recipe.** You give it three things — how big the box is, roughly what the
  data looks like, and any preferences you have. It hands back a plain list of instructions: *"3 ticks
  on the y-axis, no legend, gridlines horizontal only, label the end of each line, tooltip off."*
- `<Chart>` **cooks the recipe.** It reads those instructions and produces the SVG.

That is it. Two halves, and a plain object in between.

### Why this split is worth so much

Because **writing a recipe does not need a kitchen.**

`planChart()` is just arithmetic. It never touches the browser, never measures anything, never asks
the screen a question. So it will happily run:

- on your server, before the page is even sent to the browser
- in a plain Node script with no browser at all
- inside a test, in about a millisecond
- in a background worker
- theoretically, in another framework entirely

And because the recipe is a **plain object** — not a class, not a closure, just data — you can print
it, save it to a file, send it over the network, compare two of them, or write one by hand.

That single property gives us, for free:

| We get | Because |
|---|---|
| Charts that render on the server with **zero JavaScript** | The plan can be computed there and passed down as data |
| A test suite for the ladder that needs **no browser** | Feed in a size, compare the plan against an expected one |
| An escape hatch for users who disagree with us | They get handed the finished plan and can edit it before it is drawn |
| Confidence that server and browser agree | Same function, same inputs, same output, both places |

Almost every other decision in this project is downstream of that one.

### One deliberate subtlety

`planChart()` never sees your actual data. It sees a **description** of it:

```
"5 series, 12 categories, 340 points, no negatives,
 longest label is 9 characters, the x-axis is dates"
```

That is all it needs to decide layout, and it means the function stays fast and cheap no matter
whether you are plotting 50 rows or 50,000. It also means a server can plan a chart from metadata
alone, before the data has even been fetched.

---

## 3. The pieces, and what each one does

Six packages. Each one has a job and a rule about what it is not allowed to touch.

**`@gx/tokens`** — the colours, sizes and spacings, as CSS variables plus matching TypeScript types.
Depends on nothing. It is the vocabulary everything else speaks.

**`@gx/core`** — the brain. Scales, tick maths, layout arithmetic, and `planChart()` itself. **It is
not allowed to import React, and it is not allowed to touch the browser at all.** This is the package
that makes everything above possible, and the restriction is enforced by an automated check, not by
good intentions.

**`@gx/primitives`** — the drawing. `<Chart>`, `<Axis>`, `<Grid>`, `<LinePath>`, `<Bars>` and friends.
Pure SVG. **No state, no effects, no refs** — it is handed a plan and it renders it. Because it is
that simple, it works inside a React Server Component, which is how we get charts with no JavaScript
shipped to the browser.

**`@gx/react`** — the part that needs a live browser. `<AutoChart>` (which measures its own box),
tooltips, crosshairs, brushing, clickable legends. This is where `"use client"` lives.

**`@gx/grid`** — the dashboard shell. 12 columns, drag to move, drag a corner to resize. It uses an
existing, well-tested library for the hard parts (working out what collides with what, and shuffling
widgets up to fill gaps) and we supply the parts that library lacks.

**`@gx/testing`** — helper tools for us and for anyone extending the library.

They stack like this, each depending only on the ones above it:

```
tokens  →  core  →  primitives  →  react  →  grid
                     (no browser)   (browser)
```

### The two rules that matter most

**`@gx/core` may not import React.** Not a style preference. If the brain of the library needs React
to run, it cannot run on a server, in a worker, in a test, or anywhere else — and the whole plan-as-data
idea quietly dies. One automated rule in CI protects it.

**`@gx/core` may not measure anything in the browser.** No asking the DOM "how wide is this text?"
Instead we compute text width from a table of character widths — arithmetic, not measurement. Slightly
less exact, and worth it three times over: it works on the server, it is testable anywhere, and (as
§8 explains) the alternative would have silently broken our tests.

---

## 4. Walk-through: how one chart actually gets drawn

Two routes. Same code underneath.

### Route A — the static one, no JavaScript at all

You already know how big the chart will be. A PDF, an email, a report, a fixed slot in a page.

```
1. Your server code says: "line chart, 600×300, here's the shape of my data"
2. planChart() returns a plan object
3. <Chart plan={thatPlan} data={yourData} /> renders SVG
4. The HTML goes to the browser with the chart already in it
```

The user sees a finished chart in the first frame. No loading state, no layout shift, no JavaScript
downloaded, no JavaScript executed. Works with JS disabled entirely.

⚠ **We checked this properly, and the honest version is narrower than the one we first wrote.**
*"None of the eleven charting libraries we surveyed can do this"* is **false** — on 2026-08-23 we
installed four and rendered them (`decisions/013`). Rendering SVG on a server is table stakes. What is
actually rare:

- **visx already works inside a React Server Component today** — hook-free, no `"use client"`, 124 B of
  page JS, zero visx or d3 bytes in any client chunk. It is the honest near-miss, and saying so out
  loud costs nothing and buys credibility for the claims that hold.
- **nivo fails at import** in an RSC (`TypeError: x.createContext is not a function`); wrapped in
  `'use client'` it works and costs 89.6 kB of page JS.
- **Observable Plot returns a DOM node**, so it structurally cannot run in an RSC at all.
- **Vega renders in bare Node with no DOM** — genuinely zero-JS, and completely **inert**, because it
  bakes presentation into attributes. Nothing about it can be changed from a stylesheet afterwards.

What is true and worth saying: every one of the eleven makes you write your own client boundary, and
none of them combines zero-JS render with *staying themeable after render*. That second half is the
part that is ours, and it exists only because of the recipe split in §2.

### Route B — the adaptive one, the actual product

You do not know how big the chart will be, because the user can drag it.

```
1. <AutoChart> renders and measures its own box  →  482 × 210
2. It calls the same planChart()                 →  a plan
3. It renders the same <Chart>                   →  SVG
4. User drags the corner. Box is now 900 × 400.
5. Measure → plan → render. Again. Same functions.
```

Step 5 is the entire trick. There is no separate "responsive mode", no breakpoint list, no second code
path. Resizing is just calling the same pure function with a different number.

The server can still help here: it renders route A for a sensible starting size so the first paint is
correct, then the browser takes over and adjusts.

---

## 5. How the chart decides what to show

`planChart()` sorts the box into one of six **size families**. They are named for how much information
fits, not for pixel counts:

| Family | Roughly | What it can honestly say |
|---|---|---|
| **Micro** | 1×1 cell | One number. Never an axis. |
| **Tile** | 2×1 to 2×2 | One number plus one supporting fact |
| **Strip** | 3×1 to 4×2 | The shape of a trend — but *not* specific values |
| **Panel** | 3×3 to 6×4 | A real chart with axes. Most widgets live here. |
| **Canvas** | 6×5 to 8×6 | Chart plus legend, values, annotations |
| **Stage** | 9×6 and up | Everything, plus secondary detail |

### These boundaries are not our taste

This is the part worth defending, because it is what stops the library being one more opinionated
chart kit. The boundaries come from published research on how well people actually read charts:

- Below **24 px** of plot height, a line chart stops being the right encoding at all — so at that
  point we *switch to a different chart type* rather than drawing a squashed line.
- Below **40 px**, people's error in reading values off a chart rises sharply. So below 40 px we
  **do not show a y-axis**, because showing one would be a promise the chart cannot keep.
- Above **80 px**, making the plot taller stops helping. So past that point extra space goes to
  legends, labels and annotations instead of a taller plot.

That last one is, more or less, the justification for the entire library: **beyond a certain size,
more space should buy more information, not a bigger picture.** Every library in the field currently
does the opposite.

### The ladder does not only add things

This surprised us, and it is the detail most people get wrong. Going up a rung is not "everything from
before, plus more". A small chart shows things a large one does not — the Micro line chart has a
summary phrase ("↑ 12% this week") that the full-size chart has no reason to display. Small sizes get
their own dedicated content, not leftovers.

So each rung is written as a **complete description** of what renders there, never as a diff from the
rung below.

### What happens between rungs

When a chart crosses a boundary we **animate** rather than cut — around 300 ms for a simple rescale,
up to a second when marks actually move. That is not decoration. If you drag slowly across a boundary
and wobble, an instant switch flickers horribly, while a one-second eased transition reads as one
continuous motion. Animation turns flicker into smear.

(Interesting confirmation: a 2007 research paper measured ~1000 ms as the right duration for chart
transitions, and Adobe's Spectrum design system independently ships exactly 1000 ms in its code. When
a study and a shipped product land on the same number by different routes, it is probably the number.)

### The rule that prevents an infinite loop

There is one genuinely dangerous failure mode here. If a chart could change the size of the box it is
being measured in, you get: box measured → plan changes → chart needs more room → box grows → measure
again → plan changes → forever. Like standing on a scale and eating based on the reading.

Our rule: **the measured box's size is decided by the grid, never by its contents, and a plan may only
affect things inside that box.** Structural prevention, not a fudge factor. The browser itself takes
the same approach — CSS flatly refuses to let elements query their siblings' sizes for exactly this
reason, and `ResizeObserver` throws an error rather than trying to settle the loop.

There is a CI test that drags every chart type across every boundary and fails if that error ever
appears.

---

## 6. How you control the look

This is the "granular control" half of the product, and it splits into two very different mechanisms
that are easy to confuse.

### Presentation tokens — CSS variables

Anything about *appearance*: stroke width, colour, corner radius, gap, font, animation duration.
Ordinary CSS custom properties.

```css
/* every chart on the page */
:root { --gx-line-stroke-width: 2px; }

/* just this one widget — no re-render, no JS, no prop drilling */
.revenue-widget { --gx-line-stroke-width: 3px; --gx-grid-opacity: 0.35; }
```

That second line is the thing we lead with — but ⚠ **more carefully than we first wrote it**
(`decisions/014`). Highcharts' styled mode is *not* colours only: it exposes stroke width, dash style,
gridline width, tick colour and width, and typography, ships `--highcharts-color-{n}` custom
properties you can extend, and follows `prefers-color-scheme`. Two things still hold, and they are the
ones to say:

1. **One namespace covering every knob**, rather than a colour-indexed subset with the rest reached
   through classes.
2. **Per-widget scope on a shared dashboard** — restyling one widget from a stylesheet, without a
   re-render and without prop drilling.

Carbon ships exactly two chart custom properties, both font families. Everyone else makes you pass a
JavaScript options object.

And there is a line even we cannot cross, which is worth knowing before promising otherwise: tick
*length* is `y2` on an SVG `<line>`, and `x1`/`y1`/`x2`/`y2` are not settable from CSS in any browser.
We get past it only by never drawing ticks as `<line>` in the first place (`decisions/012`) — a real
advantage, but a narrow one we had to design for, not something Highcharts missed.

Because these are plain CSS, changing one costs nothing. The browser repaints. React never finds out.

### Plan-input tokens — TypeScript objects

Anything that changes *what the chart decides*: how much space a tick wants, how many categories
before we start grouping them, the minimum size of a heatmap cell.

These are **not** CSS variables, and the reason is worth understanding because we got it wrong first.

A CSS variable can only be read by asking the browser. **The server cannot read one.** So if a CSS
variable were an input to `planChart()`, the server would compute one plan and the browser would
compute a different one — and React would find mismatched HTML on every single chart. We had this
error in an early draft of the architecture and it would have broken everything.

So the rule is a single line:

> **Tokens may drive presentation. Tokens may never drive plan inputs.**

Plan inputs go through a `<GxConfig>` component as ordinary typed values, which works identically on
the server and in the browser. You can still retune every threshold in the ladder without forking the
library — just through a different door.

### One trap we found, and it is a good illustration

Two of our defaults were each individually well sourced:

- `grid-color: #ddd` — because Vega and Nivo both ship that
- `grid-opacity: 0.2` — because a 2010 research paper measured it

Both correct. Both solving the *same problem*: make gridlines recede so they do not compete with the
data. Apply both and you get `#ddd` at 20% opacity on white — an invisible grid, from two impeccable
sources.

Fixed by using `currentColor` at 20%, which is what both were approximating and which also survives
dark mode. But the lesson generalises, and it is now written into the review process: **you can cite
each of two numbers and still be wrong about the pair.**

---

## 7. The grid

12 columns wide, as many rows as you need. Drag a widget to move it. Drag any corner to resize. Things
below shuffle up to fill gaps.

We are not writing the hard parts. An existing MIT-licensed library handles collision detection and
compaction, and it has a framework-agnostic core we can use directly. We add:

- the 12-column geometry and our size families
- **per-widget minimum sizes** — a widget can declare "below 2×2 I am meaningless, do not let the user
  make me smaller". The reference product we studied does not have this.
- handing each widget its own size information

**The grid never decides what a chart shows.** It only reports how big the box is. That boundary is
what lets someone use our charts in their own layout, or in a CSS grid, or in a flexbox, with no grid
package installed at all.

Worth noting: we pulled apart the shipped code of the product that inspired this, and found it has
exactly **one** breakpoint — under 480 px, collapse to a single column. That is it. Which is the
clearest possible proof that adaptation has to happen per-widget, by self-measurement, rather than at
the grid level. A widget does not know how wide the window is, and should not care.

---

## 8. How we know it is not broken

This turned out to be far more interesting than expected, because we found something that would have
silently poisoned the entire test suite.

### The discovery

Tests normally run against a fake browser — jsdom or happy-dom — because a real one is slow. We tested
both directly instead of trusting their documentation:

| We asked it | jsdom says | happy-dom says |
|---|---|---|
| How wide is this text? | **throws an error** | **`0`** |
| What is this shape's bounding box? | **throws an error** | all zeros |
| Did this element resize? | *(feature missing)* | *"no"* — **every time, forever** |

jsdom fails loudly. happy-dom **lies quietly**, and that is far more dangerous. Ask it "does this
label fit in the space available?" and the label has width 0, so the answer is *yes*. Always yes. Our
label-collision test would pass on every run, for years, while shipping charts with overlapping text.

Worse: happy-dom's resize detector exists as a function, passes every feature check, and then never
fires. `<AutoChart>` would detect it, take the adaptive path, wait forever for a measurement that
never comes, render its fallback size, and report success.

### What we did about it

Two rules, and both of them made the architecture *better* rather than working around a limitation:

**Never measure in the planner.** Text width comes from arithmetic on a character-width table.
Something we wanted anyway for the server path — the fake-browser problem just made it non-negotiable.

**Never trust the environment's resize detection. Inject our own.** We ship a ~50-line fake with an
`emit(width, height)` method. The point is not that it is a polyfill. The point is that
**resize becomes an input we control instead of an event we wait for.** Every rung of the ladder
becomes two lines:

```
emit(320, 180)
expect(plan).toEqual({ ...what a 320px chart should be })
```

And there is a footnote worth keeping, because it is the same lesson twice. Our own fake was, for a
while, wrong in exactly the way happy-dom is wrong: it reported the size in the older of the two
shapes a browser can use, so every test took a code path that real browsers never take. Everything
passed. Nothing was being checked. We found it, fixed it, and kept the old shape available for the
tests that specifically want to check the old path — but the moral is that *writing your own fake
does not exempt you from the problem*. A tool you control is a tool you can make agree with you.

And happy-dom is banned from the repository. jsdom's loud crash is strictly the safer failure.

### The tiers

| What | How | Where |
|---|---|---|
| The ladder — **the core IP** | Feed in sizes, compare plans | Plain Node. No browser. Milliseconds. |
| Ladder stability | Sweep size up, then back down. Assert the same width always gives the same plan. | Plain Node. |
| SVG output | Render to a string, check the structure | Node |
| `<AutoChart>` | Drive our fake resizer | jsdom + our fake |
| Real measurement, real fonts, real interaction | A real browser | Smallest tier |
| Screenshots | One per chart type per rung | Real browser, in Docker so fonts are identical |

Most of the value sits in the top row, which needs no browser at all. That is decision-8's dividend
again.

### One policy worth calling out

We do **not** save auto-generated snapshots of chart markup. When a saved snapshot changes, the fix is
to press `-u` and nobody reads the 400 lines of regenerated output. For a library where the geometry
*is* the product, that is the worst possible failure mode. Instead, expected geometry is written
inline in the test, so a change shows up in the pull request and someone has to consciously agree to
it.

We checked six comparable libraries. **Not one of them snapshots composed chart markup either** — and
the two with the most rigorous geometry testing are the two that got the fake browser out of the way
entirely.

### That last screenshot row is not just testing

One picture per chart type per rung of the ladder *is the specification of the ladder*. It is the
single most useful thing a reviewer can look at, and it doubles as the illustration for the docs page.

---

## 9. Accessibility, and a widely repeated mistake

The standard advice for accessible charts is: put `role="img"` and a label on your `<svg>`, and hide a
data table inside it for screen readers.

**That advice is broken**, and we only found out by reading the W3C specification directly.

`role="img"` tells assistive technology *"treat this as a single picture — ignore everything inside
it."* The data table you carefully placed inside is **deleted from the accessibility tree**. The markup
looks right. Automated checkers pass it. A screen-reader user gets the label and nothing else.

What we do instead:

- `role="graphics-document"` on the `<svg>` — requires a name *and* keeps its children reachable
- the data table in a `<figcaption>`, **outside** the `<svg>`, inside a `<figure>`

Two independent sources land on that same structure, which is a good sign it is right.

And then a nice consequence: W3C's own guidance says *"make long descriptions available to everyone"*.
A collapsible data table under the chart is correct for screen readers, useful for everyone else,
needs no JavaScript, works on the server — **and it is simply another rung of the ladder.** Shown
beside the chart at large sizes, collapsed at small ones. The accessibility feature and the product
feature are the same feature.

One more finding worth knowing: automated accessibility checkers cover much less here than people
assume. Only **2 of axe's 105 rules** apply to an SVG chart, and the main one only fires on an `<svg>`
that *already* declares a role — so a completely unlabelled, totally inaccessible chart passes clean.
Adopting the graphics roles is what switches the checking on in the first place.

We also flip the usual reduced-motion pattern: instead of removing animation when a user asks for
less, we **only add animation when a user has expressed no preference**. That way the safe path is the
default, and a browser that does not understand the question gets stillness rather than movement.

---

## 10. How people install it

ESM-only, published to npm, one package per layer, with subpaths per chart type:

```js
import { LineChart } from '@gx/primitives/line'   // ships the line chart, nothing else
import '@gx/tokens/styles.css'
```

Two things that sound like plumbing but are not:

**We build with a tool setting called `unbundle`.** We tested this rather than reading a changelog:
the `"use client"` marker — the thing that tells React which code needs a browser — gets **silently
deleted** by the bundler in the normal configuration. `unbundle` is the only setting where it
survives. So the entire server-rendering story rests on one config line, and there is a CI job that
builds a real Next.js app and greps the output to confirm it is still there after any upgrade. We do
not trust that it keeps working; we check.

**"Import one chart, ship one chart" is a test, not a promise.** There is a CI job that imports each
export on its own, bundles it, and fails if anything unexpected came along for the ride.

---

## 11. What we build first, and why

The order is deliberate: **prove the whole idea on one chart before building any breadth.**

**Milestone A — the walking skeleton.** One line chart, in a box you can drag. Repo setup, the core
types, `planChart()` for lines only, the SVG renderer, `<AutoChart>`, transitions.

The finish line is not a checklist. It is a reaction: someone drags the box, watches the chart become
a different chart, and says *"oh, I see."* If that does not happen, the premise is wrong and
everything after it is wasted work. That is exactly why it is first and why it is small.

**Milestone B — the control surface.** B1-B3 deliver the generated presentation tree, Rail and
Neutral dark/light themes, renderer controls, and typed threshold policy for the current line/area
proof. The shipped source declares 198 presentation tokens and the policy gate keeps research tiers
separate from implementation choices.

**Milestone C — the grid.** Next: widgets, drag, resize, per-widget minimums, the widget frame itself.

**Milestone D — more chart types.** Only now. Each one repeats the pattern Milestone A already proved.
Bar first, because switching to horizontal is the most dramatic adaptation we have. Then donut, KPI,
scatter, heatmap, and the simpler ones.

**Milestone E — ship it.** Docs site, the page that explains every rung of every ladder, and the
release pipeline.

The docs site has one page that matters more than the rest: a chart you can drag with your mouse, with
the live plan object updating beside it, changed fields highlighted. That page has to land the idea in
about five seconds. (And we will build the drag handle by hand — the one-line CSS approach for
resizable boxes is unsupported on every version of iOS Safari, which would break precisely the page
carrying the entire argument.)

---

## 12. What is honestly still unknown

Worth writing down, because a library that overclaims gets caught in the first comparison blog post.

**We have not decided the name.** Everything says `@gx/*` as a placeholder. Cheap to change — we
verified the prefix only ever appears as the first segment of a name — but it blocks publishing.

**Some numbers are ours, not research.** Every threshold ships labelled with where it came from:
published research, verified library source, our own reasoning, or pure invention. Publishing those
labels is a feature. But it does mean a reader can see exactly which numbers are taste, and some are.

**On raw knob count we do not beat Highcharts, and Vega-Lite has a better axis API than ours will**
(70 documented properties — we should copy most of it). Where we are genuinely first is the
combination: every knob in one namespace, reachable from CSS, per widget, without JavaScript, plus a
size ladder that changes what the chart *says*. Three of those four are new. The knob count is not.

**Nobody has confirmed the graphics accessibility roles are well supported** by real screen readers.
No support matrix exists, and Highcharts — the most accessibility-invested vendor in the field —
solves the problem with text descriptions and a data-table export instead. So we treat the roles as
the correct floor and the visible data table as the thing that actually delivers the information.

**Whether animation alone smooths out the size boundaries** is an open empirical question. If dragging
still flickers after we ship transitions, the live classifier uses a small deadband — expressed as a
percentage of the boundary, never a fixed pixel count, because 8 px means very different things at a
120 px boundary and a 1200 px one. The shipped `AutoChart` boundary uses a 1% fractional band while
`planChart()` remains pure.

---

## The one-paragraph version

A pure function turns *size + data shape + preferences* into a plain object describing what to draw.
A hook-free component draws it. A thin client layer measures boxes and adds interaction. A grid shell
arranges widgets on 12 columns. Everything visual is a CSS variable. Because the middle step is
ordinary data, the same code runs on a server with no JavaScript, in a test with no browser, and in a
live resizable dashboard — and because the size boundaries come from published research on human
perception rather than round numbers, a small chart is a *different, honest chart* rather than an
unreadable shrunken one.
