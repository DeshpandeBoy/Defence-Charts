import { defineConfig } from 'tsdown'

// `unbundle: true` is the only config in which a `"use client"` directive survives a
// Rolldown build on a non-entry file (30-implementation-plan.md A1). It is load-bearing
// for decision 7, not an optimisation — do not remove it to "simplify the build".
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  unbundle: true,
  dts: true,
  clean: true,
  platform: 'neutral',
  exports: { devExports: true },

  /**
   * ⚠ jsdom, declared external **explicitly**, because it is already external by accident.
   *
   * Rolldown derives its default externals from `dependencies` and `peerDependencies`, and
   * jsdom is neither — it is a `devDependency` of this package. So without this line the
   * bundler tries to resolve it, fails (`platform: 'neutral'` ignores the `main` field of a
   * CommonJS package), prints `UNRESOLVED_IMPORT — Module not found, treating it as an
   * external dependency`, and arrives at the right answer for the wrong reason. A green build
   * whose log says "module not found" is the same shape as every other failure this repo
   * documents: it looks like it works.
   *
   * The consequence of it silently going the other way is not a warning but a catastrophe —
   * jsdom's entire dependency tree inlined into `dist/expect.js`, on a `neutral` platform that
   * cannot supply the Node builtins it needs.
   *
   * ⚠ The real fix is `jsdom` in `dependencies`: `parseChart()` cannot run without it, so it
   * is a runtime dependency of this package's public API and calling it a dev one is a
   * misfiling. That is a manifest **and lockfile** change. This line is correct either way and
   * should stay after it.
   *
   * ⚠ `deps.neverBundle`, not the top-level `external` — tsdown 0.22 deprecates the latter and
   * warns on every build.
   */
  deps: { neverBundle: ['jsdom'] },
})
