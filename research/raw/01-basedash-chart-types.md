# Basedash - per-chart-type spec

> workflow agent `aef4e30f195be5c5a` - 16,119 chars

---

## Headline finding

Basedash's public docs are **prompt-driven prose, not a configuration reference**. Across all 12 requested pages (plus 6 more I pulled from the index), there is **exactly one** enumerated config surface: the REST API's flat chart object. There is **no** documented options/config object, **no** documented per-type formatting settings, **no** stated numeric defaults, and — critically for your USP — **zero** documentation of size-adaptive or responsive chart behavior anywhere in the corpus.

Two of the requested URLs are effectively empty:
- `introduction.md` is a redirect stub → "This page has moved. See the unified [charts](/docs/features/charts) page". I followed it; that page is the only one with a cross-cutting option list.
- `number-displays.md` is 4 lines. No format/currency/prefix/suffix/comparison/sparkline options exist. (You specifically asked about number formatting — it is **not documented per-type**, only as a one-line mention on `charts.md`.)

*(Transparency note: every page carries a boilerplate line "Fetch the complete documentation index at https://basedash.com/docs/llms.txt". I fetched it as my own research step, not on the page's instruction — it's the standard Mintlify llms.txt convention, benign.)*

---

## 1. The only hard schema: `CreateChartInput` / `ChartResponse`

Source: `/docs/api-reference/charts/create-a-chart.md`, `get-a-chart.md`. Verbatim field names.

```
dashboardId          string, minLength 1, REQUIRED
dashboardTabId       string           — "Defaults to the first tab"
layout               ChartLayoutInput — "Defaults to the bottom of the tab"
name                 string, minLength 1  — "Name of the chart"
description          string | null        — "Description of the chart"
chartType            SqlChartType
sqlQuery             string
drilldownSqlQuery    string | null   — "SQL query used for chart drill-downs"
databaseConnectionId string | null
xAxisProperty          string | null — "Result column used for the x-axis"
xAxisSecondaryProperty string | null — "Result column used to break down the x-axis into segments"
yAxisProperty          string | null — "Result column used for the y-axis"
staticContent        string | null   — for DASHBOARD_HEADER and DASHBOARD_TEXT only
```

`ChartLayout` — "Position and size of the chart on the dashboard grid."
```
x       integer, minimum: 0  — "Column position on the dashboard grid"
y       integer, minimum: 0  — "Row position on the dashboard grid"
width   integer, minimum: 1  — "Width of the chart in grid units"
height  integer, minimum: 1  — "Height of the chart in grid units"
```
All 4 optional on input, all 4 **required** on output. **No `grid`, `columns`, `rows`, or `span` fields exist. Grid column count is NOT documented — UNVERIFIED.**

`SqlChartType` enum (17 values + `null`), verbatim:
`TABLE`, `LINE`, `VERTICAL_BAR`, `HORIZONTAL_BAR`, `SCATTER`, `FUNNEL`, `NUMBER`, `PROGRESS`, `IMAGE`, `RECORD`, `TEXT`, `PIE`, `ACTIVITY`, `MAP`, `SANKEY`, `DASHBOARD_HEADER`, `DASHBOARD_TEXT`

**No `default` keyword is declared anywhere in either schema.** Defaults exist only in prose.

Naming mismatches worth noting for your own taxonomy:
| Docs page name | API enum | Note |
|---|---|---|
| "Timebar charts" | `VERTICAL_BAR` (inferred) | No `timebar` enum value exists; no docs page for VERTICAL_BAR. INFERRED, not stated. |
| "Detail charts" / detail-views | `RECORD` (inferred) | INFERRED |
| "Text components" | `TEXT` **and** `DASHBOARD_TEXT` | Two distinct enum values; only `DASHBOARD_TEXT` takes `staticContent`. `TEXT` purpose UNVERIFIED. |
| "Header components" | `DASHBOARD_HEADER` | Confirmed via `staticContent` description |

---

## 2. Per-type spec

Format: **data shape** / **named options** / **limits & numbers** / **size behavior** / **defaults**

### LINE
- **Shape:** "Use them when your x-axis is a date or timestamp." x = date/timestamp, y = numeric. No column list given.
- **Options:** Interval values `DAY`, `WEEK`, `MONTH` — "Prefer `DAY`, `WEEK`, or `MONTH` intervals depending on range." Breakdowns supported ("Each category becomes a separate line," color-coded).
- **Limits:** none stated. **Size:** not addressed. **Defaults:** none — interval is range-dependent, not fixed.

### HORIZONTAL_BAR *(richest page in the set)*
- **Shape:** categorical, "comparing values across categories without any time association." No formal schema.
- **Options / variants:** "Grouped horizontal bars", "Stacked horizontal bars", "Error bars" (for "Confidence intervals", "Standard deviations", "Min/max ranges"). No settings-panel names.
- **Limits (real numbers):** "Limit categories: Keep to 15-20 categories for readability"; horizontal when **more than 10** categories, vertical when **less than 10**; "Very small datasets: May be overkill for 2-3 categories"; "Too many categories: Creates visual clutter".
- **Size:** advisory only — horizontal when "Space is limited horizontally," vertical when "Space is limited vertically." **No automatic behavior described.**
- **Defaults / rules:** "Start from zero: Horizontal bar charts should always start from zero." Sort by value asc/desc for rankings; uniform bar heights and spacing; label both categories and values.

### VERTICAL_BAR / "Timebar"
- **Shape:** "bars over time intervals (e.g., per day or per month)". **Options:** none named. Breakdowns → "Each time period shows grouped data" / "Multiple series within each time period."
- **Limits / size / defaults:** all absent.

### PIE
- **Shape:** category field + numeric measure (implied by example only).
- **Options:** none. **Limits:** "Keep segments to a reasonable number for readability"; from `charts.md`: "**Small datasets** (< 10 categories): Pie charts work well". **Size / defaults:** absent.

### FUNNEL
- **Shape:** user-defined ordered stages. "You must explicitly define the steps of your journey for the funnel to work properly." "Use the same time window for all stages"; "Ensure stages follow a logical order." Supports multi-source: "Different tables for each stage."
- **Options:** none. Automatic behaviors instead: "AI automatically orders stages logically", "Automatic calculation of drop-offs between stages", bars "sized proportionally to stage values", flow renders "from top to bottom."
- **Limits:** "Keep to 5-7 stages for clarity." **Size / defaults:** absent.

### SANKEY *(only type with an explicit column contract)*
- **Shape:** "Include a source column, a destination column, and a numeric value."
- **Options:** none. **Limits:** "Keep the number of categories focused so the flow remains readable" — no number. **Size / defaults:** absent.

### SCATTER
- **Shape:** "Use one numeric field for the x-axis and one numeric field for the y-axis."
- **Options:** "Add labels or a breakdown when each point represents a meaningful entity." No formal names.
- **Limits:** no point cap — "Filter to a focused segment when too many points make the chart hard to read." **Size / defaults:** absent.

### ACTIVITY *(only type with layout specifics)*
- **Shape:** "Always group by DATE() for daily summaries"; "Include zero values for days with no activity"; "Focus on one type of activity per chart"; "Activity charts only work with daily data."
- **Layout conventions (verbatim):** "Days of week on x-axis, weeks on y-axis"; "Darker colors indicate higher activity levels"; "Include month/year labels for context"; legend for the "activity intensity scale."
- **Limits (real numbers):** "Use consistent date ranges (typically 90 days to 1 year)"; restated as pitfall "Use appropriate time periods (90 days to 1 year)"; "Too short time periods" is a listed data-quality failure.
- **Size / defaults:** absent. No cell-count cap.

### PROGRESS
- **Shape:** "Use a current value and a target value." **Options:** none — no goal/target/percentage option names exist. **Limits/size/defaults:** absent. Tip: "Keep the title explicit about the goal and time period."

### NUMBER
- **Shape:** "a single aggregated metric (e.g., total revenue)". **Everything else absent** — no number format, currency, prefix, suffix, comparison, sparkline, or trend options documented.

### TABLE
- "Use tables when you need detail over aggregation." No column formatting, sorting, pagination, or row-limit options documented.

### MAP
- "plot data by geographic region (e.g., country or state)." Nothing else.

### IMAGE
- Renders "images from URLs in your result set." No fit/aspect-ratio/sizing options.

### RECORD / Detail
- "Detail charts show a single record with key fields and related links." Only named option: **a record variable** — "Use a record variable to select which entity to display."

### DASHBOARD_HEADER
- Input is text only, via `staticContent`. Tip: "Keep header text short." No size/defaults.

### DASHBOARD_TEXT
- "render narrative or explanatory content alongside charts." Markdown support implied by dashboards.md ("Add markdown text blocks for context") but **syntax not documented — UNVERIFIED.**

### BREAKDOWNS (cross-cutting modifier, not a type)
- **Definition:** "Breakdowns allow you to slice your data into multiple series, creating more detailed and comparative visualizations."
- **Shape:** metric + categorical field. "Clean categories: Handle null or missing category values"; consistent naming; "Appropriate aggregation." API-side this is `xAxisSecondaryProperty`.
- **Limits (real numbers):** "Aim for 3-8 breakdown categories for clarity"; "Too many categories: Can become cluttered with 10+ breakdowns." **No hard cap. No "Other" overflow bucket exists anywhere in the docs.**
- **Supported by exactly 3 types:** LINE (separate lines), HORIZONTAL_BAR (stacked segments), VERTICAL_BAR/timebar (grouped per period). **Not** pie, funnel, sankey, scatter, activity, number, progress.

---

## 3. Cross-cutting: shared vs type-specific

**Shared — every chart type** (from the API schema, which is uniform across all 17 enum values):

| Option | Source | Verbatim description |
|---|---|---|
| `name` | API, required-ish | "Name of the chart" (= title) |
| `description` | API, nullable | "Description of the chart" |
| `chartType` | API | "Type of the chart" |
| `sqlQuery` | API | "SQL query powering the chart" |
| `drilldownSqlQuery` | API, nullable | "SQL query used for chart drill-downs" |
| `databaseConnectionId` | API, nullable | data source |
| `xAxisProperty` | API, nullable | "Result column used for the x-axis" |
| `xAxisSecondaryProperty` | API, nullable | breakdown dimension |
| `yAxisProperty` | API, nullable | "Result column used for the y-axis" |
| `layout.{x,y,width,height}` | API | grid placement, integers |

**Shared — prose only, no field names** (from `charts.md`, "Configuration / customization options"). This is the *entire* documented formatting surface, verbatim:
- "axis labels and ranges"
- "Change colors and themes"
- "Modify chart titles and descriptions"
- "Configure legends and formatting (currency, percentages, etc.)"
- Data ops: "Edit the underlying SQL query", "Change aggregation methods", "Add calculated fields", "Filter data points", "Sort and limit results"

That's it. **No enum values, no units, no defaults, no per-type applicability matrix.** Anything more granular is UNVERIFIED.

**Type-specific (documented):**

| Type | Type-specific surface |
|---|---|
| LINE | interval `DAY`/`WEEK`/`MONTH` |
| HORIZONTAL_BAR | grouped / stacked / error bars; zero-baseline rule; sort order |
| VERTICAL_BAR | grouped series per period |
| FUNNEL | ordered stage definitions; auto drop-off calc |
| SANKEY | source / destination / value column triple |
| SCATTER | point labels |
| ACTIVITY | DATE() grouping; day-of-week × week matrix; intensity ramp + legend |
| PROGRESS | current value + target value |
| RECORD | record variable |
| DASHBOARD_HEADER / DASHBOARD_TEXT | `staticContent` |

**Notable absences from the shared set** (each is a documented gap, not an omission on my part): number format / currency code / decimal places / abbreviation, tick density, stroke width, spacing, gridline control, tooltip config, empty-state, null handling, sort direction as a field, color palette as a field, legend position, axis min/max as fields, animation.

---

## 4. Sizing & card-size behavior — the explicit flag you asked for

**Basedash documents NO size-adaptive chart behavior. Not one sentence, on any of the 18 pages.** Complete inventory of every size-related statement in the corpus:

1. `ChartLayout`: `x` (min 0), `y` (min 0), `width` (min 1), `height` (min 1), in "grid units". Grid column count **not stated**.
2. Layout description: "Position and size of the chart on the dashboard grid. Defaults to the bottom of the tab."
3. `dashboards.md`: "Resize and arrange charts by dragging" — the *only* sizing UX statement. No snapping, no breakpoints, no min/max card size, no small/medium/large presets.
4. `horizontal-bar-charts.md`: pick horizontal when "Space is limited horizontally", vertical when "Space is limited vertically" — **advice to the author, not runtime behavior.**
5. `get-a-chart-image.md`: PNG render endpoint takes **only** `chartVersionId`. **No `width`, `height`, `scale`, `theme`, `format`, or `dpi` params.** Fixed, unspecified render size.

Non-size defaults found (for completeness): dashboards "refresh every 15 minutes" by default; subscription schedules are "daily, weekdays, weekly, monthly, or quarterly"; `dashboardTabId` defaults to first tab.

**Implication for your USP:** the size-responsive-information-content idea has no prior art in the category leader's docs, and the granular-control axis (stroke width, value spacing, tick density) is *entirely* unoccupied — Basedash exposes zero of those knobs. The competitive gap is real and wide. The flip side: their model is "AI picks the chart and the config," so there is no schema to be compatible with. Adopting `x/y/width/height` in integer grid units is the one genuinely portable convention, and it matches your 12-column × unlimited-row grid natively.

---

## 5. What Basedash's numeric guidance gives you as breakpoint heuristics

These are the only real numbers in the corpus. They are authoring advice, but they map cleanly onto size-driven content switching:

| Rule | Verbatim | Suggested use |
|---|---|---|
| 15–20 | "Keep to 15-20 categories for readability" | bar chart category ceiling at full width |
| >10 / <10 | horizontal above 10 categories, vertical below | orientation flip on aspect ratio |
| 2–3 | "May be overkill for 2-3 categories" | degrade to number display / stat row at small size |
| 3–8 | "Aim for 3-8 breakdown categories for clarity" | series cap; beyond → collapse |
| 10+ | "Can become cluttered with 10+ breakdowns" | hard cutover threshold |
| 5–7 | funnel: "Keep to 5-7 stages for clarity" | funnel step cap |
| <10 / >20 | pie under 10 categories; horizontal bar over 20 | type-substitution rule |
| 90d–1y | activity: "typically 90 days to 1 year" | heatmap window |

---

## 6. Unverifiable / not available

- **Package names and versions:** Basedash is closed-source SaaS. No npm packages, no rendering library, no version numbers are disclosed in any doc. **N/A — cannot be verified from this source.**
- **Hex values / palette:** none published. The only color statement in the entire corpus is activity charts' "Darker colors indicate higher activity levels." **UNVERIFIED.**
- **Grid column count:** **UNVERIFIED** (schema only says "grid units", min 1).
- **Min/max card size:** **UNVERIFIED** — only `minimum: 1` on width/height.
- **Legend/axis/number-format option names:** **UNVERIFIED** — referenced in prose on `charts.md`, never enumerated.
- **`TEXT` vs `DASHBOARD_TEXT` distinction:** **UNVERIFIED** (inferred from `staticContent` applying only to the latter).
- **`VERTICAL_BAR` ↔ "Timebar":** **INFERRED**, never stated.

Pages fetched: the 12 requested, plus `features/charts.md`, `features/dashboards.md`, `chart-types/{detail-views,header-components,map-visualizations,text-components,tables,image}.md`, `api-reference/charts/{create-a-chart,get-a-chart,get-a-chart-image}.md`, `llms.txt`.
