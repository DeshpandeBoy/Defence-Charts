# Decision 018 — React Grid Layout package boundary and widget-shell ownership

Status: applied to the C0 handoff; implementation still pending
Date: 2026-08-24

## Context

The locked engine decision selects `react-grid-layout@2` and the locked render boundary requires
client-only behavior to stay behind an explicit package boundary. The installed `2.2.4` package is
split: pure layout algorithms/types are exposed from `./core`, while React components and hooks are
exposed from `./react`.

## Evidence

Repository/dependency evidence, reproduced from the package-local dependency boundary:

- `packages/grid/package.json` currently resolves `react-grid-layout` through the workspace install.
- `node -e "import('react-grid-layout/core').then(m => console.log(Object.keys(m).sort()))"` from
  `packages/grid/` exposes collision, compaction, bounds, constraint, position, and layout helpers.
- `node -e "import('react-grid-layout/react').then(m => console.log(Object.keys(m).sort()))"` from
  `packages/grid/` exposes `GridLayout`, `ResponsiveGridLayout`, `GridItem`, and layout hooks.
- The installed export map at `node_modules/.pnpm/.../react-grid-layout/package.json` exposes `.`,
  `./core`, `./react`, `./legacy`, `./extras`, and `./css/styles.css`; `./core` and `./react` each
  provide ESM and CommonJS type-aware entries.
- A root-level import probe fails because the dependency is declared by `@gx/grid`, which confirms
  that adapter verification must run from the package consumer boundary rather than the monorepo root.

## Decision

`@gx/grid` owns the dashboard widget shell and supplies its own client boundary. It imports pure
collision/compaction/constraint algorithms and types from `react-grid-layout/core`, and imports
React layout components/hooks from `react-grid-layout/react` only inside the project-owned wrapper.
The public grid contract remains 12 columns. The grid owns placement, chrome, drag/resize semantics,
constraints, and content-box reporting; it does not choose chart information or mutate chart plans.

`@gx/react`/`AutoChart` remains the owner of chart measurement and plan resolution. The grid may
report each widget's measured content-box pixels and grid footprint to that boundary, but the outer
widget chrome, overlays, and data-table disclosure must not become the observed chart box.

## Consequences

- `@gx/grid` must keep third-party layout types behind project-owned serialisable layout types.
- The grid package needs a `'use client'` entry for components that consume the `./react` subpath;
  pure contract helpers may remain importable independently.
- C0.1 can define layout/identity without React. C0.2 must pin the dependency and prove adapter calls
  before C1 implements the controlled wrapper.
- SSR/import checks must assert that the pure core path remains free of React and that the client
  wrapper is not imported by `@gx/core` or static chart primitives.
- 6/18-column profiles, persistence storage, filters, and chart-type decisions remain outside this
  decision and require separate contracts.

## What would overturn this

Reproducible evidence that `react-grid-layout@2.2.4` cannot support the locked React 19 controlled
wrapper/constraint path, or that the published subpath contract changes in the pinned version, would
require a new decision record and coordinator review. A product preference for another grid engine is
not sufficient to reopen the locked decision.
