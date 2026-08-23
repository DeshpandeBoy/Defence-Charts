import { clampToZero } from './shared.ts'

export function barChart(points: number): string {
  return `bar:${clampToZero(points)}`
}
