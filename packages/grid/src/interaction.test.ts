import { describe, expect, it } from 'vitest'

import { createLayoutSnapshot, createWidgetId } from '@shiftcharts/core'
import {
  GridInteractionError,
  beginGridInteraction,
  cancelGridInteraction,
  commitGridInteraction,
  previewGridInteraction,
} from './interaction.ts'

const INITIAL = createLayoutSnapshot([
  { id: 'sales', x: 0, y: 0, w: 4, h: 2 },
  { id: 'margin', x: 4, y: 0, w: 4, h: 1 },
])
const PREVIEW = createLayoutSnapshot([
  { id: 'sales', x: 0, y: 2, w: 4, h: 2 },
  { id: 'margin', x: 4, y: 0, w: 4, h: 1 },
])

describe('grid interaction lifecycle', () => {
  it('starts a stable-ID drag session with an immutable initial snapshot', () => {
    const state = beginGridInteraction('drag', 'sales', INITIAL)

    expect(state).toEqual({ kind: 'drag', id: 'sales', initial: INITIAL, preview: INITIAL })
    expect(Object.isFrozen(state)).toBe(true)
    expect(state.id).toBe(createWidgetId('sales'))
  })

  it('updates only preview state while retaining the cancel target', () => {
    const state = previewGridInteraction(beginGridInteraction('resize', 'sales', INITIAL), PREVIEW)

    expect(state.kind).toBe('resize')
    expect(state.preview).toBe(PREVIEW)
    expect(state.initial).toBe(INITIAL)
  })

  it('commits the latest preview exactly once at the state-machine boundary', () => {
    const state = previewGridInteraction(beginGridInteraction('drag', 'sales', INITIAL), PREVIEW)
    const first = commitGridInteraction(state)
    const second = commitGridInteraction(state)

    expect(first).toEqual({ kind: 'drag', phase: 'commit', id: 'sales', snapshot: PREVIEW })
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    expect(Object.isFrozen(first)).toBe(true)
  })

  it('cancels to the initial snapshot rather than the latest preview', () => {
    const state = previewGridInteraction(beginGridInteraction('resize', 'sales', INITIAL), PREVIEW)
    const cancelled = cancelGridInteraction(state)

    expect(cancelled).toEqual({ kind: 'resize', phase: 'cancel', id: 'sales', snapshot: INITIAL })
    expect(cancelled.snapshot).toBe(INITIAL)
  })

  it('rejects an interaction whose ID is not in the controlled snapshot', () => {
    expect(() => beginGridInteraction('drag', 'unknown', INITIAL)).toThrow(GridInteractionError)
    expect(() =>
      previewGridInteraction(
        beginGridInteraction('drag', 'sales', INITIAL),
        createLayoutSnapshot([{ id: 'margin', x: 0, y: 0, w: 2, h: 1 }]),
      ),
    ).toThrow(GridInteractionError)
  })
})
