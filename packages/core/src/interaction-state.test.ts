import { describe, expect, it } from 'vitest'

import type { Series } from './data.ts'
import {
  InteractionValidationError,
  createDatumIdentity,
  createInteractionState,
  datumIdentityKey,
  normalizeInteractionState,
  reconcileInteractionState,
  updateInteractionState,
} from './interaction-state.ts'

function makeSeries(id: string, pointCount: number): Series {
  return {
    id,
    points: Array.from({ length: pointCount }, (_, pointIndex) => ({ x: pointIndex, y: pointIndex + 1 })),
  }
}

const SERIES: readonly Series[] = [makeSeries('alpha', 3), makeSeries('beta', 3), makeSeries('gamma', 2)]

function expectCode(fn: () => unknown, code: InteractionValidationError['code']): void {
  try {
    fn()
    throw new Error(`expected ${code}`)
  } catch (error) {
    expect(error).toBeInstanceOf(InteractionValidationError)
    expect((error as InteractionValidationError).code).toBe(code)
  }
}

describe('interaction identity contract', () => {
  it('represents a point explicitly and gives it a deterministic key', () => {
    const identity = createDatumIdentity('beta', 2)

    expect(identity).toEqual({ seriesId: 'beta', pointIndex: 2 })
    expect(datumIdentityKey(identity)).toBe('4:beta:2')
    expect(datumIdentityKey({ seriesId: 'beta', pointIndex: 2 })).toBe(datumIdentityKey(identity))
    expect('seriesIndex' in identity).toBe(false)
    expect(Object.isFrozen(identity)).toBe(true)
  })

  it('creates a complete frozen state with no selection and no hidden series', () => {
    const state = createInteractionState(SERIES)

    expect(state).toEqual({
      activeDatum: null,
      activeSeriesId: null,
      tooltip: { open: false, mode: 'fixed' },
      legend: { hiddenSeriesIds: [] },
    })
    expect(Object.isFrozen(state)).toBe(true)
    expect(Object.isFrozen(state.tooltip)).toBe(true)
    expect(Object.isFrozen(state.legend)).toBe(true)
    expect(Object.isFrozen(state.legend.hiddenSeriesIds)).toBe(true)
  })

  it('round-trips the complete state through JSON without undefined fields', () => {
    const state = createInteractionState(SERIES, {
      activeDatum: createDatumIdentity('beta', 1),
      activeSeriesId: 'beta',
      tooltip: { open: true, mode: 'fluid' },
      legend: { hiddenSeriesIds: ['gamma', 'alpha'] },
    })
    const decoded: unknown = JSON.parse(JSON.stringify(state))

    expect(decoded).toEqual({
      activeDatum: { seriesId: 'beta', pointIndex: 1 },
      activeSeriesId: 'beta',
      tooltip: { open: true, mode: 'fluid' },
      legend: { hiddenSeriesIds: ['alpha', 'gamma'] },
    })
    expect(decoded).toEqual(state)
  })

  it('does not retain mutable input references', () => {
    const input = {
      activeDatum: { seriesId: 'beta', pointIndex: 1 },
      activeSeriesId: 'beta',
      tooltip: { open: true, mode: 'fixed' as const },
      legend: { hiddenSeriesIds: ['beta'] },
    }
    const state = normalizeInteractionState(input, SERIES)
    input.activeDatum.pointIndex = 0
    input.legend.hiddenSeriesIds[0] = 'alpha'

    expect(state.activeDatum).toEqual({ seriesId: 'beta', pointIndex: 1 })
    expect(state.legend.hiddenSeriesIds).toEqual(['beta'])
  })
})
describe('interaction state updates and reconciliation', () => {
  it('keeps active datum and hidden visibility keyed by Series.id through reorder', () => {
    const initial = createInteractionState(SERIES, {
      activeDatum: createDatumIdentity('beta', 1),
      activeSeriesId: 'beta',
      tooltip: { open: true, mode: 'fixed' },
      legend: { hiddenSeriesIds: ['beta'] },
    })
    const reordered: readonly Series[] = [SERIES[2]!, SERIES[1]!, SERIES[0]!]
    const reconciled = reconcileInteractionState(initial, reordered)

    expect(reconciled.activeSeriesId).toBe('beta')
    expect(reconciled.activeDatum).toEqual({ seriesId: 'beta', pointIndex: 1 })
    expect(reconciled.legend.hiddenSeriesIds).toEqual(['beta'])
  })

  it('keeps identity through resize-like point updates and never falls back to a neighbour', () => {
    const initial = createInteractionState(SERIES, {
      activeDatum: createDatumIdentity('beta', 1),
      activeSeriesId: 'beta',
      tooltip: { open: true, mode: 'fluid' },
      legend: { hiddenSeriesIds: [] },
    })
    const resized: readonly Series[] = [makeSeries('alpha', 1), makeSeries('beta', 3), makeSeries('gamma', 1)]
    const stable = reconcileInteractionState(initial, resized)
    expect(stable.activeDatum).toEqual({ seriesId: 'beta', pointIndex: 1 })
    expect(stable.activeSeriesId).toBe('beta')

    const pointRemoved = reconcileInteractionState(initial, [makeSeries('alpha', 3), makeSeries('beta', 1)])
    expect(pointRemoved.activeDatum).toBeNull()
    expect(pointRemoved.activeSeriesId).toBe('beta')
  })

  it('clears missing identities deterministically and leaves new series visible', () => {
    const initial = createInteractionState(SERIES, {
      activeDatum: createDatumIdentity('beta', 1),
      activeSeriesId: 'beta',
      tooltip: { open: true, mode: 'fixed' },
      legend: { hiddenSeriesIds: ['alpha', 'beta'] },
    })
    const next = reconcileInteractionState(initial, [makeSeries('gamma', 2), makeSeries('delta', 4)])

    expect(next.activeDatum).toBeNull()
    expect(next.activeSeriesId).toBeNull()
    expect(next.legend.hiddenSeriesIds).toEqual([])
  })

  it('does not clear active identity merely because its series is hidden', () => {
    const initial = createInteractionState(SERIES, {
      activeDatum: createDatumIdentity('beta', 0),
      activeSeriesId: 'beta',
      tooltip: { open: false, mode: 'fixed' },
      legend: { hiddenSeriesIds: [] },
    })
    const hidden = updateInteractionState(
      initial,
      { type: 'set-series-visibility', seriesId: 'beta', visible: false },
      SERIES,
    )

    expect(hidden.activeSeriesId).toBe('beta')
    expect(hidden.activeDatum).toEqual({ seriesId: 'beta', pointIndex: 0 })
    expect(hidden.legend.hiddenSeriesIds).toEqual(['beta'])
  })

  it('updates active selection, tooltip mode/open, and visibility without mutation', () => {
    const initial = createInteractionState(SERIES)
    const active = updateInteractionState(
      initial,
      { type: 'set-active-datum', datum: createDatumIdentity('alpha', 2) },
      SERIES,
    )
    const tooltip = updateInteractionState(
      active,
      { type: 'set-tooltip', tooltip: { open: true, mode: 'fluid' } },
      SERIES,
    )
    const hidden = updateInteractionState(
      tooltip,
      { type: 'set-series-visibility', seriesId: 'alpha', visible: false },
      SERIES,
    )
    const shown = updateInteractionState(
      hidden,
      { type: 'set-series-visibility', seriesId: 'alpha', visible: true },
      SERIES,
    )
    const cleared = updateInteractionState(
      shown,
      { type: 'set-active-series', seriesId: null },
      SERIES,
    )

    expect(initial).toEqual(createInteractionState(SERIES))
    expect(hidden.tooltip).toEqual({ open: true, mode: 'fluid' })
    expect(hidden.activeSeriesId).toBe('alpha')
    expect(hidden.legend.hiddenSeriesIds).toEqual(['alpha'])
    expect(shown.legend.hiddenSeriesIds).toEqual([])
    expect(cleared.activeSeriesId).toBeNull()
    expect(cleared.activeDatum).toBeNull()
  })
})

describe('interaction state validation', () => {
  it('rejects duplicate series identity and duplicate hidden identity', () => {
    expectCode(
      () => createInteractionState([makeSeries('alpha', 1), makeSeries('alpha', 2)]),
      'duplicate-series-id',
    )
    expectCode(
      () =>
        createInteractionState(SERIES, {
          activeDatum: null,
          activeSeriesId: null,
          tooltip: { open: false, mode: 'fixed' },
          legend: { hiddenSeriesIds: ['alpha', 'alpha'] },
        }),
      'duplicate-hidden-series-id',
    )
  })

  it('rejects invalid point identities and incomplete state values', () => {
    expectCode(() => createDatumIdentity('', 0), 'invalid-series-id')
    expectCode(() => createDatumIdentity('alpha', -1), 'invalid-point-index')
    expectCode(
      () =>
        normalizeInteractionState(
          {
            activeDatum: { seriesId: 'alpha', pointIndex: 1.5 },
            activeSeriesId: 'alpha',
            tooltip: { open: false, mode: 'fixed' },
            legend: { hiddenSeriesIds: [] },
          },
          SERIES,
        ),
      'invalid-point-index',
    )
    expectCode(
      () => normalizeInteractionState({ activeDatum: null }, SERIES),
      'invalid-state',
    )
    expectCode(
      () =>
        normalizeInteractionState(
          {
            activeDatum: null,
            activeSeriesId: null,
            tooltip: { open: true, mode: 'none' },
            legend: { hiddenSeriesIds: [] },
          },
          SERIES,
        ),
      'invalid-tooltip',
    )
  })

  it('rejects explicit updates to unknown identities instead of reassigning them', () => {
    const state = createInteractionState(SERIES)
    expectCode(
      () =>
        updateInteractionState(
          state,
          { type: 'set-active-series', seriesId: 'missing' },
          SERIES,
        ),
      'unknown-series-id',
    )
    expectCode(
      () =>
        updateInteractionState(
          state,
          { type: 'set-active-datum', datum: { seriesId: 'alpha', pointIndex: 99 } },
          SERIES,
        ),
      'invalid-datum',
    )
    expectCode(
      () =>
        updateInteractionState(
          state,
          { type: 'set-series-visibility', seriesId: 'missing', visible: false },
          SERIES,
        ),
      'unknown-series-id',
    )
  })
})
