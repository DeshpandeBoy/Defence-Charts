/**
 * Gate **G4** — the chart renders on a server, with no client JavaScript.
 *
 * `research/maps/04-ci-gate-map.md` states it in one line: *"Next.js App Router page
 * rendering `<Chart plan={…}>` in a **server component with JS disabled**, asserting the SVG
 * is in the HTML"*, failing when *"the RSC path silently degrades to SSR + hydration."* That
 * last clause is the whole gate, and it is also the reason the obvious implementation of it
 * does not work.
 *
 * ## ⚠ "The SVG is in the HTML" is not, on its own, a test of anything
 *
 * Turn JavaScript off and load a Next.js page. If `<Chart>` is a **server component**, the
 * SVG is in the HTML. If `<Chart>` is a **client component** rendered on the server and
 * hydrated in the browser, the SVG is *also* in the HTML — that is what SSR is for. The two
 * architectures this gate exists to tell apart produce byte-similar first paints, and a gate
 * asserting only the first paint would pass on both. It would be a spelling test for
 * `<svg>`, printed in green, protecting nothing.
 *
 * So G4 asserts **two** things, and only the pair is a gate:
 *
 * 1. **With `javaScriptEnabled: false`, the chart is in the DOM** — the `<svg>`, a `<path>`
 *    carrying real geometry, and the accessible title. This is the user-visible claim.
 * 2. **The client JavaScript the build produced contains no chart code.** Searched for
 *    string literals that survive minification (class names, the `role` value, a `throw`
 *    message from the resolver). This is the architectural claim, and it is the one that
 *    fails the moment someone reaches for `"use client"` to make a hook compile.
 *
 * ⚠ **Assertion 1 is assertion 2's vacuity check, and that is why they ship together.** A
 * page that renders no chart at all trivially satisfies assertion 2 — there is no chart code
 * in the bundle because there is no chart. Read alone, assertion 2 is green on a blank page.
 * Assertion 1 is what makes "no chart code shipped" mean "the chart rendered without it".
 *
 * ⚠ **The RSC flight payload in the HTML is not a violation, and the scan must not read it.**
 * App Router serialises the rendered element tree into inline `self.__next_f.push(...)`
 * scripts, so `"shiftcharts-chart__svg"` and `"graphics-document"` appear in the document as **data**
 * on a page that is doing exactly the right thing. Grepping the HTML would therefore fail a
 * correct RSC page — a gate that fires on success is worse than no gate, because the first
 * fix anyone reaches for is to delete it. The scan reads `.next/static/`, which is compiled
 * client **code**, and nothing else.
 *
 * ## What this gate found the first time it ran — and what it did not
 *
 * ⚠ **The predicted failure did not happen, and the prediction is recorded here because it
 * was wrong in a way worth keeping.** This gate was written expecting a red first run:
 * `packages/primitives/src/Chart.tsx` calls `useId()` and `useMemo()`, and the expectation
 * was that React Server Components support neither. That is false. React 19's `react-server`
 * build exports both — `useState`, `useEffect`, `useRef`, `useReducer` and `useLayoutEffect`
 * are the ones it replaces with a throwing `unsupportedHook`. `Chart.tsx`'s own docblock said
 * so, correctly, and the gate's author did not believe it. The fixture builds, renders, and
 * ships zero chart bytes to the client.
 *
 * ⚠ **`useMemo` on the server is literally `nextCreate => nextCreate()`** — the Flight server
 * implements it as an immediate call with the dependency array ignored. This sharpens rather
 * than contradicts `Chart.tsx`'s note that the memo is *"a hint, not a correctness
 * mechanism"*: on this path it is not even a hint. `resolveFrame()` runs once per request
 * either way, and the memo earns its keep only client-side, under `<AutoChart>`'s
 * `ResizeObserver`.
 *
 * **What survives the correction is the reason this gate exists at all.** A4's
 * zero-client-JS proof was a node test calling `renderToStaticMarkup()`, which is **SSR** —
 * a different renderer, a different dispatcher, and a path on which every one of those hooks
 * works. It went green without ever exercising the architecture it was named after. The
 * proof was vacuous whether or not the thing it failed to test was broken, and finding out
 * which took a real App Router build. That is this project's recurring failure species: a
 * thing that looks like it works and quietly doesn't — here, the *test* rather than the code.
 *
 * ## ⚠ Assertion 1b: `useId()` stamps which renderer ran into the HTML
 *
 * The best thing this gate found, and it was found while disproving the paragraph above.
 * The two dispatchers generate ids with different literal infixes:
 *
 * - `react-server-dom-turbopack-server`: `'_' + prefix + 'S_' + n.toString(32) + '_'` — **S
 *   for Server**, the RSC Flight renderer.
 * - `react-dom`'s SSR renderer: `_R_…` — the path `renderToStaticMarkup` takes.
 *
 * `<Chart>` feeds `useId()` into `aria-labelledby`, so the winning dispatcher's initial is
 * *in an attribute of the shipped document*. This is the direct discriminator the top of this
 * docblock says a first-paint assertion cannot be — a positive reading of which renderer ran,
 * rather than an inference from what is absent. An `_R_` id is SSR-degradation caught in the
 * act, with no bundle scan required.
 *
 * ⚠ **It is a React internal, and it is asserted as one.** No public API promises this
 * format, so the gate fails *both* on seeing `R_` (degradation) and on recognising neither
 * infix (the discriminator has rotted and is no longer discriminating). It never silently
 * stops asserting — that is the exact species named above. If React changes the format,
 * assertions 1 and 2 still stand on their own and the remedy is to re-derive the infixes from
 * `node_modules/react/cjs/react.react-server.*.js`, which is where these came from.
 *
 * ⚠ This only works because the fixture **does not pass an `id` prop**. `Chart.tsx` reads
 * `id ?? useId()`, so supplying one would leave `useId()` called and its result discarded,
 * and nothing about the renderer would reach the HTML.
 *
 * ## Observed failing, on a real build — 2026-08-23
 *
 * Decision 015: *a gate never observed to fail is not a gate.* Planted by adding a single
 * `"use client"` line to `apps/rsc-fixture/app/page.tsx` and rebuilding. What came back:
 *
 * ```
 * useid-ssr  the title id is "_R_avb_-title" — the `R_` infix is stamped by react-dom (SSR)
 * client-js  "shiftcharts-chart__svg" … is compiled into .next/static/chunks/40sr3mooet0z9.js
 *            … ,children:[(0,o.jsxs)("svg",{className:"shiftcharts-chart__svg",role:"graphics-doc …
 * ```
 *
 * — plus all six markers, in one chunk. Three things this confirmed that no amount of
 * reasoning would have:
 *
 * 1. **Assertion 1 stayed green throughout.** The SVG, the geometry and the title were all
 *    present with JavaScript disabled, on a page shipping the entire library to the browser.
 *    The opening section of this docblock is not a theoretical worry; it is a measurement.
 * 2. **Assertion 1b fired on one letter**, `_R_` where `_S_` belonged, before the bundle was
 *    consulted at all.
 * 3. **The excerpts vindicate literals-not-identifiers.** `Chart` had become `o.jsxs`,
 *    `resolveFrame` was inlined, `titleId` was `d` — and `"shiftcharts-chart__svg"` was still
 *    `"shiftcharts-chart__svg"`, because it has to reach the DOM. A gate searching for function names
 *    would have read that chunk and found nothing.
 *
 * ## Why a real build, every time
 *
 * The gate runs `next build` rather than trusting a `.next` directory it finds. A stale
 * build is the cheapest possible way for this gate to lie: edit `Chart.tsx`, add
 * `"use client"`, run the gate, watch it pass on chunks compiled before the edit. Roughly
 * thirty seconds of build time buys the guarantee that the bytes being searched are the
 * bytes this source tree produces. `SHIFTCHARTS_RSC_SKIP_BUILD=1` exists for iterating on the gate
 * itself and prints a warning every time it is used, because it turns the gate back into
 * something that can lie.
 *
 * ⚠ Port **3210**, not 3000. `scripts/check-containment.mjs` runs the playground on 5173 and
 * both gates run in the same CI job; 3000 is the port a developer most likely already has
 * something on, and attaching to a stranger's server is a failure mode with no error
 * message. The dev-server lifecycle here is deliberately the same shape as that file's —
 * `detached: true` and `process.kill(-pid)` — for the same reason: `npx` spawns `pnpm`
 * spawns `next`, and killing the pid we hold leaves the grandchild holding the port.
 *
 * ⚠ Playwright resolution is **imported** from `check-containment.mjs` rather than repeated.
 * Two browser gates with two independently-drifting opinions about where Playwright lives is
 * the same duplication that file's docblock argues against for the CI job, one level down.
 *
 * ⚠ Plain JavaScript with JSDoc types, deliberately, matching `check-tokens.mjs`,
 * `check-api.mjs` and `check-containment.mjs`. It runs on the `engines.node` floor with no
 * build step and no loader.
 */

import { spawn } from 'node:child_process'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { openChromium } from './check-containment.mjs'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const FIXTURE_DIR = join(REPO_ROOT, 'apps/rsc-fixture')
const STATIC_DIR = join(FIXTURE_DIR, '.next/static')

const ORIGIN = process.env.SHIFTCHARTS_RSC_ORIGIN ?? 'http://localhost:3210/'

/** The accessible name the fixture is contracted to render. Coordinated, not guessed. */
const EXPECTED_TITLE = 'RSC fixture line chart'

/**
 * String literals that only exist because chart code was compiled into a file.
 *
 * ⚠ **Literals, not identifiers.** A minifier renames `planChart` to `a` and inlines
 * `resolveFrame` out of existence, so searching for function names finds nothing in a
 * production bundle that is full of chart code. String literals are load-bearing at runtime
 * — a class name has to survive to reach the DOM, a `role` value has to survive to reach the
 * accessibility tree, a `throw` message has to survive to be thrown — so they are the part
 * of our code a bundler is not permitted to rewrite.
 *
 * ⚠ Each one is scoped tightly enough that a false positive would have to be someone else's
 * deliberate reference to us. `shiftcharts-` is this library's prefix and appears nowhere in React,
 * React-DOM or Next; `graphics-document` is a WAI-ARIA Graphics Module role that no framework
 * has cause to name; the resolver's message is a sentence.
 *
 * @type {ReadonlyArray<{ literal: string, why: string }>}
 */
export const MARKERS = [  { literal: 'shiftcharts-chart__svg', why: '<Chart>’s own <svg> className' },
  { literal: 'graphics-document', why: '<Chart>’s role, per 20-architecture.md §7.3' },
  { literal: 'shiftcharts-chart__caption', why: '<Chart>’s <figcaption>' },
  { literal: 'shiftcharts-axis__tick', why: '<Axis> tick marks' },
  { literal: 'shiftcharts-grid__line', why: '<Grid> gridlines' },
  { literal: 'planChart: chart type', why: 'the resolver’s unsupported-type throw' },
]

/**
 * Below this, "no chart code in the client bundle" is a statement about an empty directory.
 *
 * ⚠ Measured against what Next.js 16 ships for a page with **zero** client components: the
 * framework runtime, the router, and React-DOM are hundreds of kilobytes on their own. A
 * floor of 50 KB cannot be reached by an accident and cannot be missed by a real build, which
 * is the only property a vacuity floor needs.
 */
const MIN_CLIENT_BYTES = 50_000

// --- The fixture, built and served -----------------------------------------------------

/**
 * @param {string} label
 * @param {string[]} args
 * @returns {Promise<{ code: number, output: string }>}
 */
function run(label, args) {
  return new Promise((resolve) => {
    const child = spawn('npx', ['--yes', 'pnpm@10.34.5', ...args], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    const collect = (/** @type {Buffer} */ chunk) => {
      output += chunk.toString()
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    child.on('error', (error) => resolve({ code: 1, output: `${label}: ${error.message}` }))
    child.on('close', (code) => resolve({ code: code ?? 1, output }))
  })
}

/**
 * @param {string} origin
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
async function answers(origin, timeoutMs = 2000) {
  try {
    const response = await fetch(origin, { signal: AbortSignal.timeout(timeoutMs) })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Start `next start` on the fixture's port, killing the whole process group on the way out.
 *
 * ⚠ Unlike the containment gate, an already-listening server is **not** accepted. That gate
 * attaches to a running playground because a developer dragging the corner by hand wants the
 * gate to look at the page they are looking at. Here the thing under test is a *build*, and
 * a server started before the build finished is serving the previous one — the stale-build
 * failure the docblock above spends a paragraph on, arriving through a different door.
 *
 * @returns {Promise<{ stop: () => void }>}
 */
async function startServer() {
  if (await answers(ORIGIN)) {
    throw new Error(
      `something is already listening on ${ORIGIN}. This gate refuses to attach to it: it ` +
        'would be asserting about a build it did not make. Stop that process and re-run.',
    )
  }

  const child = spawn(
    'npx',
    ['--yes', 'pnpm@10.34.5', '--filter', '@shiftcharts/rsc-fixture', 'start'],
    { cwd: REPO_ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
  )

  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    try {
      if (child.pid !== undefined) process.kill(-child.pid, 'SIGTERM')
    } catch {
      // Already gone. The goal was the absence, and it is here.
    }
  }
  process.once('exit', stop)
  process.once('SIGINT', () => { stop(); process.exit(130) })
  process.once('SIGTERM', () => { stop(); process.exit(143) })

  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    if (await answers(ORIGIN, 1000)) return { stop }
    await new Promise((r) => globalThis.setTimeout(r, 500))
  }
  stop()
  throw new Error(`the fixture never answered on ${ORIGIN} within 90s`)
}

// --- Assertion 2: what the build actually shipped ---------------------------------------

/**
 * Every `.js` file under `.next/static`, recursively.
 *
 * ⚠ **`.js` only, and the filter is load-bearing rather than tidy.** `<Chart>`'s stylesheet
 * is imported as a side effect, so Next compiles it to `.next/static/chunks/*.css` — a file
 * that legitimately contains `shiftcharts-chart__svg`, `shiftcharts-chart__caption`, `shiftcharts-axis__tick` and
 * `shiftcharts-grid__line`, because those are the selectors it is made of. Verified by scanning a real
 * build: every one of those markers appears in the CSS chunk and none appears in any `.js`
 * chunk. Widening this to "every file under `.next/static`" would therefore fail a perfectly
 * correct RSC page on its stylesheet, and the obvious repair — deleting the marker that
 * "false-positives" — would quietly remove the strongest signal the gate has.
 *
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
export async function collectClientScripts(dir) {
  /** @type {string[]} */
  const found = []
  /** @type {string[]} */
  const queue = [dir]
  while (queue.length > 0) {
    const current = queue.pop()
    if (current === undefined) break
    /** @type {import('node:fs').Dirent[]} */
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) queue.push(full)
      else if (entry.name.endsWith('.js')) found.push(full)
    }
  }
  found.sort()
  return found
}

/**
 * @typedef {{ marker: string, why: string, file: string, excerpt: string }} Leak
 */

/**
 * @param {string[]} files
 * @param {string} [relativeTo] Where the reported paths are anchored. Defaults to the
 *   fixture, which is what a failure message should quote; tests pass their own root.
 * @returns {Promise<{ leaks: Leak[], bytes: number }>}
 */
export async function scanForChartCode(files, relativeTo = FIXTURE_DIR) {
  /** @type {Leak[]} */
  const leaks = []
  let bytes = 0
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    bytes += source.length
    for (const { literal, why } of MARKERS) {
      const at = source.indexOf(literal)
      if (at === -1) continue
      leaks.push({
        marker: literal,
        why,
        file: relative(relativeTo, file),
        // Enough surrounding bytes to tell a compiled component from a stray comment,
        // short enough that fifteen of them do not bury the sentence that explains them.
        excerpt: source.slice(Math.max(0, at - 40), at + literal.length + 40).replace(/\s+/g, ' '),
      })
    }
  }
  return { leaks, bytes }
}

// --- Assertion 1: what the browser sees with JavaScript switched off ---------------------

/* eslint-disable no-undef -- Serialised by `page.evaluate()` and run inside Chromium, never
   in Node. `scripts/**` is configured with node globals only (eslint.config.js), which is
   correct for every other line in this file. */

/**
 * One reading of the rendered chart. Everything assertion 1 needs, in one round trip.
 */
function readChart() {
  const figure = document.querySelector('.shiftcharts-chart')
  const svg = document.querySelector('.shiftcharts-chart__svg')
  const paths = svg === null ? [] : [...svg.querySelectorAll('path')]
  const drawn = paths.filter((p) => (p.getAttribute('d') ?? '').length > 8)
  const title = svg === null ? null : svg.querySelector('title')
  return {
    figureFound: figure !== null,
    svgFound: svg !== null,
    role: svg === null ? null : svg.getAttribute('role'),
    sizeClass: figure === null ? null : (figure.dataset.sizeClass ?? null),
    pathCount: paths.length,
    drawnPathCount: drawn.length,
    titleText: title === null ? null : (title.textContent ?? '').trim(),
    // Assertion 1b's whole input. `<Chart>` builds this from `id ?? useId()` and the fixture
    // passes no `id`, so the generated value — and with it the initial of the renderer that
    // generated it — is here verbatim.
    titleId: title === null ? null : title.getAttribute('id'),
    // ⚠ The count that distinguishes "rendered" from "rendered as an empty <svg>". A plan
    // that resolved but drew nothing would satisfy every selector above.
    markCount: svg === null ? 0 : svg.querySelectorAll('path, rect, circle, text').length,
    // Read back so a failure message can quote what was there instead of what was absent.
    bodyText: (document.body.textContent ?? '').slice(0, 200).replace(/\s+/g, ' '),
  }
}

/* eslint-enable no-undef */

/**
 * The infix React stamps into a `useId()` value, per renderer.
 *
 * ⚠ Read out of `react@19`'s own builds, not guessed: the Flight server composes
 * `'_' + identifierPrefix + 'S_' + n.toString(32) + '_'`, and `react-dom`'s SSR renderer uses
 * `R_` in the same position. `identifierPrefix` sits between the leading underscore and the
 * infix and is empty by default, which is why these are matched with a pattern rather than a
 * `startsWith`.
 */
const DISPATCHER = [
  { infix: 'S_', pattern: /^_[^_]*S_/, renderer: 'react-server (RSC Flight)', ours: true },
  { infix: 'R_', pattern: /^_[^_]*R_/, renderer: 'react-dom (SSR)', ours: false },
]

/**
 * @typedef {{ kind: string, detail: string }} Failure
 */

/**
 * Assertion 1, in one place so there is one place to read it.
 *
 * @param {ReturnType<typeof readChart>} c
 * @returns {Failure[]}
 */
export function judgeChart(c) {
  /** @type {Failure[]} */
  const out = []
  if (!c.svgFound) {
    out.push({
      kind: 'no-svg',
      detail:
        'with JavaScript disabled there is no `.shiftcharts-chart__svg` in the document — the chart ' +
        `needs a browser to exist. Page said: "${c.bodyText}"`,
    })
    // Everything below reads from an element that is not there; one finding, not six.
    return out
  }
  if (!c.figureFound) {
    out.push({
      kind: 'no-figure',
      detail: 'the <svg> rendered but its `.shiftcharts-chart` <figure> did not — the root is wrong',
    })
  }
  if (c.role !== 'graphics-document') {
    out.push({
      kind: 'role',
      detail:
        `the <svg> carries role="${c.role}", not "graphics-document". role="img" is ` +
        'Children Presentational True: it erases every child from the accessibility tree, ' +
        'including the <title> the graphics roles exist to expose (20-architecture.md §7.3)',
    })
  }
  if (c.drawnPathCount === 0) {
    out.push({
      kind: 'no-geometry',
      detail:
        `${c.pathCount} <path> element(s) rendered and none carries a usable \`d\` — the ` +
        'markup arrived without the geometry, which is a server that ran the component but ' +
        'not the resolver',
    })
  }
  if (c.markCount < 2) {
    out.push({
      kind: 'empty-svg',
      detail:
        `the <svg> holds ${c.markCount} mark(s). An empty <svg> satisfies every selector ` +
        'this gate looks for while proving nothing about rendering',
    })
  }
  if (c.titleText !== EXPECTED_TITLE) {
    out.push({
      kind: 'title',
      detail:
        `the accessible title is ${JSON.stringify(c.titleText)}, expected ` +
        `${JSON.stringify(EXPECTED_TITLE)} — either the fixture changed or a different page ` +
        'answered on this port',
    })
  }
  // --- Assertion 1b: which renderer produced this document ------------------------------
  const stamped = c.titleId === null ? null : DISPATCHER.find((d) => d.pattern.test(c.titleId ?? ''))
  if (stamped === undefined || stamped === null) {
    out.push({
      kind: 'useid-rot',
      detail:
        `the title id is ${JSON.stringify(c.titleId)}, which carries neither React's server ` +
        "infix (`S_`) nor its SSR one (`R_`) — this gate's renderer discriminator no longer " +
        'discriminates. Assertions 1 and 2 above still stand on their own; this one has ' +
        'rotted and must be re-derived from node_modules/react/cjs/react.react-server.*.js ' +
        'rather than deleted. A check that silently stops checking is the failure this ' +
        'repository is built to catch',
    })
  } else if (!stamped.ours) {
    out.push({
      kind: 'useid-ssr',
      detail:
        `the title id is ${JSON.stringify(c.titleId)} — the \`${stamped.infix}\` infix is ` +
        `stamped by ${stamped.renderer}, not by the RSC Flight renderer. This page ` +
        'server-rendered and will hydrate: the chart you can see with JavaScript off is a ' +
        'first paint, not the finished article, and the whole library is on its way to the ' +
        'browser behind it',
    })
  }
  if (c.sizeClass === null) {
    out.push({
      kind: 'no-size-class',
      detail:
        'the <figure> has no `data-size-class` — the ladder did not resolve on the server, ' +
        'so whatever rendered was not a planned chart',
    })
  }
  return out
}

// --- CLI ---------------------------------------------------------------------------------

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href

if (invokedDirectly) {
  /** @type {Failure[]} */
  const failures = []
  /** @type {string[]} */
  const vacuous = []
  /** @type {string | null} */
  let fatal = null

  let fixturePresent = true
  try {
    await stat(join(FIXTURE_DIR, 'package.json'))
  } catch {
    fixturePresent = false
  }

  if (!fixturePresent) {
    console.error('rsc gate (G4): FAILED — apps/rsc-fixture is not there.')
    console.error('  This gate has no meaning without the page it asserts about, and a SKIP')
    console.error('  here would be a gate that reports green for a missing fixture.')
    process.exit(1)
  }

  // ⚠ **Before the build, not after, and the ordering is a deliberate courtesy.** A machine
  // with no browser downloaded is going to skip; making it spend thirty seconds compiling a
  // Next app first, and only then admit it cannot look at the result, is how a gate acquires
  // a reputation for wasting time. It also means the skip prints within a second of the
  // command being typed, which is when a reader is still watching the terminal.
  //
  // ⚠ **`openChromium()` is imported, not reimplemented.** It carries the half of the policy
  // that actually matters: that a *resolved package* and a *downloaded browser* are different
  // absences, that only the second is a legitimate opt-out, and that `SHIFTCHARTS_REQUIRE_BROWSER=1`
  // revokes even that. Two browser gates with two opinions about when a skip is honest is
  // exactly the drift the shared import exists to prevent — and the version that drifts is
  // always the one nobody runs.
  const { browser, from } = await openChromium('rsc gate (G4)')

  // --- Build ------------------------------------------------------------------------
  const skipBuild = process.env.SHIFTCHARTS_RSC_SKIP_BUILD === '1'
  if (skipBuild) {
    console.warn(
      'rsc gate (G4): ⚠ SHIFTCHARTS_RSC_SKIP_BUILD=1 — searching whatever `.next` already holds. ' +
        'These bytes are not known to come from this source tree.',
    )
  } else {
    const build = await run('build', ['--filter', '@shiftcharts/rsc-fixture', 'build'])
    if (build.code !== 0) {
      console.error('rsc gate (G4): FAILED — `next build` did not succeed.\n')
      console.error(build.output.split('\n').slice(-40).join('\n'))
      console.error(
        '\n⚠ A build error here is a finding, not an obstacle, and the shape of it matters. ' +
          'React 19\'s `react-server` build replaces `useState`, `useEffect`, `useRef`, ' +
          '`useReducer` and `useLayoutEffect` with a hook that throws; `useId`, `useMemo` and ' +
          '`useCallback` are real there and `@shiftcharts/primitives` is allowed to use them. So a ' +
          'compile failure naming one of the first five is this gate doing its job. Do not ' +
          'reach for `"use client"`: that makes the build pass and makes assertion 2 fail, ' +
          'which is the same finding one step later.',
      )
      process.exit(1)
    }
  }

  // --- Assertion 2, read off disk before the browser starts -------------------------
  const scripts = await collectClientScripts(STATIC_DIR)
  const { leaks, bytes } = await scanForChartCode(scripts)

  if (scripts.length === 0) {
    vacuous.push(
      `no .js files under ${relative(REPO_ROOT, STATIC_DIR)} — "the client bundle contains ` +
        'no chart code" is a statement about an empty directory',
    )
  } else if (bytes < MIN_CLIENT_BYTES) {
    vacuous.push(
      `only ${bytes} bytes of client JavaScript across ${scripts.length} file(s), below the ` +
        `${MIN_CLIENT_BYTES}-byte floor — Next ships more than this for a page with no ` +
        'client components at all, so the scan is looking in the wrong place',
    )
  }

  // --- Assertion 1, in a browser with JavaScript switched off ------------------------
  let server = null
  /** @type {ReturnType<typeof readChart> | null} */
  let chart = null
  try {
    server = await startServer()
    // ⚠ `javaScriptEnabled: false` is a **context** option, not a page one, and it has to be
    // set before the first navigation. Toggling it on a live page leaves already-executed
    // scripts executed, which is a page that hydrated and then stopped — the opposite of
    // what is being asserted.
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    const response = await page.goto(ORIGIN, { waitUntil: 'load', timeout: 30_000 })
    const status = response === null ? 0 : response.status()
    if (status !== 200) {
      vacuous.push(
        `${ORIGIN} answered ${status}, so every assertion below is about an error page`,
      )
    }

    // ⚠ The cast is here because `page.evaluate` is typed `any` — Playwright is resolved
    // dynamically, so the whole module arrives untyped and nothing downstream of it narrows.
    // It restores the type `readChart` already has rather than asserting a new one.
    const reading = /** @type {ReturnType<typeof readChart>} */ (await page.evaluate(readChart))
    chart = reading
    failures.push(...judgeChart(reading))
  } catch (error) {
    fatal = error instanceof Error ? error.message : String(error)
  } finally {
    // ⚠ `openChromium()` hands back an already-launched browser, so this close is
    // unconditional — there is no "we never got that far" case left to guard against. The
    // server is the one that can still be null: `startServer()` is the first statement in the
    // `try` and it is the statement most likely to throw.
    await browser.close().catch(() => {})
    if (server !== null) server.stop()
  }

  // ⚠ Ordered deliberately: assertion 1 is assertion 2's vacuity check, so a chart that did
  // not render turns a clean bundle scan from a result into a tautology, and the report has
  // to say which one it is holding.
  if (chart !== null && !chart.svgFound && leaks.length === 0) {
    vacuous.push(
      'the client bundle is clean because no chart rendered — assertion 2 passed for the ' +
        'reason that makes it meaningless',
    )
  }

  if (fatal !== null || vacuous.length > 0 || failures.length > 0 || leaks.length > 0) {
    console.error('rsc gate (G4): FAILED\n')
    if (fatal !== null) console.error(`  fatal      ${fatal}`)
    for (const v of vacuous) console.error(`  vacuous    ${v}`)
    for (const f of failures) console.error(`  ${f.kind.padEnd(10)} ${f.detail}`)
    for (const leak of leaks.slice(0, 15)) {
      console.error(
        `  client-js  "${leak.marker}" (${leak.why}) is compiled into ` +
          `${leak.file}\n             … ${leak.excerpt} …`,
      )
    }
    if (leaks.length > 15) {
      console.error(`  …          and ${leaks.length - 15} more of the same species`)
    }
    if (leaks.length > 0) {
      console.error(
        '\nChart code reached the client bundle. The usual cause is a `"use client"` ' +
          'directive added to make a hook compile — which turns a server component into an ' +
          'SSR-plus-hydration component that looks identical on first paint and ships the ' +
          'whole library to every visitor.',
      )
    }
    console.error('\nSee research/maps/04-ci-gate-map.md G4 and research/20-architecture.md §7.')
    process.exit(1)
  }

  console.log(
    `rsc gate (G4): server-rendered with JavaScript disabled — ` +
      `${chart?.markCount ?? 0} marks in a role="graphics-document" <svg> at size class ` +
      `${chart?.sizeClass ?? '?'}, stamped ${JSON.stringify(chart?.titleId ?? null)} by ` +
      `React's server renderer, and 0 of ${MARKERS.length} chart markers found in ` +
      `${Math.round(bytes / 1024)} KB of client JavaScript across ${scripts.length} chunk(s) ` +
      `(playwright from ${from}).`,
  )
}
