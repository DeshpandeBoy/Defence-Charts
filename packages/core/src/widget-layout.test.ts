import { describe, expect, it } from 'vitest'

import {
  GRID_COLUMNS,
  LAYOUT_SCHEMA_VERSION,
  LayoutValidationError,
  applyLayoutMigrations,
  createLayoutSnapshot,
  createWidgetId,
  createWidgetLayout,
  parseLayoutSnapshot,
  reconcileLayoutSnapshot,
  serializeLayoutSnapshot,
  validateWidgetLayouts,
} from './widget-layout.ts'
import type { WidgetLayoutInput } from './widget-layout.ts'

const ITEM = {
  id: 'sales',
  x: 2,
  y: 4,
  w: 4,
  h: 3,
  minW: 2,
  minH: 2,
  maxW: 8,
  maxH: null,
  draggable: true,
  resizable: false,
} as const

function expectCode(fn: () => unknown, code: LayoutValidationError['code']): void {
  try {
    fn()
    throw new Error(`expected ${code}`)
  } catch (error) {
    expect(error).toBeInstanceOf(LayoutValidationError)
    expect((error as LayoutValidationError).code).toBe(code)
  }
}

describe('widget layout contract', () => {
  it('uses the locked 12-column profile and brands stable IDs', () => {
    expect(GRID_COLUMNS).toBe(12)
    expect(LAYOUT_SCHEMA_VERSION).toBe(1)
    expect(createWidgetId('sales')).toBe('sales')
  })

  it('canonicalises defaults and freezes caller-independent values', () => {
    const input = { id: 'sales', x: 0, y: 0, w: 2, h: 1 }
    const item = createWidgetLayout(input)

    expect(item).toEqual({
      id: 'sales',
      x: 0,
      y: 0,
      w: 2,
      h: 1,
      minW: 1,
      minH: 1,
      maxW: null,
      maxH: null,
      draggable: true,
      resizable: true,
    })
    expect(Object.isFrozen(item)).toBe(true)
    input.x = 8
    expect(item.x).toBe(0)
  })

  it('validates duplicate IDs and preserves deterministic order', () => {
    const items = validateWidgetLayouts([ITEM, { ...ITEM, id: 'margin', x: 8, w: 4 }])
    expect(items.map((item) => item.id)).toEqual(['sales', 'margin'])
    expect(Object.isFrozen(items)).toBe(true)
    expect(JSON.stringify(items)).toBe(JSON.stringify(validateWidgetLayouts([ITEM, { ...ITEM, id: 'margin', x: 8, w: 4 }])))
    expectCode(() => validateWidgetLayouts([ITEM, ITEM]), 'duplicate-id')
  })

  it('round-trips a versioned snapshot through JSON', () => {
    const snapshot = createLayoutSnapshot([ITEM])
    const decoded = parseLayoutSnapshot(serializeLayoutSnapshot(snapshot))

    expect(decoded).toEqual(snapshot)
    expect(Object.isFrozen(decoded)).toBe(true)
    expect(Object.isFrozen(decoded.items)).toBe(true)
    expect(Object.isFrozen(decoded.items[0])).toBe(true)
    expect(JSON.parse(serializeLayoutSnapshot(snapshot))).toEqual({
      version: 1,
      columns: 12,
      items: [ITEM],
    })
  })

  it('accepts an already decoded snapshot without retaining its mutable references', () => {
    const decoded: { version: number; columns: number; items: Array<Record<string, unknown>> } = {
      version: 1,
      columns: 12,
      items: [{ ...ITEM }],
    }
    const snapshot = parseLayoutSnapshot(decoded)
    decoded.items[0]!.x = 10
    expect(snapshot.items[0]!.x).toBe(2)
  })

  it('applies registered migrations sequentially without mutating the decoded input', () => {
    const input = { version: 0, items: [{ id: 'sales', x: 0, y: 0, w: 2, h: 1 }] }
    const visited: number[] = []
    const migrated = applyLayoutMigrations(input, 2, {
      0: (snapshot) => {
        visited.push(snapshot.version as number)
        ;(snapshot as Record<string, unknown>).mutated = true
        return { ...snapshot, version: 1, columns: 12 }
      },
      1: (snapshot) => {
        visited.push(snapshot.version as number)
        return { ...snapshot, version: 2, marker: 'sequential' }
      },
    })

    expect(visited).toEqual([0, 1])
    expect(migrated).toMatchObject({ version: 2, columns: 12, marker: 'sequential' })
    expect(input).toEqual({ version: 0, items: [{ id: 'sales', x: 0, y: 0, w: 2, h: 1 }] })
  })

  it('parses an older explicit version through a host-supplied migration', () => {
    const snapshot = parseLayoutSnapshot(
      { version: 0, items: [{ id: 'legacy', x: 0, y: 0, w: 2, h: 1 }] },
      {
        migrations: {
          0: (candidate) => ({ ...candidate, version: 1, columns: 12 }),
        },
      },
    )

    expect(snapshot).toEqual(createLayoutSnapshot([{ id: 'legacy', x: 0, y: 0, w: 2, h: 1 }]))
  })

  it('rejects future, missing-step, failed, and skipping migrations distinctly', () => {
    expectCode(() => parseLayoutSnapshot({ version: 2, columns: 12, items: [] }), 'future-version')
    expectCode(() => parseLayoutSnapshot({ version: 0, columns: 12, items: [] }), 'unsupported-version')
    expectCode(
      () => parseLayoutSnapshot(
        { version: 0, columns: 12, items: [] },
        { migrations: { 0: () => { throw new Error('broken step') } } },
      ),
      'migration-failed',
    )
    expectCode(
      () => parseLayoutSnapshot(
        { version: 0, columns: 12, items: [] },
        { migrations: { 0: (candidate) => ({ ...candidate, version: 2 }) } },
      ),
      'migration-failed',
    )
  })

  it('reconciles removed and added widget IDs with explicit and append-below placements', () => {
    const saved = createLayoutSnapshot([
      { id: 'keep', x: 0, y: 2, w: 4, h: 2 },
      { id: 'remove', x: 4, y: 0, w: 4, h: 1 },
    ])
    const result = reconcileLayoutSnapshot(saved, [
      { id: 'keep' },
      { id: 'explicit', defaultPlacement: { x: 8, y: 0, w: 4, h: 1 } },
      { id: 'fallback', minW: 2, minH: 2 },
    ])

    expect(result.items).toMatchObject([
      { id: 'keep', x: 0, y: 2, w: 4, h: 2 },
      { id: 'explicit', x: 8, y: 0, w: 4, h: 1 },
      { id: 'fallback', x: 0, y: 4, w: 2, h: 2 },
    ])
    expect(result.items.some((item) => item.id === 'remove')).toBe(false)
    expect(Object.isFrozen(result.items)).toBe(true)
  })

  it('clamps saved geometry to current constraints and keeps stable IDs', () => {
    const saved = createLayoutSnapshot([
      { id: 'sales', x: 9, y: 1, w: 3, h: 5, minW: 1, minH: 1, maxW: null, maxH: null },
    ])
    const result = reconcileLayoutSnapshot(saved, [
      { id: 'sales', minW: 6, minH: 2, maxW: 8, maxH: 3, draggable: false },
    ])

    expect(result.items[0]).toMatchObject({
      id: 'sales',
      x: 6,
      y: 1,
      w: 6,
      h: 3,
      minW: 6,
      maxW: 8,
      maxH: 3,
      draggable: false,
    })
  })

  it('rejects duplicate current IDs and leaves all caller values untouched', () => {
    const snapshot = createLayoutSnapshot([ITEM])
    const current = [{ id: 'sales' }, { id: 'sales' }]
    const before = JSON.stringify({ snapshot, current })

    expectCode(() => reconcileLayoutSnapshot(snapshot, current), 'duplicate-id')
    expect(JSON.stringify({ snapshot, current })).toBe(before)
  })

  it('rejects unsupported versions, profiles, malformed JSON, and missing items', () => {
    expectCode(() => parseLayoutSnapshot('{'), 'invalid-snapshot')
    expectCode(() => parseLayoutSnapshot({ columns: 12, items: [] }), 'unsupported-version')
    expectCode(() => parseLayoutSnapshot({ version: 1, columns: 18, items: [] }), 'invalid-snapshot')
    expectCode(() => parseLayoutSnapshot({ version: 1, columns: 12 }), 'invalid-snapshot')
  })

  it.each([
    ['empty ID', { ...ITEM, id: '  ' }, 'invalid-id'],
    ['negative x', { ...ITEM, x: -1 }, 'invalid-coordinate'],
    ['fractional y', { ...ITEM, y: 1.5 }, 'invalid-coordinate'],
    ['zero width', { ...ITEM, w: 0 }, 'invalid-size'],
    ['too wide', { ...ITEM, x: 9, w: 4 }, 'out-of-bounds'],
    ['below minimum', { ...ITEM, w: 1, minW: 2 }, 'invalid-constraint'],
    ['max below minimum', { ...ITEM, maxW: 1 }, 'invalid-constraint'],
    ['height over max', { ...ITEM, maxH: 2 }, 'invalid-constraint'],
    ['invalid draggable', { ...ITEM, draggable: 'yes' }, 'invalid-constraint'],
  ] as const)('rejects %s', (_label, input, code) => {
    expectCode(() => createWidgetLayout(input as unknown as WidgetLayoutInput), code)
  })
})
