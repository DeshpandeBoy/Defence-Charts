<!-- SEED: established with the user before implementation; re-run /impeccable document once there's code to capture the actual tokens and components. -->

---
name: "The Emission-Line Rail"
description: "Visual world for an as-yet-unnamed open-source chart and dashboard-grid widget library — colour is signal, structure is meaning, clarity persists."
---

# Design

## Overview

**The Emission-Line Rail.** The system is modelled on a spectroscope's working plate: a calibrated rail running down one side, and against it, named emission lines at exact wavelengths. Nothing floats. Nothing is decorative. A reading is either registered against the scale or it is not a reading.

This world was chosen because it answers the product's hardest constraint natively. A chart in this library must change *what it shows* as its box changes size, and it must stay honest at every size. Spectroscopy is a discipline that already solved the equivalent problem: an instrument at low resolution shows fewer lines, not blurrier ones. It drops what it cannot resolve and it never fakes a peak it did not measure. That is the responsive ladder, stated in a language that predates it.

Two properties of the source domain do structural work here, and both resolve tensions that a spectral palette would otherwise create:

**Hue is identity; line form is state.** In spectroscopy a wavelength tells you *which element* you are looking at, and the line's form — intensity, broadening, doubling — tells you *what is happening to it*. These are two orthogonal channels in the physics itself. The system inherits that split directly: hue answers "which series", and stroke form (dash pattern, point shape, weight) answers both "which series" redundantly and "what state". This lands exactly on the redundant encoding that colour-vision research demands, without the redundancy feeling like an accessibility bolt-on.

**Emission and absorption are one system, two grounds.** A spectrograph produces bright lines on a dark continuum (emission) and dark lines on a bright continuum (absorption) from the same physics. The dark theme and the light theme are therefore the same instrument pointed two ways, not a palette and its inversion. The dark theme is the reference: it is where the doctrine is native and where colour separation is measurably best.

**Material character.** Ash and graphite. Matte, dry, unlit surfaces with visible tooth — the feel of a printed plate or a matte instrument panel, never glass, gloss, glow, or frost. Charcoal is the ground everywhere; colour appears only where a value is being asserted.

**Motion grammar.** Motion is calibration, not delight: a line settles onto its position along a single axis, it does not bounce, arc, or fade in from nothing.

Motion here has one job, and it is structural rather than aesthetic. When a widget is dragged slowly across a size-family boundary and wobbles, an instant switch flickers violently; an eased transition reads as a single continuous movement. **Animation turns flicker into smear.** That is why it exists, and it is the test any motion decision has to pass.

Durations are settled: approximately **300ms** for a simple rescale, up to **1000ms** when marks actually change position. The 1000ms figure has independent corroboration — a 2007 study of chart transitions measured it, and Adobe Spectrum ships exactly that value, arrived at separately. Easing curves are **not** settled and are flagged unverified in the research; they are `[to be resolved during implementation]` and must not be given a false provenance.

Animation is *added* when the user has expressed no motion preference, never *removed* from an explicit one — the still chart is the baseline and the correct artefact, and motion is the enhancement.

**Signature.** One off-centre vertical rail, with coloured ticks registering against it. It is the single reusable gesture: it appears as the nav rail in a shell, as the axis in a chart, and as the left edge of an active element.

**The Register Rule.** Every element registers against the rail or against a hairline. Nothing is positioned by eye, and nothing floats free of a reference.

**The Signal Rule.** Colour is signal. If a mark is coloured, that colour carries information a reader can decode. Charcoal is the default state of every surface, and applying colour to something that does not encode a value is a defect.

---

## Colors

The palette is not chosen by taste. Every series hue is computed from a real named spectroscopic emission line: wavelength → CIE 1931 XYZ (via the Wyman/Sloan/Shirley multi-lobe Gaussian fits to the 2° observer) → linear sRGB → OKLCH. Lightness and chroma are then optimised for separation; hue is inherited from the physics and is not adjustable.

**The Wavelength Rule.** Every series hue is a real emission line at a stated wavelength. Adding a series colour means naming the line it comes from. A hue with no wavelength behind it does not enter the palette.

### Primary — the series ramp (emission / dark theme)

The reference theme. Bright lines on a charcoal continuum, ground `#141618`.

| # | Line | nm | OKLCH hue | Value | Contrast vs ground |
|---|---|---|---|---|---|
| 1 | H-beta | 486.1 | 230.5° | `#b4e4fd` | 13.35 |
| 2 | Na I D₂ | 589.0 | 57.2° | `#fdcaa6` | 12.24 |
| 3 | Mg b₂ | 517.3 | 142.5° | `#28d824` | 9.45 |
| 4 | H-delta | 410.2 | 296.3° | `#bda4fb` | 8.52 |
| 5 | He I | 492.2 | 188.9° | `#1c9d96` | 5.45 |
| 6 | Fe I | 615.0 | 29.2° | `#fa2017` | 4.56 |

Ordered by robustness: a two-series chart uses 1–2, a four-series chart uses 1–4. Minimum pairwise perceptual distance across normal, protanopic, deuteranopic and tritanopic vision *and* greyscale is ΔE 11.6 — usable, verified by simulation rather than by eye.

### Secondary — the series ramp (absorption / light theme)

Dark lines on a bright continuum, ground `#f4f3ef`. Same six wavelengths, re-solved for a light ground.

| # | Line | Value | Contrast vs ground |
|---|---|---|---|
| 1 | H-beta | `#084962` | 8.84 |
| 2 | Na I D₂ | `#784009` | 7.46 |
| 3 | Mg b₂ | `#137e10` | 4.71 |
| 4 | H-delta | `#801bef` | 5.70 |
| 5 | He I | `#0d625d` | 6.47 |
| 6 | Fe I | `#710805` | 10.88 |

The light theme's usable lightness range is compressed by the need to stay dark enough against a bright ground, and its minimum separation falls to **ΔE 5.0** — materially worse than the dark theme. This is a real limitation, stated rather than hidden, and it is the reason redundant form encoding is mandatory rather than optional. In the light theme, form differentiation is required from the second series onward.

### Tertiary — the six-hue budget

**The Six-Hue Budget Rule.** Hue carries series identity for at most six series. Past six, hue is exhausted and form takes over.

This is measured, not assumed. Holding contrast against the ground at 4.5 and maximising separation across all four vision types, the best achievable minimum separation degrades as series count rises:

| Series | Dark ΔE | Light ΔE |
|---|---|---|
| 3 | 32.3 | 25.3 |
| 4 | 22.9 | 15.5 |
| 5 | 16.2 | 11.1 |
| 6 | 14.9 | 10.4 |
| 7 | 10.7 | 9.3 |
| 8 | 11.1 | 8.9 |

At seven series and beyond, colour alone can no longer separate the set for a colour-blind reader in either theme. Series 7+ therefore reuse hues from the ramp and are distinguished by dash pattern and point shape. This matches the field's own restraint — ColorBrewer refuses to exceed twelve, and Adobe Spectrum ships different palettes keyed to series count rather than one palette stretched thin.

An earlier equal-lightness version of this palette was rejected outright: holding all series at one OKLCH lightness (so that no series looks more important than another) collapsed the set to ΔE 0.2 under deuteranopia and to a greyscale spread of 0.0008. Equal salience and colour-blind safety are mathematically incompatible, and safety wins.

### Neutral — the charcoal continuum

The ground, the grid, the axes, the type. A single near-neutral ramp at the ground's own hue (248.1°) with a trace of chroma (0.0051) so it reads as graphite rather than as dead grey.

`#0c0d0f` · `#202224` · `#36383a` · `#4e5052` · `#67696c` · `#848689` · `#a2a5a8` · `#c2c4c7` · `#e2e5e8`

Grid lines and axis rules derive from `currentColor` at low opacity rather than from a hardcoded neutral, so a re-themed widget's chrome follows its text colour automatically.

**The Separate Alarm Rule.** Alert colours (error, warning, success) live in their own namespace and are never drawn from the series ramp. A series that happens to be red must never be mistakable for a failure state, and an error must never be mistakable for series 6.

Sequential and diverging ramps for continuous data are `[to be resolved during implementation]`; they must be perceptually uniform and must be evaluated in greyscale and under deuteranomaly simulation before shipping.

**Gradients are banned outright** — not discouraged. The lint gate rejects them. A gradient encodes a value that varies where no value varies.

---

## Typography

Five ranks, taken from the world's own plate and mapped to chart roles. Rank is expressed through size and weight against the charcoal ramp, never through colour — colour is reserved for signal.

| Rank | Role | Use |
|---|---|---|
| A | Display | Chart title; the one thing read first |
| B | Title | Axis titles, section headers |
| C | Signal | Legend entries, emphasised values |
| D | Align | Axis labels, tick labels |
| E | Index | Data labels, annotations, footnotes |

Sizes ascend in the order: data label < axis label ≤ legend < axis title < chart title. **Resolved** (`research/42-typography.md` §2.1): A Display 13px/700 · B Title 12px/700 · C Signal 11px/500 · D Align 11px/400 · E Index 10px/400. Four distinct sizes for five ranks; C and D share a size and separate by weight, which is what the `≤` was left open for.

⚠ Rank sets size; **placement** sets weight. Text drawn over a mark or a filled region carries extra weight for legibility against a non-ground background — which is why data labels (rank E) ship at 700, matching Highcharts and Spectrum independently, without being promoted in the reading hierarchy.

The typeface is **Roboto Flex** (`research/41-text-metrics.md` §4). The requirement it satisfies: a variable grotesque with a genuine optical-size axis. Its `opsz` axis runs **8–144**, verified against Google Fonts `METADATA.pb`; Inter was rejected because its `opsz` bottoms out at 14 and our entire label range (11px default, 10px floor) sits below it, where `font-optical-sizing: auto` clamps and does nothing — precisely where this requirement was written to apply. Roboto Flex also carries a `GRAD` axis, which Inter lacks; see the note on landmark emphasis below. `font-optical-sizing: auto` is on globally so that small labels thicken correctly rather than being scaled-down large type.

⚠ **`tnum` support in Roboto Flex is UNVERIFIED.** The Tabular Rule below depends on it. The Roboto Flex README documents no OpenType features at all, and `METADATA.pb` lists axes, not features. Resolve by inspecting the released variable font's `GSUB` table before the metrics table is generated — this blocks generation, not merely documentation.

**The Tabular Rule.** Numbers that a reader will compare vertically or that update in place get `tabular-nums`; running prose does not. Axis tick labels, data labels, and any value that animates between states are tabular — proportional figures make a column of numbers ragged and make an updating value jitter. Applying `tabular-nums` globally is the opposite error and is equally wrong.

**The Rank Rule.** Type never carries series identity. A label may sit beside a coloured mark, but the label's own colour comes from the charcoal ramp. If a reader has to compare two text colours to decode a chart, the chart is broken.

There is **no normative minimum legible size** in the research behind this system, and none is asserted here. Any minimum that ships must be labelled as this project's own invention rather than dressed up as a published finding.

---

## Layout

**The Cell Rule.** Size families are measured in grid cells, not pixels. A widget's family is a function of its footprint in the twelve-column dashboard grid, and aspect ratio matters independently of area — a 6×2 widget is a Strip despite having twelve cells.

Six families, named for the information budget they can honestly carry:

| Family | Cells | Character |
|---|---|---|
| Micro | 1×1 | A single value, no scale |
| Tile | 2×1 – 2×2 | A value plus a trend direction |
| Strip | 3×1 – 4×2 | A shape, minimal scaffolding |
| Panel | 3×3 – 6×4 | A readable chart with axes |
| Canvas | 6×5 – 8×6 | Full scaffolding, multiple series |
| Stage | 9×6 – 12×8+ | Everything, plus annotation and comparison |

The family boundaries are anchored to published perception research on plot height, not to taste:

- **6px** — the horizon-graph floor. Below this, a band carries nothing.
- **24px** — optimal single-band height, and the Tile → Strip boundary. Below it a line is no longer the right *encoding at all*, so the chart substitutes a different mark rather than drawing a squashed line.
- **40px** — below this, value-estimation error rises significantly (p<0.001); the Strip → Panel boundary. The consequence is concrete: **below 40px the chart does not draw a y-axis**, because an axis a reader cannot read values off is a promise the chart cannot keep.
- **80px** — accuracy saturates; further height buys little. The Panel → Canvas boundary, and the empirical justification for the entire library: if more pixels stopped helping at 80, then extra space past that point must buy legends, labels and annotation rather than a taller plot.

**The Complete Rung Rule.** Every rung is written as a full description of what renders at that size — never as a diff from the rung below. Going up is not "everything from before, plus more": small sizes carry content that large sizes have no reason to show (a Micro chart's summary phrase has no place on a Stage). Expressing a rung as a delta smuggles in the assumption that the ladder is purely additive, and it is not.

**The Box Is Not Negotiable Rule.** A widget's box size is decided by the grid and never by its own contents, and a plan may only affect things *inside* that box. This is structural prevention of a real failure mode: if content could resize its own container, measuring would change the plan, which would change the required room, which would resize the box, forever. The platform takes the same position — CSS refuses to let an element query its siblings' sizes, and `ResizeObserver` throws on an unresolved cycle rather than trying to damp it.

### How a chart changes across families

Content adaptation uses five invertible actions, applied to targets (data, encoding, interaction, narrative, references and layout):

- **Recompose** — remove, add, replace, or aggregate content
- **Rescale** — make an element bigger or smaller
- **Transpose** — serialise, parallelise, or transpose axes
- **Reposition** — externalise, internalise, fix, unfix, or relocate
- **Compensate** — toggle or adjust a number to offset another action

**The Non-Monotonic Legend Rule.** Legend behaviour is not a straight line from "full legend" to "nothing". Legends *externalise* at large sizes (moving outside the plot, where there is room) and *internalise or are added* at small sizes (direct labels attached to marks, because a separate legend costs more space than it saves). Assuming a monotonic decay here produces the wrong layout at both ends.

**The Conceal Means Gone Rule.** When a family drops an element, that element is removed from the render, not greyed out, not collapsed to zero opacity, not left in the DOM. A ghost of a label is worse than no label: it costs space, it costs accessibility-tree noise, and it implies information that is not being shown.

Stroke weights **increase** as size decreases. A hairline that reads correctly on a Canvas disappears on a Tile; the small chart needs a heavier line, not a proportionally scaled one.

The data table is a rung of the ladder, not an accessibility afterthought — a collapsible table inside the figure, treated as the most information-dense end of the same continuum.

---

## Elevation & Depth

**The Zero-Shadow Rule.** There are no shadows, no glows, no blurs, and no translucency anywhere in this system. Not softened, not subtle — absent. A shadow implies a light source and a physical stack, and this world is a printed plate: everything is on the same plane.

Depth is communicated by exactly two means:

1. **Hairlines.** A 1px rule at a charcoal value separates regions. Denser or lighter hairlines indicate hierarchy.
2. **Ground value.** A region that needs to recede takes a ground one step darker or lighter on the charcoal ramp.

There are no cards. A grouping is made by a hairline boundary and by spacing, never by a raised or floating surface. Elevation tokens exist in name only and resolve to nothing — a widget cannot opt into a shadow.

⚠ **A widget cannot; a theme can.** Keeping the elevation token *names* alive while resolving them to nothing is what lets the neutral escape-hatch theme resolve them to real shadows by swapping one class (`research/43-theming.md` §3.2). It is the only reason to name a token that resolves to nothing. The consequence for the token tree: `--gx-widget-shadow`, `--gx-tooltip-shadow` and `--gx-widget-radius` must exist as names in **both** themes — a token defined in one theme only cannot be swapped by a class. ⚠ Those three were spelled `--gx-elevation-*` and `--gx-*-corner-radius` until the B1 slice-2 rename; the *mechanism* this paragraph specifies is untouched by it, since what the mechanism needs is two names present in both themes, not any particular two.

---

## Shapes

**The Square Corner Rule.** Corner radius is zero everywhere. Not small, not 2px — zero. Every rectangle in the system is a rectangle: widgets, wells, inputs, buttons, swatches, tooltips. A rounded corner in this world reads as a different product.

Borders are 1px hairlines from the charcoal ramp. Border weight is the only structural variable; it never exceeds 1px for a boundary, and heavier rules are reserved for the rail itself.

**The Left-Edge State Rule.** Active and selected states are shown by a coloured bar on the element's left edge plus a dashed border — never by a fill, a shadow, or a corner treatment. This is the rail gesture repeated at component scale: the coloured tick registering against the structure. It also keeps state legible without spending the fill area, which in a chart widget belongs to the data.

Point shapes carry series identity alongside hue (circle, square, triangle, diamond, cross, plus), and dash patterns carry it alongside both. All three channels are active simultaneously by default; this redundancy is the system's normal operating mode, not a mode a consumer switches on.

---

## Do's and Don'ts

**Do**

- Compute a new series colour from a named spectroscopic line, and state the wavelength.
- Verify any palette change under protanopia, deuteranopia, tritanopia, and greyscale simulation before shipping it. Simulate; do not eyeball.
- Encode series identity redundantly — hue *and* dash *and* point shape — in every theme, at every size.
- Increase stroke weight as a widget gets smaller.
- Remove elements a size family cannot carry, entirely.
- Drive grid and axis chrome from `currentColor` at low opacity so re-themed widgets stay coherent.
- Reference every colour, length, and weight through a token (`var(--...)`).
- Check token *pairs* that modulate the same perceptual channel — colour × opacity, stroke width × dash, font size × weight — as a composed result, not as two separately-sourced values. Two impeccable citations are not evidence that the pair is right together.
- Ship every size threshold labelled with where it came from — including when the answer is "this project invented it".

**Don't**

- Don't write a raw hex, `rgb()`, `hsl()`, or raw `px` value into a stylesheet. The lint gate rejects these on day one, not later.
- Don't use a gradient anywhere, for any reason.
- Don't add a shadow, glow, blur, or translucent surface.
- Don't round a corner.
- Don't pull an alert colour from the series ramp, or a series colour from the alert namespace.
- Don't distinguish series by hue alone past six series.
- Don't hold all series at equal lightness for the sake of equal visual weight — it destroys colour-blind and greyscale separation.
- Don't grey out or zero-opacity an element the ladder has dropped.
- Don't let a CSS custom property influence what `planChart()` decides. Presentation tokens are CSS; anything that changes the plan is a typed value passed through configuration, because the server cannot read CSS variables and the two would disagree.
- Don't apply `tabular-nums` globally, or omit it from a column of comparable numbers.
- Don't treat a passing automated accessibility check as evidence a chart is accessible. Only 2 of axe's 105 rules apply to an SVG chart, and the main one fires only on an `<svg>` that already declares a role — so an entirely unlabelled chart passes clean.
- Don't express a size-boundary deadband in fixed pixels if one proves necessary. It must be a percentage of the boundary: 8px means very different things at a 120px boundary and a 1200px one.
- Don't assert a minimum legible font size as though it were published.

⚠ **Which of these Don'ts survive a theme switch.** This document specifies the *default* theme, and a
neutral escape-hatch theme ships alongside it (`research/43-theming.md`). The test for whether a rule
crosses the boundary is **why it exists**, not how strongly it is worded:

| Crosses into the neutral theme | Rail-only |
|---|---|
| redundant encoding · no hue alone past six · never equal lightness · the Separate Alarm Rule · Conceal Means Gone · `tabular-nums` per role · no CSS variable into `planChart()` · everything through a token · **no gradients** · stroke weights increasing as size decreases | shadows · corner radius · the Left-Edge State Rule · the cool charcoal ramp · emission-line hue derivation |

The gradient ban sits on the left because its reason is semantic — *a gradient encodes a value that
varies where no value varies* — and a semantic ban does not relax into a stylistic preference. The
Zero-Shadow and Square Corner rules sit on the right because their reasons are about this world's
look. Stroke weight sits on the left because it is legibility, not taste.

### Unresolved at seed time

Recorded so they are not quietly invented later:

- ~~Typeface pairing, exact type sizes, and the line-height scale.~~ **Resolved** — Roboto Flex, the A–E scale above, and `--gx-label-line-height: 1.2em` (`research/41-text-metrics.md` §4, `research/42-typography.md` §2.1 and §4.3). ⚠ The line-spacing value is **Tier C**, invented: Talbot's 1.5em is a *horizontal* label-spacing finding and citing it for leading would be borrowed authority.
- Spacing scale steps and the rail's exact offset.
- Motion *easing* curves. Durations are settled (300ms rescale / 1000ms mark movement); `--gx-motion-easing` is one of six token defaults the research explicitly declined to guess at, and it must not be given a Tier A label for looking plausible. The other five: the `--gx-axis-translate` half-pixel default, Spectrum's named dash-ramp arrays, `--gx-widget-gap`, `--gx-plot-border-width`, and `--gx-line-join` — where ECharts verifiably ships `bevel`, contradicting the intuitive `round`.
- Sequential and diverging ramps for continuous data.
- 43 token names are referenced by the research but not yet specified; each needs a row or deletion before the token tree ships. (Was 51; `research/42-typography.md` §4 specified eight of them.)
- Whether animation alone smooths the family boundaries is an open empirical question. If dragging still flickers after transitions ship, a deadband follows — as a percentage, per the rule above.
- The typeface's `tnum` support is unverified — see the note under Typography. The Tabular Rule depends on it, and it blocks metrics-table generation rather than merely documentation.
- No minimum-contrast or minimum-colour-separation threshold exists anywhere in the research. The 4.5 contrast floor and the ΔE separation targets used to derive this palette are **this project's own choices** and carry no external authority.
- The Okabe-Ito hex values and ColorBrewer's colour-blind-safe flags remain unverified against primary sources; neither is relied on for any value in this document.
- The project itself is still unnamed, and the `--gx-*` token prefix is a placeholder.
