/**
 * The origin rule's allow direction: a type this package neither declares nor re-exports,
 * and is right not to. `@shiftcharts/primitives` is this shape at scale — every field of its
 * `ChartProps` is a `@shiftcharts/core` type, and demanding it re-export all thirty-five would be
 * thirty-five reports about nothing.
 */
import type { ChartProps } from '../../surface/src/props.ts'

export type PanelProps = {
  readonly chart: ChartProps
}
