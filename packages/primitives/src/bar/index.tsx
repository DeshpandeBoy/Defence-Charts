import { ChartView, type ChartProps } from '../Chart.tsx'
import { BAR_MARK_RENDERERS } from '../families/bar/renderer.tsx'
import { renderRegisteredMark } from '../renderer-seam.ts'

const renderBarMark = (input: Parameters<typeof renderRegisteredMark>[1]) =>
  renderRegisteredMark(BAR_MARK_RENDERERS, input)

export type BarChartProps = ChartProps

/** A tree-shakeable entrypoint for bar and timebar plans. */
export function BarChart(props: BarChartProps) {
  return <ChartView {...props} renderMark={renderBarMark} />
}
