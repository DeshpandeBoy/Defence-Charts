/**
 * `@gx/primitives` — hook-free SVG. RSC-safe: this package ships **no** `"use client"`
 * directive, and a CI grep of the build output asserts that.
 *
 * ⚠ Three rules bind here, all from `research/20-architecture.md` §2:
 *
 *   1. **No state, effects, or refs.** Allowed hooks are `useMemo`, `useCallback` and
 *      `useId` only — verified present in React 19's `react-server` build. No
 *      `react-dom` import.
 *   2. **No visual presentation attributes.** Everything visual comes from a class.
 *      `<line stroke="#ddd" />` is CSS-shaped but is not CSS, so a stylesheet-parsing
 *      gate never sees it — taking every visual property from a class closes that hole
 *      rather than documenting it, and it is the same discipline that makes per-widget
 *      CSS theming work at all. Decided at A1.
 *   3. **No `<line>` for geometry a token controls.** `x1`/`y1`/`x2`/`y2` are not
 *      CSS-settable in *any* browser and none is planned, so `line { y2: var(--gx-tick-length) }`
 *      parses, passes the token gate, builds, warns about nothing, and does nothing.
 *      Use `<rect>` for ticks and gridlines, `<path>` where a path already exists. A
 *      `<line>` stays legal for anything no token controls. Gate **G14**, at A4 —
 *      `research/decisions/012-no-line-element-for-tokened-geometry.md`.
 *
 * ⚠ A1 scope: the package boundary only. `<Chart plan={...}>` lands at **A4**.
 */

export const PRIMITIVES_ARE_RSC_SAFE = true
