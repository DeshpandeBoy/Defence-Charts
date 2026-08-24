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
  dataForType,
  identitySignature,
  metadataForPlan,
  planForRow,
} from '../apps/playground/src/family-matrix/matrix.ts'

describe('shared line, area, bar, timebar, scatter, and donut family matrix', () => {
  it('covers all six registered families across all six information budgets', () => {
    expect(FAMILY_TYPES).toEqual(['line', 'area', 'bar', 'timebar', 'scatter', 'donut'])
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
          primary:
            type === 'bar' || type === 'timebar'
              ? row.id === 'micro'
                ? 'none'
                : 'bar'
              : type === 'scatter'
                ? row.id === 'micro'
                  ? 'none'
                  : 'point'
                : type === 'donut'
                  ? row.id === 'micro'
                    ? 'none'
                    : 'arc'
                  : row.expected.primary,
          area:
            type === 'area' && row.expected.primary === 'line'
              ? true
              : type === 'bar' || type === 'timebar' || type === 'scatter' || type === 'donut'
                ? null
                : row.expected.area,
          valueLegibility:
            type === 'donut' ? (row.id === 'micro' ? 'single-value' : 'shape-only') : row.expected.valueLegibility,
          regions:
            type === 'donut'
              ? row.id === 'micro'
                ? ['value', 'table']
                : row.id === 'canvas' || row.id === 'stage'
                  ? ['plot', 'legend', 'table']
                  : ['plot', 'table']
              : row.expected.regions,
          legend:
            type === 'donut'
              ? row.id === 'panel'
                ? 'internal'
                : row.id === 'canvas' || row.id === 'stage'
                  ? 'external'
                  : 'absent'
              : row.expected.legend,
          y2: type === 'donut' ? false : row.expected.y2,
          facet: type === 'donut' ? 'none' : row.expected.facet,
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
        expect(dataForType(type).length).toBe(type === 'donut' ? 1 : MATRIX_DATA.length)
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
