/**
 * The deny fixture's world, in the same shape as the real one in `check-treeshake.mjs`.
 *
 * Two charts, two components, and the claim stated plainly: importing `lineChart` ships the
 * line chart and nothing else. `src/line.ts` imports `clampToZero` from `src/bar.ts`, so the
 * claim is false and the gate says which module rode along.
 *
 * ⚠ This is a value dependency, not a side effect, and that is the whole point of the
 * fixture. See the sibling docblock in `charts/src/line.ts`.
 */

/** @type {readonly import('../../check-treeshake.mjs').ComponentRule[]} */
export const COMPONENTS = [
  { component: 'line', module: 'line.ts' },
  { component: 'bar', module: 'bar.ts' },
]

/** @type {Record<string, Record<string, readonly string[]>>} */
export const EXPECTED = {
  '@fixture/deny-treeshake': {
    lineChart: ['line'],
    barChart: ['bar'],
  },
}
