'use client'

import { useId, type CSSProperties, type ReactNode, type ReactElement } from 'react'

export type WidgetShellProps = {
  readonly widgetId: string
  readonly title?: ReactNode
  readonly context?: ReactNode
  readonly actions?: ReactNode
  readonly children: ReactNode
  readonly footer?: ReactNode
  readonly theme?: string
  readonly dragHandleLabel?: string
  readonly className?: string
  readonly style?: CSSProperties
}

/**
 * Generic widget chrome for the grid. Every content slot is host-supplied; the shell has no
 * knowledge of charts, data, filters, or the responsive planner.
 */
export function WidgetShell({
  widgetId,
  title,
  context,
  actions,
  children,
  footer,
  theme,
  dragHandleLabel = 'Move widget',
  className,
  style,
}: WidgetShellProps): ReactElement {
  const generatedTitleId = useId()
  const titleId = `gx-widget-title-${generatedTitleId.replaceAll(':', '')}`
  const shellClassName = className === undefined ? 'gx-widget-shell' : `gx-widget-shell ${className}`

  return (
    <section
      className={shellClassName}
      data-gx-widget-id={widgetId}
      {...(theme === undefined ? {} : { 'data-gx-theme': theme })}
      {...(style === undefined ? {} : { style })}
      {...(title === undefined ? { 'aria-label': `Widget ${widgetId}` } : { 'aria-labelledby': titleId })}
    >
      <header className="gx-widget-shell__header">
        <div className="gx-widget-shell__heading" data-gx-grid-cancel="true">
          {title === undefined ? null : (
            <h2 className="gx-widget-shell__title" id={titleId}>
              {title}
            </h2>
          )}
          {context === undefined ? null : (
            <div className="gx-widget-shell__context" data-gx-grid-cancel="true">
              {context}
            </div>
          )}
        </div>
        {actions === undefined ? null : (
          <div className="gx-widget-shell__actions" data-gx-grid-cancel="true">
            {actions}
          </div>
        )}
        <button
          type="button"
          className="gx-widget-shell__drag-handle"
          data-gx-drag-handle="true"
          aria-label={dragHandleLabel}
          title={dragHandleLabel}
        >
          <span aria-hidden="true">⋮⋮</span>
        </button>
      </header>
      <div
        className="gx-widget-shell__content"
        data-gx-grid-cancel="true"
        data-gx-widget-content="true"
      >
        {children}
      </div>
      {footer === undefined ? null : (
        <footer className="gx-widget-shell__footer" data-gx-grid-cancel="true">
          {footer}
        </footer>
      )}
    </section>
  )
}
