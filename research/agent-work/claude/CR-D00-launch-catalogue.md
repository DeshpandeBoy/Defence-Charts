# CR-D00 (ledger R2) — Evidence-bounded launch catalogue

Status: proposal for coordinator review
Date/access window: 2026-08-24, single session, repository-only
Repository baseline: branch `Anti-gravity-and-other-Agent-changes`, commit `1064c99` (this task's own
prior checkpoint on the same branch)

## Exact question and exclusions

Define three explicit catalogues — Preview, Free v1, post-launch/Pro — and classify every intended
chart type as implemented, engineering pending, research-only, deferred, or external decision, using
current code/tests as primary evidence, so no D-track agent or public doc describes a planned family
as shipped. Excluded: producing new perceptual thresholds for any family (that is `CR-D10`–`CR-D15`'s
job); this task classifies and bounds, it does not research bar-chart minimum widths or similar.

## Current repository evidence

- `packages/core/src/plan.ts:59-69` — `ChartType` is already a ten-member union: `'line' | 'area' |
  'bar' | 'timebar' | 'donut' | 'scatter' | 'funnel' | 'kpi' | 'heatmap' | 'progress'`. The **type
  system** already models the full intended Free-v1 catalogue named in `90-final-delivery-and-agent-plan.md`.
  This is a real, checkable fact worth stating precisely: the type union being total does not mean any
  resolver logic exists for the nine non-line/area members.
- `packages/core/src/plan.ts:179-185` — the mark-geometry `kind` union has five members:
  `'none' | 'line' | 'horizon' | 'bar' | 'arc' | 'point' | 'cell'` (`'line'` and `'horizon'` share one
  ladder). `'bar'` carries `stacked`/`grouped` flags, `'arc'` carries a `donut` flag, `'cell'` carries
  band-start/end. There is **no mark kind yet for funnel, KPI, or progress** — those families will
  either reuse an existing kind (e.g., KPI/progress via `narrative.valueDisplay` plus `kind: 'none'`)
  or need a new kind added; this is real, unresolved design surface for `D3.1`/`D3.2`/`D6.1`, not
  settled by the current type file.
- `packages/core/src/plan-chart.ts:37,72-90` — `LINE_TYPES = new Set(['line', 'area'])`; any other
  `ChartType` throws `Only 'line' and 'area' resolve at A3.` **Zero resolver logic exists for the
  other eight types.**
- `packages/primitives/src/Chart.tsx:271-273` — the renderer throws for mark kinds `'bar' | 'arc' |
  'cell' | 'point'` with the message *"A4 renders 'line', 'horizon' and 'none' only; bar and arc land
  in D chart breadth."* **Zero renderer logic exists for the other mark kinds.**
- `docs/content/docs/roadmap.mdx` and `docs/content/docs/index.mdx` already separate "Implemented"
  (A1–A6, B1–B3, line/area only) from a "Planned" D row — this is accurate and does not overclaim.
- `research/40-chart-plan.md:255-258` and `packages/core/src/plan.ts:168-171` — **explicit,
  already-decided architecture**: *"There is no `sparkline` mark/kind... a sparkline is structurally a
  line with every axis off... an EMERGENT DESCRIPTION of a plan, not a field in it."* This is a settled
  design decision already in the type file's own comments, not an open question.
- `research/91-codex-build-workstream.md:346-390` (D1.1–D7.1) already specifies concrete, non-invented
  per-family acceptance requirements (data-shape validation, Micro→Stage ladder, empty/negative/dense
  cases, light/dark/forced-color, resize/containment, docs/API snapshot) plus one line of scope per
  family. This task does not re-invent that list; it cites it directly in the acceptance checklists
  below and adds only evidence-gap cross-references.

### A genuine catalogue-shape contradiction, not just a status gap

`docs/content/docs/roadmap.mdx:49` and `docs/content/docs/index.mdx:60` both list the planned D-track
catalogue as *"Bar, donut, KPI, scatter, heatmap, funnel, progress, **sparkline**"* — and
`research/30-implementation-plan.md:580` independently lists *"Funnel, progress, **sparkline**"* as
the sixth D-track priority group. All three treat `sparkline` as a distinct, nameable catalogue entry.
But `research/40-chart-plan.md` and `packages/core/src/plan.ts` — both authoritative, both already
written — say the opposite: **there is deliberately no `sparkline` type or mark kind**, ever, by
design; it is `type: 'line'` rendered with axes absent. A reader of the public roadmap page would
reasonably expect a future `type: 'sparkline'` to exist. It will not. This is not a staleness gap like
`CR-000`'s findings — it is three documents (two of them public-facing) asserting a catalogue shape
the architecture has already ruled out.

## External evidence

Not applicable — this task classifies existing repository artifacts against the existing research
corpus; it does not introduce new external claims. Any external evidence a specific family needs
(e.g., bar-geometry literature) belongs to that family's own `CR-D1x` task, not here.

| Claim | Class | Source/version/date | What it supports | What it does not support |
|---|---|---|---|---|
| — | — | — | — | — |

## Retrieval log

| Source sought | Result | Limitation |
|---|---|---|
| n/a — repository-internal classification task | n/a | — |

## The three catalogues

### Preview

Per `90-final-delivery-and-agent-plan.md` §1: current line/area, real 12-column grid, widget shell,
basic interaction, packed-package consumer proof. **Chart types: line and area only.** No other
`ChartType` member ships in Preview under any circumstance — `plan-chart.ts` throws for all of them
today, and nothing in the current ledger schedules a D-family to land before `E1` (Preview packaging).

### Free v1

Per `90-final-delivery-and-agent-plan.md` §1 and `92-claude-research-workstream.md`'s `CR-D00` brief:
**line, area, bar, timebar, donut, KPI, progress, scatter, heatmap, funnel** — seven family groups
(bar+timebar counted together per `D1.1`, KPI and progress counted separately per `D3.1`/`D3.2`). This
matches the `ChartType` union exactly, member for member, with one exception: the union has no
`'sparkline'` member and never will (see the contradiction above) — Free v1's catalogue is the ten
`ChartType` members, not the eight-or-nine-item lists currently printed in the three documents named
above.

Funnel is conditional: `91-codex-build-workstream.md`'s `D6.1` already states *"If research cannot
justify a reliable responsive contract, defer the family rather than shipping decorative geometry."*
This task does not pre-judge that outcome; it records that funnel's Free-v1 membership is contingent
on `CR-D15`, not settled.

### Post-launch / Pro candidates

Not enumerated by any current document with the same rigor as Free v1's list. The only concrete
signal is `60-commercial-model.md:112-113`'s *"intended Free baseline"* framing, which implies
everything in Free v1's catalogue above is explicitly **not** Pro-gated by current commercial
intent — Pro's value-add is described there as export, high-volume rendering, premium themes, and
composition helpers, not additional chart types. **This task does not invent a Pro-chart-type list**;
none currently exists in evidence, and inventing one would violate the "no invented research results"
acceptance criterion. If the coordinator wants a Pro chart-type candidate list, that is a new,
separate research question, not a gap this task can responsibly fill.

## Type-by-type disposition

| `ChartType` | Class | Evidence | Free-v1 status |
|---|---|---|---|
| `line` | Implemented | `plan-chart.ts` `LINE_TYPES`; six rungs closed per `30-implementation-plan.md` A3 | Ships in Preview and Free v1 |
| `area` | Implemented | Same as `line`; shares the ladder, differs by `marks.primary.area` | Ships in Preview and Free v1 |
| `bar` | Engineering pending | Type-modeled (`ChartType` member, `kind: 'bar'` with `stacked`/`grouped`) but `plan-chart.ts` throws; renderer throws | `D1.1`, blocked on `CR-D10` bar-geometry evidence per `91-codex-build-workstream.md:349` |
| `timebar` | Engineering pending | Same union member class as `bar`; no separate mark kind — presumed to reuse `kind: 'bar'` with a temporal x-scale, not independently confirmed in code | Bundled into `D1.1` per the ledger's own deliverable naming ("Bar/timebar family") |
| `donut` | Engineering pending | Type-modeled (`kind: 'arc'`, `donut` flag) but no resolver/renderer logic | `D2.1`, needs `CR-D11` aggregation/label evidence |
| `kpi` | Engineering pending | `ChartType` member exists; no dedicated mark `kind` yet — likely composes from `narrative.valueDisplay` + `kind: 'none'`, unconfirmed | `D3.1`, needs `CR-D12` semantics (value/unit/delta/target) |
| `progress` | Engineering pending | Same class as `kpi`; no dedicated mark kind confirmed | `D3.2`, needs `CR-D12` |
| `scatter` | Engineering pending | Type-modeled (`kind: 'point'`) but no resolver/renderer logic | `D4.1`, needs `CR-D13` point-budget/hit-testing evidence |
| `heatmap` | Engineering pending | Type-modeled (`kind: 'cell'`, band-start/end) but no resolver/renderer logic | `D5.1`, needs `CR-D14` cell-size evidence |
| `funnel` | Research-only proposal / conditional | `ChartType` member exists; no mark kind; `91-codex-build-workstream.md` explicitly allows deferral | `D6.1`, contingent on `CR-D15`; do not presume it ships |
| `sparkline` | **Catalogue-shape error — not a `ChartType` and never will be** | `40-chart-plan.md:255-258`, `plan.ts:168-171` explicitly rule it out as an emergent rendering of `line`, not a type | Remove from `roadmap.mdx`, `index.mdx`, and `30-implementation-plan.md`'s D-track lists, or reword as "sparkline rendering of `line`" if the intent is to advertise the capability without implying a distinct type |
| `pie` | Not a type by design | `plan.ts:64-65`: *"`'pie'` is deliberately absent. It is a presentation variant of `'donut'`... one token... at `0`."* | Already correctly absent from every catalogue list checked; no action needed |

## Required shared family acceptance matrix

`D0.2` (`91-codex-build-workstream.md:321-327`) already specifies this exactly: one reusable matrix
covering Micro→Stage, themes/forced-colors, normal/empty/error, accessibility, resize boundaries, and
plan metadata, proven on line/area before any D agent starts. This task does not redefine that matrix;
it confirms no D-family should begin before `D0.2` exists and is proven, and notes that `D1.1`'s own
per-family requirements list (`91-codex-build-workstream.md:333-344`) is the correct baseline every
family task should be checked against — this task adds no new items to it.

## Alternatives

- **Treat the eight/nine-item public lists (with `sparkline`) as correct and file the contradiction
  against `40-chart-plan.md`/`plan.ts` instead.** Rejected: those two files carry an explicit,
  reasoned ⚠ decision with a stated mechanism (line + axes-off is structurally a sparkline; adding a
  redundant field is "a bug surface, not a feature"). The public docs are the newer-looking but
  less-considered artifacts here; the architecture should not be reopened to match three lists that
  never explain why a ninth type is needed.
- **Leave the Pro/post-launch catalogue unenumerated rather than stating "none currently defined."**
  Rejected: silence would read as an oversight in this report rather than the actual state of the
  evidence; stating it explicitly lets the coordinator decide whether to commission the question.

## Recommendation and confidence

Adopt the Free-v1 catalogue as the ten `ChartType` union members (**not** the sparkline-inclusive
public lists) and correct the three documents that list `sparkline` as a distinct entry.
**Confidence: high** — this rests on an explicit, already-written architectural decision, not a new
judgment call. The per-family engineering-pending classifications are **high confidence**, directly
reproduced from `plan-chart.ts` and `Chart.tsx`'s own throw statements. The funnel conditionality is
**high confidence** — it is 91's own stated policy, not this task's inference. The "no current Pro
chart-type list exists" finding is **high confidence** as a statement of current evidence; it is not a
recommendation about what such a list should contain.

## Conflicts with locked/current decisions

None of decision-record rank. The sparkline finding conflicts with wording in three non-locked
documents (`roadmap.mdx`, `index.mdx`, `30-implementation-plan.md`), not with any item in
`00-decisions.md`.

## Unknowns

- Whether `timebar` will actually reuse `kind: 'bar'` with a temporal x-scale or needs its own mark
  kind is not settled by any current file — flagged for `D1.1` to resolve, not assumed here.
- Whether `kpi`/`progress` compose from existing fields (`narrative.valueDisplay`, `kind: 'none'`) or
  need a new mark kind is likewise unresolved in code — flagged for `D3.1`/`D3.2`.
- Whether the coordinator wants a Pro/post-launch chart-type candidate list produced as a separate,
  explicitly-scoped research task (this task deliberately does not manufacture one).

## Affected APIs, files, tests and docs

- `docs/content/docs/roadmap.mdx:49` and `docs/content/docs/index.mdx:60` — recommend removing
  `sparkline` from the D-track list (or rewording to make clear it is a rendering of `line`, not a
  type).
- `research/30-implementation-plan.md:580` — same correction.
- No runtime code is implicated; `plan.ts`'s and `plan-chart.ts`'s existing comments already state the
  correct position and need no change.

## Implementation acceptance checklist

- [ ] `D1.1`–`D6.1` each cite this catalogue's disposition table as their starting evidence state
      rather than re-deriving "what's implemented today" independently.
- [ ] No D-family task or doc PR introduces a `sparkline` `ChartType` member or mark kind; a sparkline
      *rendering* is achieved via `type: 'line'` with axes/labels suppressed, per the existing design.
- [ ] `D6.1` (funnel) is not scheduled as a guaranteed Free-v1 family until `CR-D15` either supplies a
      reliable responsive contract or the coordinator explicitly accepts a weaker one.
- [ ] `D1.1`/`D3.1`/`D3.2` each resolve their open mark-kind question (timebar's scale type; KPI's and
      progress's composition) as part of their own planner design, not by assuming an answer from this
      report.
- [ ] The coordinator decides whether to correct `roadmap.mdx`/`index.mdx`/`30-implementation-plan.md`
      directly or route the correction through `D7.1`'s central registration pass.

## Proposed promotion

**Clarification** for the three sparkline-listing documents (`roadmap.mdx`, `index.mdx`,
`30-implementation-plan.md`) — remove or reword the `sparkline` entry to match the already-decided
architecture. **No change** to `00-decisions.md` or the `ChartType`/mark-kind type files — they are
already correct. **Defer** the Pro/post-launch chart-type catalogue as a distinct, not-yet-commissioned
question.
