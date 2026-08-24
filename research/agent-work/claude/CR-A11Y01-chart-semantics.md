# CR-A11Y01 (part of ledger R3) — Active-chart accessible semantics

Status: proposal for coordinator review
Date/access window: 2026-08-24, single session, repository-only. **No real assistive-technology
device or browser was available in this session** — see the Retrieval log and Unknowns below. This is
stated up front because the task brief specifically requires distinguishing real observed behavior
from specification text, and this report cannot supply the former for the interactive path.
Repository baseline: branch `Anti-gravity-and-other-Agent-changes`, at this task's own prior checkpoint

## Exact question and exclusions

Define static and RSC-safe accessible chart semantics, and identify which claims rest on real
VoiceOver/NVDA/browser observation versus specification text only, per `92-claude-research-workstream.md`'s
`CR-A11Y01` brief: *"Record real VoiceOver/browser behavior and, where available, NVDA/browser
behavior; do not rely only on specification text."* Excluded: interactive keyboard/tooltip semantics,
which `CR-I01` (this task's sibling deliverable) covers; this report is scoped to the **chart's
accessible role and structure**, static and interactive alike, not the interaction mechanics
themselves.

## Current repository evidence

- `packages/primitives/src/Chart.tsx:1-27,129-243` — the **only** accessibility implementation that
  exists in this repository today. Structure, read directly from source:
  - `<figure>` wraps both the graphic and its text equivalent.
  - `<svg role="graphics-document" aria-labelledby={titleId} aria-describedby={descId if present}>`.
  - The file's own docblock (lines 4-22) states the reasoning already worked out and settled:
    `role="img"` is rejected by name because it is *"Children Presentational: True. It does not merely
    label the graphic; it [erases everything inside it from the accessibility tree]."*
  - `<figcaption>` carries the data table, **outside** the `<svg>` (SVG's own `<table>` is not a real
    table — also stated in the docblock).
  - This is a **static, non-interactive** structure. There is no tooltip, no focus management, no
    live region, no keyboard handler anywhere in the codebase (confirmed by the same grep run for
    `CR-I01`: zero matches for `tooltip|hover|pointer|keyboard` in `packages/react/src/AutoChart.tsx`).
- `30-implementation-plan.md:236-245` — the RSC/zero-client-JS gate (`G4`) is closed with dated,
  reproducible evidence (*"Observed 2026-08-24: 77 marks in a `role="graphics-document"` `<svg>`, and
  0 of 6 chart markers in 553 KB of client JavaScript"*). This confirms the static structure above
  actually ships in a zero-JS server render today, not just in source.
- `research/83-visual-interaction-architecture.md` §13 already proposes the interactive-chart
  accessibility contract (keyboard data-index navigation, `aria-pressed` legend buttons, tooltip focus
  retention, live-region strategy for rapid updates, drag/resize `separator` semantics) with each rule
  traceable to a specific WAI-ARIA/WCAG source. This report treats that proposal as sound (it already
  passed a prior evidence check) and does not re-derive it; it adds the "what's real evidence versus
  what's a proposal" separation the brief specifically asks for.

## External evidence

| Claim | Class | Source/version/date | What it supports | What it does not support |
|---|---|---|---|---|
| `role="img"` is Children Presentational: True and erases descendant accessibility semantics | Official implementation (WAI-ARIA spec text, already applied in shipped code) | WAI-ARIA `img` role presentational-children rule, cited in `Chart.tsx`'s own docblock | The current `role="graphics-document"` choice over `role="img"` — this is a specification-derived fact already correctly acted on, not a proposal | Does not by itself prove any specific screen reader announces `graphics-document` usefully — see next row |
| `graphics-document` is the WAI-ARIA Graphics Module's role for structured, nested graphics | Primary research (cited) | WAI-ARIA Graphics Module, `83` §13 and §18 | The architectural choice of role | **The spec does not document real screen-reader support levels for `graphics-document`** — this is exactly the gap this task cannot close without a real device |
| WAI-ARIA APG Tooltip Pattern: focus stays on trigger, `role="tooltip"`, `aria-describedby`, Escape dismisses | Primary research (cited) | W3C WAI-ARIA APG, `83` §8/§13 | The proposed interactive-tooltip accessibility contract | Specification guidance is a design target, not evidence the pattern reads correctly in any specific screen reader/browser pairing |
| WAI-ARIA APG Window Splitter Pattern: focusable `separator` with `aria-orientation`/`aria-valuemin`/`aria-valuemax`/`aria-valuenow` | Primary research (cited) | W3C WAI-ARIA APG, `83` §13 | The proposed keyboard-resize-handle semantics for `C3.1`/grid resize | Same limitation — no real assistive-technology observation of this pattern applied to a resize handle specifically |
| WCAG 2.2 Content on Hover or Focus (dismissible/hoverable/persistent) | Official implementation (normative WCAG text) | W3C WCAG 2.2, `83` §18 | The Escape-dismisses / not-hover-only tooltip requirement | Normative requirement, not a behavioral observation |

## Retrieval log

| Source sought | Result | Limitation |
|---|---|---|
| Real VoiceOver (macOS/iOS) observation of `role="graphics-document"`, a live chart tooltip, or a keyboard-operable resize handle | **Not attempted — no GUI browser or screen reader is available in this text-only session environment.** | This is the central limitation of this report. `R3`'s own handoff brief anticipated exactly this: *"Real screen-reader/browser evidence may be unavailable in worker environment... Coordinator decides whether an empirical task is needed."* That anticipation is confirmed accurate by this attempt. |
| Real NVDA (Windows) observation | Not attempted, same reason | Same |
| WAI-ARIA/WCAG specification text for the cited patterns | Read via `83`'s existing citations (not re-fetched this session) | Specification text only, by definition — this is the category the brief asks to be kept separate from real observation, and it is reported here as exactly that |

## What is real evidence versus specification text, stated explicitly

**Real, reproducible evidence (this session, from the actual codebase):**
- The static markup structure (`<figure>` → `role="graphics-document"` `<svg>` → `<figcaption>` data
  table) exists, compiles, and ships with zero client JavaScript, per the dated `G4` gate result cited
  above. This is code evidence, not a screen-reader observation, but it is not a proposal either — it
  is what is actually running.

**Specification text only, not yet observed with real assistive technology (everything else in this
report and in `83` §13):**
- Whether `role="graphics-document"` is announced usefully by any current VoiceOver, NVDA, or JAWS
  version, with what fallback behavior on versions that do not recognize the Graphics Module.
- Whether the proposed tooltip focus-retention pattern reads correctly when a user tabs into a chart
  with VoiceOver or NVDA running.
- Whether the proposed `separator`-based keyboard-resize handle is discoverable and operable with a
  real screen reader, or whether (per `83` §13's own fallback clause) *"the chosen grid engine cannot
  expose this semantics"* and a separate properties/size editor is actually required in practice.
- Whether the live-region strategy for rapid chart updates (`83` §13: *"a concise status/live-region
  strategy rather than announcing a full multi-series payload on every pointer movement"*) avoids
  announcement flooding in a real screen reader, and what "concise" needs to mean numerically.

`83` §17 item 10 already names this exact gap as an open decision: *"keep `graphics-document` for the
static chart and test whether a focusable SVG/HTML controller is sufficient before considering an
application-style role."* This report confirms that test has not happened yet and cannot happen in
this session's environment.

## Alternatives

- **Report the `83` §13 proposal as settled accessibility behavior since it is well-sourced from
  WAI-ARIA/WCAG.** Rejected: specification conformance and real assistive-technology behavior are
  different things, which is precisely why the task brief asks for the distinction. A pattern can be
  spec-correct and still read poorly in a specific screen reader's actual heuristics.
- **Attempt to simulate screen-reader output from the accessibility tree structurally (e.g., reasoning
  about ARIA computation rules) and present that as evidence.** Rejected: that is still specification
  reasoning, not observation, and presenting it as "real behavior" would violate the exact instruction
  this task is bound by.

## Recommendation and confidence

Adopt `83` §13's static-chart contract as-is — **confidence: high**, because it is already
implemented, already gated (`G4`), and grounded in an unambiguous, correctly-applied spec rule
(`role="img"` erasure). For the interactive-chart contract (tooltip focus retention, live-region
strategy, keyboard resize semantics), **confidence: medium on specification conformance, no
confidence rating possible on real-world screen-reader behavior** — that requires the empirical task
this report cannot perform. Recommend the coordinator schedule `CR-X04` (accessibility task study,
already listed in `92-claude-research-workstream.md`'s P2 wave, gated on "keyboard grid + I1") as a
hard prerequisite before any interactive accessibility claim is published as verified rather than
designed-to-spec.

## Conflicts with locked/current decisions

None. This report does not challenge `83` §13's design; it adds the evidence-class labeling the
original document's own confidence framing already anticipates (`83` §17 item 10 already flags the
graphics-document-vs-application-role question as untested).

## Unknowns

- All real-device screen-reader behavior for the interactive contract, as stated above — the central,
  named unknown of this report.
- Whether `graphics-document` support has changed in any browser/AT combination since `83` was
  written — not re-checked in this pass.
- Whether a simpler fallback (e.g., a visually-hidden but real HTML summary alongside the SVG, rather
  than relying on Graphics Module role support) would be more robust across AT combinations than the
  current `graphics-document` choice — this is a legitimate design question `CR-X04`'s findings should
  inform, not one this report can resolve without data.

## Affected APIs, files, tests and docs

- No runtime code is implicated by this report directly; `packages/primitives/src/Chart.tsx`'s
  existing static markup is confirmed correct against the spec rule it already cites in its own
  docblock and needs no change.
- `CR-X04` (accessibility task study) should be the vehicle that turns this report's "specification
  text only" items into real evidence once `I1` and a keyboard-operable grid exist to test against.
- `I1.3`/`I1.5` (tooltip layer, keyboard/touch matrix — see `CR-I01`) should implement the proposed
  interactive contract as a design target while explicitly not claiming it as accessibility-tested
  until `CR-X04` runs.

## Implementation acceptance checklist

- [ ] The static chart's existing `role="graphics-document"` / `<figcaption>` data-table structure is
      preserved unchanged through `I1` and `D` work — it is correct and gated; nothing in this report
      motivates altering it.
- [ ] Any interactive accessibility feature (tooltip, keyboard resize, live region) shipped before
      `CR-X04` runs is documented internally as "designed to WAI-ARIA/WCAG guidance, not yet verified
      with real assistive technology" — not presented in public docs as tested.
- [ ] `CR-X04` is scheduled with explicit real-device/browser access (VoiceOver at minimum; NVDA if
      available) before any public accessibility claim beyond the static path is made.
- [ ] `83` §17 item 10's open question (graphics-document vs. a focusable SVG/HTML controller) is
      resolved by `CR-X04`'s findings, not assumed by this report.

## Proposed promotion

**Clarification** for the existing static-chart evidence (already correct, now explicitly labeled
"real, gated evidence" rather than merely "implemented"). **Genuine evidence gap, deferred to `CR-X04`**
for every interactive-chart accessibility claim — this report does not promote `83` §13's interactive
proposals to verified status, and recommends the coordinator not present them as verified either until
`CR-X04` produces real observation.
