import { createWidgetId } from '@shiftcharts/core'
import type { LayoutSnapshot, WidgetId } from '@shiftcharts/core'

export type GridInteractionKind = 'drag' | 'resize'
export type GridInteractionPhase = 'start' | 'preview' | 'commit' | 'cancel'

export type GridInteractionState = {
  readonly kind: GridInteractionKind
  readonly id: WidgetId
  readonly initial: LayoutSnapshot
  readonly preview: LayoutSnapshot
}

export type GridInteractionEvent = {
  readonly kind: GridInteractionKind
  readonly phase: GridInteractionPhase
  readonly id: WidgetId
  readonly snapshot: LayoutSnapshot
}

export class GridInteractionError extends Error {
  readonly code: 'unknown-id'
  readonly path: string

  constructor(path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'GridInteractionError'
    this.code = 'unknown-id'
    this.path = path
  }
}

function assertContains(snapshot: LayoutSnapshot, id: WidgetId): void {
  if (!snapshot.items.some((item) => item.id === id)) {
    throw new GridInteractionError('interaction.id', `widget ${id} is not in the snapshot`)
  }
}

function event(
  state: GridInteractionState,
  phase: GridInteractionPhase,
  snapshot: LayoutSnapshot,
): GridInteractionEvent {
  return Object.freeze({
    kind: state.kind,
    phase,
    id: state.id,
    snapshot,
  })
}

/** Begin one drag/resize session from the immutable layout visible at pointer-down. */
export function beginGridInteraction(
  kind: GridInteractionKind,
  id: string | WidgetId,
  snapshot: LayoutSnapshot,
): GridInteractionState {
  const widgetId = createWidgetId(id)
  assertContains(snapshot, widgetId)
  return Object.freeze({ kind, id: widgetId, initial: snapshot, preview: snapshot })
}

/** Replace only the preview snapshot; the initial snapshot remains the cancellation target. */
export function previewGridInteraction(
  state: GridInteractionState,
  snapshot: LayoutSnapshot,
): GridInteractionState {
  assertContains(snapshot, state.id)
  return Object.freeze({ ...state, preview: snapshot })
}

/** Commit the latest preview as one serialisable event. */
export function commitGridInteraction(state: GridInteractionState): GridInteractionEvent {
  return event(state, 'commit', state.preview)
}

/** Cancel the session and return the exact initial snapshot for the host to restore. */
export function cancelGridInteraction(state: GridInteractionState): GridInteractionEvent {
  return event(state, 'cancel', state.initial)
}
