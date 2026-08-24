# CR-000 (ledger P0.2) — Current-status and contradiction reconciliation

Status: proposal for coordinator review
Date/access window: 2026-08-24, single session, repository-only (no external retrieval needed for this task)
Repository baseline: branch `Anti-gravity-and-other-Agent-changes`, commit `c11ba60`, tree clean at start

## Exact question and exclusions

Classify every apparent open item in `research/10-responsive-ladder.md`, `20-architecture.md`,
`41-text-metrics.md`–`44-granularity.md`, `60-commercial-model.md`, and `80–83` as `closed`,
`stale wording`, `research-only proposal`, `engineering pending`, `external decision`, or
`genuine evidence gap`, per `92-claude-research-workstream.md`'s CR-000 brief. At minimum reconcile
the six named tensions: RGL/12-column vs the 18-column reopening in `83`; B1/B2 items worded open in
theming/granularity; the A4 typography visual check; older Node/policy-gate failure reports vs the
latest green verification; "all research streams are closed" vs open empirical/release work; and
Preview/Free-v1/interactive-dashboard/commercial-launch scope wording.

Excluded: re-deriving any new numeric threshold, re-opening the RGL/12-column engine decision itself,
and any external primary-source retrieval (none of the six items requires it — they are internal
document/code consistency checks, not new empirical claims).

## Current repository evidence

Inspected before writing any conclusion:

- `packages/grid/src/index.ts` — exports only `GRID_COLUMNS = 12`; no layout component. Matches
  `90-final-delivery-and-agent-plan.md` §2 "Not complete" exactly.
- `packages/core/src/plan-chart.ts:37,80-90` — `LINE_TYPES = new Set(['line','area'])`; any other
  `ChartType` throws `Only 'line' and 'area' resolve at A3.` Matches the master plan's "planner
  intentionally rejects bar, timebar, donut, scatter, funnel, KPI, heatmap, and progress" claim.
- All six `packages/*/package.json` — `"private": true`, `"version": "0.0.0"`, name still `@gx/*`.
  Matches the master plan's packaging claim.
- `packages/tokens/src/tokens.ts:164-172` — `ramp-neutral-1` … `ramp-neutral-9` all carry real hex
  values (`#0c0d0f` … `#e2e5e8`), sourced `DESIGN.md:99`, tier `C`. This is populated, not a stub.
- `packages/tokens/src/tokens.ts:713-716`, `themes/theme.css:484,509` — a `neutral-light` theme
  exists with real values, not a placeholder.
- `LICENSE` — MIT, copyright Dhanya Rao, 2026. Settled fact, not a template.
- `package.json` engines: `"node": ">=22.18"`.
- Local shell: `node --version` → `v22.12.0` (below the declared floor).
- Ran `pnpm lint:policy` under the local (unsupported) Node: **fails** —
  `ERROR — Unknown file extension ".ts" for .../packages/core/src/policy.ts`. This exactly reproduces
  the failure mode `81-deep-evidence-audit.md:63,453` reports.
- Ran `npx -y node@24 "$(which pnpm)" lint:policy`: **passes** —
  `B3 policy threshold gate: PASS (24 thresholds; defaults are serialisable, tiered, and
  planner-consumed)`.
- Ran `npx -y node@24 "$(which pnpm)" test`: **passes** — `Test Files 33 passed (33)`,
  `Tests 675 passed (675)`, independently reproducing the master plan's "675 passing tests" claim
  the same day it was written.

## External evidence

Not applicable. All six items are internal document-vs-document or document-vs-code consistency
questions; none turns on a claim about the outside world that needs a primary source.

| Claim | Class | Source/version/date | What it supports | What it does not support |
|---|---|---|---|---|
| — | — | — | — | — |

## Retrieval log

| Source sought | Result | Limitation |
|---|---|---|
| n/a — no external retrieval attempted | n/a | CR-000 is repository-internal reconciliation per its own brief |

## Findings (the six required items, plus one adjacent check)

### 1. RGL/12-column decision vs `83`'s 18-column reopening

**Classification: `closed`.** `90-final-delivery-and-agent-plan.md` §3 "Reconciled contradictions"
already states the resolution: `./core`/`./react` boundary is C0's job, 12 columns stays the base
grid, and 6/18-column profiles are "deferred until a separate decision and contract test; they do not
belong in C1." `00-decisions.md` decision 6 matches. `83-visual-interaction-architecture.md:88-90,924`
still reads as an open question in isolation ("Do not pass `18` into the current contract silently...
Before shipping ultrawide layouts, either add an explicit `gridColumns`/profile field...") but this is
exactly what `90`'s reconciliation resolved — `83` was written before `90` and was never updated with
a forward pointer.

**Residual stale wording (cosmetic, not a contradiction):** `83:88-90` and `83:924` have no
cross-reference to `90`'s resolution. A reader opening `83` alone would think the question is still
live at the contract level, when it is now explicitly deferred past C1. Recommend a one-line addition
at both locations: "Resolved: deferred past C1, see `90-final-delivery-and-agent-plan.md` §3."

### 2. B1/B2 items worded open in theming/granularity documents

**`43-theming.md` §9 "Open, and deliberately not invented" — classification: `stale wording`** for
three of its seven items.

- Item 1 ("six neutral hex values... Milestone B1") and item 7 ("named-colour list's shape... B1,
  with the token tree") describe future B1 work. But `30-implementation-plan.md:362-364` states,
  dated 2026-08-24, the same day as this reconciliation: *"B1-B3 are closed for the current line/area
  planner. B1 ships the generated presentation tree and Rail + Neutral themes."* Repository evidence
  confirms closure: `tokens.ts:164-172` has all nine neutral ramp values populated with real hex and
  provenance, not placeholders.
- Item 3 ("five unguaranteed composition pairs... B1, per theme, per ground") is not directly
  verified line-by-line in this pass, but sits in the same "B1" bucket as items 1 and 7, both of
  which are confirmed closed. It should be checked, not assumed closed by association.

These three items were accurate when `43-theming.md` was authored and became stale the moment B1
closed without the document being revisited. This is not a contradiction with a locked decision — it
is a document that fell behind implementation.

- Items 2 (neutral-light ΔE-5.0 collapse — "must be simulated, not assumed"), 4 (cascade layers,
  "Tier C, no surveyed precedent"), and 5 (the elevation reading, an interpretation flagged as such)
  remain **genuinely open** — no later document claims to have closed them, and no generated artifact
  (test, simulation output, decision record) was found that resolves them. **Classification:
  `genuine evidence gap`**, correctly left open; no action needed beyond leaving them open.
- Item 6 is already self-closed with a `✅` marker and a decision-record pointer
  (`decisions/012`) — correctly worded, no action.

**`44-granularity.md` §5 "What's still open" — classification: `closed` (correctly worded, not
stale).** Its three bullets ("candidates still need consumers as each later chart family lands,"
"keep the G20 manifest in step... as C/D add plan fields," "chart breadth is now the D track") are
accurate exactly because the D track has not started (`90`'s ledger: D0.1–D7.1 all `backlog`). No
action needed.

### 3. A4 typography visual check (`GRAD: 150` legibility at 11px)

**Classification: `genuine evidence gap`, already correctly tracked — not a contradiction requiring
urgent correction, but worth a clarifying footnote.** `41-text-metrics.md:152` and
`42-typography.md:153,311` flag *"Whether `GRAD: 150` is perceptually sufficient to read as a landmark
at 11px is **UNVERIFIED**... Check it visually at A4."* No decision record, screenshot baseline, or
test result anywhere in `research/` or `packages/` closes this specific sub-item — grepped
`GRAD.*150` across `research/00-decisions.md` and `research/decisions/*.md`: no hits.

This does not contradict "A1–A6... complete" in the master plan, because A4's actual gate
deliverables (hook-free RSC-safe renderer, `role="graphics-document"` markup, the zero-client-JS gate
G4, the `<line>`-avoidance gate G14) are independently closed with dated, reproducible evidence
(`30-implementation-plan.md:236-245`: *"Observed 2026-08-24: 77 marks... 0 of 6 chart markers in 553
KB of client JavaScript."*). The GRAD legibility check was never one of A4's closure gates — it is a
forward-flagged calibration task that the workstream document already schedules as `CR-TY01` in the
P1 wave (`92-claude-research-workstream.md` row `CR-TY01`).

**Risk:** a reader who sees "A1–A6 complete" without opening `41`/`42` could assume every
`⚠ UNVERIFIED` flag inside A4's milestone is also resolved. Recommend a one-line exception note next
to the "A1–A6... complete" claim in `90-final-delivery-and-agent-plan.md` §2, naming `CR-TY01` as the
one open A4 sub-item.

### 4. Older Node/policy-gate failure reports vs the latest green verification

**Classification: `closed` — both reports are simultaneously true and describe different Node
versions; neither is wrong.** `81-deep-evidence-audit.md:63,453` reports: *"pnpm lint:policy —
ENVIRONMENT BLOCK — Node 22.12.0 is below the repository requirement of >=22.18."* Reproduced
independently in this session on the same local machine (also Node 22.12.0): identical failure,
`Unknown file extension ".ts"`. Then reproduced under `npx -y node@24`: clean pass,
`B3 policy threshold gate: PASS`, and a full `pnpm test` run at 675/675 passing, matching the master
plan's headline number.

`30-implementation-plan.md:104-113` already documents the fix (*"Node 22 is the floor... Use Node 22
or 24 — `npx node@24` is enough"*), and `P0.1`'s own committed handoff
(`research/handoffs/P0.1.md`, Verification evidence table) recorded the same green
`npx -y node@24 ... pnpm verify` result the same day. So there is no live contradiction — `81` is an
accurate, reproducible diagnosis of a local-environment engine floor, not a code defect, and it is
already resolved by using the supported Node version. The only gap is that `81` itself has no forward
pointer saying so.

Recommend: append one line to `81-deep-evidence-audit.md` at both cited locations: "Resolved:
engine-floor issue, not a code defect — passes under Node ≥22.18, see
`30-implementation-plan.md` §Node floor and the P0.1 verification record."

### 5. "All research streams are closed" vs open empirical/release work

**Classification: `stale wording` — direct tension, should be scoped explicitly.**
`30-implementation-plan.md:645-646` states: *"...are folded into B1–B3 and `00-decisions.md`. **All
research streams are now closed.**"* This was accurate for the specific inputs it lists in that
paragraph (bar-paper retrieval attempt, direct-labelling literature search, the granularity
comparison) as they fed the closed line/area A/B milestones. It is not accurate as a general claim
about the project's research program: `90-final-delivery-and-agent-plan.md`'s live ledger lists this
very task (`P0.2`/`CR-000`) plus `R1`–`R4` as `ready`, and `92-claude-research-workstream.md` defines
an entire P1/P2 wave (`CR-D10`–`CR-D15`, `CR-I01`/`CR-I02`, `CR-A11Y01`, `CR-TY01`/`CR-TH01`/`CR-E04`,
`CR-X01`–`CR-X04`, `CR-R05`, `CR-E10`) that is explicitly not closed — most rows are `backlog` or
`optional`, none is `done`.

Both statements were true when written; `645-646` simply predates `90`'s broader research program
(both are dated 2026-08-24, but `90` supersedes per the authority order in `90` §3, rule 3). Recommend
narrowing `30-implementation-plan.md:645-646` to name its actual scope ("closed" refers only to the
line/area A/B research inputs enumerated in this section) and cross-reference
`92-claude-research-workstream.md` as the current, actively-open research register.

### 6. Preview / Free-v1 / interactive-dashboard / commercial-launch scope wording

**Classification: `stale wording` risk by omission, not a direct contradiction.**
`60-commercial-model.md` frames scope as a two-tier **Free / Pro** split (line 17-18) and an intended
Free catalogue (line 112-113: line, area, bar, timebar, donut, scatter, funnel, KPI, heatmap,
progress) that matches `90`'s Free-v1 catalogue and `CR-D00`'s default proposal exactly — no conflict
there. But `60` has no concept of the **Preview** release that `90` §1 introduces as a checkpoint
*inside* the Free path ("A Preview should be published first so packaging and consumer contracts are
tested before every chart family depends on them"). `82-package-ecosystem-benchmark.md:74,422` uses
"commercial launch" consistently with `60` and also predates the Preview checkpoint, but nothing in
either document states or implies anything incompatible with a Preview stage — it is an omission, not
an assertion that contradicts `90`.

Recommend one clarifying sentence in `60-commercial-model.md`'s executive summary: "Preview and
Free v1 (see `90-final-delivery-and-agent-plan.md` §1) are sequencing checkpoints inside this
document's Free tier, not additional commercial tiers."

### Adjacent check: `80-shadcn-basedash-library-strategy.md` milestone table

Not one of the six named items, but checked because it makes the same kind of status claim.
**Classification: `closed`, no action.** Its "Current milestone status" table (lines 45-60) matches
verified repository evidence exactly: A1-A6/B1-B3 implemented for line/area, C1 grid "stub only,"
D chart breadth "not implemented... `planChart()` intentionally throws," E publication "not ready...
packages are private." No correction needed.

## Alternatives

- **Do nothing and let each document drift until the coordinator next reads it.** Rejected: this is
  exactly the failure mode CR-000 exists to catch before C0 freezes — a downstream agent reading `43`
  or `81` in isolation would draw a wrong conclusion about what is already closed.
- **Have this task edit the target documents directly.** Rejected per `92-claude-research-workstream.md`
  §1: Claude research agents write only their unique evidence file; the coordinator promotes accepted
  corrections into the canonical documents.

## Recommendation and confidence

Apply five small, additive corrections (all one or two lines, all citations/cross-references, none
change a number or a decision):

1. `83-visual-interaction-architecture.md:88-90,924` — pointer to `90`'s reconciliation. *Confidence: high.*
2. `43-theming.md` §9 items 1, 3, 7 — mark closed with a pointer to `tokens.ts` and
   `30-implementation-plan.md:362-364`, after independently confirming item 3 the same way items 1
   and 7 were confirmed. *Confidence: high for items 1 and 7 (code-verified); medium for item 3
   (bucketed by association, not independently code-checked in this pass).*
3. `90-final-delivery-and-agent-plan.md` §2 — one-line exception naming `CR-TY01` next to the
   "A1–A6... complete" claim. *Confidence: high.*
4. `81-deep-evidence-audit.md:63,453` — pointer marking the failure as an engine-floor issue, resolved
   under Node ≥22.18. *Confidence: high — independently reproduced both the failure and the fix.*
5. `30-implementation-plan.md:645-646` — narrow "all research streams are now closed" to name its
   actual scope, cross-referencing `92-claude-research-workstream.md`. *Confidence: high.*
6. `60-commercial-model.md` executive summary — one sentence locating Preview/Free-v1 inside its Free
   tier. *Confidence: medium — this is the softest of the six, an omission rather than a stated
   conflict.*

None of these touches a locked decision, runtime code, or the live ledger.

## Conflicts with locked/current decisions

None. Every finding above is a documentation-currency gap against already-locked decisions or
already-superseding documents (`90`, `30`), not a challenge to any locked decision in
`00-decisions.md`.

## Unknowns

- `43-theming.md` §9 item 3 (five composition pairs) was bucketed with items 1 and 7 by pattern match
  ("B1" label) rather than independently verified against a generated artifact the way items 1 and 7
  were. A follow-up should grep `packages/tokens/src/tokens.ts` for the specific five pairs before the
  coordinator marks item 3 closed.
- Whether the neutral-light ΔE-5.0 collapse (`43-theming.md` item 2) has been informally checked
  outside the committed repository (e.g., in a design tool) is unknown; only the repository was
  inspected, per this task's evidence boundary.
- This pass reconciled the six named items plus one adjacent check; it did not exhaustively grep every
  research document under `research/` for every instance of "open"/"TBD"/"unresolved" wording — `10`
  and `20` were spot-checked and found clean (their one "still open" section in `10` §8 is already
  correctly marked with resolved/unresolved strikethrough status).

## Affected APIs, files, tests and docs

No APIs, tests, or runtime code are affected — this is a pure documentation-currency task. Files a
coordinator edit would touch: `research/83-visual-interaction-architecture.md`,
`research/43-theming.md`, `research/90-final-delivery-and-agent-plan.md`,
`research/81-deep-evidence-audit.md`, `research/30-implementation-plan.md`,
`research/60-commercial-model.md`.

## Implementation acceptance checklist

- [ ] Coordinator reviews each of the six recommended one/two-line edits above and applies, amends, or
  rejects each independently (they are not bundled — any subset may be accepted).
- [ ] `43-theming.md` item 3 (composition pairs) is independently verified against `tokens.ts` before
  being marked closed, per the Unknowns note.
- [ ] No edit changes a number, threshold, or decision — only adds a cross-reference/pointer.
- [ ] `git diff --check` after edits (whitespace only; no code changed).

## Proposed promotion

**Clarification** for items 2, 4, 5, and 6 (add cross-references; no decision content changes).
**No change** for items 1 and 3, and for the `80` adjacent check (already correctly reconciled or
already correctly worded elsewhere) — recommend only the same kind of forward-pointer as item 1's
residual note.
