import { clampToZero } from './shared.ts'

export function lineChart(points: number): string {
  return `line:${clampToZero(points)}`
}
