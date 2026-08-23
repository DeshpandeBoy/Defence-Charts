/**
 * The deny fixture's one-line fix: the shared helper moved out of the bar chart.
 *
 * ⚠ Both charts still import this, and both bundles still contain it. That is the point of
 * the allow direction — shared infrastructure riding along is not the failure. A gate that
 * counted surviving *modules* would reject this file; the component universe is what lets
 * "one chart" mean one chart rather than one module.
 */
export function clampToZero(points: number): number {
  return points < 0 ? 0 : points
}
