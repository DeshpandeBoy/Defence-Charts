import { describe, expect, it } from 'vitest'

import {
  GRID_COLUMNS,
  LAYOUT_SCHEMA_VERSION,
  LayoutValidationError,
  createLayoutSnapshot,
  createWidgetId,
  createWidgetLayout,
  parseLayoutSnapshot,
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

  it('rejects unsupported versions, profiles, malformed JSON, and missing items', () => {
    expectCode(() => parseLayoutSnapshot('{'), 'invalid-snapshot')
    expectCode(() => parseLayoutSnapshot({ version: 2, columns: 12, items: [] }), 'unsupported-version')
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
