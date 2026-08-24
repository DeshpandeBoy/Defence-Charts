# Typography — one reconciled type scale

> Closes `DESIGN.md:123` (*"Exact sizes are `[to be resolved during implementation]`"*) and the
> `landmark-weight` name collision at `DESIGN.md:246`.
>
> Depends on `41-text-metrics.md` §4 (reference typeface = Roboto Flex) and blocks it in return:
> the default `FontMetrics` table cannot be generated until the sizes below are fixed
> (`41-text-metrics.md` §5.1).

---

## 1. The conflict, stated precisely

Two type systems exist in the corpus and they do not agree.

**`DESIGN.md:113–123`** defines five ranks with sizes deliberately unresolved, plus an ordering:

| Rank | Role | Use |
|---|---|---|
| A | Display | Chart title; the one thing read first |
| B | Title | Axis titles, section headers |
| C | Signal | Legend entries, emphasised values |
| D | Align | Axis labels, tick labels |
| E | Index | Data labels, annotations, footnotes |

> *"Sizes ascend in the order: data label < axis label ≤ legend < axis title < chart title."*

**`raw/06-design-tokens-widgets.md` §6** ships concrete defaults with provenance:

| Token | Default | Tier | Source | Line |
|---|---|---|---|---|
| `--gx-label-font-size` | `11px` | **B** | field spread 10–14: Vega `guide-label` 10, Plot 10, Nivo 11, Spectrum 14 | `:1731` |
| `--gx-label-font-size-min` | `10px` | C | *"No system publishes a legibility floor."* | `:1732` |
| `--gx-axis-title-font-size` / `-weight` | `11px` / `700` | A-impl | Vega `guide-title: { fontSize: 11, fontWeight: 'bold' }` | `:1745` |
| `--gx-title-font-size` / `-weight` | `13px` / `700` | A-impl | Vega `group-title: { fontSize: 13, fontWeight: 'bold' }` (Spectrum 18) | `:1747` |
| `--gx-subtitle-font-size` | `12px` | A-impl | Vega `group-subtitle: { fontSize: 12 }` | `:1749` |
| `--gx-value-label-font-size` | `10px` | **B** | Highcharts `dataLabels.style.fontSize: '0.7em'` — deliberately smaller than the legend's `0.8em` | `:1751` |
| `--gx-value-label-font-weight` | `700` | A-impl ×2 | Highcharts `dataLabels…fontWeight: 'bold'`; Spectrum `DIRECT_LABEL_FONT_WEIGHT = 700` | `:1752` |
| `--gx-label-landmark-weight` | `600` | A-impl | Carbon: *"semibold the label to make it a 'landmark' label"* | `:1743` |
| `--gx-crosshair-label-font-size` | `11px` | A-impl | Highcharts `crosshair.label.style.fontSize: '11px'` | `:1810` |

### 1.1 ⚠ The ordering is not merely inverted — it is unsatisfiable

The plan anticipated one conflict: `--gx-legend-label-font-size` sourced at Nivo 10 would give
*legend < axis label*, inverting `axis label ≤ legend`.

**That premise is wrong, and checking it surfaced a worse problem.** `--gx-legend-label-font-size`
appears exactly once in `raw/06`, at `:1433`, in the **inventory** table — the list of names with
source hints. It has **no specified default row** in §6's defaults block. It is one of the 51
referenced-but-unspecified names (`README.md` open item 2), not an A-impl default. There is nothing
to contradict, and we are free to set it.

The real conflict is between two tokens that *are* specified:

```
axis label = 11px   (--gx-label-font-size,      tier B)
axis title = 11px   (--gx-axis-title-font-size, tier A-impl, Vega)
```

DESIGN.md requires `axis label ≤ legend < axis title`, i.e. `11 ≤ legend < 11`. **No value of legend
satisfies that.** The ordering has no solution regardless of what the legend is set to.

**Root cause.** Vega's own scale is internally consistent — `guide-label: 10` sits strictly below
`guide-title: 11`. `raw/06` took `guide-title: 11` as A-impl but set the label to **11** as its own
tier-B judgment, splitting the difference across a 10–14 field spread. That B-tier choice collapsed a
gap Vega had deliberately left open. This is `00-decisions.md`'s standing warning made concrete:
*provenance is per-token; correctness is per-composition.* Both tokens are individually well-sourced
and the pair is broken.

---

## 2. The resolution

Two candidate repairs:

- **(a) Restore Vega's gap downward** — axis label back to 10px (A-impl). Then data label must be
  < 10, but `--gx-label-font-size-min` is 10 and `DESIGN.md:131` refuses to assert a legibility floor.
  Pushes the collision to the other end of the scale.
- **(b) Open the gap upward** — axis title to 12px, keeping label at 11.

**Adopted: (b).** It preserves the tier-B label size that the field spread actually supports (three of
five surveyed systems sit at 10–11, Spectrum at 14), keeps the whole scale above the 10px floor, and
costs one A-impl → B demotion rather than reopening a floor `DESIGN.md` explicitly declines to set.

### 2.1 The scale

| Rank | Size | Weight | Roles |
|---|---|---|---|
| **A** Display | `13px` | 700 | chart title |
| **B** Title | `12px` | 700 | axis titles, section headers |
| **C** Signal | `11px` | 500 | legend entries, emphasised values |
| **D** Align | `11px` | 400 | axis labels, tick labels |
| **E** Index | `10px` | 400 | data labels, annotations, footnotes |

Ordering check: `10 < 11 ≤ 11 < 12 < 13` ✅ — satisfies `DESIGN.md:123` exactly, including its `≤`,
which was evidently written knowing D and C could tie.

**C and D share a size and differ by weight.** That is licit: `DESIGN.md:111` says rank *"is expressed
through size **and weight** against the charcoal ramp"*. It is also the right call independently — a
legend occupies its own region (`40-chart-plan.md` §4.4), so it is already distinguished spatially and
does not need to spend size on it.

Five ranks, five sizes — but only **four distinct values** (13/12/11/10). That is the whole scale. No
line-height ratio, no modular scale, no `rem` arithmetic: a chart has four type sizes and `raw/06`
found no surveyed system with more.

### 2.2 Weight is set by placement, not only by rank

⚠ One A-impl pair appears to contradict the table: `--gx-value-label-font-weight: 700` (Highcharts
*and* Spectrum, independently) puts **rank E at weight 700** — bolder than rank D above it.

It is not a contradiction, and the rule that reconciles them is worth stating because it also explains
Carbon's landmark labels:

> **Rank sets size. Placement sets weight.** Text drawn *over* a mark or a filled region carries extra
> weight for legibility against a non-ground background. Text on the ground plane does not.

Data labels sit on bars and beside points; landmark axis labels mark a time-cycle boundary and must
be found by scanning. Neither is a promotion in the reading hierarchy — both are legibility
compensation, and `DESIGN.md`'s Rank Rule (`:129`) already forbids the alternative compensation
(colour), since type never carries series identity.

---

## 3. Landmark emphasis becomes a **grade**, not a weight

Per `41-text-metrics.md` §3, `wght` changes glyph advance widths and `GRAD` verifiably does not
(Google Fonts axis registry: grade adjusts typographic colour *"without … changes overall width, line
breaks or page layout"*, and *"the units are the same as in the Weight axis"*).

Landmark labels are the *first and last* labels on an axis — exactly where the collision budget is
tightest. Emphasising them with `wght` silently widens the two labels most likely to overflow.

**So: `--gx-label-landmark-grade` replaces `--gx-label-landmark-weight`.**

⚠ **And the target value cannot be Carbon's 600.** Roboto Flex's verified `GRAD` range is
**−200 → 150** (`METADATA.pb`), against the registry's nominal −1000 → 1000. Carbon's semibold is
`400 → 600`, a **+200** delta in weight units — which exceeds Roboto Flex's `+150` ceiling. The
strongest emphasis the reference face can supply without touching advances is `GRAD: 150`,
approximately equivalent to weight 550.

| Token | Default | Tier | Note |
|---|---|---|---|
| `--gx-label-landmark-grade` | `150` | **B** | Carbon's A-impl *intent* (`raw/06:1743`), retargeted to grade and clamped to Roboto Flex's verified `+150` ceiling |

This is a deliberate divergence in the `§6.2` pattern, and it costs the token its A-impl tier. Two
consequences to write down rather than discover:

- On a face with **no `GRAD` axis**, the token degrades to **no emphasis at all** — not to a `wght`
  bump. That is graceful: an unemphasised landmark label is a small loss; a silently widened one is a
  collision.
- ⚠ Whether `GRAD: 150` is *perceptually* sufficient to read as a landmark at 11px is **UNVERIFIED**.
  It is 3/4 of Carbon's delta. Check it visually at A4; if it reads too weak, the fallback is a
  charcoal-ramp step (a darker grey), not a weight bump — that keeps advances fixed and stays inside
  `DESIGN.md`'s Rank Rule, since the charcoal ramp is not series colour.

### 3.1 The name collision, resolved by supersession

`DESIGN.md:246` flags `--gx-axis-label-landmark-weight` vs `--gx-label-landmark-weight`. Verified
occurrences — exactly four in the corpus:

| Location | Spelling | Disposition |
|---|---|---|
| `raw/06:1219` | `--gx-axis-label-landmark-weight: 600` | → `--gx-label-landmark-grade: 150` |
| `raw/06:1436` | `--gx-axis-label-landmark-weight` (inventory) | → `--gx-label-landmark-grade` |
| `raw/06:1743` | `--gx-label-landmark-weight` (the specified row) | → `--gx-label-landmark-grade`, tier A-impl → B |
| `DESIGN.md:246` | the collision note itself | → delete; resolved here |

Both spellings are superseded by one name, so the collision cannot survive as a stale alias.

---

## 4. Token mapping — rank → `--gx-*`

One default per token, one tier per token. **New** marks a token specified here for the first time,
retiring it from the 51-unspecified list.

### 4.1 Face and figures

| Token | Default | Tier | Source |
|---|---|---|---|
| `--gx-font-family` | `"Roboto Flex", "Roboto Flex Fallback", system-ui, sans-serif` | **B** · New | Reference face per `41-text-metrics.md` §4; the stack is ours |
| `--gx-font-optical-sizing` | `auto` | **B** · New | `DESIGN.md:125` — *"expected to be on globally so that small labels thicken correctly"* |
| `--gx-numeric-variant` | `tabular-nums` | **B** · New | `DESIGN.md:127` Tabular Rule. ⚠ Kept for the **fallback** faces, not for Roboto Flex — see below |
| `--gx-font-feature-settings` | `'tnum' 1` | **B** · New | Same reason. Inert on Roboto Flex, load-bearing on SF |
| `--gx-font-family-mono` | *(unset)* | — | `raw/06:1424` — optional, for values where a tabular face is unavailable. Unset when `--gx-numeric-variant` works. |

⚠ **Roboto Flex ships no `tnum`, and the Tabular Rule holds anyway.** `41-text-metrics.md` §4.1
settles this: the released variable TTF's `GSUB` carries `liga`, `locl`, `pnum` and `rvrn` — no
`tnum`. What makes the rule hold is the `pnum` lookup, which maps `uni0030 → uni0030.prop`. The
substitution runs *away* from tabular, so the **default** figures are the tabular set: all ten
digits at `1156/2048` em, measured. Nothing needs to be switched on to get tabular figures on the
reference face.

So the declaration above is retained for a different reason than the one it was written for. SF —
the `system-ui` fallback on Apple platforms — ships proportional figures by default (nine distinct
digit widths, measured) and a real `tnum` to correct them. A consumer who does not load Roboto Flex
renders in SF, and without the declaration their digits would not be tabular. **The token is for
the stack, not for the reference face.**

⚠ **The load-bearing rule is the negative one.** `proportional-nums` / `pnum` must never be applied
to text measured against `ROBOTO_FLEX_METRICS`, because on this face that is precisely the setting
that invalidates the table — it substitutes ten distinct proportional widths for the one tabular
width the advances were measured at. A "make the numbers look more natural" change is the plausible
route in.

⚠ `--gx-numeric-variant` is applied **per role, never globally** — `DESIGN.md:127`: *"Applying
`tabular-nums` globally is the opposite error and is equally wrong."* It goes on tick labels, data
labels, and animating values; not on titles, legend entries, or annotation prose.

⚠ `raw/06:1278` is the reason this is a numerals token and not a font-family token: the numeric
variant belongs in `font-variant-numeric`, which composes with any family, rather than forcing a
second family declaration.

### 4.2 The five ranks

| Rank | Token | Default | Tier | Note |
|---|---|---|---|---|
| A | `--gx-title-font-size` | `13px` | A-impl | Vega `group-title` (`raw/06:1747`) |
| A | `--gx-title-font-weight` | `700` | A-impl | Vega `group-title` |
| A− | `--gx-subtitle-font-size` | `12px` | A-impl | Vega `group-subtitle` (`raw/06:1749`) |
| A− | `--gx-subtitle-font-weight` | `400` | **B** · New | Sits at B's size; separated by weight |
| B | `--gx-axis-title-font-size` | **`12px`** | **B** | ⚠ **Changed from 11px.** Demoted from A-impl — §2 |
| B | `--gx-axis-title-font-weight` | `700` | A-impl | Vega `guide-title` (`raw/06:1745`) — unchanged |
| C | `--gx-legend-label-font-size` | `11px` | **B** · New | Was unspecified (`raw/06:1433`). Set to D's size, per §2.1 |
| C | `--gx-legend-label-font-weight` | `500` | **B** · New | Distinguishes C from D without spending size |
| D | `--gx-label-font-size` | `11px` | B | `raw/06:1731` — unchanged |
| D | `--gx-label-font-weight` | `400` | **B** · New | |
| D | `--gx-label-font-size-min` | `10px` | **C** | `raw/06:1732`. ⚠ No system publishes a legibility floor; `DESIGN.md:131` refuses to assert one. **Ours.** |
| D | `--gx-label-landmark-grade` | `150` | **B** | §3 |
| E | `--gx-value-label-font-size` | `10px` | B | `raw/06:1751` — Highcharts `0.7em` |
| E | `--gx-value-label-font-weight` | `700` | A-impl ×2 | `raw/06:1752`. Placement compensation, not rank — §2.2 |
| E | `--gx-annotation-font-size` | `10px` | **B** · New | Rank E per `DESIGN.md:121` |
| E | `--gx-annotation-font-weight` | `400` | **B** · New | On the ground plane, so no compensation |

**Unchanged and consistent:** `--gx-crosshair-label-font-size: 11px` (A-impl, Highcharts,
`raw/06:1810`) already sits at rank D, which is right — a crosshair label reads a tick value.

**Out of scope here:** the `--gx-arc-summary-font-size-{ratio,min,max}` triple (`0.35` / `28px` /
`60px`, A-impl Spectrum, `raw/06:1708`–`:1709`). Those are not rank-scale members — they are the
`ratio + min + max` clamp idiom for text sized from a geometry rather than from a scale
(`raw/06:1716`). ⚠ Note the min of 28px is **2.15×** rank A: a donut's centre summary is display type,
not chart type, and lives outside this scale by design.

### 4.3 Line spacing

`DESIGN.md:240` lists a line-height scale as unresolved. For SVG it largely does not exist —
`<text>` ignores `line-height`, and multi-line labels are `<tspan dy>`.

| Token | Default | Tier |
|---|---|---|
| `--gx-label-line-height` | `1.2em` | **C** · New |

Used only by the `split` step of the label degrade ladder (`10-responsive-ladder.md` §5.2). ⚠ **No
published source.** Talbot's 1.5em is *horizontal* spacing between adjacent labels, not vertical
spacing within one — citing it here would be exactly the kind of borrowed authority `00-decisions.md`
warns against. Tier C, ours.

The one place a real line-height applies is the `<figcaption>` data table, which is ordinary HTML and
inherits the host document's typography. **The library should not set it** — `PRODUCT.md` scopes the
library as presentational-for-charts, and a table that ignores the host's line-height reads as
foreign.

---

## 5. ⚠ A correction this document forces on `41-text-metrics.md`

`41-text-metrics.md` §5 keys the advance table `byFontSize` and carries a single scalar
`generatedWith.weight`. **That is insufficient given §2.1.** The scale ships text at weights 400, 500
and 700, and `wght` changes advances — so one weight-scalar cannot describe a table covering all
five ranks.

**Fix: key the table by rank, not by font size.** A rank pins size, weight, and feature settings
together, and that tuple is exactly what determines advances:

```ts
readonly byRank: Readonly<Record<TypeRank, GlyphAdvances>>;   // 'A' | 'B' | 'C' | 'D' | 'E'
```

and correspondingly `measureText(text, rank, metrics, letterSpacing?)`. This is better than the
size-keyed form on three counts: it makes an unmeasurable combination unrepresentable, it removes the
`fallbackFontSize` guess, and it drops the table to exactly five entries.

The `opsz` argument for per-size keying (`41` §5.1) survives unchanged — rank implies size implies
optical size. `41-text-metrics.md` §5 is amended accordingly.

---

## 6. Amendments this document required elsewhere — ✅ all applied

| File | Change |
|---|---|
| `DESIGN.md:123` | sizes resolved — §2.1 table |
| `DESIGN.md:240` | drop "exact type sizes" and "line-height scale" from unresolved |
| `DESIGN.md:246` | delete the `landmark-weight` collision note — superseded (§3.1) |
| `raw/06:1219`, `:1436`, `:1743` | rename to `--gx-label-landmark-grade`, value `150`, tier B |
| `raw/06:1745` | `--gx-axis-title-font-size` `11px` → `12px`, A-impl → **B** |
| `raw/06:1433` | `--gx-legend-label-font-size` gains a specified row (11px / 500, B) |
| `41-text-metrics.md` §5 | `byFontSize` → `byRank` (§5 above) |
| `README.md` open item 2 | 51 unspecified names → **43**; eight specified here |

## 7. Open, and deliberately not invented

1. ~~**`tnum` in Roboto Flex**~~ — **closed.** `41-text-metrics.md` §4.1 inspected the released
   variable TTF: no `tnum`, but the default figures are already tabular and `pnum` is the switch
   away from them. The token survives for the fallback stack and the rule becomes a prohibition on
   `pnum`; see §4.1 above. ⚠ **Segoe UI Variable remains UNVERIFIED** — Windows-only and not
   obtainable on the machine that did the measuring, so it was left unmeasured rather than
   estimated. The tier system exists so that this is a recorded gap rather than a plausible number.
2. **Is `GRAD: 150` a legible landmark at 11px?** (§3) — visual check at A4; fallback is a charcoal
   step, not a weight bump.
3. **`--gx-label-line-height: 1.2em`** (§4.3) — Tier C with no source. If the `split` degrade step
   proves rare in practice, the honest move is to delete the token rather than defend the number.
4. **Spectrum's 14px label** sits well outside the adopted 11px and was not adopted. Spectrum also
   ships titles at 18px against Vega's 13. ⚠ **We have followed Vega's scale wholesale and Spectrum's
   not at all**, which is a choice, not a finding — worth revisiting once real charts exist at Canvas
   and Stage, where 11px labels in a 900px-wide plot may simply read as small.
