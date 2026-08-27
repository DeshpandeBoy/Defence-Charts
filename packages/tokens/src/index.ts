/**
 * `@shiftcharts/tokens` — the TypeScript face of the theme.
 *
 * ⚠ **The direction reversed at B1, and the docblock this replaces had it backwards.** It
 * said this file would be *"generated from the CSS"*. What actually generates is the CSS:
 * `./tokens.ts` is the source, `scripts/generate-tokens-css.mjs` emits `./themes/theme.css`
 * from it, and `30-implementation-plan.md` §B1 asks for exactly that — *"author in TypeScript,
 * generate CSS"*. The deciding argument is the `tier` field, which has no slot in a CSS
 * declaration and is therefore uncheckable in a stylesheet.
 *
 * The name list below is the one thing that genuinely is read back off the CSS, because it has
 * to span the *other* generator too. See `./tokens.generated.ts`.
 */

/**
 * Every `--shiftcharts-*` custom property the shipped themes declare.
 *
 * ⚠ **Generated, and it had to become generated.** Hand-maintained, this array reached B1
 * missing all seven A6 motion tokens — live in `theme.css`, referenced by `chart.css`,
 * asserted by gate G19, and absent from the list that claims to be *every* token. Nothing
 * failed, because nothing compared the two. `pnpm lint:tokens` now does, in both directions:
 * G7's membership rule rejects a `var(--shiftcharts-*)` naming a token that does not exist, and
 * `pnpm lint:tokens:drift` rejects a list that has fallen behind the stylesheet.
 */
export { SHIFTCHARTS_TOKENS } from './tokens.generated.ts'
export { TOKEN_GROUPS, type Token, type TokenGroup } from './tokens.ts'

// ⚠ `import type` even though `SHIFTCHARTS_TOKENS` is a value: it is used here only inside a
// `typeof` query, so the binding is erased. A plain import would be a second runtime
// reference to the generated module and would defeat gate G5 — importing one token name
// would pull the whole list into a consumer's bundle.
import type { SHIFTCHARTS_TOKENS } from './tokens.generated.ts'

export type ShiftChartsTokenName = (typeof SHIFTCHARTS_TOKENS)[number]

/**
 * The full custom-property spelling, e.g. `--shiftcharts-series-1`.
 *
 * ⚠ The `--shiftcharts-` prefix appears here as a template-literal type and once more in the
 * generator. `raw/06` §6.0 verified those are the only two places it is not simply the
 * first path segment, which is what makes the eventual rename cheap.
 */
export type ShiftChartsCustomProperty = `--shiftcharts-${ShiftChartsTokenName}`

export const toCustomProperty = (name: ShiftChartsTokenName): ShiftChartsCustomProperty => `--shiftcharts-${name}`

/**
 * The four shipping theme combinations: {Rail, Neutral} × {dark, light}.
 *
 * ⚠ **Not derived from `THEME_VARIANTS`, and the asymmetry is intentional.**
 * `rail-dark` has no entry there because it *is* `:where(:root)` — the default world needs no
 * override block. `THEME_VARIANTS` holds the deltas; this holds the four selectable worlds.
 */
export const SHIFTCHARTS_THEMES = ['rail-dark', 'rail-light', 'neutral', 'neutral-light'] as const

export type ShiftChartsTheme = (typeof SHIFTCHARTS_THEMES)[number]
