/**
 * Gate **G11** — containment, driven through a real browser.
 *
 * The rule, from `research/20-architecture.md` §3.3: *"the measured element's size must be
 * grid-determined, never content-determined, and a plan may only affect descendants of the
 * measured box."* A plan that changes the size **of** the box it was planned for feeds its
 * own `ResizeObserver`, and the browser's response is the thing that makes this worth a
 * gate — it does not crash, it does not throw into any handler you wrote, it drops a
 * delivery and prints `"ResizeObserver loop completed with undelivered notifications"` to a
 * console nobody is reading. `research/30-implementation-plan.md:435` lists it as a top
 * risk and settles the remedy in one sentence: *"A deadband cannot fix this class of bug —
 * only structure can."*
 *
 * ⚠ **This gate cannot be written in Vitest, and the reason is not convenience.**
 * `research/30-implementation-plan.md:240` says so directly: *"This one needs a real
 * browser — the fake cannot produce the loop error."* `FakeResizeObserver` in `@gx/testing`
 * exists so tests can **drive** resize deterministically; a driven observer has no
 * re-entrancy, no delivery queue, and therefore no loop to complete undelivered. Asserting
 * "no loop error" against it would pass on a chart that loops in every browser — this
 * project's recurring failure species, wearing the test framework's own clothes.
 *
 * ⚠ **NOT in `verify`, and NOT in `.github/workflows/ci.yml`, deliberately.** It needs a
 * browser binary in CI, and that provisioning is deferred to the shared browser job that
 * gate **G4** (`04-ci-gate-map.md:79`, the RSC-with-JS-disabled fixture) will bring with it
 * at A4/A5. Wiring one browser download into CI twice, for two gates, is the kind of
 * duplication that gets half-removed later. Until that job exists this runs as
 * `pnpm lint:containment`, by hand, and the deferral is recorded here rather than left as
 * an absence somebody has to reconstruct.
 *
 * ⚠ **Playwright is resolved leniently and a miss is a SKIP, not a failure.** Playwright is
 * not a dependency of this repo and must not become one to land this file: installed inside
 * the workspace, npm walks up into the pnpm workspace root and fails ERESOLVE. So the
 * import is tried three ways — `GX_PLAYWRIGHT_PATH`, the bare specifier, then a scratch
 * install outside the repo — and if none answers the gate prints why and exits 0. A gate
 * that hard-fails on a missing optional dependency takes `pnpm verify` down for everyone
 * who has not opted in, which is how a gate gets deleted rather than fixed.
 *
 * ## ⚠ Two boxes since A5, and reading the wrong one made this gate lie
 *
 * Through A4 the playground hand-wired its own `useElementSize` onto `.widget` and rendered
 * `<Chart>` straight into it, so *the box the sweep drags* and *the box the library observes*
 * were one element. At A5 the playground migrated to `<AutoChart>`, which brings its own
 * `.gx-auto-chart` wrapper — measured by the library, and carrying its own `overflow: hidden`
 * as part of the containment contract. From that commit onward the two are different
 * elements, one nested in the other, with a clipping boundary between them.
 *
 * Every containment number kept being read from `.widget`, which is **outside** that
 * boundary. The wrapper absorbed the spill, `.widget.scrollHeight` equalled
 * `.widget.clientHeight` at every one of 178 samples, and the run printed
 * `0 px unattributed overflow (peak 0 px)` for a `<figcaption>` measured minutes earlier in
 * the same browser at 20.5 px taller than the box holding it. Nothing failed. Nothing
 * warned. The gate was green because it had stopped looking at the chart.
 *
 * So the split is explicit now: **judge the observed box, drag the outer one.**
 * `clientWidth/Height`, `scrollbar*` and `overflow*` come from `.gx-auto-chart`;
 * `offsetWidth/Height` stay on `.widget`, because that is what the drag asked for and what a
 * failure message must quote back; and assertion 2 watches **both**, because `.widget` has an
 * explicit `height` and would sit perfectly still while the wrapper inside it ran away.
 * `observedFound` travels on every sample and a vacuity check refuses to believe a green run
 * that never located the wrapper — so a revert to hand-wiring fails loudly instead of quietly
 * grading a different box, which is the whole lesson of the paragraph above.
 *
 * ## What is asserted, and what each assertion is for
 *
 * 1. **The loop error never fires.** `console` and `pageerror`, matched case-insensitively
 *    on `/resizeobserver loop/`. The direct observation, and by measurement the **weakest**
 *    of the four — see below.
 * 2. **The measured box never moves on its own.** Read both border boxes — `.widget`'s and
 *    `.gx-auto-chart`'s — wait three frames with no input, read them again. This is G11's own
 *    sentence — *"assert no plan field alters the measured box"* (`04-ci-gate-map.md:86`) —
 *    checked literally, and it fires whether or not the browser chose to emit anything.
 * 3. **No scrollbar gutter.** `offsetWidth - clientWidth - borderX`, and the block-axis
 *    twin. A classic scrollbar takes ~15 px out of the content box, the observer fires on
 *    the smaller number, and the chart is replanned by a value the chart itself caused.
 * 4. **Nothing the *plan* sizes overflows the box.** `scrollWidth - clientWidth`, with one
 *    named exemption (below). Overflow is the *fuel*: without it there is no scrollbar on
 *    any platform, so asserting zero is the structural claim rather than the observational
 *    one.
 *
 * ⚠ **ASSERTION 1 IS THE ONE YOU CANNOT RELY ON, AND THAT WAS MEASURED, NOT ASSUMED.**
 * Planting the containment rule's exact negation — giving `.widget` a content-determined
 * height, so the box is sized by what the chart draws in it — produced a box that grew
 * `288 → 844 → 1603 → 2279 → 3038 → 3776 → 4514` px across six frames and **never
 * stopped**. Chromium emitted *nothing*: no console error, no `pageerror`, no loop
 * warning. The error fires when an observation re-triggers itself *within one delivery
 * cycle* past the depth limit; a runaway paced one growth per animation frame delivers
 * cleanly every time and is, from the browser's point of view, simply a page whose layout
 * keeps changing. So a gate built on assertion 1 alone would have watched the worst
 * containment failure this project can have and printed `0 loop errors`. Assertions 2–4
 * are not belt-and-braces; assertion 2 is what actually caught it.
 *
 * ⚠ **Assertion 3 is inert on macOS and that is measured, not assumed.** macOS Chromium
 * draws overlay scrollbars, which take **zero** layout space; `overflow: auto` and
 * `overflow: hidden` produce byte-identical geometry on this page — verified by planting
 * `overflow: auto` on `.widget` and finding the widget genuinely scrollable
 * (`scrollTop` moves to 21) with `offsetWidth - clientWidth - border` still exactly `0`.
 * Neither `--disable-features=OverlayScrollbar` nor a `::-webkit-scrollbar` rule changes
 * it — the setting comes from NSScroller, not from anything a page or a flag can reach.
 * So on a developer's Mac assertion 3 can never fire, and the gate leans on 2 and 4; on
 * the Linux CI image, where scrollbars are classic and take 15 px, 3 is the one that fires
 * first. Both are shipped because neither platform covers the other, and saying so here is
 * cheaper than someone concluding from a green Mac run that the hazard is gone.
 *
 * ⚠ **THE ONE EXEMPTION, and why it is not an allowlist.** `<Chart>` puts the accessible
 * data table in a `<figcaption>` **outside** the `<svg>` — `packages/core/src/plan.ts:363`
 * and `packages/core/src/frame.ts:197` both state this as the design, and `frame.ts` is
 * explicit that the caption is *"laid out by the document"* and has no rectangle in the
 * plan's coordinate space. So the plan sizes the `<svg>` and the document sizes the
 * caption, and on this page the caption's ~21 px of margin box sits below a `<svg>` that
 * already fills the content box. Under `.gx-auto-chart`'s `overflow: hidden` it is clipped
 * and inert — and that clipping is exactly what hid it from a gate reading `.widget`, so the
 * exemption and the two-box split are the same finding seen from two sides. Rather than allowlist a number, the gate **measures the caption every step** and
 * requires every pixel of block-axis overflow to be attributable to it: one pixel more and
 * the gate fires, and if the caption ever stops rendering the budget is 0 automatically.
 * The inline axis has no exemption at all. The peak attributed overflow is printed on the
 * success line so the shortfall is stated on every run instead of being silently tolerated
 * — `research/decisions/015-token-gate-is-a-parser.md`'s point, that a gate which cries
 * wolf gets switched off, has a mirror image: a gate that swallows a known defect teaches
 * the reader the defect is not there.
 *
 * ⚠ **A sweep that does not sweep must fail loudly.** The gate asserts that all six size
 * classes were observed and that at least one rung change happened. Without it the whole
 * script degrades into an expensive way of loading a page: `page.mouse.move()` on a widget
 * below the viewport fold silently does nothing, every assertion passes on one unchanging
 * size, and the run is indistinguishable from a clean sweep. That is why every leg calls
 * `scrollIntoViewIfNeeded()` **and** scrolls the widget to the top of the viewport before
 * reading `boundingBox()` — observed, not theorised, the first time this was run.
 *
 * ⚠ Plain JavaScript with JSDoc types, deliberately, matching `check-tokens.mjs` and
 * `check-api.mjs`. It runs on the `engines.node` floor with no build step and no loader.
 */

import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

const ORIGIN = process.env.GX_PLAYGROUND_ORIGIN ?? 'http://localhost:5173/'

/**
 * ⚠ Wide and tall on purpose. `.widget` is `max-width: 100%` inside `.lab__stage`, so the
 * viewport is what caps the sweep's reach — and Stage needs a 900 px **content** box. A
 * 1280-wide viewport tops out in Canvas, which is a sweep that never crosses the last
 * boundary and never says so.
 */
const VIEWPORT = { width: 1900, height: 1400 }

/** `resolveSizeClass()` never returns a seventh. `packages/core/src/context.ts:73`. */
const SIZE_CLASSES = ['micro', 'tile', 'strip', 'panel', 'canvas', 'stage']

/**
 * Where the rung changes, in **content-box** px, from `FAMILY_MINIMA` × the 100 px nominal
 * cell (`packages/core/src/context.ts:73`, `:130`).
 *
 * ⚠ Derived here rather than imported, and that is the point of a browser gate: importing
 * `resolveSizeClass()` would make the script agree with the resolver by construction. These
 * are the numbers a *reader* of the published ladder table would write down, and the sweep
 * has to cross the boundaries the library actually has, not the ones it declares it has.
 */
const BOUNDARIES = { inline: [200, 300, 600, 900], block: [100, 300, 500, 600] }

/** `.widget` has a 1 px border and `box-sizing: border-box`, so CSS size == border box. */
const BORDER = 2

/** The corner grab point, inset from the bottom-right of the border box. */
const HANDLE_INSET = 4

/** Coarsest hop inside a leg. Small enough that a boundary is never jumped blind. */
const MAX_HOP = 24

/** How near a boundary the sweep slows to single pixels. */
const BOUNDARY_DWELL = [-3, -1, 1, 3]

/**
 * The path, as **border-box** waypoints. Diagonal on purpose: a single monotone shrink
 * crosses every boundary downward and the mirror leg crosses every one upward, so
 * hysteresis and containment are exercised by the same drag.
 *
 * ⚠ Both directions are required. G10 already proves the *plan* is direction-independent;
 * G11 is about the *box*, and a scrollbar that appears while growing and never disappears
 * while shrinking is a one-way failure that a one-way sweep cannot see.
 */
const WAYPOINTS = [
  { w: 1000, h: 700 },
  { w: 120, h: 60 },
  { w: 1000, h: 700 },
]

// --- Resolution --------------------------------------------------------------------

/**
 * Find Playwright without depending on it.
 *
 * @returns {Promise<{ chromium: unknown, from: string } | { chromium: null, tried: string[] }>}
 */
export async function loadPlaywright() {
  /** @type {string[]} */
  const tried = []
  const candidates = [
    process.env.GX_PLAYWRIGHT_PATH,
    'playwright',
    '/tmp/gx-drive/node_modules/playwright/index.mjs',
  ].filter((c) => typeof c === 'string' && c !== '')

  for (const specifier of candidates) {
    tried.push(specifier)
    try {
      const mod = await import(specifier)
      const chromium = mod.chromium ?? mod.default?.chromium
      if (chromium !== undefined) return { chromium, from: specifier }
    } catch {
      // ⚠ Swallowed on purpose, and only here. Every candidate is *expected* to miss on
      // some machine; the diagnosis a reader needs is the whole list, printed once, not
      // three stack traces for three absences.
      try {
        const require = createRequire(`${REPO_ROOT}/`)
        const mod = await import(require.resolve(specifier))
        const chromium = mod.chromium ?? mod.default?.chromium
        if (chromium !== undefined) return { chromium, from: specifier }
      } catch {
        continue
      }
    }
  }
  return { chromium: null, tried }
}

// --- The dev server ------------------------------------------------------------------

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
 * Start the playground, or report that one is already listening.
 *
 * ⚠ `detached: true` and `process.kill(-pid)`. `npx` spawns `pnpm` spawns `vite`; killing
 * the pid we hold leaves vite holding port 5173, and the *next* run attaches to an orphan
 * whose source tree is whatever it was when it started. Killing the process **group** is
 * the difference between a gate you can run twice and one you can run once.
 *
 * @returns {Promise<{ stop: () => void, spawned: boolean }>}
 */
async function ensureDevServer() {
  if (await answers(ORIGIN)) return { stop: () => {}, spawned: false }

  const child = spawn(
    'npx',
    ['--yes', 'pnpm@10.34.5', '--filter', '@gx/playground', 'dev'],
    { cwd: REPO_ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
  )

  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    try {
      if (child.pid !== undefined) process.kill(-child.pid, 'SIGTERM')
    } catch {
      // Already gone. Nothing to report — the goal was the absence, and it is here.
    }
  }
  // ⚠ Every exit path, including the ones that are not `return`. An uncaught throw or a
  // Ctrl-C mid-drag otherwise leaves a vite behind that the next run silently attaches to.
  process.once('exit', stop)
  process.once('SIGINT', () => { stop(); process.exit(130) })
  process.once('SIGTERM', () => { stop(); process.exit(143) })

  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (await answers(ORIGIN, 1000)) return { stop, spawned: true }
    await new Promise((r) => globalThis.setTimeout(r, 500))
  }
  stop()
  throw new Error(`the playground never answered on ${ORIGIN} within 60s`)
}

// --- Browser-context probes ----------------------------------------------------------

/* eslint-disable no-undef -- These three functions are serialised by `page.evaluate()` and
   run inside Chromium, never in Node. `scripts/**` is configured with node globals only
   (eslint.config.js), which is correct for every other line in this file; adding browser
   globals to the whole scripts glob to satisfy three functions would relax the config for
   files that should never touch a DOM. */

/**
 * One sample of the measured box. Everything the four assertions need, read in a single
 * round trip so the numbers describe the same frame as each other.
 *
 * ## ⚠ Two boxes, and reading the wrong one is how this gate went blind once
 *
 * `.widget` is the box the sweep **drags**. `.gx-auto-chart` — since A5, the wrapper
 * `<AutoChart>` puts around itself — is the box the library **observes**, and it carries its
 * own `overflow: hidden`. Those were the same element before A5 and are not now, so a
 * containment number read from `.widget` is read from the outside of a clipping boundary:
 * whatever spills out of the chart is absorbed by the wrapper, `.widget.scrollHeight`
 * equals `.widget.clientHeight` for the rest of time, and the overflow assertion reports a
 * serene `0 px` for a `<figcaption>` that is demonstrably ~21 px taller than the box holding
 * it. That is this project's named failure species — a thing that looks like it works and
 * quietly doesn't — living inside the gate written to catch it.
 *
 * So: **judge the observed box, drag the outer one.** `clientWidth/Height`, `scrollbar*` and
 * `overflow*` come from `.gx-auto-chart` when it is there; `offsetWidth/Height` stay on
 * `.widget`, because that is the number the drag asked for and the number a failure message
 * has to quote back. `observedFound` records which happened, and a vacuity check downstream
 * refuses to believe a green run that never located the wrapper — a revert of the playground
 * to hand-wiring must make this gate shout, not shrug.
 *
 * ⚠ `getComputedStyle` for the border, not a hardcoded 2. The gate must keep working when
 * someone restyles either box, and a scrollbar gutter computed against a stale border width
 * is a false positive that looks exactly like the bug.
 */
function readWidget() {
  const driven = document.querySelector('.widget')
  if (driven === null) return null

  const observed = driven.querySelector('.gx-auto-chart')
  const el = observed ?? driven

  const cs = getComputedStyle(el)
  const borderX = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth)
  const borderY = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)

  const figure = el.querySelector('.gx-chart')
  const svg = el.querySelector('.gx-chart__svg')
  const caption = el.querySelector('.gx-chart__caption')

  let captionBudget = 0
  if (caption !== null) {
    const ccs = getComputedStyle(caption)
    captionBudget = Math.ceil(
      caption.getBoundingClientRect().height +
        parseFloat(ccs.marginTop) +
        parseFloat(ccs.marginBottom),
    )
  }

  return {
    observedFound: observed !== null,
    offsetWidth: driven.offsetWidth,
    offsetHeight: driven.offsetHeight,
    // ⚠ Carried separately and compared for stillness alongside the driven box. The runaway
    // this gate exists to catch is a wrapper that takes its height from the chart inside it,
    // and `.widget` has an explicit `height` — it would sit perfectly still while the box the
    // observer actually reads grew under it.
    observedWidth: el.offsetWidth,
    observedHeight: el.offsetHeight,
    clientWidth: el.clientWidth,
    clientHeight: el.clientHeight,
    scrollbarX: el.offsetWidth - el.clientWidth - borderX,
    scrollbarY: el.offsetHeight - el.clientHeight - borderY,
    overflowX: el.scrollWidth - el.clientWidth,
    overflowY: el.scrollHeight - el.clientHeight,
    captionBudget,
    // ⚠ The plan's own claim about the box, checked against the box. `<svg>` width/height
    // come straight from `frame.box`, so this is the shortest path from a plan field to a
    // pixel and the one place a resolver bug shows up before any browser reacts to it.
    svgWidth: svg === null ? 0 : Math.ceil(svg.getBoundingClientRect().width),
    svgHeight: svg === null ? 0 : Math.ceil(svg.getBoundingClientRect().height),
    sizeClass: figure === null ? null : (figure.dataset.sizeClass ?? null),
  }
}

/** Three frames. One for the observer delivery, one for React's commit, one for layout. */
function settleFrames() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
}

/**
 * ⚠ `block: 'start'`, not just `scrollIntoViewIfNeeded()`. The playground's `.lab` grid
 * gives the right-hand panel a row span, which pushes `.widget` ~1100 px down a very tall
 * document. `scrollIntoViewIfNeeded()` scrolls minimally, so the widget lands at the bottom
 * of the viewport with ~280 px of room below it — enough for the first drag and not enough
 * for a 700 px one. The corner then leaves the viewport mid-leg, `mouse.move()` stops
 * landing on anything, and the sweep quietly resizes nothing.
 */
function scrollWidgetToTop() {
  document.querySelector('.widget')?.scrollIntoView({ block: 'start', inline: 'start' })
}

/* eslint-enable no-undef */

// --- The sweep -----------------------------------------------------------------------

/**
 * Expand a leg into hops, dense where it matters.
 *
 * ⚠ The dwell points are the reason this is not a `for (let t = 0; t <= 1; t += 0.05)`.
 * A uniform interpolation over an 880 px leg steps ~44 px at a time, which can step from
 * one side of the Tile→Strip boundary to the other without ever occupying it. The loop
 * error is most likely *at* a boundary, where the plan changes what it draws; a sweep that
 * skips over boundaries is sampling everywhere except the one place it was written for.
 *
 * @param {{ w: number, h: number }} from Border-box size.
 * @param {{ w: number, h: number }} to   Border-box size.
 * @returns {{ w: number, h: number }[]}
 */
export function hopsFor(from, to) {
  const span = Math.max(Math.abs(to.w - from.w), Math.abs(to.h - from.h))
  const steps = Math.max(1, Math.ceil(span / MAX_HOP))

  /** @type {number[]} */
  const fractions = []
  for (let i = 1; i <= steps; i += 1) fractions.push(i / steps)

  // Every boundary this leg crosses, in either dimension, converted back to a fraction of
  // the leg and surrounded by single-pixel dwells.
  /** @type {[number[], 'w' | 'h'][]} */
  const axes = [
    [BOUNDARIES.inline, 'w'],
    [BOUNDARIES.block, 'h'],
  ]
  for (const [edges, axis] of axes) {
    const a = from[axis]
    const b = to[axis]
    if (a === b) continue
    for (const edge of edges) {
      for (const delta of BOUNDARY_DWELL) {
        const target = edge + BORDER + delta
        const t = (target - a) / (b - a)
        if (t > 0 && t < 1) fractions.push(t)
      }
    }
  }

  fractions.sort((x, y) => x - y)
  return fractions.map((t) => ({
    w: Math.round(from.w + (to.w - from.w) * t),
    h: Math.round(from.h + (to.h - from.h) * t),
  }))
}

/**
 * @typedef {{ step: number, w: number, h: number, sizeClass: string | null,
 *   observedFound: boolean, scrollbarX: number, scrollbarY: number,
 *   overflowX: number, overflowY: number,
 *   captionBudget: number, svgWidth: number, svgHeight: number,
 *   clientWidth: number, clientHeight: number }} Sample
 * @typedef {{ step: number, kind: string, detail: string }} Failure
 */

/**
 * The four assertions, in one place so there is one place to read them.
 *
 * @param {Sample} s
 * @returns {Failure[]}
 */
export function judge(s) {
  /** @type {Failure[]} */
  const out = []
  // Named in every message, because "the measured box" stopped being one element at A5 and
  // a reader chasing a 21 px overflow needs to know which box it spilled out of.
  const box = s.observedFound ? '.gx-auto-chart' : '.widget'
  if (s.scrollbarX > 0 || s.scrollbarY > 0) {
    out.push({
      step: s.step,
      kind: 'scrollbar',
      detail:
        `a scrollbar took ${s.scrollbarX}×${s.scrollbarY} px out of ${box}'s content box at ` +
        `${s.w}×${s.h} — the observer's next reading is a number the chart caused`,
    })
  }
  const unattributedY = Math.max(0, s.overflowY - s.captionBudget)
  if (s.overflowX > 0 || unattributedY > 0) {
    out.push({
      step: s.step,
      kind: 'overflow',
      detail:
        `content overflows ${box} by ${s.overflowX}×${unattributedY} px at ` +
        `${s.w}×${s.h} (block budget ${s.captionBudget} px = .gx-chart__caption) — ` +
        `one \`overflow: auto\` away from a scrollbar`,
    })
  }
  if (s.svgWidth > s.clientWidth || s.svgHeight > s.clientHeight) {
    out.push({
      step: s.step,
      kind: 'plan-exceeds-box',
      detail:
        `the plan sized its <svg> ${s.svgWidth}×${s.svgHeight} inside ${box}'s ` +
        `${s.clientWidth}×${s.clientHeight} content box — frame.box is no longer the box`,
    })
  }
  return out
}

// --- CLI -----------------------------------------------------------------------------

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href

if (invokedDirectly) {
  const resolved = await loadPlaywright()

  if (resolved.chromium === null) {
    console.log('containment gate (G11): SKIPPED — playwright did not resolve.')
    console.log(`  tried: ${resolved.tried.join(', ')}`)
    console.log('  Set GX_PLAYWRIGHT_PATH, or install playwright outside this workspace')
    console.log('  (inside it, npm walks up to the pnpm root and fails ERESOLVE).')
    console.log('  CI wiring is deferred to the shared browser job with gate G4 — see the')
    console.log('  docblock at the top of this file. Exiting 0 rather than breaking verify.')
    process.exit(0)
  }

  const { chromium, from } = resolved
  const server = await ensureDevServer()

  /** @type {string[]} */
  const loopErrors = []
  /** @type {Failure[]} */
  const failures = []
  /** @type {Sample[]} */
  const samples = []
  /** @type {string | null} */
  let fatal = null
  /**
   * Why the sweep stopped early, when it did.
   *
   * ⚠ Distinct from `fatal`, and the distinction is what keeps the report readable. An
   * abandoned sweep takes no samples, which trips every vacuity check — but *"the size
   * class never changed"* is a symptom here, not the finding, and printing it alongside a
   * real containment failure teaches the reader to distrust the gate rather than the code.
   */
  let abandoned = null
  let browser = null

  try {
    browser = await chromium.launch()
    const page = await browser.newPage({ viewport: VIEWPORT })

    // ⚠ Both channels. Chromium reports the loop error as an uncaught `ErrorEvent`, which
    // Playwright surfaces on `pageerror`; a page that installs its own `window.onerror`
    // turns the same event into a `console.error` instead. Listening to one is listening
    // to whichever half this page happens to use today.
    const record = (text) => {
      if (/resizeobserver loop/i.test(text)) loopErrors.push(text)
    }
    page.on('console', (m) => record(m.text()))
    page.on('pageerror', (e) => record(String(e)))

    await page.goto(ORIGIN, { waitUntil: 'load' })
    await page.waitForSelector('.widget .gx-chart', { timeout: 20_000 })

    const widget = await page.locator('.widget')
    let step = 0

    /**
     * Assertion 2, isolated: no input, three frames, the box must not have moved.
     *
     * @param {string} when
     * @returns {Promise<boolean>} `true` when the box held still.
     */
    const boxHeldStill = async (when) => {
      const before = await page.evaluate(readWidget)
      await page.evaluate(settleFrames)
      const after = await page.evaluate(readWidget)
      if (before === null || after === null) return true
      if (
        before.offsetWidth === after.offsetWidth &&
        before.offsetHeight === after.offsetHeight &&
        // ⚠ Both boxes, and the second one is the one that can actually run away. `.widget`
        // carries an explicit `height`, so a wrapper growing to fit the chart it contains
        // moves nothing on the outside — the drag looks perfectly stable while the number
        // reaching `ResizeObserver` climbs every frame.
        before.observedWidth === after.observedWidth &&
        before.observedHeight === after.observedHeight
      ) {
        return true
      }
      failures.push({
        step,
        kind: 'box-moved',
        detail:
          `${when}, with no input, the measured box went ` +
          `${before.offsetWidth}×${before.offsetHeight} → ${after.offsetWidth}×${after.offsetHeight}` +
          ` (observed ${before.observedWidth}×${before.observedHeight} → ` +
          `${after.observedWidth}×${after.observedHeight})` +
          ' — the plan is sizing its own container',
      })
      return false
    }

    // ⚠ Checked BEFORE the mouse is touched, and the early exit is the point. A box that
    // is already running away never satisfies Playwright's actionability precondition, so
    // `scrollIntoViewIfNeeded()` spends its whole timeout reporting *"element is not
    // stable"* and the gate dies with a Playwright message instead of a diagnosis. The
    // runaway is the finding; discovering it on load costs three frames.
    if (!(await boxHeldStill('on load'))) {
      abandoned =
        'the box was already moving before the sweep began, so no drag could be trusted'
    }

    /** @param {{ w: number, h: number }} target */
    const sampleAt = async (target) => {
      await page.evaluate(settleFrames)
      const raw = await page.evaluate(readWidget)
      if (raw === null) throw new Error('.widget vanished mid-sweep')
      step += 1
      /** @type {Sample} */
      const s = { step, w: target.w, h: target.h, ...raw }
      samples.push(s)
      failures.push(...judge(s))
    }

    let cursor = null

    for (let leg = 0; leg < WAYPOINTS.length && abandoned === null; leg += 1) {
      // ⚠ The guard the whole sweep rests on, re-run every leg because the document's
      // height changes as the widget grows and a position that was in view stops being.
      await widget.scrollIntoViewIfNeeded({ timeout: 5000 })
      await page.evaluate(scrollWidgetToTop)
      await page.evaluate(settleFrames)

      const box = await widget.boundingBox()
      if (box === null) throw new Error('.widget has no bounding box — is it displayed?')
      if (cursor === null) {
        cursor = { w: Math.round(box.width), h: Math.round(box.height) }
        await sampleAt(cursor)
      }

      const target = WAYPOINTS[leg]
      const hops = hopsFor(cursor, target)

      const grabX = box.x + box.width - HANDLE_INSET
      const grabY = box.y + box.height - HANDLE_INSET

      // Room check *before* the drag, not a post-hoc explanation of a sweep that did
      // nothing. Reaching Stage needs the corner to stay on screen for the whole leg.
      const reachW = Math.max(cursor.w, target.w)
      const reachH = Math.max(cursor.h, target.h)
      if (box.x + reachW > VIEWPORT.width - 8 || box.y + reachH > VIEWPORT.height - 8) {
        throw new Error(
          `leg ${leg + 1} needs a ${reachW}×${reachH} widget at (${Math.round(box.x)}, ` +
            `${Math.round(box.y)}) but the viewport is ${VIEWPORT.width}×${VIEWPORT.height} — ` +
            'the corner would leave the screen and the drag would resize nothing',
        )
      }

      await page.mouse.move(grabX, grabY)
      await page.mouse.down()
      for (const hop of hops) {
        await page.mouse.move(grabX + (hop.w - cursor.w), grabY + (hop.h - cursor.h), {
          steps: 6,
        })
        await sampleAt(hop)
      }
      await page.mouse.up()
      cursor = target

      // Assertion 2, at rest. This is the only assertion that catches a chart which
      // settles into a *different* size than the drag asked for — the loop that completes
      // rather than the loop that is cut.
      if (!(await boxHeldStill(`after leg ${leg + 1}`))) {
        abandoned = `the box would not settle after leg ${leg + 1}`
      }
    }
  } catch (error) {
    fatal = error instanceof Error ? error.message : String(error)
  } finally {
    if (browser !== null) await browser.close().catch(() => {})
    server.stop()
  }

  const observed = samples.map((s) => s.sizeClass)
  const seen = new Set(observed.filter((c) => c !== null))
  let changes = 0
  for (let i = 1; i < observed.length; i += 1) {
    if (observed[i] !== observed[i - 1]) changes += 1
  }
  const missing = SIZE_CLASSES.filter((c) => !seen.has(c))

  // ⚠ Vacuity is checked before the assertions are believed. A run in which the box never
  // changed size satisfies every one of the four trivially, and prints the same green line.
  // Suppressed only when the sweep was abandoned for a stated cause — then the thin sample
  // count is a consequence of the finding rather than a reason to doubt it.
  /** @type {string[]} */
  const vacuous = []
  if (abandoned === null) {
    if (samples.length === 0) vacuous.push('no samples were taken at all')
    if (changes === 0 && samples.length > 0) {
      vacuous.push('the size class never changed — the sweep did not sweep')
    }
    if (missing.length > 0) {
      vacuous.push(
        `never reached: ${missing.join(', ')} — the sweep missed ${missing.length} rung(s)`,
      )
    }
    // ⚠ The check that keeps the previous paragraph's mistake from being made twice. Every
    // containment number above is read from `.gx-auto-chart` when it exists and from
    // `.widget` when it does not — and the fallback is a *strictly weaker* measurement,
    // taken outside a clipping boundary, that reports zero overflow for overflow that is
    // really there. Falling back silently is exactly how this gate spent a run reporting
    // `peak 0 px` for a caption 21 px too tall. If the playground ever stops rendering
    // `<AutoChart>` — a revert to hand-wiring, a renamed class — the gate says so instead
    // of quietly grading a different box.
    if (samples.length > 0 && !samples.some((s) => s.observedFound)) {
      vacuous.push(
        'no `.gx-auto-chart` was ever found inside `.widget` — every number above was read ' +
          'from the outer box, which is not the box the library observes',
      )
    }
  }

  if (
    fatal !== null ||
    abandoned !== null ||
    vacuous.length > 0 ||
    loopErrors.length > 0 ||
    failures.length > 0
  ) {
    console.error(
      `containment gate (G11): FAILED after ${samples.length} sample(s), ` +
        `${changes} rung change(s), ${loopErrors.length} loop error(s)\n`,
    )
    if (fatal !== null) console.error(`  fatal      ${fatal}`)
    for (const v of vacuous) console.error(`  vacuous    ${v}`)
    if (abandoned !== null) console.error(`  abandoned  ${abandoned}`)
    for (const text of loopErrors.slice(0, 10)) {
      console.error(`  loop       ${text}`)
    }
    if (loopErrors.length > 10) {
      console.error(`  loop       … and ${loopErrors.length - 10} more`)
    }
    for (const f of failures.slice(0, 15)) {
      console.error(`  ${f.kind.padEnd(10)} step ${f.step}: ${f.detail}`)
    }
    if (failures.length > 15) {
      console.error(`  …          and ${failures.length - 15} more of the same species`)
    }
    console.error(
      '\nA plan may change what is drawn inside the measured box, never the size of it.',
    )
    console.error('See research/20-architecture.md §3.3 and research/maps/04-ci-gate-map.md G11.')
    process.exit(1)
  }

  const peakOverflow = samples.reduce((max, s) => Math.max(max, s.overflowY), 0)
  const judgedBox = samples.every((s) => s.observedFound)
    ? '.gx-auto-chart'
    : '.widget (no wrapper found at every step)'
  console.log(
    `containment gate (G11): ${samples.length} sizes swept, ${changes} rung changes, ` +
      `0 loop errors, 0 px unattributed overflow ` +
      `(peak ${peakOverflow} px block-axis on ${judgedBox}, attributed to ` +
      `.gx-chart__caption; playwright from ${from}).`,
  )
}
