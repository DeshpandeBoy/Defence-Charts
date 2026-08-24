# CR-C01 (ledger R1) — Current RGL version and adapter viability

Status: proposal for coordinator review
Date/access window: 2026-08-24, single session, local installed-package inspection only (no network
retrieval — the installed package tree and its bundled README/CHANGELOG were sufficient primary
source for every claim below; none required fetching npm/GitHub)
Repository baseline: branch `Anti-gravity-and-other-Agent-changes`, at the commit this task's handoff
was dispatched from (`c11ba60`); the live tree has since advanced past this point (see the P0.2
handoff for the concurrent-activity note) but nothing under `packages/grid` or `node_modules` changed
during this task

## Exact question and exclusions

Using official source/docs/changelog and the installed package, verify the exact `react-grid-layout`
version and the two relevant subpath boundaries locked by decision 6 — algorithms/types under
`./core`, `GridLayout`/hooks/components under `./react` — and cover React 19 behavior, controlled
layout, SSR/import safety, transforms, collision, compaction, serialisation assumptions, keyboard
gaps, and exit strategy. Excluded: reopening the engine choice itself (decision 6 is locked; this task
only verifies the boundary it names) and any 6/18-column profile question (that is `CR-C02`'s scope).

## Current repository evidence

- `packages/grid/package.json` declares `react-grid-layout` as a dependency; `packages/grid/src/index.ts`
  currently exports only `GRID_COLUMNS = 12` — no layout component exists yet (C1 has not started).
  Its docblock already asserts three of this task's conclusions ahead of verification: that the grid
  reports size and never decides chart content, that `./core` (not the default export) is the intended
  import, and that RGL ships no `"use client"` directive. All three are confirmed below.
- Installed package: `node_modules/.pnpm/react-grid-layout@2.2.4_react-dom@19.2.8_react@19.2.8__react@19.2.8/`
  — i.e., pnpm resolved `react-grid-layout@2.2.4` against `react@19.2.8`/`react-dom@19.2.8`, confirming
  the workspace is actually installing and resolving the pinned version against real React 19 peers
  right now, not merely declaring compatibility on paper.
- `packages/core/src/plan-chart.ts` and all six `packages/*/package.json` were independently re-checked
  in the sibling `CR-000` task this session and are consistent with this task's scope (grid is a stub;
  D chart types are unimplemented).

## External evidence

All rows below are **Official implementation** evidence: read directly from the installed
`react-grid-layout@2.2.4` package's own `package.json`, `README.md`, `CHANGELOG.md`/RFC docs, and
compiled `dist/*.d.ts`/`dist/*.js` output — the same artifact a real consumer installs, not a
paraphrase of it.

| Claim | Class | Source/version/date | What it supports | What it does not support |
|---|---|---|---|---|
| Package exposes five subpaths: `.`, `./core`, `./react`, `./legacy`, `./extras`, plus `./css/styles.css` | Official implementation | `react-grid-layout@2.2.4` `package.json` `exports` map (installed copy) | Decision 6's `./core`/`./react` boundary exists exactly as named; `./legacy` is a documented v1-API escape hatch, `./extras` a separate opt-in (fast compaction) | Does not confirm runtime purity of `./core` on its own — see next row |
| `./core`'s compiled output (`core.js`, `core.mjs`) contains zero occurrences of `require("react")`/`from "react"` | Official implementation | grep of installed `dist/core.js`, `dist/core.mjs` | `./core` is genuinely framework-agnostic — algorithms (`collides`, `getAllCollisions`, compactors, `calcGridItemPosition`, etc.) and types only, importable in a non-React/Node context | Does not prove every internal helper is side-effect-free beyond the absence of a React import |
| `./react`'s compiled chunks (`chunk-BMN6M2VL.js`, `chunk-QAWP6PEK.js`, which back `GridItem`, `GridLayout`, `useContainerWidth`, `useGridLayout`, `useResponsiveLayout`) call `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo` | Official implementation | grep of installed `dist/chunk-*.js` | `./react` is genuinely client-only; a `"use client"` boundary is required wherever it is re-exported | — |
| No file in the installed `dist/` tree contains the string `"use client"` | Official implementation | grep across `dist/*.js`, `dist/*.mjs` | Confirms `@gx/grid`'s own docblock claim: RGL ships no directive of its own; `@gx/grid` must supply it | — |
| `package.json` `peerDependencies`: `"react": ">= 16.3.0"`, `"react-dom": ">= 16.3.0"` | Official implementation | installed `package.json` | The declared peer range includes React 19 | The package's own `devDependencies` pin `"react": "^18.3.1"` / `"react-dom": "^18.3.1"` — RGL's *own* CI/test suite, as shipped, runs against React 18, not 19. React 19 compatibility is covered by a broad peer range plus downstream fixes in its drag/resize dependencies (next row), not by RGL's own first-party test matrix |
| README compatibility table: `>= 2.0.0 → React 18+, TypeScript`; `>= 0.17.0 → React 16 & 17` | Official implementation | `react-grid-layout` `README.md` (installed copy) | An explicit, first-party compatibility statement | Phrased as "React 18+" — an inclusive floor, not an explicit "React 19 tested" claim |
| `react-draggable@4.7.1` (RGL's drag dependency, resolved from RGL's declared `^4.4.6`) `CHANGELOG.md`: v4.6.0 — *"Internal: Support React 19 (dependency upgrade and nodeRef-based browser tests)"* | Official implementation | `react-draggable` `CHANGELOG.md` (installed copy) | An explicit, dated, first-party React 19 support claim for the package RGL uses internally for drag | Dated in the package's own changelog, not independently reproduced by a test in this repository |
| RGL's own compiled `GridItem` chunk uses `nodeRef` (found via grep) and contains zero occurrences of `findDOMNode` anywhere in `dist/*.js` | Official implementation | grep of installed `dist/chunk-QAWP6PEK.js` and all `dist/*.js` | RGL already uses `react-draggable`'s modern `nodeRef` API, avoiding the `ReactDOM.findDOMNode` deprecation warning that `react-draggable`'s own CHANGELOG documents as a Strict Mode concern | — |
| README Features list: *"Compatible with server-rendered apps"* and *"Compatibility with `<React.StrictMode>`"* | Official implementation | `react-grid-layout` `README.md` | First-party SSR and Strict Mode claims | "Server-rendered" here means classic SSR-with-hydration (the component is `"use client"`-shaped internally, per the hook usage above), **not** an RSC/zero-JS claim — decision 7's zero-JS boundary is a `@gx/core`/`@gx/primitives` property, not something RGL itself provides or needs to |
| README: `useContainerWidth({ measureBeforeMount?: boolean })`, doc comment *"Delay render until width is measured. Useful for SSR"*; README table row `SSR → v2 with measureBeforeMount: true` | Official implementation | `react-grid-layout` `README.md` and `dist/react.d.ts` | An explicit, named SSR pattern: measure-before-mount avoids a 0-width flash on first client paint | Does not by itself make the grid RSC-safe; it addresses the client-hydration flash, a different problem than server-only zero-JS rendering |
| `GridLayoutProps` (from `dist/ResponsiveGridLayout-*.d.ts`): `layout?: Layout` plus `onLayoutChange?: (layout: Layout) => void`; `useGridLayout()` hook: `layout`, `setLayout`, `onLayoutChange` | Official implementation | `react-grid-layout` compiled type declarations | Standard React controlled-component shape: the host owns `layout` state and must call its own setter from `onLayoutChange` for the grid to reflect a move/resize — RGL does not silently mutate host state | If the host does not feed `onLayoutChange`'s result back into the `layout` prop, the grid will not visually update after a drag/resize — this is a real integration requirement CR-C03 must specify, not an edge case |
| README "Compaction" section: pluggable `Compactor` interface; named `verticalCompactor`, `horizontalCompactor`, `noCompactor`, plus a documented *"Optional fast O(n log n) algorithm in `/extras`"* | Official implementation | `react-grid-layout` `README.md`, RFC 0001 linked from it | Collision/compaction is swappable, not hard-coded; the default path is used unless `@gx/grid` opts into `/extras` | `/extras`'s performance characteristics were not independently benchmarked in this pass |
| README migration table cites `rfcs/0001-v2-typescript-rewrite.md` for every v1→v2 breaking change (required `width` prop, 3px drag threshold, immutable callback params, `data-grid` moved to `/legacy`, pluggable compaction, UMD removal, `verticalCompact` removal) | Official implementation | `react-grid-layout` `README.md` and its bundled RFC doc | A first-party, itemized breaking-change list — useful directly as C0.2's adapter-boundary checklist | RFC doc content beyond the table headings was not independently re-read line by line in this pass |
| README has zero occurrences of "keyboard" or "accessib" across 1,313 lines | Official implementation | grep of `react-grid-layout` `README.md` | Confirms the "keyboard gaps" premise in `CR-C04`'s brief: RGL documents no built-in keyboard move/resize story | Absence of the word is evidence of an undocumented feature, not proof no keyboard handling exists anywhere in the source — this pass did not exhaustively read the drag/resize implementation for incidental `onKeyDown` handlers |
| README `Migrating from v1`: `react-grid-layout/legacy` gives *"100% runtime API compatibility"* with the pre-2.0 API | Official implementation | `react-grid-layout` `README.md` | A documented, low-risk exit path if the v2 `./core`+`./react` adapter proves unworkable: fall back to `./legacy` without leaving the package | `./legacy`'s own maintenance status/lifespan versus `./core`+`./react` was not separately investigated |

## Retrieval log

| Source sought | Result | Limitation |
|---|---|---|
| `react-grid-layout` `package.json`, `README.md`, compiled `dist/` | Found and read locally (installed copy) | This is the artifact actually resolved into the workspace; sufficient as primary evidence for what ships, but is not the live npm registry page or GitHub Releases feed, so a newer upstream release published after installation would not be reflected |
| `react-grid-layout` `CHANGELOG.md` | Not present in the installed package (`ls` found no `CHANGELOG*` file at the package root) | The "2.2.0 critical layout bug" fact already recorded in `00-decisions.md` decision 6 could not be independently re-verified against a first-party changelog entry in this pass; it remains a locked-decision fact, not re-derived here |
| `react-draggable` `CHANGELOG.md` | Found and read locally (installed copy, resolved version 4.7.1) | Sufficient for the React 19 support claim; not cross-checked against the live GitHub release notes |
| npm registry / GitHub Releases (live, for a freshness check beyond 2.2.4) | Not attempted | Out of scope for this pass, which is bounded to "the installed package" per the CR-C01 brief; a freshness check belongs with `CR-E04` (publication refresh) |

## Alternatives

- **Import the default `.` export instead of `./core`+`./react`.** Rejected: the default export's
  `dist/index.js` re-exports the same client-hook-bearing symbols as `./react` with no clearer
  boundary, and importing it would blur exactly the line decision 6 asks C0 to keep explicit.
- **Use `./legacy` now instead of the v2 API.** Rejected as the default path — v2's typed, pluggable
  `Compactor`/`LayoutConstraint` surface is a better fit for `@gx/grid`'s own constraint work
  (per `packages/grid/src/index.ts`'s docblock on per-widget minimum sizes). `./legacy` remains the
  documented exit strategy if the v2 adapter proves unworkable, not the primary plan.
- **Vendor/fork RGL to add first-party keyboard support.** Out of scope for this task; recorded here
  only because the README's silence on keyboard access is exactly the gap `CR-C04` is tasked to design
  a fallback for at the `@gx/grid` layer.

## Recommendation and confidence

Decision 6 stands as verified, not merely asserted: the installed `react-grid-layout@2.2.4` package
genuinely splits a React-free `./core` (algorithms/types) from a client-only `./react`
(components/hooks), ships no `"use client"` directive of its own, and its drag dependency
(`react-draggable@4.7.1`) carries a dated, first-party React 19 support note. **Confidence: high** for
the subpath boundary and the "no `use client"` directive" claims (directly grepped from the exact
installed artifact). **Confidence: medium** for "React 19 is fully supported" as a general claim —
RGL's own peer range and its dependencies' changelogs support it, but RGL's own devDependencies/test
suite still target React 18, so this is inference from adjacent evidence, not a first-party "tested
against React 19" statement from the `react-grid-layout` project itself.

## Conflicts with locked/current decisions

None. This task confirms decision 6's two-subpath boundary rather than challenging it, and confirms
the 12-column base grid is unaffected (this task did not touch the 6/18-column question, which is
`CR-C02`'s scope).

## Unknowns

- Whether `react-grid-layout` has published a version newer than 2.2.4 since this workspace's
  lockfile was generated — not checked in this pass (see Retrieval log); belongs with `CR-E04`.
- Whether `./extras`'s fast O(n log n) compactor has a measurable performance difference from the
  default at the widget counts `C4.2`'s stress test will exercise (1/10/50/100/200) — not benchmarked
  here.
- Whether any incidental keyboard handling exists inside RGL's drag/resize implementation beyond what
  the README documents — this pass checked documentation, not the full source of
  `chunk-QAWP6PEK.js`'s minified drag/resize logic line by line.
- The first-party `react-grid-layout` CHANGELOG (needed to re-verify the 2.2.0 bug fact independently)
  was not present in the installed package and was not fetched from the network in this pass.

## Affected APIs, files, tests and docs

- `packages/grid/src/index.ts` — C1.1 will need to import from `react-grid-layout/core` for
  algorithms/types and `react-grid-layout/react` for `GridLayout`/hooks, re-exporting the latter behind
  `@gx/grid`'s own `"use client"` directive (already present at the top of the file).
- `packages/grid/package.json` — dependency is already declared; no change needed from this task.
- C0.2 (pin and prove the RGL adapter boundary) can cite this file directly as its verification
  evidence rather than re-deriving it.
- `CR-C03` (layout persistence) should account for the controlled `layout`/`onLayoutChange` contract
  documented above: the host must feed `onLayoutChange`'s output back into the `layout` prop for the
  grid to reflect changes — this is a concrete acceptance-test requirement, not a nice-to-have.
- `CR-C04` (keyboard/touch/drag accessibility) can cite the README's zero keyboard/accessibility
  mentions as the evidence baseline for why `@gx/grid` must supply its own keyboard fallback layer.

## Implementation acceptance checklist

- [ ] C0.2 imports algorithms/types only from `react-grid-layout/core` and components/hooks only from
      `react-grid-layout/react`, never the default `.` export.
- [ ] C0.2 records the exact pinned version (`2.2.4`) in the adapter's own comments/tests, matching
      what is actually installed (not a version range).
- [ ] `@gx/grid`'s public entry keeps its `"use client"` directive at the top, since neither RGL's
      default export nor `./react` supplies one.
- [ ] C1.1's controlled-grid wrapper feeds `onLayoutChange`'s result back into the `layout` prop
      itself; a test asserts that omitting this produces a visibly stale grid (documenting the
      requirement, not silently working around it).
- [ ] C3.1 (keyboard move/resize) treats RGL as providing zero keyboard behavior by default and
      builds the entire keyboard path at the `@gx/grid` layer.
- [ ] C0.2 or a later task independently re-confirms the "2.2.0 critical layout bug" fact from
      `00-decisions.md` decision 6 against a first-party changelog before any version bump is
      considered, since this pass could not locate one locally.

## Proposed promotion

**No change** to decision 6 — this task's evidence supports the locked engine choice and subpath
boundary as-is. **Clarification** for C0.2/C1.1/C3.1: the specific controlled-layout feedback
requirement and the "zero keyboard behavior by default" premise above should be carried into those
tasks' acceptance criteria verbatim, since they are concrete, evidence-backed integration
requirements rather than restatements of the locked decision.
