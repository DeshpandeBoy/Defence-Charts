# CR-ARCH02 — Second architecture review: the shipped library against the one I would have built

**Type:** research proposal — not a locked decision, not a task handoff.
**Reviewed tree:** `Fine-Tuning-V1` @ `645ac43` *"merge: integrate responsive resize motion"*, working tree
clean except this file.
**Method:** every claim below was obtained by running a command or reading a line in this checkout.
Where a claim could not be reproduced it is in §7 and marked as such.
**Relationship to [`CR-ARCH01`](CR-ARCH01-build-review-and-imagined-architecture.md):** that file did the
same exercise at an earlier commit and is still untracked. This one re-runs its findings against today's
tree, records which are fixed and which are not, and adds one architectural finding it did not have (§4).
Neither file overwrites the other, per [`README.md`](README.md).

---

## 0. Verdict

The library that exists is, in almost every structural respect, better than the one the research
documents describe. The family seam, the frozen registration tables, the renderer/planner symmetry and
the interaction scheduler are all more disciplined than what `20-architecture.md` specifies. I would not
redesign any of them.

⚠ **What is wrong is not the architecture. It is that the architecture is no longer being enforced.**
`pnpm verify` fails on the committed tree at two separate steps, the last eight CI runs are red, seven
verification gates that milestone evidence depends on are wired to nothing, and one plan field —
`marks.renderer` — means four different things in four different families, two of which are an
uncaught exception in a consumer's render.

The gap is not "features missing." It is that the repo's own founding rule — *"a gate never observed to
fail is not a gate"* — has stopped being applied to the gates themselves.

---

## 1. Scale, measured

| Measure | Value | How obtained |
|---|---|---|
| Packages | 7 — `core`, `primitives`, `react`, `grid`, `motion`, `tokens`, `testing` | `ls packages` |
| Apps | 4 — `playground`, `sandbox`, `raw-demo`, `rsc-fixture` | `ls apps` |
| Source lines (ts/tsx/css/mjs, excl. `dist`/`.next`) | 58,288 | `wc -l` |
| Test files / tests | 80 / 1,038 — **1,037 pass, 1 fails** | `pnpm test` |
| Non-test gate scripts | 21 | `ls scripts/check-*.mjs` |
| Chart families registered | 8 | `packages/core/src/planner-registry.ts:80` |
| Mark-renderer families | 7 | `packages/primitives/src/renderer-registry.ts:22` |
| Public family entrypoints | **3 of 8** | `scripts/check-treeshake.mjs:161` |
| Tokens declared | 269 | `grep` over `packages/tokens/src/themes/*.css` |
| Tokens referenced anywhere | 145 | repo-wide `var(--shiftcharts-*)` scan |
| Research documents / handoffs | 131 / 75 | `find research -name '*.md'` |
| Recent CI runs green | **0 of 8** | `gh run list --limit 8` |

---

## 2. Three places the build is better than the plan I would have written

Recording these first, because the rest of this document is failure analysis and that would give a false
impression of the whole.

### 2.1 The family seam beats rung-set dispatch

I would have written `rungs/bar.ts`, `rungs/donut.ts` and so on as siblings of `rungs/line.ts`, dispatched
by a `switch` in `plan-chart.ts`. What exists is better in two ways. `family-seam.ts` makes the planner an
*implementation* boundary while keeping `ChartPlan` the only thing that crosses it, and
`planner-registry.ts` is a frozen literal tuple with an explicit comment that it is *"not a runtime
registration, mutable map, or side-effect import."* That is the difference between a seam and a plugin
API, and choosing the first is correct for a library whose central claim is that planning is pure.

The renderer side mirrors it exactly (`renderer-seam.ts`, `renderer-registry.ts`), and
`renderRegisteredMark` throws by name on an unregistered mark kind rather than rendering nothing. Same
discipline as `planChart()`'s milestone-naming throw.

### 2.2 Families compose the line rungs as a seed rather than duplicating them

`packages/core/src/families/bar/planner.ts` takes the line rung output and replaces only the fields bar
semantics change. That keeps *"six size contracts"* literally one implementation instead of eight
parallel ones that drift. I would have duplicated and regretted it by the third family.

### 2.3 The pure/impure line is drawn in the right place, repeatedly

`AutoChart.tsx`'s docblock — *"the correct amount for it to decide is none"* — is the right instinct, and
the code honours it: `previousClass` is the only state, and it feeds a pure classifier rather than being
consulted by one. `format.ts` forcing `utcFormat()` over `timeFormat()` because the latter reads the host
timezone is exactly the class of bug that only shows up in production, caught in advance. `interaction-policy.ts`
being a "tiny pure seam rather than a second budget in React" is the same judgement applied again.

---

## 3. The gaps, ranked — each reproduced in this checkout

### 3.1 ⚠ BLOCKING — `pnpm verify` fails at step 2, and the failure is trivial

```
$ pnpm lint
apps/raw-demo/build.mjs
  45:1  error  'console' is not defined  no-undef
  46:1  error  'console' is not defined  no-undef
  47:1  error  'console' is not defined  no-undef
```

Cause: `eslint.config.js:157` gives browser globals to `apps/**/*.{ts,tsx}` and `:172` gives Node globals
to `scripts/**/*.mjs`. Nothing covers `apps/**/*.mjs`, and `apps/raw-demo/build.mjs` is the only file in
that set. One config entry fixes it.

This is `CR-ARCH01` §3.1, **still open**, though the config has changed shape since that file was written.

### 3.2 ⚠ BLOCKING — the bar planner contradicts both its own docblock and its test

```
$ pnpm test
  packages/core/src/families/bar/planner.test.ts:81
  - "position": "top"
  + "position": "right"
  Test Files  1 failed | 79 passed (80)
  Tests  1 failed | 1037 passed (1038)
```

`packages/core/src/families/bar/planner.ts:51-57` states the design intent — *"larger bars get a centered
top band where the identity is encountered before the marks"* — and `:71` returns `position: 'right'`.
The test at `:83` encodes the docblock. The docblock's reasoning is sound (reading order: identity before
marks), so the **code** is what is wrong, not the test.

⚠ There is a second-order consequence nobody has looked at: the same test asserts
`regionOrder === ['plot', 'legend', 'table']`, which is the *right*-legend order. If the legend moves to
the top, region order should be `['legend', 'plot', 'table']` or the reading-order argument in the
docblock does not actually hold. Fixing `position` alone would satisfy the assertion and leave the design
claim unmet.

This is `CR-ARCH01` §3.2, **still open and unchanged**.

### 3.3 ⚠ BLOCKING (process) — CI is red on every recent run while the docs read release-candidate

```
$ gh run list --limit 8
failure  merge: integrate responsive resize motion         Fine-Tuning-V1
failure  docs: professionalize integration assessment      codex/sb-008-line-milestone-1
failure  feat(SB-008): polish line chart presentation      codex/sb-008-line-milestone-1
failure  fix(SB-007): fit line plots to measured bounds    Fine-Tuning-V1
... 8 of 8 red
```

`research/93-free-v1-release-audit.md` records a green audit and an open version PR.
`research/90-final-delivery-and-agent-plan.md` §7 marks D1.1–D7.1, I1.1–I1.5, C1–C4 and E1.1–E1.4 as
`done`. Both were true when written. Neither is true of `645ac43`.

⚠ **The status documents are not lying; they are unguarded.** Nothing in this repository fails when a
`done` row stops being true. That is the same shape as the citation-rot problem — a claim that is checked
once and then trusted forever.

### 3.4 HIGH — G7 scans `packages/` only, so a live undefined token passes clean

`scripts/check-tokens.mjs:505` reads `process.argv[2] ?? join(REPO_ROOT, 'packages')`. CI and `verify`
both invoke it with no argument.

Reproduced: `apps/sandbox/src/sandbox.css:932` contains `gap: var(--shiftcharts-axis-rule-width)`. That
token is declared nowhere in `packages/tokens/src/themes/`. `pnpm lint:tokens` exits 0.

Repo-wide, 12 `var()` names resolve to nothing. **Eleven are deliberate planted fixtures** — ten inside
`scripts/check-tokens.test.mjs`, and one bare `var(--shiftcharts-surface)` in
`scripts/__fixtures__/deny-component.css:33`, planted next to a real `--shiftcharts-surface-color` so the
gate's own test proves it distinguishes them. **Exactly one is real**, and it is the one outside the
scanned tree.

⚠ The undefined-token rule was built in B1 slice 1 precisely to catch a misspelt `var()` that *"parses,
passes all four literal rules, builds, and paints nothing"* — the exact sentence at
`scripts/check-tokens.test.mjs:196`. It works. It is pointed at three-quarters of the repository.

### 3.5 HIGH — tree-shaking is proven for 3 of 8 families

`scripts/check-treeshake.mjs:161` declares `PRIMITIVE_ENTRYPOINTS` for `line`, `bar` and `donut`. Five
shipped families — `scatter`, `kpi`, `progress`, `heatmap`, `funnel` — have no public entrypoint and
therefore no proof that importing one does not pull the other seven.

This matters more than it sounds: the root barrel is runtime-dispatched and *must* carry every renderer,
so the named entrypoints are the only mechanism by which a consumer can pay for one family. Five-eighths
of the catalogue currently cannot be imported that way at all.

### 3.6 HIGH — G13 is specified at milestone D, D is marked done, G13 does not exist

`research/maps/04-ci-gate-map.md:102` specifies G13 as *"one screenshot per chart type per rung, pinned
Docker, chromium-only, `reducedMotion: 'reduce'`"*, protecting against *"geometry regresses in a way no
assertion names."*

`scripts/check-family-matrix.mjs:662` takes a screenshot and immediately discards the handle
(`void screenshot`). It writes `scripts/results/d0.2-family-matrix.latest.png` and compares it to nothing.
There is no baseline directory and no diff step anywhere in `scripts/`.

⚠ This is the gate whose absence is least visible and most expensive. Every other gate asserts a property
that someone could also have asserted in a unit test. G13 is the only one that catches the class of defect
the CR-VT01 audit found by *looking* — and CR-VT01 found nine.

### 3.7 MEDIUM — seven verification gates are wired to nothing

Scripts present in `scripts/`, not referenced by `package.json`, any workflow, or any other script:

| Script | The milestone whose evidence depends on it |
|---|---|
| `check-family-matrix.mjs` | D7.1 — complete family matrix |
| `check-grid-stress.mjs` | C4.2 — 1/10/50/100/200-widget stress |
| `check-interaction-browser.mjs` | I1.5 — keyboard/touch interaction matrix |
| `check-interaction-performance.mjs` | UX-PERF-01 |
| `check-scatter-interaction-performance.mjs` | UX-PERF-01 scatter baseline |
| `check-built-artifacts.mjs` | E1.1 |
| `check-package-metadata.mjs` | E1.2 |

`check-consumers.mjs` is the one exception — it is called from `check-package-gates.mjs`.

⚠ The `scripts/results/*.latest.json` files are real evidence that these ran *once*. That is the precise
distinction the repo already draws about provenance: a value that was verified once is not a value that is
checked. Seven milestones are currently `done` on the strength of a JSON file nothing regenerates.

### 3.8 LOW — 136 of 269 tokens have zero references

Declared 269, referenced 145, of which 12 resolve to nothing (§3.4). So 136 tokens exist, are generated
into CSS, are tiered, are named correctly, and are wired to no `var()` anywhere.

This is not necessarily wrong — B1 slice 3 deliberately transcribed the full `raw/06` surface so consumers
could override values the library had not yet consumed, and an unused override point is still an override
point. But it is worth stating plainly, because "269 tokens" and "133 working tokens" are very different
sentences to put in front of a user, and only one of them is true.

---

## 4. The one architectural thing I would have designed differently

**`marks.renderer` is a degradation contract that four families implement four different ways, and two of
those ways are an uncaught exception in a consumer's render.**

This is the finding `CR-ARCH01` did not have, and it is the deepest one in this document.

The rule is written once, in `packages/core/src/rungs/line.ts:85`:

```ts
return shape.points > policy.pointBudget ? 'canvas' : 'svg'
```

`DEFAULT_POLICY.pointBudget` is `2000` (`packages/core/src/policy.ts:312`), and `shape.points` is the
total across all series, not the longest one (`data.ts:104`). Families that seed from the line rungs
inherit this; `heatmap/planner.ts:379` repeats it independently.

Reproduced against the built `@shiftcharts/core`, one series of 2,001 points, Canvas-class box:

```
line      renderer=canvas  mark=line
scatter   renderer=canvas  mark=point
bar       renderer=canvas  mark=bar
donut     renderer=canvas  mark=arc
```

And then, on the render side:

| Family | Renderer behaviour above the budget | Location |
|---|---|---|
| `line` | Ignores `renderer` entirely. Draws 2,001 SVG points' worth of path. | `families/line/renderer.tsx` — the field is never read |
| `bar` | Ignores `renderer` entirely. Draws every rect. | `families/bar/renderer.tsx` — no `canvas` branch |
| `scatter` | **Throws.** `"scatter canvas rendering is not implemented; refusing to sample points."` | `families/scatter/renderer.tsx:15` |
| `donut` | **Throws.** `"donut canvas rendering is not implemented; refusing to rasterize arcs."` | `families/donut/renderer.tsx:31` |
| `heatmap` | **Throws.** | asserted in `families/heatmap/renderer.test.tsx:179` |

So `<AutoChart type="scatter" data={...2001 points} />` raises an exception during render. The same data
through `type="line"` renders fine and the `renderer: 'canvas'` field in its plan is simply false.

⚠ **Each individual decision is defensible and the composition is not.** *"Refuse rather than silently
sample"* is the right instinct and it is the same instinct that produced `PointMarks`' hard ceiling and
`planChart()`'s milestone throw. But it was applied per-family, at three different times, by whoever was
writing that family — and nothing in the system compares them. The result is that one plan field carries
two incompatible meanings ("I have degraded" vs "I have given up") and the caller cannot tell which
without knowing the family.

**What I would have built instead.** `renderer` should never have been a *capability* flag on the plan.
It should have been the outcome of an explicit degradation ladder, in `ChartPlan`, alongside
`valueLegibility` — which is already the library's model for *"say what this chart does and does not
claim."* Something in the shape of:

```ts
readonly density: {
  /** What the renderer must actually do. Never a capability the renderer may not have. */
  readonly strategy: 'draw-all' | 'aggregate' | 'refuse'
  /** Present iff strategy === 'refuse'. The reason, for the empty state to render as text. */
  readonly refusedBecause: 'over-point-budget' | null
}
```

Three properties fall out that the current field cannot give:

1. **`'refuse'` becomes a rendered state, not an exception.** The library already owns this concept —
   `@shiftcharts/grid`'s `WidgetStates` renders loading/empty/error/stale. A chart that will not draw
   2,001 scatter points should say so in the widget, not unmount the dashboard. An exception in a React
   render tree takes out every sibling widget that shares an error boundary, and the failure a consumer
   sees is a blank dashboard, not a blank chart.
2. **A gate becomes writable.** `invariants.test.ts` already sweeps every family × every rung. Adding
   *"for every family, at `pointBudget + 1`, resolve the plan and render it; assert the render does not
   throw"* is a dozen lines and would have caught all of this on the day scatter landed. The current
   contract cannot be gated because there is no statement of what correct looks like.
3. **`aggregate` stops being a second, unrelated mechanism.** `AggregatePlan` (`plan.ts`) already exists
   and `frame.ts:1793` already implements top-N-plus-remainder for donut. That is *exactly* the
   `'aggregate'` strategy, built for a different reason, sitting one field away and never consulted by the
   point-budget path.

**Migration cost is low and the risk is in the opposite direction from usual.** `renderer` is a plan field
with three real consumers (`interaction-policy.ts:25`, the two throwing renderers, and the treeshake
fixture). It has never shipped a canvas renderer, so nothing depends on the `'canvas'` value meaning
"canvas". Renaming it to a strategy that the renderers are all required to honour is a rename plus five
small renderer branches plus one invariant test.

---

## 5. What is absent that I would have built, and is not on any list

These are not defects in what exists. They are things I would expect a library at this maturity to have,
which no research document currently owes.

| Missing | Why it matters here specifically | Cost |
|---|---|---|
| **An automated accessibility gate** | `role="graphics-document"` is a *locked decision*, `93-free-v1-release-audit.md:74` admits no AT evidence exists, and there is no `axe`/`@axe-core/playwright` anywhere in the tree. Every other locked decision in this repo has a gate. This one has a docblock. A per-family axe pass inside `check-family-matrix.mjs` is the cheapest real coverage available. | ~half a day |
| **A performance budget** | The audit states it outright: *"the grid stress runner records measurements but defines no performance budget."* Three perf scripts write JSON that nothing reads and nothing thresholds. A budget is what turns a measurement into a gate. | ~half a day, after §3.7 |
| **Locale plumbing** | `format.ts` is hardcoded to d3's default (en-US grouping, `U+2212` minus) and UTC. UTC is *correct and load-bearing* — it prevents a hydration mismatch on every time axis — but the number format is a genuine gap, and it is a **plan-input** gap, not a presentation one: label width is measured from these exact strings, so a locale that groups with `.` or uses non-Latin digits changes fit-or-collide outcomes. It belongs in `PlanPolicy` beside `typography`, by the same argument `41-text-metrics.md` §2 makes for `font-feature-settings`. | ~1 day |
| **RTL** | `layout.ts` resolves `yAxisGutter` and legend bands as left/right, and `tooltip-placement.ts` has fixed rails. None is direction-aware. Same classification as locale: it changes geometry, so it is a plan input, not a stylesheet concern. | ~2 days |
| **A staleness gate for the status ledger** | §3.3's real fix. Something that reads the `done` rows in `90-final-delivery-and-agent-plan.md` and fails if the gate named by that row is not in `verify` or a workflow. It is the same gate shape as G20 — parse a research table, require each row to name something that exists. | ~half a day |

⚠ **I am not proposing all five.** The first and last are the two I would actually build, because they
close the two failure classes this document keeps re-finding: a locked claim with no gate, and a `done`
row with no gate.

---

## 6. The order I would do this in

1. **Get `verify` green.** §3.1 is one ESLint config entry. §3.2 is a one-line planner fix plus a decision
   about `regionOrder`. Until this is done every other gate result in this repository is unread, because
   nobody looks past a red build. *~1 hour.*
2. **Point G7 at the whole repo.** `pnpm lint:tokens .` and fix what falls out — one real undefined token
   at last count, plus whatever the planted fixtures need excluding. The gate exists and works; it is aimed
   wrong. *~1 hour.*
3. **Fix the density contract (§4).** Rename the field, make every family honour it, render a refusal
   instead of throwing, and add the `pointBudget + 1` invariant sweep. This is the only item here that
   changes a public type, so it should land before publish, not after. *~1 day.*
4. **Wire the seven orphan gates (§3.7)**, or delete them and demote the milestone rows they support.
   Either is honest; the current state is not. *~half a day.*
5. **Build G13.** Baseline PNGs per family per rung, pinned chromium, `reducedMotion: 'reduce'`, committed
   baselines, explicit `--update` flag. It is specified in full at `maps/04-ci-gate-map.md:102`; nobody has
   to design it. *~2 days.*
6. **Add the axe pass and the ledger-staleness gate (§5).** *~1 day.*
7. **Extend `PRIMITIVE_ENTRYPOINTS` to all eight families (§3.5).** Mechanical once §3 is green. *~half a day.*

Items 1 and 2 are prerequisites for trusting anything else. Item 3 is the only one that is a design change
rather than a repair.

---

## 7. Claims in this document I could not verify

- **Whether the 136 unreferenced tokens are intended.** B1 slice 3 transcribed the full `raw/06` surface
  on purpose, so most are presumably deliberate override points. I did not audit them individually.
- **Whether a real consumer hits the scatter throw in practice.** 2,001 *total* points across all series
  is easy to reach for scatter and effectively impossible for donut, so the severity is uneven across the
  two families that throw. I reproduced the plan and read the renderer; I did not mount a React tree.
- **CI failure causes beyond the two in §3.1 and §3.2.** I confirmed 8 of 8 runs red and reproduced two
  local failures. I did not read the hosted logs, so there may be more.
- **Browser-gate status.** Every browser gate (`lint:grid`, `lint:containment`, `lint:rsc`, `lint:motion`)
  needs Playwright and a fixture server. I did not run them.
