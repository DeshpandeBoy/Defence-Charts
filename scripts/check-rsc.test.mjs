/**
 * Gate **G4**'s own logic, tested — the parts of it that are pure.
 *
 * ⚠ Decision 015: *a gate never observed to fail is not a gate — it is a job that exits 0.*
 * Most of G4's planting has to happen against a real Next build, and it does. But two pieces
 * are pure functions over data, and those are the pieces that decide whether a real run is
 * read as a pass or a failure — so they get planted here, in both directions, where a plant
 * costs milliseconds instead of a thirty-second build.
 *
 * What is deliberately **not** covered here: the build, the server, and the browser. Those are
 * the gate. This file protects the gate's judgement, not its subject.
 */

import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { MARKERS, collectClientScripts, judgeChart, scanForChartCode } from './check-rsc.mjs'

const FIXTURES = fileURLToPath(new URL('./__fixtures__/', import.meta.url))

/**
 * A reading of a page that rendered correctly. Every test below starts from this and breaks
 * exactly one thing, so a failure names the thing that was broken.
 *
 * @param {Record<string, unknown>} [patch]
 */
function reading(patch = {}) {
  return /** @type {any} */ ({
    figureFound: true,
    svgFound: true,
    role: 'graphics-document',
    sizeClass: 'panel',
    pathCount: 2,
    drawnPathCount: 2,
    titleText: 'RSC fixture line chart',
    // The shape React's Flight server actually emits: `'_' + prefix + 'S_' + n.toString(32)`,
    // with an empty default prefix, then `<Chart>`'s own `-title` suffix.
    titleId: '_S_1_-title',
    markCount: 27,
    bodyText: 'RSC fixture line chart',
    ...patch,
  })
}

describe('the allow direction', () => {
  it('passes a chart that server-rendered with everything in place', () => {
    expect(judgeChart(reading())).toEqual([])
  })
})

describe('the deny direction', () => {
  it('fails when JavaScript-off produced no <svg> at all', () => {
    const failures = judgeChart(reading({ svgFound: false, markCount: 0, drawnPathCount: 0 }))
    expect(failures.map((f) => f.kind)).toEqual(['no-svg'])
  })

  it('reports the missing <svg> once, not once per downstream symptom', () => {
    // ⚠ The short-circuit is the point. Without it a page that rendered nothing produces six
    // findings — no role, no geometry, no title, no size class — and the reader has to work
    // out that five of them are the same absence seen from different angles. A gate whose
    // output has to be triaged is a gate people stop reading.
    const failures = judgeChart(
      reading({ svgFound: false, figureFound: false, role: null, sizeClass: null, titleText: null, markCount: 0, drawnPathCount: 0, pathCount: 0 }),
    )
    expect(failures).toHaveLength(1)
  })

  it('rejects role="img" and says why it is worse than no role', () => {
    const failures = judgeChart(reading({ role: 'img' }))
    expect(failures.map((f) => f.kind)).toEqual(['role'])
    // Not decoration: `img` is Children Presentational True, so it erases the <title> the
    // graphics roles exist to expose. The message has to carry that or the fix looks cosmetic.
    expect(failures[0]?.detail).toContain('Children Presentational True')
  })

  it('rejects markup that arrived without its geometry', () => {
    // The shape of a server that ran the component but not the resolver: <path> elements are
    // there, `d` is not. Every selector this gate looks for still matches.
    const failures = judgeChart(reading({ drawnPathCount: 0 }))
    expect(failures.map((f) => f.kind)).toEqual(['no-geometry'])
  })

  it('rejects an <svg> that is present and empty', () => {
    const failures = judgeChart(reading({ markCount: 1, pathCount: 0, drawnPathCount: 0 }))
    expect(failures.map((f) => f.kind).sort()).toEqual(['empty-svg', 'no-geometry'])
  })

  it('rejects a title that is not the one the fixture contracted to render', () => {
    // Catches the case where a stranger's server answered on the port — the assertion that
    // stops this gate from grading somebody else's page.
    const failures = judgeChart(reading({ titleText: 'Welcome to Next.js' }))
    expect(failures.map((f) => f.kind)).toEqual(['title'])
    expect(failures[0]?.detail).toContain('a different page')
  })

  it('rejects a <figure> with no resolved size class', () => {
    const failures = judgeChart(reading({ sizeClass: null }))
    expect(failures.map((f) => f.kind)).toEqual(['no-size-class'])
  })

  it('catches SSR degradation by the initial React stamped into the id', () => {
    // ⚠ The assertion the top of the gate's docblock says a first-paint check cannot make.
    // Everything else about this reading is perfect — the SVG is there, the geometry is
    // there, the title is right — because that is exactly what SSR-plus-hydration looks
    // like with JavaScript switched off. The only thing that differs is one letter.
    const failures = judgeChart(reading({ titleId: '_R_1_-title' }))
    expect(failures.map((f) => f.kind)).toEqual(['useid-ssr'])
    expect(failures[0]?.detail).toContain('will hydrate')
  })

  it('fails loudly when React changes the id format instead of quietly passing', () => {
    // ⚠ The discriminator is a React internal with no public promise behind it. A gate that
    // shrugged here would keep printing green while asserting nothing — the failure species
    // this repository is built around. It has to say it stopped working.
    const failures = judgeChart(reading({ titleId: '_x9q-title' }))
    expect(failures.map((f) => f.kind)).toEqual(['useid-rot'])
    expect(failures[0]?.detail).toContain('re-derived')
  })

  it('does not read a renderer stamp off a title that has no id at all', () => {
    const failures = judgeChart(reading({ titleId: null }))
    expect(failures.map((f) => f.kind)).toEqual(['useid-rot'])
  })
})

describe('the bundle scan', () => {
  it('finds no chart code in a client bundle that has none', async () => {
    const files = await collectClientScripts(`${FIXTURES}rsc-clean`)
    const { leaks, bytes } = await scanForChartCode(files, FIXTURES)
    expect(leaks).toEqual([])
    // ⚠ Not `> 0`. "No markers found" in an empty read is the same green as "no markers
    // found" in a real bundle, which is precisely the vacuity `MIN_CLIENT_BYTES` guards
    // against in the gate itself — so the test that proves the clean direction has to prove
    // it read something first.
    expect(files).toHaveLength(1)
    expect(bytes).toBeGreaterThan(600)
  })

  it('never opens the stylesheet, which legitimately contains every marker', async () => {
    // ⚠ The measured near-miss, pinned. `<Chart>`'s CSS is a side-effect import, so Next
    // compiles it to `.next/static/chunks/*.css` — a file whose selectors ARE the markers.
    // Verified against a real `next build` of apps/rsc-fixture: all four class-name markers
    // appeared in the CSS chunk and none in any .js chunk. A scan widened to "every file
    // under .next/static" would therefore fail a perfectly correct RSC page, and the obvious
    // repair — deleting the marker that "false-positives" — removes the strongest signal
    // this gate has.
    const files = await collectClientScripts(`${FIXTURES}rsc-clean`)
    expect(files.some((f) => f.endsWith('.css'))).toBe(false)
    expect(files.some((f) => f.endsWith('.js'))).toBe(true)

    const css = await scanForChartCode([`${FIXTURES}rsc-clean/chunks/styles-9f2a1c.css`], FIXTURES)
    expect(css.leaks.length).toBeGreaterThan(0)
  })

  it('catches a compiled <Chart> even after every identifier has been minified away', async () => {
    const files = await collectClientScripts(`${FIXTURES}rsc-leak`)
    const { leaks } = await scanForChartCode(files, FIXTURES)
    expect(leaks.map((l) => l.marker).sort()).toEqual([
      'graphics-document',
      'gx-chart__caption',
      'gx-chart__svg',
    ])
    expect(leaks[0]?.file).toBe('rsc-leak/chunks/page-7c40aa.js')
  })

  it('quotes enough of the surrounding bytes to tell code from a stray mention', async () => {
    const files = await collectClientScripts(`${FIXTURES}rsc-leak`)
    const { leaks } = await scanForChartCode(files, FIXTURES)
    const svg = leaks.find((l) => l.marker === 'gx-chart__svg')
    expect(svg?.excerpt).toContain('className')
    expect(svg?.excerpt).not.toMatch(/\n/)
  })

  it('searches string literals rather than identifiers, because minifiers keep only one', () => {
    // ⚠ The design constraint, asserted so it cannot be casually widened. `planChart`,
    // `resolveFrame` and `Chart` are all renamed to single letters in the leak fixture; the
    // class names and the role value are not, because they have to survive to reach the DOM.
    // Adding an identifier to MARKERS would produce a marker that is absent from every real
    // production bundle, chart code or not.
    for (const { literal } of MARKERS) {
      const isLiteral = literal.includes('-') || literal.includes(' ')
      expect(isLiteral, `${literal} must be a string literal, not an identifier`).toBe(true)
    }
  })
})
