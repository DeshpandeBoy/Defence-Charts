/**
 * The allow fixture's world — identical to the deny fixture's table, deliberately.
 *
 * The two fixtures differ in exactly one thing: where `clampToZero` lives. Here it is in
 * `src/shared.ts`, which both charts import and which is not a component. If this table
 * differed too, a green run would not tell anyone which variable caused it.
 *
 * ⚠ `shared.ts` surviving in both bundles is correct and is not asserted. A gate that
 * counted surviving *modules* would reject this fixture; the component universe is what
 * makes "shared infrastructure rides along" and "a chart rode along" different answers.
 */

/** @type {readonly import('../../check-treeshake.mjs').ComponentRule[]} */
export const COMPONENTS = [
  { component: 'line', module: 'line.ts' },
  { component: 'bar', module: 'bar.ts' },
]

/** @type {Record<string, Record<string, readonly string[]>>} */
export const EXPECTED = {
  '@fixture/allow-treeshake': {
    lineChart: ['line'],
    barChart: ['bar'],
  },
}
