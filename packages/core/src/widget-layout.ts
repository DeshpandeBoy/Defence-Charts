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

/** One source-version migration step. It must return the next integer version. */
export type LayoutMigration = (
  snapshot: Readonly<Record<string, unknown>>,
) => Readonly<Record<string, unknown>>

/** Migration functions keyed by the version they migrate from. */
export type LayoutMigrationMap = Readonly<Record<number, LayoutMigration>>

/** No built-in migration exists before the first public release. Future schema bumps add steps here. */
export const LAYOUT_MIGRATIONS: LayoutMigrationMap = Object.freeze({})

export type ParseLayoutSnapshotOptions = {
  readonly migrations?: LayoutMigrationMap
}

/** Placement used only when a current widget does not exist in the saved snapshot. */
export type WidgetDefaultPlacement = {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** Host-owned current widget identity, constraints, and optional placement for newly added widgets. */
export type LayoutReconciliationWidget = {
  readonly id: string
  readonly defaultPlacement?: WidgetDefaultPlacement
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
  | 'future-version'
  | 'migration-failed'

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

/**
 * Apply every migration between a stored and target version in order.
 *
 * The migration receives a clone, so even a mutating host-supplied function cannot alter the
 * caller's decoded value. Each step must advance exactly one version; jumps fail loudly.
 */
export function applyLayoutMigrations(
  value: Readonly<Record<string, unknown>>,
  targetVersion: number,
  migrations: LayoutMigrationMap,
): Readonly<Record<string, unknown>> {
  const storedVersion = readLayoutVersion(value.version)
  if (!Number.isSafeInteger(targetVersion) || targetVersion < 0) {
    throw new LayoutValidationError('invalid-snapshot', 'targetVersion', 'must be a non-negative safe integer')
  }
  if (storedVersion > targetVersion) {
    throw new LayoutValidationError(
      'future-version',
      'snapshot.version',
      `received ${storedVersion}, but this build supports ${targetVersion}`,
    )
  }

  let current = cloneRecord(value)
  for (let version = storedVersion; version < targetVersion; version += 1) {
    const migration = migrations[version]
    if (migration === undefined) {
      throw new LayoutValidationError(
        'unsupported-version',
        'snapshot.version',
        `no migration is registered from version ${version}`,
      )
    }

    let next: Readonly<Record<string, unknown>>
    try {
      const result = migration(cloneRecord(current))
      if (!isRecord(result)) {
        throw new Error('migration must return an object')
      }
      next = cloneRecord(result)
    } catch (error) {
      throw new LayoutValidationError(
        'migration-failed',
        `snapshot.version.${version}`,
        error instanceof Error ? error.message : 'migration threw a non-error value',
      )
    }

    if (next.version !== version + 1) {
      throw new LayoutValidationError(
        'migration-failed',
        `snapshot.version.${version}`,
        `migration must advance exactly to version ${version + 1}`,
      )
    }
    current = next
  }

  return current
}

/** Parse either a JSON string or an unknown decoded value at the persistence boundary. */
export function parseLayoutSnapshot(
  value: string | unknown,
  options: ParseLayoutSnapshotOptions = {},
): LayoutSnapshot {
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

  const storedVersion = readLayoutVersion(candidate.version)
  if (storedVersion > LAYOUT_SCHEMA_VERSION) {
    throw new LayoutValidationError(
      'future-version',
      'snapshot.version',
      `received ${storedVersion}, but this build supports ${LAYOUT_SCHEMA_VERSION}`,
    )
  }
  const migrated = storedVersion === LAYOUT_SCHEMA_VERSION
    ? cloneRecord(candidate)
    : applyLayoutMigrations(candidate, LAYOUT_SCHEMA_VERSION, options.migrations ?? LAYOUT_MIGRATIONS)

  if (migrated.columns !== GRID_COLUMNS) {
    throw new LayoutValidationError(
      'invalid-snapshot',
      'snapshot.columns',
      `expected the locked ${GRID_COLUMNS}-column profile`,
    )
  }
  if (!Array.isArray(migrated.items)) {
    throw new LayoutValidationError('invalid-snapshot', 'snapshot.items', 'must be an array')
  }

  return createLayoutSnapshot(migrated.items.map((item, index) => toInput(item, `snapshot.items[${index}]`)))
}

/**
 * Reconcile a saved snapshot against the host's current widget set without owning storage.
 *
 * Current IDs are authoritative. Missing saved IDs are dropped, new IDs receive their explicit
 * default placement or append below the retained layout, and changed constraints clamp saved size
 * and horizontal position. Collision settlement remains the grid adapter's responsibility.
 */
export function reconcileLayoutSnapshot(
  snapshot: LayoutSnapshot,
  currentWidgets: readonly LayoutReconciliationWidget[],
): LayoutSnapshot {
  if (!Array.isArray(currentWidgets)) {
    throw new LayoutValidationError('invalid-snapshot', 'currentWidgets', 'must be an array')
  }

  const definitions = new Map<string, LayoutReconciliationWidget>()
  currentWidgets.forEach((widget, index) => {
    const candidate: unknown = widget
    if (!isLayoutReconciliationWidget(candidate)) {
      throw new LayoutValidationError('invalid-snapshot', `currentWidgets[${index}]`, 'must be an object')
    }
    const id = createWidgetId(candidate.id)
    if (definitions.has(id)) {
      throw new LayoutValidationError(
        'duplicate-id',
        `currentWidgets[${index}].id`,
        `duplicate widget id ${id}`,
      )
    }
    definitions.set(id, candidate)
  })

  const savedById = new Map(snapshot.items.map((item) => [item.id, item] as const))
  const retained = new Map<string, WidgetLayout>()
  let appendY = 0

  for (const widget of currentWidgets) {
    const saved = savedById.get(widget.id)
    if (saved === undefined) continue
    const next = reconcileWidget(widget, saved)
    retained.set(widget.id, next)
    appendY = Math.max(appendY, next.y + next.h)
  }

  const reconciled = currentWidgets.map((widget) => {
    const existing = retained.get(widget.id)
    if (existing !== undefined) return existing

    const placement = widget.defaultPlacement ?? {
      x: 0,
      y: appendY,
      w: widget.minW ?? DEFAULT_MIN,
      h: widget.minH ?? DEFAULT_MIN,
    }
    const next = reconcileWidget(widget, placement)
    appendY = Math.max(appendY, next.y + next.h)
    return next
  })

  return createLayoutSnapshot(reconciled)
}

function reconcileWidget(
  widget: LayoutReconciliationWidget,
  placement: WidgetDefaultPlacement | WidgetLayout,
): WidgetLayout {
  const minW = widget.minW ?? ('minW' in placement ? placement.minW : DEFAULT_MIN)
  const minH = widget.minH ?? ('minH' in placement ? placement.minH : DEFAULT_MIN)
  const maxW = widget.maxW === undefined
    ? ('maxW' in placement ? placement.maxW : null)
    : widget.maxW
  const maxH = widget.maxH === undefined
    ? ('maxH' in placement ? placement.maxH : null)
    : widget.maxH
  const w = clamp(placement.w, minW, maxW)
  const h = clamp(placement.h, minH, maxH)
  const x = Math.max(0, Math.min(placement.x, GRID_COLUMNS - w))

  return createWidgetLayout({
    id: widget.id,
    x,
    y: placement.y,
    w,
    h,
    minW,
    minH,
    maxW,
    maxH,
    draggable: widget.draggable ?? ('draggable' in placement ? placement.draggable : true),
    resizable: widget.resizable ?? ('resizable' in placement ? placement.resizable : true),
  })
}

function clamp(value: number, minimum: number, maximum: number | null): number {
  return maximum === null ? Math.max(value, minimum) : Math.min(Math.max(value, minimum), maximum)
}

function readLayoutVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new LayoutValidationError(
      'unsupported-version',
      'snapshot.version',
      `expected a non-negative integer no greater than ${LAYOUT_SCHEMA_VERSION}`,
    )
  }
  return value
}

function cloneRecord(value: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return cloneUnknown(value) as Record<string, unknown>
}

function cloneUnknown(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneUnknown)
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, cloneUnknown(nested)]))
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

function isLayoutReconciliationWidget(
  value: unknown,
): value is LayoutReconciliationWidget {
  return isRecord(value) && typeof value.id === 'string'
}
