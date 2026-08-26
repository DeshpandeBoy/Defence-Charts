import {
  GRID_COLUMNS,
  createWidgetLayout,
  validateWidgetLayouts,
} from '@shiftcharts/core'
import type { WidgetLayout, WidgetLayoutInput } from '@shiftcharts/core'
import {
  correctBounds,
  getAllCollisions,
  getCompactor,
  moveElement,
  validateLayout as validateRglLayout,
} from 'react-grid-layout/core'
import type { Layout as RglLayout, LayoutItem as RglLayoutItem } from 'react-grid-layout/core'

/** A serialisable drag/resize proposal addressed by stable widget ID. */
export type GridLayoutProposal = {
  readonly id: string
  readonly x?: number
  readonly y?: number
  readonly w?: number
  readonly h?: number
}

export type GridProposalErrorCode =
  | 'invalid-proposal'
  | 'unknown-id'
  | 'not-draggable'
  | 'not-resizable'
  | 'constraint-violation'
  | 'collision'

/** Explicit failure for an impossible or unsafe user proposal. */
export class GridProposalError extends Error {
  readonly code: GridProposalErrorCode
  readonly path: string

  constructor(code: GridProposalErrorCode, path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'GridProposalError'
    this.code = code
    this.path = path
  }
}

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

function integerProposal(value: number | undefined, path: string, minimum: number): number | undefined {
  if (value === undefined) return undefined
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new GridProposalError('invalid-proposal', path, `must be a safe integer >= ${String(minimum)}`)
  }
  return value
}

function rejectCollisions(layout: RglLayout): void {
  for (const item of layout) {
    const collisions = getAllCollisions(layout, item).filter((other) => other.i !== item.i)
    if (collisions.length > 0) {
      throw new GridProposalError(
        'collision',
        item.i,
        `RGL returned an overlapping layout with ${collisions.map((other) => other.i).join(', ')}`,
      )
    }
  }
}

/**
 * Apply one stable-ID move or resize proposal through the pinned RGL core algorithms.
 *
 * Validation happens before any working item is handed to RGL. RGL is allowed to mutate only
 * fresh copies, and its returned layout is compacted and converted back into frozen core values.
 */
export function applyGridProposal(
  inputs: readonly WidgetLayoutInput[],
  proposal: GridLayoutProposal,
): readonly WidgetLayout[] {
  const items = validateWidgetLayouts(inputs)
  const base = items.find((item) => item.id === proposal.id)
  if (base === undefined) {
    throw new GridProposalError('unknown-id', 'proposal.id', `unknown widget id ${proposal.id}`)
  }

  const x = integerProposal(proposal.x, `${base.id}.x`, 0)
  const y = integerProposal(proposal.y, `${base.id}.y`, 0)
  const w = integerProposal(proposal.w, `${base.id}.w`, 1)
  const h = integerProposal(proposal.h, `${base.id}.h`, 1)
  const moving = x !== undefined || y !== undefined
  const resizing = w !== undefined || h !== undefined

  if (!moving && !resizing) {
    throw new GridProposalError('invalid-proposal', 'proposal', 'must change x/y or w/h')
  }
  if (moving && !base.draggable) {
    throw new GridProposalError('not-draggable', base.id, 'widget is not draggable')
  }
  if (resizing && !base.resizable) {
    throw new GridProposalError('not-resizable', base.id, 'widget is not resizable')
  }

  let candidate: WidgetLayout
  try {
    candidate = createWidgetLayout({
      ...base,
      ...(x === undefined ? {} : { x }),
      ...(y === undefined ? {} : { y }),
      ...(w === undefined ? {} : { w }),
      ...(h === undefined ? {} : { h }),
    })
  } catch (error) {
    throw new GridProposalError(
      'constraint-violation',
      base.id,
      error instanceof Error ? error.message : 'proposal violates widget constraints',
    )
  }

  const working = toRglLayout(items)
  const target = working.find((item) => item.i === candidate.id)
  if (target === undefined) {
    throw new GridProposalError('unknown-id', 'proposal.id', `unknown widget id ${candidate.id}`)
  }

  target.w = candidate.w
  target.h = candidate.h

  let resolved: RglLayout = working
  if (moving) {
    resolved = moveElement(
      resolved,
      target,
      candidate.x,
      candidate.y,
      true,
      false,
      'vertical',
      GRID_COLUMNS,
    )
  } else {
    // RGL's moveElement intentionally returns early when x/y are unchanged. For a resize, push
    // each collision to the first free row below the resized target, then let the compactor
    // cascade any secondary collisions through the same engine.
    const collisions = getAllCollisions(resolved, target)
    for (const collision of collisions) {
      resolved = moveElement(
        resolved,
        collision,
        undefined,
        target.y + target.h,
        true,
        false,
        'vertical',
        GRID_COLUMNS,
      )
    }
  }

  correctBounds(resolved as RglLayoutItem[], { cols: GRID_COLUMNS })
  resolved = getCompactor('vertical').compact(resolved, GRID_COLUMNS)
  validateRglLayout(resolved, '@shiftcharts/grid proposal result')
  rejectCollisions(resolved)
  return fromRglLayout(resolved)
}
