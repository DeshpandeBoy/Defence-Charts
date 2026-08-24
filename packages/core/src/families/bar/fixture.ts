import type { DataShape } from '../../context.ts'
import type { SizeClass } from '../../plan.ts'

export type BarFamilyFixture = {
  readonly type: 'bar' | 'timebar'
  readonly sizeClass: SizeClass
  readonly shape: DataShape
}

export const BAR_FAMILY_FIXTURE: BarFamilyFixture = Object.freeze({
  type: 'bar',
  sizeClass: 'panel',
  shape: Object.freeze({
    series: 2,
    categories: 3,
    points: 6,
    hasNegative: true,
    labelMaxChars: 12,
    temporal: false,
  }),
})
