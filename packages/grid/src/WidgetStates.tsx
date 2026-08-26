'use client'

import { type ReactElement, type ReactNode } from 'react'

/** Host-selected presentation states for a widget. */
export type WidgetStateKind = 'loading' | 'empty' | 'error' | 'stale'

export type WidgetStatesProps = {
  /** The already-decided state; data fetching and retry remain outside this component. */
  readonly state: WidgetStateKind
  /** Host-owned widget content. Pass the previous result here for a stale state when appropriate. */
  readonly children?: ReactNode
  /** Optional host-owned replacement for the default state message. */
  readonly message?: ReactNode
  /** Optional explanatory content rendered in the stable message slot. */
  readonly description?: ReactNode
  /** Optional host-owned affordance, such as a button or link. */
  readonly action?: ReactNode
  readonly className?: string
}

const DEFAULT_MESSAGES: Readonly<Record<WidgetStateKind, string>> = {
  loading: 'Loading data',
  empty: 'No data available',
  error: 'Unable to show this data',
  stale: 'Showing previously loaded data',
}

function stateRole(state: WidgetStateKind): 'status' | 'alert' {
  return state === 'error' ? 'alert' : 'status'
}

function stateLiveMode(state: WidgetStateKind): 'polite' | 'assertive' {
  return state === 'error' ? 'assertive' : 'polite'
}

/**
 * A stable, host-controlled state surface for a widget.
 *
 * The content and action slots are always owned by the caller. This component only supplies
 * predictable structure and accessible state messaging; it never fetches, retries, or changes
 * layout state.
 */
export function WidgetStates({
  state,
  children,
  message,
  description,
  action,
  className,
}: WidgetStatesProps): ReactElement {
  const rootClassName = className === undefined ? 'shiftcharts-widget-states' : `shiftcharts-widget-states ${className}`
  const resolvedMessage = message === undefined ? DEFAULT_MESSAGES[state] : message

  return (
    <div
      className={rootClassName}
      data-shiftcharts-widget-state={state}
      aria-busy={state === 'loading' ? 'true' : undefined}
    >
      <div className="shiftcharts-widget-states__content" data-shiftcharts-widget-state-slot="content">
        {children}
      </div>
      <div
        className="shiftcharts-widget-states__status"
        data-shiftcharts-widget-state-slot="status"
        role={stateRole(state)}
        aria-live={stateLiveMode(state)}
        aria-atomic="true"
      >
        <div className="shiftcharts-widget-states__message" data-shiftcharts-widget-state-slot="message">
          <p className="shiftcharts-widget-states__label" data-shiftcharts-widget-state-slot="label">
            {resolvedMessage}
          </p>
          <div className="shiftcharts-widget-states__description" data-shiftcharts-widget-state-slot="description">
            {description}
          </div>
        </div>
        <div className="shiftcharts-widget-states__action" data-shiftcharts-widget-state-slot="action">
          {action}
        </div>
      </div>
    </div>
  )
}
