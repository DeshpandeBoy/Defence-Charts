/**
 * Heatmap family mark renderer.
 *
 * The coordinator-owned `resolveFrame()` is responsible for producing the activity grid and
 * for deciding which observations are missing or temporally binned. This renderer consumes only
 * the shared `SeriesFrame.cells` geometry seam: it never derives cells from points, samples a
 * dense grid, or substitutes another mark family.
 *
 * `CellFrame` may supply a per-cell identity. When it does not, the renderer uses the supplied
 * series ID plus the cell's deterministic frame-order index. This preserves duplicate geometry
 * and remains stable when the same frame is resized.
 */

import type { MarkRenderer, MarkRendererRegistration, MarkRendererInput } from '../../renderer-seam.ts'
import { classes, roundCoord } from '../../svg.ts'

type HeatmapCell = MarkRendererInput['frame']['cells'][number] & {
  readonly id?: string | undefined
  readonly value?: number | null | undefined
  readonly intensity?: number | null | undefined
}

const renderNone: MarkRenderer = () => null

/**
 * Paint every finite rectangle from the shared heatmap frame.
 *
 * Validation happens before JSX is created so malformed input cannot produce a partially painted
 * grid. Zero width/height is accepted as finite degenerate geometry; this keeps the renderer
 * faithful to a frame that represents a zero-valued observation without inventing colour
 * semantics here.
 */
export const renderHeatmap: MarkRenderer = ({ frame, plan }) => {
  if (plan.type !== 'heatmap') {
    throw new Error(
      `@gx/primitives: heatmap renderer requires a heatmap plan; received '${String(plan.type)}'.`,
    )
  }

  const mark = plan.marks.primary
  if (mark.kind !== 'cell') {
    throw new Error(
      `@gx/primitives: heatmap renderer requires a cell mark; received '${mark.kind}'.`,
    )
  }

  if (plan.marks.renderer !== 'svg') {
    throw new Error(
      `@gx/primitives: heatmap renderer mode '${String(plan.marks.renderer)}' is not implemented; refusing to rasterize cells.`,
    )
  }

  if (typeof frame.id !== 'string' || frame.id.length === 0) {
    throw new Error('@gx/primitives: heatmap rendering requires a stable non-empty series id.')
  }

  if (!Array.isArray(frame.cells)) {
    throw new Error('@gx/primitives: heatmap rendering requires shared SeriesFrame.cells geometry.')
  }

  const cellIds = frame.cells.map((cell, index) => {
    const heatmapCell = cell as HeatmapCell
    validateCell(heatmapCell, index)
    return cellIdentity(frame.id, heatmapCell, index)
  })
  if (new Set(cellIds).size !== cellIds.length) {
    throw new Error('@gx/primitives: heatmap cell identities must be unique within a series.')
  }
  if (frame.cells.length === 0) return null

  return (
    <>
      {frame.cells.map((cell, index) => {
        const id = cellIds[index]!
        const heatmapCell = cell as HeatmapCell
        return (
          <rect
            className={classes('gx-cell', 'gx-heatmap-cell')}
            data-cell-id={id}
            data-cell-index={index}
            data-cell-series-id={frame.id}
            data-heatmap-cell-id={id}
            {...(heatmapCell.value === null ? { 'data-heatmap-state': 'missing' } : {})}
            {...(heatmapCell.value !== undefined &&
            heatmapCell.value !== null &&
            Number.isFinite(heatmapCell.value)
              ? { 'data-heatmap-value': String(heatmapCell.value) }
              : {})}
            {...(heatmapCell.intensity !== undefined &&
            heatmapCell.intensity !== null &&
            Number.isFinite(heatmapCell.intensity)
              ? { 'data-heatmap-intensity': String(Math.round(heatmapCell.intensity * 4)) }
              : {})}
            key={id}
            x={roundCoord(cell.x)}
            y={roundCoord(cell.y)}
            width={roundCoord(cell.width)}
            height={roundCoord(cell.height)}
            {...(heatmapCell.value === undefined
              ? {}
              : {
                  'data-cell-value':
                    heatmapCell.value === null ? 'missing' : String(heatmapCell.value),
                })}
            {...(heatmapCell.intensity === undefined
              ? {}
              : {
                  'data-cell-intensity':
                    heatmapCell.intensity === null ? 'missing' : String(heatmapCell.intensity),
                })}
          />
        )
      })}
    </>
  )
}

function validateCell(cell: HeatmapCell, index: number): void {
  if (typeof cell !== 'object' || cell === null) {
    throw new Error(`@gx/primitives: heatmap cell ${index} has invalid geometry.`)
  }

  for (const [name, value] of [
    ['x', cell.x],
    ['y', cell.y],
    ['width', cell.width],
    ['height', cell.height],
  ] as const) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`@gx/primitives: heatmap cell ${index} ${name} geometry must be finite.`)
    }
  }

  if (cell.width < 0 || cell.height < 0) {
    throw new Error(`@gx/primitives: heatmap cell ${index} geometry cannot have negative size.`)
  }

  if (cell.id !== undefined && (typeof cell.id !== 'string' || cell.id.length === 0)) {
    throw new Error(`@gx/primitives: heatmap cell ${index} requires a stable non-empty id.`)
  }
  if (cell.value !== undefined && cell.value !== null && !Number.isFinite(cell.value)) {
    throw new Error(`@gx/primitives: heatmap cell ${index} value must be finite or null.`)
  }
  if (
    cell.intensity !== undefined &&
    cell.intensity !== null &&
    (!Number.isFinite(cell.intensity) || cell.intensity < 0 || cell.intensity > 1)
  ) {
    throw new Error(`@gx/primitives: heatmap cell ${index} intensity must be between 0 and 1 or null.`)
  }
}

function cellIdentity(seriesId: string, cell: HeatmapCell, index: number): string {
  return cell.id ?? `${seriesId}:cell:${index}`
}

export const HEATMAP_MARK_RENDERERS: readonly MarkRendererRegistration[] = Object.freeze([
  Object.freeze({
    family: 'heatmap',
    markKinds: Object.freeze(['none'] as const),
    render: renderNone,
  }),
  Object.freeze({
    family: 'heatmap',
    markKinds: Object.freeze(['cell'] as const),
    render: renderHeatmap,
  }),
])
