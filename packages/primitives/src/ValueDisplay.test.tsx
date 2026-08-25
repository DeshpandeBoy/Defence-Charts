/**
 * `<ValueDisplay>` — the markup half of the band that used to be empty.
 *
 * ⚠ **What this file is really asserting is that the band is not empty.** At Micro the plan
 * is `marks.primary.kind: 'none'` with `regionOrder: ['value','table']`, so the value display
 * *is* the chart; before this component existed the rung rendered an `<svg>` with three empty
 * `<g class="gx-series">` in it and every geometry test in the suite passed. A test that only
 * checked attribute spellings would have kept passing too, which is why the first assertion
 * below is that a Micro frame produces a `<text>` at all.
 *
 * ⚠ **No DOM, on purpose.** `renderToStaticMarkup` at the repo's default node environment is
 * decision 7 stated as an assertion — a component that reached for a ref, an effect or
 * `document` would fail here rather than in a consumer's server-rendered page months later —
 * and the markup is read with a regex for the same reason `Chart.test.tsx` reads it with one:
 * the input is a serialiser's output, normalised and quoted, so the class of inputs a real
 * parser exists to survive cannot occur. Reaching for a DOM library would import a document
 * into a file whose whole point is that there isn't one.
 */

import {
  applyOverrides,
  type ChartFrame,
  describeShape,
  planChart,
  resolveFrame,
  type Series,
  sizeContextFromPixels,
} from '@gx/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ValueDisplay } from './ValueDisplay.tsx'

// --- Fixtures ----------------------------------------------------------------------------

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

/** The frame's value region at a given box, or `null` if the plan asked for none. */
function valueOf(
  width: number,
  height: number,
  data: readonly Series[] = THREE,
): ChartFrame['value'] {
  const ctx = sizeContextFromPixels(width, height)
  return resolveFrame(planChart('line', ctx, describeShape(data)), data, ctx).value
}

function render(value: ChartFrame['value']): string {
  return renderToStaticMarkup(<ValueDisplay value={value} />)
}

// --- The element census, as in Chart.test.tsx --------------------------------------------

type Element = { readonly tag: string; readonly attrs: Record<string, string> }

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

/** `<tag …>text</tag>` pairs, flat — enough for a `<text>` and the `<tspan>` inside it. */
function textOf(html: string, tag: string): readonly string[] {
  return [...html.matchAll(new RegExp(`<${tag}[^>]*>([^<]*)`, 'g'))].map((m) => m[1] ?? '')
}

// --- Nothing to draw ---------------------------------------------------------------------

describe('the states that draw nothing', () => {
  it('renders nothing when the plan asked for no value display', () => {
    // Panel and up drop the value display entirely; the prop is `null` and every call site
    // would otherwise have to branch.
    expect(valueOf(900, 520)).toBeNull()
    expect(render(null)).toBe('')
  })

  it('renders nothing when no series had a value to report', () => {
    const silent = [series('alpha', [null, null, null])]
    const value = valueOf(60, 24, silent)
    expect(value).not.toBeNull()
    expect(value?.entries).toEqual([])
    expect(render(value)).toBe('')
  })

  /**
   * ⚠ A zero font size is the one case that must not render, because `<text font-size="0">`
   * is an element that claims to paint and does not — the same shape of lie as the empty band
   * this component was written to fill.
   */
  it('renders nothing rather than text at zero px', () => {
    const value = valueOf(0, 0)
    expect(value?.fontSize ?? 0).toBe(0)
    expect(render(value)).toBe('')
  })
})

// --- The band has something in it --------------------------------------------------------

describe('the Micro rung, whose entire content this is', () => {
  const html = render(valueOf(60, 24))

  it('paints a value', () => {
    const values = parseElements(html).filter((el) => el.attrs['class'] === 'gx-value')
    expect(values).toHaveLength(1)
    expect(values[0]?.tag).toBe('text')
    expect(html).toContain('>27<')
  })

  it('separates series context from the dominant metric in the SVG reading', () => {
    const context = parseElements(html).find((el) => el.attrs['class'] === 'gx-value__context gx-value__label')
    const metric = parseElements(html).find((el) => el.attrs['class'] === 'gx-value__metric')

    expect(context?.tag).toBe('tspan')
    expect(metric?.tag).toBe('tspan')
    expect(html).toMatch(
      /<text[^>]*class="gx-value"[^>]*aria-label="ALPHA 27"[^>]*>.*gx-value__context.*ALPHA.*gx-value__metric.*27/s,
    )
  })

  it('takes its coordinates and its size from the frame, unmodified', () => {
    const value = valueOf(60, 24)
    const entry = value?.entries[0]
    const painted = parseElements(html).find((el) => el.attrs['class'] === 'gx-value')
    expect(Number(painted?.attrs['x'])).toBeCloseTo(entry?.x ?? 0, 2)
    expect(Number(painted?.attrs['y'])).toBeCloseTo(entry?.y ?? 0, 2)
    expect(Number(painted?.attrs['font-size'])).toBeCloseTo(value?.fontSize ?? 0, 2)
  })

  it('says how many values it could not show', () => {
    const marker = parseElements(html).find((el) => el.attrs['class'] === 'gx-value__overflow')
    expect(marker?.attrs['data-hidden']).toBe('2')
    expect(html).toContain('>+2<')
  })
})

// --- The delta ---------------------------------------------------------------------------

describe('the delta', () => {
  const html = render(valueOf(240, 80))

  it('is a tspan inside the value, not a second text element', () => {
    const deltas = parseElements(html).filter((el) => el.attrs['class'] === 'gx-value__delta')
    expect(deltas.length).toBeGreaterThan(0)
    for (const d of deltas) expect(d.tag).toBe('tspan')
    expect(html).toMatch(/<text[^>]*class="gx-value"[^>]*>[^<]*<tspan/)
  })

  it('carries the direction as data, for a theme that has a palette for it', () => {
    const directionFixtures: readonly (readonly [string, readonly number[]])[] = [
      ['alpha', [10, 14, 9, 22, 18, 30, 27] as const],
      ['beta', [4, 6, 5, 9, 7, 11, 12] as const],
      ['gamma', [-2, 1, -5, 3, 0, 6, 4] as const],
    ]
    const directions = directionFixtures.flatMap(([id, values]) =>
      parseElements(render(valueOf(240, 80, [series(id, values)])))
        .filter((el) => el.attrs['class'] === 'gx-value__delta')
        .map((el) => el.attrs['data-direction']),
    )
    // alpha 30→27 falls, beta 11→12 rises, gamma 6→4 falls.
    expect(directions).toEqual(['down', 'up', 'down'])
  })

  /**
   * ⚠ The separating space is part of the string `@gx/core` measured. A `dx` on the tspan
   * would move the glyphs without moving the width the column was fitted against — the text
   * would be wider than the space reserved for it, and nothing would look broken until two
   * values touched.
   */
  it('keeps the separating space inside the text it was measured with', () => {
    const tspans = textOf(render(valueOf(240, 80, [series('alpha', [10, 14, 9, 22, 18, 30, 27])])), 'tspan')
    expect(tspans.at(-1)).toBe(' −3')
  })

  it('is absent at a rung that asks for the value alone', () => {
    expect(render(valueOf(60, 24))).not.toContain('gx-value__delta')
  })
})

// --- The binding rules -------------------------------------------------------------------

describe('the three rules of @gx/primitives', () => {
  const ALLOWED = new Set([
    'class',
    'x',
    'y',
    'font-size',
    'data-series-id',
    'data-series-index',
    'data-direction',
    'data-hidden',
    'aria-label',
  ])

  /**
   * ⚠ Rule 2, asserted as an allowlist rather than as a list of banned attributes. A ban
   * names the mistakes someone already made; an allowlist catches the next one. `font-size`
   * is on it because it is data — computed from the measured box, per render — and the note
   * on `ChartFrame['value']` is where that line is drawn.
   */
  it('emits no visual presentation attribute except the fitted font size', () => {
    const offenders: string[] = []
    for (const [w, h] of [
      [60, 24],
      [240, 80],
      [100, 100],
    ] as const) {
      for (const el of parseElements(render(valueOf(w, h)))) {
        for (const name of Object.keys(el.attrs)) {
          if (!ALLOWED.has(name)) offenders.push(`${String(w)}×${String(h)}: ${el.tag}[${name}]`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('emits no <line>, at any size', () => {
    for (const [w, h] of [
      [60, 24],
      [240, 80],
      [100, 100],
    ] as const) {
      expect(render(valueOf(w, h))).not.toContain('<line')
    }
  })

  it('renders to a static string with no DOM present', () => {
    // ⚠ The precondition, asserted rather than assumed: if a document ever appears in this
    // file's environment, this line fails loudly instead of every assertion below it
    // quietly getting weaker.
    expect((globalThis as { document?: unknown }).document).toBeUndefined()
    expect(render(valueOf(60, 24))).toContain('<text')
  })
})

// --- Identity ----------------------------------------------------------------------------

describe('a number belongs to a series', () => {
  /**
   * ⚠ **The index is the series', not the entry's, and this is the test that tells them
   * apart.** `alpha` has no defined point, so it contributes no entry and `beta` becomes the
   * first thing painted — while still being series 1 in the colour ramp. An index taken from
   * the map's position would paint beta in alpha's colour, next to a line drawn in beta's,
   * and nothing on screen would look wrong.
   */
  it('keeps the series index when an earlier series is silent', () => {
    const data = [
      series('a', [null, null, null]),
      series('b', [4, 6, 5]),
      series('c', [-2, 1, -5]),
    ]
    const painted = parseElements(render(valueOf(200, 100, data))).filter(
      (el) => el.attrs['class'] === 'gx-value',
    )
    expect(painted.map((el) => el.attrs['data-series-id'])).toEqual(['b', 'c'])
    expect(painted.map((el) => el.attrs['data-series-index'])).toEqual(['1', '2'])
  })

  it('names the series it came from', () => {
    const painted = parseElements(render(valueOf(240, 100, [
      series('a', [10, 14, 9]),
      series('b', [4, 6, 5]),
      series('c', [-2, 1, -5]),
    ]))).filter(
      (el) => el.attrs['class'] === 'gx-value',
    )
    expect(painted.map((el) => el.attrs['data-series-id'])).toEqual(['a', 'b', 'c'])
  })
})

// --- Determinism -------------------------------------------------------------------------

describe('determinism', () => {
  it('renders character-identical markup twice', () => {
    expect(render(valueOf(240, 80))).toBe(render(valueOf(240, 80)))
  })

  it('emits no coordinate with more than two decimal places', () => {
    const html = render(valueOf(237, 83))
    const pattern = /(?:x|y|font-size)="[^"]*\d+\.\d{3,}[^"]*"/g
    expect([...html.matchAll(pattern)].map((m) => m[0])).toEqual([])
  })

  it('emits no NaN at any of the sizes the ladder reaches', () => {
    for (let w = 20; w <= 400; w += 7) {
      for (const h of [0, 1, 24, 40, 100]) {
        expect(render(valueOf(w, h))).not.toContain('NaN')
      }
    }
  })
})

// --- A forced plan is obeyed exactly -----------------------------------------------------

describe('a forced value display is obeyed, not approximated', () => {
  /**
   * ⚠ Decision 8: an override forced after resolution must render exactly as a resolved plan
   * does. A Panel drops the value display, so this is the only way to reach one at a size the
   * resolver would never hand one out at — and it is what a consumer who wants a KPI header
   * on a big chart will actually do.
   */
  it('paints a value display at a rung that would not have chosen one', () => {
    const ctx = sizeContextFromPixels(900, 520)
    const base = planChart('line', ctx, describeShape(THREE))
    expect(base.narrative.valueDisplay).toBe('none')
    const forced = applyOverrides(base, {
      narrative: { valueDisplay: 'latest+delta', valueTypeScale: 32 },
    })
    const value = resolveFrame(forced, THREE, ctx).value
    const html = render(value)
    expect(parseElements(html).filter((el) => el.attrs['class'] === 'gx-value')).toHaveLength(3)
    expect(Number(value?.fontSize)).toBeGreaterThan(0)
    expect(Number(value?.fontSize)).toBeLessThanOrEqual(32)
  })
})
