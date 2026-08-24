'use client'

/**
 * `@gx/react` — the client boundary, declared once, here.
 *
 * ⚠ **The `"use client"` directive above is load-bearing and must stay on line 1.** It is
 * not a hint. It is the one statement in this repository that tells an RSC bundler where the
 * server graph ends, and everything this file re-exports is inside the client graph because
 * of it. CI greps the built output for it (gate **G3**), and the grep is anchored to the
 * leading directive prologue of `dist/index.js` — `check-boundary.mjs`'s comment says *"a
 * `'use client'` on line 40 is a string expression, not a directive."* Move it below an
 * import and it becomes a string literal that does nothing, silently, in a build nobody
 * re-reads. `unbundle: true` is the **only** tsdown/Rolldown configuration in which the
 * directive survives a build on a non-entry file (`research/30-implementation-plan.md` A1),
 * which is why `AutoChart.tsx` carries its own copy and why the config is not negotiable.
 *
 * ⚠ **A5 filled this package, and the shape of what landed is the point.** Two exports: one
 * hook that reads a box, one component that turns that box into a plan and hands the plan to
 * `@gx/primitives`. There is no chart code here, no geometry, no policy and no ladder — all
 * of that lives in packages that have never seen the DOM and are tested without one. The
 * amount of this library that requires a browser is this file's two exports, and keeping
 * that number small *is* the architecture rather than a side effect of it.
 *
 * ⚠ **Import `./auto-chart.css` explicitly.** It is a side-effect import and deliberately not
 * pulled in from here: a bare `import '@gx/react'` must not drag a stylesheet along, and a
 * consumer with their own build pipeline needs to order the cascade layers themselves. The
 * file's two rules sit in `@layer gx.theme`, so anything unlayered in a consumer's own CSS
 * beats them with no `!important`.
 *
 * ```ts
 * import { AutoChart } from '@gx/react'
 * import '@gx/tokens/theme.css'
 * import '@gx/primitives/chart.css'
 * import '@gx/react/auto-chart.css'
 * ```
 *
 * ⚠ Every type named in a public signature is re-exported here, because gate **G6** walks
 * this file and fails on a prop whose type a consumer cannot name. `Size` is the clearest
 * case: it is the type of `AutoChartProps['initialSize']`, it is declared in
 * `useElementSize.ts`, and without the line below a consumer writing a typed wrapper around
 * `<AutoChart>` would have to spell it as an indexed access into someone else's props.
 */

export type { AutoChartProps, ChartGridSize } from './AutoChart.tsx'
export { AutoChart } from './AutoChart.tsx'
export type { LegendControlProps } from './LegendControl.tsx'
export { LegendControl } from './LegendControl.tsx'

export type {
  CreateObserver,
  ElementObserver,
  ObservedEntry,
  Size,
  UseElementSizeOptions,
} from './useElementSize.ts'
export { useElementSize } from './useElementSize.ts'
