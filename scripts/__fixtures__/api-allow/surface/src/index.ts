/**
 * ⚠ `RAW_ADVANCES` still exists in `metrics.generated.ts` and is deliberately absent here.
 * The generated-module rule is about the *barrel*, not the module: a generated file may
 * hold whatever the generator emits, and the one symbol on the allowlist is the only part
 * of it anyone promised to keep.
 */

export type { ChartProps, Nullable, SeriesStyle } from './props.ts'
export { render } from './props.ts'
export { ROBOTO_FLEX_METRICS } from './metrics.generated.ts'
