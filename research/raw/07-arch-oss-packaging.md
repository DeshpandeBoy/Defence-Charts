# 07 — Modern OSS monorepo architecture, build, and packaging (2026)

> Status: **COMPLETE** — all eight sections written.
> Every claim about a comparable library is verified by fetching that repo's actual
> `package.json` / `turbo.json` / `nx.json` / `lerna.json` from GitHub, or the published
> manifest from `registry.npmjs.org`. Build-tool behaviour (`'use client'` preservation,
> `unbundle`, `.d.ts` emission, CSS handling) and the jsdom/happy-dom SVG results were
> obtained by **running the builds and a DOM probe**, not from documentation.
> Anything not verified is marked **UNVERIFIED**.

Research date: **2026-08-22**. All versions below are what was live on that date.

## Contents

1. [Monorepo tooling — what comparable libraries actually use](#1-monorepo-tooling)
2. [Build tool](#2-build-tool)
3. [`package.json` exports](#3-packagejson-exports)
4. [RSC / Next.js 16 App Router](#4-rsc--nextjs-16)
5. [Release](#5-release)
6. [Testing a chart library](#6-testing-a-chart-library)
7. [Docs site](#7-docs-site)
8. [Recommended stack and packaging specifics](#8-recommended-stack-and-packaging-specifics)
9. [Open questions I could not close](#9-open-questions-i-could-not-close)

**If you read one thing:** §8.6 lists four places where this research contradicts
`20-architecture.md` — including one genuine architectural catch (token values must never
feed `planChart()`, or server and client compute different plans).

---

## 1. Monorepo tooling

### 1.1 The evidence table

Every cell verified on 2026-08-22 by fetching the file named in the last column.

| Library | Version seen | Workspace mgr | Task runner / cache | Build tool | Version + publish | Test |
|---|---|---|---|---|---|---|
| **shadcn/ui** | repo `main` | pnpm 10.33.4, `pnpm-workspace.yaml` + `workspaces:["apps/*","packages/*"]` | **Turborepo 2.9.18** (`turbo.json`) | (registry/CLI, not a bundled lib) | **Changesets** 2.26.1 (`.changeset/`) | Vitest 3.2.6 |
| **Radix UI Primitives** | `@radix-ui/react-dialog` 1.1.23 | pnpm 11.5.0, `pnpm-workspace.yaml` | **none** — root build is `pnpm -r --parallel --filter "./packages/**/*" run build` | in-repo `@repo/builder` exposing a `radix-build` bin | **Changesets** 2.31.1 | Vitest 4.1.7 + Playwright 1.61.1 |
| **Mantine** | `@mantine/core` 9.5.1 | **Yarn 4.18.0** workspaces (`packages/**/*`, `apps/*`) | none (custom `tsx scripts/build`) | **Rolldown 1.1.4** + esbuild 0.28.1 | bespoke `tsx scripts/release`; `syncpack` 15.3.2 for version alignment | **Jest 30.4.2** + Storybook 10.4.6 |
| **Chakra UI** | `@chakra-ui/react` 3.36.1 | pnpm 11.10.0, `pnpm-workspace.yaml` | none at root (`pnpm --filter=./packages/* build`) | in-repo `scripts/build/main.ts`; **tsup 8.5.1** + rollup 4.61.1 present as deps | **Changesets** 2.31.0 (`changeset version` / `changeset publish`) | Vitest 4.1.8 + Storybook 10.4.2 |
| **Base UI** | `@base-ui/react` 1.7.0 | pnpm 11.21.0, `pnpm-workspace.yaml` | **Nx 23** — but only as a cache: `nx.json` is `extends: "nx/presets/npm.json"` with a single `targetDefaults.build = {cache:true, dependsOn:["^build"]}` | MUI's `code-infra build --tsgo` | **Lerna 9.0.7**, `lerna.json` = `{npmClient:"pnpm", version:"independent"}` | Vitest 4.1.10 + Playwright 1.62.1; **`publint --pack pnpm` + `attw --pack ./build`** |
| **TanStack Table** | `@tanstack/react-table` 9.1.2 | pnpm 11.21.0, `pnpm-workspace.yaml` | **Nx 23.1.1** (`nx.json` + `.nx/` cache); root build = `nx affected --targets=build` | **tsdown 0.22.14** | **Changesets 3.0.0** | Vitest 4.1.10 + Playwright 1.62.1; `publint --strict` |
| **TanStack Query** | `@tanstack/react-query` 5.101.4 | pnpm 11.9.0, `pnpm-workspace.yaml` | **Nx 22.1.3** (`nx affected --target=build`) | **tsdown 0.22.14** | **Changesets 2.29.8** | Vitest 4.0.18; `publint --strict && attw --pack` |
| **Recharts** | `recharts` 3.10.1 | not a monorepo (`workspaces:["www"]` only) | n/a | **Rollup 4.40.1**, four passes: `build-types`, `build-cjs`, `build-es6`, `build-umd`, then `test-build-output` | manual npm publish | Vitest 4.1.7 + Playwright 1.62.1 + Storybook 10.4.1 |
| **visx** | `@visx/shape` 4.0.0 | **Yarn 4.10.3** workspaces (`./packages/*`) | none | **Babel only** (no bundler): `yarn babel && yarn type` → `lib/` (CJS) + `esm/` | **Lerna 9.0.7** — `lerna publish --exact` | Vitest 4.1.8 |
| **Nivo** | `@nivo/bar` 0.99.0 | pnpm 10.11.0, `pnpm-workspace.yaml` | **Make** (root `build` script literally says *"nothing to do, please use make"*) | **Rollup 3.21.0** | **Lerna 8.2.2** | Jest 29.5.0 + Playwright 1.52.0 |

Sources (raw files fetched):
- https://raw.githubusercontent.com/shadcn-ui/ui/main/package.json
- https://raw.githubusercontent.com/radix-ui/primitives/main/package.json
- https://raw.githubusercontent.com/mantinedev/mantine/master/package.json
- https://raw.githubusercontent.com/chakra-ui/chakra-ui/main/package.json
- https://raw.githubusercontent.com/mui/base-ui/master/package.json + `/nx.json` + `/lerna.json`
- https://raw.githubusercontent.com/TanStack/table/main/package.json
- https://raw.githubusercontent.com/TanStack/query/main/package.json
- https://raw.githubusercontent.com/recharts/recharts/main/package.json
- https://raw.githubusercontent.com/airbnb/visx/master/package.json
- https://raw.githubusercontent.com/plouc/nivo/master/package.json

### 1.2 What the table actually says

Four honest conclusions, none of them the one you'd guess from blog posts:

1. **pnpm workspaces is the near-universal substrate.** 7 of 10 use pnpm (`pnpm-workspace.yaml`); the two Yarn-4 holdouts (Mantine, visx) are older repos that never migrated. Nobody uses npm workspaces. Nobody uses Bun workspaces. This is settled.

2. **A task runner is optional and, for a component library, mostly unused.** Only shadcn/ui uses Turborepo. Radix and Chakra — both large multi-package component libraries — run `pnpm -r --filter ... run build` with **no** task runner at all. Where Nx appears it is deliberately minimal: Base UI's entire `nx.json` is a build-cache preset. The reason is structural: a component-library monorepo has a shallow, near-flat dependency graph (N leaf packages on 1–2 shared ones), so the orchestration value of a task graph is small; the value is almost entirely *remote caching in CI*. That is why Turborepo/Nx show up in repos with heavy app/docs builds (shadcn/ui ships apps) and are absent from repos that only build packages.

3. **Changesets has won versioning for multi-package library repos.** 5 of 10 (shadcn/ui, Radix, Chakra, TanStack Table, TanStack Query). The Lerna users (Base UI, visx, Nivo) are the legacy cohort. **Zero** of the ten use semantic-release. **Zero** use release-please. That is a strong signal.

4. **Nobody uses Moon or Rush.** Not one of the ten. Treat Moon as UNVERIFIED-in-practice for this category: it exists and is capable, but adopting it means you are the only library in your peer group doing so, and every contributor has to learn it.

**Recommendation for §1: pnpm workspaces + Turborepo, Changesets for release.** Turborepo (not Nx) because the two Nx users in the table use ~5 lines of it (pure caching), which Turborepo does with equal brevity and a much smaller conceptual surface — and because your sibling repos are Next.js, where Turborepo is the Vercel-native default and `turbo.json` will be familiar. If you want to defer, Radix proves `pnpm -r --filter` alone is viable for a component library; you can add `turbo.json` later without changing anything else.

---

## 2. Build tool

### 2.1 The headline: **tsup is dead**

Verbatim, the first lines of the `tsup` README as published to npm at version **8.5.1**:

> [!WARNING]
> This project is not actively maintained anymore. Please consider using [tsdown](https://github.com/rolldown/tsdown/) instead. Read more in [the migration guide](https://tsdown.dev/guide/migrate-from-tsup).

Corroborating registry data (fetched from `registry.npmjs.org` on 2026-08-22):

| Tool | Latest | Last published | Releases since 2026-01-01 | Verdict |
|---|---|---|---|---|
| **tsup** | 8.5.1 | **2025-11-12** | **0** | Officially unmaintained; README points at tsdown |
| **unbuild** | 3.6.1 | **2025-08-15** | **0** | Effectively dormant |
| **tsdown** | 0.22.14 | 2026-07-23 (`modified` 2026-08-12) | **52** | Very active. "The Elegant Bundler for Libraries" |
| **rolldown** | 1.2.5 | 2026-08-19 | 36 | Active, 1.x stable |
| **rollup** | 4.62.5 | 2026-08-20 | 25 | Active but now the legacy path |
| **vite** | 8.2.2 | 2026-08-20 | 48 | Vite 8 is **Rolldown-based**, see below |
| **bunchee** | 7.0.1 | 2026-08-08 | 12 | Active; the RSC-specialist |
| **@rslib/core** | 0.23.2 | 2026-07-03 | 27 | Active (Rsbuild/Rspack family). Note: the bare `rslib` npm name is an unrelated squatted MySQL package, last touched 2022 |

And from the Vite 8 migration guide (https://raw.githubusercontent.com/vitejs/vite/main/docs/guide/migration.md):

> Vite 8 uses [Rolldown](https://rolldown.rs/) and [Oxc](https://oxc.rs/) based tools instead of [esbuild](https://esbuild.github.io/) and [Rollup](https://rollupjs.org/).

So in 2026 the honest framing is not "tsup vs Vite vs Rollup". It is **Rolldown vs Rollup**, with tsdown and Vite-lib-mode both being Rolldown front-ends, and bunchee being the Rollup-based RSC specialist.

### 2.2 `"use client"` preservation — the decisive criterion

This is the one that actually rules candidates out, and it is under-documented, so I ran the builds.

**Rolldown's documented rule** (https://raw.githubusercontent.com/rolldown/rolldown/main/docs/in-depth/directives.md — the page is titled "Directive"). For non-`"use strict"` directives Rolldown says it *"does not know the semantics of them"* and *"may not preserve the top-level directives"*, then lists exactly when it **will** emit them:

> - The directive is not in the top-level scope
> - The directive is in the top-level scope and the module is a **entry module**
> - The directive is in the top-level scope and **`output.preserveModules` is enabled**

**I verified this empirically** with `tsdown@0.22.14` (powered by `rolldown@1.2.5`), building a two-file React source where `src/Chart.tsx` starts with `'use client'`:

| Build mode | `'use client'` in output? |
|---|---|
| Bundled, `Chart.tsx` is a **non-entry** module imported by `index.ts` | **STRIPPED.** `dist/index.js` begins `import { useState } from "react";` — no directive |
| Bundled, the client file is itself an **entry** (`entry: ['src/client.tsx']`) | **PRESERVED.** `dist/client.js` begins `"use client";` |
| `unbundle: true` (Rolldown `preserveModules`) | **PRESERVED per file**, in *both* ESM and CJS output — `dist/Chart.js` and `dist/Chart.cjs` each begin `"use client";` |

That is the whole answer, and it generalises: **any Rolldown-based tool (tsdown, Vite 8 library mode) preserves `"use client"` if and only if the directive is on an entry file or you build in preserve-modules/unbundle mode.** Rolldown also documents the escape hatch — `output.banner: "'use client';"` to force it onto every file, which is the wrong tool for a mixed library because it would mark server-safe modules as client.

Status of the alternatives:

- **Rollup (4.62.5)** — needs `rollup-plugin-preserve-directives`, whose npm description is literally *"A Rollup plugin to preserve directives like `use client` when preserveModules is true"*. **That plugin's latest release is 0.4.0, published 2024-02-02** — over two years stale. Same constraint as Rolldown (preserveModules only) plus a maintenance risk.
- **esbuild / tsup** — tsup is esbuild-based and unmaintained; do not evaluate further.
- **bunchee (7.0.1)** — the only tool that treats directives as a first-class feature. From its README: *"**bunchee** supports building React Server Components and Server Actions with directives like `"use client"` or `"use server"`. It generates separate chunks for the server or client boundaries. When integrated to framework like Next.js, it can correctly handles the boundaries with the split chunks."* It is by `huozhi`, who works on Next.js. This is genuinely the strongest RSC story — but it is zero-config-by-convention (entries are inferred from `exports`), which fights a many-package, many-subpath layout.
- **unbuild** — dormant; its rollup stub/mkdist model has no documented directive handling. **UNVERIFIED** whether it preserves `'use client'`; irrelevant given the maintenance state.

**Ground truth from a real dependency:** `react-grid-layout@2.2.4` is built with `tsup ^8.5.1` and **emits no `"use client"` anywhere in its JS output** (verified by extracting the published tarball and grepping `dist/`; the only hits are inside `.d.ts` prose). So RGL's React entry is *not* a marked client component — which independently confirms the recommendation already made in `raw/04-landscape-grid-resize.md` that we must wrap it behind our own `'use client'` boundary in `@scope/grid`.

### 2.3 The other three criteria, tested

**Module structure / tree-shaking.** tsdown calls it `unbundle: true` (docs: `docs/options/unbundle.md` — *"output files that closely mirror your source module structure … often referred to as a 'bundleless' or 'transpile-only' build"*). Verified: `src/index.ts` + `src/Chart.tsx` + `src/pure.ts` produced `dist/index.js`, `dist/Chart.js`, `dist/pure.js` with real `import` statements between them. `root: '.'` controls whether the `src/` prefix survives.

One trap found: with `unbundle: true` and no `dependencies`/`peerDependencies` declared, Rolldown **inlined `react/jsx-runtime`** into `dist/node_modules/react/...`. Declaring `peerDependencies: { react: "^19" }` fixed it (tsdown auto-externalises deps + peerDeps). Always declare peers, and check the output tree.

**`.d.ts` including subpath exports.** Verified working. `entry: ['src/index.ts','src/client.tsx','src/grid/index.ts']` with `dts: true` produced `dist/index.d.ts`, `dist/client.d.ts`, `dist/grid/index.d.ts` — sibling declaration files next to each JS entry, nested directories preserved. In dual-format mode it emits both `.d.ts` and `.d.cts`. Under the hood this is `rolldown-plugin-dts` (0.28.2, 2026-08-12). Two notes:
- It requires `typescript` installed, or `isolatedDeclarations: true` in tsconfig to use the much faster Oxc path instead. Error message verbatim: *"TypeScript is not installed. You should install `typescript` package. Or enable `isolatedDeclarations` in your `tsconfig.json` to use Oxc instead."*
- **`typescript@latest` is now 7.0.2** (published 2026-07-08; `next` is `7.1.0-dev`, `beta` was `6.0.0-beta` on 2026-02-11). tsdown warns: *"TypeScript 7.0 does not yet have a stable API and is experimental. Some options will be unavailable."* TanStack Table/Query and Base UI all **pin `typescript: 6.0.3`**. Pin TS 6.0.3 for the build; treat TS 7 as opt-in.

**CSS / CSS Modules.** tsdown gates CSS behind a separate package: building a file that does `import './chart.css'` fails with *"CSS file … was encountered but `@tsdown/css` is not installed. Please install it: `npm install @tsdown/css`"*. With `@tsdown/css` installed:
- Default (bundled, `css.splitting: false`) → all CSS collected into one `dist/style.css`, the `import './chart.css'` is **removed** from the JS. Consumers must import the stylesheet themselves. tsdown then auto-adds `"./style.css"` to the generated `exports`.
- With `unbundle: true` → per-source-file CSS files are emitted (`chart.css` next to `chart.js`).

⚠️ **Reproducible bug found.** With `unbundle: true` + `format: ['esm','cjs']` + a CSS import, tsdown 0.22.14 / rolldown 1.2.5 emitted `dist/client.cjs` containing `require("./chart2.cjs")` — **a file it never wrote** (only `chart2.css` exists). The ESM twin correctly emitted `/* empty css */`. This CJS output is broken on `require()`. It is one more reason to go ESM-only (§3.4). Marked as observed on these exact versions; not filed upstream by me.

### 2.4 What the comparables build with

Cross-checking §1: **TanStack Table 9 and TanStack Query 5 both build with `tsdown@0.22.14`.** Mantine builds with **Rolldown 1.1.4** directly. Chakra and Recharts are on Rollup-era pipelines; visx uses plain Babel (no bundler at all, `lib/` + `esm/`). Nobody in the sample has adopted bunchee or Rslib.

**Recommendation for §2: `tsdown` with `unbundle: true`.** It is the successor the tsup author himself points at, the two TanStack repos already ship on it, it is the only actively-maintained tool that gets `'use client'`, preserveModules, per-entry `.d.ts`, CSS, *and* built-in `publint`/`attw` in one config, and its `unbundle` mode is precisely the one mode where directive preservation is guaranteed per-file.

---

## 3. `package.json` exports

### 3.1 The types-first condition order rule

The rule: within a conditions object, `"types"` must come **first**, because Node/bundler condition resolution takes the *first matching key* and TypeScript will otherwise never see the declaration. And each format needs its *own* declaration file — `.d.mts` for the ESM branch, `.d.ts`/`.d.cts` for the CJS branch — because a `.d.ts` inherits its module-ness from the containing package's `"type"` field.

The canonical shape, verified live in the wild. `react-grid-layout@2.2.4` (our own dependency) is a textbook example:

```jsonc
{
  "exports": {
    ".":       { "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
                 "require": { "types": "./dist/index.d.ts",  "default": "./dist/index.js"  } },
    "./core":  { "import": { "types": "./dist/core.d.mts",  "default": "./dist/core.mjs"  },
                 "require": { "types": "./dist/core.d.ts",   "default": "./dist/core.js"   } },
    "./react": { "...": "same shape" },
    "./css/styles.css": "./css/styles.css"
  },
  "sideEffects": ["*.css"]
}
```

Identical shape in `@radix-ui/react-dialog@1.1.23`, `@mantine/core@9.5.1`, `@base-ui/react@1.7.0`, `@chakra-ui/react@3.36.1`. This is settled practice.

Two real-world deviations worth knowing about:

- **`@visx/shape@4.0.0` and `@nivo/bar@0.99.0`** use the older flat form `{ "types": ..., "import": ..., "require": ... }` — one declaration file shared by both formats. It resolves, but it cannot be correct for both module systems simultaneously, and it is what attw's `false-cjs`/`false-esm` rules exist to catch.
- **`@base-ui/react@1.7.0`** publishes conditions in the order `import`, **`default`**, `require`. Since `"default"` always matches, a `require()` resolution reaches `default` → `./index.mjs` before ever reaching the `require` key. Observed directly in the published registry manifest; flagged here as a **hazard to not copy**, not as a recommendation. (It presumably works in practice only because Node now supports `require(esm)`.)

### 3.2 `sideEffects` — and the correct value when you ship CSS

`"sideEffects": false` is what a pure component library wants, and it is what 8 of the 9 comparables with the field set use. **But it is a lie the moment you ship a CSS file that a module `import`s**, because bundlers will then tree-shake the CSS import away.

The correct value when you ship CSS is an array. Both `@mantine/core@9.5.1` and `react-grid-layout@2.2.4` use exactly:

```json
"sideEffects": ["*.css"]
```

Since our locked decision is **CSS custom properties + CSS Modules**, and we will ship at least one stylesheet, `["*.css"]` (or `["**/*.css"]` if files are nested — verify against your emitted tree) is the correct value. Publint will nag if the field is missing entirely; it flagged my test package with: *"The package appears to be consumed by bundlers but does not specify `sideEffects`. Consider adding `sideEffects: false` so bundlers can optimize tree-shaking if your package has no side effects."*

### 3.3 `publishConfig`

Three distinct uses seen in the wild, all legitimate:

1. **`{"access": "public"}`** — mandatory boilerplate for a **scoped** package, otherwise npm defaults scoped packages to restricted and `npm publish` fails. Chakra does exactly this. **We need this on every one of our `@scope/*` packages.**
2. **Field swapping at publish time** — Radix's `packages/react/dialog/package.json` points `main`/`module`/`source` at `./src/index.ts` for in-repo development, and puts the real `main`/`module`/`types`/`exports` inside `publishConfig` so npm/pnpm swaps them in on pack. Excellent DX (no build needed to develop against a sibling package).
3. **`{"directory": "build"}`** — Base UI publishes from a generated `build/` directory containing a rewritten `package.json`. This is a pnpm/yarn feature.

tsdown has a first-class version of pattern 2: `exports.devExports: true` writes source-pointing exports at the top level and the built exports into `publishConfig`. Its docs carry an important caveat, verbatim: *"which will override the top-level `exports` field when using `yarn` or `pnpm`'s `pack`/`publish` commands (**note: this is not supported by npm**)"*. Chakra achieves the same thing portably with a custom `"dev"` condition plus `prepack`/`postpack` scripts that strip it.

### 3.4 Is CJS still necessary in 2026?

The sample splits, and the newest packages are the ESM-only ones:

| Package | Dual or ESM-only |
|---|---|
| `@tanstack/react-table@9.1.2` | **ESM-only** — `"type":"module"`, no `require` condition anywhere |
| `@tanstack/react-query@5.101.4` | Dual |
| `@radix-ui/react-dialog@1.1.23` | Dual |
| `@mantine/core@9.5.1` | Dual |
| `@chakra-ui/react@3.36.1` | Dual |
| `@base-ui/react@1.7.0` | Dual |
| `@visx/shape@4.0.0`, `@nivo/bar@0.99.0`, `recharts@3.10.1` | Dual (legacy `main`/`module`) |

Note what `@tanstack/react-table@9` actually ships — it is the cleanest modern shape in the whole sample:

```jsonc
{
  "type": "module",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./flex-render": "./dist/flex-render.js",
    "./legacy": "./dist/legacy.js",
    "./static-functions": "./dist/static-functions.js",
    "./experimental-worker-plugin": "./dist/experimental-worker-plugin.js",
    "./package.json": "./package.json"
  },
  "sideEffects": false,
  "engines": { "node": ">=20" }
}
```

Bare string targets, no condition objects at all — types resolve through the **sibling `.d.ts`** next to each `.js`, which every modern `moduleResolution` (`node16`/`bundler`) handles. Also note `"./package.json": "./package.json"`, which several tools want.

**My read: ship ESM-only.** Justification, in order of weight: (a) our only consumers are React 19 / Next.js 16 apps and modern bundlers, all of which are ESM-native; (b) TanStack — the most packaging-fastidious org in the sample, the one that runs `publint --strict && attw --pack` in CI — went ESM-only for their newest major; (c) it halves the artefact count and removes the entire dual-package-hazard surface; (d) it dodges the tsdown CJS+unbundle+CSS bug found in §2.3. If you need an escape hatch later, adding a `require` branch is a non-breaking change; removing one is breaking.

### 3.5 What `publint` and `attw` actually flag — measured

I ran both against the built test package.

**`publint@0.3.24`** on a correct ESM-only build reported only suggestions:
1. *"The package does not specify the `engines.node` field."* → set it (TanStack Table uses `"node": ">=20"`).
2. *"The package appears to be consumed by bundlers but does not specify `sideEffects`."* → set `["*.css"]`.

**`@arethetypeswrong/cli@0.18.5`** produced this matrix for a dual build with a CSS subpath:

| | `"pkg"` | `"pkg/client"` | `"pkg/grid"` | `"pkg/package.json"` | `"pkg/chart2.css"` |
|---|---|---|---|---|---|
| node10 | OK | **Resolution failed** | **Resolution failed** | OK (JSON) | **Resolution failed** |
| node16 (from CJS) | OK (CJS) | OK (CJS) | OK (CJS) | OK (JSON) | **Resolution failed** |
| node16 (from ESM) | OK (ESM) | OK (ESM) | OK (ESM) | OK (JSON) | **Resolution failed** |
| bundler | OK | OK | OK | OK (JSON) | **Resolution failed** |

Two things to internalise:
- **A CSS subpath export always fails attw**, in every resolution mode, because attw tries to resolve every entrypoint as a *module*. This is expected and not a real defect. The fix is to exclude it — Base UI's script is `attw --pack ./build --exclude-entrypoints package.json`; ours becomes `attw --pack . --exclude-entrypoints ./styles.css`. tsdown's built-in integration exposes the same idea via `attw: { profile, level, ignoreRules }`.
- **node10 fails for every subpath**, always, because `moduleResolution: node10` predates `exports`. Either accept it via `attw --profile node16` (tsdown: `attw: { profile: 'node16' }`) or add `typesVersions`. Everyone accepts it.

tsdown ships both as opt-in build steps, with a `'ci-only'` mode, so this becomes config rather than extra scripts:

```ts
export default defineConfig({
  publint: 'ci-only',
  attw: { enabled: 'ci-only', profile: 'node16', level: 'error' },
})
```

(attw's documented profiles are `strict` | `node16` | `esm-only`, and its ignorable rule names include `false-cjs`, `false-esm`, `cjs-resolves-to-esm`, `no-resolution`, `untyped-resolution` — full list in https://raw.githubusercontent.com/rolldown/tsdown/main/docs/options/lint.md.)

---

## 4. RSC / Next.js 16

Next.js `latest` on 2026-08-22 is **16.3.2** (published 2026-08-21; `canary` 16.4.0-canary.1). All quotes below are from the `canary` docs tree in `vercel/next.js`.

### 4.1 Where `'use client'` goes — per-file, at boundary entries only

From `docs/01-app/03-api-reference/01-directives/use-client.mdx`:

> The `'use client'` directive declares an entry point for the components to be rendered on the **client side** … **You do not need to add the `'use client'` directive to every file that contains Client Components. You only need to add it to the files whose components you want to render directly within Server Components.** The `'use client'` directive defines the server and client boundary, and the components exported from such a file serve as entry points to the client.

> To declare an entry point for the Client Components, add the `'use client'` directive **at the top of the file, before any imports**.

Consequences for our library, concretely:

1. **Not "the whole package".** There is no package-level `'use client'` in the spec. Marking every file is legal but wasteful — it drags server-safe code (scales, tick generation, the `sizeClass` resolver, token types) into the client graph and blocks it from ever being used in a Server Component.
2. **Mark exactly the boundary files.** Anything that uses `useState`/`useRef`/`useEffect`/`ResizeObserver`/pointer events. That is: the grid (`@scope/grid`), and any chart wrapper that measures its own container. Pure SVG renderers that take explicit `width`/`height` props should **not** be marked, so they stay usable from a Server Component.
3. **Props across a marked boundary must be serialisable.** The docs are explicit: *"the props of the Client Components must be serializable … This means the props need to be in a format that React can serialize."* This is a design constraint on our public API — a `formatValue?: (n: number) => string` prop on a component whose file carries `'use client'` **cannot be passed from a Server Component**. Either keep the formatter-accepting component un-marked (so the consumer's own client file imports it), or accept a serialisable descriptor (`{ style: 'currency', currency: 'USD' }`) instead of a function. **This is a real API-shape decision, not a build detail.** `Intl.NumberFormat` options objects are the natural serialisable form.
4. **Build implication → §2.** Because the directive must survive to the published file, the build must be `unbundle: true` (or the marked file must be its own entry). This is why §2's finding is load-bearing rather than trivia.

### 4.2 CSS imports in RSC

From `docs/01-app/01-getting-started/11-css.mdx`, under "External stylesheets":

> **Stylesheets published by external packages can be imported anywhere in the `app` directory, including colocated components.**

That is a genuine App Router improvement — the Pages Router rule that third-party global CSS could only be imported from `_app` is gone. So `import '@scope/charts-line/styles.css'` in a layout, page, or component all work.

Caveat quoted from the same page, about global styles generally:

> Global styles can be imported into any layout, page, or component inside the `app` directory. However, since Next.js uses React's built-in support for stylesheets to integrate with Suspense, **this currently does not remove stylesheets as you navigate between routes** which can lead to conflicts.

CSS Modules (`*.module.css`) are fully supported in the App Router and are compiled at build time by us, not by the consumer — the consumer only ever sees the emitted class names and one stylesheet. That is precisely why the locked "CSS custom properties + CSS Modules" decision is RSC-safe: **no runtime style provider, no context, no `'use client'` needed for theming.** Theme overrides are just `var(--...)` set from any CSS the consumer controls, including from a Server Component's inline `style` prop.

Related config keys that exist in Next 16 and are worth knowing about but that we should **not** require: `cssChunking`, `inlineCss`, `useLightningcss`.

### 4.3 `transpilePackages` — we should not need it

From `docs/01-app/03-api-reference/05-config/01-next-config-js/transpilePackages.mdx`:

> Add a package to `transpilePackages` when: **A `node_modules` dependency ships raw TypeScript or JSX.** Next.js does not compile code inside `node_modules` by default. Listing the package opts it in, **or you can build the package to plain JavaScript and point its `main`/`exports` at the compiled output.**

We ship compiled JS. **Therefore consumers need no `transpilePackages` entry, and "works with zero `next.config` changes" is a shippable quality bar** — worth an explicit test in CI (a fixture Next 16 app that imports each package and builds).

Also from that page, two facts to record:
- *"A package cannot appear in both `transpilePackages` and `serverExternalPackages`; Next.js throws at build start if it does."*
- *"Packages listed in `optimizePackageImports` and the entries in `default-transpiled-packages.json` are added automatically; you do not need to repeat them."*

### 4.4 `optimizePackageImports`

From `docs/01-app/03-api-reference/05-config/01-next-config-js/optimizePackageImports.mdx` — note the frontmatter says `version: experimental`, so it still lives under `experimental` in Next 16:

```js
module.exports = { experimental: { optimizePackageImports: ['package-name'] } }
```

> Some packages can export hundreds or thousands of modules, which can cause performance issues in development and production. Adding a package to `experimental.optimizePackageImports` will only load the modules you are actually using, while still giving you the convenience of writing import statements with many named exports.

**Directly relevant: `recharts` and `@visx/visx` are both on the default-optimised list**, alongside `@mui/material`, `antd`, `lucide-react`, `react-icons/*`, etc. Next.js has effectively conceded that chart libraries ship barrels big enough to hurt.

Our answer should be to **not need it**: per-chart-type packages (`@scope/charts-line`, `@scope/charts-bar`, …) plus real subpath exports mean the consumer's import is already narrow, and `unbundle: true` output means the module graph is already fine-grained. If a convenience meta-package `@scope/charts` (barrel re-export of every chart) is ever added, that one *would* be a candidate — and library authors can get onto the default list by PR to `packages/next/src/lib/…`, which is a nice long-term goal but not a plan.

### 4.5 A note from the bundling guide

`docs/01-app/02-guides/package-bundling.mdx` contains a paragraph aimed squarely at us:

> A common cause of large client bundles is doing expensive rendering work in Client Components. This often happens with libraries that exist only to transform data into UI, such as syntax highlighting, **chart rendering**, or markdown parsing. If that work does not require browser APIs or user interaction, it can be run in a Server Component.

This is the argument for keeping the pure SVG renderers *unmarked*: a static chart with known dimensions should be renderable entirely on the server, with zero client JS. That capability is a differentiator and it is only available if we are disciplined about §4.1.

---

## 5. Release

### 5.1 Changesets vs semantic-release vs release-please

Registry state on 2026-08-22:

| Tool | Latest | Published | Releases in 2026 | Used by (from §1) |
|---|---|---|---|---|
| `@changesets/cli` | **3.0.1** | 2026-08-19 | 20 | shadcn/ui, Radix, Chakra, TanStack Table (`^3.0.0`), TanStack Query |
| `semantic-release` | 25.0.9 | 2026-08-05 | 8 | **nobody in the sample** |
| `release-please` | 17.11.1 | 2026-07-31 | 20 | **nobody in the sample** |
| `@changesets/changelog-github` | 1.0.0 | 2026-08-11 | 15 | — |

Changesets is on **v3** now (there is a "Migrating from v2 to v3" guide at https://changesets.dev/guide/migrating-v2-to-v3), and docs have moved from the repo's `docs/` folder to **https://changesets.dev** — the in-repo markdown now carries a *"This documentation is outdated"* banner. Cite changesets.dev, not the repo docs.

**Recommendation: Changesets.** The reasoning is structural, not popularity: semantic-release and release-please both derive the version from *commit messages*, which in a multi-package repo forces you to encode the affected package into every commit (`fix(charts-line): …`) and gives contributors no place to write a human changelog entry. Changesets inverts it — a contributor adds a small markdown file naming the packages and bump levels, which is reviewable in the PR diff and produces a genuinely readable changelog. For a repo where a single PR routinely touches `@scope/core` + one chart package, that is the difference between a correct release and a guessed one. The 5-of-10 adoption among comparables (and 0-of-10 for the alternatives) reflects exactly this.

Two Changesets features we should use from day one, both documented at changesets.dev:
- **`linked`/`fixed` packages** (`docs/linked-packages.md`, `docs/fixed-packages.md`) — decide early whether `@scope/*` versions move in lockstep (`fixed`) or independently. For a library where `core` and the chart packages are tightly coupled, `fixed` is simpler for users to reason about; independent is kinder to changelog noise. Base UI/Lerna chose `"version": "independent"`.
- **A changeset-presence check on PRs.** Changesets docs describe both a non-blocking option (the Changesets GitHub Bot comments on the PR) and a blocking CI check, and note `changeset --empty` for PRs that legitimately release nothing (tests, build tooling).

### 5.2 npm provenance and trusted publishing — yes, this is now the expectation

From https://docs.npmjs.com/generating-provenance-statements:

> npm provenance includes two types of attestations: **Provenance attestation** [and] **Publish attestation**. … When an npm package is published with provenance, it is signed by Sigstore public good servers and logged in a public transparency ledger.

> **Note:** If you use trusted publishing, provenance attestations are **automatically generated** for your packages without requiring the `--provenance` flag. This provides enhanced security and eliminates the need for access tokens in your CI/CD workflows.

From https://docs.npmjs.com/trusted-publishers (page footer says *"Last edited by meeech on June 4, 2026"*):

> **Prefer trusted publishing over tokens.** When trusted publishing is available for your workflow, always prefer it over long-lived tokens.

> After enabling trusted publishers, navigate to your package's **Settings → Publishing access**, select **"Require two-factor authentication and disallow tokens"** …

> For even stronger security, configure your trusted publisher with **stage-only permissions** (allow `npm stage publish` but not `npm publish`). This ensures all CI-automated publishes go through the staged publishing flow, requiring a maintainer to review and approve each package with 2FA … before it becomes publicly available.

Hard requirements and limits, all quoted/derived from that page:
- Supported providers: **GitHub Actions, GitLab CI/CD, CircleCI**. Cloud-hosted runners only — *"self-hosted runners are not currently supported"*; support for them is *"intended for a future release"*.
- GitHub Actions needs `permissions: id-token: write`.
- *"To publish from GitHub, your package's `repository.url` field in `package.json` must exactly match your GitHub repository."* Case-sensitive. **In a monorepo, every package's `repository` field (with `directory`) must be right** — Radix, TanStack, Base UI all set `repository.directory`; copy that.
- **Each package can have only one trusted publisher configuration at a time**, configured per-package on npmjs.com. For a 5+ package monorepo that is 5+ manual configurations, done once. Budget for it.
- **Provenance is not generated for private repositories**, even for public packages. Ours is public — fine.
- Provenance is **not** generated via CircleCI trusted publishing.
- npm CLI **9.5.0+** required for provenance; the docs' own example workflow uses `actions/setup-node@v6` with `node-version: '24'`.

**Is provenance "expected" in 2026?** The docs' own language is "always prefer", the mechanism is now zero-config under trusted publishing, and npm has shipped the surrounding apparatus (staged publishing, ECDSA registry signatures, granular tokens). Treat it as table stakes: a new OSS package published in 2026 without provenance looks careless. **Do it from the first publish** — retrofitting means unsigned versions sit in your history forever.

### 5.3 Changesets + trusted publishing, specifically

The `changesets/action` README lists the job permissions verbatim:

> - `contents: write`: to commit version changes
> - `pull-requests: write`: to create pull request
> - **`id-token: write`: if using [trusted publishing](https://docs.npmjs.com/trusted-publishers)**

And https://changesets.dev/guide/automating adds two things npm's own docs don't:

> It is recommended by npm to use Trusted Publishing, or Staged Publishing, or both, to securely publish packages from CI. **At the moment, Staged Publishing does not work with Changesets**, so you should use Trusted Publishing instead for now.

> Also, in contrary to npm's workflow recommendation, make sure the **`id-token: write` is only set on the job that needs to publish**. As such, consider splitting the build, test, publish flows etc into separate jobs.

So: **Trusted Publishing (not staged publishing), with `id-token: write` scoped to a publish-only job.** That last point is a genuine hardening step most repos get wrong.

Also required, once per package: `"publishConfig": { "access": "public" }`, because scoped packages default to restricted.

### 5.4 Canary / snapshot releases from PRs

Two mechanisms, and the newer one is better for PRs.

**(a) Changesets snapshots.** `changeset version --snapshot <tag>` rewrites all versions to `0.0.0-<tag>-<datetime>`, then `changeset publish --tag <tag>` publishes off `latest`. The docs are emphatic:

> By using the `--tag` flag, you will not add it to the `latest` flag on npm. **This is REALLY IMPORTANT** because if you do not include a tag, people installing your package using `yarn add your-package-name` will install the snapshot version.

Also `changeset publish --no-git-tag` to avoid junk git tags, and the docs say explicitly not to merge the snapshot version bump back to `main`. Downside: it permanently pollutes your npm version list and dist-tags with throwaway builds.

**(b) `pkg.pr.new` — and the Changesets docs now recommend it by name.** From https://changesets.dev/guide/snapshot-releases:

> **Alternatives** — You can also use services such as `pkg.pr.new` to easily set up snapshot releases. They publish to their own registry as **ephemeral releases to prevent polluting versions and tags on npm**.

Registry check: `pkg-pr-new` is at **0.0.88** (published 2026-08-14, 22 releases in 2026), repo `stackblitz-labs/pkg.pr.new`. Every PR gets an installable URL; nothing touches the npm registry.

**Recommendation: `pkg.pr.new` for per-PR previews, Changesets snapshots only if you need a real npm dist-tag (e.g. a `next` line during a major rewrite).** For a chart library this matters more than usual — reviewers need to actually *drag-resize the thing* to review a PR, and "npm i https://pkg.pr.new/…" in a StackBlitz beats reading a diff.

---

## 6. Testing a chart library

This is the section with the most surprising findings. Two of them should change the plan.

### 6.1 The headline: neither jsdom nor happy-dom can measure SVG — and they fail differently

I ran a probe rather than trusting documentation. Harness: `/tmp/svgtest/probe.mjs`, a single SVG containing `<g>`, `<path>`, `<text>`, `<rect>`, evaluated in both environments at their current versions on 2026-08-22.

| API | **jsdom 29.1.1** | **happy-dom 20.11.6** |
|---|---|---|
| `ResizeObserver` | `undefined` | `function` — **but see 6.2** |
| `IntersectionObserver` | `undefined` | `function` |
| `matchMedia` | `undefined` | `function` |
| `MutationObserver` | `function` | `function` |
| `requestAnimationFrame` | `function` | `function` |
| `PointerEvent` | `function` | `function` |
| `Element.setPointerCapture` | **`undefined`** | `function` |
| `Element.scrollTo` | `undefined` | `function` |
| `svg.getBBox()` | **THROWS** `getBBox is not a function` | OK → `{x:0,y:0,width:0,height:0}` |
| `text.getBBox()` | **THROWS** | OK → `{width:0,height:0}` |
| `text.getComputedTextLength()` | **THROWS** | OK → **`0`** |
| `text.getSubStringLength(0,3)` | **THROWS** | OK → **`0`** |
| `text.getNumberOfChars()` | **THROWS** | OK → **`0`** |
| `path.getTotalLength()` | **THROWS** | OK → **`0`** |
| `path.getPointAtLength(10)` | **THROWS** | OK → `{x:0,y:0}` |
| `svg.createSVGPoint()` | **THROWS** | OK → object |
| `svg.getScreenCTM()` | **THROWS** | OK → `matrix(1, 0, 0, 1, 0, 0)` |
| `g.getCTM()` | **THROWS** | OK → `matrix(1, 0, 0, 1, 0, 0)` |
| `getBoundingClientRect()` | OK → `{w:0,h:0}` | OK → `{w:0,h:0}` |
| `svg.clientWidth` | `0` | **`undefined`** |
| `getComputedStyle(rect).fill` | `"rgb(0, 0, 0)"` | `""` |

Read that table carefully, because the two failure modes have opposite ergonomics:

- **jsdom throws loudly.** Every SVG geometry method is simply absent. Any code path that measures dies with a stack trace. Annoying, but honest — you cannot ship a false green.
- **happy-dom lies quietly.** Every method exists and returns **zero**. `getComputedTextLength()` returning `0` means *"this label takes no horizontal space"*, so a label-collision routine concludes **everything fits**, always. The test passes. The bug ships.

**This lands directly on the product thesis.** Decision 10/the responsive ladder is built on deciding what fits at a given size — which is text measurement. So: **`planChart()` must never call `getComputedTextLength()`.** It must estimate text width from a character-width model (font-size × per-character advance, or a small measured metrics table), because that is (a) pure, (b) testable in Node with no DOM at all, and (c) works on the server, which decision 7 requires anyway. The DOM's measurement APIs would break RSC rendering regardless. **jsdom's limitation is not a testing inconvenience to work around — it is a design constraint that pushes the architecture somewhere better.**

Corollary: if the plan is pure data (decision 8), the interesting tests are plain Node unit tests over `planChart()` — no DOM, no shim, no browser. That is the cheapest and most valuable test tier and it should carry most of the weight.

#### Confirmed at the source level — this is by design, not a gap awaiting a fix

The probe above ran against **jsdom 29.1.1** (what `npm i -D jsdom` resolved on the day). A separate source read of **jsdom 30.0.1** (2026-07-29, the current latest) found the same picture, so this is not version-specific:

- `grep -ril resizeobserver lib/` → **zero files**. There is no ResizeObserver implementation at all.
- `SVGGraphicsElement.webidl` has **every geometry method commented out**.
- `create-element.js` maps only a handful of SVG tag names to real interfaces, so `<path>`, `<text>`, `<circle>` and `<rect>` all fall back to generic `SVGElement` — which is exactly why Recharts' comment says the `SVGGeometryElement` globals *"do not appear to be available … at all"* and why `vi.spyOn` refuses to mock them.
- `Element-impl.js:328` returns a **hardcoded all-zeros rect** from `getBoundingClientRect()`.

And the jsdom README lists **Layout** as a permanent non-goal. So: no layout engine, therefore no geometry, therefore no measurement — ever. **Do not wait for this to be fixed and do not file an issue; design around it.**

### 6.2 happy-dom's `ResizeObserver` is a no-op stub — the worst possible outcome

`typeof window.ResizeObserver === 'function'` in happy-dom, so feature detection succeeds. I checked whether it actually fires (`/tmp/svgtest/ro.mjs`): observe a 400×200 div, wait, then change its width to 800px.

```
immediately after observe(): []
after 50ms tick            : []
after style change         : []
ro.disconnect type         : function | ro.unobserve: function
```

**The callback is never invoked. Not once.** Not even the initial observation that a real browser delivers on `observe()`.

The consequence is a silent-failure trap specific to this library: `<AutoChart>` feature-detects `ResizeObserver`, finds it, takes the adaptive path, and then **never receives a measurement** — so it renders its fallback size forever. The test asserts against the fallback and goes green. You would only discover it in a real browser.

**Therefore: do not rely on the environment's built-in `ResizeObserver` in either environment. Always inject an explicit controllable fake.** In jsdom it is mandatory (undefined); in happy-dom it is mandatory for a different and more dangerous reason.

Shim options, with registry state on 2026-08-22 — and none of them are healthy:

| Package | Latest | Published | Releases 2026 |
|---|---|---|---|
| `resize-observer-polyfill` | 1.5.1 | **2018-12-09** | 0 |
| `@juggle/resize-observer` | 3.4.0 | 2022-08-18 | 0 |
| `jsdom-testing-mocks` | 1.16.0 | 2025-09-13 | 0 |

`resize-observer-polyfill` is nearly eight years stale and predates `borderBoxSize`/`contentBoxSize` (it only provides `contentRect`). `@juggle/resize-observer`'s description does claim *"supports box size options from the latest spec"*, which makes it the better of the two, but it is four years stale. None of these is a 2026 recommendation.

**Recommendation: write your own ~20-line fake and keep it in the repo.** It is trivially small, it is the only version that gives you a `trigger(el, {width, height})` handle to *drive* resize deterministically, and it has no supply-chain cost. The shape you want:

```ts
// test/resize-observer-fake.ts  (sketch, not copied from any package)
class FakeResizeObserver {
  static instances = new Set<FakeResizeObserver>()
  private targets = new Set<Element>()
  constructor(private cb: ResizeObserverCallback) { FakeResizeObserver.instances.add(this) }
  observe(el: Element) { this.targets.add(el) }
  unobserve(el: Element) { this.targets.delete(el) }
  disconnect() { this.targets.clear(); FakeResizeObserver.instances.delete(this) }
  // test-only driver
  emit(el: Element, width: number, height: number) { /* build entry, call this.cb */ }
}
```

The point is not the polyfill; it is that **resize must be an input you control, not an event you wait for.** Every rung of the responsive ladder then becomes a deterministic assertion: `emit(el, 320, 180)` → assert the resulting plan. Combined with 6.1, this means the ladder is fully testable in Node.

### 6.3 Vitest browser mode vs Playwright component testing — this changed in 2026

**Playwright's experimental component-testing packages have been removed.** Verbatim from `docs/src/test-components-js.md` on `microsoft/playwright@main`:

> The experimental `@playwright/experimental-ct-react`, `-ct-react17` and `-ct-vue` packages have been **removed and are no longer published**. If you are still on them, stay on Playwright 1.62 until you have followed the migration guide below.

Registry corroboration: `@playwright/experimental-ct-react` last published **1.62.1 on 2026-07-30**, which is exactly the current stable `playwright` version. `playwright@next` is `1.63.0-alpha-2026-08-22`. **So as of today the removal has landed in docs and in the 1.63 alpha, but 1.62.1 is still the stable release.** Anyone adopting Playwright CT now would be adopting a package that is deleted in the next minor.

Playwright's own post-mortem is worth quoting because it explains *why* the approach failed, and the reasoning generalises:

> That design kept the packages experimental forever: **It only worked when your setup matched ours.** Path aliases, plugins and CSS handling had to be mirrored into `ctViteConfig` by hand … **The Node.js/browser boundary leaked.** JSX written in a test was compiled in Node.js and reassembled in the browser. Live objects could not cross, callbacks only half-worked through marshalling, and module mocks silently did not apply.

The replacement is a **story gallery**: `*.story.tsx` files next to components, a gallery page you own that exposes `window.mount(params)`, and a built-in `mount` fixture in plain `@playwright/test` that navigates to it. Notably this is *Storybook's* model, arrived at independently — which is a strong signal that stories-as-fixtures is the right shape, and that **our `*.stories.tsx` files should be treated as test fixtures, not just docs.**

Meanwhile **Vitest browser mode is the actively-developed option**: `vitest` 4.1.11 (2026-08-18, 32 releases in 2026), with 5.0.0-rc.2 in flight. Providers are now **separate packages** — `@vitest/browser-playwright`, `@vitest/browser-preview`, `@vitest/browser-webdriverio`, all at 4.1.11 — plus `vitest-browser-react` 2.2.0 for rendering. Setup is `npx vitest init browser`. The docs' own steer:

> to run tests in CI you need to install either `playwright` or `webdriverio` … If you don't already use one of these tools, we recommend starting with **Playwright because it supports parallel execution**.

**Recommendation: Vitest browser mode with the Playwright provider for the tier that genuinely needs a browser, and plain Node/Vitest for everything else.** It reuses one runner and one assertion API across both tiers, it is under active development, and it sidesteps the CT packages that are being deleted. Keep `@playwright/test` itself for full-page e2e and screenshots — that is not going anywhere; only the CT wrapper packages are.

### 6.4 Testing SVG output: what Recharts actually does (and it is not snapshots)

I cloned `recharts/recharts` and counted rather than guessing. **315 spec files. Seven `.snap` files. 840 total snapshot lines.** Snapshots are under 1% of the strategy, and they are confined to *primitive shapes at fixed known sizes*: `Curve`, `Cross`, `Polygon`, `Rectangle`, `Sector`, `Trapezoid`, `ReferenceArea`. **Zero composed charts are snapshotted.**

What carries the weight instead is a library of **domain-specific assertion helpers** in `test/helper/`:

```
expectAreaCurve    expectAxisTicks    expectBars        expectDots       expectLabel
expectLegendLabels expectLine         expectPieSectors  expectRadarPolygons
expectRadialBars   expectScale        expectScatterPoints  expectStackGroups
expectBrush        expectAnimatedPieAngles  expectAnimatedPiePaths
```

The pattern, from `test/helper/expectLine.ts` — query by semantic class, project to a plain object, compare with an explicit expected array:

```ts
export function expectLines(container: Element, expectedLines: ReadonlyArray<{ d: string | null }>) {
  const actualLines = Array.from(container.querySelectorAll('.recharts-curve.recharts-line-curve'))
    .map(line => ({ d: line.getAttribute('d') }))
  expect(actualLines).toEqual(expectedLines)
}
```

**So: they do assert exact `d` path strings — but written inline in the test, not captured in a `.snap` file.** That distinction is the whole answer to "is snapshotting SVG paths advisable?":

- An **inline expected `d` string** is a specification. When it changes, the diff is in the test file, in the PR, and the reviewer must consciously accept new geometry.
- A **`.snap` file** is a recording. When it changes, the fix is `-u`, and nobody reads 459 lines of regenerated markup. For a chart library where the geometry *is* the product, that is the failure mode you least want.

**Recommendation: semantic assertion helpers as the primary tier; inline `toMatchInlineSnapshot()` for path geometry; file snapshots only for leaf primitives at fixed sizes.** Build the `expect*` helper library *first* — Recharts' helper directory is the single most copyable artefact in this whole research file.

#### The precision gotcha, and why it is already handled

Path strings are only stable if the numbers in them are. Verified in `d3-shape@3.2.0`, `src/path.js`:

```js
export function withPath(shape) {
  let digits = 3;
  shape.digits = function(_) { /* ... */ }
  return () => new Path(digits);
}
```

**Every d3-shape generator rounds path coordinates to 3 decimal places by default**, and exposes a `.digits(n)` accessor to change it (`.digits(null)` for full float precision). `d3-path@3.1.0` implements this in `appendRound(digits)` via `Math.round(v * 10**d) / 10**d`.

That default is what makes `d` assertions viable at all — raw float output would differ in the last bits across platforms. Since decision 5 puts us on `d3-shape@3` directly, **we inherit this for free, and we can go further: call `.digits(2)` in our render tree** for sub-pixel-irrelevant but bit-stable output. Worth doing deliberately and documenting, because it converts "SVG snapshots are brittle" from folklore into a solved problem.

#### Recharts' `vitest.config.mts` is a six-tier blueprint

Their config defines six named `projects` in one file. This is worth copying wholesale:

| Project | Environment | What it proves |
|---|---|---|
| `unit:lib` | jsdom | Component behaviour, the 315 specs |
| `unit:website` | jsdom | Docs site |
| `unit:omnidoc` | default | Their docs-metadata layer |
| **`build-output`** | **`node`** | Runs `scripts/buildOutput.test.ts` + `verify-exports.test.ts` — **tests the published artefact** |
| **`treeshaking`** | **`node`** | Runs `scripts/treeshaking.test.ts` — **asserts tree-shaking** |
| `storybook` | **browser** | `storybookTest()` plugin, `provider: playwright()`, Firefox, headless |

Two of those tiers are ones most libraries never build, and both are directly applicable:

**Tree-shaking as an enforced test.** `scripts/treeshaking.test.ts` iterates every stable exported symbol, bundles it alone, and asserts the set of components that end up in the bundle equals a known-expected set — printing a `symmetricDifference` on failure:

```ts
expect(allBundledComponents,
  `Importing ${componentName} bundled different components than it should have. Diff: [...]`
).toEqual(knownExpectedBundle)
```

For a library whose entire packaging pitch is "import one chart, ship one chart", this converts a marketing claim into a CI gate. **Do this.**

**Public-API surface as an enforced test.** `scripts/verify-exports.test.ts` uses `ts-morph` to walk the type graph from `src/index.ts`, collecting `missingExports` (types referenced by the public API but not exported — the classic "cannot name the type of this prop" bug) and `forbiddenExports` (internal types leaking, via an explicit `FORBIDDEN_TYPES` ban list). Cheap, and it prevents the most common d.ts papercut.

Also note two config lines that the `ResizeObserver` pattern in 6.2 depends on: `restoreMocks: true` and `unstubGlobals: true` at the top level.

**Recharts also uses `@vitest/browser-playwright` and `@storybook/addon-vitest`** — corroborating 6.3's recommendation, and confirming the split provider packages are the current API.

#### What every other charting library does — the cross-library tally

Counted in clones and via code search on 2026-08-22, and the pattern is remarkably consistent:

| Library | Runner | SVG snapshots | Exact `d` assertions | How they get determinism |
|---|---|---|---|---|
| **d3-shape** | mocha, **no DOM at all** | 0 | **348**, via `assertPathEqual` | A rounding normaliser in `test/asserts.js` |
| **Recharts** | Vitest + jsdom | 31 sites in **7 of 315** files | **669 inline `d:'M…'` literals** | `TZ='UTC'`, faked rAF, mocked `getBoundingClientRect` |
| **visx** | Jest + jsdom | **0** | 5, pure geometry only | Pure functions tested without DOM |
| **nivo** | Jest + enzyme | 27 — of **computed data**, not markup | **0** | Tests the data pipeline, not the SVG |
| **ECharts** | Puppeteer + pixelmatch | No committed goldens | n/a | Seeded `Math.random = seedrandom('echarts-random')`; renders each of 606 demo pages **twice per build** and diffs the two |
| **Chart.js** | Karma, real browsers | **666 golden PNGs** | n/a (canvas) | `threshold` 0.1, `tolerance` 0.001, **all text hidden** |

Three conclusions fall straight out of this table:

1. **Nobody snapshots composed chart markup.** Not one of six libraries. The two that assert geometry heavily (d3-shape, Recharts) both write the expected string *inline*, in the test.
2. **The libraries that test geometry most rigorously are the ones that got the DOM out of the way** — d3-shape has no DOM at all and has by far the highest assertion density. This is decision 8's argument arriving from a completely different direction: **a pure `planChart()` returning a plain object is the most testable thing in this table.**
3. **Determinism is a prerequisite, not a nicety** — every single one of them does something explicit about it. Chart.js's contributing guide is blunt:

   > we've hidden all text in image tests since it's quite difficult to get them to pass between different browsers … It is also recommended to **disable animations**.

**Recharts' `test/vitest.setup.ts` is the concrete checklist to copy:**

```ts
process.env.TZ = 'UTC';
vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
```

Note the narrow `toFake` list — their comment explains that faking the wider Vitest 4 timer surface *"interferes with React scheduling"*. `TZ='UTC'` matters for us specifically: any time-axis chart formats dates through `d3-time-format`, and without a pinned timezone the tick labels differ between a contributor's laptop and CI.

Their `test/README.md` also flags a hard prerequisite that would otherwise cost a day of confusion:

> Recharts internally uses `getBoundingClientRect` to determine the size of various things. This means that you need to mock `getBoundingClientRect` in your tests, **otherwise nothing renders and nothing happens.** Tooltip, Legend, and the chart itself all depend on this.

We avoid this entirely on the static path — `<Chart plan={...}>` is handed its dimensions and never measures — which is worth stating as an explicit testability benefit of decision 7.

#### Recharts independently arrived at 6.1 and 6.2

Their own source comments confirm the probe results, which is about as good as corroboration gets.

`test/helper/mockGetTotalLength.ts`:

> jsdom does not implement `getTotalLength` on `SVGPathElement`: https://github.com/jsdom/jsdom/issues/1330 … The `SVGPathElement` (or `SVGGeometryElement`) global objects **do not appear to be available in the jsdom environment at all**. Thanks to this, we can't mock this using vitest at all, because vitest refuses to mock method on an object that is not supposed to have that method in the first place. **So we're back to monkey-patching.**

`test/helper/mockGetBoundingClientRect.ts`:

> `getBoundingClientRect` always returns 0 in jsdom, we can't test for actual returned string size

And their `ResizeObserver` handling in `test/util/useElementOffset.spec.tsx` is exactly the hand-rolled controllable fake recommended in 6.2:

```ts
vi.stubGlobal('ResizeObserver', vi.fn(function ResizeObserverMock(cb) {
  resizeObserverCallback = cb
  return { observe: observeSpy, unobserve: vi.fn(), disconnect: disconnectSpy }
}))
const triggerResizeObserver = () => { if (resizeObserverIsActive) resizeObserverCallback?.() }
```

They stayed on **jsdom**, not happy-dom, and mock the gaps explicitly. Given 6.1's finding that happy-dom returns silent zeros for the same APIs, that is the correct call: **choose the environment that fails loudly, then mock deliberately.**

### 6.5 Visual regression — and how Recharts tests resize

Recharts has a dedicated `test-vr/` directory, and it answers both "how do you do VRT cheaply" and "how do you test resize behaviour" at once. **They do not use Chromatic or Percy. They self-host Playwright screenshots and commit the baselines.**

Measured in the clone on 2026-08-22:

- **85 `*.spec-vr.tsx` files**
- **1,149 committed PNG baselines**, named `<test>-<browser>-linux.png` across **chromium, firefox and webkit**
- Docker base image pinned to `mcr.microsoft.com/playwright:v1.62.1-jammy`
- CI: `retries: 2`, `workers: 2` (*"the 2-core GitHub runner"*), `blob` reporter per browser job merged into one HTML report

From `test-vr/README.md`, verbatim:

> My favourite is the **`toHaveScreenshot()`** assertion which is the main reason why I bothered with playwright in the first place …

> This whole setup **runs in Docker and only in Docker** so that we can have a consistent environment which will allow us to **avoid test flakes due to different fonts and box shadows** and whatnot.

> `__snapshots__` — This is where all the snapshots (which would usually be screenshots) are stored. **Please commit this folder to the repository — this is the baseline.**

That is a complete, working, zero-vendor-cost VRT architecture from a library in exactly our category, and the Docker-for-font-determinism point is the detail that makes committed baselines actually viable.

Two gotchas they document, both worth inheriting:

> This whole setup [is] in its own directory mainly because **the storybook/test-runner will break if a `playwright/index.tsx` file exists**.

> Sometimes you may find an error that the `playwright` package no longer matches the `playwright` version in the Docker image … edit the `playwright-ct.Dockerfile` and change the `FROM` field.

(They even ship `scripts/check-playwright-versions.mjs` and `sync-playwright-versions.mjs` to police that drift.)

#### How they test resize — in a real browser, never in jsdom

`test-vr/tests/ResponsiveContainer.spec-vr.tsx` mounts the chart under a series of *layout* conditions and screenshots each:

- hardcoded `width={300} height={100}`
- `width="100%" height="100%"` inside a fixed 500×300 parent
- `width="50%" height="50%"` inside the same parent
- inside a **flexbox** parent at `flexBasis: 75%`
- aspect-ratio cases, and a "square chart that overflows a wide screen" case

**This is the correct answer to "how do you unit-test ResizeObserver": mostly, you don't.** You test the *pure resolver* in Node (§6.1/§6.2), and you test the *actual layout response* in a real browser, where the real `ResizeObserver`, the real flexbox algorithm and the real font metrics all participate. jsdom cannot do any of that — it has no layout engine at all, which is why `getBoundingClientRect()` returns zeros.

Two techniques from those tests to copy directly:

1. **`isAnimationActive={false}` on every series** — present in 49 of the 85 VR files. Determinism first.
2. **`<ChartSizeDimensions />`** — a debug-only component that draws a measuring-tape overlay (arrowed lines plus a text label of the computed width/height, read from `useChartWidth()`/`useChartHeight()`) directly into the chart. **This encodes the measured numbers as visible text inside the screenshot**, so a pixel diff becomes a readable "500 → 480" rather than an inscrutable smudge. For a library whose whole thesis is size-driven behaviour, this is close to essential — build the equivalent early.

#### The migration risk, live

Note their config imports from **`@playwright/experimental-ct-react`** and needs manual `ctViteConfig` aliases for `react`, `react-dom` and `react-is` *"to avoid issues with hooks and context"* — which is precisely the failure mode Playwright cited when removing those packages (§6.3). **Recharts will have to migrate.** We should not adopt the CT packages at all; go straight to the story-gallery model, or drive screenshots from a Storybook dev server, both of which survive 1.63.

#### Vitest 4 now ships visual regression natively

New in Vitest 4 and directly relevant: browser mode has a built-in **`toMatchScreenshot()`** assertion, using `pixelmatch` by default with a pluggable comparator. That collapses "unit tests" and "screenshot tests" into one runner and one config — no separate Playwright project needed for the *component-level* screenshots.

Two pieces of their guidance are worth quoting, because both are traps:

> Vitest does not define a default tolerance … The recommendation is to use **`allowedMismatchedPixelRatio`**, so that the threshold is computed on the size of the screenshot and not a fixed number.

> Running `vitest --update` locally would generate screenshots on your machine, **defeating the whole point of a controlled environment**.

Their answer to the second is a `workflow_dispatch`-only GitHub Actions job that regenerates baselines in CI and commits them. That is the same "determinism comes from the environment, not the assertion" conclusion Recharts reached with Docker — arrived at independently, which is a good sign it is right.

#### Hosted services — free tiers, verified

Chromatic and Percy solve baseline management and review UI without committing binaries — genuinely valuable, but they put a vendor in the contribution path. Free tiers as advertised on 2026-08-22:

| Service | Free tier | Next tier up | Notes |
|---|---|---|---|
| **Chromatic** | **$0/mo — 5,000 billed snapshots**, *"Equivalent to 25k turbosnaps"*, unlimited projects, users and collaborators | Starter **$179/mo** → 35,000 | Free tier is **Chrome only** |
| **Percy** (BrowserStack) | **5,000 screenshots/month** | Desktop **$199/mo** (annual) → 10,000; Desktop & Mobile **$599/mo** → 25,000 | |
| **Argos CI** | **$0 forever — up to 5,000 screenshots**, 30-day retention | Pro from **$100/mo** → 35,000, then **$0.004**/screenshot | Open-source alternative, self-hostable |

Sources: `chromatic.com/pricing`, `browserstack.com/percy` and `browserstack.com/pricing?product=percy`, `argos-ci.com/pricing`. Note `percy.io/pricing` is a JS shell that returns no prices to a fetch, and `browserstack.com/percy/pricing` 404s — use the two URLs above.

> **UNVERIFIED:** Chromatic's dedicated open-source programme. `chromatic.com/docs/open-source/` returned **HTTP 500** on 2026-08-22. Chromatic has historically offered uplifted free quotas for OSS projects; the current terms could not be confirmed. Ask them directly rather than assuming.

Calibration against our own scale: Recharts commits **1,149** baselines. At 5,000 snapshots/month, a free tier covers roughly **four full runs a month** of a suite that size — i.e. every hosted free tier is comfortable for a small deliberate suite and immediately inadequate for an exhaustive one. That is an argument for keeping the screenshot set small *regardless* of which route you pick.

**Recharts uses both.** They have a `chromatic.config.json` (`projectId`, `zip: true`, `storybookConfigDir: "storybook"`), `chromatic ^18.1.0` and `@chromatic-com/storybook ^5.2.1` in devDependencies — *and* the self-hosted Docker `test-vr/` suite. The division of labour is the interesting part: **Chromatic reviews the Storybook (broad, cheap, catch-anything), the committed Docker baselines pin the geometry (narrow, exact, free).**

#### `@storybook/test-runner` is being wound down

Worth knowing before adopting it: `@storybook/test-runner` is at **0.24.4 (2026-05-14)** while Storybook itself is at 10.5.10 (2026-08-20) — visible drift. Its own README now points elsewhere:

> use **`@storybook/addon-vitest`** … faster, provides features out of the box such as a11y and coverage

So of the four options the brief named, one is effectively deprecated. The live choice is Playwright screenshots vs Vitest browser mode vs a hosted service.

**Recommendation: self-hosted screenshots with committed baselines, generated in a pinned Playwright Docker image** — the Recharts architecture, minus the deprecated CT packages. Zero marginal cost, works identically for maintainers and drive-by contributors, and no vendor to re-evaluate. Keep the set deliberate — one screenshot per chart type per rung of the responsive ladder — because that set *is* the ladder's specification and it is the most valuable thing a reviewer can look at. Also set `reducedMotion: 'reduce'` in the Playwright context, which doubles as the §6.6 reduced-motion check.

Scale note: Recharts' 1,149 baselines × 3 browsers is a lot of binary churn. Starting with **chromium-only** and adding browsers when a cross-browser bug actually appears is the cheaper default.

### 6.6 Accessibility testing for charts

#### What the tools actually check — much less than people assume

`axe-core` is at **4.13.0** (2026-08-05, 127 releases in 2026) and is unambiguously the engine everyone uses. The SVG-relevant rule is `svg-img-alt`, and its definition is the whole story (`lib/rules/svg-img-alt.json`):

```json
{ "id": "svg-img-alt", "impact": "serious",
  "selector": ":is([role='img'], [role='image']), [role='graphics-symbol'], svg[role='graphics-document']",
  "matches": "svg-namespace-matches",
  "any": ["svg-non-empty-title", "aria-label", "aria-labelledby", "non-empty-title"] }
```

Read the `selector`. **The rule only matches an `<svg>` that already declares one of those roles.** An `<svg>` with no `role` attribute is never matched, so axe reports **nothing at all** — a completely unlabelled chart passes clean.

That is the honest answer to "what do these tools actually check": **axe verifies that a graphic you have already declared to be a graphic has an accessible name. It cannot tell you whether your chart is comprehensible.** Everything that actually matters for a chart — is the data available in another form, are the series distinguishable without colour, can a keyboard user reach the data — is outside axe's reach.

axe-core's own README puts a number on the general case: **you can find on average *"57% of WCAG issues automatically."*** For charts specifically it is far below that — **only 2 of axe's 105 rules apply to an SVG chart at all** (`svg-img-alt`, plus `aria-*` hygiene rules that fire on any element).

And a trap for the unit tier, from the `jest-axe` README:

> **Color contrast checks do not work in JSDOM so are turned off in jest-axe.**

Since contrast between series colours is one of the few chart-relevant things a tool *could* check, this means the jsdom tier gives you close to nothing on a11y. **The a11y checking has to happen in the browser tier or it is theatre.**

There is a useful inversion here: **adopting the graphics roles is what switches the automated checking on.** Set `role="graphics-symbol"` on legend swatches and axe starts requiring names for them. Accessibility work and automated enforcement arrive together.

Tooling versions, with one trap:

| Package | Latest | Published | Releases 2026 |
|---|---|---|---|
| `axe-core` | 4.13.0 | 2026-08-05 | 127 |
| `@axe-core/playwright` | 4.13.0 | 2026-08-11 | 70 |
| `@storybook/addon-a11y` | 10.5.10 | 2026-08-20 | 589 |
| `jest-axe` | 11.0.0 | 2026-07-26 | 1 |
| **`vitest-axe`** | **0.1.0** | **2022-10-21** | **0** |

**`vitest-axe` is abandoned** — 0.1.0, untouched since October 2022. It is still widely recommended in blog posts. Use `@axe-core/playwright` (browser tier) and/or `@storybook/addon-a11y`, or call `axe-core` directly; do not add `vitest-axe`.

#### WAI guidance: the standard advice about `aria-describedby` is wrong for charts

W3C WAI's *Complex Images* tutorial (https://www.w3.org/WAI/tutorials/images/complex/) states that a chart needs **a two-part text alternative**: a short description that identifies the image and indicates where the long description is, plus a long description that is *"a textual representation of the essential information conveyed by the image."*

The important part is the caveat on tables. The tutorial warns that `aria-describedby` content is *"treated as one continuous paragraph of text"*, so assistive technology gets no *"structural information, such as any headings and tables"* and loses *"the corresponding navigation mechanisms."* It concludes `aria-describedby` *"only works for long descriptions that are text-only."*

**So the widespread pattern — `aria-describedby` pointing at a visually-hidden `<table>` — actively destroys the table semantics it was meant to expose.** The tutorial's recommended structure for a chart with tabular data is instead `<figure>` containing the graphic and a `<figcaption>` holding *"headings, text, and a table"*.

It also says, plainly: **"Make long descriptions available to everyone to reach a wider audience with your content."**

That is a design instruction, not a compliance checkbox, and it fits this library unusually well. A `<details>`-toggled data table inside a `<figure>` is (a) correct per WAI, (b) useful to sighted users too, (c) pure markup with no client JS, so it renders in an RSC — and (d) it is *another rung of the responsive ladder*: at large sizes the table can be shown alongside, at small sizes collapsed.

#### The roles to use

**WAI-ARIA Graphics Module 1.0 is a W3C Recommendation dated 2018-10-02** (https://www.w3.org/TR/graphics-aria-1.0/) — a stable REC, not a draft note. Three roles, and the fourth column is the one that matters:

| Role | Definition (verbatim) | Use for | Name required | **Children Presentational** |
|---|---|---|---|---|
| `graphics-document` | *"A type of `document` in which the visual appearance or layout of content conveys meaning."* | The chart `<svg>` as a whole | **Yes** | **False** — children preserved |
| `graphics-object` | *"A section of a `graphics-document` that represents a distinct object or sub-component with semantic meaning."* | A series / a group of bars | No | **False** — children preserved |
| `graphics-symbol` | *"A graphical object used to convey a simple meaning or category, where the meaning is more important than the particular visual appearance."* | A legend swatch, a point marker | **Yes** | **True** — children erased |

#### The trap: `role="img"` silently deletes your data table

The spec explains the consequence directly:

> certain roles, such as `img` or `graphics-symbol`, when assigned to a parent element, **will cause all child DOM structure to be omitted from the accessibility tree**.

The single most commonly recommended chart-a11y pattern on the internet is `<svg role="img" aria-label="...">` with a visually-hidden `<table>` inside for screen readers. **That pattern does not work.** `role="img"` is Children Presentational True, so the entire subtree — including the table — is erased from the accessibility tree. The markup looks correct, the axe run passes, and a screen-reader user gets the label and nothing else.

Two valid fixes, and we should do both:

1. **Put the table outside the `<svg>`** — which is what §6.6's `<figure>` structure already does, for an unrelated reason. Two independent lines of evidence converging on the same markup is a strong signal it is right.
2. **Use `role="graphics-document"` on the `<svg>`, not `role="img"`** — it requires a name *and* preserves children, so `graphics-object` series and `graphics-symbol` markers inside it remain reachable.

> **UNVERIFIED: real assistive-technology support for `graphics-document` and `graphics-object`.** The spec is a 2018 Recommendation and I found no current AT support matrix. Note that Highcharts — the most a11y-invested charting vendor — solves this with a text description, keyboard navigation and a data-table export rather than with the graphics roles. **Treat the roles as the correct semantic floor and the `<figure>` + `<table>` as the thing that actually delivers the information.** Do not rely on the roles alone.

The module also points at ARIA's existing `img` (an indivisible single graphic) and `figure` (graphics plus caption) — which is consistent with the `<figure>` recommendation above.

#### `prefers-reduced-motion`, and a testing trap

Two WCAG success criteria bind here:

- **SC 2.3.3 Animation from Interactions (AAA)** — *"Motion animation triggered by interaction can be disabled, unless the animation is essential to the functionality or the information being conveyed."* The understanding document explains the stakes: for users with vestibular disorders, motion can trigger *"nausea, headaches, and dizziness."* Chart entry/transition animations are triggered by interaction (a resize, a filter change) and are **never essential to the information** — the final frame carries all of it.
- **SC 2.2.2 Pause, Stop, Hide (A)** — applies to anything that auto-starts and runs more than 5 seconds. Relevant if we ever ship looping or streaming animation.

**Technique C39** is the implementation guidance, and it specifies a polarity worth getting right:

```css
/* opt IN to motion, rather than opting out */
@media (prefers-reduced-motion: no-preference) {
  .chart-series { transition: d var(--chart-transition-duration) ease; }
}
```

Using `no-preference` rather than `reduce` means the **safe path is the default** — a browser that does not support the query, or a user whose OS preference is unset, gets no animation rather than unwanted animation. For a library, where you cannot know the consumer's context, that is the correct default.

Express durations as CSS custom properties (`--chart-transition-duration`) so the query only has to zero one value, and so consumers can override per-widget — which is decision 4 doing double duty.

Verified in §6.1: **`window.matchMedia` is `undefined` in jsdom.** So any reduced-motion branch cannot even be *executed* in the default unit environment without stubbing `matchMedia` first — and a naive `window.matchMedia?.('...')` optional-call silently takes the "motion allowed" path. happy-dom does provide `matchMedia`, which is one of the few places it is genuinely better.

Two things follow:
1. **Prefer the CSS media query over the JS API** wherever the effect is purely visual. `@media (prefers-reduced-motion: ...)` in a CSS Module needs no JS, no stub, works in RSC, and is testable in a real browser via Playwright's `reducedMotion: 'reduce'` context option. This is the same argument as §6.1's text-measurement finding: the constraint pushes you to the better implementation.
2. Where JS must branch, inject the preference as a prop/option with a `matchMedia`-derived default, so the pure path stays pure and testable.

**The assertion that actually matters:** the *final rendered state must be pixel-identical with and without reduced motion*. Reduced motion must remove the transition, never change the result. That is one Playwright test per chart type — take the screenshot under both `reducedMotion: 'reduce'` and `'no-preference'` after animations settle, and compare them to the same baseline. It is cheap, and it catches the common bug where the "reduced" path skips a layout step rather than skipping the tween.

#### Recommended a11y tiers

1. **Static structure tests (Node/jsdom):** assert the rendered markup has `role="graphics-document"` + accessible name, a `<figure>`/`<figcaption>`, and a `<table>` whose cells match the input data. Cheap, deterministic, catches regressions.
2. **`@axe-core/playwright` in the browser tier**, run over the same Storybook stories used for VRT. Catches name/contrast/duplicate-id issues.
3. **`@storybook/addon-a11y`** for the interactive authoring loop — it is what makes contributors notice problems before CI does.
4. **Manual, documented, not automated:** keyboard reachability of the data, and colour-independence of series encoding. No tool checks these; a short checklist in `CONTRIBUTING.md` per chart type is the realistic answer.

---

## 7. Docs site

### 7.1 What the comparables actually use — verified from their repos

I read the docs app's `package.json` in each repo rather than trusting blog posts. The result is the single most surprising table in this file.

| Library | Docs stack | MDX layer | Code display | Live editing |
|---|---|---|---|---|
| **shadcn/ui** | **Fumadocs** — `fumadocs-core`/`fumadocs-ui` **16.10.5**, `fumadocs-mdx` 15.0.12, `fumadocs-docgen` 3.0.10, on Next **16.3.0-canary.97** | fumadocs-mdx | `shiki ^3.23.0` | none — bespoke live previews |
| **Mantine** | bespoke Next **16.2.10** | `@next/mdx` + `@mdx-js/*` | `shiki ^4.3.1` | bespoke demo runner |
| **Chakra UI** | bespoke Next **15.5.19** | **`velite` 0.3.1** | `@shikijs/rehype` + transformers | bespoke |
| **Base UI** | bespoke Next **16.3.1** | `@next/mdx` + `mdast-util-mdx-jsx` | shiki | bespoke |
| **Radix UI** | separate `radix-ui/website` repo, bespoke Next **16.2.7** | `mdx-bundler ^10.1.1` | `prism-react-renderer` | **`@stackblitz/sdk`** — "open in StackBlitz" |
| **TanStack** | separate `tanstack.com` repo — **TanStack Start + Vite**, not Next | own | shiki | `esbuild-wasm` + WebContainers |
| **Recharts** | `www/` — **Vite 6 + React Router 7** | own | **CodeMirror 6** | **`react-runner ^1.0.5`** + `@stackblitz/sdk` |
| **visx** | `@visx/demo`, bespoke Next **~15.5.18** | own | `prismjs` | bespoke |
| **nivo** | **Gatsby 5.14.3** | Gatsby MDX | `prism-react-renderer` | bespoke live controls |

**The headline: exactly one of nine uses a docs framework.** Everyone else hand-rolls on Next.js (or Gatsby, or Vite). And of the nine, **not one uses Nextra, Docusaurus, VitePress, Starlight or Vocs.** The entire "which docs framework" question that the brief poses turns out to be, empirically, a question the React component-library ecosystem has answered with "bespoke Next.js, or Fumadocs."

Why: a component library's docs *are* an app. They must render the library's own components, at the library's own React version, with the library's own CSS. A framework that owns the React runtime (Docusaurus, Gatsby, Starlight, VitePress) is fighting you; a framework that is just Next.js with MDX conventions on top is helping you.

### 7.2 Registry health — two of the named candidates are stalled

| Package | Latest | Published | Releases in 2026 |
|---|---|---|---|
| **`fumadocs-ui` / `fumadocs-core`** | **16.15.0** | **2026-08-21** | **91** |
| `@docusaurus/core` | 3.10.2 | 2026 | 79 |
| `vocs` | 2.8.5 | 2026 | 57 |
| `@astrojs/starlight` | 0.41.7 | 2026 | 25 |
| `rspress` | 1.47.2 | 2026 | 2 |
| **`nextra`** | **4.6.1** | **2025-12-04** | **0** |
| **`vitepress`** | **1.6.4** | **2025-08-05** | **0** (`next` = 2.0.0-alpha.19, 2026-08-02) |

**Nextra has published nothing in 2026** — over eight months stale, and it is the framework most people would name first for a Next.js docs site. **VitePress's stable line is a year old** and its 2.0 is in alpha. Both are on the brief's candidate list; both are out on maintenance grounds alone, before any feature comparison.

Fumadocs at 91 releases in 2026 is not merely alive, it is the most active docs framework in the sample by a wide margin, and its weekly download count (~1.17M) is roughly **5.5×** Nextra's (~213k). Its peer deps are `next: 16.x.x` and `react: ^19.2.0` — **exactly our target stack**, which is not a coincidence: shadcn/ui drove much of it.

### 7.3 Live editable code — every library in this space is dormant

| Package | Latest | Published | Releases in 2026 |
|---|---|---|---|
| `@codesandbox/sandpack-react` | 2.20.0 | **2025-02-14** | **0** |
| `react-live` | 4.1.8 | **2024-11-19** | **0** |
| `react-runner` | 1.0.5 | **2024-06-05** | **0** |
| `@stackblitz/sdk` | 1.11.1 | 2026 | healthy |
| `shiki` | 4.4.3 | 2026 | healthy |
| `@next/mdx` | 16.3.2 | 2026 | healthy |

**All three in-page live editors are unmaintained.** Sandpack — the one most people reach for — has shipped nothing in 18 months. Two further disqualifiers found:

- **`react-live` cannot resolve imports at all.** Its API docs are explicit that code runs against an injected `scope` object; there is no module resolution. Every symbol a reader might import has to be pre-injected by us, and an example that begins `import { LineChart } from '@gx/primitives'` simply cannot be pasted in and run. For a library whose examples are all imports, that is fatal.
- **`react-runner`'s peer dependencies do not include React 19.** We would be installing it against an unsupported peer on day one.

This reframes the question. The brief asks "which docs frameworks support Sandpack/react-live cleanly" — the honest answer is **that is the wrong axis, because none of those libraries are worth adopting in 2026.** What the healthy ecosystem actually does, and what Radix and Recharts both do, is:

1. **Static, beautiful code with Shiki** (build-time, zero client JS, works in RSC).
2. **"Open in StackBlitz"** via `@stackblitz/sdk` for readers who want to actually edit — handing off to a real editor with real npm resolution, rather than badly simulating one in-page.
3. **Bespoke interactive React components** in MDX for the demos that matter.

Point 3 is the one that matters for us.

### 7.4 The requirement that decides it: the docs must be draggable

The library's premise is that a chart's *information content* changes with its size. A code block cannot show that. A static screenshot cannot show that. **The reader has to grab a corner and drag.** That makes "can this framework host a genuinely interactive, stateful, client-side React component, at our React version, inside prose" the primary criterion — and it demotes every criterion docs frameworks usually compete on.

Against that criterion:

| Framework | Hosts an arbitrary `'use client'` React 19 component in MDX? |
|---|---|
| **Fumadocs** | **Yes, natively** — it *is* Next.js App Router; MDX files import client components directly |
| Bespoke Next.js | Yes, by definition |
| Docusaurus / Gatsby / Starlight / VitePress | Possible, but you are running their React (or Vue) runtime and their build, at their version |

Fumadocs has **no built-in code playground** (verified by scanning the repo — there is no Sandpack/react-live integration). Given §7.3, that is a feature, not a gap: we do not want their playground, we want to render our own component.

**The interactive demo is a bespoke component either way**, on every framework. So pick the framework that puts the fewest layers between an MDX file and a React 19 client component — and that has an actively maintained answer for navigation, search, sidebars and versioning so we do not hand-roll those too.

#### Two implementation facts for the resize demo, verified from caniuse-db

- **CSS `resize: both` does not work on iOS Safari. Ever.** The `css-resize` feature is `n` on **every** iOS Safari version through the current **26.5**, while desktop Safari 26.x is `y`. Global support 82.69%. So the one-line CSS solution silently gives every iPhone and iPad reader a non-draggable box — on the single page that carries the library's whole argument.
  → **Build a pointer-events drag handle.** `pointerdown`/`pointermove` + `setPointerCapture` works everywhere and gives touch for free. We are building a resize library; dogfooding the handle is the right kind of proof. (`react-resizable-panels` — **4.12.3, 2026-08-16, 55 releases in 2026**, used by shadcn/ui — is the reference implementation and the fallback if we do not want to own it.)
- **Container queries are the right layout primitive for the demo shell**: **93.96%** global support, Safari/iOS **16.0**, Chrome 106, Firefox 110. Widely enough supported to build the docs on, and they let the demo's own chrome respond to the dragged box without JS.

#### What to build

A `<ResizeLab>` MDX component: a resizable box with a real drag handle, the chart inside, and — beside it — **a live readout of the resolved `SizeContext` and the diffed `ChartPlan`**. As the reader drags, they watch `sizeClass` flip and plan fields change. That makes the invisible mechanism visible, and it is directly reusable as a debugging tool for us.

Note what this needs from the architecture: `planChart()` must be callable in the browser, synchronously, cheaply, on every pointer move. Decision 8's pure-plain-object plan is what makes the docs' hero feature possible at all.

#### Nobody else has this

Checked across the comparables: **no charting library in the sample ships drag-to-resize chart demos.** Recharts documents `ResponsiveContainer` with static code samples; visx and nivo use fixed-size demos with control panels. The interaction that best demonstrates our library is one that no competitor's docs offer — which makes the docs site a differentiator rather than a chore, and argues for investing in it earlier than a docs site normally deserves.

### 7.5 Recommendation for §7

**Fumadocs on Next.js 16 + React 19**, with:
- **Shiki** for static code (build-time, RSC-safe, already Fumadocs' default);
- **bespoke MDX client components** for every interactive demo, `<ResizeLab>` first;
- **`@stackblitz/sdk`** "open in StackBlitz" for full runnable examples — the Radix/Recharts pattern;
- **no Sandpack, no react-live, no react-runner** — all three are dormant, and two cannot do what we need.

Second choice: bespoke Next.js + `@next/mdx`, which is what 7 of 9 comparables do and carries zero framework risk. Fumadocs' advantage is that it hands us search, sidebar and versioning conventions for free at the same React version; its risk is a single-maintainer-ish dependency, mitigated by the fact that it is trivially ejectable — it is Next.js underneath, and the MDX files survive.

> **UNVERIFIED:** Fumadocs' bus factor and governance. High release velocity is evidence of activity, not of institutional backing. Worth a look at the contributor graph before committing.

---

## 8. Recommended stack and packaging specifics

### 8.1 The stack, one line each

| Layer | Choice | Why (one line, grounded in the evidence above) |
|---|---|---|
| Monorepo | **pnpm workspaces + Turborepo** | §1: the majority pattern among comparables, and Nx's own preset used by the sample is cache-only, i.e. Turborepo's job. |
| Build | **`tsdown` with `unbundle: true`** | §2.4: the only maintained tool that gets `'use client'`, preserve-modules, per-entry `.d.ts`, CSS *and* built-in publint/attw in one config; two TanStack repos already ship on it. |
| TypeScript | **pin `6.0.3`** | §2.3: TS 7.0.2 is stable-tagged but tsdown warns its API is experimental; TanStack and Base UI all pin 6.0.3. |
| Format | **ESM-only** | §3.4: TanStack Table 9 went ESM-only; halves the artefact count, removes dual-package hazard, and dodges the §2.3 CJS+unbundle+CSS bug. |
| CSS | **CSS Modules + `@tsdown/css`**, tokens as custom properties | §2.3: per-file CSS emitted alongside JS under `unbundle`; decision 4 already fixes the theming mechanism. |
| Release | **Changesets** | §5.1: used by 5 of 10 comparables; semantic-release and release-please by **none**. |
| Publish | **npm trusted publishing via GitHub Actions OIDC** | §5.2: provenance is generated automatically, no `--provenance` flag, and Changesets' own docs recommend it over staged publishing. |
| PR previews | **pkg.pr.new** | §5.4: named in the Changesets docs; ephemeral, does not pollute the version history the way snapshot releases do. |
| Unit tests | **Vitest + jsdom** (not happy-dom) | §6.1: jsdom throws loudly, happy-dom returns silent zeros; a false green on text measurement is the worst outcome for this library. |
| Browser tests | **Vitest browser mode**, `@vitest/browser-playwright` | §6.3: Playwright's CT packages are removed; Vitest browser mode left experimental in v4 and Recharts already uses this provider. |
| Visual regression | **self-hosted screenshots, committed baselines, pinned Playwright Docker image** | §6.5: Recharts' architecture, zero marginal cost, and Docker is what makes committed baselines survive font differences. |
| a11y | **`@axe-core/playwright`** in the browser tier + manual checklist | §6.6: contrast checks do not run in jsdom, and only 2 of 105 axe rules touch an SVG chart — the browser tier or nothing. |
| Docs | **Fumadocs** + Shiki + bespoke MDX demos | §7: 91 releases in 2026, peers are exactly Next 16 / React 19, and it hosts arbitrary client components natively. |

### 8.2 Packaging, per package

The graph is `20-architecture.md` §2 and is not re-litigated here. `@gx/*` remains the placeholder scope. Packaging specifics:

| Package | `'use client'` | `sideEffects` | Build | Notes |
|---|---|---|---|---|
| `@gx/tokens` | no | `["*.css"]` | CSS + generated `.d.ts` | Ships a stylesheet; no runtime JS to tree-shake. |
| `@gx/core` | no | **`false`** | tsdown, `unbundle`, ESM | Pure; no CSS, no React. The strict `false` is meaningful here and should be enforced. |
| `@gx/primitives` | **no** | `["*.css"]` | tsdown, `unbundle`, ESM, `@tsdown/css` | Subpath exports per chart type (`/line`, `/bar`, `/donut`) per §2 of the architecture. |
| `@gx/react` | **yes, per file** | `["*.css"]` | tsdown, `unbundle`, ESM | Directive at the top of each client entry — see 8.3. |
| `@gx/grid` | **yes, per file** | `["*.css"]` | tsdown, `unbundle`, ESM | Must wrap `react-grid-layout@2`, which ships **no** `'use client'` of its own (verified in §2.2). |
| `@gx/testing` | no | `false` | tsdown, `unbundle`, ESM | Dev-facing; `publishConfig` can keep it out of the main install path. |

Every package declares `peerDependencies: { react: "^19" }` where it touches React — **not optional**: §2.3 found Rolldown inlining `react/jsx-runtime` into `dist/node_modules/` when peers were undeclared.

### 8.3 `'use client'` — the specific placement rule

`20-architecture.md` §2 says *"Only `@gx/react` and `@gx/grid` carry `use client`"*. That is right at package granularity but needs a per-file refinement, because Next's docs are explicit (§4.1):

> You do not need to add the `'use client'` directive to every file … You only need to add it to the files whose components you want to render directly within Server Components.

Combined with §2.2's empirical finding — Rolldown preserves the directive **only** on entry modules or under `unbundle`/`preserveModules` — the rule is:

- **Put `'use client'` at the top of each source file that is a public client entry** (the file exporting `<AutoChart>`, the file exporting the grid shell), not on every internal file, and not once at a package root.
- **Build with `unbundle: true`**, which guarantees per-file preservation. This is the belt-and-braces position: even a file that is *not* an entry keeps its directive.
- **Do not use `output.banner`** to force the directive globally — it would mark server-safe modules as client and defeat the whole `@gx/primitives` RSC story.

### 8.4 The `exports` map

Because we ship **ESM-only with sibling `.d.ts`**, we can use bare string targets and **avoid condition objects entirely** — which means the types-first ordering rule from §3.1 never gets a chance to bite. This is the `@tanstack/react-table@9` shape, verified in §3.4, extended with CSS:

```jsonc
{
  "name": "@gx/primitives",
  "type": "module",
  "sideEffects": ["*.css"],
  "engines": { "node": ">=20" },
  "exports": {
    ".":              "./dist/index.js",
    "./line":         "./dist/line/index.js",
    "./bar":          "./dist/bar/index.js",
    "./donut":        "./dist/donut/index.js",
    "./styles.css":   "./dist/styles.css",
    "./package.json": "./package.json"
  },
  "peerDependencies": { "react": "^19" },
  "publishConfig": { "access": "public", "provenance": true }
}
```

Four details that are each load-bearing:

- **No `main`, no `module`, no top-level `types`.** Types resolve through the sibling `.d.ts` next to each `.js`, which `node16` and `bundler` resolution both handle. Adding legacy fields would reintroduce the ambiguity `exports` exists to remove.
- **`"./package.json": "./package.json"`** — several tools want it, and publint asks for it.
- **`"./styles.css"`** as an explicit subpath, so consumers write `import '@gx/primitives/styles.css'`. Per §4.2, Next allows external-package stylesheets to be imported anywhere in `app/`.
- **`engines.node: ">=20"`** — publint suggests it when absent (§3.5).

`sideEffects: ["*.css"]` rather than `false` is the one place where being strict would be a bug: `false` tells bundlers a bare `import './chart.css'` can be dropped, and the styles vanish.

### 8.5 CI gates worth having

In rough order of value per unit of effort:

1. **`publint --strict`** — catches malformed `exports` before users do (§3.5).
2. **`attw --pack . --exclude-entrypoints ./styles.css --profile node16`** — the exclusions are not optional: §3.5 measured that a CSS subpath fails attw in *every* resolution mode, and node10 fails for every subpath, always.
3. **A real Next.js 16 App Router fixture app that imports each package and builds.** This is the only honest test that `'use client'` survived, and `20-architecture.md` §5 is right to insist on it. Assert the build succeeds *and* grep the output for the directive.
4. **Tree-shaking assertion** — Recharts' `scripts/treeshaking.test.ts` pattern (§6.4): bundle each exported symbol alone, assert the resulting component set equals an expected set. For a library selling "import one chart, ship one chart", this converts the pitch into a gate.
5. **Public-API surface test** — their `verify-exports.test.ts` `ts-morph` walk catching types referenced by the public API but not exported.
6. **Token lint gate** — already specified in `20-architecture.md` §5; rejects raw hex/rgb/hsl colours, raw `px` values, and gradients in token CSS.
7. **`@gx/core` imports nothing from React** — a one-line dependency-cruiser or import-lint rule that protects the single most valuable property in the architecture.

### 8.6 Where my findings contradict `20-architecture.md`

Four corrections, per the coordinator's request to surface disagreements rather than let them sit.

**(a) §5's `preserveModules` is the right concept but the wrong config key for the recommended tool.**
`preserveModules` is a *Rollup* output option. In tsdown/Rolldown the option is **`unbundle: true`** (§2.3, verified against `docs/options/unbundle.md`). If §5 is read as a literal config instruction it will not work. Same behaviour, different key.

**(b) §5 leaves CJS open; the evidence closes it.**
§5 says *"CJS only if 07 produces evidence it is still needed in 2026."* **The evidence says ship ESM-only** (§3.4), and there is an additional reason §5 could not have known: §2.3 found a reproducible tsdown/Rolldown bug where `unbundle` + CJS + a CSS import emits `require("./chart2.cjs")` for a file that is never written. Our exact desired configuration is broken in CJS. §5 can be closed as ESM-only.

**(c) §6's "snapshotting SVG path strings is explicitly avoided" is directionally right but overstated.**
Plan snapshots as the primary assertion is correct and I would not change it. But the blanket avoidance of `d`-string assertions is not what the field does (§6.4): **d3-shape makes 348 exact `d` assertions; Recharts has 669 inline `d:'M…'` literals.** The reason it is safe is that **d3-shape rounds path coordinates to 3 decimals by default** (`withPath` → `let digits = 3`), so the strings are bit-stable across platforms — a fact we inherit free via decision 5, and can tighten with `.digits(2)`.

The distinction that actually matters is not *whether* to assert `d` but *where the expected value lives*: **inline in the test (a specification a reviewer must consciously accept) rather than in a `.snap` file (a recording nobody reads before typing `-u`).** Suggest rewording §6 to "**avoid `.snap` files for composed charts; inline `d` assertions are fine and are the industry norm**."

**(d) A genuine architectural catch in §3.2, not just wording.**
The override cascade has at level 2: *"token values read from CSS (`--gx-*` → resolved once, client-side)."* If any token-derived value feeds `planChart()`, then **the plan is not computable on the server**, because there is no CSSOM in an RSC render — and server and client would compute *different plans*, producing a hydration mismatch on every chart.

The fix is a rule, and it is cheap if adopted now: **token values may influence presentation (colour, stroke, radius, font-family) but must never be inputs to `planChart()`.** Anything that changes *what is drawn* — tick counts, label visibility, aggregation thresholds, the `sizeClass` boundaries — must come from props and defaults only. If a boundary genuinely needs to be themeable, it has to arrive as a prop through `<GxConfig>` (level 3), not read from CSS.

This also protects the docs: `<ResizeLab>` (§7.4) recomputes the plan on every pointer move, and reading the CSSOM on each move would force style recalculation and make the hero demo janky.

---

## 9. Open questions I could not close

- **UNVERIFIED: Chromatic's open-source programme terms.** `chromatic.com/docs/open-source/` returned HTTP 500 on 2026-08-22. The paid tiers are verified (§6.5); an OSS uplift may exist on top.
- **UNVERIFIED: real assistive-technology support for `graphics-document` / `graphics-object`.** The spec is a 2018 Recommendation; I found no current support matrix (§6.6).
- **UNVERIFIED: Fumadocs governance / bus factor** (§7.5).
- **UNVERIFIED: whether `unbuild` preserves `'use client'`** (§2.2) — not chased, since its maintenance state ruled it out regardless.
- **Not filed upstream:** the tsdown `unbundle` + CJS + CSS bug in §2.3, observed on `tsdown@0.22.14` / `rolldown@1.2.5`. Worth reporting if we ever need CJS.

