/**
 * Funnel family mark renderer.
 *
 * The coordinator-owned frame resolves canonical stage order, values, conversion/drop-off
 * semantics, and every rectangle. This module only validates and paints that serialisable seam;
 * it never reads the source series, sorts stages, computes ratios, measures the DOM, or falls
 * back to another mark family.
 */

import type { FunnelFrame, FunnelStageFrame, PlanPolicy, TypeRank } from '@gx/core'
import { measureText } from '@gx/core'

import type { MarkRenderer, MarkRendererRegistration } from '../../renderer-seam.ts'
import { classes, roundCoord } from '../../svg.ts'

/** Matches `--gx-legend-label-font-size` (`chart.css`), which `.gx-funnel-stage__text` uses. */
const STAGE_TEXT_RANK: TypeRank = 'D'

const renderNone: MarkRenderer = () => null

/** Paint the explicit funnel mark and the detail selected by the shared plan. */
export const renderFunnel: MarkRenderer = (input) => {
  const { frame, plan, policy } = input

  if (plan.type !== 'funnel') {
    throw new Error(`@gx/primitives: funnel renderer requires a funnel plan; received '${String(plan.type)}'.`)
  }

  const mark = plan.marks.primary
  if (mark.kind !== 'funnel') {
    throw new Error(`@gx/primitives: funnel renderer requires a funnel mark; received '${mark.kind}'.`)
  }

  if (plan.marks.renderer !== 'svg') {
    throw new Error(
      `@gx/primitives: funnel renderer mode '${String(plan.marks.renderer)}' is not implemented; refusing to rasterize stages.`,
    )
  }

  if (typeof frame !== 'object' || frame === null) {
    throw new Error('@gx/primitives: funnel rendering requires a shared series frame.')
  }
  if (typeof frame.id !== 'string' || frame.id.length === 0) {
    throw new Error('@gx/primitives: funnel rendering requires a stable non-empty series id.')
  }

  const funnel = frame.funnel
  if (funnel === null || funnel === undefined || typeof funnel !== 'object') {
    throw new Error('@gx/primitives: funnel rendering requires shared SeriesFrame.funnel geometry.')
  }
  if (!Array.isArray(funnel.stages)) {
    throw new Error('@gx/primitives: funnel rendering requires shared FunnelFrame.stages geometry.')
  }

  validateFunnel(funnel)

  // An empty/missing source is an intentional empty mark. The shared data table owns the
  // accessible empty state; this renderer must not invent a stage or a zero-sized rectangle.
  if (funnel.stages.length === 0) return null

  return (
    <g
      className={classes('gx-funnel', `gx-funnel--${mark.orientation}`, `gx-funnel--${mark.detail}`)}
      data-funnel-detail={mark.detail}
      data-funnel-orientation={mark.orientation}
      data-funnel-overall-conversion={ratioAttribute(funnel.overallConversion)}
      data-funnel-series-id={frame.id}
    >
      {renderDetail(funnel, mark.detail, mark.orientation, policy)}
    </g>
  )
}

function renderDetail(
  funnel: FunnelFrame,
  detail: 'summary' | 'stages' | 'dropoff' | 'breakdown',
  orientation: 'horizontal' | 'vertical',
  policy: PlanPolicy,
) {
  if (detail === 'summary') return renderSummary(funnel)
  return funnel.stages.map((stage) => renderStage(stage, detail, orientation, policy))
}

function renderSummary(funnel: FunnelFrame) {
  // FunnelFrame currently exposes stage geometry, not a second summary rectangle. Centering on
  // the first frame-provided rectangle keeps this renderer geometry-blind while ensuring the
  // compact summary is visible when the first stage starts at the plot's left edge.
  const anchor = funnel.stages[0]
  return (
    <text
      className={classes('gx-funnel__summary', 'gx-funnel-label')}
      data-funnel-overall-conversion={ratioAttribute(funnel.overallConversion)}
      data-funnel-part="summary"
      x={anchor === undefined ? undefined : roundCoord(anchor.x + anchor.width / 2)}
      y={anchor === undefined ? undefined : roundCoord(anchor.y + anchor.height / 2)}
    >
      {`Overall conversion: ${formatRatio(funnel.overallConversion)}`}
    </text>
  )
}

function renderStage(
  stage: FunnelStageFrame,
  detail: 'stages' | 'dropoff' | 'breakdown',
  orientation: 'horizontal' | 'vertical',
  policy: PlanPolicy,
) {
  const text = fitStageText(stage, detail, policy)
  return (
    <g
      className="gx-funnel-stage-container"
      data-funnel-stage-conversion={ratioAttribute(stage.conversion)}
      data-funnel-stage-dropoff={ratioAttribute(stage.dropoff)}
      data-funnel-stage-id={stage.id}
      data-funnel-stage-index={stage.index}
      data-funnel-stage-label={stage.label}
      data-funnel-stage-share={ratioAttribute(stage.share)}
      data-funnel-stage-value={String(stage.value)}
      data-stage-id={stage.id}
      key={stage.id}
    >
      <rect
        className={classes('gx-funnel-stage', 'gx-funnel-stage__mark')}
        data-funnel-part="stage"
        height={roundCoord(stage.height)}
        width={roundCoord(stage.width)}
        x={roundCoord(stage.x)}
        y={roundCoord(stage.y)}
      />
      <text
        className={classes('gx-funnel-label', 'gx-funnel-stage__text')}
        data-funnel-part="stage-text"
        data-funnel-stage-id={stage.id}
        x={roundCoord(orientation === 'horizontal' ? stage.x : stage.x + stage.width / 2)}
        y={roundCoord(stage.y + stage.height / 2)}
      >
        {text}
      </text>
    </g>
  )
}

/** Most to least verbose for the requested `detail` — the same wording `stageText` always
 * built, just kept as steps instead of committing to only the fullest one. */
function stageTextTiers(stage: FunnelStageFrame, detail: 'stages' | 'dropoff' | 'breakdown'): readonly string[] {
  const prefix = `${stage.label}: value ${formatValue(stage.value)}`
  if (detail === 'stages') return [prefix]
  const withDropoff = `${prefix}; drop-off ${formatRatio(stage.dropoff)}`
  if (detail === 'dropoff') return [withDropoff, prefix]
  const full = `${prefix}; share ${formatRatio(stage.share)}; conversion ${formatRatio(stage.conversion)}; drop-off ${formatRatio(stage.dropoff)}`
  return [full, withDropoff, prefix]
}

/**
 * VT-003 fallout: a real category `label` (rather than a one-character point index) can push
 * the fullest `detail` wording past `stage.labelWidth` — a budget this renderer has always had
 * available but never checked, because no fixture's label was ever long enough to expose it.
 * Degrade to a shorter, still-accurate tier instead of running text past its budget; the
 * shortest tier ("label: value") is never dropped, matching this project's existing rule of
 * keeping identity and the latest value visible over denser detail (VT-005/006).
 */
function fitStageText(stage: FunnelStageFrame, detail: 'stages' | 'dropoff' | 'breakdown', policy: PlanPolicy): string {
  const tiers = stageTextTiers(stage, detail)
  for (const candidate of tiers) {
    if (measureText(candidate, STAGE_TEXT_RANK, policy.typography.metrics) <= stage.labelWidth) return candidate
  }
  return tiers[tiers.length - 1] ?? ''
}

function validateFunnel(funnel: FunnelFrame): void {
  if (
    funnel.overallConversion !== null &&
    (!Number.isFinite(funnel.overallConversion) || funnel.overallConversion < 0 || funnel.overallConversion > 1)
  ) {
    throw new Error('@gx/primitives: funnel overall conversion must be between 0 and 1 or null.')
  }

  const ids = new Set<string>()
  for (const [index, stage] of funnel.stages.entries()) {
    if (typeof stage !== 'object' || stage === null) {
      throw new Error(`@gx/primitives: funnel stage ${index} has invalid shared geometry.`)
    }
    validateStage(stage, index, ids)
  }
}

function validateStage(stage: FunnelStageFrame, index: number, ids: Set<string>): void {
  if (typeof stage.id !== 'string' || stage.id.length === 0) {
    throw new Error(`@gx/primitives: funnel stage ${index} requires a stable non-empty id.`)
  }
  if (ids.has(stage.id)) {
    throw new Error(`@gx/primitives: funnel stage id '${stage.id}' is duplicated.`)
  }
  ids.add(stage.id)

  if (typeof stage.label !== 'string' || stage.label.length === 0) {
    throw new Error(`@gx/primitives: funnel stage '${stage.id}' requires a non-empty label.`)
  }
  if (!Number.isInteger(stage.index) || stage.index < 0) {
    throw new Error(`@gx/primitives: funnel stage '${stage.id}' requires a non-negative integer index.`)
  }
  for (const [name, value] of [
    ['value', stage.value],
    ['share', stage.share],
    ['conversion', stage.conversion],
    ['dropoff', stage.dropoff],
  ] as const) {
    if (value !== null && !Number.isFinite(value)) {
      throw new Error(`@gx/primitives: funnel stage '${stage.id}' ${name} must be finite or null.`)
    }
  }
  if (!Number.isFinite(stage.value) || stage.value < 0) {
    throw new Error(`@gx/primitives: funnel stage '${stage.id}' value must be finite and non-negative.`)
  }
  validateRatio(stage.share, `stage '${stage.id}' share`)
  validateRatio(stage.conversion, `stage '${stage.id}' conversion`)
  validateRatio(stage.dropoff, `stage '${stage.id}' drop-off`)

  for (const [name, value] of [
    ['x', stage.x],
    ['y', stage.y],
    ['width', stage.width],
    ['height', stage.height],
  ] as const) {
    if (!Number.isFinite(value)) {
      throw new Error(`@gx/primitives: funnel stage '${stage.id}' ${name} geometry must be finite.`)
    }
  }
  if (stage.width < 0 || stage.height < 0) {
    throw new Error(`@gx/primitives: funnel stage '${stage.id}' geometry cannot have negative size.`)
  }
}

function validateRatio(value: number | null, name: string): void {
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error(`@gx/primitives: funnel ${name} must be between 0 and 1 or null.`)
  }
}

function formatValue(value: number): string {
  return Number.isFinite(value) ? String(value) : 'unavailable'
}

function formatRatio(value: number | null): string {
  return value === null ? 'unavailable' : `${Math.round(value * 100)}%`
}

function ratioAttribute(value: number | null): string {
  return value === null ? 'missing' : String(value)
}

export const FUNNEL_MARK_RENDERERS: readonly MarkRendererRegistration[] = Object.freeze([
  Object.freeze({
    family: 'funnel',
    markKinds: Object.freeze(['none'] as const),
    render: renderNone,
  }),
  Object.freeze({
    family: 'funnel',
    markKinds: Object.freeze(['funnel'] as const),
    render: renderFunnel,
  }),
])
