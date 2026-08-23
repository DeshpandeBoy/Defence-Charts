export function clampToZero(points: number): number {
  return points < 0 ? 0 : points
}

export function barChart(points: number): string {
  return `bar:${clampToZero(points)}`
}
