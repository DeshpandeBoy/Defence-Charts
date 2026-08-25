/**
 * Progress family mark renderer.
 *
 * The core frame owns target validation, clamping, and the geometry strings/rectangles. This
 * module only paints that seam. It deliberately does not infer a ratio from `current` and
 * `target`: missing or malformed target data must remain visibly indeterminate rather than
 * becoming a plausible-looking completion mark.
 */

import { formatYLabel, type ProgressFrame } from '@gx/core'

import type { MarkRenderer, MarkRendererRegistration } from '../../renderer-seam.ts'
import { classes, roundCoord, translate } from '../../svg.ts'

type ProgressState =
  | 'partial'
  | 'complete'
  | 'over-target'
  | 'indeterminate'
  | 'missing-current'
  | 'missing-target'

const renderNone: MarkRenderer = () => null

/**
 * Paint target-aware horizontal or radial progress geometry from the shared frame.
 *
 * A normal radial ring also carries its current value in the ring. Micro intentionally has no
 * value band, so a ring without `74%` would communicate shape but not the metric it encodes.
 * Exceptional states retain their visible textual explanation even when a theme removes all
 * colour.
 */
export const renderProgress: MarkRenderer = ({ frame, plan }) => {
  const mark = plan.marks.primary
  if (mark.kind !== 'progress') {
    throw new Error(`@gx/primitives: progress renderer requires a progress mark; received '${mark.kind}'.`)
  }

  const progress = frame.progress
  if (progress === null) {
    throw new Error('@gx/primitives: progress rendering requires shared SeriesFrame.progress geometry.')
  }
  if (progress.orientation !== mark.orientation) {
    throw new Error(
      `@gx/primitives: progress orientation '${progress.orientation}' does not match mark '${mark.orientation}'.`,
    )
  }

  validateProgress(progress)
  const state = progressState(progress)
  const stateLabel = progressStateLabel(state)
  const valueLabel = progressValueLabel(frame, progress)
  const attributes = progressAttributes(frame.id, progress, state)

  return (
    <g
      className={classes('gx-progress', `gx-progress--${progress.orientation}`, `gx-progress--${state}`)}
      {...attributes}
    >
      {progress.orientation === 'horizontal' ? (
        <>
          <rect
            className="gx-progress__track"
            data-progress-part="track"
            x={roundCoord(progress.track!.x)}
            y={roundCoord(progress.track!.y)}
            width={roundCoord(progress.track!.width)}
            height={roundCoord(progress.track!.height)}
          />
          {progress.fill === null ? null : (
            <rect
              className="gx-progress__fill"
              data-progress-part="fill"
              x={roundCoord(progress.fill.x)}
              y={roundCoord(progress.fill.y)}
              width={roundCoord(progress.fill.width)}
              height={roundCoord(progress.fill.height)}
            />
          )}
        </>
      ) : (
        <g transform={translate(progress.cx!, progress.cy!)}>
          <path
            className="gx-progress__track"
            data-progress-part="track"
            d={progress.trackPath!}
          />
          {progress.fillPath === null ? null : (
            <path
              className="gx-progress__fill"
              data-progress-part="fill"
              d={progress.fillPath}
            />
          )}
        </g>
      )}
      {valueLabel === null || stateLabel !== null ? null : (
        <text
          className="gx-progress__value"
          data-progress-part="value"
          data-progress-value={valueLabel}
          x={roundCoord(stateTextX(progress))}
          y={roundCoord(stateTextY(progress))}
        >
          {valueLabel}
        </text>
      )}
      {stateLabel === null ? null : (
        <text
          className="gx-progress__state"
          data-progress-part="state"
          x={roundCoord(stateTextX(progress))}
          y={roundCoord(stateTextY(progress))}
        >
          {stateLabel}
        </text>
      )}
    </g>
  )
}

function progressValueLabel(
  frame: { readonly unit: string | null },
  progress: ProgressFrame,
): string | null {
  if (progress.orientation !== 'radial' || progress.current === null) return null
  const unit = frame.unit?.trim() ?? ''
  return `${formatYLabel(progress.current)}${unit}`
}

function progressAttributes(
  seriesId: string,
  progress: ProgressFrame,
  state: ProgressState,
): Record<string, string> {
  return {
    'data-progress-series-id': seriesId,
    'data-progress-orientation': progress.orientation,
    'data-progress-state': state,
    'data-progress-current': dataValue(progress.current),
    'data-progress-target': dataValue(progress.target),
    'data-progress-ratio': dataValue(progress.ratio),
    'data-progress-remaining': dataValue(progress.remaining),
    'data-progress-over-target': dataValue(progress.overTarget),
    'data-progress-indeterminate': String(progress.indeterminate),
  }
}

function dataValue(value: number | null): string {
  return value === null ? 'missing' : String(value)
}

function progressState(progress: ProgressFrame): ProgressState {
  if (progress.current === null) return 'missing-current'
  if (progress.target === null || progress.target <= 0) return 'missing-target'
  if (progress.indeterminate || progress.ratio === null) return 'indeterminate'
  if (progress.overTarget !== null && progress.overTarget > 0) return 'over-target'
  return progress.ratio >= 1 ? 'complete' : 'partial'
}

function progressStateLabel(state: ProgressState): string | null {
  switch (state) {
    case 'indeterminate':
      return 'Indeterminate'
    case 'missing-current':
      return 'Current unavailable'
    case 'missing-target':
      return 'Target unavailable'
    case 'over-target':
      return 'Over target'
    case 'partial':
    case 'complete':
      return null
  }
}

function stateTextX(progress: ProgressFrame): number {
  if (progress.orientation === 'horizontal') {
    return progress.track!.x + progress.track!.width / 2
  }
  return progress.cx!
}

function stateTextY(progress: ProgressFrame): number {
  if (progress.orientation === 'horizontal') {
    return progress.track!.y + progress.track!.height / 2
  }
  return progress.cy!
}

function validateProgress(progress: ProgressFrame): void {
  for (const [name, value] of [
    ['current', progress.current],
    ['target', progress.target],
    ['ratio', progress.ratio],
    ['remaining', progress.remaining],
    ['overTarget', progress.overTarget],
  ] as const) {
    if (value !== null && !Number.isFinite(value)) {
      throw new Error(`@gx/primitives: progress ${name} must be finite or null.`)
    }
  }

  if (progress.ratio !== null && (progress.ratio < 0 || progress.ratio > 1)) {
    throw new Error('@gx/primitives: progress ratio must be clamped between 0 and 1.')
  }

  if (progress.orientation === 'horizontal') {
    if (progress.track === null) {
      throw new Error('@gx/primitives: horizontal progress requires shared track rectangle geometry.')
    }
    validateRect(progress.track, 'track')
    if (progress.fill !== null) validateRect(progress.fill, 'fill')
    if (progress.trackPath !== null || progress.fillPath !== null || progress.cx !== null || progress.cy !== null) {
      throw new Error('@gx/primitives: horizontal progress cannot carry radial path geometry.')
    }
    return
  }

  if (progress.trackPath === null || progress.cx === null || progress.cy === null) {
    throw new Error('@gx/primitives: radial progress requires shared track path and centre geometry.')
  }
  if (progress.trackPath.length === 0) {
    throw new Error('@gx/primitives: radial progress requires a non-empty track path.')
  }
  if (progress.fillPath !== null && progress.fillPath.length === 0) {
    throw new Error('@gx/primitives: radial progress fill path must be non-empty or null.')
  }
  if (
    progress.innerRadius === null ||
    progress.outerRadius === null ||
    !Number.isFinite(progress.innerRadius) ||
    !Number.isFinite(progress.outerRadius) ||
    progress.innerRadius < 0 ||
    progress.outerRadius <= 0 ||
    progress.innerRadius > progress.outerRadius
  ) {
    throw new Error('@gx/primitives: radial progress requires valid inner and outer radii.')
  }
  if (progress.track !== null || progress.fill !== null) {
    throw new Error('@gx/primitives: radial progress cannot carry horizontal rectangle geometry.')
  }
}

function validateRect(rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }, name: string): void {
  if (
    !Number.isFinite(rect.x) ||
    !Number.isFinite(rect.y) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width < 0 ||
    rect.height < 0
  ) {
    throw new Error(`@gx/primitives: progress ${name} rectangle has invalid geometry.`)
  }
}

export const PROGRESS_MARK_RENDERERS: readonly MarkRendererRegistration[] = Object.freeze([
  Object.freeze({
    family: 'progress',
    markKinds: Object.freeze(['none'] as const),
    render: renderNone,
  }),
  Object.freeze({
    family: 'progress',
    markKinds: Object.freeze(['progress'] as const),
    render: renderProgress,
  }),
])
