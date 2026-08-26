import type { NextConfig } from 'next'

/**
 * ⚠ **`transpilePackages` is not a convenience here; without it there is no fixture.**
 *
 * Every `@shiftcharts/*` package points its `"."` export at `./src/index.ts` — TypeScript source, on
 * purpose, so that a workspace consumer type-checks against the real thing rather than
 * against a `dist/` that may be stale. Next's default posture is to leave `node_modules`
 * alone, and a symlinked workspace package *is* `node_modules` as far as the bundler's
 * resolver is concerned. Naming the three packages here is what puts them back through the
 * compiler.
 *
 * ⚠ The list is exhaustive rather than a prefix match, because `transpilePackages` takes no
 * globs. `@shiftcharts/react` is deliberately absent: it carries `"use client"`, and a server
 * component that pulled it in would be the exact degradation gate **G4** exists to catch. If
 * a fourth `@shiftcharts/*` package is ever needed by this app, adding it here should be a moment of
 * thought about which side of the boundary it sits on, not a mechanical edit.
 */
const nextConfig: NextConfig = {
  transpilePackages: ['@shiftcharts/core', '@shiftcharts/primitives', '@shiftcharts/tokens'],
}

export default nextConfig
