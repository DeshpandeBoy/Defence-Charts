# Claude agent research and review workstream

**Audience:** Claude research, product, UX, accessibility, and independent-review agents  
**Controller:** [`90-final-delivery-and-agent-plan.md`](90-final-delivery-and-agent-plan.md)  
**Output directory:** `research/agent-work/claude/`  
**Handoff format:** [`handoffs/README.md`](handoffs/README.md)

Claude's lane reduces decision risk and prepares implementation acceptance criteria. It does not
quietly turn proposals into product contracts. Each task writes one unique evidence file; the
coordinator reviews it and promotes accepted decisions separately.

---

## 1. Rules for every Claude agent

### Start checklist

- [ ] Read `research/00-decisions.md`, the master plan, this file, and the task handoff.
- [ ] Inspect current code/tests for any claim about what is implemented.
- [ ] Confirm the exact question, output file, dependency, and deadline.
- [ ] Search existing research before starting a new web/source pass.
- [ ] Record access date and failed retrievals; absence of access is not negative evidence.

### Evidence checklist

- [ ] Label every material item as `Primary research`, `Official implementation`, `Artifact`,
  `Repository evidence`, `Inference`, or `Product proposal`.
- [ ] Prefer standards, papers, official source, official docs, and changelogs.
- [ ] Keep Basedash private-bundle observations labelled `Artifact`; never present them as a public
  Basedash API or stable contract.
- [ ] Separate measured facts from recommended defaults.
- [ ] State population/task/platform/version limits for empirical findings.
- [ ] Do not invent numeric thresholds when the evidence does not supply one.
- [ ] Record contradictions with existing decisions and affected files/contracts.

### Handoff checklist

- [ ] Write only the assigned `research/agent-work/claude/<task-id>-<slug>.md` and task handoff.
- [ ] Include the exact question, evidence table, retrieval log, alternatives, recommendation,
  confidence, unknowns, affected contracts, and implementation acceptance checklist.
- [ ] Identify whether the result is `no change`, `clarification`, `proposed amendment`, or `blocker`.
- [ ] Commit the evidence file and handoff together.
- [ ] Never mark the task done; the coordinator closes it after review.

---

## 2. Required deliverable structure

```md
# <Task ID> — <question>

Status: proposal for coordinator review
Date/access window:
Repository baseline:

## Exact question and exclusions

## Current repository evidence

## External evidence
| Claim | Class | Source/version/date | What it supports | What it does not support |

## Retrieval log
| Source sought | Result | Limitation |

## Alternatives

## Recommendation and confidence

## Conflicts with locked/current decisions

## Unknowns

## Affected APIs, files, tests and docs

## Implementation acceptance checklist

## Proposed promotion
No change / clarification / decision amendment / new decision / defer
```

---

## 3. P0 research — resolve before contracts freeze

### CR-000 — current-status and contradiction reconciliation

**Output:** `research/agent-work/claude/CR-000-status-reconciliation.md`  
**Blocks:** all later status reporting and C0 contract freeze.

Classify every apparent open item in research 10, 20, 41–44, 60, and 80–83 as:

- `closed`;
- `stale wording`;
- `research-only proposal`;
- `engineering pending`;
- `external decision`;
- `genuine evidence gap`.

At minimum reconcile:

- locked RGL/12-column decisions versus research 83 reopening the engine/18-column question;
- B1/B2 items still worded as open in theming/granularity documents;
- A4 typography visual checks;
- older Node/policy-gate failure reports versus the latest green verification;
- “all research streams are closed” versus the open empirical/release work;
- Preview, Free-v1, interactive-dashboard, and commercial-launch scope.

### CR-C01 — current RGL version and adapter viability

**Output:** `research/agent-work/claude/CR-C01-grid-engine.md`  
**Blocks:** C0.2.

Using official source/docs/changelog and the installed package, verify the exact version and the
two relevant boundaries: algorithms/types under `./core`, and `GridLayout`/React hooks/components
under `./react`. Cover React 19 behavior, controlled layout, SSR/import safety, transforms,
collision, compaction, serialisation assumptions, keyboard gaps, and exit strategy. The engine
choice remains locked unless reproducible evidence requires an amendment.

### CR-C02 — public grid profile contract

**Output:** `research/agent-work/claude/CR-C02-grid-profiles.md`  
**Blocks:** persisted public layout API.

Test the implications of the locked 12-column contract. Treat 6/18-column profiles as a proposal.
Define single-column/narrow behavior, conversion/migration risk, and whether any profile information
should reach `ChartPlan`. Default recommendation: ship 12 columns in v1 and defer profiles.

### CR-C03 — layout persistence and migration

**Output:** `research/agent-work/claude/CR-C03-layout-persistence.md`  
**Depends on:** CR-C02.

Specify stable IDs, schema version, add/remove/rename behavior, invalid layouts, constraint changes,
failed saves, conflicts, and reconciliation fixtures. Storage remains host-owned.

### CR-C04 — keyboard, touch, drag, and resize access

**Output:** `research/agent-work/claude/CR-C04-grid-input-accessibility.md`

Use WAI/WCAG and implementation evidence to propose key mapping, focus model, announcements,
cancel/commit behavior, pointer/touch target behavior, and a fallback when the grid engine does not
supply semantics. Do not call a grid accessible because it has ARIA labels alone.

### CR-C05 — widget-shell ownership

**Output:** `research/agent-work/claude/CR-C05-widget-ownership.md`  
**Blocks:** C2 shell API.

Assign one owner for header, actions, value, plot, legend, footer, data table, and overlay boundary.
Prove that the proposal does not duplicate size observation or make chart content control grid size.

### CR-D00 — launch catalogue

**Output:** `research/agent-work/claude/CR-D00-launch-catalogue.md`  
**Blocks:** final D sequencing and public claims.

Define three explicit catalogues:

- Preview;
- Free v1;
- post-launch/Pro candidates.

No intended type may be described as implemented. The default Free-v1 proposal is line/area,
bar/timebar, donut, KPI/progress, scatter, heatmap, and funnel, subject to evidence and completion.

### CR-D01 — canonical data and identity contract

**Output:** `research/agent-work/claude/CR-D01-data-identity.md`  
**Blocks:** D family planners and I1 interaction identity.

Cover null/NaN/infinite values, duplicates, unsorted values, negatives, missing categories, mixed
series lengths, stable keys, diagnostics, serialisation, and RSC constraints.

### CR-D02 — config, plan, interaction, and host state boundaries

**Output:** `research/agent-work/claude/CR-D02-state-contracts.md`  
**Blocks:** I1 and interactive D work.

Prevent semantic configuration from secretly bypassing `ChartPlan`. Keep grid layout, host data,
filters, chart plan, and transient interaction state distinct. Specify controlled/uncontrolled
ownership only where the library genuinely needs both.

### CR-E01 — product name, npm scope, and CSS prefix

**Output:** `research/agent-work/claude/CR-E01-name-scope-prefix.md`  
**Blocks:** public publication, not C/D implementation.

Produce a ranked shortlist with npm/domain/trademark evidence, migration inventory, and one
recommendation. Availability must be refreshed immediately before claiming a name.

### CR-E02 — licence and contributions

**Output:** `research/agent-work/claude/CR-E02-licence-contributions.md`  
**Blocks:** public publication.

The repository already fixes MIT and copyright holder Dhanya Rao in `LICENSE`; do not reopen those
facts as an undecided MIT-versus-Apache comparison. Verify dependency licences and compare
contribution approaches. Separate factual analysis from legal advice and produce counsel-ready
questions about DCO/CLA, trademarks, contributor ownership, and any later proprietary packages.

### CR-E03 — immutable extension seam for future Pro work

**Output:** `research/agent-work/claude/CR-E03-extension-contract.md`  
**Blocks:** only Pro-dependent stable APIs.

Compare explicit sibling components/packages with an immutable renderer payload. Reject mutable global
registration, runtime phone-home coupling, and serialization-breaking function contracts in core.

---

## 4. P1 research — run while C engineering proceeds

| ID | Question and output | Required acceptance |
|---|---|---|
| **CR-D10** | Complete bar/timebar ladder → `CR-D10-bar-timebar.md` | Retrieve Talbot/Setlur/Agrawala if legally accessible; cover orientation, grouping/stacking, negatives, zero baseline, minimum geometry, long categories and Micro→Stage; inaccessible findings remain unclaimed |
| **CR-D11** | Donut/pie aggregation and labels → `CR-D11-donut-pie.md` | Separate perceptual evidence from product defaults; define stable visible `Other`, category limits, tiny slices and non-color equivalent |
| **CR-D12** | KPI/progress semantics → `CR-D12-kpi-progress.md` | Define value/unit/delta/target/current/remaining semantics, formatting and accessible Micro→Stage behavior |
| **CR-D13** | Scatter renderer boundary → `CR-D13-scatter.md` | Define a reproducible 1k/10k/100k benchmark, hit testing, accessibility fallback and no-silent-sampling rule |
| **CR-D14** | Heatmap limits → `CR-D14-heatmap.md` | Do not reuse gridline-spacing evidence as cell-size evidence; cover missing cells, labels, locale/date behavior and redundant encoding |
| **CR-D15** | Funnel semantics → `CR-D15-funnel.md` | Define stage order, conversion math, missing/zero/negative cases, small-size substitute and accessible table; recommend deferral if evidence is weak |
| **CR-I01** | Shared tooltip/crosshair/legend → `CR-I01-interaction.md` | Stable payload, fixed/fluid modes, focus ownership, Escape/touch behavior, legend state and overlay containment |
| **CR-I02** | Filter scope → `CR-I02-filters.md` | Decide whether filters belong in Free v1 or v1.1; define dashboard/section/widget scope, pending/applied state and host persistence boundary |
| **CR-A11Y01** | Active-chart semantics → `CR-A11Y01-chart-semantics.md` | Record real VoiceOver/browser behavior and, where available, NVDA/browser behavior; do not rely only on specification text |
| **CR-TY01** | Typography validation → `CR-TY01-typography-validation.md` | Segoe UI Variable/Windows, GRAD at 11px, screenshot baseline, line-height and U+2212 metrics; label unavailable platforms |
| **CR-TH01** | Theme reconciliation → `CR-TH01-theme-reconciliation.md` | Classify stale/open theme items and verify current generated themes/composition rather than repeating old counts |
| **CR-E04** | Publication refresh → `CR-E04-publication-current-state.md` | Current official npm trusted publishing/provenance, package metadata, React/Next/Vite support evidence and date-sensitive risks |

Bar-paper retrieval, direct-label literature, Segoe calibration, GRAD review, and publication research
do not block initial C1 code. Grid identity, persistence, shell ownership, and input accessibility can
change public C contracts and therefore run first.

---

## 5. P2 empirical research — requires working fixtures

| ID | Start condition | Output |
|---|---|---|
| CR-X01 height/task study | bar/KPI fixtures | 24/40/80/120/160/240 px task/error matrix |
| CR-X02 constraint corpus | line/area now, each family later | machine-readable long-label/density/locale/edge fixture proposal |
| CR-X03 grid stress study | C4 fixture | 1/10/50/100/200-widget measurements and proposed budgets |
| CR-X04 accessibility task study | keyboard grid + I1 | keyboard/screen-reader/touch task completion evidence |
| CR-R05 user validation | Preview | protocol, consent-safe notes, observed failures, and changes; never invented participants or outcomes |
| CR-E10 commercial provider | paid launch explicitly in scope | refreshed provider/tax/merchant-of-record comparison and legal/accounting questions |

Empirical research must preserve raw observations and methodology. A recommendation must not be
reported as a measured result.

---

## 6. Independent review assignments

A Claude review agent may review a Codex handoff after implementation, but it must remain read-only
unless assigned a separate docs-only write scope. Review these dimensions:

- acceptance criteria versus actual diff;
- unsupported public claims;
- accessibility and interaction gaps;
- edge cases omitted from tests;
- research claims promoted above their evidence class;
- package/API compatibility risk;
- whether the handoff is sufficient for a fresh session to resume.

The review produces `research/agent-work/claude/<build-task-id>-review.md`. It does not mark the build
task done and does not rewrite the code under review.

---

## 7. Recommended Claude waves

| Wave | Parallel tasks | Feeds |
|---|---|---|
| 0 | CR-000 | Final status and all task vocabularies |
| 1 | CR-C01/C02, CR-C04/C05, CR-D00/D01/D02, CR-E01/E02 | C0, D0 and publication decisions |
| 2 | CR-C03, CR-D10–D15, CR-I01/I02, CR-A11Y01, CR-TY01/TH01/E04 | C3, I1, D families, E |
| 3 | CR-X01–X04 and user validation | Release hardening and v1.1 |

---

## 8. Claude task prompt template

```text
Task: <ID and exact research question>
Repository: /Users/SameeraD/Defence-Charts
Output: research/agent-work/claude/<task-id>-<slug>.md

Read first:
- research/00-decisions.md
- research/90-final-delivery-and-agent-plan.md
- research/92-claude-research-workstream.md
- research/handoffs/<task-id>.md

Do not modify canonical decisions, implementation code, the master ledger, or another agent's file.
Inspect current repository evidence before external research. Prefer primary/official sources and
record access dates and failed retrievals. Label claims as Primary research, Official
implementation, Artifact, Repository evidence, Inference, or Product proposal.

Deliver the required evidence table, alternatives, recommendation/confidence, unknowns, conflicts,
affected contracts, and implementation acceptance checklist. Update the handoff and commit both
files before stopping. The coordinator, not this agent, decides whether to promote the proposal.
```
