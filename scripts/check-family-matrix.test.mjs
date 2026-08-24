import {
  describeShape,
  planChart,
  sizeContextFromPixels,
} from '../packages/core/src/index.ts'
import { describe, expect, it } from 'vitest'

import {
  FAMILY_MATRIX,
  FAMILY_STATES,
  FAMILY_TYPES,
  MATRIX_DATA,
  MATRIX_SERIES_IDS,
  RESIZE_BOUNDARIES,
  identitySignature,
  metadataForPlan,
  planForRow,
} from '../apps/playground/src/family-matrix/matrix.ts'

describe('D0.2 shared line and area family matrix', () => {
  it('covers both families across all six information budgets', () => {
    expect(FAMILY_TYPES).toEqual(['line', 'area'])
    expect(FAMILY_MATRIX.map((row) => row.id)).toEqual([
      'micro',
      'tile',
      'strip',
      'panel',
      'canvas',
      'stage',
    ])

    for (const type of FAMILY_TYPES) {
      for (const row of FAMILY_MATRIX) {
        const plan = planForRow(type, row)
        const expected = {
          ...row.expected,
          area: row.expected.primary === 'line' && type === 'area' ? true : row.expected.area,
        }
        expect(metadataForPlan(plan), type + '/' + row.id).toMatchObject(expected)
        expect(JSON.parse(JSON.stringify(plan)), type + '/' + row.id + ' JSON').toEqual(plan)
      }
    }
  })

  it('covers normal, empty, and host-owned error fixtures', () => {
    expect(FAMILY_STATES).toEqual(['normal', 'empty', 'error'])
    expect(describeShape(MATRIX_DATA).series).toBe(6)
    expect(describeShape([]).series).toBe(0)
  })

  it('proves the one-pixel size boundaries from the pure resolver', () => {
    for (const boundary of RESIZE_BOUNDARIES) {
      for (const sample of [boundary.before, boundary.at, boundary.after]) {
        expect(sizeContextFromPixels(sample.width, sample.height).sizeClass, boundary.id).toBe(sample.sizeClass)
      }
    }

    const upward = RESIZE_BOUNDARIES.map((boundary) =>
      sizeContextFromPixels(boundary.at.width, boundary.at.height).sizeClass,
    )
    expect(upward).toEqual(['tile', 'strip', 'panel', 'canvas', 'stage'])
  })

  it('keeps stable series identity independent of family and resize context', () => {
    const identity = identitySignature()
    expect(identity).toBe(MATRIX_SERIES_IDS.join('|'))

    for (const type of FAMILY_TYPES) {
      for (const row of FAMILY_MATRIX) {
        expect(identitySignature(MATRIX_DATA)).toBe(identity)
        expect(planForRow(type, row).type).toBe(type)
      }
    }
  })

  it('keeps the shared definition honest about data-blind planning', () => {
    const shape = describeShape(MATRIX_DATA)
    const plan = planChart('line', FAMILY_MATRIX[5].ctx, shape)
    expect(plan.type).toBe('line')
    expect(Object.keys(plan).sort()).toEqual([
      'aggregate',
      'axes',
      'dataTable',
      'interaction',
      'labels',
      'legend',
      'marks',
      'motion',
      'narrative',
      'orientation',
      'regionOrder',
      'sizeClass',
      'type',
      'valueLegibility',
    ])
  })
})
