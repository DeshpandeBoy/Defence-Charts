# CR-ARCH01 — Build review: what was built, what I would have built, and what is missing

Status: proposal for coordinator review
Date/access window: 2026-09-01, single session, repository-only
Repository baseline: branch `Fine-Tuning-V1`, commit `645ac43`, tree clean at start and at finish
Method: static read of all 7 packages and 4 apps, plus `pnpm install --frozen-lockfile`, `pnpm verify`,
`pnpm test`, `pnpm lint:tokens`, and `gh run view` against the last 8 CI runs. Every number below was
produced by a command in this session, not carried over from a document.

---

## 0. The one-paragraph verdict

The build is **substantially better than the plan I was holding**, and it is **not shippable today**.
Those are separate findings and neither cancels the other. The architecture arrived at a seam design
(`family-seam.ts` / `planner-registry.ts` / `renderer-seam.ts`) that is cleaner than the rung-set
dispatch I had specified, and `invariants.test.ts` asserts properties I had not thought to assert.
Against that: `pnpm verify` is **red on the committed tree**, the last **8 of 8** CI runs failed, and
`docs/content/docs/index.mdx:62` tells the public that milestone E is a "Release candidate". The gap
between the third fact and the first two is the most important thing in this document.

---

## 1. Scale, measured

| Metric | Value | How obtained |
|---|---|---|
| Packages | 7 (`core`, `primitives`, `react`, `grid`, `motion`, `tokens`, `testing`) | `ls packages` |
| Apps | 4 (`playground`, `sandbox`, `raw-demo`, `rsc-fixture`) | `ls apps` |
| Source lines (ts/tsx/css/mjs) | ~50,020 | `wc -l` over non-`node_modules` sources |
| Test files | 80 | `vitest run` |
| Tests | 1,038 — **1,037 pass, 1 fails** | `pnpm test` |
| Gate scripts | 33 `scripts/check-*.mjs` | `ls` |
| Chart families in core | 8 | `planner-registry.ts:80` |
| Mark renderers in primitives | 7 | `renderer-registry.ts:22` |
| Public family entrypoints | 3 | `check-treeshake.mjs:161` |
| Tokens defined | 269 | `packages/tokens/src/themes/*.css` |
| Tokens referenced anywhere | 133 | repo-wide `var(--shiftcharts-*)` scan |

My plan file estimated bar + KPI as the next 8–12 focused days of work. What actually landed is bar,
timebar, donut, KPI, progress, scatter, heatmap and funnel, plus a grid package, a motion package and
a full interaction layer. **The estimate was not wrong about the rate; it was wrong about the scope,
and in the generous direction.** I am recording that plainly because the reverse error is the one
that costs money.

---

## 2. Three places the build beat the plan

These are not courtesies. Each one is a design I would now adopt over what I had written.

### 2.1 The family seam is better than my rung-set dispatch

I had planned `packages/core/src/rungs/bar.ts` as a sibling of `rungs/line.ts`, with `plan-chart.ts`
growing a `switch`. What exists instead is a two-layer split:

- `family-seam.ts` — the *contract*: `FamilyPlanner`, `PlannerRegistration`, `BuiltInPlannerRegistry`.
- `planner-registry.ts` — the *table*: a frozen literal tuple of 8 entries.

The docblock at `planner-registry.ts:5` states the property that makes this worth having: *"There is
no runtime registration, mutable map, or side-effect import to make a family discoverable."* A family
becomes reachable only by adding a visible line to a frozen array. My `switch` would have had the same
effect by accident; this has it by construction, and it says so.

`renderer-seam.ts` mirrors it on the primitives side with `MarkRendererRegistration`, and
`renderRegisteredMark` throws by name rather than falling through (`renderer-seam.ts:40`). That is the
same anti-silent-fallback discipline `plan-chart.ts` already had, applied one layer down.

### 2.2 `invariants.test.ts` asserts things I had not planned to assert

476 lines of cross-family property tests. Three stand out:

- `:218` — the plan deep-equals itself after `JSON.parse(JSON.stringify(plan))`. That is §1.4
  serialisability as an executable claim rather than a promise.
- `:229` — no `undefined`, `NaN`, `Infinity` or non-plain value anywhere in the tree.
- `:296` — *"no key anywhere in the tree could change the measured box"*, immediately followed by
  `:310` — *"would catch one if it were added"*.

That last pair is decision 015 (*a gate never seen to fail is not a gate*) applied to a **test**, not
just to a CI gate. I had scoped 015 to gates only. Applying it to property tests is a genuine
extension of the idea and I would carry it forward.

### 2.3 KPI as composition, stated and enforced

`packages/primitives/src/families/kpi/README.md` opens: *"KPI is a composition, not a new SVG mark."*
There is deliberately **no** KPI entry in `renderer-registry.ts` — the value region is `ValueDisplay`,
the trend is the existing `line` mark with axes suppressed, the text equivalent is `DataTable`.

This is exactly what `research/10-responsive-ladder.md:233` demanded (*"This type is the proof that
widget = composition, not a single mark"*), and the absence from the renderer registry is the
enforcement. My plan had KPI as `rungs/kpi.ts` — a fourth rung set. That would have been wrong, and
this file explains why in three sentences.

---

## 3. Defects found — each reproduced, each with a location

### 3.1 ⚠ `pnpm verify` fails on the committed tree — BLOCKING

Working tree clean (`git status --short` empty), fresh `pnpm install --frozen-lockfile`, then:

```
apps/raw-demo/build.mjs
  45:1  error  'console' is not defined  no-undef
  46:1  error  'console' is not defined  no-undef
  47:1  error  'console' is not defined  no-undef
✖ 3 problems (3 errors, 0 warnings)
```

**Root cause,** at `eslint.config.js`:

- `:158` gives Node/browser globals to `apps/**/*.{ts,tsx}` — **`.mjs` is not in that extension list.**
- `:172` gives Node globals to `scripts/**/*.mjs` — **`apps/**` is not in that path list.**

`apps/raw-demo/build.mjs` falls between the two blocks and gets no globals at all. The file is tracked
and was committed in `5aa567a` ("feat: enhance bar chart rendering and add raw-demo app"). This is the
signature failure species this repo already knows: a new file arriving through the one door no config
block watches.

**Fix (one line):** widen `:172` to `files: ['scripts/**/*.mjs', 'apps/**/*.mjs', '*.config.ts', ...]`.

### 3.2 ⚠ The bar planner contradicts its own docblock — BLOCKING

The single failing test, reproduced locally:

```
FAIL packages/core/src/families/bar/planner.test.ts
  > keeps negative values on a zero-baseline contract and groups multiple series
  {
    "placement": "external",
-   "position": "top",      ← expected
+   "position": "right",    ← received
  }
```

This is not a stale snapshot. Read `packages/core/src/families/bar/planner.ts:51-57` — the docblock
that explains *why* bar needs its own legend rule:

> *"…larger bars get a centered **top** band where the identity is encountered before the marks."*

Then read `:72-79`, the code it describes:

```ts
if (input.ctx.sizeClass === 'panel' || 'canvas' || 'stage') {
  return Object.freeze({ placement: 'external', position: 'right', … })
}
```

**The docblock says `top`. The test says `top`. The implementation says `right`.** Two of three
artifacts agree, and they are the two that record intent. This reads as an implementation edit that
never went back to the reasoning — so the fix is almost certainly `'right'` → `'top'` at
`planner.ts:75`, not a test update. ⚠ **Do not "fix" this by editing the test.** That would silently
delete the design argument at `:51-57`, and the argument is the more valuable artifact.

### 3.3 ⚠ CI has been red for 8 consecutive pushes while the docs claim release-candidate

```
33513672600  failure  merge: integrate responsive resize motion       2026-09-01
33513593236  failure  docs: professionalize integration assessment    2026-09-01
33329345168  failure  feat(SB-008): polish line chart presentation    2026-08-30
33326539714  failure  fix(SB-007): fit line plots to measured bounds  2026-08-30
33325254172  failure  docs(handoff): record Claude test package       2026-08-30
33320795790  failure  feat: add seriesLabelMaxChars to LabelsPlan     2026-08-30
33315900999  failure  feat: implement tooltip timing tokens           2026-08-30
33307455801  failure  feat: enhance tooltip and interaction overlay   2026-08-30
```

Eight of eight. On the latest run the `browser` job (G4, G11, C4.1, G19) is **green**; the `verify`
job fails at exactly the two steps in §3.1 and §3.2 and nothing else.

Meanwhile `docs/content/docs/index.mdx:62` publishes:

| E | Release candidate | Built artifacts, package gates, consumer tarballs, Changesets, and trusted-publish workflow |

⚠ **This is the finding that matters most, and it is not a lint error — it is a process failure.**
A red CI that stays red stops being a signal and becomes wallpaper. The repo's own decision 015 says a
gate never seen to fail is not a gate; the corollary this build has walked into is that **a gate always
seen to fail is also not a gate**. Two genuinely trivial defects (one ESLint glob, one string literal)
have been masking the entire verify job for three days.

### 3.4 Gate G7 does not scan `apps/` — it reports clean over a token that does not exist

```
$ pnpm lint:tokens
token gate: 9 stylesheet(s) clean against 269 declared token(s).
```

But `apps/sandbox/src/sandbox.css:932` contains:

```css
gap: var(--shiftcharts-axis-rule-width);
```

and `--shiftcharts-axis-rule-width` is defined nowhere in `packages/tokens/src/themes/`. It resolves
to nothing and the rule silently drops.

**Root cause:** `scripts/check-tokens.mjs:505` —
`const target = process.argv[2] ?? join(REPO_ROOT, 'packages')`. The default scan root is `packages/`.
CI invokes `pnpm lint:tokens` with no argument (`ci.yml`), so `apps/` is never walked.

This is precisely the hole G7's own docblock claims to have closed at B1: *"a token could be
documented, referenced, and absent."* The membership rule was built correctly and then pointed at
three quarters of the tree. **Fix:** scan `packages` and `apps` (and `docs/src`), or make the CI
invocation pass explicit roots.

### 3.5 Tree-shaking holds for 3 of 8 families

`check-treeshake.mjs:161` declares `PRIMITIVE_ENTRYPOINTS` for `line`, `bar`, `donut` only.
`packages/primitives/package.json` exposes matching subpaths `./line`, `./bar`, `./donut`.

But `renderer-registry.ts:22` registers **seven** renderers, and `scatter`, `heatmap`, `funnel` and
`progress` have no subpath. A consumer importing a scatter chart goes through the root barrel and
therefore ships all seven renderers. The gate does not catch this because the missing entrypoints are
absent from the list it iterates — **it verifies the three that exist rather than that the set is
complete.**

The promise in `20-architecture.md` is *"import one chart, ship one chart."* It currently holds for
37.5% of the catalogue. This is not a correctness bug; it is a claim that is broader than its proof.

### 3.6 G13 (visual regression) is specified at milestone D, D is marked Implemented, G13 does not exist

`research/maps/04-ci-gate-map.md:102`:

| G13 | One screenshot per chart type per rung, pinned Docker, chromium-only, `reducedMotion: 'reduce'` | **D** | ladder | Geometry regresses in a way no assertion names |

There is no `scripts/check-visual*.mjs`, no VRT baseline directory, and no CI step. `grep -rl G13`
across `scripts/` and every test file returns **nothing** — the only occurrences in the repo are in the
gate map that specifies it. `docs/content/docs/index.mdx:61` marks D "Implemented".

The rationale column is the reason this matters: *"geometry regresses in a way no assertion names."*
Eight families now ship. The gate designed to catch what the other gates structurally cannot is the
one that did not get built, and it became more necessary with every family added.

### 3.7 Seven gate scripts are wired to nothing

Not in `package.json` scripts, not in any workflow, not imported by another gate (verified by
`grep -rl` across `scripts/*.mjs`, `package.json`, `.github/workflows/`):

```
check-family-matrix.mjs                    check-interaction-browser.mjs
check-built-artifacts.mjs                  check-interaction-performance.mjs
check-package-metadata.mjs                 check-scatter-interaction-performance.mjs
check-grid-stress.mjs
```

(`check-consumers.mjs` is *not* in this list — it is invoked from `check-package-gates.mjs:17`.)

Some of these have their own passing test files, which makes it worse rather than better: the tests
prove the gate logic works, and nothing proves the gate runs.

### 3.8 137 of 269 tokens have zero references

Expected in part — a token tree is a public API and consumers reference names the library does not.
But 51% unreferenced is high enough that some fraction is dead rather than public, and there is
currently no way to tell which. Worth a census before 1.0 freezes the names.

---

## 4. Divergences from my plan that are neutral or better

Recorded so the coordinator can see what changed, not as criticism.

| My plan | What was built | Assessment |
|---|---|---|
| `rungs/bar.ts`, `rungs/kpi.ts` as sibling rung sets | Families compose `line.ts` rungs as a *seed*, then replace family-specific fields | **Better.** Keeps "six size contracts" literally one implementation. |
| Transpose triggered at 10 categories | Transpose falls out of `degradeXLabels` px budget (`layout.ts:518,548`) | **Better, and it followed the research correction.** `10-responsive-ladder.md:185` flagged the 10-category heuristic as UNVERIFIED Basedash product convention and said *"let collision detection be the real trigger."* The build did that. |
| `Chart.tsx` `switch` on mark kind | `renderRegisteredMark` over a frozen registration list | Better; same reasons as §2.1. |
| Motion inside `@gx/primitives` | Separate `@shiftcharts/motion` package | Neutral-to-better. Keeps primitives hook-free by construction rather than by review. |
| `--gx-` token prefix | `--shiftcharts-` | Neutral. Prefix is the namespace either way. |
| Name unresolved (`curvature-gx` never evaluated) | **ShiftCharts**, `@shiftcharts/*`, declared final | Resolved. Good tagline in `package.json`: *"charts that shift with their space."* |

One note on `docs/src/components/resize-lab.tsx`, which you referenced: it is a good demo and it does
the honest thing at `:46-47` — it calls `sizeContextFromPixels` + `planChart` itself purely to *read
back* `plan.sizeClass`, `plan.marks.primary.kind`, `plan.legend.placement` and `plan.dataTable.present`
for the readout, while `<AutoChart>` at `:96` does the real render. Two plan resolutions for one
visible chart is exactly what `App.tsx:29` warned about (*"two components each resolving their own plan
would put two disagreeing plot heights on one page"*), and here it is safe **only because the second
resolution is never used for geometry.** That safety is currently a property of how the file happens to
be written, not something any gate asserts. If a future edit feeds `plan` into a style or a size, the
warning comes true silently. Worth a comment at `:47` saying so.

---

## 5. What I would build next, in order

Sequenced by what unblocks what. The first two are hours, not days.

### Step 1 — Get verify green (est. 30 minutes)

1. `eslint.config.js:172` — add `'apps/**/*.mjs'` to the Node-globals `files` array.
2. `packages/core/src/families/bar/planner.ts:75` — `position: 'right'` → `position: 'top'`, matching
   the docblock at `:51-57` and the test at `planner.test.ts:83`.
3. Push, confirm the first green CI run since 2026-08-29.

⚠ Nothing else on this list should start before this finishes. Every subsequent item is verified by a
chain that currently cannot report success, and adding work to a red pipeline is how §3.3 happened.

### Step 2 — Close the two gate holes the defects exposed (est. half a day)

**G7 scan scope.** Change `check-tokens.mjs:505` to walk `packages`, `apps` and `docs/src` by default.
Then, per decision 015, **plant it red first**: confirm it fails on the live
`--shiftcharts-axis-rule-width` reference at `apps/sandbox/src/sandbox.css:932` *before* defining the
token. A membership gate that has never rejected an absent token is not a membership gate.

Then define `--shiftcharts-axis-rule-width` in `packages/tokens/src/themes/theme.css` (or replace the
usage — `gap` taking an axis-rule width reads like a copy-paste rather than an intent, and that should
be decided, not defaulted).

**G5 entrypoint completeness.** Add a check that `PRIMITIVE_ENTRYPOINTS` covers every family in
`BUILT_IN_MARK_RENDERERS`. The assertion is the set equality, not the per-entry probe:

```js
const registered = new Set(BUILT_IN_MARK_RENDERERS.map(r => r.family))
const probed     = new Set(PRIMITIVE_ENTRYPOINTS.map(e => e.name.split('/').pop()))
// symmetricDifference must be empty, and the gate prints it when it is not
```

That turns §3.5 from a silent shortfall into a build failure the moment family nine lands without an
entrypoint. Then add the four missing subpaths (`./scatter`, `./heatmap`, `./funnel`, `./progress`)
and their `package.json` exports.

### Step 3 — Build G13, the gate that was specified and skipped (est. 2 days)

This is the largest genuine gap and the rationale in the gate map is still correct: *geometry
regresses in a way no assertion names.* With 8 families × 6 rungs the surface is now 48 cells, which
is exactly when a human stops noticing a 3px drift.

Design, following the gate map's own constraints:

- **Fixture:** extend `apps/playground/src/family-matrix/` — it already renders the cross-family
  matrix, and `scripts/check-family-matrix.mjs` already exists (and is orphaned per §3.7, so this
  wires it up as a side effect).
- **Determinism:** the plan is already platform-independent by construction — G2 bans DOM measurement
  in core and text width comes from `ROBOTO_FLEX_METRICS`. G4 and G11 already produce byte-identical
  numbers on macOS and Linux. **That property is what makes VRT viable here and flaky elsewhere**, and
  it should be stated in the gate's docblock so nobody later "helpfully" adds a measurement call.
- **Pinned:** Playwright 1.62.1 is already a real dependency with a cached Chromium in the browser job.
  Add `reducedMotion: 'reduce'` per the map, and run in the existing container.
- **Baselines:** 48 PNGs, committed. Threshold zero — with deterministic geometry, any diff is a real
  diff, and a nonzero threshold is where flaky VRT starts.
- **Plant it red:** shift one tick by 1px and watch it fail before committing the baselines.

### Step 4 — Wire or delete the six remaining orphan gates (est. half a day)

For each of `check-family-matrix`, `check-built-artifacts`, `check-package-metadata`,
`check-grid-stress`, `check-interaction-browser`, `check-interaction-performance`,
`check-scatter-interaction-performance`: either add it to `verify`/CI, or delete it. A gate script that
exists and does not run is worse than no script, because its presence in `ls scripts/` reads as
coverage. ⚠ The two `interaction-performance` ones may be deliberately manual (perf gates are
legitimately noisy in CI) — if so, that decision belongs in a docblock in the file, not in the absence
of a CI line.

### Step 5 — Reconcile the public status table (est. 1 hour, but do it last)

`docs/content/docs/index.mdx:48-62` currently claims D Implemented and E Release candidate. After
steps 1–4, D is genuinely implemented (G13 exists) and E's claim is defensible. **Doing this before
steps 1–4 would be the wrong order** — the table is not wrong because it is badly worded, it is wrong
because the work behind two of its rows is incomplete. Fix the work, then the table becomes true
without editing the claim.

---

## 6. Summary table

| # | Finding | Severity | Location |
|---|---|---|---|
| 3.1 | `pnpm verify` red — `apps/**/*.mjs` gets no ESLint globals | **Blocking** | `eslint.config.js:158,172` |
| 3.2 | Bar legend `position` contradicts its own docblock and its test | **Blocking** | `families/bar/planner.ts:75` vs `:51-57` |
| 3.3 | 8/8 recent CI runs red while docs claim release-candidate | **Blocking (process)** | `docs/content/docs/index.mdx:62` |
| 3.4 | G7 defaults to `packages/`; a live undefined token passes clean | High | `check-tokens.mjs:505`; `sandbox.css:932` |
| 3.5 | Tree-shaking entrypoints cover 3 of 8 families | High | `check-treeshake.mjs:161` |
| 3.6 | G13 specified at D, D marked Implemented, G13 absent | High | `maps/04-ci-gate-map.md:102` |
| 3.7 | 7 gate scripts wired to nothing | Medium | `scripts/` |
| 3.8 | 137/269 tokens unreferenced | Low | `packages/tokens/src/themes/` |
| 4 | `resize-lab.tsx` double-resolves the plan; safe only by convention | Low | `docs/src/components/resize-lab.tsx:46` |

**Total to green + honest:** roughly 3 focused days, of which ~30 minutes clears the blocking two.

---

## 7. Claims in this document I could not verify

Stated per the workstream contract so the coordinator does not have to re-derive the boundary.

- **Whether `'top'` or `'right'` is the correct bar legend position** — I verified only that the
  docblock and the test agree with each other and disagree with the code. Which is *right* is a design
  call I did not make; I am reporting that two of three artifacts encode the same intent.
- **Whether the 7 orphan gates are abandoned or deliberately manual.** I verified they are unreachable
  from `package.json` and CI. Intent is not recoverable from the source.
- **Whether the 137 unreferenced tokens are public API or dead.** Distinguishing them needs the token
  provenance census, which is outside this task's read set.
- **Browser-gate behaviour on this branch.** I did not run G4/G11/C4.1/G19 locally; the CI record shows
  the `browser` job green on run `33513672600`, and I am reporting that record rather than a local run.
