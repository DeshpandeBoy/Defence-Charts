/**
 * The flicker probe — does the A6 transition actually suffice as the hysteresis mechanism?
 *
 * ⚠ **THIS IS A PROBE, NOT A GATE.** It asserts nothing and always exits 0, for the same
 * reason `probe-motion.mjs` does not: it measures the *design*, not a regression. Its output is
 * the evidence `research/30-implementation-plan.md` A6 says is owed — *"Measure whether flicker
 * is still observable afterwards; only then consider a deadband, expressed as a fraction of the
 * boundary width, never as an absolute px value."* A6 shipped the mechanism and left that
 * sentence unanswered.
 *
 * ## The question, stated precisely
 *
 * `10-responsive-ladder.md` §8 item 1 recorded the measured need for a deadband and
 * is explicit that the transition is only the polish: a rung change that animates over
 * ~1000 ms is supposed to read as one gesture rather than as a flash, even when the container
 * wobbles across a boundary. That is a claim about what a user sees, and it decomposes:
 *
 *   1. **How sharp is the boundary?** If the classifier has tolerance of its own, a wobble
 *      never crosses it and there is nothing to smooth over.
 *   2. **If it is sharp, does the transition absorb the crossings?** A crossing that lands
 *      while the previous one is still animating is absorbed by construction — the chart never
 *      arrived, so nothing snapped back. A crossing that lands *after* the previous one settled
 *      is a completed recompose followed by another, which is exactly what §8 calls flicker.
 *   3. **Is what crosses the boundary even a tween?** This is the one the first two miss.
 *      `10-responsive-ladder.md` is explicit that a rung changes *information content*, not
 *      scale — so the thing that appears at a boundary is usually a set of **new elements**,
 *      and decision 016 case 12 already established that a freshly-mounted node has no previous
 *      value to interpolate from. If the boundary mounts rather than moves, the whole motion
 *      block is beside the point and neither of the first two questions matters.
 *
 * ⚠ **So the answer is a frequency, not a yes or a no, and the first version of this probe got
 * that wrong.** It ran one wobble at 9 Hz, found all nineteen crossings absorbed, and would
 * have reported that the transition suffices. It does — against a 9 Hz tremor, whose crossings
 * are 9–92 ms apart, which *any* envelope over about a tenth of a second absorbs. The
 * measurement was true and answered the easy question. The adversarial case is the **slow**
 * wobble: someone hunting for a size, nudging the handle back and forth every few seconds.
 * There the gaps exceed the envelope and each crossing completes. So this sweeps frequency and
 * reports where the crossover falls.
 *
 * ## Why this boundary
 *
 * `sizeContextFromPixels()` in `@gx/core` is `Math.floor(width / 100)`, so every rung boundary
 * sits on an exact hundred and the classifier has **no tolerance at all**. Held at five rows,
 * the chart's own box crossing 600 px is the Panel → Canvas edge: `FAMILY_MINIMA` gives Canvas
 * at 6×5 and Panel at 3×3, so the sixth column is what flips it. That is a `recompose` change,
 * the expensive one, which is the right case to probe.
 *
 * ⚠ The rung is recomputed from the **width trace** wherever a count is reported, never read
 * from `data-size-class`. React's `ResizeObserver` delivers on the frame after the layout
 * change, so the attribute lags by a frame or two and a count taken from it is a count of
 * *renders*, not of crossings. Both are recorded; the DOM one is reported separately as churn.
 *
 * Run it by hand: `pnpm probe:flicker`.
 */

import { ensureDevServer, openChromium, ORIGIN } from './check-containment.mjs'

/** Five rows, so the sixth column is the only thing that moves. */
const HEIGHT = 520

/** Where the *chart's* measured box crosses into a sixth column. */
const CHART_BOUNDARY = 600

/**
 * Amplitude of the wobble, in px. Six is enough to re-cross a boundary from either side of the
 * drift without depending on where the drift happens to be — the point is to isolate frequency.
 */
const AMPLITUDE_PX = 6

/**
 * The frequencies swept, in Hz. The top of the range is physiological hand tremor during a
 * sustained grip (tier **C** — ours, and conventional, not measured from users); the bottom is
 * a deliberate back-and-forth nudge every four seconds.
 */
const FREQUENCIES_HZ = [9, 4, 2, 1, 0.5, 0.25]

/** How long each wobble runs. Long enough for the slowest frequency to cross several times. */
const WOBBLE_MS = 9000

/* eslint-disable no-undef -- browser globals inside page.evaluate */

/**
 * Sweep integer widget widths and report both the rung and the chart's own measured width, so
 * the offset between the two is visible rather than surprising.
 *
 * @param {any} page
 */
async function probeBoundary(page) {
  return page.evaluate(
    async ({ height, lo, hi }) => {
      const widget = document.querySelector('.widget')
      if (widget === null) return { error: 'no .widget in the playground' }
      widget.style.height = `${height}px`

      const rows = []
      for (let w = lo; w <= hi; w += 1) {
        widget.style.width = `${w}px`
        // Two frames for the ResizeObserver and React's commit, then a beat.
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        await new Promise((r) => setTimeout(r, 60))
        const chart = document.querySelector('.gx-chart')
        const auto = document.querySelector('.gx-auto-chart') ?? chart
        rows.push({
          widget: w,
          measured: auto === null ? null : Math.round(auto.getBoundingClientRect().width * 100) / 100,
          rung: chart === null ? null : chart.getAttribute('data-size-class'),
          gridlines: document.querySelectorAll('.gx-grid__line').length,
          ticks: document.querySelectorAll('.gx-axis__tick').length,
        })
      }
      return { rows, error: null }
    },
    { height: HEIGHT, lo: CHART_BOUNDARY - 3, hi: CHART_BOUNDARY + 4 },
  )
}

/**
 * Run one wobble at one frequency, sampling every animation frame.
 *
 * @param {any} page
 * @param {{ centre: number, hz: number, amplitude: number, durationMs: number }} spec
 */
async function probeWobble(page, spec) {
  return page.evaluate(
    async ({ height, centre, hz, amplitude, durationMs }) => {
      const widget = document.querySelector('.widget')
      if (widget === null) return { error: 'no .widget in the playground' }

      // Start at the trough and settle fully, so the first crossing recorded is the first
      // crossing that happened rather than the tail of getting here.
      widget.style.height = `${height}px`
      widget.style.width = `${centre - amplitude}px`
      await new Promise((r) => setTimeout(r, 2200))

      const line = document.querySelector('.gx-line')
      const ms = (v) => {
        const n = Number.parseFloat(v)
        return Number.isNaN(n) ? null : n * 1000
      }
      const style = line === null ? null : getComputedStyle(line)
      const envelope =
        style === null
          ? null
          : (ms(style.transitionDuration) ?? 0) + (ms(style.transitionDelay) ?? 0)

      const samples = []
      const t0 = performance.now()
      await new Promise((resolve) => {
        const tick = () => {
          const t = performance.now() - t0
          // Cosine so the trace starts at the trough it settled at, with no step at t=0.
          const w = Math.round(centre - amplitude * Math.cos((2 * Math.PI * hz * t) / 1000))
          widget.style.width = `${w}px`
          const c = document.querySelector('.gx-chart')
          samples.push({ t, w, rung: c === null ? null : c.getAttribute('data-size-class') })
          if (t < durationMs) requestAnimationFrame(tick)
          else resolve(undefined)
        }
        requestAnimationFrame(tick)
      })

      return { samples, envelopeMs: envelope, error: null }
    },
    { height: HEIGHT, ...spec },
  )
}
/**
 * Cross the boundary once and sample the first frames of whatever appears, to establish
 * whether the elements a rung change introduces arrive gradually or at full strength.
 *
 * @param {any} page
 * @param {number} centre widget width at which the rung flips
 */
async function probeMount(page, centre) {
  return page.evaluate(
    async ({ height, below, above }) => {
      const widget = document.querySelector('.widget')
      if (widget === null) return { error: 'no .widget in the playground' }
      widget.style.height = `${height}px`
      widget.style.width = `${below}px`
      await new Promise((r) => setTimeout(r, 2200))

      const census = () => {
        const counts = {}
        const svg = document.querySelector('.gx-chart__svg')
        if (svg === null) return counts
        for (const el of svg.querySelectorAll('*')) {
          const name = el.getAttribute('class')
          if (name === null || name === '') continue
          counts[name] = (counts[name] ?? 0) + 1
        }
        return counts
      }

      const before = census()
      widget.style.width = `${above}px`

      const t0 = performance.now()
      const opacities = []
      await new Promise((resolve) => {
        const tick = () => {
          const t = performance.now() - t0
          const point = document.querySelector('.gx-point')
          if (point !== null) opacities.push(getComputedStyle(point).opacity)
          if (t < 700) requestAnimationFrame(tick)
          else resolve(undefined)
        }
        requestAnimationFrame(tick)
      })

      return { before, after: census(), opacities, error: null }
    },
    { height: HEIGHT, below: centre - 1, above: centre },
  )
}
/* eslint-enable no-undef */

/**
 * Replay a width trace through a hysteresis of `deadband` px and return the sample indices at
 * which the column count changed. This raw-width helper is retained to compare the measured
 * 0.50% floor with the shipped 1% fractional classifier; it is not the app's source of truth.
 *
 * ⚠ Counted on **columns**, not on rung names. The rung is a function of columns and rows, rows
 * are held fixed here, and counting columns keeps the replay honest about what changed rather
 * than about which of the six names it landed between.
 *
 * @param {readonly {w: number}[]} samples
 * @param {number} deadband
 * @param {number} offset px between the widget width we set and the box the classifier measured
 */
function crossings(samples, deadband, offset) {
  const first = samples[0]
  if (first === undefined) return []
  const colsOf = (w) => Math.floor((w - offset) / 100)
  let cols = colsOf(first.w)
  /** @type {number[]} */
  const at = []
  for (const [i, s] of samples.entries()) {
    const raw = colsOf(s.w)
    if (raw > cols && s.w - offset >= (cols + 1) * 100 + deadband) {
      cols = raw
      at.push(i)
    } else if (raw < cols && s.w - offset <= cols * 100 - deadband) {
      cols = raw
      at.push(i)
    }
  }
  return at
}

// --- CLI -------------------------------------------------------------------------------

const { browser, from } = await openChromium('flicker probe')

const server = await ensureDevServer().catch(async (error) => {
  await browser.close().catch(() => {})
  throw error
})

try {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await context.newPage()
  await page.goto(ORIGIN, { waitUntil: 'networkidle' })
  await page.waitForSelector('.gx-chart__svg', { timeout: 20_000 })

  const boundary = await probeBoundary(page)
  if (boundary.error !== null && boundary.error !== undefined) throw new Error(boundary.error)

  console.log(`flicker probe: ${from}\n`)
  console.log(`  1. How sharp is the boundary? (height ${HEIGHT}px, five rows)\n`)
  console.log('     widget   chart box   rung     grid  ticks')
  for (const r of boundary.rows) {
    console.log(
      `     ${String(r.widget).padStart(5)}px  ${String(r.measured).padStart(8)}px  ` +
        `${String(r.rung).padEnd(7)} ${String(r.gridlines).padStart(4)}  ${String(r.ticks).padStart(5)}`,
    )
  }

  // The widget carries chrome the chart does not, so the width we set is not the width the
  // classifier measured. Derive the offset from the sweep instead of assuming it is zero.
  const flip = boundary.rows.findIndex((r, i) => i > 0 && r.rung !== boundary.rows[i - 1].rung)
  const centre = flip === -1 ? CHART_BOUNDARY : boundary.rows[flip].widget
  const offset = centre - CHART_BOUNDARY
  console.log(
    `\n     One pixel wide: the rung flips between ${centre - 1}px and ${centre}px of widget ` +
      `width.\n     The widget carries ${offset}px the chart's box does not, so the ` +
      `classifier sees ${CHART_BOUNDARY}px there.`,
  )

  console.log(
    `\n  2. Does the transition absorb a wobble? ±${AMPLITUDE_PX}px around ${centre}px, ` +
      `${WOBBLE_MS}ms each.\n`,
  )
  console.log('        Hz   frames  crossings   gap min/max      absorbed   VISIBLE MOVES  churn')

  /** @type {{hz: number, visible: number, envelope: number}[]} */
  const results = []

  for (const hz of FREQUENCIES_HZ) {
    const run = await probeWobble(page, {
      centre,
      hz,
      amplitude: AMPLITUDE_PX,
      durationMs: WOBBLE_MS,
    })
    if (run.error !== null && run.error !== undefined) throw new Error(run.error)

    const envelope = run.envelopeMs ?? 0
    const at = crossings(run.samples, 0, offset)
    const gaps = at.slice(1).map((i, k) => run.samples[i].t - run.samples[at[k]].t)
    // The first crossing has nothing before it, so it is always visible — it is the resize the
    // user asked for. Every later one is visible only if the previous transition had settled.
    const absorbed = gaps.filter((g) => g <= envelope).length
    const visible = at.length === 0 ? 0 : 1 + (gaps.length - absorbed)

    let churn = 0
    for (const [i, s] of run.samples.entries()) {
      if (i > 0 && s.rung !== run.samples[i - 1].rung) churn += 1
    }

    console.log(
      `      ${String(hz).padStart(4)}   ${String(run.samples.length).padStart(6)}   ` +
        `${String(at.length).padStart(9)}   ` +
        `${(gaps.length === 0 ? '—' : `${Math.round(Math.min(...gaps))}/${Math.round(Math.max(...gaps))}ms`).padStart(13)}   ` +
        `${String(absorbed).padStart(8)}   ${String(visible).padStart(13)}  ${String(churn).padStart(5)}`,
    )
    results.push({ hz, visible, envelope })
  }

  const mount = await probeMount(page, centre)
  if (mount.error !== null && mount.error !== undefined) throw new Error(mount.error)

  await context.close()

  const envelope = results[0]?.envelope ?? 0
  const clean = results.filter((r) => r.visible <= 1).map((r) => r.hz)
  const dirty = results.filter((r) => r.visible > 1).map((r) => r.hz)
  console.log(
    `\n     Envelope ${envelope}ms ⇒ crossings closer together than that merge. A wobble of ` +
      `f Hz\n     crosses every ${'1/(2f)'} seconds, so the crossover sits near ` +
      `${(1000 / (2 * envelope)).toFixed(2)}Hz.`,
  )
  console.log(
    `     Absorbed at: ${clean.length === 0 ? 'none' : clean.join(', ') + ' Hz'}.` +
      `  Visible at: ${dirty.length === 0 ? 'none' : dirty.join(', ') + ' Hz'}.`,
  )

  console.log(`\n  3. Is what crosses the boundary even a tween?\n`)
  const names = new Set([...Object.keys(mount.before), ...Object.keys(mount.after)])
  /** @type {string[]} */
  const changed = []
  for (const n of [...names].sort()) {
    const a = mount.before[n] ?? 0
    const b = mount.after[n] ?? 0
    if (a !== b) changed.push(`${n}: ${a} → ${b}`)
  }
  console.log(
    changed.length === 0
      ? '     ⚠ NOTHING changed across the boundary — the wobble above proves nothing.'
      : `     Element census across one crossing:\n${changed.map((c) => `       ${c}`).join('\n')}`,
  )
  const distinct = [...new Set(mount.opacities)]
  console.log(
    `\n     Opacity of the first .gx-point over ${mount.opacities.length} frames after it ` +
      `mounted:\n       ${distinct.join(', ')}`,
  )
  console.log(
    distinct.length === 1 && distinct[0] === '1'
      ? '     ⇒ No fade. The elements arrive at full strength on frame one, because a\n' +
          '       mounted node has no previous value — decision 016 case 12, one level up.\n' +
          '       The motion block cannot absorb this at ANY wobble frequency.'
      : '     ⇒ The mount interpolates. Re-read decision 016 case 12; something changed.',
  )
} finally {
  await browser.close().catch(() => {})
  server.stop()
}
