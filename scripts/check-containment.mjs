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
 * ⚠ **In CI now, still NOT in `verify`, and the two halves of that are decided separately.**
 * This file used to record a deferral: the browser provisioning was to arrive with gate
 * **G4** (`04-ci-gate-map.md:79`, the RSC-with-JS-disabled fixture), because *wiring one
 * browser download into CI twice, for two gates, is the kind of duplication that gets
 * half-removed later*. That job now exists — `.github/workflows/ci.yml`'s `browser` job
 * downloads Chromium once and runs G4 and G11 against it — so the deferral is discharged and
 * this paragraph describes what happens rather than what was promised. What has **not**
 * changed is the absence from `verify`: `verify` is the command a fresh clone runs before it
 * has decided to care, and it should not open with a ~150 MB browser download. Locally this
 * is still `pnpm lint:containment`, by hand; CI simply no longer depends on someone
 * remembering to type it.
 *
 * ## ⚠ A missing npm package and a missing browser are different failures
 *
 * Conflating them is how a gate stops running while still printing a line. `playwright` is a
 * declared devDependency of the root `package.json` now, so the bare specifier resolves and
 * normally wins — but `import('playwright')` succeeding says **nothing** about whether
 * Chromium is on disk. `playwright install chromium` is a separate step and nothing takes it
 * for us. That was measured rather than assumed: `playwright@1.62.1` ships **no lifecycle
 * scripts at all** — its `package.json` has no `scripts` field, and the postinstall that
 * older releases used to fetch browsers with is gone. So a clean `pnpm install
 * --frozen-lockfile` leaves you holding the package with `~/.cache/ms-playwright` empty, and
 * it does so without pnpm having to block anything; there is nothing to block. (Worth knowing
 * because the neighbouring `ignoredBuiltDependencies` entry in `pnpm-workspace.yaml` invites
 * the guess that a blocked postinstall is the cause here. It is not.) The consequence is what
 * matters and it holds either way: **resolving the package is not evidence about the
 * browser.** The two are therefore diagnosed apart:
 *
 *  - **The package does not resolve → hard failure, exit 1.** It is declared and pinned. A
 *    miss means `pnpm install` has not run, or ran without dev dependencies — a checkout on
 *    which `pnpm lint` and `pnpm test` fail for the same reason. Exiting 0 there answers
 *    *"is containment intact?"* with *"I could not find eslint either."*
 *  - **The package resolves but Chromium will not launch → SKIP, exit 0.** This is the one
 *    genuine opt-out: someone cloned, installed, and declined the download. A gate that
 *    hard-fails on a declined opt-in gets deleted rather than fixed. The remedy is printed
 *    verbatim, as the command to type, and the two shapes of it are distinguished — a
 *    missing binary wants `playwright install chromium`, a Linux box missing the shared
 *    libraries Chromium links against wants `--with-deps`.
 *
 * ⚠ **`GX_REQUIRE_BROWSER=1` turns that SKIP into a failure, and the CI job sets it.** In CI
 * a silent skip is a gate that is not running while looking exactly like a gate that passed —
 * the same species as the assertion-1 finding below, where a green line was printed over a
 * box growing without limit. Leniency is for the reader who is a developer; a runner has no
 * opt-in to respect. It keys on an explicit variable rather than on `CI`, because `CI` is
 * true in a contributor's fork, in a Docker shell, and in half the tools that set it by
 * habit — the gate should hard-fail where someone decided it must, not wherever a variable
 * happened to be exported.
 *
 * ⚠ **The browser is launched *before* the dev server, and that ordering is the diagnosis.**
 * Spinning vite up for up to 60 seconds and only then discovering there is no Chromium wastes
 * the minute and, worse, files the discovery under `fatal` inside a containment report, where
 * three vacuity lines (*"no samples were taken at all"*, *"never reached: micro, tile, …"*)
 * pile on top of it and teach the reader to distrust the gate instead of fixing their install.
 * Launching first means the only thing that can reach that report is a real finding.
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

export const ORIGIN = process.env.GX_PLAYGROUND_ORIGIN ?? 'http://localhost:5173/'

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
 * ⚠ Set by `.github/workflows/ci.yml`'s `browser` job, and by nobody else by default. It is
 * the switch that makes a skip unreachable where a skip would be a lie. See the header.
 */
const REQUIRE_BROWSER = process.env.GX_REQUIRE_BROWSER === '1'

/**
 * Resolve `playwright`.
 *
 * ⚠ **The scratch-install candidate is gone, and its absence is the point.** `/tmp/gx-drive`
 * existed because playwright could not be installed *inside* this workspace — `npm` walked up
 * into the pnpm root and failed ERESOLVE — so a copy outside the repo was the only way to run
 * this gate at all. `pnpm add -Dw` does not have that problem, and the specifier below now
 * resolves from `node_modules` at the version the lockfile pins. Leaving the scratch path in
 * as a fallback would let a stale install at *some other* version quietly shadow the pinned
 * one, which is a worse failure than the one it was working around: a browser gate is only
 * evidence if you know which browser it drove.
 *
 * ⚠ **`GX_PLAYWRIGHT_PATH` is checked first and *strictly*.** An explicit override that
 * misses does not fall through to the declared copy — it fails. An instruction that silently
 * did nothing is this project's named failure species, and "the gate passed" is a poor way to
 * find out your override has a typo in it.
 *
 * ⚠ **`ok` is a discriminant, and it is here for the caller's typechecker, not for style.**
 * `scripts/check-rsc.mjs` imports this function so that both browser gates share one
 * resolution policy instead of two that drift. Narrowing the old union on `chromium === null`
 * never worked — the hit branch's `chromium` is `any`, which subsumes `null` — so every
 * consumer read `tried` off a union that TypeScript said had no such property. A boolean
 * literal narrows; `chromium` stays exactly where it was so nothing at the call site moves.
 *
 * @returns {Promise<{ ok: true, chromium: any, from: string }
 *   | { ok: false, chromium: null, tried: string[], why: string, remedy: string }>}
 */
export async function loadPlaywright() {
  const override = process.env.GX_PLAYWRIGHT_PATH
  const explicit = typeof override === 'string' && override !== ''
  const specifier = explicit ? override : 'playwright'

  /** @type {string[]} */
  const tried = [specifier]

  try {
    const mod = await import(specifier)
    const chromium = mod.chromium ?? mod.default?.chromium
    if (chromium !== undefined) return { ok: true, chromium, from: specifier }
  } catch {
    // ⚠ Swallowed on purpose, and only here. A bare specifier that misses from this file can
    // still resolve from the repo root — `scripts/` is not a package and has no
    // `node_modules` of its own — so a throw here is an expected step, not a diagnosis. What
    // a reader needs is one sentence naming what is absent, not two stack traces about how.
  }

  try {
    const require = createRequire(`${REPO_ROOT}/`)
    const fromRoot = require.resolve(specifier)
    tried.push(fromRoot)
    const mod = await import(fromRoot)
    const chromium = mod.chromium ?? mod.default?.chromium
    if (chromium !== undefined) return { ok: true, chromium, from: fromRoot }
  } catch {
    // Same reasoning; this is the last attempt, and the return below is the report.
  }

  return {
    ok: false,
    chromium: null,
    tried,
    why: explicit
      ? `GX_PLAYWRIGHT_PATH is set to ${override}, and nothing there exports \`chromium\``
      : '`playwright` is a pinned devDependency of this repo and did not resolve, which means' +
        ' the install is missing or incomplete rather than that the browser is opted out of',
    remedy: explicit ? 'unset GX_PLAYWRIGHT_PATH, or point it at a real playwright' : 'pnpm install',
  }
}

/**
 * Launch Chromium, and tell "you never downloaded a browser" apart from every other reason a
 * browser might refuse to start.
 *
 * ⚠ **Matched on Playwright's own words, read out of a real failure rather than guessed.**
 * With `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty directory, `chromium.launch()` throws
 * `browserType.launch: Executable doesn't exist at …` followed by its own boxed *"Please run
 * the following command to download new browsers"* — measured here, on 1.62.1. On a Linux
 * runner that has the binary but not the shared libraries it links against, the same call
 * throws *"Host system is missing dependencies to run browsers"* instead. Different cause,
 * different remedy (`--with-deps`), and the reason the workflow passes that flag rather than
 * leaving it to be discovered as what reads like a bug in our own code.
 *
 * ⚠ **Only a *recognised* absence is lenient.** A sandbox refusal, a crash on start, a
 * corrupt download — anything this function does not recognise is re-thrown with its message
 * intact and becomes a failure. A skip is the one outcome that must never be reachable by
 * accident, because it is the one that looks like success.
 *
 * ⚠ Note that headless `launch()` resolves the *headless shell* build, not the one
 * `chromium.executablePath()` names — verified by pointing the browsers path at an empty
 * directory and reading which file it complained about. That is why this asks the real
 * `launch()` instead of stat-ing a path: a file-existence check would be testing a different
 * binary than the sweep is about to drive.
 *
 * @param {any} chromium
 * @returns {Promise<{ absence: null, browser: any }
 *   | { absence: 'download' | 'system-libraries', browser: null, message: string }>}
 */
export async function launchChromium(chromium) {
  try {
    return { absence: null, browser: await chromium.launch() }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/missing dependencies to run browsers|install-deps|loading shared librar/i.test(message)) {
      return { absence: 'system-libraries', browser: null, message }
    }
    if (/executable doesn't exist|download new browsers|playwright install/i.test(message)) {
      return { absence: 'download', browser: null, message }
    }
    throw error
  }
}

/**
 * Resolve playwright, launch Chromium, and — on either kind of absence — print the diagnosis
 * and exit. Returns an open browser or does not return at all.
 *
 * ⚠ **This exists so the policy is shared, not just the resolver.** `scripts/check-rsc.mjs`
 * (gate G4) imports from this file precisely so there are not two browser-acquisition
 * policies drifting apart — but importing `loadPlaywright()` alone shares only the *easy*
 * half. The half that matters is the one below: knowing that a resolved package and a
 * downloaded browser are different things, that only the second is a legitimate opt-out, and
 * that `GX_REQUIRE_BROWSER=1` revokes even that. A gate that imports the resolver and then
 * hand-rolls the launch gets the opaque `browserType.launch:` error this function exists to
 * translate, which is exactly the drift the shared import was meant to prevent.
 *
 * ⚠ It calls `process.exit()`, which is not a thing a library does — but every caller is a
 * gate whose only jobs are to print a verdict and set an exit code, and duplicating twenty
 * lines of exit-code policy across two of them is how the two verdicts start disagreeing.
 *
 * @param {string} gate Quoted verbatim at the head of every line printed, e.g.
 *   `'containment gate (G11)'`. Whichever gate is speaking must be the first thing read.
 * @returns {Promise<{ browser: any, from: string }>}
 */
export async function openChromium(gate) {
  const resolved = await loadPlaywright()

  // ⚠ A failure, not a skip, and the header argues why at length: playwright is pinned in the
  // root `package.json`, so a miss here is a broken checkout rather than a declined download.
  if (!resolved.ok) {
    console.error(`${gate}: FAILED — playwright did not resolve.`)
    console.error(`  why      ${resolved.why}`)
    console.error(`  tried    ${resolved.tried.join(', ')}`)
    console.error(`  remedy   ${resolved.remedy}`)
    console.error(
      '\nThis used to exit 0. It no longer does: playwright is a declared, pinned\n' +
        'devDependency, and a checkout where it is absent is a checkout where `pnpm lint`\n' +
        'and `pnpm test` fail for the same reason. Skipping here would answer a question\n' +
        'about containment with a fact about the install. Declining the *browser* download\n' +
        'is still an opt-out and is still a skip — see the docblock at the top of this file.',
    )
    process.exit(1)
  }

  const { chromium, from } = resolved
  const launch = await launchChromium(chromium)

  if (launch.absence !== null) {
    const libs = launch.absence === 'system-libraries'
    const say = REQUIRE_BROWSER ? console.error : console.log
    say(
      `${gate}: ${REQUIRE_BROWSER ? 'FAILED' : 'SKIPPED'} — playwright resolved from ` +
        `${from}, but Chromium would not launch.`,
    )
    say(
      `  cause    ${
        libs
          ? 'the browser is on disk but the system libraries it links against are not'
          : 'the browser was never downloaded — the npm package and the browser binary are ' +
            'two separate installs, and only the first is in the lockfile'
      }`,
    )
    say(`  remedy   pnpm exec playwright install ${libs ? '--with-deps ' : ''}chromium`)
    say(`  detail   ${launch.message.split('\n')[0]}`)

    if (REQUIRE_BROWSER) {
      say(
        '\nGX_REQUIRE_BROWSER=1 is set, so this is a failure rather than a skip: in CI a\n' +
          'silent skip is a gate that is not running while looking exactly like one that\n' +
          'passed, which is the failure species this whole file exists to catch.',
      )
      process.exit(1)
    }
    say(
      '\nExiting 0. A ~150 MB browser download is an opt-in, and a gate that hard-fails on a\n' +
        'declined opt-in gets deleted rather than fixed. Set GX_REQUIRE_BROWSER=1 to make this\n' +
        'a failure — `.github/workflows/ci.yml`\'s browser job does exactly that.',
    )
    process.exit(0)
  }

  return { browser: launch.browser, from }
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
 * ⚠ Exported since A6 so that `check-motion.mjs` (gate **G19**) shares it rather than
 * growing a second one. Two gates spawning two vites on one port is a race whose loser
 * reports a failure about the *other* gate's tree; one policy, one spawn, one kill.
 *
 * @returns {Promise<{ stop: () => void, spawned: boolean }>}
 */
export async function ensureDevServer() {
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
  // ⚠ Before `ensureDevServer()`, deliberately — see the header. Sixty seconds of vite
  // followed by "there is no browser" buries the one line that matters under a containment
  // report full of vacuity warnings about a sweep that never happened. `openChromium()` has
  // already exited if there is no browser to be had, so everything below is a real run.
  const { browser, from } = await openChromium('containment gate (G11)')

  // ⚠ The browser is already open, so a dev server that never answers must not leak it. This
  // is the one throw between the launch and the try/finally below that owns the close.
  const server = await ensureDevServer().catch(async (error) => {
    await browser.close().catch(() => {})
    throw error
  })

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

  try {
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
    await browser.close().catch(() => {})
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
