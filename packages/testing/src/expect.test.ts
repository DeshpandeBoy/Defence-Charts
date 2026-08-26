/**
 * The assertion helpers, asserted.
 *
 * ⚠ **Every helper is exercised in the failing direction, and that is the point of the file.**
 * Decision 015 — `research/decisions/015-token-gate-is-a-parser.md` — settles that *a gate
 * never seen to fail is not a gate*, and an assertion helper is a gate with a nicer name. A
 * `expectLine()` that quietly accepts three decimal places passes every test written with it,
 * forever, and the suite reports full health while checking nothing. So each block below pairs
 * a passing case with the specific markup that must be rejected: three decimals, a `NaN`, a
 * `<line>` carrying `x1`, a tick count off by one, a y axis rendered upside down.
 *
 * ⚠ This file has no DOM and does not want one. The helpers build their own jsdom, so this
 * runs at `environment: 'node'` alongside `determinism.test.ts` — see the module docblock in
 * `./expect.ts` for why that is deliberate and load-bearing rather than incidental.
 *
 * ⚠ The markup below is **hand-written, not rendered**. `@shiftcharts/primitives` is the thing these
 * helpers exist to check, so generating the fixtures from it would make the test circular: a
 * renderer that emits three decimals and a helper that accepts them would agree, and agree
 * greenly. The strings here encode the contract in `research/30-implementation-plan.md` A4
 * independently of whatever the renderer currently does.
 */

import { describe, expect, it } from 'vitest'

import {
  expectAxisTicks,
  expectElementSet,
  expectLine,
  expectPoints,
  expectScale,
  parseChart,
} from './expect.ts'

/** Wrap SVG children in the `<figure>`/`<svg>` shell every helper expects to find. */
function chart(children: string): string {
  return (
    '<figure class="shiftcharts-chart">' +
    '<svg class="shiftcharts-chart__svg" role="graphics-document" aria-labelledby="c-title" viewBox="0 0 300 200">' +
    '<title id="c-title">Revenue</title>' +
    children +
    '</svg>' +
    '</figure>'
  )
}

function series(id: string, children: string, index = 0): string {
  return `<g class="shiftcharts-series" data-series-id="${id}" data-series-index="${String(index)}">${children}</g>`
}

/** Ticks as visx-shaped translated groups — the placement `readTickOffset()` prefers. */
function axis(which: 'x' | 'y', ticks: readonly (readonly [string, number])[]): string {
  const inner = ticks
    .map(([label, offset]) => {
      const t = which === 'x' ? `translate(${String(offset)},0)` : `translate(0,${String(offset)})`
      return (
        `<g class="shiftcharts-axis__tick" data-value="${label}" transform="${t}">` +
        '<rect class="shiftcharts-axis__tick-mark"/>' +
        `<text class="shiftcharts-axis__tick-label">${label}</text>` +
        '</g>'
      )
    })
    .join('')
  return `<g class="shiftcharts-axis shiftcharts-axis--${which}" data-axis="${which}">${inner}</g>`
}

const X_AXIS = axis('x', [
  ['Jan', 0],
  ['Apr', 80],
  ['Jul', 160],
  ['Oct', 240],
])

/** ⚠ Offsets descend: the domain ascends upward and SVG's y grows downward. */
const Y_AXIS = axis('y', [
  ['0', 180],
  ['20', 90],
  ['40', 0],
])

const LINE = series('revenue', '<path class="shiftcharts-line" d="M0,180L80,90L160,45L240,0"/>')

describe('parseChart', () => {
  it('round-trips figure-rooted markup into the right namespaces', () => {
    // ⚠ The measured behaviour the whole module rests on: the HTML parser's foreign-content
    // rules put `<figure>` in XHTML and everything from `<svg>` down in SVG. Asserting the
    // namespace rather than merely finding the element is the difference that matters —
    // parsing the same string as XML *also* finds a `path`, in a null namespace, and every
    // assertion written against it passes while testing nothing.
    const parsed = parseChart(chart(LINE))
    expect(parsed.root.localName).toBe('figure')
    expect(parsed.root.namespaceURI).toBe('http://www.w3.org/1999/xhtml')
    expect(parsed.svg.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(parsed.one('path.shiftcharts-line').namespaceURI).toBe('http://www.w3.org/2000/svg')
  })

  it('preserves the capital B in viewBox', () => {
    // The HTML parser lowercases attribute names except for a fixed adjustment table that
    // SVG's camelCased attributes are on. If a future jsdom stopped applying it, every
    // viewBox assertion in the suite would silently start reading `null`.
    expect(parseChart(chart('')).svg.getAttribute('viewBox')).toBe('0 0 300 200')
  })

  it('rejects markup with no <svg> rather than reporting an empty chart', () => {
    // A component that threw and a component that drew nothing look identical three
    // assertions later, as "expected 4 ticks, found 0".
    expect(() => parseChart('<figure class="shiftcharts-chart"></figure>')).toThrow(/no <svg>/)
  })

  it('rejects markup with no elements at all', () => {
    expect(() => parseChart('   ')).toThrow(/no elements/)
  })

  it('names what the chart does contain when a selector matches nothing', () => {
    // The failure message is the product — see the `describeShape()` docblock.
    expect(() => parseChart(chart(LINE)).one('path.shiftcharts-area')).toThrow(/shiftcharts-line/)
  })
})

describe('expectLine', () => {
  it('accepts a two-decimal path', () => {
    const line = expectLine(chart(series('a', '<path class="shiftcharts-line" d="M0,0L1.23,2.35L3,4"/>')))
    expect(line.d).toBe('M0,0L1.23,2.35L3,4')
    expect(line.segments).toBe(1)
  })

  it('⚠ rejects three decimal places', () => {
    // THE HEADLINE CASE. `M0,0L1.235,2.346L3,4` is exactly what d3-shape emits when
    // `.digits(2)` is missing — see PATH_DIGITS in packages/core/src/frame.ts, which records
    // both strings. The chart renders identically; only the snapshots drift, on a last digit
    // that varies by platform.
    expect(() =>
      expectLine(chart(series('a', '<path class="shiftcharts-line" d="M0,0L1.235,2.346L3,4"/>'))),
    ).toThrow(/3 decimal places/)
  })

  it('rejects NaN, undefined and Infinity in the path data', () => {
    // Checked against the raw string, because tokenising destroys them: `a` and `t` are path
    // commands, so `NaN` and `Infinity` shred into fragments that no longer look wrong.
    for (const poison of ['M0,0LNaN,4', 'M0,0Lundefined,4', 'M0,0L-Infinity,4']) {
      expect(() => expectLine(chart(series('a', `<path class="shiftcharts-line" d="${poison}"/>`)))).toThrow(
        /NaN|undefined|Infinity/,
      )
    }
  })

  it('rejects a path that does not open with an absolute moveto', () => {
    expect(() =>
      expectLine(chart(series('a', '<path class="shiftcharts-line" d="L10,10L20,20"/>'))),
    ).toThrow(/does not start with/)
  })

  it('rejects exponent notation rather than splitting it into two innocent integers', () => {
    // ⚠ `e` is deliberately absent from the command class in `assertPathData()`. If it were
    // included, `1e5` would tokenise as `1` and `5` — two valid coordinates — and a path
    // carrying a number no `.digits(2)` generator can produce would pass.
    expect(() => expectLine(chart(series('a', '<path class="shiftcharts-line" d="M0,0L1e5,4"/>')))).toThrow(
      /not a plain decimal number/,
    )
  })

  it('rejects an empty or absent d', () => {
    expect(() => expectLine(chart(series('a', '<path class="shiftcharts-line" d=""/>')))).toThrow(/empty/)
    expect(() => expectLine(chart(series('a', '<path class="shiftcharts-line"/>')))).toThrow(/has no `d`/)
  })

  it('scopes to a named series and lists the ones that exist when it is missing', () => {
    const html = chart(
      series('a', '<path class="shiftcharts-line" d="M0,0L10,10"/>') +
        series('b', '<path class="shiftcharts-line" d="M0,5L10,15"/>', 1),
    )
    expect(expectLine(html, { series: 'b' }).d).toBe('M0,5L10,15')
    expect(() => expectLine(html, { series: 'c' })).toThrow(/"a", "b"/)
  })

  it('counts segments as gaps + 1, and rejects a wrong count', () => {
    // A twelve-point series with one null in the middle has twelve points and two segments.
    const gapped = chart(series('a', '<path class="shiftcharts-line" d="M0,0L10,10M30,30L40,40"/>'))
    expect(expectLine(gapped, { segments: 2 }).segments).toBe(2)
    expect(() => expectLine(gapped, { segments: 1 })).toThrow(/drew 2 segment/)
  })

  it('rejects a chart with no line at all', () => {
    expect(() => expectLine(chart(series('a', '<path class="shiftcharts-area" d="M0,0Z"/>')))).toThrow(
      /no `path.shiftcharts-line`/,
    )
  })
})

describe('expectAxisTicks', () => {
  const html = chart(X_AXIS + Y_AXIS + LINE)

  it('accepts the right count and the right labels', () => {
    const ticks = expectAxisTicks(html, 'x', {
      count: 4,
      labels: ['Jan', 'Apr', 'Jul', 'Oct'],
    })
    expect(ticks.map((t) => t.offset)).toEqual([0, 80, 160, 240])
    expect(ticks.map((t) => t.value)).toEqual(['Jan', 'Apr', 'Jul', 'Oct'])
  })

  it('⚠ rejects a wrong count, and shows the labels it found', () => {
    expect(() => expectAxisTicks(html, 'x', { count: 5 })).toThrow(/has 4 tick\(s\), expected 5/)
    expect(() => expectAxisTicks(html, 'x', { count: 5 })).toThrow(/"Jan","Apr","Jul","Oct"/)
  })

  it('rejects wrong labels and names the index that differs', () => {
    expect(() => expectAxisTicks(html, 'x', { labels: ['Jan', 'Mar', 'Jul', 'Oct'] })).toThrow(
      /label at index 1 is "Apr"/,
    )
  })

  it('does not trim, so a padded label is a failure rather than a match', () => {
    // A renderer that emits `<text> Jan </text>` draws a label with a leading space. Trimming
    // here would make the helper agree with markup a browser renders differently.
    const padded = chart(
      '<g class="shiftcharts-axis shiftcharts-axis--x" data-axis="x">' +
        '<g class="shiftcharts-axis__tick"><text class="shiftcharts-axis__tick-label"> Jan </text></g>' +
        '</g>',
    )
    expect(() => expectAxisTicks(padded, 'x', { labels: ['Jan'] })).toThrow(/label at index 0/)
  })

  it('reports a missing axis as absent, not as empty', () => {
    // An axis the ladder turned off is gone from the tree. Saying so points a reader at the
    // rung; "0 ticks" points them at the tick generator.
    expect(() => expectAxisTicks(chart(LINE), 'y')).toThrow(/no `g.shiftcharts-axis--y`/)
    expect(() => expectAxisTicks(html, 'y')).not.toThrow()
  })

  it('rejects a call whose own count and labels disagree', () => {
    // Guarding the caller, not the chart: silently preferring one over the other would let a
    // half-edited assertion look like it still checks both.
    expect(() => expectAxisTicks(html, 'x', { count: 3, labels: ['Jan', 'Apr', 'Jul', 'Oct'] })).toThrow(
      /fix the call, not the chart/,
    )
  })

  it('falls back to the tick mark rect when there is no transform', () => {
    // ⚠ The DOM contract A4 was handed does not pin down where the offset lives, so the
    // fallback chain is exercised rather than assumed. See `readTickOffset()`.
    const positioned = chart(
      '<g class="shiftcharts-axis shiftcharts-axis--x" data-axis="x">' +
        '<g class="shiftcharts-axis__tick"><rect class="shiftcharts-axis__tick-mark" x="42"/></g>' +
        '</g>',
    )
    expect(expectAxisTicks(positioned, 'x')[0]?.offset).toBe(42)
  })

  it('reports a null offset rather than a zero when nothing supplies one', () => {
    // The silent-zero failure mode again: `Number(null)` is 0, and an unpositioned tick that
    // reports 0 is indistinguishable from a tick genuinely at the origin.
    const bare = chart(
      '<g class="shiftcharts-axis shiftcharts-axis--x" data-axis="x"><g class="shiftcharts-axis__tick"></g></g>',
    )
    expect(expectAxisTicks(bare, 'x')[0]?.offset).toBeNull()
  })
})

describe('expectPoints', () => {
  const dots = '<circle class="shiftcharts-point" data-index="0" cx="0" cy="180"/>' +
    '<circle class="shiftcharts-point" data-index="1" cx="80" cy="90"/>' +
    '<circle class="shiftcharts-point" data-index="2" cx="160" cy="45"/>'

  it('accepts a count and returns finite positions', () => {
    const points = expectPoints(chart(series('a', dots)), { series: 'a', count: 3 })
    expect(points.map((p) => p.cx)).toEqual([0, 80, 160])
    expect(points.map((p) => p.index)).toEqual([0, 1, 2])
  })

  it('⚠ rejects a wrong count and points at the plan rather than the geometry', () => {
    expect(() => expectPoints(chart(series('a', dots)), { count: 4 })).toThrow(
      /has 3 `circle.shiftcharts-point`, expected 4/,
    )
    expect(() => expectPoints(chart(series('a', dots)), { count: 4 })).toThrow(
      /marks.points.mode/,
    )
  })

  it('⚠ rejects a missing cx instead of reading SVG’s default zero', () => {
    // A point the frame failed to position and a point genuinely at the origin both render
    // at the plot origin. Requiring the attribute is the only thing that separates them.
    expect(() =>
      expectPoints(chart(series('a', '<circle class="shiftcharts-point" cy="10"/>'))),
    ).toThrow(/has no `cx`/)
  })

  it('rejects a non-finite coordinate', () => {
    expect(() =>
      expectPoints(chart(series('a', '<circle class="shiftcharts-point" cx="NaN" cy="10"/>'))),
    ).toThrow(/not a finite number/)
  })

  it('reports a missing data-index as null rather than as zero', () => {
    const points = expectPoints(chart(series('a', '<circle class="shiftcharts-point" cx="1" cy="2"/>')))
    expect(points[0]?.index).toBeNull()
  })
})

describe('expectScale', () => {
  const html = chart(X_AXIS + Y_AXIS + LINE)

  it('accepts an x axis whose offsets ascend', () => {
    expect(expectScale(html, 'x', { min: 0, max: 260 })).toEqual({ first: 0, last: 240 })
  })

  it('⚠ accepts a y axis whose offsets descend', () => {
    // Not a quirk to route around: `resolveFrame()` emits yTicks in ascending domain order and
    // SVG's y grows downward, so the first tick in document order carries the largest offset.
    expect(expectScale(html, 'y', { min: 0, max: 200 })).toEqual({ first: 180, last: 0 })
  })

  it('⚠ rejects a y axis rendered upside down', () => {
    // The case a `Math.abs` or a sort would have swallowed. It is visible in a screenshot and
    // invisible in a test that normalises direction away.
    const flipped = chart(
      axis('y', [
        ['0', 0],
        ['20', 90],
        ['40', 180],
      ]),
    )
    expect(() => expectScale(flipped, 'y', { min: 0, max: 200 })).toThrow(/rendered upside down/)
  })

  it('rejects an x axis running right to left', () => {
    const flipped = chart(
      axis('x', [
        ['Jan', 240],
        ['Oct', 0],
      ]),
    )
    expect(() => expectScale(flipped, 'x', { min: 0, max: 260 })).toThrow(/runs the wrong way/)
  })

  it('rejects an offset outside the plot box', () => {
    // A tick past the plot means the renderer and the resolver disagree about the plot — the
    // headline invariant in packages/core/src/frame.ts, caught from the markup side.
    expect(() => expectScale(html, 'x', { min: 0, max: 200 })).toThrow(/outside \[0, 200\]/)
  })

  it('refuses to infer a direction from a single tick', () => {
    const one = chart(axis('x', [['Jan', 10]]))
    expect(() => expectScale(one, 'x', { min: 0, max: 100 })).toThrow(/has 1 tick\(s\)/)
  })

  it('names the fallback chain when no tick carries a readable offset', () => {
    const bare = chart(
      '<g class="shiftcharts-axis shiftcharts-axis--x" data-axis="x">' +
        '<g class="shiftcharts-axis__tick"></g><g class="shiftcharts-axis__tick"></g>' +
        '</g>',
    )
    expect(() => expectScale(bare, 'x', { min: 0, max: 100 })).toThrow(/no readable offset/)
  })
})

describe('expectElementSet', () => {
  it('returns a sorted multiset that excludes the synthesised document wrapper', () => {
    // ⚠ jsdom wraps a fragment in html/head/body. Walking from the document root would put
    // three elements nobody rendered into every snapshot.
    const set = expectElementSet(
      chart(series('a', '<circle class="shiftcharts-point" cx="1" cy="2"/><circle class="shiftcharts-point" cx="3" cy="4"/>')),
    )
    expect(set).toEqual([
      'circle#shiftcharts-point',
      'circle#shiftcharts-point',
      'figure#shiftcharts-chart',
      'g#shiftcharts-series',
      'svg#shiftcharts-chart__svg',
      'title',
    ])
    expect(set).not.toContain('html')
    expect(set).not.toContain('body')
  })

  it('joins multiple classes and lowercases nothing it should not', () => {
    // `localName`, not `tagName`: the parser hands back FIGURE in uppercase and svg in
    // lowercase, and a snapshot built from `tagName` sorts the two families apart.
    const set = expectElementSet(chart(X_AXIS))
    expect(set).toContain('g#shiftcharts-axis.shiftcharts-axis--x')
    expect(set.filter((e) => e === 'g#shiftcharts-axis__tick')).toHaveLength(4)
  })

  it('⚠ rejects a <line> carrying x1/y1/x2/y2', () => {
    // DECISION 012, EXECUTED. Those four attributes are not CSS-settable in any browser and
    // none is planned, so `line { y2: var(--shiftcharts-tick-length) }` parses, passes the token gate,
    // builds, warns about nothing, and does not change the tick's length. Vega renders 28 of
    // these; Observable Plot renders 0.
    const tickedWithLines = chart(
      '<g class="shiftcharts-axis shiftcharts-axis--x" data-axis="x">' +
        '<g class="shiftcharts-axis__tick"><line class="shiftcharts-axis__tick-mark" x1="0" y1="0" x2="0" y2="6"/></g>' +
        '</g>',
    )
    expect(() => expectElementSet(tickedWithLines)).toThrow(/not CSS-settable/)
    expect(() => expectElementSet(tickedWithLines)).toThrow(/012-no-line-element/)
  })

  it('rejects a <line> carrying even one of the four', () => {
    expect(() => expectElementSet(chart('<line x2="10"/>'))).toThrow(/x2="10"/)
  })

  it('leaves a geometry-free <line> legal, as decision 012 says it should', () => {
    // The ban is on tokened geometry, not on the element. A `<line>` no token controls stays
    // legal, and a check that forbade the tag outright would be enforcing a rule nobody made.
    expect(expectElementSet(chart('<line class="shiftcharts-decoration"/>'))).toContain(
      'line#shiftcharts-decoration',
    )
  })

  it('is a multiset, so a dropped mark is a diff', () => {
    const three = expectElementSet(
      chart(series('a', '<circle class="shiftcharts-point" cx="1" cy="2"/>'.repeat(3))),
    )
    const two = expectElementSet(
      chart(series('a', '<circle class="shiftcharts-point" cx="1" cy="2"/>'.repeat(2))),
    )
    expect(three).not.toEqual(two)
    expect(three.filter((e) => e === 'circle#shiftcharts-point')).toHaveLength(3)
  })
})
