import {
  GRID_COLUMNS,
  createLayoutSnapshot,
  createWidgetLayout,
  validateWidgetLayouts,
} from '@gx/core'
import type { LayoutSnapshot, WidgetLayout, WidgetLayoutInput } from '@gx/core'
import {
  cloneLayout,
  correctBounds,
  getCompactor,
  validateLayout as validateRglLayout,
} from 'react-grid-layout/core'
import type { Layout as RglLayout, LayoutItem as RglLayoutItem } from 'react-grid-layout/core'

/** The exact RGL release whose core API this adapter was verified against. */
export const RGL_VERSION = '2.2.4'

/** Options for the pure layout normalisation boundary. */
export type GridLayoutOptions = {
  /** Keep legal gaps when false; vertical compaction is the default product policy. */
  readonly compact?: boolean
}

/**
 * Convert the project-owned layout value into RGL's private working representation.
 *
 * This function is intentionally not exported: RGL types and property names must not become
 * part of the `@gx/grid` API. Every item is newly allocated before RGL receives it.
 */
function toRglLayout(items: readonly WidgetLayout[]): RglLayoutItem[] {
  return items.map((item) => ({
    i: item.id,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: item.minW,
    minH: item.minH,
    ...(item.maxW === null ? {} : { maxW: item.maxW }),
    ...(item.maxH === null ? {} : { maxH: item.maxH }),
    isDraggable: item.draggable,
    isResizable: item.resizable,
  }))
}

/** Convert RGL's private result back into the immutable project-owned contract. */
function fromRglLayout(layout: RglLayout): readonly WidgetLayout[] {
  return validateWidgetLayouts(
    layout.map((item): WidgetLayoutInput => ({
      id: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      ...(item.minW === undefined ? {} : { minW: item.minW }),
      ...(item.minH === undefined ? {} : { minH: item.minH }),
      ...(item.maxW === undefined ? {} : { maxW: item.maxW }),
      ...(item.maxH === undefined ? {} : { maxH: item.maxH }),
      draggable: item.isDraggable ?? true,
      resizable: item.isResizable ?? true,
    })),
  )
}

/**
 * Validate and normalise a layout through the pinned RGL core algorithms.
 *
 * The caller's values are canonicalised by `@gx/core` first, then copied again for RGL because
 * `correctBounds()` documents in-place mutation. The return value is a fresh, frozen array of
 * project-owned values and is deterministic for identical input.
 */
export function normalizeGridLayout(
  inputs: readonly WidgetLayoutInput[],
  options: GridLayoutOptions = {},
): readonly WidgetLayout[] {
  const items = validateWidgetLayouts(inputs)
  const working = cloneLayout(toRglLayout(items))

  validateRglLayout(working, '@gx/grid layout')
  correctBounds(working, { cols: GRID_COLUMNS })

  const normalized = options.compact === false
    ? working
    : getCompactor('vertical').compact(working, GRID_COLUMNS)

  validateRglLayout(normalized, '@gx/grid normalized layout')
  return fromRglLayout(normalized)
}

/** Normalise a persisted snapshot while retaining its versioned project-owned shape. */
export function normalizeLayoutSnapshot(
  snapshot: LayoutSnapshot,
  options: GridLayoutOptions = {},
): LayoutSnapshot {
  return createLayoutSnapshot(normalizeGridLayout(snapshot.items, options))
}
