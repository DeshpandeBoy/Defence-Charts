/**
 * Three shared helpers, and the reason each one is a function rather than an inline
 * expression repeated at six call sites.
 *
 * ⚠ Not exported from `../index.ts`. Nothing here is part of the public contract; gate
 * **G6** would otherwise have to decide whether `translate` is API, and the honest answer
 * is that it is a spelling convenience.
 */

/**
 * ⚠ **`translate(0, 0)` is emitted rather than omitted, and that is deliberate.** A
 * conditional `transform` attribute makes the element set depend on the data — a chart
 * whose plot happens to start at the origin renders a structurally different tree from one
 * that does not, and gate G14's element snapshots would then encode an accident. One shape,
 * always.
 *
 * Rounded to two decimals for the same reason `frame.ts` pins `PATH_DIGITS = 2`: the
 * attribute is compared character-by-character by the determinism test, and a float that
 * differs in the fifteenth place is a flake wearing the costume of a regression.
 */
export function translate(x: number, y: number): string {
  return `translate(${round(x)}, ${round(y)})`
}

/**
 * ⚠ Non-finite coordinates become `0`, not `NaN`.
 *
 * A transient `0 × 0` measurement is routine — it is what a `ResizeObserver` reports on the
 * frame before layout settles — and a degenerate box produces a degenerate domain, which
 * produces `NaN` here. `transform="translate(NaN, NaN)"` makes the *whole subtree* vanish
 * with no console warning in any browser. Clamping to the origin degrades to a chart drawn
 * in the corner of a zero-sized box, which is invisible for an honest reason and recovers
 * on the next frame.
 */
function round(v: number): number {
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0
}

export { round as roundCoord }

/** `class` composition, `undefined`-tolerant. */
export function classes(...parts: readonly (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}
