/**
 * The motion probe — what SVG geometry actually animates when an *attribute* changes.
 *
 * ⚠ **THIS IS A PROBE, NOT A GATE.** It asserts nothing and always exits 0. Its output is
 * evidence for `research/decisions/016-what-svg-geometry-actually-transitions.md`, and the
 * reason it exists at all is decision **012**: SVG2 promoted *some* geometry attributes to
 * CSS properties and left others behind, and the ones left behind fail silently — the CSS
 * parses, the token gate passes, the build succeeds, and the tick does not move. 012 settled
 * that question by running it rather than by reading a spec table. A6 asks the adjacent
 * question and gets the same treatment.
 *
 * The adjacent question is narrower than 012's and is not answered by it. 012 asked *"can a
 * custom property set this geometry?"* This asks *"if React sets the **attribute** to a new
 * value, does a CSS `transition` on the mapped property produce intermediate frames?"* Those
 * can differ: a property may be CSS-settable and still not interpolate — `d` between paths
 * with different command counts is the obvious candidate — and a property may be settable and
 * animatable and still show nothing, because React **replaced** the element instead of
 * updating it, and a freshly-mounted node has no previous value to transition from.
 *
 * That last case is why this probe has case 12. `research/20-architecture.md` §7.4 sketches
 * `transition: d var(--shiftcharts-motion-duration) ease` on `.series` as though it obviously works.
 * Every rung of the ladder renders through `<LinePath>`, which emits `d` as an attribute, and
 * `<Grid>`/`<Axis>` currently key their children by **pixel offset** — so on any resize the
 * key changes and every gridline is a new element. If case 12 says a replaced element does not
 * transition, then §7.4's snippet describes something that cannot happen in our tree, and the
 * fix is upstream in the keys rather than in the stylesheet.
 *
 * ## Reduced motion is modelled, not stubbed
 *
 * Every case runs twice: once in a default context, once with `reducedMotion: 'reduce'`. The
 * page puts `transition-duration` **inside** `@media (prefers-reduced-motion: no-preference)`
 * and nothing outside it, which is the exact opt-IN polarity `packages/primitives/src/chart.css`
 * uses and for the same reason — written the other way round, an engine that reports nothing
 * animates by default. Under `reduce` the duration falls back to the initial `0s` and the
 * change snaps. That means the reduced-motion column is not a second implementation being
 * tested; it is the *absence* of the first, which is the only version worth trusting.
 *
 * The invariant A6 rests on is in the FINAL column: reduced motion must remove the tween and
 * must never change the result. A row where `final` differs between the two runs is a bug in
 * the design, not in the probe.
 *
 * ⚠ Not in `pnpm verify`, on purpose. It needs a browser, and `.github/workflows/ci.yml` keeps
 * browser work in a separate `browser` job so the fast lane stays fast. Run it by hand:
 * `pnpm probe:motion`.
 */

import { openChromium } from './check-containment.mjs'

/**
 * ⚠ Long enough that a sampled frame lands unambiguously mid-flight. At 60 Hz a 600 ms
 * transition gives ~36 frames and we read 8 of them, so "no intermediate value appeared" means
 * the property is discrete rather than that we blinked. A 120 ms duration — what chart.css
 * currently uses for opacity — would make a missed frame indistinguishable from a snap.
 */
const DURATION_MS = 600
const SAMPLE_FRAMES = 8

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   markup: string,
 *   prop: string,
 *   attr: string,
 *   from: string,
 *   to: string,
 *   note?: string,
 *   replace?: boolean,
 * }} ProbeCase
 */

/**
 * ⚠ `opacity` is first and is not padding. It is the control: it is unambiguously animatable
 * and chart.css already transitions it in production. If the control reports "discrete" the
 * harness is broken and every other row in the table is noise — so read it first, always.
 *
 * The geometry cases mirror what the render tree actually emits, per decision 012: `<rect>`
 * for ticks and gridlines, `<circle>` for points, `<path>` for lines and areas, `<g>` for the
 * plot-origin translate. No case uses `<line>`, because 012 banned it from tokened geometry
 * and there is nothing to learn about an element we do not emit.
 *
 * @type {readonly ProbeCase[]}
 */
const CASES = [
  {
    id: 'control-opacity',
    label: 'CONTROL · opacity on <rect>',
    markup: '<rect id="t" x="0" y="0" width="40" height="10" opacity="1"/>',
    prop: 'opacity',
    attr: 'opacity',
    from: '1',
    to: '0.2',
    note: 'Must interpolate. If it does not, distrust this whole table.',
  },
  {
    id: 'path-d-equal',
    label: '<path> d — equal command count (a resize)',
    markup: '<path id="t" fill="none" stroke="black" d="M0,0L10,20L20,15"/>',
    prop: 'd',
    attr: 'd',
    from: 'M0,0L10,20L20,15',
    to: 'M0,0L20,40L40,30',
    note: 'Same points, new coordinates. This is what a drag does to every series.',
  },
  {
    id: 'path-d-unequal',
    label: '<path> d — UNEQUAL command count (a rung change)',
    markup: '<path id="t" fill="none" stroke="black" d="M0,0L10,20L20,15"/>',
    prop: 'd',
    attr: 'd',
    from: 'M0,0L10,20L20,15',
    to: 'M0,0L10,20L20,15L30,25L40,5',
    note: 'A point-budget change. Interpolation between different command lists is the open question.',
  },
  {
    id: 'rect-x',
    label: '<rect> x — a gridline sliding',
    markup: '<rect id="t" x="0" y="0" width="2" height="40"/>',
    prop: 'x',
    attr: 'x',
    from: '0',
    to: '30',
  },
  {
    id: 'rect-y',
    label: '<rect> y',
    markup: '<rect id="t" x="0" y="0" width="40" height="2"/>',
    prop: 'y',
    attr: 'y',
    from: '0',
    to: '30',
  },
  {
    id: 'rect-width',
    label: '<rect> width — a gridline spanning a wider plot',
    markup: '<rect id="t" x="0" y="0" width="20" height="2"/>',
    prop: 'width',
    attr: 'width',
    from: '20',
    to: '60',
  },
  {
    id: 'rect-height',
    label: '<rect> height — a tick mark lengthening',
    markup: '<rect id="t" x="0" y="0" width="2" height="6"/>',
    prop: 'height',
    attr: 'height',
    from: '6',
    to: '18',
  },
  {
    id: 'circle-cx',
    label: '<circle> cx — a point mark sliding',
    markup: '<circle id="t" cx="10" cy="10" r="3"/>',
    prop: 'cx',
    attr: 'cx',
    from: '10',
    to: '50',
  },
  {
    id: 'circle-cy',
    label: '<circle> cy',
    markup: '<circle id="t" cx="10" cy="10" r="3"/>',
    prop: 'cy',
    attr: 'cy',
    from: '10',
    to: '40',
  },
  {
    id: 'circle-r',
    label: '<circle> r',
    markup: '<circle id="t" cx="20" cy="20" r="3"/>',
    prop: 'r',
    attr: 'r',
    from: '3',
    to: '9',
    note: 'Already a token (--shiftcharts-point-radius) per 012. Does it also tween?',
  },
  {
    id: 'g-transform',
    label: '<g> transform — the plot-origin translate',
    markup: '<g id="t" transform="translate(0,0)"><rect x="0" y="0" width="10" height="10"/></g>',
    prop: 'transform',
    attr: 'transform',
    from: 'translate(0,0)',
    to: 'translate(40,25)',
    note: 'Grid and Axis both translate to the plot origin, which moves on every resize.',
  },
  {
    id: 'replacement',
    label: 'REPLACED element — new node, final value (React re-key)',
    markup: '<rect id="t" x="0" y="0" width="2" height="40"/>',
    prop: 'x',
    attr: 'x',
    from: '0',
    to: '30',
    replace: true,
    note: 'The keying question. Expected: no transition — a new node has no previous value.',
  },
]

/**
 * The page. One SVG stage, one stylesheet, nothing else.
 *
 * ⚠ `transition-duration` and `transition-timing-function` live inside the media query and
 * `transition-property` does not. That split is deliberate: the property is set per case from
 * script, but the *duration* is what the media query withholds, so `reduce` leaves the initial
 * `0s` in place and the change snaps. Putting the whole shorthand inside the query would work
 * too; putting the duration outside it would make the reduced-motion column meaningless.
 */
const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  #t { transition-property: none; }
  @media (prefers-reduced-motion: no-preference) {
    #t { transition-duration: ${DURATION_MS}ms; transition-timing-function: linear; }
  }
</style></head>
<body><svg id="stage" width="200" height="200" viewBox="0 0 200 200"></svg></body></html>`

/**
 * Run one case in one page and report what the browser did.
 *
 * ⚠ The verdict is `samples.some(v => v !== final)`, and the phrasing matters. A discrete
 * property shows the FINAL value on the very first frame after the change, so every sample
 * equals `final`. An interpolated one shows at least one value that is neither start nor
 * final. Comparing against `start` instead would misread a transition caught late; comparing
 * sample-to-sample would misread a linear tween that happened to be sampled twice on the same
 * frame. Comparing against the settled value is the only version with no false negative.
 *
 * @param {any} page
 * @param {ProbeCase} probeCase
 * @returns {Promise<{ start: string, final: string, samples: string[], interpolated: boolean }>}
 */
/* eslint-disable no-undef -- The callback below is serialised by `page.evaluate()` and runs
   inside Chromium, never in Node. `scripts/**` is configured with node globals only
   (eslint.config.js), which is correct for every other line in this file; adding browser
   globals to the whole scripts glob to satisfy one function would relax the config for every
   gate in the directory. `scripts/check-containment.mjs` scopes it the same way, for the same
   reason. */
async function runCase(page, probeCase) {
  return page.evaluate(
    async ({ c, frames, settleMs }) => {
      // ⚠ No `/** @type */ (x)` casts anywhere in this function body, and that is not a style
      // preference. This repo is semicolon-free, and a statement beginning with `(` after a
      // comment does NOT get automatic semicolon insertion — `foo()` on one line followed by a
      // cast on the next parses as `foo()(x)`, which throws "is not a function" and points at
      // the wrong line. It cost a debugging cycle here. Inside `page.evaluate` the code runs in
      // the browser and is not typechecked, so the casts bought nothing anyway.
      const stage = document.getElementById('stage')
      stage.innerHTML = c.markup
      let el = document.getElementById('t')

      // Pin the starting value with transitions off, so the setup cannot animate and leak into
      // the samples.
      el.style.transitionProperty = 'none'
      el.setAttribute(c.attr, c.from)
      el.getBoundingClientRect()
      const start = getComputedStyle(el).getPropertyValue(c.prop)

      // Arm the transition, then force a style recalc so the browser has a *previous computed
      // value* on record. Without this flush the arm and the change coalesce into one recalc and
      // there is nothing to transition from — which would fake a "discrete" verdict on a
      // property that animates perfectly well.
      el.style.transitionProperty = c.prop
      el.getBoundingClientRect()

      if (c.replace) {
        // The React re-key, reproduced literally: drop the node, insert a fresh one already
        // carrying the final value. Same markup, same stylesheet, new identity.
        el.remove()
        stage.innerHTML = c.markup
        el = document.getElementById('t')
        el.style.transitionProperty = c.prop
        el.setAttribute(c.attr, c.to)
      } else {
        el.setAttribute(c.attr, c.to)
      }

      const samples = []
      await new Promise((resolve) => {
        let n = 0
        const tick = () => {
          samples.push(getComputedStyle(el).getPropertyValue(c.prop))
          n += 1
          if (n < frames) requestAnimationFrame(tick)
          else resolve(undefined)
        }
        requestAnimationFrame(tick)
      })

      await new Promise((resolve) => setTimeout(resolve, settleMs))
      const final = getComputedStyle(el).getPropertyValue(c.prop)

      return { start, final, samples, interpolated: samples.some((v) => v !== final) }
    },
    { c: probeCase, frames: SAMPLE_FRAMES, settleMs: DURATION_MS + 200 },
  )
}
/* eslint-enable no-undef */

/**
 * @param {any} browser
 * @param {boolean} reduce
 * @returns {Promise<Map<string, { start: string, final: string, samples: string[], interpolated: boolean }>>}
 */
async function runAll(browser, reduce) {
  const context = await browser.newContext(reduce ? { reducedMotion: 'reduce' } : {})
  const page = await context.newPage()
  await page.setContent(PAGE)
  const results = new Map()
  for (const probeCase of CASES) {
    results.set(probeCase.id, await runCase(page, probeCase))
  }
  await context.close()
  return results
}

/** @param {string} v */
const short = (v) => (v.length > 34 ? `${v.slice(0, 31)}…` : v)

const { browser, from } = await openChromium('motion probe')
const version = browser.version()

const motion = await runAll(browser, false)
const reduced = await runAll(browser, true)
await browser.close()

console.log(`\nmotion probe — Chromium ${version} (playwright from ${from})`)
console.log(`  ${DURATION_MS}ms linear, ${SAMPLE_FRAMES} sampled frames, attribute-driven\n`)

const rows = []
for (const probeCase of CASES) {
  const m = /** @type {any} */ (motion.get(probeCase.id))
  const r = /** @type {any} */ (reduced.get(probeCase.id))
  rows.push({
    case: probeCase.label,
    animates: m.interpolated ? 'YES' : 'no',
    'reduce suppresses': r.interpolated ? '⚠ NO' : 'yes',
    'same final': m.final === r.final ? 'yes' : '⚠ NO',
  })
}
console.table(rows)

console.log('\nEvidence — a mid-flight sample per case:\n')
for (const probeCase of CASES) {
  const m = /** @type {any} */ (motion.get(probeCase.id))
  // ⚠ Neither `start` nor `final`. A sample that merely differs from `final` can still BE the
  // start value — the first sampled frame often is, because the transition begins on the frame
  // after the change — and printing that as evidence of interpolation proves nothing. A value
  // distinct from both endpoints is the only sample that could not exist without a tween.
  const mid =
    m.samples.find((/** @type {string} */ v) => v !== m.final && v !== m.start) ??
    '(none — no value between the endpoints)'
  console.log(`  ${probeCase.id}`)
  console.log(`    start  ${short(m.start)}`)
  console.log(`    mid    ${short(mid)}`)
  console.log(`    final  ${short(m.final)}`)
  if (probeCase.note !== undefined) console.log(`    note   ${probeCase.note}`)
}

// ⚠ Exits 0 unconditionally, including when the control fails. A probe that can fail is a
// gate, and a gate nobody agreed to add gets deleted rather than fixed. The verdicts belong
// in decision 016, where a human reads them.
const control = /** @type {any} */ (motion.get('control-opacity'))
if (!control.interpolated) {
  console.log('\n⚠ THE CONTROL DID NOT INTERPOLATE. The harness is wrong; ignore every row above.')
}
console.log('\nProbe only — nothing asserted. Findings belong in research/decisions/016-*.md.')
