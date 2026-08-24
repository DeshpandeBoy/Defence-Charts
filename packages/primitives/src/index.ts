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
 * ⚠ **Rule 2 governs what a *theme* controls, not what the *data* controls.** `d`, `cx`,
 * `cy`, `x`, `y`, `width` and `height` are all real CSS properties in SVG2, and they are
 * still emitted as attributes here, because a coordinate derived from a value is not
 * something a stylesheet may move. The distinction the rule draws is authority, not syntax.
 *
 * ## The one exception, and why it is not one
 *
 * `<Axis>` takes tick length, tick-label gap and rule width from the same resolved
 * `PlanPolicy` that `xAxisBand()` used to subtract from the plot. They are written as
 * attributes rather than presentation tokens: a CSS override would move the glyphs and
 * leave the layout band where it was. `<Chart>` passes that policy to Axis, Grid and Labels
 * so a custom policy cannot make the resolver and renderer disagree.
 *
 * Stroke width, point radius and the two mark opacities *are* tokens, because the resolver
 * never subtracted them — `packages/tokens/src/themes/theme.css` carries the dividing line.
 *
 * ## What a consumer needs
 *
 * ```tsx
 * import { Chart } from '@gx/primitives'
 * import '@gx/primitives/src/chart.css'
 * ```
 *
 * `chart.css` is a side effect (`package.json`'s `sideEffects`), so it survives
 * tree-shaking and is not pulled in by a component import. Importing `Chart` and not the
 * stylesheet renders a correct, unstyled, invisible chart — which is why it is said here.
 *
 * ⚠ **Current scope.** Mark kinds `'line'`, `'horizon'`, `'none'`, D1.1's `'bar'`, D3.2's
 * target-aware `'progress'`, D4.1's `'point'`, and D2.1's donut `'arc'` render. D3.1's KPI is
 * composed from these existing marks and the value/table primitives. `'cell'` throws, naming the later
 * milestone that adds it — the same
 * contract `planChart()` holds, and for the same reason: a silent fallback to a line would
 * render another family's data as a line chart.
 */

export type { AreaPathProps } from './AreaPath.tsx'
export { AreaPath } from './AreaPath.tsx'
export type { AxisProps } from './Axis.tsx'
export { Axis } from './Axis.tsx'
export type { ChartProps } from './Chart.tsx'
export { Chart } from './Chart.tsx'
export type { DataTableProps } from './DataTable.tsx'
export { DataTable } from './DataTable.tsx'
export type { GridProps } from './Grid.tsx'
export { Grid } from './Grid.tsx'
export type { HorizonBandsProps } from './HorizonBands.tsx'
export { HorizonBands } from './HorizonBands.tsx'
export type { LabelsProps } from './Labels.tsx'
export { Labels } from './Labels.tsx'
export type { LegendEntry, LegendProps } from './Legend.tsx'
export { Legend, legendEntries } from './Legend.tsx'
export type { LinePathProps } from './LinePath.tsx'
export { LinePath } from './LinePath.tsx'
export type { PointMarksProps } from './PointMarks.tsx'
export { PointMarks } from './PointMarks.tsx'
export type { ValueDisplayProps } from './ValueDisplay.tsx'
export { ValueDisplay } from './ValueDisplay.tsx'
