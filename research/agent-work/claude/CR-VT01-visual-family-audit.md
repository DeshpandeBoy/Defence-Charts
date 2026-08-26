# CR-VT01 — Visual audit of every chart family across the responsive ladder

Status: proposal for coordinator review — audit complete, 120/120 card×viewport combinations inspected
Date/access window: 2026-08-26, single session, in-order (setup → gate → full sweep → forced-colors →
light theme → issue confirmation)
Repository baseline: `3d22609` (worktree HEAD `35da6eb`, docs-only on top of `3d22609`; no source
changed between the two)
Owner: Claude review agent
Coordinator: Codex

## Exact question and exclusions

For every registered chart family and every responsive rung, can a person looking at the rendered
SVG answer: what kind of chart is this; what data is visible and what does each mark/label
represent; which series/category/value is primary at this size; what was intentionally reduced,
moved, or hidden; and does the result stay understandable at a narrow width? This report is visual
and repository evidence only — no implementation file was edited (verified: `git status --short`
shows only the two files in this task's allowed write set, see "Final handoff" in the companion
handoff).

## Environment

| Item | Value |
|---|---|
| Browser | Chromium 151.0.7922.34, driven via `playwright@1.62.1` (`chromium.launch()`, headless) |
| OS | macOS 26.6.2 (BuildVersion 25G83), Darwin 25.6.0 |
| Node / pnpm | v22.12.0 / pnpm 10.34.5 |
| Reduced motion | `reducedMotion: 'reduce'` set on every context used for measurement (repeatability; forced-colors/theme contexts likewise) |
| Fixture origin used | `http://127.0.0.1:5199/` — **not** the handoff's documented `5186`; see "A process hazard found while setting up" below |
| Viewports | Desktop `1440×1100`, Narrow `390×844`, per the brief |
| Font/rendering | Whatever this Chromium build's default font stack resolves on this machine; not independently cross-checked against another OS/browser — flagged under Unknowns |

## A process hazard found while setting up (repository/process evidence, not a chart defect)

Before any chart evidence was collected, starting the fixture dev server exactly as instructed
(`vite --config src/family-matrix-fixture.vite.ts`, port `5186`, `strictPort: true`) **failed**
with `Port 5186 is already in use`. `lsof -i :5186` showed an unrelated, already-running Vite
process whose `cwd` was `/Users/SameeraD/Defence-Charts/apps/playground` — the **main checkout**,
not this task's worktree — with an active connection from a `Codex` process, i.e. a different agent's
concurrent session. Because `scripts/check-family-matrix.mjs`'s `ensureServer()` treats "the origin
already answers" as "the fixture is up," running the documented command
(`GX_REQUIRE_BROWSER=1 npx -y node@24 scripts/check-family-matrix.mjs`) against port `5186` from
inside this worktree silently exercised **the other worktree's code**, not `3d22609`. That first run
reported a real failure (`donut aggregate value is not readable for donut-tile`) that does **not**
reproduce against this worktree and must not be attributed to it — it is evidence about whatever the
other agent's checkout currently contains, not about CR-VT01's baseline.

I did not touch that process or its worktree. I started my own server bound to `127.0.0.1:5199`
(`vite --port 5199 --strictPort`, confirmed via `lsof`/`cwd` to be serving
`/Users/SameeraD/Defence-Charts-CR-VT01/apps/playground`) and re-ran every command against
`GX_FAMILY_MATRIX_ORIGIN=http://127.0.0.1:5199/`. All chart evidence in this report is from that
server. **Flagged as repository/process evidence for the coordinator**: a fixed default port shared
across concurrent agent worktrees lets `ensureServer()`'s "does something answer" check silently
validate the wrong codebase; a stronger check (e.g. asserting a build/commit marker in the served
page, or parameterising the port per worktree) would prevent a future agent from reporting findings
against the wrong tree without realising it. This is a process observation, not a chart family
issue, and is not counted in the issue register below.

## Repository evidence — the automated gate, run correctly

| Commit | Command | Exit | Result |
|---|---|---:|---|
| `35da6eb` (worktree HEAD; no source diff vs `3d22609`) | `GX_REQUIRE_BROWSER=1 GX_FAMILY_MATRIX_ORIGIN=http://127.0.0.1:5199/ npx -y node@24 scripts/check-family-matrix.mjs` | **0** | `D7.1 complete family matrix: Chromium passed — ten family rungs, static a11y, states, themes, media, resize identity, and screenshot evidence` — 60 cards, `outOfCard: []`, `summaryOverlaps: []`, both viewports |
| (discarded — wrong origin) | `GX_REQUIRE_BROWSER=1 npx -y node@24 scripts/check-family-matrix.mjs` against the accidental `5186` (main checkout) | 1 | Not evidence about this worktree; see hazard note above. The result file this produced (`scripts/results/d0.2-family-matrix.latest.json`) was reverted with `git checkout --` before finishing, since it is outside this task's write set. |

The automated gate is genuinely green for this worktree. **It does not replace this audit**: every
one of the nine confirmed issues below (VT-001 through VT-009) renders correctly by the automated
gate's own assertions (no out-of-card geometry, no summary overlap, all its specific per-family
checks pass) while still failing a human trying to read the chart. Two of the nine issues exist
*because* the automated gate has a narrower assertion scope than its comment suggests — see VT-001.

## Method

A single Playwright driver (`/tmp/defence-charts-CR-VT01/collect.mjs`, not committed — repo-external
per the task's write-set rule) opened the fixture once per viewport/theme/media profile and, for
every `[data-family-case]` card, read in one `page.evaluate()` round trip: the card/chart-frame/
`.gx-chart`/SVG bounding rectangles; the SVG `viewBox` and `svg.getBBox()` (checked against the
viewBox with a 0.75px tolerance); every `data-plan-*` attribute; `svg title`/`desc`; data-table/
caption presence and header text; `.gx-value*`, `.gx-compact-key*`, `.gx-series[data-series-id]`,
legend, and axis-tick text; the family-specific counts listed in the task brief
(`.gx-bar`, `.gx-arc`/`.gx-arc--other`, `.gx-heatmap-cell` + `data-heatmap-state`/
`data-heatmap-intensity`, `.gx-funnel-stage*`, `.gx-progress*`); and, for every visible `svg text`
element, its own rect plus pairwise overlap against every other visible text element (2px epsilon)
and against every mark element (`.gx-arc`, `.gx-line`, `.gx-bar`, `.gx-scatter-point`,
`.gx-heatmap-cell`, `.gx-funnel-stage`). This produced one JSON record per card per viewport — 120
records — saved to `/tmp/defence-charts-CR-VT01/raw/desktop-narrow.json`, later patched with
`.gx-progress__value`/`[data-funnel-part="summary"]` text (a class the brief's family-specific list
does not name, needed because `.gx-value` alone does not cover Progress/Funnel's own compact
renderers). The same collector ran a third time after clicking `[data-family-theme-toggle]`
(`/tmp/defence-charts-CR-VT01/raw/light.json`, 60 records, desktop only) and a fourth time under
`forcedColors: 'active'` for Micro/Strip/Stage of all ten types (30 records,
`/tmp/defence-charts-CR-VT01/raw/forced-colors.json`), sampling **every** SVG mark's computed `fill`
(not a truncated subset — an early version of that script sampled only the first six DOM nodes and
under-reported distinct colours for bar/timebar/scatter; the corrected version reads all marks).

Every row in the observation table below is generated from that raw JSON plus the scoring rule in
"Grading method," not typed by hand — the intent is that this table is a rendering of a
reproducible measurement, not a set of impressions. Every card with a non-"clean" geometry result
or a nonzero issue count was additionally viewed as a screenshot (`/tmp/defence-charts-CR-VT01/
{desktop,narrow,forced-colors,light}/<case>.png`) before an issue was written up; several were
cross-checked with a second, targeted `page.evaluate()` (computed style, exact tick-label transform
geometry, etc.) — those follow-up scripts and their exact output are described inline in the issue
register.

## Exact audit matrix — coverage confirmed

All 60 `data-family-case` selectors × 2 viewports = **120/120 cards inspected** with measured DOM/SVG
evidence (not a subset, not extrapolated). Forced-colors: 30/30 planned samples (Micro/Strip/Stage ×
10 types) at desktop; no failure required expansion to the remaining three rungs per type — see
"Forced colors" below for why. Light theme: 60/60 cards at desktop, diffed field-by-field against
the dark-theme run (identical geometry/value/count results in every field checked — see below).
Reduced motion: set as the default context option for every measurement pass (this is what the task
brief calls for — "reduced motion for repeatability" — rather than a separate sampled sweep).

## Fixture data cross-check

Every value shown in the "Observation table" below was compared against `matrix.ts`'s fixture
table. Two families do **not** match what a viewer could reasonably infer from the on-chart labels
alone — see VT-001, VT-002, VT-003 in the issue register. All other values checked out exactly:
line/area/bar/timebar/scatter's six series and eight points; KPI's `68/71/74`, target `75`, status
`positive`; Progress's `74/100`; heatmap's two rows and the specific missing (`null`) and negative
(`−2`) cells; funnel's `100/76/54/31/12` and derived drop-offs (24%/29%/43%/61%, confirmed against
`data-funnel-stage-dropoff` at Canvas/Stage).

## Grading method (rubric applied mechanically from measured evidence)

Baseline `3/3/3/3/3` (identity/value/shape/resize/a11y). Deductions applied **only** for a
confirmed, evidenced issue (VT-00N), never as an unexplained judgment call:

- `VT-001` (donut Micro's total is arithmetically wrong): `value=0`, `a11y=0` (the `aria-label`
  carries the same wrong number).
- `VT-002` (funnel Micro shows a bare unlabelled number): `value=1` (the number itself is correct,
  the framing is not).
- `VT-003` (donut/funnel category identity is a raw index): `identity=1` where a label is visible.
- `VT-008` (donut arcs never vary colour; supersedes VT-003's `identity=1` for donut, since the
  colour failure is more severe than the label failure and they compound): `identity=0`.
- `VT-004` (heatmap: a negative value and zero are visually identical): `shape=0`.
- `VT-009` (heatmap Micro/Tile: no hint an anomaly exists in-window): `shape=1`.
- `VT-005` (two direct end labels collide): `identity=min(current,1)`, `shape=min(current,2)`.
- `VT-006` (Stage: dense per-point labels collide with each other and the lines): `identity=
  min(current,1)`, `shape=min(current,1)`.
- `VT-007` (narrow-only heatmap axis-label collision): `resize=0`.

Per the brief, any `0` is P1; a repeated `1` across a family/rung pattern is at least P1. I did
**not** reduce `resize` for VT-005/VT-006 merely because the same defect is present at both
viewports — the rubric's resize dimension is about the *transition* introducing a new failure, and
these do not get worse at narrow (the narrow-only regression is VT-007, which does score `resize=0`).
This convention is stated once here rather than repeated 120 times.

## Observation table

120 rows, one per `type/rung/viewport`, generated from the raw measurement JSON described above
(script: `/tmp/defence-charts-CR-VT01/build-table.mjs`, input: `/tmp/defence-charts-CR-VT01/raw/
desktop-narrow.json`). "Clean" in the geometry column means the automated overlap check found zero
out-of-card marks and zero text/text or text/mark overlaps beyond a 2px epsilon for that specific
card — it does not mean the card is issue-free (donut's colour failure, for instance, has clean
geometry and a real identity failure). `viewBox` values in the SVG column are quoted exactly from
the DOM.

| Type | Rung | Viewport | Card px | SVG px / viewBox | Visible data readout | Key/legend | Geometry/overlap result | I/V/S/R/A | Issue IDs |
|---|---|---|---|---|---|---|---|---|---|
| line | micro | desktop | 437.3×171.5 | 413.3×61 / vb 0 0 413.33 61 | Alpha · 12 / Bravo · 3 / Charlie · 22 / Delta · 13 | - | clean | 3/3/3/3/3 | - |
| line | tile | desktop | 437.3×199.5 | 413.3×89 / vb 0 0 413.33 89 | Alpha · 12 +1 / Bravo · 3 −1 / Charlie · 22 +1 | key:Alph,Brav,Char,Delt,Echo,Foxt | clean | 3/3/3/3/3 | - |
| line | strip | desktop | 437.3×215.5 | 413.3×105 / vb 0 0 413.34 105 | compact key: Alph,Brav,Char,Delt,Echo,Foxt | key:Alph,Brav,Char,Delt,Echo,Foxt | clean | 3/3/3/3/3 | - |
| line | panel | desktop | 437.3×263.5 | 413.3×153 / vb 0 0 413.33 153 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x2; TEXT_MARK_OVERLAP x6 | 1/3/2/3/3 | VT-005 |
| line | canvas | desktop | 437.3×327.5 | 413.3×217 / vb 0 0 413.33 217 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x2; TEXT_MARK_OVERLAP x6 | 1/3/2/3/3 | VT-005 |
| line | stage | desktop | 437.3×391.5 | 413.3×281 / vb 0 0 413.34 281 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x11; TEXT_MARK_OVERLAP x17 | 1/3/1/3/3 | VT-006 |
| area | micro | desktop | 437.3×171.5 | 413.3×61 / vb 0 0 413.33 61 | Alpha · 12 / Bravo · 3 / Charlie · 22 / Delta · 13 | - | clean | 3/3/3/3/3 | - |
| area | tile | desktop | 437.3×199.5 | 413.3×89 / vb 0 0 413.33 89 | Alpha · 12 +1 / Bravo · 3 −1 / Charlie · 22 +1 | key:Alph,Brav,Char,Delt,Echo,Foxt | clean | 3/3/3/3/3 | - |
| area | strip | desktop | 437.3×215.5 | 413.3×105 / vb 0 0 413.34 105 | compact key: Alph,Brav,Char,Delt,Echo,Foxt | key:Alph,Brav,Char,Delt,Echo,Foxt | clean | 3/3/3/3/3 | - |
| area | panel | desktop | 437.3×263.5 | 413.3×153 / vb 0 0 413.33 153 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x2; TEXT_MARK_OVERLAP x6 | 1/3/2/3/3 | VT-005 |
| area | canvas | desktop | 437.3×327.5 | 413.3×217 / vb 0 0 413.33 217 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x2; TEXT_MARK_OVERLAP x6 | 1/3/2/3/3 | VT-005 |
| area | stage | desktop | 437.3×391.5 | 413.3×281 / vb 0 0 413.34 281 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x11; TEXT_MARK_OVERLAP x17 | 1/3/1/3/3 | VT-006 |
| bar | micro | desktop | 437.3×171.5 | 413.3×61 / vb 0 0 413.33 61 | Alpha · 12 / Bravo · 3 / Charlie · 22 / Delta · 13 | - | clean | 3/3/3/3/3 | - |
| bar | tile | desktop | 437.3×199.5 | 413.3×89 / vb 0 0 413.33 89 | Alpha · 12 +1 / Bravo · 3 −1 / Charlie · 22 +1 | key:Alph,Brav,Char,Delt,Echo,Foxt | clean | 3/3/3/3/3 | - |
| bar | strip | desktop | 437.3×215.5 | 413.3×105 / vb 0 0 413.34 105 | (marks only — see counts/table) | - | clean | 3/3/3/3/3 | - |
| bar | panel | desktop | 437.3×263.5 | 413.3×153 / vb 0 0 413.33 153 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x2; TEXT_MARK_OVERLAP x5 | 1/3/2/3/3 | VT-005 |
| bar | canvas | desktop | 437.3×327.5 | 413.3×217 / vb 0 0 413.33 217 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x2; TEXT_MARK_OVERLAP x5 | 1/3/2/3/3 | VT-005 |
| bar | stage | desktop | 437.3×391.5 | 413.3×281 / vb 0 0 413.34 281 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x11 | 1/3/1/3/3 | VT-006 |
| timebar | micro | desktop | 437.3×171.5 | 413.3×61 / vb 0 0 413.33 61 | Alpha · 12 / Bravo · 3 / Charlie · 22 / Delta · 13 | - | clean | 3/3/3/3/3 | - |
| timebar | tile | desktop | 437.3×199.5 | 413.3×89 / vb 0 0 413.33 89 | Alpha · 12 +1 / Bravo · 3 −1 / Charlie · 22 +1 | key:Alph,Brav,Char,Delt,Echo,Foxt | clean | 3/3/3/3/3 | - |
| timebar | strip | desktop | 437.3×215.5 | 413.3×105 / vb 0 0 413.34 105 | (marks only — see counts/table) | - | clean | 3/3/3/3/3 | - |
| timebar | panel | desktop | 437.3×263.5 | 413.3×153 / vb 0 0 413.33 153 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x2; TEXT_MARK_OVERLAP x5 | 1/3/2/3/3 | VT-005 |
| timebar | canvas | desktop | 437.3×327.5 | 413.3×217 / vb 0 0 413.33 217 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x2; TEXT_MARK_OVERLAP x5 | 1/3/2/3/3 | VT-005 |
| timebar | stage | desktop | 437.3×391.5 | 413.3×281 / vb 0 0 413.34 281 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x11 | 1/3/1/3/3 | VT-006 |
| scatter | micro | desktop | 437.3×171.5 | 413.3×61 / vb 0 0 413.33 61 | Alpha · 12 / Bravo · 3 / Charlie · 22 / Delta · 13 | - | clean | 3/3/3/3/3 | - |
| scatter | tile | desktop | 437.3×199.5 | 413.3×89 / vb 0 0 413.33 89 | Alpha · 12 +1 / Bravo · 3 −1 / Charlie · 22 +1 | key:Alph,Brav,Char,Delt,Echo,Foxt | clean | 3/3/3/3/3 | - |
| scatter | strip | desktop | 437.3×215.5 | 413.3×105 / vb 0 0 413.34 105 | (marks only — see counts/table) | - | clean | 3/3/3/3/3 | - |
| scatter | panel | desktop | 437.3×263.5 | 413.3×153 / vb 0 0 413.33 153 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x2 | 1/3/2/3/3 | VT-005 |
| scatter | canvas | desktop | 437.3×327.5 | 413.3×217 / vb 0 0 413.33 217 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x2; TEXT_MARK_OVERLAP x6 | 1/3/2/3/3 | VT-005 |
| scatter | stage | desktop | 437.3×391.5 | 413.3×281 / vb 0 0 413.34 281 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x11; TEXT_MARK_OVERLAP x12 | 1/3/1/3/3 | VT-006 |
| donut | micro | desktop | 437.3×171.5 | 413.3×61 / vb 0 0 413.33 61 | Program mix · 0 total | - | clean | 3/0/3/3/0 | VT-001 |
| donut | tile | desktop | 437.3×199.5 | 413.3×89 / vb 0 0 413.33 89 | Program mix · 107 total | - | clean | 3/3/3/3/3 | - |
| donut | strip | desktop | 437.3×215.5 | 413.3×105 / vb 0 0 413.34 105 | (marks only — see counts/table) | - | clean | 0/3/3/3/3 | VT-008 |
| donut | panel | desktop | 437.3×263.5 | 413.3×153 / vb 0 0 413.33 153 | compact key: 0,1,2,3,4,5,6,7 | key:0,1,2,3,4,5,6,7 | TEXT_MARK_OVERLAP x3 | 0/3/3/3/3 | VT-003,VT-008 |
| donut | canvas | desktop | 437.3×327.5 | 413.3×217 / vb 0 0 413.33 217 | legend: 0,1,2,3,4,5,6,Other | legend:0,1,2,3,4,5,6,Other | clean | 0/3/3/3/3 | VT-003,VT-008 |
| donut | stage | desktop | 437.3×391.5 | 413.3×281 / vb 0 0 413.34 281 | legend: 0,1,2,3,4,5,6,Other | legend:0,1,2,3,4,5,6,Other | clean | 0/3/3/3/3 | VT-003,VT-008 |
| kpi | micro | desktop | 437.3×171.5 | 413.3×61 / vb 0 0 413.33 61 | Readiness · 74 % target 75 status positive | - | clean | 3/3/3/3/3 | - |
| kpi | tile | desktop | 437.3×199.5 | 413.3×89 / vb 0 0 413.33 89 | Readiness · 74 % +3 (71) target 75 status positive | - | clean | 3/3/3/3/3 | - |
| kpi | strip | desktop | 437.3×215.5 | 413.3×105 / vb 0 0 413.34 105 | Readiness · 74 % +3 (71) target 75 status positive | - | clean | 3/3/3/3/3 | - |
| kpi | panel | desktop | 437.3×263.5 | 413.3×153 / vb 0 0 413.33 153 | Readiness · 74 % +3 (71) target 75 status positive | - | TEXT_MARK_OVERLAP x1 | 3/3/3/3/3 | - |
| kpi | canvas | desktop | 437.3×327.5 | 413.3×217 / vb 0 0 413.33 217 | Readiness · 74 % +3 (71) target 75 status positive | - | TEXT_MARK_OVERLAP x1 | 3/3/3/3/3 | - |
| kpi | stage | desktop | 437.3×391.5 | 413.3×281 / vb 0 0 413.34 281 | Readiness · 74 % +3 (71) target 75 status positive | - | TEXT_OVERLAP x2; TEXT_MARK_OVERLAP x2 | 3/3/3/3/3 | - |
| progress | micro | desktop | 437.3×171.5 | 413.3×61 / vb 0 0 413.33 61 | progress 74% (radial, `.gx-progress__value`) | - | clean | 3/3/3/3/3 | - |
| progress | tile | desktop | 437.3×199.5 | 413.3×89 / vb 0 0 413.33 89 | Readiness · 74 % target 100 status positive remaining 26 | - | clean | 3/3/3/3/3 | - |
| progress | strip | desktop | 437.3×215.5 | 413.3×105 / vb 0 0 413.34 105 | Readiness · 74 % target 100 status positive remaining 26 | - | clean | 3/3/3/3/3 | - |
| progress | panel | desktop | 437.3×263.5 | 413.3×153 / vb 0 0 413.33 153 | Readiness · 74 % target 100 status positive remaining 26 | - | clean | 3/3/3/3/3 | - |
| progress | canvas | desktop | 437.3×327.5 | 413.3×217 / vb 0 0 413.33 217 | Readiness · 74 % target 100 status positive remaining 26 | - | clean | 3/3/3/3/3 | - |
| progress | stage | desktop | 437.3×391.5 | 413.3×281 / vb 0 0 413.34 281 | Readiness · 74 % target 100 status positive remaining 26 | - | clean | 3/3/3/3/3 | - |
| heatmap | micro | desktop | 437.3×171.5 | 413.3×61 / vb 0 0 413.33 61 | Maintenance · 6 / Inspection · 8 | - | clean | 3/3/1/3/3 | VT-009 |
| heatmap | tile | desktop | 437.3×199.5 | 413.3×89 / vb 0 0 413.33 89 | Maintenance · 6 / Inspection · 8 | - | clean | 3/3/1/3/3 | VT-009 |
| heatmap | strip | desktop | 437.3×215.5 | 413.3×105 / vb 0 0 413.34 105 | (marks only — see counts/table) | - | clean | 3/3/0/3/3 | VT-004 |
| heatmap | panel | desktop | 437.3×263.5 | 413.3×153 / vb 0 0 413.33 153 | y-axis: Maintenance,Inspection | - | clean | 3/3/0/3/3 | VT-004 |
| heatmap | canvas | desktop | 437.3×327.5 | 413.3×217 / vb 0 0 413.33 217 | legend: Low(−2),·,·,·,High(18) | legend:Low,,,,High | clean | 3/3/0/3/3 | VT-004 |
| heatmap | stage | desktop | 437.3×391.5 | 413.3×281 / vb 0 0 413.34 281 | legend: Low(−2),·,·,·,High(18) | legend:Low,,,,High | clean | 3/3/0/3/3 | VT-004 |
| funnel | micro | desktop | 437.3×171.5 | 413.3×61 / vb 0 0 413.33 61 | Readiness pipeline · 12 | - | clean | 3/1/3/3/3 | VT-002 |
| funnel | tile | desktop | 437.3×199.5 | 413.3×89 / vb 0 0 413.33 89 | Overall conversion: 12% | - | clean | 3/3/3/3/3 | - |
| funnel | strip | desktop | 437.3×215.5 | 413.3×105 / vb 0 0 413.34 105 | 0: value 100 / 1: value 76 / 2: value 54 / 3: value 31 / 4: value 12 | - | TEXT_MARK_OVERLAP x4 | 1/3/3/3/3 | VT-003 |
| funnel | panel | desktop | 437.3×263.5 | 413.3×153 / vb 0 0 413.33 153 | 0: value 100 / 1: value 76 / 2: value 54 / 3: value 31 / 4: value 12 | - | TEXT_MARK_OVERLAP x7 | 1/3/3/3/3 | VT-003 |
| funnel | canvas | desktop | 437.3×327.5 | 413.3×217 / vb 0 0 413.33 217 | 0…4 value+drop-off (24/29/43/61%) | - | TEXT_MARK_OVERLAP x6 | 1/3/3/3/3 | VT-003 |
| funnel | stage | desktop | 437.3×391.5 | 413.3×281 / vb 0 0 413.34 281 | 0…4 value+share+conversion+drop-off | - | TEXT_OVERLAP x1; TEXT_MARK_OVERLAP x6 | 1/3/3/3/3 | VT-003 |
| line | micro | narrow | 358×171.5 | 334×61 / vb 0 0 334 61 | Alpha · 12 / Bravo · 3 / Charlie · 22 | - | clean | 3/3/3/3/3 | - |
| line | tile | narrow | 358×199.5 | 334×89 / vb 0 0 334 89 | Alpha · 12 +1 / Bravo · 3 −1 | key:Alp,Bra,Cha,Del,Ech,Fox | clean | 3/3/3/3/3 | - |
| line | strip | narrow | 358×215.5 | 334×105 / vb 0 0 334 105 | compact key: Alp,Bra,Cha,Del,Ech,Fox | key:Alp,Bra,Cha,Del,Ech,Fox | clean | 3/3/3/3/3 | - |
| line | panel | narrow | 358×263.5 | 334×153 / vb 0 0 334 153 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x2; TEXT_MARK_OVERLAP x6 | 1/3/2/3/3 | VT-005 |
| line | canvas | narrow | 358×327.5 | 334×217 / vb 0 0 334 217 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x2; TEXT_MARK_OVERLAP x6 | 1/3/2/3/3 | VT-005 |
| line | stage | narrow | 358×391.5 | 334×281 / vb 0 0 334 281 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x15 | 1/3/1/3/3 | VT-006 |
| area | micro | narrow | 358×171.5 | 334×61 / vb 0 0 334 61 | Alpha · 12 / Bravo · 3 / Charlie · 22 | - | clean | 3/3/3/3/3 | - |
| area | tile | narrow | 358×199.5 | 334×89 / vb 0 0 334 89 | Alpha · 12 +1 / Bravo · 3 −1 | key:Alp,Bra,Cha,Del,Ech,Fox | clean | 3/3/3/3/3 | - |
| area | strip | narrow | 358×215.5 | 334×105 / vb 0 0 334 105 | compact key: Alp,Bra,Cha,Del,Ech,Fox | key:Alp,Bra,Cha,Del,Ech,Fox | clean | 3/3/3/3/3 | - |
| area | panel | narrow | 358×263.5 | 334×153 / vb 0 0 334 153 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x2; TEXT_MARK_OVERLAP x6 | 1/3/2/3/3 | VT-005 |
| area | canvas | narrow | 358×327.5 | 334×217 / vb 0 0 334 217 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x2; TEXT_MARK_OVERLAP x6 | 1/3/2/3/3 | VT-005 |
| area | stage | narrow | 358×391.5 | 334×281 / vb 0 0 334 281 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x15 | 1/3/1/3/3 | VT-006 |
| bar | micro | narrow | 358×171.5 | 334×61 / vb 0 0 334 61 | Alpha · 12 / Bravo · 3 / Charlie · 22 | - | clean | 3/3/3/3/3 | - |
| bar | tile | narrow | 358×199.5 | 334×89 / vb 0 0 334 89 | Alpha · 12 +1 / Bravo · 3 −1 | key:Alp,Bra,Cha,Del,Ech,Fox | clean | 3/3/3/3/3 | - |
| bar | strip | narrow | 358×215.5 | 334×105 / vb 0 0 334 105 | (marks only — see counts/table) | - | clean | 3/3/3/3/3 | - |
| bar | panel | narrow | 358×263.5 | 334×153 / vb 0 0 334 153 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x2; TEXT_MARK_OVERLAP x6 | 1/3/2/3/3 | VT-005 |
| bar | canvas | narrow | 358×327.5 | 334×217 / vb 0 0 334 217 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x2 | 1/3/2/3/3 | VT-005 |
| bar | stage | narrow | 358×391.5 | 334×281 / vb 0 0 334 281 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x15 | 1/3/1/3/3 | VT-006 |
| timebar | micro | narrow | 358×171.5 | 334×61 / vb 0 0 334 61 | Alpha · 12 / Bravo · 3 / Charlie · 22 | - | clean | 3/3/3/3/3 | - |
| timebar | tile | narrow | 358×199.5 | 334×89 / vb 0 0 334 89 | Alpha · 12 +1 / Bravo · 3 −1 | key:Alp,Bra,Cha,Del,Ech,Fox | clean | 3/3/3/3/3 | - |
| timebar | strip | narrow | 358×215.5 | 334×105 / vb 0 0 334 105 | (marks only — see counts/table) | - | clean | 3/3/3/3/3 | - |
| timebar | panel | narrow | 358×263.5 | 334×153 / vb 0 0 334 153 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x2; TEXT_MARK_OVERLAP x6 | 1/3/2/3/3 | VT-005 |
| timebar | canvas | narrow | 358×327.5 | 334×217 / vb 0 0 334 217 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x2 | 1/3/2/3/3 | VT-005 |
| timebar | stage | narrow | 358×391.5 | 334×281 / vb 0 0 334 281 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x15 | 1/3/1/3/3 | VT-006 |
| scatter | micro | narrow | 358×171.5 | 334×61 / vb 0 0 334 61 | Alpha · 12 / Bravo · 3 / Charlie · 22 | - | clean | 3/3/3/3/3 | - |
| scatter | tile | narrow | 358×199.5 | 334×89 / vb 0 0 334 89 | Alpha · 12 +1 / Bravo · 3 −1 | key:Alp,Bra,Cha,Del,Ech,Fox | clean | 3/3/3/3/3 | - |
| scatter | strip | narrow | 358×215.5 | 334×105 / vb 0 0 334 105 | (marks only — see counts/table) | - | clean | 3/3/3/3/3 | - |
| scatter | panel | narrow | 358×263.5 | 334×153 / vb 0 0 334 153 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x2; TEXT_MARK_OVERLAP x4 | 1/3/2/3/3 | VT-005 |
| scatter | canvas | narrow | 358×327.5 | 334×217 / vb 0 0 334 217 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x2; TEXT_MARK_OVERLAP x6 | 1/3/2/3/3 | VT-005 |
| scatter | stage | narrow | 358×391.5 | 334×281 / vb 0 0 334 281 | y-axis: 0,10,20,30,40 | - | TEXT_OVERLAP x15; TEXT_MARK_OVERLAP x11 | 1/3/1/3/3 | VT-006 |
| donut | micro | narrow | 358×171.5 | 334×61 / vb 0 0 334 61 | Program mix · 0 total | - | clean | 3/0/3/3/0 | VT-001 |
| donut | tile | narrow | 358×199.5 | 334×89 / vb 0 0 334 89 | Program mix · 107 total | - | clean | 3/3/3/3/3 | - |
| donut | strip | narrow | 358×215.5 | 334×105 / vb 0 0 334 105 | (marks only — see counts/table) | - | clean | 0/3/3/3/3 | VT-008 |
| donut | panel | narrow | 358×263.5 | 334×153 / vb 0 0 334 153 | compact key: 0,1,2,3,4,5,6,7 | key:0,1,2,3,4,5,6,7 | TEXT_MARK_OVERLAP x3 | 0/3/3/3/3 | VT-003,VT-008 |
| donut | canvas | narrow | 358×327.5 | 334×217 / vb 0 0 334 217 | legend: 0,1,2,3,4,5,6,Other | legend:0,1,2,3,4,5,6,Other | clean | 0/3/3/3/3 | VT-003,VT-008 |
| donut | stage | narrow | 358×391.5 | 334×281 / vb 0 0 334 281 | legend: 0,1,2,3,4,5,6,Other | legend:0,1,2,3,4,5,6,Other | clean | 0/3/3/3/3 | VT-003,VT-008 |
| kpi | micro | narrow | 358×171.5 | 334×61 / vb 0 0 334 61 | Readiness · 74 % target 75 status positive | - | clean | 3/3/3/3/3 | - |
| kpi | tile | narrow | 358×199.5 | 334×89 / vb 0 0 334 89 | Readiness · 74 % +3 (71) target 75 status positive | - | clean | 3/3/3/3/3 | - |
| kpi | strip | narrow | 358×215.5 | 334×105 / vb 0 0 334 105 | Readiness · 74 % +3 (71) target 75 status positive | - | clean | 3/3/3/3/3 | - |
| kpi | panel | narrow | 358×263.5 | 334×153 / vb 0 0 334 153 | Readiness · 74 % +3 (71) target 75 status positive | - | TEXT_MARK_OVERLAP x1 | 3/3/3/3/3 | - |
| kpi | canvas | narrow | 358×327.5 | 334×217 / vb 0 0 334 217 | Readiness · 74 % +3 (71) target 75 status positive | - | TEXT_MARK_OVERLAP x1 | 3/3/3/3/3 | - |
| kpi | stage | narrow | 358×391.5 | 334×281 / vb 0 0 334 281 | Readiness · 74 % +3 (71) target 75 status positive | - | TEXT_OVERLAP x3; TEXT_MARK_OVERLAP x2 | 3/3/3/3/3 | - |
| progress | micro | narrow | 358×171.5 | 334×61 / vb 0 0 334 61 | progress 74% (radial) | - | clean | 3/3/3/3/3 | - |
| progress | tile | narrow | 358×199.5 | 334×89 / vb 0 0 334 89 | Readiness · 74 % target 100 status positive remaining 26 | - | clean | 3/3/3/3/3 | - |
| progress | strip | narrow | 358×215.5 | 334×105 / vb 0 0 334 105 | Readiness · 74 % target 100 status positive remaining 26 | - | clean | 3/3/3/3/3 | - |
| progress | panel | narrow | 358×263.5 | 334×153 / vb 0 0 334 153 | Readiness · 74 % target 100 status positive remaining 26 | - | clean | 3/3/3/3/3 | - |
| progress | canvas | narrow | 358×327.5 | 334×217 / vb 0 0 334 217 | Readiness · 74 % target 100 status positive remaining 26 | - | clean | 3/3/3/3/3 | - |
| progress | stage | narrow | 358×391.5 | 334×281 / vb 0 0 334 281 | Readiness · 74 % target 100 status positive remaining 26 | - | clean | 3/3/3/3/3 | - |
| heatmap | micro | narrow | 358×171.5 | 334×61 / vb 0 0 334 61 | Maintenance · 6 / Inspection · 8 | - | clean | 3/3/1/3/3 | VT-009 |
| heatmap | tile | narrow | 358×199.5 | 334×89 / vb 0 0 334 89 | Maintenance · 6 / Inspection · 8 | - | clean | 3/3/1/3/3 | VT-009 |
| heatmap | strip | narrow | 358×215.5 | 334×105 / vb 0 0 334 105 | (marks only — see counts/table) | - | clean | 3/3/0/3/3 | VT-004 |
| heatmap | panel | narrow | 358×263.5 | 334×153 / vb 0 0 334 153 | y-axis: Maintenance,Inspection | - | clean | 3/3/0/3/3 | VT-004 |
| heatmap | canvas | narrow | 358×327.5 | 334×217 / vb 0 0 334 217 | legend: Low(−2),·,·,·,High(18) | legend:Low,,,,High | **TEXT_OVERLAP x3 (x-axis date ticks)** | 3/3/0/0/3 | VT-004,VT-007 |
| heatmap | stage | narrow | 358×391.5 | 334×281 / vb 0 0 334 281 | legend: Low(−2),·,·,·,High(18) | legend:Low,,,,High | **TEXT_OVERLAP x3 (x-axis date ticks)** | 3/3/0/0/3 | VT-004,VT-007 |
| funnel | micro | narrow | 358×171.5 | 334×61 / vb 0 0 334 61 | Readiness pipeline · 12 | - | clean | 3/1/3/3/3 | VT-002 |
| funnel | tile | narrow | 358×199.5 | 334×89 / vb 0 0 334 89 | Overall conversion: 12% | - | clean | 3/3/3/3/3 | - |
| funnel | strip | narrow | 358×215.5 | 334×105 / vb 0 0 334 105 | 0: value 100 / 1: value 76 / 2: value 54 / 3: value 31 / 4: value 12 | - | TEXT_MARK_OVERLAP x4 | 1/3/3/3/3 | VT-003 |
| funnel | panel | narrow | 358×263.5 | 334×153 / vb 0 0 334 153 | 0: value 100 / 1: value 76 / 2: value 54 / 3: value 31 / 4: value 12 | - | TEXT_MARK_OVERLAP x7 | 1/3/3/3/3 | VT-003 |
| funnel | canvas | narrow | 358×327.5 | 334×217 / vb 0 0 334 217 | 0…4 value+drop-off (24/29/43/61%) | - | TEXT_MARK_OVERLAP x6 | 1/3/3/3/3 | VT-003 |
| funnel | stage | narrow | 358×391.5 | 334×281 / vb 0 0 334 281 | 0…4 value+share+conversion+drop-off | - | TEXT_OVERLAP x1; TEXT_MARK_OVERLAP x6 | 1/3/3/3/3 | VT-003 |

**A geometry signal checked and deliberately not turned into an issue**: `svg.getBBox()` fell
outside the declared `viewBox` (by up to ~8px, always at the top edge, `dyMin≈8.11` for Panel/
Canvas/Stage of every line-shaped family) for roughly half the cards. I traced this rather than
reporting "clean" without a reason: `.gx-chart__svg { overflow: visible }` (chart.css:66), so this
content is not clipped by the SVG itself, and `.family-matrix__card { overflow: hidden }`
(family-matrix.css:135) is the actual clip boundary — and the same `outOfCard` check (measured
against the *card's* rect, with 8px epsilon) reports zero violations for every one of these cards.
The 8px is the y-axis top tick label's own text height poking slightly above the plot's local
`y=0` inside the frame's own padding band, not a clipping defect. This is stated once here rather
than repeated as a caveat in every affected row.

## Forced colors (Windows high-contrast emulation)

Sampled Micro/Strip/Stage × all 10 types at desktop (30/30 per the required-work table), computing
**every** SVG mark's resolved `fill` (not truncated). Full data:
`/tmp/defence-charts-CR-VT01/raw/forced-colors.json`; full-page screenshot:
`/tmp/defence-charts-CR-VT01/forced-colors/_fullpage.png`.

- line/area/bar/timebar/scatter: `forced-color-adjust: preserve-parent-color` is set (confirmed via
  computed style) and each of the 6 series keeps its own real colour
  (`rgb(141,211,199)/rgb(242,142,123)/rgb(126,182,217)/rgb(185,167,217)/rgb(242,189,117)/
  rgb(168,201,111)`) rather than collapsing to system colours. **No new failure under
  forced-colors** for these five families beyond what's already reported for the same cards under
  normal rendering (VT-005/VT-006).
- kpi/progress: colour is preserved the same way; no new failure.
- donut/funnel: `distinctFillCount` is **1** across every value mark (donut: `rgb(141,211,199)` for
  all 7 non-Other arcs; funnel: `rgb(141,211,199)` for all 5 stages). For funnel this matches the
  same-colour-by-design pattern already true under normal rendering (see VT-008's note on why
  funnel's monochrome stages are *not* flagged as a defect). For donut, this is the **same root
  cause as VT-008** (arcs never vary colour by slice, in any theme, forced-colors or not) rather
  than a forced-colors-specific regression — confirmed by measuring the identical
  one-fill-per-non-Other-arc result in the plain dark-theme and light-theme runs first. No
  additional forced-colors-only issue is filed; VT-008 already covers all three colour modes.
- heatmap: intensity is carried by `fill-opacity`, not `fill`, and `fill-opacity` survives
  forced-colors (the two colours seen, `rgb(0,0,0)` and `rgba(0,0,0,0)`, are the base `currentColor`
  and the missing-cell's transparent fill — the opacity ramp riding on top of `rgb(0,0,0)` is not
  visible in a same-fill-different-opacity dump the way donut's problem is). VT-004 (negative vs.
  zero) was independently re-confirmed to persist under forced colors using the same
  computed-style method as the dark/light theme checks (see VT-004's evidence).

No forced-colors failure required expansion to all six rungs for any family, per the brief's
escalation rule — every forced-colors observation above traces to an issue already confirmed at
every rung under normal rendering.

## Light theme

Full 60-card desktop sweep, diffed field-by-field (geometry, `valueTexts`, all family-specific
counts) against the matching dark-theme run — **zero fields differed** except colour tokens
themselves (not measured as text/geometry). Every issue in the register below was independently
re-confirmed present, unchanged, in light theme via a second `getComputedStyle` pass (documented per
issue). Screenshot: `/tmp/defence-charts-CR-VT01/light/_fullpage.png`.

## Issue register

Severity: any `0` in the I/V/S/R/A scoring is P1 per the brief; a repeated `1` across a family/rung
pattern is at least P1. All nine confirmed issues below are P1 by that rule; two additional P2/P3
observations are included for completeness but are explicitly flagged as lower-confidence/design
questions rather than confirmed defects.

| ID | Priority | Type/rung/viewport | Evidence | Observation | Data/meaning lost | Reproduction | Proposed direction |
|---|---|---|---|---|---|---|---|
| VT-001 | P1 | donut · micro · both viewports, both themes | `/tmp/defence-charts-CR-VT01/raw/desktop-narrow.json` (donut-micro rows); DOM dump in this session's transcript showing `<tspan class="gx-value__metric">0</tspan><tspan class="gx-value__unit"> total</tspan>` | Compact value reads **"Program mix · 0 total"**. Fixture total is 107 (`40+24+16+10+6+4+3+2+1+1`). Renderer defect: `packages/core/src/frame.ts` `seriesFrame()` only builds `arcs` when `mark.kind==='arc'` (~L1196); at Micro, donut's `mark.kind` is `'none'`, so `arcs=[]`; `fitValueDisplay()`'s `'donut-total'` mode (selected whenever `plan.type==='donut'`, ~L1012) sums that empty array. | A viewer sees a specific, confident, *wrong* number (0 instead of 107) — worse than showing nothing. `aria-label="Program mix 0 total"` carries the same error, so the non-visual channel is equally wrong. | `[data-family-case="donut-micro"]`, desktop 1440×1100 and narrow 390×844, dark (`neutral`) and light (`neutral-light`) — confirmed identical text in all four combinations. Chromium 151.0.7922.34. | Source-contract mismatch / renderer defect in `packages/core`. Proposal: compute the donut aggregate total independent of whether arc *geometry* was built for the rung (e.g. sum the raw series values directly for `plan.type==='donut'` rather than deriving from `SeriesFrame.arcs`). Also note: **`scripts/check-family-matrix.mjs`'s own donut assertion block is wrapped in `card.type==='donut' && card.rung!=='micro'`** (~L184), so its inner `rung==='micro'\|\|rung==='tile'` check for `"107 total"` can never fire for Micro — this is why the automated gate stays green through this bug; Codex should widen that gate's scope, not just fix the renderer. Regression proof: a `frame.test.ts`/donut-planner test asserting Micro's `ValueFrame` entry text equals the true sum, plus the widened gate assertion above. |
| VT-002 | P1 | funnel · micro · both viewports, both themes | Same raw JSON; `.gx-value` text "Readiness pipeline · 12"; contrasted with funnel-**tile**'s dedicated `[data-funnel-part="summary"]` text "Overall conversion: 12%" (`data-funnel-overall-conversion="0.12"`) | Funnel Micro shows a bare, unlabelled **12** — the last stage's raw count, via the generic "latest point" `ValueDisplay` path (funnel isn't special-cased the way donut's `'donut-total'` mode is) — while Tile, one rung larger, already has a purpose-built, correctly-worded summary for the exact same number. | The number itself is numerically correct (fixture's last stage is 12) but has no unit, no "of 100," no "%" — a reader cannot tell it's a conversion metric rather than a raw count or a stage index, and cannot recover the 100→12 scale from Micro alone. | `[data-family-case="funnel-micro"]`, both viewports/themes. | Renderer defect (inconsistent family-specific compact semantics — not a fixture problem, the value is arithmetically right). Proposal: reuse Tile's "Overall conversion: N%" computation for Micro (it's short enough to fit an even smaller band) instead of falling through to the generic latest-point value path in `fitValueDisplay()`. Regression proof: assert Micro's compact text contains "conversion" (or matches Tile's), analogous to the existing "funnel Tile summary missing" check in `check-family-matrix.mjs`. |
| VT-003 | P1 | donut panel/canvas/stage; funnel strip/panel/canvas/stage; both viewports, both themes | donut-panel compact key "0,1,2,3,4,5,6,7,+2"; donut-canvas/stage legend "0,1,2,3,4,5,6,Other"; funnel strip/panel/canvas/stage in-mark labels "0: value 100", "1: value 76", … Screenshots: `desktop/donut-panel.png`, `desktop/donut-canvas.png`, `desktop/funnel-panel.png` | Every donut slice and funnel stage label is its **raw point index** (or `formatXLabel(x)`), not a category/stage name. Traced to source: `packages/core/src/data.ts`'s `DataPoint` type is `{x, y}` only — there is **no per-point category/label field anywhere in the canonical data model**; `Series.label` is one label per whole series. `donutArcs()`/`funnelFrame()` in `frame.ts` fall back to formatting `point.x`, and the fixture (`DONUT_MATRIX_DATA`/`FUNNEL_MATRIX_DATA` in `matrix.ts`) uses plain sequential `x: 0..9`/`0..4` with nothing else to format. | Order, relative size, and (at Canvas/Stage) exact value/percent are all recoverable; **what each category or stage actually represents is not recoverable from the chart at all** — "slice 3," "stage 1" carry zero domain meaning. | `[data-family-case="donut-panel\|donut-canvas\|donut-stage"]` and `[data-family-case="funnel-strip\|funnel-panel\|funnel-canvas\|funnel-stage"]`, both viewports/themes. | Source-contract mismatch (data-model gap, not a simple renderer bug). Proposal, explicitly for coordinator/product judgment, two options: (a) add an optional per-point `category`/`label` field to `DataPoint` (or a parallel `categories` array on `Series`) so donut/funnel and any future multi-category family can carry real names — this changes a `packages/core` public type and belongs with CR-D01/CR-D02, not a silent patch here; (b) fixture-only interim mitigation — give the matrix fixture more legible `x` values. This is **not** something to fix by editing the renderer's fallback formatting alone; the data simply has nowhere to put a real name today. No regression test is proposed until a data-model direction is chosen. |
| VT-004 | P1 | heatmap strip/panel/canvas/stage, both viewports, both themes | Direct computed-style dump (`getComputedStyle(cell).fill`/`fillOpacity`) for `heatmap-panel`/`heatmap-strip`: Maintenance-row index 0 (value **0**) and index 4 (value **−2**) both carry `data-heatmap-intensity="0"` and **identical** resolved fill (dark: `rgb(196,196,196)` both; light: `rgb(63,63,63)` / `fill-opacity: 0.1` both — re-checked independently in light theme). Screenshots: `desktop/heatmap-panel.png`, `desktop/heatmap-canvas.png` | A negative reading (−2) and a true-zero reading (0) render **pixel-identically**. Root cause: `frame.ts`'s heatmap intensity bucketing linearly quantizes the *combined* value extent (here min=−2, max=18, 5 buckets ⇒ bucket width 4) into 5 discrete steps; any value within one bucket-width of the minimum lands in bucket 0 regardless of sign. | The task brief's own stated requirement — "missing cells and negative values must not look like zero" — is directly violated for the one negative value the fixture contains. A viewer cannot tell "no activity" from "a deficit" anywhere on this heatmap; only the always-present data table preserves the distinction. | `[data-family-case="heatmap-strip\|heatmap-panel\|heatmap-canvas\|heatmap-stage"]`, both viewports/themes. Reproduction script pattern: query `.gx-heatmap-cell[data-heatmap-intensity='0']`, compare `getComputedStyle(...).fill`/`fillOpacity` for the cell whose source value is 0 vs. the cell whose source value is −2. | Renderer defect. Proposal (design decision for Codex/coordinator, not picked here): give values ≤0 a qualitatively distinct treatment — a diverging two-hue scale, or a distinct stroke/hatch for negative cells — rather than one linear sequential ramp that can co-bucket a negative and a non-negative value. Regression proof: extend `packages/core/src/heatmap-frame.test.ts` to assert that a dataset containing both a zero and a negative value resolves to different `data-heatmap-intensity` (or whatever attribute replaces it). |
| VT-005 | P1 | line/area/bar/timebar/scatter · panel & canvas · both viewports | Geometry: 2 text/text overlaps at Panel and Canvas for all 5 line-shaped families (Charlie ends at 22, Foxtrot ends at 23 — 1 apart on a 0–40 axis). Screenshots: `desktop/line-panel.png`, `desktop/line-canvas.png`, `desktop/bar-panel.png`, `narrow/line-panel.png`, `narrow/bar-panel.png` (all show "Foxtrot"/"Charlie" fused into an unreadable glyph cluster) | Direct end-of-line/end-of-series labels have no collision avoidance; when two series' final values are close, their labels visually merge. | 4 of 6 series' identity labels stay legible; the 2 whose endpoints converge become unreadable as text (colour/position can still disambiguate with effort, but the text itself cannot be read). | `[data-family-case="{line\|area\|bar\|timebar\|scatter}-panel"]` and `...-canvas`, both viewports, dark and light theme (confirmed unchanged in light-theme diff). | Renderer/layout defect (no collision-avoidance pass on direct labels). Proposal: a small vertical-declutter pass on direct end labels within a size budget, or drop to the `+N`-style overflow marker already used for the value-display band when two labels would overlap. Regression proof: a fixture with two series whose last points are within one label-height of each other; assert rendered label rects don't overlap. |
| VT-006 | P1 | line/area/bar/timebar/scatter · stage · both viewports | Geometry: 11–17 text/text and 6–17 text/mark overlaps at Stage — more than Panel/Canvas despite Stage being the largest rung. Screenshot: `desktop/line-stage.png` (dense cluster of numbers/letters crossing the six intentionally-crossing series) | Stage's "values" legibility mode annotates multiple points per series directly on the plot with no collision avoidance; the fixture's deliberately-crossing 6-series data makes this collide heavily — worse at narrow (up to 15 overlaps) than at desktop. | Legend and axis remain usable as a fallback, but the in-plot value annotations — the thing Stage's extra space should enable — are *less* legible than at the smaller Panel/Canvas rungs. | `[data-family-case="{line\|area\|bar\|timebar\|scatter}-stage"]`, both viewports/themes. | Renderer/layout defect. Proposal: reduce directly-labelled points at Stage when density/crossing exceeds a threshold, or move dense value disclosure to hover/legend-only, consistent with this project's existing "conceal rather than overlap" pattern (donut's Other bucket, the value-display overflow marker). Regression proof: geometry test asserting no mutual label-rect overlap for the shipped 6-series crossing fixture at Stage. |
| VT-007 | P1 | heatmap · canvas & stage · **narrow only** | DOM: x-axis ticks "2026" (x=0) and "Jan 03" (x=29.63) are 29.63px apart tick-to-tick, in a `<g transform="translate(87.96, 243.22)">` band only 103.71px wide for 4 ticks; both labels are `text-anchor="middle"` and each is wider than the gap. Screenshot: `narrow/heatmap-stage.png`; markup: `narrow/heatmap-stage-svg.html` | At 390px width, tick-thinning drops from 8 to 4 date ticks, but the **first** tick switches to a year-only format ("2026") that is not meaningfully narrower than its neighbour's "Jan 03" — so even after thinning, the two nearest labels still collide. Not reproduced at desktop (1440px). | Row identity (Maintenance/Inspection) and cell colour remain readable; the exact date of a column near the left edge cannot be reliably read at narrow width. | `[data-family-case="heatmap-canvas\|heatmap-stage"]`, narrow viewport (390×844) only, both themes. | Renderer/layout defect, narrow-width-specific. Proposal: use a consistent "Jan 01"-style format for the first tick at narrow widths instead of switching to year-only, or reduce to 3 ticks below a width threshold. Regression proof: extend `check-family-matrix.mjs`'s narrow-viewport pass with an adjacent-axis-tick-label overlap check, mirroring its existing summary-overlap check. |
| VT-008 | P1 | donut · strip/panel/canvas/stage · both viewports, both themes | Computed style: every non-Other `.gx-arc`'s resolved `fill` is identical across all 7 value slices in every theme (dark `rgb(141,211,199)`, light `rgb(0,105,92)`); `.gx-legend__item` swatches at Canvas/Stage are likewise uniform (`rgb(8,73,98)`). Meanwhile `.gx-compact-key__swatch` at **Panel** cycles 6 different hues via `data-series-index`. Screenshots: `desktop/donut-canvas.png` (uniform ring **and** uniform legend dots), `desktop/donut-panel.png` (multi-coloured key over a uniform ring) | Donut arcs never vary fill colour by slice, in any theme or rung. Traced to source: `packages/primitives/src/chart.css`'s `.gx-arc { fill: var(--gx-series-color) }` resolves `--gx-series-color` from the ancestor `.gx-series[data-series-index]` group — always index 0 for a donut's single series — and there is **no `[data-slice-index]`-keyed colour rule for `.gx-arc`** anywhere in `chart.css`, even though `Legend.tsx` already emits `data-slice-index` per legend row. Compounding this, `CompactSeriesKey.tsx`'s Panel-rung swatch independently cycles `data-series-index` 0–5 through the six-series palette **using the slice position as if it were a series index** — producing a coloured key that corresponds to nothing in the actual (monochrome) mark. | Colour cannot be used to match any legend/key row to its wedge, at any rung. Worse than "no colour coding": the Panel compact key actively implies colour-coded categories that the ring does not have. | `[data-family-case="donut-strip\|donut-panel\|donut-canvas\|donut-stage"]`, both viewports, dark and light theme (re-confirmed via a second computed-style pass after toggling `[data-family-theme-toggle]`). | CSS/attribute-wiring defect (renderer). Proposal: add `.gx-arc[data-slice-index='0'..'5']` colour rules mirroring the existing `[data-series-index]` pattern (the arc's own `<path>` in `renderer.tsx` already has a stable per-slice index available via `ArcFrame`/`index`, it is just not emitted as a `data-*` attribute the way `Legend.tsx`'s row is), and make the Panel compact key read the **same** per-slice colour source rather than independently cycling by position. Regression proof: a static-render test asserting N distinct `.gx-arc` fill values for an N-category donut, plus a cross-check that compact-key/legend swatch colour for slice *i* equals arc *i*'s own colour. |
| VT-009 | P2 (rubric mechanics score it P1 via the repeated-`1` rule; flagged lower-confidence than VT-001–008 since it is a product/design-tradeoff question, not an unambiguous defect) | heatmap · micro/tile · both viewports, both themes | `valueTexts`: "Maintenance · 6 / Inspection · 8" (the shared "latest value" convention); no cells drawn (`mark='none'`) | Micro/Tile intentionally reduce information for every family — this is by design. Heatmap is flagged separately because its reduced rungs can hide an *anomaly* (a missing day, a negative reading) rather than merely aggregate a trend the way line/bar's reduction does. | The two "latest" numbers shown are accurate; nothing on-chart hints that the 8-day window behind them contains a gap and a negative reading — only the always-present data table preserves that. | `[data-family-case="heatmap-micro\|heatmap-tile"]`, both viewports/themes. | Product proposal, explicitly lower-confidence: consider a small anomaly qualifier on the compact value when the in-window series contains a missing or negative point (parallel to the `+N` "occluded" marker pattern already used elsewhere). Not proposing a specific mechanism — this is a design question for Codex/coordinator, not a clear-cut bug. |
| VT-010 | P2 (proposal, not a confirmed defect) | heatmap · canvas & stage · both viewports | DOM: `.gx-legend__item[data-heatmap-intensity="1"\|"2"\|"3"]` all render `<span class="gx-legend__label"></span>` empty; only intensity 0 ("Low", "−2") and 4 ("High", "18") carry text | Only the two endpoints of the 5-step intensity legend are labelled; the 3 middle steps have no label or value text at all. This is a common convention for continuous gradient legends and may be intentional. | A viewer can bound the range (−2 to 18) but cannot read the value/label of any of the 3 intermediate shades. | `[data-family-case="heatmap-canvas\|heatmap-stage"]`. | Flagged as a clarity question, not a defect: either leave as-is (defensible convention) or add range text to the 3 middle steps for consistency with this library's otherwise explicit, tokenised labelling. |
| VT-011 | P3 (consistency question) | bar/timebar/scatter · strip · both viewports | `compactKeyEntries` populated for `line-strip`/`area-strip`, empty for `bar-strip`/`timebar-strip`/`scatter-strip` | Line/area get an on-chart compact key at Strip; bar/timebar/scatter do not, at the same rung with the same 6-series fixture. | Not a clear loss — bars/points are already spatially separated by category/x-position and colour, unlike overlapping lines, so the asymmetry may be intentional (lines need the extra aid, discrete marks don't). | `[data-family-case="{bar\|timebar\|scatter}-strip"]` vs. `{line\|area}-strip`. | Consistency question for Codex, not a proposed fix — likely correct as-is. |

## Alternatives

1. Full screenshot-only review — rejected: would have missed VT-001/VT-004/VT-008, all of which have
   clean or near-clean geometry and are only visible via computed style/DOM values, not pixels alone.
2. DOM-only review — rejected: VT-005/VT-006/VT-007's severity (which labels collide, by how much,
   whether it gets worse at narrow) needed the paired screenshot to judge legibility, not just an
   overlap boolean.
3. Combined DOM/computed-style metrics + targeted screenshots for every non-clean card — selected,
   as directed by the brief; this is what produced reproducible-but-compact evidence for all 9
   issues.

## Recommendation and confidence

Two structurally different problems surfaced, and I'd sequence them differently:

- **VT-001, VT-002, VT-004, VT-008** are outright-wrong or non-functional visual claims (a fabricated
  "0 total," an under-contextualised raw number, a negative value that reads as zero, a legend that
  implies colour-coding that doesn't exist). These directly contradict this project's own stated
  design intent (frame.ts's own comment: *"Keep the qualifier visible so a number such as `1` cannot
  masquerade as the whole donut"* — the exact failure mode VT-001 reproduces, just with `0` instead
  of `1`, at the one rung that comment doesn't cover). **High confidence, core/primitives fix
  candidates**, per the "core issue first" framing already in this report's own prior version.
- **VT-005, VT-006, VT-007** are collision/legibility problems with a common shape (no
  collision-avoidance on text placed by the planner) affecting five families identically. **High
  confidence**, likely a shared layout fix rather than five per-family fixes.
- **VT-003** is a data-model gap, not a bug in the traditional sense — the current `DataPoint` type
  cannot express what VT-003 is asking for. **High confidence on the diagnosis, no confidence
  imposed on the fix** — that's a product/architecture decision outside this task's scope.
- **VT-009, VT-010, VT-011** are lower-confidence design questions, included for completeness per the
  brief's "don't silently pick, put proposals in the register" instruction, not asserted as clear
  defects.

## Conflicts with locked/current decisions

None asserted. VT-003's proposed direction (a) — a `DataPoint` category field — would touch a
`packages/core` public type and should be evaluated against `research/00-decisions.md` decision 8
("`ChartPlan` is a plain serialisable object... The resolver runs identically on server or client")
and decision 10 (no DOM measurement in the resolver) before being accepted; nothing here overrides
either, but a coordinator reviewing VT-003 should re-read both, since adding a category string is
adjacent to — though not the same as — the plan-purity boundary those decisions establish.

## Unknowns

- Font rendering on this machine (macOS 26.6.2, this Chromium build's bundled fonts) was not
  cross-checked against Windows/Segoe UI Variable or another browser engine; label-width-driven
  collisions (VT-005/VT-006/VT-007) could shift by a few px on a different font stack, though the
  underlying lack of a collision-avoidance mechanism (the actual defect) would not.
- Whether any other family-specific SVG mark is visually present but semantically unlabelled beyond
  what VT-003/VT-008 found — I checked every family's specific counts/attributes listed in the brief,
  but a defect outside that enumerated list could exist unseen.
- Whether narrow-width label collisions exist for chart types/rungs I didn't screenshot-verify beyond
  the geometry check (the raw JSON covers all 120 cards; only the non-"clean" ones got a follow-up
  screenshot, per the brief's "only when an issue is found" instruction).
- Reduced-motion was set for every pass; a separate *default* (motion-enabled) pass was not sampled,
  since the brief asks for reduced motion "for repeatability" rather than as its own axis — transient
  in-flight animation frames were therefore not inspected as a possible source of temporary visual
  confusion.

## Affected contracts, files, tests, and docs

- `packages/core/src/frame.ts` — VT-001 (`fitValueDisplay`'s `'donut-total'` mode / `seriesFrame`'s
  `arcs` gating), VT-002 (funnel Micro's compact-value mode selection), VT-004 (heatmap intensity
  bucketing), VT-003 (donut/funnel label fallback — downstream of the `data.ts` gap).
- `packages/core/src/data.ts` — VT-003's root cause (`DataPoint` has no per-point category field).
- `packages/primitives/src/chart.css` — VT-008 (`.gx-arc` has no `[data-slice-index]` colour rule).
- `packages/primitives/src/CompactSeriesKey.tsx` / `Legend.tsx` — VT-008 (mismatched colour source
  between Panel's compact key and Canvas/Stage's legend).
- Layout/collision logic for direct/value labels (exact file not identified from the outside — likely
  in `packages/core/src/frame.ts`'s label-placement code or a `packages/primitives` label component) —
  VT-005, VT-006.
- Narrow-width axis tick formatting/thinning (likely `packages/core/src/frame.ts` or an axis-specific
  module) — VT-007.
- `scripts/check-family-matrix.mjs` — its donut assertion block's `rung!=='micro'` guard (~L184) is
  why VT-001 ships un-caught; Codex should widen this alongside any renderer fix.
- `apps/playground/src/family-matrix/matrix.ts` — VT-003's fixture-side interim-mitigation option.

## Implementation acceptance checklist (for whichever issues the coordinator promotes)

- [ ] VT-001: Micro-rung donut compact value equals the true sum of all point values, for a fixture
      with any mark-kind at Micro (not just when arcs happen to be built).
- [ ] VT-002: Micro-rung funnel compact value carries the same "conversion" framing Tile already has.
- [ ] VT-004: a fixture containing both a zero and a negative value resolves to visually distinct
      heatmap cell treatments.
- [ ] VT-005/VT-006: a fixture with converging/crossing series produces no overlapping direct labels
      at any of Panel/Canvas/Stage, at both viewports.
- [ ] VT-007: adjacent x-axis date tick labels never overlap at 390px width.
- [ ] VT-008: an N-category donut resolves to N distinct arc fill colours, and the Panel compact key's
      colours match the arcs' colours slice-for-slice.
- [ ] `scripts/check-family-matrix.mjs`'s donut assertion block covers Micro, not just Tile+.
- [ ] VT-003: tracked separately as a data-model decision (CR-D01/CR-D02-adjacent), not bundled into
      the same PR as the above CSS/frame fixes.

## Proposed promotion

**Implementation task required.** Promote VT-001, VT-002, VT-004, VT-005, VT-006, VT-007, VT-008 as
confirmed, reproducible P1 defects with root cause identified and a proposed direction for Codex to
evaluate. Promote VT-003 as a **data-model decision** for the coordinator (not a same-shape
implementation ticket as the others — it needs a `packages/core` type decision first). VT-009,
VT-010, VT-011 are included as lower-confidence proposals only; do not treat them as confirmed
defects without further product judgment. Not a blocker on the existing green automated gate (which
correctly does not claim to cover any of this), but I'd flag VT-001/VT-004/VT-008 to the coordinator
as the highest priority of the seven, since they produce actively wrong or non-functional visual
claims rather than merely dense/cluttered-but-correct ones.
