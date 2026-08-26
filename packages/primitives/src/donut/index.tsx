import { ChartView, type ChartProps } from '../Chart.tsx'
import { DONUT_MARK_RENDERERS } from '../families/donut/renderer.tsx'
import { renderRegisteredMark } from '../renderer-seam.ts'

const renderDonutMark = (input: Parameters<typeof renderRegisteredMark>[1]) =>
  renderRegisteredMark(DONUT_MARK_RENDERERS, input)

export type DonutChartProps = ChartProps

/** A tree-shakeable entrypoint for donut plans. */
export function DonutChart(props: DonutChartProps) {
  return <ChartView {...props} renderMark={renderDonutMark} />
}
