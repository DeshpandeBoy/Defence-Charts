import type { Series } from './data.ts'

/**
 * The two tooltip modes selected by the chart plan. This is interaction state, not placement
 * geometry: I1.2 owns the pure rectangle math that consumes the active state.
 */
export type TooltipMode = 'fixed' | 'fluid'

/**
 * A point's explicit identity inside a series.
 *
 * `pointIndex` is the position in the canonical `Series.points` sequence. It is deliberately
 * named and nested with `seriesId`; an array position is never used as a series identity. A
 * future data contract may add a host point key, but this contract is deterministic with the
 * current `DataPoint` shape, which has no point id of its own.
 */
export type DatumIdentity = {
  readonly seriesId: string
  readonly pointIndex: number
}

export type TooltipState = {
  readonly open: boolean
  readonly mode: TooltipMode
}

/** Hidden IDs are keyed by `Series.id`; every series not listed here is visible by default. */
export type LegendVisibilityState = {
  readonly hiddenSeriesIds: readonly string[]
}

/** The complete controlled interaction value. It intentionally carries no data or callbacks. */
export type InteractionStateInput = {
  readonly activeDatum: DatumIdentity | null
  readonly activeSeriesId: string | null
  readonly tooltip: TooltipState
  readonly legend: LegendVisibilityState
}

/** An immutable, canonical interaction value returned by every helper. */
export type InteractionState = InteractionStateInput

export type InteractionStateUpdate =
  | { readonly type: 'set-active-datum'; readonly datum: DatumIdentity | null }
  | { readonly type: 'set-active-series'; readonly seriesId: string | null }
  | { readonly type: 'set-tooltip'; readonly tooltip: TooltipState }
  | { readonly type: 'set-series-visibility'; readonly seriesId: string; readonly visible: boolean }
  | { readonly type: 'set-hidden-series'; readonly hiddenSeriesIds: readonly string[] }

export type InteractionValidationCode =
  | 'invalid-series'
  | 'invalid-series-id'
  | 'duplicate-series-id'
  | 'invalid-state'
  | 'invalid-datum'
  | 'invalid-point-index'
  | 'invalid-tooltip'
  | 'invalid-legend'
  | 'duplicate-hidden-series-id'
  | 'unknown-series-id'

/** A deterministic validation failure at the interaction boundary. */
export class InteractionValidationError extends Error {
  readonly code: InteractionValidationCode
  readonly path: string

  constructor(code: InteractionValidationCode, path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'InteractionValidationError'
    this.code = code
    this.path = path
  }
}

/**
 * Create a point identity without retaining the point or its value.
 *
 * The key uses a length prefix so a series id containing punctuation cannot collide with another
 * id/position pair. It is suitable for DOM keys and lookup tables in later client layers, while
 * this core module remains an ordinary serialisable value contract.
 */
export function createDatumIdentity(seriesId: string, pointIndex: number): DatumIdentity {
  const id = validSeriesId(seriesId, 'seriesId')
  if (!Number.isSafeInteger(pointIndex) || pointIndex < 0) {
    throw new InteractionValidationError(
      'invalid-point-index',
      'pointIndex',
      'must be a non-negative safe integer',
    )
  }

  return Object.freeze({ seriesId: id, pointIndex })
}

/** Return a deterministic scalar key for the explicit `{ seriesId, pointIndex }` identity. */
export function datumIdentityKey(identity: DatumIdentity): string {
  const datum = parseDatum(identity, 'datum')
  return `${datum.seriesId.length}:${datum.seriesId}:${datum.pointIndex}`
}

/** Create the closed, no-selection state for a series catalogue. */
export function createInteractionState(series: readonly Series[]): InteractionState
/** Create and reconcile an initial controlled state against a series catalogue. */
export function createInteractionState(
  series: readonly Series[],
  input: InteractionStateInput,
): InteractionState
export function createInteractionState(
  series: readonly Series[],
  input: InteractionStateInput | null = null,
): InteractionState {
  const initial: InteractionStateInput =
    input === null
      ? {
          activeDatum: null,
          activeSeriesId: null,
          tooltip: { open: false, mode: 'fixed' },
          legend: { hiddenSeriesIds: [] },
        }
      : input

  return normalizeInteractionState(initial, series)
}

/**
 * Parse, validate, canonicalise, and freeze a controlled state.
 *
 * Missing active IDs are cleared rather than replaced with the first/nearest array entry. Missing
 * hidden IDs are removed, and new series are visible by default. Those rules make data updates
 * deterministic without allowing this helper to own filtering, fetching, or persistence.
 */
export function normalizeInteractionState(
  input: unknown,
  series: readonly Series[],
): InteractionState {
  return canonicalize(parseState(input), inspectSeries(series))
}

/** Reconcile an existing state after reorder, visibility, point-count, or resize-like changes. */
export function reconcileInteractionState(
  state: InteractionState,
  series: readonly Series[],
): InteractionState {
  return normalizeInteractionState(state, series)
}

/**
 * Apply one serialisable controlled update and reconcile its result against the current catalogue.
 * The returned value is new and frozen; neither the previous state nor the update is mutated.
 */
export function updateInteractionState(
  state: InteractionState,
  update: InteractionStateUpdate,
  series: readonly Series[],
): InteractionState {
  const catalog = inspectSeries(series)
  const current = canonicalize(parseState(state), catalog)
  const next = applyUpdate(current, update, catalog)
  return canonicalize(parseState(next), catalog)
}

function applyUpdate(
  state: InteractionState,
  update: InteractionStateUpdate,
  catalog: readonly SeriesDescriptor[],
): InteractionStateInput {
  if (!isRecord(update) || typeof update.type !== 'string') {
    throw new InteractionValidationError('invalid-state', 'update', 'must be a recognised update object')
  }

  switch (update.type) {
    case 'set-active-datum': {
      const datum = parseNullableDatum(update.datum, 'update.datum')
      if (datum === null) {
        return { ...state, activeDatum: null }
      }
      requireDatumInCatalog(datum, catalog, 'update.datum')
      return { ...state, activeDatum: datum, activeSeriesId: datum.seriesId }
    }
    case 'set-active-series': {
      const seriesId = parseNullableSeriesId(update.seriesId, 'update.seriesId')
      if (seriesId === null) {
        return { ...state, activeDatum: null, activeSeriesId: null }
      }
      requireSeriesInCatalog(seriesId, catalog, 'update.seriesId')
      return { ...state, activeDatum: null, activeSeriesId: seriesId }
    }
    case 'set-tooltip':
      return { ...state, tooltip: parseTooltip(update.tooltip, 'update.tooltip') }
    case 'set-series-visibility': {
      const seriesId = validSeriesId(update.seriesId, 'update.seriesId')
      requireSeriesInCatalog(seriesId, catalog, 'update.seriesId')
      if (typeof update.visible !== 'boolean') {
        throw new InteractionValidationError('invalid-legend', 'update.visible', 'must be a boolean')
      }

      const hiddenSeriesIds = state.legend.hiddenSeriesIds.slice()
      const hiddenIndex = hiddenSeriesIds.indexOf(seriesId)
      if (update.visible && hiddenIndex >= 0) hiddenSeriesIds.splice(hiddenIndex, 1)
      if (!update.visible && hiddenIndex < 0) hiddenSeriesIds.push(seriesId)
      return { ...state, legend: { hiddenSeriesIds } }
    }
    case 'set-hidden-series':
      return {
        ...state,
        legend: {
          hiddenSeriesIds: parseHiddenSeriesIds(update.hiddenSeriesIds, 'update.hiddenSeriesIds'),
        },
      }
    default:
      throw new InteractionValidationError('invalid-state', 'update.type', 'must be a recognised update')
  }
}

type SeriesDescriptor = {
  readonly id: string
  readonly pointCount: number
}

function inspectSeries(series: readonly Series[]): readonly SeriesDescriptor[] {
  if (!Array.isArray(series)) {
    throw new InteractionValidationError('invalid-series', 'series', 'must be an array')
  }

  const descriptors: SeriesDescriptor[] = []
  for (let index = 0; index < series.length; index += 1) {
    const candidate: unknown = series[index]
    if (!isRecord(candidate) || typeof candidate.id !== 'string' || !Array.isArray(candidate.points)) {
      throw new InteractionValidationError(
        'invalid-series',
        `series[${index}]`,
        'must contain a string id and a points array',
      )
    }

    const id = validSeriesId(candidate.id, `series[${index}].id`)
    if (findDescriptor(descriptors, id) !== null) {
      throw new InteractionValidationError(
        'duplicate-series-id',
        `series[${index}].id`,
        `duplicate series id ${id}`,
      )
    }
    descriptors.push(Object.freeze({ id, pointCount: candidate.points.length }))
  }

  return Object.freeze(descriptors)
}

function canonicalize(
  input: InteractionStateInput,
  catalog: readonly SeriesDescriptor[],
): InteractionState {
  const activeSeries = input.activeSeriesId === null ? null : findDescriptor(catalog, input.activeSeriesId)
  let activeSeriesId = activeSeries?.id ?? null
  let activeDatum = input.activeDatum

  if (activeDatum !== null) {
    const datumSeries = findDescriptor(catalog, activeDatum.seriesId)
    const pointExists = datumSeries !== null && activeDatum.pointIndex < datumSeries.pointCount

    if (!pointExists || (activeSeriesId !== null && activeSeriesId !== activeDatum.seriesId)) {
      activeDatum = null
    } else if (activeSeriesId === null && datumSeries !== null) {
      activeSeriesId = datumSeries.id
    }
  }

  const hiddenSeriesIds = canonicalHiddenSeriesIds(input.legend.hiddenSeriesIds, catalog)
  return Object.freeze({
    activeDatum: activeDatum === null ? null : Object.freeze({ ...activeDatum }),
    activeSeriesId,
    tooltip: Object.freeze({ ...input.tooltip }),
    legend: Object.freeze({ hiddenSeriesIds }),
  })
}

function canonicalHiddenSeriesIds(
  hiddenSeriesIds: readonly string[],
  catalog: readonly SeriesDescriptor[],
): readonly string[] {
  const known: string[] = []
  for (let index = 0; index < hiddenSeriesIds.length; index += 1) {
    const id = validSeriesId(hiddenSeriesIds[index], `legend.hiddenSeriesIds[${index}]`)
    if (known.includes(id)) {
      throw new InteractionValidationError(
        'duplicate-hidden-series-id',
        `legend.hiddenSeriesIds[${index}]`,
        `duplicate hidden series id ${id}`,
      )
    }
    if (findDescriptor(catalog, id) !== null) known.push(id)
  }

  known.sort()
  return Object.freeze(known)
}

function parseState(input: unknown): InteractionStateInput {
  if (!isRecord(input)) {
    throw new InteractionValidationError('invalid-state', 'state', 'must be an object')
  }

  const activeDatum = parseNullableDatum(readOwn(input, 'activeDatum', 'state'), 'state.activeDatum')
  const activeSeriesId = parseNullableSeriesId(
    readOwn(input, 'activeSeriesId', 'state'),
    'state.activeSeriesId',
  )
  const tooltip = parseTooltip(readOwn(input, 'tooltip', 'state'), 'state.tooltip')
  const legendValue = readOwn(input, 'legend', 'state')
  if (!isRecord(legendValue)) {
    throw new InteractionValidationError('invalid-legend', 'state.legend', 'must be an object')
  }
  const hiddenSeriesIds = parseHiddenSeriesIds(
    readOwn(legendValue, 'hiddenSeriesIds', 'state.legend'),
    'state.legend.hiddenSeriesIds',
  )

  return {
    activeDatum,
    activeSeriesId,
    tooltip,
    legend: { hiddenSeriesIds },
  }
}

function parseDatum(value: unknown, path: string): DatumIdentity {
  if (!isRecord(value)) {
    throw new InteractionValidationError('invalid-datum', path, 'must be an object')
  }
  const seriesId = validSeriesId(readOwn(value, 'seriesId', path), `${path}.seriesId`)
  const pointIndex = readOwn(value, 'pointIndex', path)
  if (typeof pointIndex !== 'number' || !Number.isSafeInteger(pointIndex) || pointIndex < 0) {
    throw new InteractionValidationError(
      'invalid-point-index',
      `${path}.pointIndex`,
      'must be a non-negative safe integer',
    )
  }
  return { seriesId, pointIndex }
}

function parseNullableDatum(value: unknown, path: string): DatumIdentity | null {
  return value === null ? null : parseDatum(value, path)
}

function parseTooltip(value: unknown, path: string): TooltipState {
  if (!isRecord(value)) {
    throw new InteractionValidationError('invalid-tooltip', path, 'must be an object')
  }
  const open = readOwn(value, 'open', path)
  const mode = readOwn(value, 'mode', path)
  if (typeof open !== 'boolean') {
    throw new InteractionValidationError('invalid-tooltip', `${path}.open`, 'must be a boolean')
  }
  if (mode !== 'fixed' && mode !== 'fluid') {
    throw new InteractionValidationError('invalid-tooltip', `${path}.mode`, 'must be fixed or fluid')
  }
  return { open, mode }
}

function parseHiddenSeriesIds(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new InteractionValidationError('invalid-legend', path, 'must be an array')
  }
  const ids: string[] = []
  for (let index = 0; index < value.length; index += 1) {
    ids.push(validSeriesId(value[index], `${path}[${index}]`))
  }
  return ids
}

function parseNullableSeriesId(value: unknown, path: string): string | null {
  return value === null ? null : validSeriesId(value, path)
}

function requireDatumInCatalog(
  datum: DatumIdentity,
  catalog: readonly SeriesDescriptor[],
  path: string,
): void {
  const descriptor = requireSeriesInCatalog(datum.seriesId, catalog, `${path}.seriesId`)
  if (datum.pointIndex >= descriptor.pointCount) {
    throw new InteractionValidationError(
      'invalid-datum',
      path,
      `pointIndex ${datum.pointIndex} is outside series ${datum.seriesId}`,
    )
  }
}

function requireSeriesInCatalog(
  seriesId: string,
  catalog: readonly SeriesDescriptor[],
  path: string,
): SeriesDescriptor {
  const descriptor = findDescriptor(catalog, seriesId)
  if (descriptor === null) {
    throw new InteractionValidationError('unknown-series-id', path, `unknown series id ${seriesId}`)
  }
  return descriptor
}

function findDescriptor(
  catalog: readonly SeriesDescriptor[],
  seriesId: string,
): SeriesDescriptor | null {
  for (const descriptor of catalog) {
    if (descriptor.id === seriesId) return descriptor
  }
  return null
}

function validSeriesId(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InteractionValidationError('invalid-series-id', path, 'must be a non-empty string')
  }
  return value
}

function readOwn(record: Record<string, unknown>, key: string, path: string): unknown {
  if (!Object.hasOwn(record, key)) {
    throw new InteractionValidationError('invalid-state', `${path}.${key}`, 'field is required')
  }
  return record[key]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
