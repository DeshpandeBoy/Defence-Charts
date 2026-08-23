/**
 * The planted violation, in the position it actually happens: a prop type.
 *
 * ⚠ `export`ed from this module and absent from the barrel — which is the realistic shape
 * of the bug, not a contrived one. Every file in the package can import it, so nothing
 * inside the repo notices. From outside, `style` is a prop a consumer can pass and cannot
 * name. A version of this fixture that omitted the `export` failed for the wrong reason:
 * TypeScript itself rejected the cross-package import, so the gate never got to speak.
 */
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
 * ⚠ The two exclusions, planted so the deny fixture also proves they hold.
 *
 * `Nullable` is a conditional type and `Widen` is only ever an operand of it — type-level
 * computation, never a name a consumer writes. `LOCAL_SCALE` is a body-local annotation.
 * A gate that flags either has stopped describing the public surface.
 */
type Widen<T> = T extends number ? number : T
export type Nullable<T> = null extends T ? Widen<T> | null : Widen<T>

type BodyLocal = { readonly k: number }

export function render(props: ChartProps): string {
  const local: BodyLocal = { k: props.labels.length }
  return String(local.k + props.style.width)
}

export function renderInternal(props: ChartProps): string {
  return render(props)
}
