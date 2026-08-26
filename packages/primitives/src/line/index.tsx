import { ChartView, type ChartProps } from '../Chart.tsx'
import { LINE_MARK_RENDERERS } from '../families/line/renderer.tsx'
import { renderRegisteredMark } from '../renderer-seam.ts'

const renderLineMark = (input: Parameters<typeof renderRegisteredMark>[1]) =>
  renderRegisteredMark(LINE_MARK_RENDERERS, input)

export type LineChartProps = ChartProps

/** A tree-shakeable entrypoint for line and area plans. */
export function LineChart(props: LineChartProps) {
  return <ChartView {...props} renderMark={renderLineMark} />
}
