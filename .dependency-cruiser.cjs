/**
 * Gate **G1** — `@gx/core` imports no React, and no package above it in the graph.
 *
 * ⚠ `research/20-architecture.md` §2 calls this the most valuable property in the
 * architecture, and it is protected by roughly ten lines. The moment core imports React,
 * `planChart()` stops being a pure function anyone can call — from a server component, a
 * worker, a CLI, a test with no DOM — and becomes a React library with a resolver inside
 * it. Nothing else in the design survives that.
 *
 * ⚠ It is enforced twice on purpose. ESLint's `no-restricted-imports` (eslint.config.js)
 * catches the mistake as it is typed; this catches it transitively, which ESLint cannot —
 * core importing a helper that imports React is the same violation and looks like nothing
 * at the call site.
 *
 * CommonJS because the root manifest is `"type": "module"` and dependency-cruiser loads
 * its config with `require`.
 */

module.exports = {
  forbidden: [
    {
      name: 'core-imports-no-react',
      severity: 'error',
      comment:
        'G1: @gx/core is framework-agnostic. planChart() must be callable from a server ' +
        'component, a worker, a CLI, or a test with no DOM.',
      from: { path: '^packages/core/src' },
      to: { path: '^(node_modules/)?(react|react-dom|react-grid-layout)(/|$)' },
    },
    {
      name: 'core-sits-below-everything',
      severity: 'error',
      comment:
        'G1: @gx/core is the bottom of the graph. It may depend on @gx/tokens and on d3, ' +
        'and on nothing else in this repo.',
      from: { path: '^packages/core/src' },
      to: { path: '^packages/(react|primitives|grid|testing)/' },
    },
    {
      name: 'primitives-stay-hook-free',
      severity: 'error',
      comment:
        'react-dom in @gx/primitives breaks RSC safety — the package ships no "use client" ' +
        'directive and a CI grep of the build output asserts that. 20-architecture.md §2.',
      from: { path: '^packages/primitives/src' },
      to: { path: '^(node_modules/)?react-dom(/|$)' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'A cycle across package boundaries makes the build order undefined.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment:
        'A module nothing imports is either dead or not wired up yet. Entry points and ' +
        'test files are orphans by design — the runner reaches them, no module does.',
      from: {
        orphan: true,
        pathNot: ['\\.d\\.ts$', '(^|/)index\\.ts$', '\\.(test|spec)\\.[cm]?[jt]sx?$'],
      },
      to: {},
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    exclude: { path: '(^|/)(dist|\\.turbo)/' },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
}
