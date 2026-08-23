/**
 * `@gx/tokens` — the TypeScript face of `theme.css`.
 *
 * ⚠ A1 scope. At **B1** this file is *generated* from the CSS, and a build-time check
 * asserts that every authored `var(--gx-*)` is a member of the generated set. Hand-
 * maintaining it past that point reintroduces the drift the generator exists to remove.
 */

/** Every `--gx-*` custom property the A1 skeleton theme defines. */
export const GX_TOKENS = [
  'ground',
  'series-1',
  'series-2',
  'series-3',
  'series-4',
  'series-5',
  'series-6',
  'charcoal-100',
  'charcoal-200',
  'charcoal-300',
  'charcoal-400',
  'charcoal-500',
  'charcoal-600',
  'charcoal-700',
  'charcoal-800',
  'charcoal-900',
  'ink',
  'grid-color',
  'grid-alpha',
  'axis-color',
  'corner-radius',
  'elevation-raised',
  'elevation-overlay',
  'font-family',
  'font-feature-settings',
  'font-stretch',
  'font-optical-sizing',
  'numeric-variant',
  'title-font-size',
  'title-font-weight',
  'title-letter-spacing',
  'subtitle-font-size',
  'subtitle-font-weight',
  'subtitle-letter-spacing',
  'axis-title-font-size',
  'axis-title-font-weight',
  'axis-title-letter-spacing',
  'legend-label-font-size',
  'legend-label-font-weight',
  'legend-label-letter-spacing',
  'label-font-size',
  'label-font-weight',
  'label-letter-spacing',
  'label-font-size-min',
  'label-landmark-grade',
  'value-label-font-size',
  'value-label-font-weight',
  'value-label-letter-spacing',
  'annotation-font-size',
  'annotation-font-weight',
  'annotation-letter-spacing',
  'crosshair-label-font-size',
  'crosshair-label-font-weight',
  'crosshair-label-letter-spacing',
  'label-line-spacing',
  'gap',
  'plot-padding',
  // Marks. Added at A4 with @gx/primitives; see the note in theme.css for why these are
  // tokens while core's layout constants are not.
  'line-width',
  'point-radius',
  'area-alpha',
  'band-alpha',
  'series-color',
] as const

export type GxTokenName = (typeof GX_TOKENS)[number]

/**
 * The full custom-property spelling, e.g. `--gx-series-1`.
 *
 * ⚠ The `--gx-` prefix appears here as a template-literal type and once more in the
 * generator. `raw/06` §6.0 verified those are the only two places it is not simply the
 * first path segment, which is what makes the eventual rename cheap.
 */
export type GxCustomProperty = `--gx-${GxTokenName}`

export const toCustomProperty = (name: GxTokenName): GxCustomProperty => `--gx-${name}`

/** The four shipping theme combinations: {Rail} × {dark, light}, plus the OS default. */
export const GX_THEMES = ['rail-dark', 'rail-light'] as const

export type GxTheme = (typeof GX_THEMES)[number]
