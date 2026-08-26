/**
 * Gate **G14** — the element-set snapshot, and the `<line>` ban it exists to enforce.
 *
 * ⚠ **G7 structurally cannot catch what this catches.** The token gate parses stylesheets and
 * asserts that a `var()` was used; it has no way to know whether the property that `var()`
 * lands on *exists* on the element it targets. `line { y2: var(--shiftcharts-tick-length) }` parses,
 * passes G7, builds, warns about nothing, and does nothing —
 * `research/decisions/012-no-line-element-for-tokened-geometry.md` has the SVG2 property table
 * and the element census (Vega ships 28 `<line>` elements, Observable Plot ships 0). The only
 * place that failure is visible is in the rendered markup, which is here.
 *
 * ⚠ **And the zero-client-JS proof.** `renderToStaticMarkup` at `environment: 'node'` is
 * decision 7 stated as an assertion: if any primitive reaches for a ref, an effect, or
 * `document`, it fails on this line rather than in a consumer's RSC page six months later. It
 * does not prove a *bundler* cannot break it — that is gate G4, deferred with the Next.js
 * fixture — but it is the half that costs nothing and catches the common case.
 *
 * ⚠ No DOM environment. The markup is a string and `parseElements()` reads it with a regex,
 * deliberately: this file therefore never needs the Vitest environment directive, and
 * **G16's hazard cannot arise** — prose about that directive silently switches the file's
 * environment, and the safest prose is prose that never names it.
 */

import {
  applyOverrides,
  type ChartPlan,
  describeShape,
  planChart,
  type PlanPolicy,
  type Series,
  sizeContextFromPixels,
} from '@shiftcharts/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Chart } from './Chart.tsx'

// --- Fixtures ----------------------------------------------------------------------------

/** Deterministic, and deliberately not random: a seeded generator is still a generator, and a
 * snapshot that moves when the seed changes is a snapshot nobody trusts. */
const DAY = 86_400_000
const START = Date.UTC(2024, 0, 1)

function series(id: string, values: readonly (number | null)[]): Series {
  return {
    id,
    label: id.toUpperCase(),
    points: values.map((y, i) => ({ x: new Date(START + i * DAY), y })),
  }
}

const THREE: readonly Series[] = [
  series('alpha', [10, 14, 9, 22, 18, 30, 27]),
  series('beta', [4, 6, 5, 9, 7, 11, 12]),
  series('gamma', [-2, 1, -5, 3, 0, 6, 4]),
]

const ONE: readonly Series[] = [series('alpha', [10, 14, 9, 22, 18, 30, 27])]

function render(
  width: number,
  height: number,
  data: readonly Series[] = THREE,
  policy?: Partial<PlanPolicy>,
): string {
  const ctx = sizeContextFromPixels(width, height)
  const plan = planChart('line', ctx, describeShape(data), policy)
  return renderToStaticMarkup(
    <Chart plan={plan} data={data} ctx={ctx} title="Test chart" id="t" policy={policy} />,
  )
}

// --- The element census ------------------------------------------------------------------

type Element = { readonly tag: string; readonly attrs: Record<string, string> }

/**
 * Every element in the markup, as `{tag, attrs}`.
 *
 * ⚠ A regex and not a parser, because the *input* is a parser's output. `renderToStaticMarkup`
 * emits normalised, quoted, self-closing markup with no comments and no CDATA, so the class of
 * inputs a real parser exists to survive cannot occur here. Reaching for jsdom would import a
 * DOM into a file whose whole point is that it does not have one.
 */
function parseElements(html: string): readonly Element[] {
  const out: Element[] = []
  for (const m of html.matchAll(/<([a-zA-Z][\w-]*)((?:\s+[\w:-]+="[^"]*")*)\s*\/?>/g)) {
    const attrs: Record<string, string> = {}
    for (const a of (m[2] ?? '').matchAll(/([\w:-]+)="([^"]*)"/g)) {
      attrs[a[1] ?? ''] = a[2] ?? ''
    }
    out.push({ tag: m[1] ?? '', attrs })
  }
  return out
}

/** The sorted multiset of `tag.class` pairs — what a structural change actually moves. */
function elementSet(html: string): readonly string[] {
  const counts = new Map<string, number>()
  for (const el of parseElements(html)) {
    const key = el.attrs['class'] === undefined ? el.tag : `${el.tag}.${el.attrs['class']}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${n}× ${k}`)
}

// --- The ladder, measured rather than asserted in a title ---------------------------------

/**
 * ⚠ **Every row here is checked against the resolver by the first test below, and that check
 * exists because this table used to lie.** An earlier draft swept `[60,24] [180,40] [320,90]
 * [520,260] [900,520] [1400,760]` and named them Micro / Tile / … / Stage. Three of the six
 * were `micro`; `520×260` was `strip`, not Panel; and the snapshot titled *"at Tile, where
 * the mark is not a line"* was rendering a rung whose mark is `'none'` — so a sweep that
 * claimed to cover the whole ladder tested one rung three times and demonstrated horizon
 * bands nowhere.
 *
 * A test name is a claim about what is being exercised. Left unchecked it is the cheapest
 * possible lie, because it stays green while it rots.
 */
const RUNGS = [
  { name: 'Micro', w: 60, h: 24, sizeClass: 'micro', mark: 'none' },
  // Both of Tile's mark states. The horizon window is narrow — `tileMark()` substitutes only
  // between `horizonMinHeight` and `plotHeightOptimal` — and it is the one rung where the
  // encoding changes rather than the chrome, so it is worth two rows.
  { name: 'Tile-horizon', w: 240, h: 44, sizeClass: 'tile', mark: 'horizon' },
  { name: 'Tile-line', w: 240, h: 80, sizeClass: 'tile', mark: 'line' },
  { name: 'Strip', w: 420, h: 140, sizeClass: 'strip', mark: 'line' },
  { name: 'Panel', w: 520, h: 360, sizeClass: 'panel', mark: 'line' },
  { name: 'Canvas', w: 700, h: 520, sizeClass: 'canvas', mark: 'line' },
  { name: 'Stage', w: 1000, h: 700, sizeClass: 'stage', mark: 'line' },
] as const

describe('the sweep covers the ladder it says it covers', () => {
  it.each(RUNGS)('$name at $w×$h really is $sizeClass with a $mark mark', (rung) => {
    const plan = planChart('line', sizeContextFromPixels(rung.w, rung.h), describeShape(THREE))
    expect({ sizeClass: plan.sizeClass, mark: plan.marks.primary.kind }).toEqual({
      sizeClass: rung.sizeClass,
      mark: rung.mark,
    })
  })

  it('reaches all six families', () => {
    expect(new Set(RUNGS.map((r) => r.sizeClass)).size).toBe(6)
  })
})

describe('gate G14: no <line> carries tokened geometry', () => {
  /**
   * Swept, not sampled. A single size proves one rung; the ban has to hold at every rung,
   * including the ones where the axes vanish and the mark becomes a horizon.
   */
  it.each(RUNGS)('$name emits no <line> with x1/y1/x2/y2', (rung) => {
    const offenders = parseElements(render(rung.w, rung.h)).filter(
      (el) =>
        el.tag === 'line' &&
        (['x1', 'y1', 'x2', 'y2'] as const).some((a) => el.attrs[a] !== undefined),
    )
    expect(offenders).toEqual([])
  })

  it('emits no <line> element at all, at any rung', () => {
    for (const rung of RUNGS) {
      expect(parseElements(render(rung.w, rung.h)).filter((el) => el.tag === 'line')).toEqual([])
    }
  })

  /**
   * ⚠ The positive half. "No `<line>`" is satisfied by rendering nothing, so the ban is only
   * meaningful next to an assertion that the geometry it forbids is being drawn *some other
   * way*. Ticks are `<rect>`s with a real width and height.
   */
  it('draws ticks as <rect> with non-zero extent', () => {
    const ticks = parseElements(render(1000, 700)).filter(
      (el) => el.attrs['class'] === 'shiftcharts-axis__tick-mark',
    )
    expect(ticks.length).toBeGreaterThan(0)
    for (const t of ticks) {
      expect(t.tag).toBe('rect')
      expect(Number(t.attrs['width'])).toBeGreaterThan(0)
      expect(Number(t.attrs['height'])).toBeGreaterThan(0)
    }
  })

  it('passes the resolved policy geometry through to the primitives', () => {
    const html = render(1000, 700, THREE, {
      tickLength: 17,
      tickLabelGap: 9,
      axisRuleWidth: 3,
    })
    const ticks = parseElements(html).filter(
      (el) => el.attrs['class'] === 'shiftcharts-axis__tick-mark',
    )

    expect(ticks.some((tick) => tick.attrs.width === '3' && tick.attrs.height === '17')).toBe(true)
    expect(ticks.some((tick) => tick.attrs.width === '17' && tick.attrs.height === '3')).toBe(true)
  })

  /**
   * ⚠ And the positive half for the horizon rung specifically, which the old sweep never
   * reached. Bands are `<path>`, so the `<line>` ban is trivially satisfied there — the
   * assertion that means something is that bands are *drawn*, and that each carries the
   * `data-band` index the CSS opacity ramp reads. A horizon whose bands all render at one
   * opacity is a horizon chart that cannot be read, and it looks fine.
   */
  it('draws the horizon rung as banded <path>, not as nothing', () => {
    const bands = parseElements(render(240, 44)).filter((el) =>
      (el.attrs['class'] ?? '').includes('shiftcharts-band'),
    )
    expect(bands.length).toBeGreaterThan(0)
    for (const b of bands) {
      expect(b.tag).toBe('path')
      expect(b.attrs['data-band']).toMatch(/^\d+$/)
      expect(b.attrs['d'] ?? '').not.toBe('')
    }
  })
})

describe('gate G14: the element set', () => {
  /**
   * ⚠ Snapshots and not hand-written counts, so that a diff in review shows what moved rather
   * than a path that changed. The numbers are the contract: if a refactor adds a wrapper `<g>`,
   * this is where it is noticed, and the reviewer decides whether the wrapper was wanted.
   *
   * One per rung, driven off the same table as the sweep — so a rung can never be snapshotted
   * under a name the resolver disagrees with.
   */
  it.each(RUNGS)('$name', (rung) => {
    expect(elementSet(render(rung.w, rung.h))).toMatchSnapshot()
  })
})

describe('zero client JS', () => {
  it('renders to a static string with no DOM present', () => {
    // ⚠ `globalThis.document` being absent is the precondition, not an incidental. Asserting
    // it makes the test fail loudly if someone adds a DOM environment to this file later,
    // rather than silently weakening every assertion below it.
    expect((globalThis as { document?: unknown }).document).toBeUndefined()

    const html = render(900, 520)
    expect(html).toContain('<svg')
    expect(html).toContain('role="graphics-document"')
    expect(html).toContain('<path')
  })

  it('puts the disclosure in <details>, which needs no script', () => {
    const html = render(1400, 760)
    if (!html.includes('<details')) return
    expect(html).toContain('<summary')
    expect(html).not.toContain('onclick')
  })
})

describe('accessibility structure', () => {
  /**
   * ⚠ **The single most important assertion in this file.** `role="img"` is Children
   * Presentational: True — it erases every descendant from the accessibility tree, including
   * the `<title>` the graphics roles exist to expose. The chart still looks perfect. Every
   * geometry test above still passes. `research/20-architecture.md` §7.3.
   */
  it('never uses role="img" on the svg', () => {
    for (const rung of RUNGS) {
      const html = render(rung.w, rung.h)
      expect(html).not.toContain('role="img"')
      expect(html).toContain('role="graphics-document"')
    }
  })

  it('names the graphic through a <title> the svg points at', () => {
    const html = render(520, 260)
    expect(html).toContain('aria-labelledby="t-title"')
    expect(html).toContain('<title id="t-title">Test chart</title>')
  })

  it('keeps the data table outside the svg', () => {
    const html = render(1400, 760)
    if (!html.includes('<table')) return
    const svgEnd = html.indexOf('</svg>')
    expect(svgEnd).toBeGreaterThan(-1)
    expect(html.indexOf('<table')).toBeGreaterThan(svgEnd)
    expect(html).toContain('<figcaption')
  })

  it.each(RUNGS)('names each series inside the static SVG at $name', (rung) => {
    const html = render(rung.w, rung.h)
    expect(html).toContain('<title>ALPHA</title>')
    expect(html).toContain('<title>BETA</title>')
    expect(html).toContain('<title>GAMMA</title>')
  })
})

describe('compact information structure', () => {
  it('gives Tile a visible identity key for every plotted series', () => {
    const html = render(240, 80)
    const keyEntries = parseElements(html).filter(
      (el) => el.attrs['class'] === 'shiftcharts-compact-key__entry',
    )
    const key = parseElements(html).find((el) => el.attrs['class'] === 'shiftcharts-compact-key')
    const plot = parseElements(html).find((el) => el.attrs['class'] === 'shiftcharts-compact-plot')

    expect(key?.attrs['data-legend-source']).toBe('fallback')
    expect(keyEntries.map((entry) => entry.attrs['data-series-id'])).toEqual([
      'alpha',
      'beta',
      'gamma',
    ])
    expect(keyEntries.every((entry) => entry.attrs['role'] === 'listitem')).toBe(true)
    expect(Number(key?.attrs['data-legend-rail-height'])).toBeGreaterThan(0)
    expect(plot?.attrs.transform).toMatch(/translate\(0 [\d.]+\) scale\(1 0\.[\d]+\)/)
    expect(html.indexOf('class="shiftcharts-compact-key"')).toBeGreaterThan(
      html.indexOf('class="shiftcharts-compact-plot"'),
    )
  })

  it('moves Strip geometry below its SVG identity rail instead of overlaying HTML labels', () => {
    const html = render(400, 200)
    const key = parseElements(html).find((el) => el.attrs['class'] === 'shiftcharts-compact-key')
    const plot = parseElements(html).find((el) => el.attrs['class'] === 'shiftcharts-compact-plot')

    expect(key?.attrs['data-legend-placement']).toBe('internal')
    expect(key?.attrs['data-legend-source']).toBe('core')
    expect(Number(key?.attrs['data-legend-rail-height'])).toBeGreaterThan(0)
    expect(html).not.toContain('shiftcharts-legend--internal')
    expect(plot).toBeUndefined()
    expect(parseElements(html).filter((el) => el.attrs['class'] === 'shiftcharts-compact-key__label')).toHaveLength(3)
  })

  it('does not add a plot identity rail to Micro, where the value reading is the chart', () => {
    const html = render(60, 24)
    expect(html).not.toContain('shiftcharts-compact-key')
    expect(html).toContain('shiftcharts-value__metric')
  })
})

describe('determinism', () => {
  it('renders character-identical markup twice', () => {
    expect(render(900, 520)).toBe(render(900, 520))
  })

  /**
   * ⚠ Two decimals, everywhere, and this is what makes the snapshots above stable rather than
   * lucky. `frame.ts` pins d3-shape's `.digits(2)` and `svg.ts` rounds transforms to match; a
   * third decimal anywhere means one of the two was bypassed.
   */
  /**
   * ⚠ Scoped to the attributes that carry *geometry*, and `data-value` is deliberately not one
   * of them. A tick's domain value is an ISO timestamp whose milliseconds field is three digits
   * by definition; a rule that rejected it would be rejecting `2024-01-01T00:00:00.000Z` for
   * being correct. The first draft of this test did exactly that, and the lesson is worth the
   * comment: "no more than two decimals" is a claim about coordinates, and the assertion has to
   * say which attributes are coordinates or it is asserting something else.
   */
  const GEOMETRY_ATTRS = ['d', 'x', 'y', 'cx', 'cy', 'width', 'height', 'transform', 'viewBox']

  it('emits no coordinate with more than two decimal places', () => {
    const html = render(900, 520)
    // Collected with the attribute attached rather than asserted one at a time. A bare
    // `expected 3 to be <= 2` names the symptom and hides the attribute, and the attribute is
    // the only part anyone can act on.
    const pattern = new RegExp(`(?:${GEOMETRY_ATTRS.join('|')})="[^"]*\\d+\\.\\d{3,}[^"]*"`, 'g')
    expect([...html.matchAll(pattern)].map((m) => m[0])).toEqual([])
  })

  /**
   * ⚠ The tick's domain value is a UTC ISO string, and the `Z` is the assertion. `frame.ts`
   * keeps `ComputedTick.value` serialisable so a plan built on a server survives the RSC
   * boundary; a local-time spelling would survive it too, and would differ between the server
   * that rendered it and the browser that hydrated it. That mismatch arrives as a React
   * hydration warning about text content, six frames away, never mentioning a timezone.
   */
  it('spells tick domain values in UTC', () => {
    const values = [...render(900, 520).matchAll(/data-value="([^"]*)"/g)].map((m) => m[1])
    expect(values.length).toBeGreaterThan(0)
    for (const v of values) expect(v).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$|^-?[\d.]+$/)
  })

  it('emits no NaN', () => {
    for (const [w, h] of [
      [0, 0],
      [1, 1],
      [900, 520],
    ] as const) {
      expect(render(w, h)).not.toContain('NaN')
    }
  })
})

describe('the plan is obeyed, not approximated', () => {
  it('draws one <g class="shiftcharts-series"> per series, in index order', () => {
    const groups = parseElements(render(900, 520)).filter(
      (el) => el.attrs['class'] === 'shiftcharts-series',
    )
    expect(groups.map((g) => g.attrs['data-series-id'])).toEqual(['alpha', 'beta', 'gamma'])
    expect(groups.map((g) => g.attrs['data-series-index'])).toEqual(['0', '1', '2'])
  })

  /**
   * ⚠ An override, because it is the only way to reach a mark kind the ladder will not hand
   * out at a size this file can render. `applyOverrides` forces the value *after* resolution,
   * which is decision 8's whole point — the renderer must obey a forced plan exactly as it
   * obeys a resolved one, or overrides are advisory.
   */
  it('throws for a heatmap cell forced into the wrong family plan', () => {
    const ctx = sizeContextFromPixels(900, 520)
    const base = planChart('line', ctx, describeShape(ONE))
    const forced: ChartPlan = applyOverrides(base, {
      marks: { primary: { kind: 'cell', bandStart: 0, bandEnd: 1 } },
    })
    expect(() =>
      renderToStaticMarkup(
        <Chart plan={forced} data={ONE} ctx={ctx} title="Forced" id="t" />,
      ),
    ).toThrow(/heatmap renderer requires a heatmap plan/)
  })

  it('honours axes.x.visible', () => {
    const ctx = sizeContextFromPixels(900, 520)
    const base = planChart('line', ctx, describeShape(THREE))
    const hidden = applyOverrides(base, { axes: { x: { visible: false } } })
    const html = renderToStaticMarkup(
      <Chart plan={hidden} data={THREE} ctx={ctx} title="No x" id="t" />,
    )
    expect(html).not.toContain('shiftcharts-axis--x')
    expect(html).toContain('shiftcharts-axis--y')
  })

  it('wires B2 axis and guide controls into rendered SVG', () => {
    const ctx = sizeContextFromPixels(900, 520)
    const base = planChart('line', ctx, describeShape(THREE))
    const forced = applyOverrides(base, {
      axes: {
        x: {
          labelFlush: true,
          labelBound: true,
          tickBand: 'extent',
          translate: 0.5,
        },
        y: { labelBound: true, strokeCap: 'round', dashPhase: 3 },
      },
      labels: { labelHalo: 'dark' },
    })
    const html = renderToStaticMarkup(
      <Chart plan={forced} data={THREE} ctx={ctx} title="B2" id="b2" />,
    )

    expect(html).toContain('data-tick-band="extent"')
    expect(html).toContain('data-label-bound=""')
    expect(html).toContain('<clipPath id="b2-axis-x-bound"')
    expect(html).toContain('clip-path="url(#b2-axis-x-bound)"')
    expect(html).toContain('data-dash-phase="3"')
    expect(html).toContain('data-stroke-cap="round"')
    expect(html).toContain('--shiftcharts-grid-dash-offset:3')
    expect(html).toContain('--shiftcharts-grid-cap:round')
    expect(html).toContain('data-halo="dark"')
  })
})

describe('degenerate input', () => {
  it('renders a figure for a zero-sized box', () => {
    const html = render(0, 0)
    expect(html).toContain('<figure')
    expect(html).toContain('viewBox="0 0 0 0"')
  })

  it('renders a figure for no series at all', () => {
    const html = render(900, 520, [])
    expect(html).toContain('<svg')
    expect(html).not.toContain('shiftcharts-series')
  })

  it('renders a single flat series without a NaN or an empty path', () => {
    const flat: readonly Series[] = [series('flat', [5, 5, 5, 5])]
    const html = render(900, 520, flat)
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('d=""')
  })
})

describe('the motion plan reaches the DOM', () => {
  /**
   * ⚠ **Until A6 this was the only field in `ChartPlan` that nothing read.** The resolver
   * computed `motion` on every plan, the snapshots asserted it, and no renderer consumed it —
   * so the durations and the staging were, in the literal sense, decoration. These attributes
   * are the whole of the wiring: `chart.css` maps them to a duration token and a stage delay,
   * and the transitions themselves sit behind the reduced-motion query, which no test in a
   * node environment can evaluate. What *can* be asserted here is that the bindings the CSS
   * selects on are actually emitted, which is the half that silently breaks.
   */
  it('echoes durationClass and stages onto the figure', () => {
    const html = render(900, 520)
    expect(html).toContain('data-motion-duration="recompose"')
    expect(html).toContain('data-motion-stages="2"')
  })

  it('marks stages=1 at the rungs with no axis to move first', () => {
    // Micro/Tile/Strip draw no axis, so staging the marks behind one would only be slow.
    const html = render(200, 90)
    expect(html).toContain('data-motion-stages="1"')
  })

  /**
   * ⚠ A valueless attribute, so a stylesheet can select `[data-persist-gridlines]` without
   * also matching the rungs that set it to the *string* `"false"` — which is what emitting
   * the boolean directly would produce, and which is truthy to a CSS attribute selector.
   */
  it('emits persist-gridlines as presence, never as the string false', () => {
    expect(render(900, 520)).toContain('data-persist-gridlines=""')
    expect(render(200, 90)).not.toContain('data-persist-gridlines')
  })

  /**
   * The negative half of the same wiring — `40-chart-plan.md` §4. A field derived from
   * `prefers-reduced-motion` cannot exist on the server, so nothing resembling one may appear
   * in server markup; the query in `chart.css` is the only thing entitled to that decision.
   */
  it('emits nothing that could encode a reduced-motion decision', () => {
    const html = render(900, 520)
    expect(html).not.toContain('data-motion-enabled')
    expect(html).not.toContain('prefers-reduced-motion')
  })
})
