'use client'

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react'
import type { WidgetLayout } from '@shiftcharts/core'

import {
  beginKeyboardSession,
  cancelKeyboardSession,
  commitKeyboardSession,
  describeKeyboardFailure,
  describeKeyboardLayout,
  interpretKeyboardKey,
  previewKeyboardStep,
} from './keyboard.ts'
import type { KeyboardEditMode, KeyboardEditSession } from './keyboard.ts'

export type KeyboardGridHostMode = 'edit' | 'read-only'

export type KeyboardGridProps = {
  readonly item: WidgetLayout
  readonly layout: readonly WidgetLayout[]
  readonly mode: KeyboardGridHostMode
  readonly children: ReactNode
  readonly onLayoutStart?: (layout: readonly WidgetLayout[]) => void
  readonly onLayoutPreview?: (layout: readonly WidgetLayout[]) => void
  readonly onLayoutCommit?: (layout: readonly WidgetLayout[]) => void
  readonly onLayoutCancel?: (layout: readonly WidgetLayout[]) => void
}

function modeLabel(mode: KeyboardEditMode): string {
  return mode === 'move' ? 'Move' : 'Resize'
}

function stepAnnouncement(mode: KeyboardEditMode, item: WidgetLayout): string {
  return `${modeLabel(mode)}d; ${describeKeyboardLayout(item)}.`
}

function startAnnouncement(mode: KeyboardEditMode): string {
  return `${modeLabel(mode)} mode. Use arrow keys one grid unit at a time; Enter or Space commits; Escape cancels.`
}

/**
 * Generic keyboard editing affordances for one controlled widget.
 *
 * The wrapper owns no persisted layout. It captures a session snapshot, asks the host to render
 * previews, and returns either the latest proposal or the exact starting layout on completion.
 */
export function KeyboardGrid({
  item,
  layout,
  mode,
  children,
  onLayoutStart,
  onLayoutPreview,
  onLayoutCommit,
  onLayoutCancel,
}: KeyboardGridProps): ReactElement {
  const moveRef = useRef<HTMLButtonElement>(null)
  const resizeRef = useRef<HTMLButtonElement>(null)
  const initiatingControlRef = useRef<HTMLButtonElement | null>(null)
  const restoreFocusRef = useRef(false)
  const instructionId = useId().replaceAll(':', '')
  const liveId = `shiftcharts-keyboard-live-${instructionId}`
  const [session, setSession] = useState<KeyboardEditSession | null>(null)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (!restoreFocusRef.current) return
    restoreFocusRef.current = false
    initiatingControlRef.current?.focus({ preventScroll: true })
  }, [session])

  const currentItem = session?.current.find((candidate) => candidate.id === item.id) ?? item

  function begin(modeToStart: KeyboardEditMode, control: HTMLButtonElement | null): void {
    if (session !== null) return
    const next = beginKeyboardSession(modeToStart, item.id, layout)
    initiatingControlRef.current = control
    setSession(next)
    setAnnouncement(startAnnouncement(modeToStart))
    onLayoutStart?.(layout)
  }

  function finish(kind: 'commit' | 'cancel'): void {
    if (session === null) return
    const nextLayout = kind === 'commit'
      ? commitKeyboardSession(session)
      : cancelKeyboardSession(session)
    const nextItem = nextLayout.find((candidate) => candidate.id === item.id) ?? item
    restoreFocusRef.current = true
    setSession(null)
    setAnnouncement(
      kind === 'commit'
        ? `${modeLabel(session.mode)} committed; ${describeKeyboardLayout(nextItem)}.`
        : `${modeLabel(session.mode)} cancelled; restored ${describeKeyboardLayout(nextItem)}.`,
    )
    if (kind === 'commit') onLayoutCommit?.(nextLayout)
    else onLayoutCancel?.(nextLayout)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, controlMode: KeyboardEditMode): void {
    const action = interpretKeyboardKey(event.key, session?.mode ?? null, controlMode)
    if (action === null) return
    event.preventDefault()
    event.stopPropagation()

    if (action.kind === 'start') {
      begin(action.mode, event.currentTarget)
      return
    }
    if (action.kind === 'commit' || action.kind === 'cancel') {
      finish(action.kind)
      return
    }
    if (session === null) return

    try {
      const next = previewKeyboardStep(session, action.key)
      const nextItem = next.current.find((candidate) => candidate.id === item.id) ?? item
      setSession(next)
      setAnnouncement(stepAnnouncement(session.mode, nextItem))
      onLayoutPreview?.(next.current)
    } catch (error) {
      setAnnouncement(`Cannot ${modeLabel(session.mode).toLowerCase()}; ${describeKeyboardFailure(error)}.`)
    }
  }

  function handleClick(controlMode: KeyboardEditMode, control: HTMLButtonElement): void {
    begin(controlMode, control)
  }

  function controlLabel(controlMode: KeyboardEditMode): string {
    return `${modeLabel(controlMode)} widget ${item.id}; ${describeKeyboardLayout(currentItem)}`
  }

  function renderControl(controlMode: KeyboardEditMode, controlRef: RefObject<HTMLButtonElement | null>): ReactElement {
    const active = session?.mode === controlMode
    return (
      <button
        ref={controlRef}
        type="button"
        className="shiftcharts-keyboard-grid__control"
        data-shiftcharts-keyboard-control={controlMode}
        data-shiftcharts-grid-cancel="true"
        aria-label={controlLabel(controlMode)}
        aria-describedby={instructionId}
        aria-keyshortcuts="Enter Space ArrowUp ArrowDown ArrowLeft ArrowRight Escape"
        aria-pressed={active}
        title={controlLabel(controlMode)}
        onClick={(event) => handleClick(controlMode, event.currentTarget)}
        onKeyDown={(event) => handleKeyDown(event, controlMode)}
      >
        {modeLabel(controlMode)}
      </button>
    )
  }

  return (
    <div
      className="shiftcharts-keyboard-grid"
      data-shiftcharts-keyboard-widget-id={item.id}
      data-shiftcharts-keyboard-mode={mode}
      data-shiftcharts-keyboard-active={session === null ? undefined : session.mode}
    >
      {mode === 'edit' ? (
        <>
          <div className="shiftcharts-keyboard-grid__controls" aria-label={`Edit controls for widget ${item.id}`}>
            {renderControl('move', moveRef)}
            {renderControl('resize', resizeRef)}
          </div>
          <span id={instructionId} className="shiftcharts-keyboard-grid__instructions">
            Enter or Space starts {item.id} {session?.mode === 'resize' ? 'resizing' : 'moving'}. Arrow keys change one grid unit. Enter or Space commits. Escape cancels.
          </span>
        </>
      ) : null}
      <div className="shiftcharts-keyboard-grid__content">{children}</div>
      {mode === 'edit' ? (
        <span id={liveId} className="shiftcharts-keyboard-grid__live" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </span>
      ) : null}
    </div>
  )
}
