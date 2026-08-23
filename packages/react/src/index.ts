'use client'

/**
 * `@gx/react` — the client boundary, declared once, here.
 *
 * ⚠ The `"use client"` directive above is load-bearing and fragile in a specific way:
 * `unbundle: true` is the **only** tsdown/Rolldown configuration in which it survives a
 * build on a non-entry file (`research/30-implementation-plan.md` A1). CI greps the
 * built output for it. If that grep ever fails, the render boundary — decision 7 — has
 * silently collapsed, and every consumer's RSC page has started shipping this package's
 * JavaScript.
 *
 * ⚠ A1 scope: the boundary only. `<AutoChart>` and `useElementSize` land at **A5**,
 * where the `ResizeObserver` containment test (gate **G11**) lands with them.
 */

export const REACT_IS_THE_CLIENT_BOUNDARY = true
