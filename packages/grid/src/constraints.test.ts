import { describe, expect, it } from 'vitest'

import { GridProposalError, applyGridProposal } from './constraints.ts'

const BASE = [
  { id: 'hero', x: 0, y: 0, w: 4, h: 2, minW: 2, minH: 1, maxW: 8, maxH: 4 },
  { id: 'side', x: 4, y: 0, w: 4, h: 2 },
  { id: 'footer', x: 0, y: 2, w: 8, h: 1 },
] as const

function expectCode(fn: () => unknown, code: GridProposalError['code']): void {
  try {
    fn()
    throw new Error(`expected ${code}`)
  } catch (error) {
    expect(error).toBeInstanceOf(GridProposalError)
    expect((error as GridProposalError).code).toBe(code)
  }
}

describe('grid proposals', () => {
  it('pushes a colliding move down through RGL and keeps stable IDs', () => {
    const result = applyGridProposal(BASE, { id: 'side', x: 0, y: 0 })
    const hero = result.find((item) => item.id === 'hero')!
    const side = result.find((item) => item.id === 'side')!

    expect(side).toMatchObject({ id: 'side', x: 0, y: 0, w: 4, h: 2 })
    expect(hero.y).toBeGreaterThanOrEqual(side.y + side.h)
    expect(new Set(result.map((item) => item.id))).toEqual(new Set(['hero', 'side', 'footer']))
  })

  it('pushes a footer down when a resize expands into its row', () => {
    const result = applyGridProposal(BASE, { id: 'hero', w: 8 })
    const hero = result.find((item) => item.id === 'hero')!
    const footer = result.find((item) => item.id === 'footer')!

    expect(hero).toMatchObject({ id: 'hero', w: 8, h: 2 })
    expect(footer.y).toBeGreaterThanOrEqual(hero.y + hero.h)
  })

  it('compacts a legal gap back to the first free row', () => {
    const result = applyGridProposal(BASE, { id: 'footer', y: 7 })
    expect(result.find((item) => item.id === 'footer')?.y).toBe(2)
  })

  it('rejects an unknown or empty proposal explicitly', () => {
    expectCode(() => applyGridProposal(BASE, { id: 'missing', x: 1 }), 'unknown-id')
    expectCode(() => applyGridProposal(BASE, { id: 'hero' }), 'invalid-proposal')
  })

  it('rejects impossible bounds and min/max violations instead of clamping', () => {
    expectCode(() => applyGridProposal(BASE, { id: 'hero', x: 9 }), 'constraint-violation')
    expectCode(() => applyGridProposal(BASE, { id: 'hero', w: 1 }), 'constraint-violation')
    expectCode(() => applyGridProposal(BASE, { id: 'hero', w: 9 }), 'constraint-violation')
    expectCode(() => applyGridProposal(BASE, { id: 'hero', x: 1.5 }), 'invalid-proposal')
  })

  it('rejects movement and resize when the widget disables that operation', () => {
    const locked = [{ id: 'locked', x: 0, y: 0, w: 2, h: 1, draggable: false, resizable: false }]
    expectCode(() => applyGridProposal(locked, { id: 'locked', x: 1 }), 'not-draggable')
    expectCode(() => applyGridProposal(locked, { id: 'locked', w: 1 }), 'not-resizable')
  })

  it('does not mutate the input layout or proposal and returns frozen values', () => {
    const input = BASE.map((item) => ({ ...item }))
    const proposal = { id: 'side', x: 0, y: 0 }
    const before = JSON.stringify(input)
    const result = applyGridProposal(input, proposal)

    expect(JSON.stringify(input)).toBe(before)
    expect(proposal).toEqual({ id: 'side', x: 0, y: 0 })
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result[0])).toBe(true)
  })

  it('is deterministic for identical input and proposal', () => {
    const first = applyGridProposal(BASE, { id: 'hero', x: 2, y: 3, w: 6 })
    const second = applyGridProposal(BASE, { id: 'hero', x: 2, y: 3, w: 6 })
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
  })
})
