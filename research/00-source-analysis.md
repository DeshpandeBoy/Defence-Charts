# Source analysis — Basedash demo video + docs

Primary sources for the competitive/reference read.

- **Video:** "What is Basedash - AI Native BI Demo", Basedash channel, 2025-08-28, 6:16, 1798x1080 @24fps.
  Downloaded to `/tmp/gridgraph-research/video.mp4`; transcript at `raw/basedash-demo.vtt`.
- **Docs:** https://www.basedash.com/docs/features/charts + `llms.txt` index + REST API reference.

---

## 1. The two decisive moments in the video

### [02:30–02:45] — grid interaction model
> "As far as customizing dashboards, it's pretty easy. You just drag and drop around and you can
> also resize by **dragging from the bottom right hand corner**."

### [03:45–04:10] — THE core concept (this is our product thesis)
> "This is the chart types that we've created inside of the base dash organization broken down
> inside of a pie chart. **If you make this a little bit bigger, you can see a breakdown of all
> those different things.** Let's make it a little bit more responsive to the side there, and
> **we get a better visualization depending on the size of the card** that you have inside of
> your dashboard."

This is the entire premise of our library, stated out loud by a competitor — but, per the docs
research, **never specified, documented, or exposed as an API anywhere**. That is the opening.

---

## 2. Frame evidence — the donut responsive ladder

Same widget, same data ("Chart Types by Count", total 310), two sizes:

| Asset | Size | What renders |
|---|---|---|
| `assets/donut-medium-total-only.jpg` | ~3-4 cols, near-square | Donut only. Centered `Total / 310`. **No legend, no labels, no values.** |
| `assets/donut-wide-legend-other.jpg` | ~6 cols, wide | Donut **shrinks and right-aligns**. A full legend list appears on the left: colour dot + category + value + percent — `TABLE 87 (28%)`, `LINE 83 (27%)`, `VERTICAL_BAR 37 (12%)`, `NUMBER 34 (11%)`, `HORIZONTAL_BAR 18 (6%)`, `FUNNEL 16 (5%)`, `ACTIVITY 9 (3%)`, `RECORD 7 (2%)`, **`Other 19 (6%)`**. |

Three distinct transformations happen at once, and they are the three we must generalise:

1. **Reposition** — donut moves centre → right; layout flips from stacked to side-by-side as
   aspect ratio crosses into landscape.
2. **Reveal** — legend with direct values + percentages appears only once there is width for it.
3. **Aggregate** — low-share categories collapse into a synthetic **"Other"** bucket.

Also observed: the donut's centre label is **not static** — it reads `Total 310` at rest and `19`
when a legend row is highlighted. Centre label is a slot bound to hover/selection state.

## 3. Frame evidence — widget composition and chrome

`assets/kpi-plus-timebar-and-number.jpg`:
- **"Visitors Over Time"** is a *composite*: KPI value `55.2K`, delta `+1%`, comparison `(54.7K)`,
  period label `30 days` — stacked **above** a timebar chart with its own y-axis (`0/1K/2K`).
- **"Blog Visitors (All Time)"** is the same metric idea at smaller width: just `416K` centred with
  a caption. Confirms one metric renders as radically different widgets by size.
- **Resize affordance:** a subtle curved arc in the bottom-right corner, visible on hover only.
- **Header affordances:** expand (⤢) and overflow (⋯) appear in the card header on hover only.
- Dark UI. Card bg is a touch lighter than the dashboard bg. Radius ~8px. Gutter ~12–16px.

## 4. Frame evidence — their config surface (the gap we exploit)

`assets/config-panel-charttype.jpg` — the right-hand panel is:
`SQL query` → `Chart type` (Table, Line, Timebar, Horizontal bar, Funnel, Number, Image, Detail,
Text, Pie, Activity, Map) → field mappings (`Date`, `Value`) → `Y-axis range` →
`Metrics` (`Value`, `Format`) → `Variables` (`{{start_date}}`, `{{end_date}}`, `{{time_interval}}`).

**There is no control anywhere for stroke width, gridline style, tick density, bar padding,
label offset, or spacing.** Their surface is data-binding, not visual design. Ours is both.

---

## 5. What the docs confirmed

- Layout is a **grid-unit model**: `ChartLayoutInput { x, y, width, height }`, all integers,
  `x/y` min 0, `width/height` min 1, described as "Column/Row position on the dashboard grid" and
  "Width/Height of the chart in grid units". New charts default to the bottom of the tab.
- 17 chart types: `TABLE, LINE, VERTICAL_BAR, HORIZONTAL_BAR, SCATTER, FUNNEL, NUMBER, PROGRESS,
  IMAGE, RECORD, TEXT, PIE, ACTIVITY, MAP, SANKEY, DASHBOARD_HEADER, DASHBOARD_TEXT`.
- **The grid's column count is not documented.** Unverified in public docs.
- **Zero documentation of size-adaptive behaviour** across the entire docs corpus.
- Useful stated heuristics we can borrow as defaults: pie works under ~10 categories; horizontal
  bar above ~10, keep to 15–20; funnel 5–7 stages; activity charts 90 days–1 year; bars start at zero.
