'use client'

/**
 * `@gx/grid` — the 12-column dashboard shell.
 *
 * ⚠ The grid reports box size to a widget and **never** decides what the widget shows.
 * That direction is the whole architecture: the moment the grid knows about chart
 * content, the ladder stops being a property of the chart and becomes a property of the
 * dashboard, and a chart outside a grid loses it.
 *
 * ⚠ Wraps `react-grid-layout@2`'s `./core` subpath, not its default export.
 * `react-grid-layout@2.2.4` ships no `"use client"` directive of its own, so this
 * package must supply one — hence the directive above.
 *
 * ⚠ A1 scope: the boundary only. Per-widget minimum sizes — a deliberate addition
 * Basedash lacks — land with the shell itself.
 */

export const GRID_COLUMNS = 12
