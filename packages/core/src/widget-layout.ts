/**
 * Pure dashboard layout contracts.
 *
 * The grid owns placement; this module owns only the serialisable value that crosses that
 * boundary. It intentionally has no React, DOM, storage, URL, network, chart-type, or filter
 * knowledge. A row is unbounded, while the public v1 coordinate system is always 12 columns.
 */

/** The locked public v1 grid width. Profiles such as 6 or 18 columns need a later contract. */
export const GRID_COLUMNS = 12

/** Version of the persisted layout payload. Unsupported versions fail loudly at the boundary. */
export const LAYOUT_SCHEMA_VERSION = 1

/** A non-empty, stable host-provided widget key. The brand is compile-time only; runtime is a string. */
export type WidgetId = string & { readonly __widgetId: unique symbol }

/** Layout constraints that affect placement, not chart information. */
export type WidgetLayoutConstraints = {
  readonly minW: number
  readonly minH: number
  readonly maxW: number | null
  readonly maxH: number | null
  readonly draggable: boolean
  readonly resizable: boolean
}

/** One immutable widget footprint in 12-column cell coordinates. */
export type WidgetLayout = WidgetLayoutConstraints & {
  readonly id: WidgetId
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** The only state this snapshot persists: version, grid profile, and widget placement. */
export type LayoutSnapshot = {
  readonly version: typeof LAYOUT_SCHEMA_VERSION
  readonly columns: typeof GRID_COLUMNS
  readonly items: readonly WidgetLayout[]
}

export type WidgetLayoutInput = {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly minW?: number
  readonly minH?: number
  readonly maxW?: number | null
  readonly maxH?: number | null
  readonly draggable?: boolean
  readonly resizable?: boolean
}

export type LayoutValidationCode =
  | 'invalid-id'
  | 'invalid-coordinate'
  | 'invalid-size'
  | 'invalid-constraint'
  | 'out-of-bounds'
  | 'duplicate-id'
  | 'invalid-snapshot'
  | 'unsupported-version'

/** A deterministic, inspectable validation failure at the serialisation boundary. */
export class LayoutValidationError extends Error {
  readonly code: LayoutValidationCode
  readonly path: string

  constructor(code: LayoutValidationCode, path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'LayoutValidationError'
    this.code = code
    this.path = path
  }
}

const DEFAULT_MIN = 1

/** Turn a host string into the branded ID used by layout values. */
export function createWidgetId(value: string): WidgetId {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new LayoutValidationError('invalid-id', 'id', 'must be a non-empty string')
  }
  return value as WidgetId
}

/**
 * Validate and freeze one layout item.
 *
 * The input is copied. Mutating a caller-owned object after this function returns cannot alter a
 * snapshot or a controlled callback payload.
 */
export function createWidgetLayout(input: WidgetLayoutInput): WidgetLayout {
  if (!isRecord(input)) {
    throw new LayoutValidationError('invalid-snapshot', 'item', 'must be an object')
  }

  const id = createWidgetId(input.id)
  const x = integer(input.x, 'x')
  const y = integer(input.y, 'y')
  const w = positiveInteger(input.w, 'w')
  const h = positiveInteger(input.h, 'h')
  const minW = input.minW === undefined ? DEFAULT_MIN : positiveInteger(input.minW, 'minW')
  const minH = input.minH === undefined ? DEFAULT_MIN : positiveInteger(input.minH, 'minH')
  const maxW = nullablePositiveInteger(input.maxW, 'maxW')
  const maxH = nullablePositiveInteger(input.maxH, 'maxH')
  const draggable = booleanOrDefault(input.draggable, true, 'draggable')
  const resizable = booleanOrDefault(input.resizable, true, 'resizable')

  if (x < 0 || y < 0) {
    throw new LayoutValidationError('invalid-coordinate', `${id}.position`, 'x and y must be >= 0')
  }
  if (w < minW || h < minH) {
    throw new LayoutValidationError(
      'invalid-constraint',
      id,
      'current width/height cannot be smaller than minW/minH',
    )
  }
  if (maxW !== null && (maxW < minW || w > maxW)) {
    throw new LayoutValidationError('invalid-constraint', `${id}.maxW`, 'must be null or >= minW and w')
  }
  if (maxH !== null && (maxH < minH || h > maxH)) {
    throw new LayoutValidationError('invalid-constraint', `${id}.maxH`, 'must be null or >= minH and h')
  }
  if (x + w > GRID_COLUMNS) {
    throw new LayoutValidationError(
      'out-of-bounds',
      id,
      `x + w must be <= ${GRID_COLUMNS} for the locked public grid`,
    )
  }

  return Object.freeze({
    id,
    x,
    y,
    w,
    h,
    minW,
    minH,
    maxW,
    maxH,
    draggable,
    resizable,
  })
}

/** Validate, canonicalise, and freeze a complete widget layout. */
export function validateWidgetLayouts(inputs: readonly WidgetLayoutInput[]): readonly WidgetLayout[] {
  if (!Array.isArray(inputs)) {
    throw new LayoutValidationError('invalid-snapshot', 'items', 'must be an array')
  }

  const ids = new Set<string>()
  const items = inputs.map((input, index) => {
    const item = createWidgetLayout(input)
    if (ids.has(item.id)) {
      throw new LayoutValidationError('duplicate-id', `items[${index}].id`, `duplicate widget id ${item.id}`)
    }
    ids.add(item.id)
    return item
  })

  return Object.freeze(items)
}

/** Create a versioned, immutable snapshot ready to cross a controlled callback or RSC boundary. */
export function createLayoutSnapshot(inputs: readonly WidgetLayoutInput[]): LayoutSnapshot {
  return Object.freeze({
    version: LAYOUT_SCHEMA_VERSION,
    columns: GRID_COLUMNS,
    items: validateWidgetLayouts(inputs),
  })
}

/** Serialise a validated snapshot without carrying functions, class instances, or undefined values. */
export function serializeLayoutSnapshot(snapshot: LayoutSnapshot): string {
  const canonical = createLayoutSnapshot(snapshot.items)
  return JSON.stringify(canonical)
}

/** Parse either a JSON string or an unknown decoded value at the persistence boundary. */
export function parseLayoutSnapshot(value: string | unknown): LayoutSnapshot {
  let candidate: unknown = value
  if (typeof value === 'string') {
    try {
      candidate = JSON.parse(value) as unknown
    } catch {
      throw new LayoutValidationError('invalid-snapshot', 'snapshot', 'must contain valid JSON')
    }
  }

  if (!isRecord(candidate)) {
    throw new LayoutValidationError('invalid-snapshot', 'snapshot', 'must be an object')
  }
  if (candidate.version !== LAYOUT_SCHEMA_VERSION) {
    throw new LayoutValidationError(
      'unsupported-version',
      'snapshot.version',
      `expected ${LAYOUT_SCHEMA_VERSION}`,
    )
  }
  if (candidate.columns !== GRID_COLUMNS) {
    throw new LayoutValidationError(
      'invalid-snapshot',
      'snapshot.columns',
      `expected the locked ${GRID_COLUMNS}-column profile`,
    )
  }
  if (!Array.isArray(candidate.items)) {
    throw new LayoutValidationError('invalid-snapshot', 'snapshot.items', 'must be an array')
  }

  return createLayoutSnapshot(candidate.items.map((item, index) => toInput(item, `snapshot.items[${index}]`)))
}

function toInput(value: unknown, path: string): WidgetLayoutInput {
  if (!isRecord(value)) {
    throw new LayoutValidationError('invalid-snapshot', path, 'must be an object')
  }
  if (typeof value.id !== 'string') {
    throw new LayoutValidationError('invalid-id', `${path}.id`, 'must be a string')
  }

  return {
    id: value.id,
    x: value.x as number,
    y: value.y as number,
    w: value.w as number,
    h: value.h as number,
    minW: value.minW as number,
    minH: value.minH as number,
    maxW: value.maxW as number | null,
    maxH: value.maxH as number | null,
    draggable: value.draggable as boolean,
    resizable: value.resizable as boolean,
  }
}

function integer(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new LayoutValidationError('invalid-coordinate', field, 'must be a non-negative safe integer')
  }
  return value
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new LayoutValidationError('invalid-size', field, 'must be a positive safe integer')
  }
  return value
}

function nullablePositiveInteger(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null
  return positiveInteger(value, field)
}

function booleanOrDefault(value: unknown, fallback: boolean, field: string): boolean {
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') {
    throw new LayoutValidationError('invalid-constraint', field, 'must be a boolean')
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
