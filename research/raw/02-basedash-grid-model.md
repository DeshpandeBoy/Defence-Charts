# Basedash - dashboard grid, filters, embedding

> workflow agent `a3516c1bbaa3168a4` - 17,625 chars

---

## 1. DASHBOARD GRID MODEL — column count FOUND (not in docs; extracted from the shipped app bundle)

The public docs and the OpenAPI spec contain **zero** grid geometry. `ChartLayout{x,y,width,height}` has `minimum: 0/0/1/1` and **no `maximum` on any field** (verified by parsing the full spec, not the truncated WebFetch view). The real numbers live in `charts.basedash.com/assets/dashboardGridSizing-DU-oG3qo.js` (source file `BentoGrid.tsx`) and `vendor-replicache-YHTN0eXE.js`.

Verbatim from the bundle:

```js
const HT=140; var UT=200; const WT=6, GT=12, KT=188, qT=UT-12;
function JT(e){return e*188+(e-1)*12+24}
const YT=JT(6);
function XT(e){ let t;
  switch(e){ case Tx.ULTRAWIDE: t=18; break; case Tx.WIDE: t=12; break; default: t=6 }
  let n=JT(t); return {cols:t, gridWidth:n} }
const ZT=2, QT=2;
```

**Column count is not one number — it is a 3-way enum.** `DashboardWidth` → cols:

| `DashboardWidth` | cols | gridWidth px = `cols*188 + (cols-1)*12 + 24` |
|---|---|---|
| `NORMAL` (default) | **6** | 1212 |
| `WIDE` | **12** | 2412 |
| `ULTRAWIDE` | **18** | 3612 |

Named constants: `MIN_COLUMN_WIDTH = 140`, base unit `200`, `DEFAULT_COLS = 6`, `GUTTER = 12`, `ROW_HEIGHT = 188` (= 200 − 12), `DEFAULT_GRID_WIDTH = 1212`. `ZT = 2, QT = 2` are two adjacent exported constants (exported as `mn`/`pn`), almost certainly default widget w/h in grid units — **UNVERIFIED purpose**, values are certain.

Nominal column width == row height == **188px**, i.e. the base cell is square at nominal width.

Sizing math, verbatim:
```js
var je=480;
function Me({width:e,cols:t}){return t<=0?0:(e-24-(t-1)*12)/t}          // columnWidth
function Ne(e){return e*140+24+(e-1)*12}                                 // minGridWidth
function Pe({dashboardWidth:e,containerWidth:t}){ if(t===null)return null;
  let {cols:n,gridWidth:r}=a(e), i=Math.max(0,t),
      o = i<=je ? `singleColumn` : `grid`,
      s = Ne(n),
      c = o===`singleColumn` ? Math.min(i,r) : Math.min(r, Math.max(i,s));
  return {mode:o, cols:n, gridWidth:c, maxGridWidth:r, columnWidth:Me({width:c,cols:o===`singleColumn`?1:n})} }
```
- Container padding **12px each side (24 total)**; gutter **12px**.
- Grid width is clamped: `min(maxGridWidth, max(containerWidth, minGridWidth))`. Columns squeeze from 188px down to a floor of **140px**, then the grid stops shrinking and the page scrolls.
- **containerWidth ≤ 480 → `mode: 'singleColumn'`** (every widget full width, columnWidth computed with cols=1). This is the only breakpoint.

**Engine: `react-grid-layout`** (base `ReactGridLayout` + `WidthProvider`, NOT `Responsive`). Version **≥1.4.x — exact version UNVERIFIED** (`resizeItemInDirection` present ⇒ ≥1.4.0). The Basedash call site, verbatim props:
```js
<ReactGridLayout cols={_} rowHeight={188} margin={[12,12]} containerPadding={[12,12]}
  width={v} draggableCancel=".disable-drag-handling"
  className={cx('bento-grid w-full max-w-[var(--bento-grid-width)]', mounted && 'mounted')}
  isDraggable={!readonly} isResizable={!readonly}
  resizeHandles={readonly ? undefined : ['se','sw','ne','nw']}
  layout={i} onLayoutChange={d} onResize={d} isBounded={false} style={{'--bento-grid-width': `${v}px`}} />
```
Item wrapper class: `bento-grid-item align-stretch relative flex justify-stretch`.

**Compaction / placement (inherited RGL defaults — Basedash overrides none of these):**
```js
defaultProps: { autoSize:true, cols:12, rowHeight:150, maxRows:Infinity, margin:[10,10],
  isBounded:false, isDraggable:true, isResizable:true, allowOverlap:false, isDroppable:false,
  useCSSTransforms:true, transformScale:1, verticalCompact:true, compactType:'vertical',
  preventCollision:false, droppingItem:{i:'__dropping-elem__',h:1,w:1}, resizeHandles:['se'] }
```
⇒ **vertical compaction ON, overlap forbidden, collision push-down (not blocked), maxRows Infinity (unlimited rows), unbounded**. Corner-only resize handles (4 corners, no edge handles) — a deliberate Basedash override of RGL's `['se']`.

**Per-item min/max:** RGL item defaults `minH:1, minW:1, maxH:Infinity, maxW:Infinity`. Basedash sets **no per-item minW/maxW/minH/maxH** — every widget can be 1×1 up to cols×∞. Overflow correction: `if (i.x+i.w > cols) i.x = cols - i.w; if (i.x < 0) { i.x = 0; i.w = cols }`.

**Default placement:** API-side, `ChartLayoutInput` is "Position and size of the chart on the dashboard grid. Defaults to the bottom of the tab." — create-a-chart adds it "at the bottom of the tab unless a layout is provided." Client-side, RGL's `synchronizeLayoutWithChildren` falls back to `{w:1,h:1,x:0,y:bottom(layout)}` for unpositioned children.

RGL's own responsive defaults (present in bundle but **unused** by Basedash — useful as a reference table): `breakpoints {lg:1200, md:996, sm:768, xs:480, xxs:0}`, `cols {lg:12, md:10, sm:6, xs:4, xxs:2}`.

## 2. LAYOUT PRIMITIVES

- **Tabs** are first-class API objects: `DashboardTab {id, createdAt, updatedAt, name, order ("Sort order of the tab within the dashboard"), dashboardId}`, all required. `GET /dashboards/{id}` returns `DashboardWithTabsResponse` = `DashboardResponse` + required `tabs[]` "Tabs on the dashboard, ordered by their sort order". Separate endpoints exist for create/update/delete tab. **Each tab has its own independent grid** (layout defaults "to the bottom of the tab"; charts carry `dashboardTabId`).
- **Sections/headers/text are NOT separate primitives — they are chart types.** `DASHBOARD_HEADER` and `DASHBOARD_TEXT` are members of `SqlChartType` and occupy grid cells like any chart. Their content comes from `staticContent` (string|null): *"Static content for DASHBOARD_HEADER and DASHBOARD_TEXT chart types."* No section container, no auto-full-width, no grid-span special case exists anywhere in the schema or bundle.
- Docs on headers are thin (`/docs/features/chart-types/header-components.md`, 825 bytes total): "Header components add section headings to dashboards. Use them to split a dashboard into clear areas". Dashboards page says only "Add markdown text blocks for context" and "Resize and arrange charts by dragging". **No documented grid span, sizing, or styling for headers/text.**
- Dashboard-level: `icon`, `color` ("Icon color key"), `dashboardFolderId`, `width` (the enum above), `defaultDateRange`, `defaultCustomDateRangeStart/End`, `defaultGroupByInterval`.

## 3. FILTERS & VARIABLES

- **The filter bar is not declared — it is inferred from SQL.** Verbatim: filters are "dashboard-level controls that automatically add variables to your chart queries"; "When your SQL references these variables, Basedash automatically shows the corresponding controls in the dashboard filter bar."
- **Binding syntax: `{{name}}` double curly braces**, inline in SQL:
```sql
SELECT DATE_TRUNC('{{time_interval}}', created_at) AS period, COUNT(*) AS signups
FROM users
WHERE created_at BETWEEN '{{start_date}}' AND '{{end_date}}'
GROUP BY period ORDER BY period
```
- **Cross-chart binding is by name**: "When multiple charts use a variable with the same name, they share a single filter control." One control → N charts. No explicit wiring.
- **Filter types (verbatim):** `Text`, `Number`, `Boolean` ("True/false toggle for binary conditions"), `List` ("Dropdown selection from a predefined set of options"), `Record` ("Dropdown selection populated from database records"), `SQL` ("Custom SQL-based filtering for advanced logic").
- **Built-in variables:** `start_date`, `end_date` (Date, "formatted as `YYYY-MM-DD`"), `time_interval` (String).
- **`GroupByInterval` enum:** `HOUR, DAY, WEEK, MONTH, YEAR`.
- **`DateRange` enum (API, authoritative):** `CUSTOM, TODAY, YESTERDAY, THIS_WEEK, THIS_MONTH, THIS_QUARTER, THIS_YEAR, LAST_7_DAYS, LAST_30_DAYS, LAST_60_DAYS, LAST_90_DAYS, LAST_6_MONTHS, LAST_1_YEAR, ALL_TIME`.
- **Filter config option names (verbatim):** "Allow multiple values", "Required", "Show on public dashboard", "Default values".
- Note the asymmetry worth copying: filters are dashboard-scoped state, defaults live on the *dashboard* (`defaultDateRange`, `defaultGroupByInterval`), and charts consume by name.

## 4. EMBEDDING CONTRACT

```html
<iframe
  src="https://charts.basedash.com/shared/xyz789"
  width="100%"
  height="600"
  frameborder="0"
  allowfullscreen
  allow="clipboard-write"
></iframe>
```
Full-app embed: identical minus `allowfullscreen`, `height="800"`, src `https://charts.basedash.com/api/sso/jwt?jwt=YOUR_JWT_TOKEN`.

URL shapes: `/shared/{id}` · `/shared/{publicSharingLinkId}/{jwtToken}` (secure filtering) · `/api/sso/jwt?jwt=…`
Example: `https://charts.basedash.com/api/sso/jwt?jwt=YOUR_JWT_TOKEN&theme=dark&hide_org_name=true&hide_chat=true`

| Param | Values | Default |
|---|---|---|
| `theme` | `light` \| `dark` \| `auto` | `auto` (follows system) |
| `hide_org_name` | `true`/`false` | `false` |
| `hide_chat` | `true`/`false` | `false` |
| `hide_dashboards` | `true`/`false` | `false` |
| `hide_insights` | `true`/`false` | `false` |
| `hide_automations` | `true`/`false` | `false` |
| `hide_suggested_prompts` | `true`/`false` | `false` |
| `jwt` | HS256 token | required (full-app) |

`theme` is the **only** appearance param — no width/scale/density/font/accent params. Constraint: at least one feature must stay visible; hiding chat falls through dashboards → insights → automations.

JWT claims — SSO: `email`, `orgId`, `exp`, `iat` required; `firstName`, `lastName`, `role` (`ADMIN`|`MEMBER`) optional. Secure filtering: `dashboardLinkId` (must equal URL link id), `params` (object mapping filter names → locked values; string, number, boolean, or string[]), `exp` required, `iat` optional. HS256, shared secret under Settings → Security, ~30s clock-drift tolerance, 10–60 min recommended lifetime. Allowed origins support wildcards (`https://*.example.com`); bare-TLD wildcards rejected; empty list = any domain.

**No postMessage API and no resize/height-negotiation protocol is documented.** Fixed pixel height only. This is a real gap you can beat.

## 5. CHART-IMAGE ENDPOINT — no width/height/scale/theme params

`GET /api/public/organizations/{orgId}/charts/{id}/image` → `image/png`.
**Only params:** `orgId` (path), `id` (path), `chartVersionId` (query, optional, "Chart version to render. Defaults to the latest version of the chart."). **There is no `width`, `height`, `scale`, `theme`, `format`, or `dpr`.** "Rendered images are cached per chart version."

The dimensions are hardcoded in the internal screenshot route (`internal.chart-screenshot.$chartId.tsx`), verbatim:
```js
D = {width:700, height:500}
// wrapper: className="light h-screen w-screen bg-white"
// target:  <div data-chart-screenshot-target="true" data-screenshot-ready={w} className="overflow-hidden bg-white" style={D}>
// forced light: function x(){ let e=document.documentElement; e.classList.remove('dark'); e.classList.add('light') }
```
So: **fixed 700×500 CSS px, theme forcibly reset to `light`**, 38px title strip (`h-[38px]`), `p-1` padding, `rounded-lg border border-bdc-neutral-5 bg-bdc-background-1`. Readiness handshake is a `data-screenshot-ready` attribute set after two nested `requestAnimationFrame`s, plus `data-chart-screenshot-async-state="loading"` for `MAP`. Device scale factor is set headless-side — **UNVERIFIED**.

## 6. CONFIRMATION / EXTENSION OF WHAT YOU ALREADY KNEW

Confirmed exactly: `ChartLayoutInput{x,y,width,height}` with those four descriptions and `minimum` 0/0/1/1, object description "Position and size of the chart on the dashboard grid. Defaults to the bottom of the tab.", and the 17-member `SqlChartType`. Extensions:
- `SqlChartType` is modeled as `anyOf` of single-value enums **plus a `null` branch** — chartType is nullable.
- `ChartLayout` (response) marks all four **required**; `ChartLayoutInput` marks none.
- Update-chart body is entirely optional; fields: `dashboardId`, `dashboardTabId`, `layout`, `name` (minLength 1), `description`, `chartType`, `sqlQuery`, `drilldownSqlQuery`, `databaseConnectionId`, `xAxisProperty`, `xAxisSecondaryProperty` ("Result column used to break down the x-axis into segments"), `yAxisProperty`, `staticContent`.
- **The entire visual model is 3 axis-column bindings + chart type. There are zero styling, color, legend, stroke, spacing, or series properties in the public API.** `ChartResponse` adds `imageUrl` (uri). Content edits version the chart; changing `dashboardId`/`dashboardTabId`/`layout` does not.

## 7. HIGH-VALUE FINDINGS FOR YOUR LIBRARY (beyond the brief)

**Your USP already has a shipping precedent — here it is verbatim from `LineChart.tsx`:**
```js
let a = i<=200 || t<=200,   // hideXAxis   (height<=200 OR width<=200)
    o = t<=200,             // hideYAxis   (width<=200)
    s = t>800;              // showLineEndValues (width>800)
// passed as: hideXAxis:a, hideYAxis:o, showLineEndValues:s
```
Basedash **drops both axes below 200px and adds end-of-line value labels above 800px** — different information content, not just different dimensions. It's crude (two magic numbers, one chart type) and container-px-based rather than grid-unit-based. Your grid-unit-driven, per-chart-type content ladder is a strict generalization of this.

**Tick-density algorithm, verbatim** (directly relevant to your "tick density" control):
```js
function kL({chartWidthPx:e, tickCount:t, fontSizeRem:n, avgChars:r=7, minLabels:i=2}){
  let a = Ju(n)*r,                                    // est. label width px
      o = Math.max(i, Math.floor(e/Math.max(a,1)));   // labels that fit
  return Math.max(1, Math.ceil(t/Math.max(o,1)))      // → stride
}
function Ju(e){ return e*parseFloat(getComputedStyle(document.documentElement).fontSize) } // rem→px
```
Applied as: `!(index===0 || index===ticks.length-1) && index % stride !== 0 ? null : <Tick/>` — **first and last tick always survive**, every stride-th in between. Defaults `avgChars: 7`, `minLabels: 2`.

**Rendering engine: `visx`** (airbnb). Confirmed by 41 `visx-*` class occurrences: `visx-axis`, `visx-axis-{top,right,bottom,left}`, `visx-axis-line`, `visx-axis-tick`, `visx-axis-label`, `visx-bar`, `visx-line`, `visx-group`, `visx-circle`, `visx-pie-arc`, `visx-pie-arcs-group`, `visx-geo`, `visx-geo-graticule`, `visx-pattern-line`, `visx-tick-`, `visx-categorical-tick-`. **No recharts, victory, nivo, echarts, or bare d3-scale/d3-shape.** Charts render inside a `MeasuredParentSize` render-prop (`MeasuredParentSize.tsx`) yielding `{width, height}` — used by `LineChart.tsx`, `PieChart.tsx`, `FunnelChart.tsx`, `SankeyChart.tsx`. visx axis defaults visible in bundle: `stroke: '#222'`, `strokeWidth: 1`, `tickStroke: '#222'`, tick label `fontSize: 10`, `fontFamily: 'Arial'`, `strokeLinecap: 'square'`.

**Two-layer CSS custom property token architecture** — public `--color-bdc-*` aliases a private `--_*` layer, so themes are swapped by redefining only the private layer on `:root,.dark` vs `.light`. 215 custom properties total, 31 in the `bdc` namespace. Real values:

Categorical series ramp (`--_chart-member-1..9`, dark / light):
`1: #f5f5f5 / #333` (the only one that flips — neutral primary) · `2: #4679f2` · `3: #ea863f` · `4: #a369ea` · `5: #f84747` · `6: #4ebcfc` · `7: #2fa86b` · `8: #ffd559` · `9: #f47bd0` (2–9 identical in both modes).

Chart-specific semantic tokens: `--color-bdc-chart-label-lowlight` (`#161616` / `#fff`), `--color-bdc-chart-label-resting` (`#8a8a8a` / `#757575`), `--color-bdc-chart-line-axis` (`#444` / `#bbb`), `--color-bdc-chart-line-hoverbox` (`#ffffff0d` / `#1515150d`).

Neutrals are alpha-based over background: `--_neutral-1..6` = `#fff` → `#ffffffb3` → `#ffffff80` → `#fff3` → `#ffffff1a` → `#ffffff0a` (dark), mirrored as `#151515xx` (light), each with an `-opaque` twin (`--_neutral-3-opaque: #8a8a8a` in both). Backgrounds `--_background-1..4`: `#151515/#212121/#15151533/#101010` (dark), `#fff/#f7f7f7/#fff3/#f0f0f0` (light). Theme accent `--_theme-1`: `#3c50ff` (dark) / `#061de0` (light). Semantics: good `#00a94e`/`#058540`, warning `#eca500`/`#cb9800`, danger `#f33a45`/`#c9131e`, each with `-background` (α `1a`/`33`) and `-background-opaque` variants.

Grid width is itself a CSS custom property: `--bento-grid-width`, consumed as `max-w-[var(--bento-grid-width)]` — a pattern worth copying for your grid container.

## 8. EXPLICITLY UNVERIFIED

- Purpose of `ZT=2, QT=2` (values certain; "default widget w/h" is inference).
- Exact `react-grid-layout` version (≥1.4.0 inferred from `resizeItemInDirection`).
- Headless browser `deviceScaleFactor` for the PNG endpoint (server-side, not in client bundle).
- Any per-chart-type min grid size — none found; likely doesn't exist.
- `ML=550` appears near tick code but is a **day-count** threshold for date-axis label formatting (`Math.abs(diffInDays(end,start)) <= 550`), **not** a pixel breakpoint. Do not cite it as a size threshold.

## 9. LOCAL ARTIFACTS (downloaded to /tmp, read-only; nothing in your repo was touched)

- `/tmp/bd_openapi.json` (267 KB, full Basedash OpenAPI 3.1.0 spec, `https://charts.basedash.com/api/public/openapi`)
- `/tmp/bd_grid.js` (83 KB — `dashboardGridSizing`, contains `BentoGrid.tsx` + vendored react-grid-layout)
- `/tmp/bd_vendor.js` (734 KB — contains the `DashboardWidth`→cols mapping and grid constants)
- `/tmp/Chart.js` (1.02 MB — visx chart implementations, tick-density fn, LineChart size branches)
- `/tmp/bd_tw.css` (146 KB — full token layer)
- `/tmp/internal.chart-screenshot._chartId-F4pmKnR8.js` (8.5 KB — 700×500 forced-light PNG route)
- `/tmp/bd_llms.txt` (858-line docs index; canonical chart-type page paths are `/docs/features/chart-types/*.md`, **not** `/docs/chart-types/*.md` — the latter 404s)
