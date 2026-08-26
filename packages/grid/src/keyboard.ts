import type { WidgetLayout } from '@shiftcharts/core'

import { applyGridProposal } from './constraints.ts'
import type { GridLayoutProposal } from './constraints.ts'

export type KeyboardEditMode = 'move' | 'resize'

export type KeyboardControlAction =
  | { readonly kind: 'start'; readonly mode: KeyboardEditMode }
  | { readonly kind: 'step'; readonly key: KeyboardArrowKey }
  | { readonly kind: 'commit' }
  | { readonly kind: 'cancel' }

export type KeyboardArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'

export type KeyboardEditSession = {
  readonly mode: KeyboardEditMode
  readonly id: string
  readonly initial: readonly WidgetLayout[]
  readonly current: readonly WidgetLayout[]
}

const ARROW_KEYS: readonly KeyboardArrowKey[] = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
]

function isActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' ' || key === 'Spacebar'
}

function isArrowKey(key: string): key is KeyboardArrowKey {
  return ARROW_KEYS.includes(key as KeyboardArrowKey)
}

/** Translate a native key value into the stable keyboard editing contract. */
export function interpretKeyboardKey(
  key: string,
  activeMode: KeyboardEditMode | null,
  idleMode: KeyboardEditMode = 'move',
): KeyboardControlAction | null {
  if (activeMode === null) {
    return isActivationKey(key) ? { kind: 'start', mode: idleMode } : null
  }
  if (isActivationKey(key)) return { kind: 'commit' }
  if (key === 'Escape') return { kind: 'cancel' }
  if (isArrowKey(key)) return { kind: 'step', key }
  return null
}

/** Start a stable-ID keyboard session from the exact visible layout snapshot. */
export function beginKeyboardSession(
  mode: KeyboardEditMode,
  id: string,
  layout: readonly WidgetLayout[],
): KeyboardEditSession {
  if (!layout.some((item) => item.id === id)) {
    throw new Error(`keyboard.id: unknown widget id ${id}`)
  }
  return Object.freeze({ mode, id, initial: layout, current: layout })
}

function proposalForStep(
  item: WidgetLayout,
  mode: KeyboardEditMode,
  key: KeyboardArrowKey,
): GridLayoutProposal {
  if (mode === 'move') {
    if (key === 'ArrowLeft') return { id: item.id, x: item.x - 1 }
    if (key === 'ArrowRight') return { id: item.id, x: item.x + 1 }
    if (key === 'ArrowUp') return { id: item.id, y: item.y - 1 }
    return { id: item.id, y: item.y + 1 }
  }

  if (key === 'ArrowLeft') return { id: item.id, w: item.w - 1 }
  if (key === 'ArrowRight') return { id: item.id, w: item.w + 1 }
  if (key === 'ArrowUp') return { id: item.id, h: item.h - 1 }
  return { id: item.id, h: item.h + 1 }
}

/** Apply one grid-unit keyboard step through the same constraint path as pointer proposals. */
export function previewKeyboardStep(
  session: KeyboardEditSession,
  key: KeyboardArrowKey,
): KeyboardEditSession {
  const item = session.current.find((candidate) => candidate.id === session.id)
  if (item === undefined) throw new Error(`keyboard.id: unknown widget id ${session.id}`)
  const current = applyGridProposal(session.current, proposalForStep(item, session.mode, key))
  return Object.freeze({ ...session, current })
}

/** Return the latest controlled layout for one committed keyboard session. */
export function commitKeyboardSession(session: KeyboardEditSession): readonly WidgetLayout[] {
  return session.current
}

/** Return the exact layout reference captured when the keyboard session began. */
export function cancelKeyboardSession(session: KeyboardEditSession): readonly WidgetLayout[] {
  return session.initial
}

/** Human-readable, one-based placement text used by labels and live announcements. */
export function describeKeyboardLayout(item: WidgetLayout): string {
  return `column ${item.x + 1}, row ${item.y + 1}; size ${item.w} by ${item.h}`
}

/** Keep constraint failures concise enough for a live region. */
export function describeKeyboardFailure(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    const message = error.message.split(': ').at(-1) ?? error.message
    return message.replace(/^must be /, '')
  }
  return 'the grid boundary was reached'
}
