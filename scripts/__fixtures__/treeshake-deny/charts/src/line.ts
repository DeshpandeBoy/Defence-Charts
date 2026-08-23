/**
 * The planted violation, in the shape it actually takes.
 *
 * `clampToZero` lives in the bar chart because that is where it was first needed. Reusing
 * it here is one import, reviews clean, and quietly makes the bar renderer a dependency of
 * the line renderer — so `import { lineChart }` ships both. Nothing breaks. Nothing is
 * slower. The size claim is simply no longer true.
 *
 * ⚠ Note the manifest still says `"sideEffects": false`, exactly as `@gx/core` does. This
 * leak is a genuine value dependency, so no manifest flag and no bundler setting removes
 * it. The first version of this fixture used a side-effecting registry module instead, and
 * it was measured to be the *wrong* red: with `"sideEffects": false` declared, rolldown
 * dropped the registry and the probe came back clean — `["line.ts"]`. Remove that one
 * manifest line and the same fixture returns `["bar.ts", "index.ts", "line.ts",
 * "register-all.ts"]`. A fixture whose failure depends on a manifest field that every
 * package in this repo already sets is a fixture that would have gone green on the real
 * tree.
 */
import { clampToZero } from './bar.ts'

export function lineChart(points: number): string {
  return `line:${clampToZero(points)}`
}
