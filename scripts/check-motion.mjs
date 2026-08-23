/**
 * Gate **G19** — the transitions actually run, and stop when asked to.
 *
 * ⚠ **This is the only gate that can see A6 at all, and the reason is worth being precise
 * about.** `identity.test.tsx` proves the DOM nodes survive a resize, which is A6's
 * precondition; `Chart.test.tsx` proves the plan's motion facts reach the figure, which is
 * A6's wiring. Neither can observe a transition, because a transition is not a property of
 * markup — it is a property of an engine interpolating between two computed values over
 * time, and jsdom has no interpolation and no clock. Every rule in `chart.css`'s motion
 * block could be deleted and the entire node suite would stay green.
 *
 * ⚠ **It drives the playground, not a fixture, and that is the load-bearing choice.** A gate
 * that builds its own `<rect class="gx-grid__line">` asserts that a stylesheet animates a
 * string the gate itself wrote — it stays green through a rename, a restructure, or a
 * `<Grid>` that stops emitting gridlines entirely. The failure mode `43-theming.md` §6.3
 * names — *"a gate never observed to fail is not a gate"* — arrives here as a gate that
 * cannot fail because it is grading its own homework. So: the real dev server, the real
 * `<AutoChart>`, the real stylesheet, resized the way a user resizes it.
 *
 * ⚠ **Four assertions, and the last two are the ones that matter.**
 *
 *   1. Chrome interpolates. A gridline's `y` passes through a value that is neither where it
 *      started nor where it ends.
 *   2. Marks interpolate, and *later*. Stage 2 carries `--gx-motion-stage-delay`, so early in
 *      the transition the chrome has moved and the marks have not.
 *   3. `prefers-reduced-motion: reduce` suppresses all of it. Not "runs faster" — the query
 *      in `chart.css` is `no-preference`, so under the preference the rules do not exist and
 *      the first sampled frame is already final.
 *   4. **The resting state is identical either way.** `20-architecture.md` §7.4 requires the
 *      unanimated chart to be the baseline artefact rather than a degraded one. This is the
 *      assertion that catches a `transition` accidentally written as an `animation` with a
 *      non-identity end state, which would look right in one context and wrong in the other.
 *
 * ⚠ **Not a substitute for `probe-motion.mjs`, and not the same question.** The probe asks
 * what *Chromium* interpolates and is deliberately not a gate — its findings are recorded in
 * `research/decisions/016-what-svg-geometry-actually-transitions.md` and re-running it is how
 * you would learn that a browser changed its mind. This asks whether *our chart* does, given
 * that it does. Keeping them apart means a platform regression reads as a platform
 * regression rather than as our bug.
 *
 * ⚠ Plain JavaScript with JSDoc types, like every other gate here, and for the same reason:
 * it runs with no build step, so it can check a tree that does not build.
 */

import { ensureDevServer, openChromium, ORIGIN } from './check-containment.mjs'

/**
 * How long to sample, every frame, from the moment the resize lands.
 *
 * ⚠ **It has to outlast the stage delay, or assertion 2 tests the wrong thing.** The first
 * version sampled 8 frames — about 130ms — and asserted "not every frame equalled the final
 * `d`". Stage 2 waits `--gx-motion-stage-delay`, which is half the duration, so at the
 * recompose class the marks have not *started* moving inside that window. Every sample
 * equalled the START value, the assertion passed, and it would have passed identically if the
 * marks had snapped at 500ms with no tween at all. 900ms crosses the delay and catches stage 2
 * mid-flight, which is the only sample that distinguishes a transition from a late snap.
 */
const WINDOW_MS = 900

/** Long enough for the 1000ms recompose class plus its delay and slack, so `final` is at rest. */
const SETTLE_MS = 1800

/**
 * How far the observed stage gap may sit from the declared `transition-delay`.
 *
 * ⚠ Wide on purpose, and still narrow enough to be the assertion it claims to be. Two frames
 * of slack go to React's re-render on the ResizeObserver callback and one to the sampler, so
 * a correct chart lands tens of milliseconds late. What this must not tolerate is the failure
 * it exists for: a delay that collapsed to a different duration class. Half of 300ms against
 * half of 1000ms is a 350ms discrepancy, so the tolerance has an order of magnitude of room
 * before it stops separating those.
 */
const DELAY_TOLERANCE_MS = 120

/**
 * The stage delay must be at least this fraction of the duration in effect.
 *
 * ⚠ Deliberately not `0.5`, which is what the tokens currently use. `theme.css` marks the
 * exact fraction UNVERIFIED and gives it to B1 along with the easing; pinning it here would
 * make a legitimate tuning pass look like a regression. The bound exists to separate
 * *half of the recompose duration* from *half of the rescale duration* — 500ms from 150ms —
 * which is the shape of the bug it was written for.
 */
const MIN_DELAY_RATIO = 0.25

/**
 * The two sizes. Both draw gridlines and marks, and the step is large enough that every
 * sampled property has somewhere to travel — a gate whose "before" and "after" agree passes
 * vacuously, which is checked explicitly below rather than assumed.
 */
const FROM = { width: 900, height: 520 }
const TO = { width: 560, height: 380 }

/* eslint-disable no-undef -- Serialised by `page.evaluate()` and run inside Chromium, never
   in Node. `scripts/**` is configured with node globals only (eslint.config.js), which is
   right for every other line in this file; widening the glob for one function would relax
   the config for gates that must never touch a DOM. `check-containment.mjs` scopes it the
   same way. */

/**
 * Put the widget at a size and let everything settle, sampling nothing.
 *
 * ⚠ Separate from the sampler on purpose. The playground opens at 544×288, which is Strip —
 * a rung that draws no gridlines at all. Reading the "before" state in the same call that
 * performs the resize reads it at whatever size the page happened to load at, which here
 * meant reading it from a chart with no chrome to measure. The first version of this gate
 * failed with *"the chart drew no gridline"* and was describing the harness, not the chart.
 *
 * @param {any} page
 * @param {{ width: number, height: number }} size
 * @param {number} settleMs
 */
async function setSize(page, size, settleMs) {
  return page.evaluate(
    async ({ next, settle }) => {
      const widget = document.querySelector('.widget')
      if (widget === null) return { error: 'no .widget in the playground' }
      widget.style.width = `${next.width}px`
      widget.style.height = `${next.height}px`
      await new Promise((resolve) => setTimeout(resolve, settle))
      const chart = document.querySelector('.gx-chart')
      const line = document.querySelector('.gx-line')

      // ⚠ Read off `transition-delay`, never off `--gx-motion-stage-delay`. A custom
      // property's computed value is the token stream, so the broken version of this reported
      // the literal string `calc(300ms / 2)` — which looks like a delay, parses as nothing,
      // and tells you nothing about which duration it divided. `transition-delay` is a real
      // resolved time, because the engine had to resolve it to use it.
      const ms = (v) => {
        const n = Number.parseFloat(v)
        return Number.isNaN(n) ? null : n * 1000
      }
      const style = line === null ? null : getComputedStyle(line)

      return {
        error: null,
        sizeClass: chart === null ? null : chart.getAttribute('data-size-class'),
        durationClass: chart === null ? null : chart.getAttribute('data-motion-duration'),
        gridlines: document.querySelectorAll('.gx-grid__line').length,
        stageDelayMs: style === null ? null : ms(style.transitionDelay),
        stageDurationMs: style === null ? null : ms(style.transitionDuration),
      }
    },
    { next: size, settle: settleMs },
  )
}

/**
 * Resize the widget and sample the first few frames of whatever follows.
 *
 * ⚠ No JSDoc casts in this body. The repo is semicolon-free, and a statement beginning with
 * `(` after a comment does not receive automatic semicolon insertion — `foo()` followed by a
 * cast parses as `foo()(x)` and throws somewhere other than where it was written. It cost a
 * cycle in `probe-motion.mjs`; the note is repeated here so the next author does not pay it
 * again. Inside `evaluate` the code is not typechecked anyway, so the casts bought nothing.
 *
 * @param {any} page
 * @param {{ width: number, height: number }} size
 * @param {number} windowMs
 * @param {number} settleMs
 */
async function resizeAndSample(page, size, windowMs, settleMs) {
  return page.evaluate(
    async ({ next, window: windowLength, settle }) => {
      const widget = document.querySelector('.widget')
      if (widget === null) return { error: 'no .widget in the playground' }

      // The properties watched, one per stage. `y` on a gridline is stage 1; `d` on the
      // series path is stage 2. Both were measured to interpolate in decision 016.
      const readAll = () => {
        const grid = document.querySelector('.gx-grid__line')
        const line = document.querySelector('.gx-line')
        if (grid === null || line === null) return null
        return {
          gridY: getComputedStyle(grid).getPropertyValue('y'),
          lineD: getComputedStyle(line).getPropertyValue('d'),
        }
      }

      const start = readAll()
      if (start === null) return { error: 'the chart drew no gridline or no line path' }

      widget.style.width = `${next.width}px`
      widget.style.height = `${next.height}px`

      // ⚠ The ResizeObserver delivers on the frame AFTER the layout change, so sampling must
      // begin after React has re-rendered — otherwise every sample is the pre-resize value
      // and the gate reports "no interpolation" about a transition that never started.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

      // ⚠ Every sample carries `t`, milliseconds since the resize landed. Frame *indices*
      // cannot answer the staging question: the assertion is that the chrome starts moving
      // before the marks do, and "before" is a claim about time. Under a dropped frame or a
      // throttled tab an index gap of 1 can be 200ms, which is longer than the whole stage
      // delay, so an index-based comparison reports staging that is not there.
      const t0 = performance.now()
      const samples = []
      await new Promise((resolve) => {
        const tick = () => {
          const s = readAll()
          const t = performance.now() - t0
          if (s !== null) samples.push({ ...s, t })
          if (t < windowLength) requestAnimationFrame(tick)
          else resolve(undefined)
        }
        requestAnimationFrame(tick)
      })

      await new Promise((resolve) => setTimeout(resolve, settle))
      const final = readAll()

      return { start, samples, final, error: null }
    },
    { next: size, window: windowMs, settle: settleMs },
  )
}
/* eslint-enable no-undef */

/**
 * One full run at one motion preference.
 *
 * @param {any} browser
 * @param {boolean} reduce
 */
async function run(browser, reduce) {
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ...(reduce ? { reducedMotion: 'reduce' } : {}),
  })
  const page = await context.newPage()
  await page.goto(ORIGIN, { waitUntil: 'networkidle' })
  await page.waitForSelector('.gx-chart__svg', { timeout: 20_000 })

  // ⚠ Settle at FROM for the FULL envelope, not a token amount. Getting to FROM is itself a
  // resize, and it runs the same transition — at the recompose class that is a 1000ms move
  // behind a 500ms delay. Settling 600ms left the previous animation in flight, so the first
  // three sampled frames of the *next* one showed `d` already moving and the gate reported
  // "the marks left before the chrome" about a transition that had not started. The staging
  // assertion below is a claim about a single gesture; the setup has to guarantee there is
  // only one.
  const settled = await setSize(page, FROM, SETTLE_MS)
  if (settled.error !== null) {
    await context.close()
    return { error: settled.error }
  }
  // ⚠ Vacuity again, one level up: a FROM that draws no gridlines makes every assertion
  // below unfalsifiable, and it is a plausible accident — the rungs move.
  if (settled.gridlines === 0) {
    await context.close()
    return {
      error:
        `no gridlines at ${FROM.width}×${FROM.height} (rung ${settled.sizeClass}); ` +
        'pick a size above Strip or this gate proves nothing',
    }
  }

  const result = await resizeAndSample(page, TO, WINDOW_MS, SETTLE_MS)

  await context.close()
  return {
    ...result,
    stageDelayMs: settled.stageDelayMs,
    stageDurationMs: settled.stageDurationMs,
    durationClass: settled.durationClass,
  }
}

// --- CLI -------------------------------------------------------------------------------

const { browser, from } = await openChromium('motion gate (G19)')

const server = await ensureDevServer().catch(async (error) => {
  await browser.close().catch(() => {})
  throw error
})

/** @type {string[]} */
const failures = []

try {
  const moving = await run(browser, false)
  const still = await run(browser, true)

  for (const [label, r] of [['default', moving], ['reduce', still]]) {
    if (r.error !== null && r.error !== undefined) failures.push(`${label}: ${r.error}`)
  }

  if (failures.length === 0) {
    // ⚠ THE VACUITY CHECK, first and unconditional. Every assertion below is of the form
    // "a value passed through an intermediate state", and all of them are trivially
    // satisfiable by a chart that never moved. A resize that changed nothing means the gate
    // is broken, not that the chart is still.
    if (moving.start.gridY === moving.final.gridY) {
      failures.push('vacuous: the gridline ended where it started — the resize did nothing')
    }
    if (moving.start.lineD === moving.final.lineD) {
      failures.push('vacuous: the series path ended where it started')
    }
  }

  if (failures.length === 0) {
    // ⚠ **`mid` is the whole gate.** A sample that differs from `final` can still BE the start
    // value — the transition begins on the frame after the change, and under reduced motion the
    // pre-render frames read as start too. A sample that differs from `start` can simply be the
    // final value arriving. Only a value distinct from BOTH endpoints could not exist without an
    // engine interpolating between them. `probe-motion.mjs` records the same reasoning; this is
    // the version with teeth.
    //
    // @param {'gridY' | 'lineD'} key
    const midOf = (run, key) =>
      run.samples.find((s) => s[key] !== run.final[key] && s[key] !== run.start[key])

    /** When a property first left its starting value, in ms since the resize. */
    const departure = (run, key) => run.samples.find((s) => s[key] !== run.start[key])?.t

    // 1. Stage 1 interpolates.
    if (midOf(moving, 'gridY') === undefined) {
      failures.push(
        'the gridline snapped: no sampled frame sat between the start and final `y`. Either ' +
          'the transition rules are not matching, or <Grid> is being re-keyed and the nodes ' +
          'are replacements with no previous value — see identity.test.tsx.',
      )
    }

    // 2. Stage 2 interpolates. Not "has not finished yet" — see WINDOW_MS.
    if (midOf(moving, 'lineD') === undefined) {
      failures.push(
        `the series path snapped: across ${WINDOW_MS}ms no sampled \`d\` sat between the ` +
          'endpoints. A path whose command count changed cannot interpolate at all (decision ' +
          '016), so check the point budget before checking the stylesheet.',
      )
    }

    // 3. Stage 2 starts after stage 1, by the amount the stylesheet says it should.
    //
    // ⚠ **Two comparisons, because either alone is passable by a broken chart.**
    //
    // The gap is compared against the DECLARED delay rather than against zero, because
    // `marksAt > chromeAt` passes on a one-frame gap. That catches the stylesheet failing to
    // reach the DOM — rules not matching, or the delay never applying.
    //
    // But it does NOT catch the delay being declared *wrongly*, because observed and declared
    // then collapse together and agree with each other. Verified by breaking it on purpose:
    // with `--gx-motion-stage-delay: calc(var(--gx-motion-duration) / 2)` back on `:root`,
    // every recompose figure took a 150ms delay derived from the 300ms rescale duration it
    // inherited, and this gate reported *"a 150ms gap against 150ms declared"* and exited 0.
    // Consistent, and wrong by a factor of three.
    //
    // So the ratio is checked as well. It is a LOWER BOUND, not the `/ 2` the tokens use:
    // `theme.css` marks the exact fraction UNVERIFIED and hands it to B1, and a gate that
    // pins a number its own source calls provisional will be deleted the week B1 tunes it.
    // A quarter separates half-of-1000ms from half-of-300ms with room to spare, which is the
    // only distinction this needs to make.
    const chromeAt = departure(moving, 'gridY')
    const marksAt = departure(moving, 'lineD')
    const declared = moving.stageDelayMs
    const duration = moving.stageDurationMs
    if (chromeAt === undefined || marksAt === undefined) {
      failures.push('one of the two stages never left its starting value inside the window.')
    } else if (marksAt < chromeAt) {
      failures.push(
        `staging is inverted: the marks left at ${Math.round(marksAt)}ms and the chrome at ` +
          `${Math.round(chromeAt)}ms. \`10-responsive-ladder.md\` §7 is explicit that stage 1 ` +
          'is axis and ticks and stage 2 is marks.',
      )
    } else if (declared === null) {
      failures.push('could not read a resolved transition-delay from .gx-line.')
    } else if (Math.abs(marksAt - chromeAt - declared) > DELAY_TOLERANCE_MS) {
      failures.push(
        `the stage gap was ${Math.round(marksAt - chromeAt)}ms but the stylesheet declares ` +
          `${Math.round(declared)}ms. The rules are not reaching the marks as written.`,
      )
    } else if (duration !== null && declared < duration * MIN_DELAY_RATIO) {
      failures.push(
        `the delay is ${Math.round(declared)}ms against a ${Math.round(duration)}ms ` +
          `${moving.durationClass} duration — under ${MIN_DELAY_RATIO} of it, so it is almost ` +
          'certainly derived from the other duration class. `--gx-motion-stage-delay` must be ' +
          'rebound in the [data-motion-duration] rules; derived once on :root it resolves ' +
          'against the root duration and inherits down already computed.',
      )
    }

    // 4. The preference suppresses everything. Phrased as "no intermediate value ever
    //    appeared", not "the first frame was final" — under `reduce` the frames before React
    //    re-renders legitimately still read the START value, and calling that a failure would
    //    make this gate flaky rather than strict.
    for (const key of /** @type {const} */ (['gridY', 'lineD'])) {
      const leak = midOf(still, key)
      if (leak !== undefined) {
        failures.push(
          `prefers-reduced-motion: reduce still animated ${key} (saw ${leak[key]} at ` +
            `${Math.round(leak.t)}ms). The media query in chart.css must be \`no-preference\`, ` +
            'so the rules do not exist under the preference rather than being overridden.',
        )
      }
    }

    // 5. Same destination either way.
    if (moving.final.gridY !== still.final.gridY || moving.final.lineD !== still.final.lineD) {
      failures.push(
        'the resting state differs with and without motion. 20-architecture.md §7.4 requires ' +
          'the still chart to be the baseline artefact, not a degraded one.',
      )
    }

    if (failures.length === 0) {
      const version = browser.version?.() ?? 'unknown'
      const gridMid = midOf(moving, 'gridY')
      const pathMid = midOf(moving, 'lineD')
      const abbreviate = (v) => (v.length > 30 ? `${v.slice(0, 27)}…` : v)
      console.log(`motion gate (G19): clean — Chromium ${version} (playwright from ${from})`)
      console.log(`  resize   ${FROM.width}×${FROM.height} → ${TO.width}×${TO.height}`)
      console.log(
        `  stage 1  gridline y  ${moving.start.gridY} → ${gridMid?.gridY} → ${moving.final.gridY}`,
      )
      console.log(
        `  stage 2  path d      ${abbreviate(moving.start.lineD)} → ` +
          `${abbreviate(pathMid?.lineD ?? '?')} → ${abbreviate(moving.final.lineD)}`,
      )
      console.log(
        `  staging  chrome left at ${Math.round(chromeAt ?? 0)}ms, marks at ` +
          `${Math.round(marksAt ?? 0)}ms — a ${Math.round((marksAt ?? 0) - (chromeAt ?? 0))}ms ` +
          `gap against ${Math.round(declared ?? 0)}ms declared, ` +
          `${((declared ?? 0) / (duration || 1)).toFixed(2)} of the ${moving.durationClass} ` +
          `duration, over ${moving.samples.length} frames`,
      )
      console.log(
        `  reduce   ${still.samples.length} frame(s) sampled, none between the endpoints`,
      )
    }
  }
} finally {
  await browser.close().catch(() => {})
  server.stop()
}

if (failures.length > 0) {
  console.error(`motion gate (G19): ${failures.length} failure(s)\n`)
  for (const f of failures) console.error(`  ${f}`)
  console.error('\nSee research/decisions/016-what-svg-geometry-actually-transitions.md.')
  process.exit(1)
}
