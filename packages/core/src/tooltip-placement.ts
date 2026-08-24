import type { Rect } from './frame.ts'

/** A measured mark box in widget coordinates. Fixed mode uses its horizontal centre. */
export type TooltipAnchor = Rect

/**
 * A measured tooltip box plus enough row geometry to report a bounded overflow count.
 *
 * The renderer owns the actual content and scrolling behaviour. Core only decides the largest
 * safe box and how many declared rows cannot fit in that box.
 */
export type TooltipBox = {
  readonly width: number
  readonly height: number
  readonly headerHeight: number
  readonly rowCount: number
  readonly rowHeight: number
}

export type TooltipPlacementMode = 'fixed' | 'fluid'
export type FixedTooltipRail = 'top' | 'bottom'
export type FluidTooltipSide = 'above-right' | 'above-left' | 'below-right' | 'below-left'
export type TooltipPlacementSide = FixedTooltipRail | FluidTooltipSide

/**
 * All coordinates are in one widget-local space. `plot` is the interaction region inside
 * `widget`; it is a model invariant rather than a second collision boundary.
 */
export type TooltipPlacementInput = {
  readonly mode: TooltipPlacementMode
  readonly anchor: TooltipAnchor
  readonly tooltip: TooltipBox
  readonly widget: Rect
  readonly plot: Rect
  readonly safePadding: number
  readonly offset: number
  readonly preferredFixedRail: FixedTooltipRail
  readonly preferredFluidSide: FluidTooltipSide
}

export type TooltipPlacementStatus = 'fit' | 'clamped' | 'unavailable'

/** A bounded, out-of-flow placement decision. It never changes the widget's normal-flow box. */
export type TooltipPlacement = Rect & {
  readonly mode: TooltipPlacementMode
  readonly side: TooltipPlacementSide
  readonly availableWidth: number
  readonly availableHeight: number
  readonly status: TooltipPlacementStatus
  readonly hiddenRowCount: number
}

export type TooltipPlacementValidationCode =
  | 'invalid-input'
  | 'invalid-mode'
  | 'invalid-rectangle'
  | 'invalid-tooltip'
  | 'invalid-number'
  | 'plot-outside-widget'
  | 'invalid-fixed-rail'
  | 'invalid-fluid-side'

/** A deterministic input failure at the pure placement boundary. */
export class TooltipPlacementValidationError extends Error {
  readonly code: TooltipPlacementValidationCode
  readonly path: string

  constructor(code: TooltipPlacementValidationCode, path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'TooltipPlacementValidationError'
    this.code = code
    this.path = path
  }
}

type NormalizedInput = {
  readonly mode: TooltipPlacementMode
  readonly anchor: TooltipAnchor
  readonly tooltip: TooltipBox
  readonly widget: Rect
  readonly plot: Rect
  readonly safePadding: number
  readonly offset: number
  readonly preferredFixedRail: FixedTooltipRail
  readonly preferredFluidSide: FluidTooltipSide
}

type SafeRect = Rect

type Candidate = {
  readonly side: FluidTooltipSide
  readonly x: number
  readonly y: number
  readonly overflow: number
}

const FLUID_SIDES: readonly FluidTooltipSide[] = Object.freeze([
  'above-right',
  'above-left',
  'below-right',
  'below-left',
])

/**
 * Place a measured tooltip without a DOM, viewport global, or client-only dependency.
 *
 * Fixed mode is the default for narrow charts: it centres on the active anchor's X coordinate
 * and uses a top/bottom rail. Fluid mode is explicit and starts from the bounded plot anchor,
 * trying the preferred quadrant before deterministic fallbacks. Both modes size and clamp the
 * panel against the widget's local boundary.
 */
export function placeTooltip(input: TooltipPlacementInput): TooltipPlacement {
  const normalized = normalizeInput(input as unknown)
  const safe = safeRect(normalized.widget, normalized.safePadding)
  const boundedTooltip = boundedTooltipSize(normalized.tooltip, safe)

  if (normalized.mode === 'fixed') {
    return placeFixed(normalized, safe, boundedTooltip)
  }
  return placeFluid(normalized, safe, boundedTooltip)
}

function normalizeInput(input: unknown): NormalizedInput {
  if (!isRecord(input)) {
    throw new TooltipPlacementValidationError('invalid-input', 'input', 'must be an object')
  }

  const mode = readMode(input.mode, 'input.mode')
  const anchor = readRect(input.anchor, 'input.anchor')
  const tooltip = readTooltip(input.tooltip, 'input.tooltip')
  const widget = readRect(input.widget, 'input.widget')
  const plot = readRect(input.plot, 'input.plot')
  const safePadding = readNonNegativeNumber(input.safePadding, 'input.safePadding')
  const offset = readNonNegativeNumber(input.offset, 'input.offset')
  const preferredFixedRail = readFixedRail(input.preferredFixedRail, 'input.preferredFixedRail')
  const preferredFluidSide = readFluidSide(input.preferredFluidSide, 'input.preferredFluidSide')

  if (
    plot.x < widget.x ||
    plot.y < widget.y ||
    plot.x + plot.width > widget.x + widget.width ||
    plot.y + plot.height > widget.y + widget.height
  ) {
    throw new TooltipPlacementValidationError(
      'plot-outside-widget',
      'input.plot',
      'must be contained by input.widget',
    )
  }

  return Object.freeze({
    mode,
    anchor,
    tooltip,
    widget,
    plot,
    safePadding,
    offset,
    preferredFixedRail,
    preferredFluidSide,
  })
}

function readRect(value: unknown, path: string): Rect {
  if (!isRecord(value)) {
    throw new TooltipPlacementValidationError('invalid-rectangle', path, 'must be an object')
  }
  const x = readFiniteNumber(value.x, `${path}.x`)
  const y = readFiniteNumber(value.y, `${path}.y`)
  const width = readNonNegativeNumber(value.width, `${path}.width`)
  const height = readNonNegativeNumber(value.height, `${path}.height`)
  return Object.freeze({ x, y, width, height })
}

function readTooltip(value: unknown, path: string): TooltipBox {
  if (!isRecord(value)) {
    throw new TooltipPlacementValidationError('invalid-tooltip', path, 'must be an object')
  }
  const width = readNonNegativeNumber(value.width, `${path}.width`)
  const height = readNonNegativeNumber(value.height, `${path}.height`)
  const headerHeight = readNonNegativeNumber(value.headerHeight, `${path}.headerHeight`)
  const rowCount = readCount(value.rowCount, `${path}.rowCount`)
  const rowHeight = readNonNegativeNumber(value.rowHeight, `${path}.rowHeight`)
  return Object.freeze({ width, height, headerHeight, rowCount, rowHeight })
}

function readMode(value: unknown, path: string): TooltipPlacementMode {
  if (value === 'fixed' || value === 'fluid') return value
  throw new TooltipPlacementValidationError('invalid-mode', path, 'must be fixed or fluid')
}

function readFixedRail(value: unknown, path: string): FixedTooltipRail {
  if (value === 'top' || value === 'bottom') return value
  throw new TooltipPlacementValidationError('invalid-fixed-rail', path, 'must be top or bottom')
}

function readFluidSide(value: unknown, path: string): FluidTooltipSide {
  if (
    value === 'above-right' ||
    value === 'above-left' ||
    value === 'below-right' ||
    value === 'below-left'
  ) {
    return value
  }
  throw new TooltipPlacementValidationError(
    'invalid-fluid-side',
    path,
    'must be above-right, above-left, below-right, or below-left',
  )
}

function readFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TooltipPlacementValidationError('invalid-number', path, 'must be finite')
  }
  return value
}

function readNonNegativeNumber(value: unknown, path: string): number {
  const number = readFiniteNumber(value, path)
  if (number < 0) {
    throw new TooltipPlacementValidationError('invalid-number', path, 'must be non-negative')
  }
  return number
}

function readCount(value: unknown, path: string): number {
  const number = readNonNegativeNumber(value, path)
  if (!Number.isSafeInteger(number)) {
    throw new TooltipPlacementValidationError('invalid-tooltip', path, 'must be a safe integer')
  }
  return number
}

function safeRect(widget: Rect, padding: number): SafeRect {
  const horizontal = Math.min(padding, widget.width / 2)
  const vertical = Math.min(padding, widget.height / 2)
  return Object.freeze({
    x: widget.x + horizontal,
    y: widget.y + vertical,
    width: Math.max(0, widget.width - horizontal * 2),
    height: Math.max(0, widget.height - vertical * 2),
  })
}

function boundedTooltipSize(tooltip: TooltipBox, safe: SafeRect): Rect {
  return Object.freeze({
    x: 0,
    y: 0,
    width: Math.min(tooltip.width, safe.width),
    height: Math.min(tooltip.height, safe.height),
  })
}

function placeFixed(
  input: NormalizedInput,
  safe: SafeRect,
  tooltip: Rect,
): TooltipPlacement {
  const topAvailable = topRailHeight(input, safe)
  const bottomAvailable = bottomRailHeight(input, safe)
  const preferred = input.preferredFixedRail
  const opposite: FixedTooltipRail = preferred === 'top' ? 'bottom' : 'top'

  const preferredFits = railCanFit(preferred, tooltip.height, topAvailable, bottomAvailable)
  const oppositeFits = railCanFit(opposite, tooltip.height, topAvailable, bottomAvailable)
  let side = preferred
  if (!preferredFits && oppositeFits) side = opposite
  if (!preferredFits && !oppositeFits) {
    const preferredSpace = railSpace(preferred, topAvailable, bottomAvailable)
    const oppositeSpace = railSpace(opposite, topAvailable, bottomAvailable)
    if (oppositeSpace > preferredSpace) side = opposite
  }

  const availableHeight = railSpace(side, topAvailable, bottomAvailable)
  const height = Math.min(tooltip.height, availableHeight)
  const width = tooltip.width
  const x = clamp(
    input.anchor.x + input.anchor.width / 2 - width / 2,
    safe.x,
    safe.x + safe.width - width,
  )
  const y = fixedY(side, input, safe, height)

  return makePlacement(
    input,
    side,
    x,
    y,
    width,
    height,
    safe.width,
    availableHeight,
  )
}

function placeFluid(
  input: NormalizedInput,
  safe: SafeRect,
  tooltip: Rect,
): TooltipPlacement {
  const anchor = boundedAnchor(input.anchor, input.plot)
  const candidates = fluidCandidates(anchor, tooltip, safe, input.offset, input.preferredFluidSide)
  let selected = candidates[0]!
  let bestOverflow = selected.overflow

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]!
    if (candidate.overflow === 0) {
      selected = candidate
      bestOverflow = 0
      break
    }
    if (candidate.overflow < bestOverflow) {
      selected = candidate
      bestOverflow = candidate.overflow
    }
  }

  const x = clamp(selected.x, safe.x, safe.x + safe.width - tooltip.width)
  const y = clamp(selected.y, safe.y, safe.y + safe.height - tooltip.height)
  return makePlacement(
    input,
    selected.side,
    x,
    y,
    tooltip.width,
    tooltip.height,
    safe.width,
    safe.height,
  )
}

function boundedAnchor(anchor: TooltipAnchor, plot: Rect): TooltipAnchor {
  const width = Math.min(anchor.width, plot.width)
  const height = Math.min(anchor.height, plot.height)
  return Object.freeze({
    x: clamp(anchor.x, plot.x, plot.x + plot.width - width),
    y: clamp(anchor.y, plot.y, plot.y + plot.height - height),
    width,
    height,
  })
}

function fluidCandidates(
  anchor: TooltipAnchor,
  tooltip: Rect,
  safe: SafeRect,
  offset: number,
  preferred: FluidTooltipSide,
): readonly Candidate[] {
  const ordered: FluidTooltipSide[] = []
  const preferredIndex = FLUID_SIDES.indexOf(preferred)
  ordered.push(preferred)
  for (let step = 1; step < FLUID_SIDES.length; step += 1) {
    const index = (preferredIndex + step) % FLUID_SIDES.length
    const side = FLUID_SIDES[index]!
    ordered.push(side)
  }

  return Object.freeze(
    ordered.map((side) => {
      const x = side.endsWith('right')
        ? anchor.x + anchor.width + offset
        : anchor.x - tooltip.width - offset
      const y = side.startsWith('above')
        ? anchor.y - tooltip.height - offset
        : anchor.y + anchor.height + offset
      const candidate = { side, x, y, overflow: 0 }
      return Object.freeze({ ...candidate, overflow: candidateOverflow(candidate, tooltip, safe) })
    }),
  )
}

function candidateOverflow(candidate: Candidate, tooltip: Rect, safe: SafeRect): number {
  const horizontal =
    Math.max(0, safe.x - candidate.x) +
    Math.max(0, candidate.x + tooltip.width - (safe.x + safe.width))
  const vertical =
    Math.max(0, safe.y - candidate.y) +
    Math.max(0, candidate.y + tooltip.height - (safe.y + safe.height))
  return horizontal + vertical
}

function topRailHeight(input: NormalizedInput, safe: SafeRect): number {
  const railBottom = Math.min(safe.y + safe.height, input.plot.y - input.offset)
  return Math.max(0, railBottom - safe.y)
}

function bottomRailHeight(input: NormalizedInput, safe: SafeRect): number {
  const railTop = Math.max(safe.y, input.plot.y + input.plot.height + input.offset)
  return Math.max(0, safe.y + safe.height - railTop)
}

function railCanFit(
  side: FixedTooltipRail,
  height: number,
  topAvailable: number,
  bottomAvailable: number,
): boolean {
  return height <= railSpace(side, topAvailable, bottomAvailable)
}

function railSpace(side: FixedTooltipRail, topAvailable: number, bottomAvailable: number): number {
  return side === 'top' ? topAvailable : bottomAvailable
}

function fixedY(side: FixedTooltipRail, input: NormalizedInput, safe: SafeRect, height: number): number {
  if (side === 'top') {
    const railBottom = Math.min(safe.y + safe.height, input.plot.y - input.offset)
    return clamp(railBottom - height, safe.y, safe.y + safe.height - height)
  }
  const railTop = Math.max(safe.y, input.plot.y + input.plot.height + input.offset)
  return clamp(railTop, safe.y, safe.y + safe.height - height)
}

function makePlacement(
  input: NormalizedInput,
  side: TooltipPlacementSide,
  x: number,
  y: number,
  width: number,
  height: number,
  availableWidth: number,
  availableHeight: number,
): TooltipPlacement {
  const boundedX = clamp(x, input.widget.x, input.widget.x + input.widget.width - width)
  const boundedY = clamp(y, input.widget.y, input.widget.y + input.widget.height - height)
  const hiddenRowCount = hiddenRows(input.tooltip, height)
  const unavailable =
    (input.tooltip.width > 0 && width === 0) || (input.tooltip.height > 0 && height === 0)
  const constrained = width < input.tooltip.width || height < input.tooltip.height

  return Object.freeze({
    x: boundedX,
    y: boundedY,
    width,
    height,
    mode: input.mode,
    side,
    availableWidth,
    availableHeight,
    status: unavailable ? 'unavailable' : constrained ? 'clamped' : 'fit',
    hiddenRowCount,
  })
}

function hiddenRows(tooltip: TooltipBox, height: number): number {
  if (tooltip.rowCount === 0 || tooltip.rowHeight === 0) return 0
  const rowSpace = Math.max(0, height - tooltip.headerHeight)
  const visible = Math.min(tooltip.rowCount, Math.floor(rowSpace / tooltip.rowHeight))
  return tooltip.rowCount - visible
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(max, Math.max(min, value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
