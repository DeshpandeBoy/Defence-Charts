/** The deny fixture with its three violations fixed and nothing else changed. */

export type SeriesStyle = {
  readonly width: number
}

/** ⚠ `ReadonlyArray` and `Date` are lib types. Neither is this package's to export. */
export type ChartProps = {
  readonly style: SeriesStyle
  readonly labels: ReadonlyArray<string>
  readonly asOf: Date
}

/**
 * ⚠ The two exclusions, kept identical to the deny fixture so the pair isolates one
 * variable. `Widen` is only ever an operand of the conditional type `Nullable` — type-level
 * computation, never a name a consumer writes. `BodyLocal` is a body-local annotation.
 * Neither is exported here, and the gate must stay quiet about both; if it ever stops, the
 * deny direction is passing for a reason unrelated to the rule.
 */
type Widen<T> = T extends number ? number : T
export type Nullable<T> = null extends T ? Widen<T> | null : Widen<T>

type BodyLocal = { readonly k: number }

export function render(props: ChartProps): string {
  const local: BodyLocal = { k: props.labels.length }
  return String(local.k + props.style.width)
}
