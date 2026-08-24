# CR-I01 (part of ledger R3) — Shared tooltip/crosshair/legend interaction contract

Status: proposal for coordinator review
Date/access window: 2026-08-24, single session, repository-only (this task draws its evidence from
`research/83-visual-interaction-architecture.md`'s already-cited primary sources — Radix, Floating UI,
Recharts, WAI-ARIA — rather than re-fetching them; see Retrieval log)
Repository baseline: branch `Anti-gravity-and-other-Agent-changes`, at this task's own prior checkpoint

## Exact question and exclusions

Turn the existing interaction research (`83-visual-interaction-architecture.md` §8–11) into
evidence-bounded acceptance criteria for `I1` (basic interaction baseline) and `C3` (grid
keyboard/persistence), covering stable datum/series identity, tooltip/crosshair payload, legend state,
focus ownership, Escape/touch behavior, and overlay containment. Excluded, per the R3 brief and the
master plan's own scope reconciliation (`90-final-delivery-and-agent-plan.md` §3: *"Shared filters,
linked views, brush/zoom, and hosted persistence are v1.1 candidates"*): dashboard-level filter state,
filter bars, brush/zoom, and any host data/persistence concern. `83` §6–7 covers filter-bar behavior in
useful detail, but that material is v1.1-scoped, not `I1`-scoped, and this report does not promote it
into `I1`'s acceptance criteria.

## Current repository evidence

- `packages/core/src/data.ts:64` — `Series` already carries `readonly id: string` as its stable
  identity field, independent of array position. This is the anchor a tooltip/legend/crosshair
  identity model can be built on; it already exists and needs no new type.
- `packages/primitives/src/Chart.tsx:129-243` — the current renderer produces `<figure>` →
  `<svg role="graphics-document" aria-labelledby aria-describedby>` → `<figcaption>` (data table).
  This is a **static-only** render path: grep of `packages/react/src/AutoChart.tsx` for
  `interaction|tooltip|hover|pointer|keyboard|legend` returns zero matches. **No tooltip, crosshair,
  legend, or keyboard interaction code exists anywhere in the repository today.** `I1` starts from
  nothing, not from a partial implementation.
- `research/83-visual-interaction-architecture.md` §8–11 already specifies a serialisable
  `TooltipModel` type, a fixed/fluid placement algorithm, crosshair rules, and a legend placement
  table, each with cited precedent (Radix Tooltip's collision-boundary model, Floating UI's
  `shift`/`flip`/`autoPlacement`, Recharts' public Legend API, WAI-ARIA's tooltip pattern). This report
  does not re-derive that content; it packages it into `I1.1`–`I1.5` acceptance criteria and checks it
  against current code and the locked scope boundary.
- `packages/grid/src/index.ts` docblock — already states the grid *"reports box size to a widget and
  never decides what the widget shows"*, which is the same ownership boundary `83` §14 draws for
  `@gx/grid` (*"must not import chart-type switches or inspect `ChartPlan.marks`"*). The two documents
  agree; this report treats that agreement as settled, not reopened.

## External evidence

All rows are as already cited and labeled in `83-visual-interaction-architecture.md` §18's source
ledger; this task did not re-fetch them, so they are carried here as **Primary research (cited, not
independently re-verified this session)** rather than re-confirmed.

| Claim | Class | Source/version/date | What it supports | What it does not support |
|---|---|---|---|---|
| Tooltip needs a named collision boundary, not viewport-relative placement | Primary research (cited) | Radix Tooltip docs; Floating UI `usePosition`/`shift`/`flip`/`autoPlacement`/`size` docs, both linked from `83` §8 | The fixed/fluid placement algorithm's two-mode split | Neither source is chart-specific; the fixed-mode-at-small-size rule is this project's own synthesis, not something Radix/Floating UI state |
| Legend should separate item layout from position and support measured placement | Primary research (cited) | Recharts public Legend API docs, linked from `83` §10 | The "measure label width, choose left/right/bottom" rule | Does not establish Recharts' own accessibility behavior for legend toggles — that is a separate, unverified claim |
| Tooltip role pattern: focus stays on trigger, `role="tooltip"`, `aria-describedby` | Primary research (cited) | WAI-ARIA APG Tooltip Pattern, linked from `83` §8 and §13 | The "tooltip is not a focus trap" rule in the acceptance checklist below | Specification text only — no real assistive-technology behavior was observed for this report (see `CR-A11Y01`'s equivalent limitation) |

## Retrieval log

| Source sought | Result | Limitation |
|---|---|---|
| Radix Tooltip, Floating UI, Recharts Legend, WAI-ARIA Tooltip docs | Not re-fetched | Already cited with URLs in `83` §8/§10/§13; re-fetching would duplicate existing, correctly-labeled evidence rather than add new information. If the coordinator needs a freshness re-check, that is a bounded follow-up, not part of this pass |

## The interaction contract, scoped to I1

### Datum/series identity

Use `Series.id` (already in `data.ts`) as the sole key for color, legend toggle state, tooltip row
identity, and focus state. Never key on array index — a filtered or reordered series set (even though
filtering itself is out of `I1`'s scope) must not silently reassign color/focus to the wrong series if
a host later adds it. This is a now-cheap guarantee to make explicit before any interactive code
exists, not a retrofit.

### Tooltip payload (from `83` §8, unchanged, packaged as I1's contract)

The `TooltipModel` shape in `83` §8 — `open`, `mode: 'fixed' | 'fluid'`, `anchor`, `label`, `rows`,
`hiddenRowCount` — is serialisable and keys rows by `seriesId`, consistent with the identity rule
above. `mode` selection follows the family ladder: `fixed` for Strip/Panel, `fluid` for Canvas/Stage,
per `83` §8's placement algorithms and the size-tier matrix in `83` §6.

### Crosshair

Per `83` §9: clipped to the plot region, never crossing title/legend/footer; follows the x-bucket for
shared time-series tooltips and the mark for item-level tooltips; absent entirely at Micro (no
invisible pointer-event surface mounted where no interaction is offered).

### Legend

Per `83` §10: `absent | direct | internal | external` as states, chosen by measured fit, not a fixed
global position. Interactive toggle uses `aria-pressed`, keeps hidden series visible in the legend
(not removed), and **must not** rewrite dashboard filter state when toggled — series-visibility
toggling is local ephemeral UI state, filter state is out of scope entirely for `I1`.

### Focus, Escape, and touch

- Keyboard: focus reaches the chart or an explicit interaction control; arrow keys move the active
  data index; Home/End jump to first/last; Escape closes a tooltip/detail state without moving focus
  unexpectedly (`83` §13).
- Touch: first tap opens/locks a tooltip, second tap or Escape closes it; no hover-only behavior is
  acceptable since it has no touch equivalent (`83` §8's content rules).
- A tooltip is never a focus trap: focus stays on the trigger/data point, per the WAI-ARIA tooltip
  pattern cited above.

### Overlay containment

Every overlay (tooltip, crosshair, legend disclosure) is positioned within the widget's own measured
box or a portal explicitly scoped to it — never the viewport by default. This is the same containment
principle `10-responsive-ladder.md` §1.1 states for the plan itself (*"the measured element's size must
be grid-determined, never content-determined"*); an overlay that escapes its widget's box on a
crowded dashboard is the same class of bug as a `ResizeObserver` loop, just visual instead of
computational.

## Alternatives

- **Adopt a DOM positioning library (Floating UI) as a `@gx/core` dependency now.** Rejected, per
  `83` §8 and its own §14 boundary: `@gx/core` stays DOM-free; a pure `placeTooltip()` function using
  measured rectangles is the first implementation, with an optional Floating UI adapter confined to
  `@gx/react` if the pure version proves insufficient.
- **Fold `83` §6–7's filter-bar matrix into `I1`'s acceptance criteria since it is already written and
  well-sourced.** Rejected: it is good research, but it is v1.1-scoped by the master plan's own
  reconciliation. Pulling it into `I1` would be exactly the "quietly turn proposals into product
  contracts" behavior `92-claude-research-workstream.md` §"Claude's lane" warns against.

## Recommendation and confidence

Adopt `83` §8–11 as `I1`'s interaction contract, with the identity rule above made explicit as a
zero-cost addition, and with filter-bar content explicitly excluded from `I1`'s scope.
**Confidence: high** for the scope boundary (directly derived from the master plan's own reconciled
scope, not a judgment call). **Confidence: medium** for the specific placement algorithms in `83` §8,
since they are this project's own synthesis of external tooltip-library patterns rather than a
chart-specific published result — they are a reasonable default, not a measured finding.

## Conflicts with locked/current decisions

None. This report narrows `83`'s already-broader research to `I1`'s actual scope; it does not
contradict `83` or any locked decision.

## Unknowns

- Whether the pure `placeTooltip()` function (fixed + fluid modes) can be fully specified without a
  working `AutoChart` fixture to test collision/clamping against — likely needs to be built and tested
  together, not designed in the abstract to full completion.
- Real touch-device behavior (tap-lock, second-tap-to-close) was not tested on a physical device or
  emulator in this pass; the rule above is transcribed from `83`'s research, not independently
  observed.

## Affected APIs, files, tests and docs

- `packages/core/src/*` — a pure tooltip-placement and legend-layout module, per `83` §14's
  `@gx/core` boundary (serialisable rectangles in, placement decision out; no DOM).
- `packages/react/src/*` — `ChartTooltip`/`ChartTooltipContent`, `ChartLegend`/`ChartLegendContent`,
  `ChartInteractionProvider`, pointer/keyboard state, per `83` §14's `@gx/react` boundary.
- `packages/primitives/src/Chart.tsx` — remains hook-free; interactive layers live in `@gx/react`,
  not here, preserving the RSC/zero-JS static path this task does not touch.
- Ledger tasks `I1.1`–`I1.5` should each cite the corresponding subsection of this report
  (`I1.1` datum identity → identity rule above; `I1.2` pure overlay placement → tooltip/crosshair
  sections; `I1.3` tooltip/crosshair layer → same; `I1.4` legends → legend section; `I1.5`
  keyboard/touch matrix → focus/Escape/touch section).

## Implementation acceptance checklist

- [ ] `I1.1` keys all interaction state (color, focus, tooltip row, legend toggle) by `Series.id`,
      never array index.
- [ ] `I1.2`'s pure placement function lives in `@gx/core` or a DOM-free module, takes only measured
      rectangles as input, and is unit-testable without a browser.
- [ ] `I1.3` implements both `fixed` (Strip/Panel) and `fluid` (Canvas/Stage) tooltip modes per the
      family ladder, not a single mode for all sizes.
- [ ] `I1.4` legend toggle uses `aria-pressed`, keeps hidden series visible, and does not write to any
      filter state (there is none in `I1`'s scope).
- [ ] `I1.5` covers arrow/Home/End/Escape keyboard behavior and tap-lock/second-tap touch behavior,
      with a browser-tier test (not just a unit test) given the pointer/keyboard interaction surface.
- [ ] No `I1` task introduces a dashboard filter bar, filter state type, or persistence adapter —
      confirm against `83` §6–7 explicitly before merging, since that research exists and reads as
      adjacent but is out of scope.
- [ ] Every overlay is contained to its widget's measured box (or an explicitly widget-scoped portal),
      verified the same way the plan-containment rule is tested (per `10-responsive-ladder.md` §1.1).

## Proposed promotion

**Clarification.** This report does not introduce new research; it scopes `83`'s existing interaction
research to `I1` and makes the datum-identity rule explicit. No document needs correction; `I1.1`–`I1.5`
should cite this report and `83` §8–11 together when work begins.
