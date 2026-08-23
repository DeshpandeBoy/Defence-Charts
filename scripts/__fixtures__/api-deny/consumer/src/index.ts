/**
 * The cross-package half of the same violation, and the one that motivated the origin rule.
 *
 * `@fixture/deny-api` is a declared dependency, so a consumer can import from it — but
 * `SeriesStyle` is not on *its* barrel, so reaching past the barrel to name it here
 * publishes a type no consumer can reach. The dependency being declared is what makes this
 * distinct from the same-package case: the fix is on the other package, not this one.
 *
 * ⚠ Relative, not `@fixture/deny-api`. A fixture that needed a real `node_modules` link
 * would be testing pnpm, not this gate; the origin rule works on the declaring file's path,
 * so the specifier that got there is irrelevant to what is being exercised.
 */
import type { SeriesStyle } from '../../surface/src/props.ts'

export type PanelProps = {
  readonly style: SeriesStyle
}
