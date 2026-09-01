'use client'

/**
 * `@shiftcharts/grid` — the 12-column dashboard shell.
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

export { GRID_COLUMNS } from '@shiftcharts/core'
export type { LayoutSnapshot, WidgetLayout, WidgetLayoutInput } from '@shiftcharts/core'
export {
  normalizeGridLayout,
  normalizeLayoutSnapshot,
  reconcileGridLayoutSnapshot,
  RGL_VERSION,
} from './adapter.ts'
export type { GridLayoutOptions } from './adapter.ts'
export type { GridLayoutProposal, GridProposalErrorCode } from './constraints.ts'
export { GridProposalError, applyGridProposal } from './constraints.ts'
export type {
  GridInteractionEvent,
  GridInteractionKind,
  GridInteractionPhase,
  GridInteractionState,
} from './interaction.ts'
export {
  GridInteractionError,
  beginGridInteraction,
  cancelGridInteraction,
  commitGridInteraction,
  previewGridInteraction,
} from './interaction.ts'
export type {
  KeyboardArrowKey,
  KeyboardControlAction,
  KeyboardEditMode,
  KeyboardEditSession,
} from './keyboard.ts'
export {
  beginKeyboardSession,
  cancelKeyboardSession,
  commitKeyboardSession,
  describeKeyboardFailure,
  describeKeyboardLayout,
  interpretKeyboardKey,
  previewKeyboardStep,
} from './keyboard.ts'
export type { KeyboardGridHostMode, KeyboardGridInteractionHandler, KeyboardGridProps } from './KeyboardGrid.tsx'
export { KeyboardGrid } from './KeyboardGrid.tsx'
export type {
  WidgetGridInteraction,
  WidgetGridInteractionHandler,
  WidgetGridMode,
  WidgetGridProps,
  WidgetGridRenderContext,
} from './WidgetGrid.tsx'
export { WidgetGrid } from './WidgetGrid.tsx'
export type { WidgetShellProps } from './WidgetShell.tsx'
export { WidgetShell } from './WidgetShell.tsx'
export type { WidgetStateKind, WidgetStatesProps } from './WidgetStates.tsx'
export { WidgetStates } from './WidgetStates.tsx'
