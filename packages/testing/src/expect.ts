/**
 * The `expect*` semantic assertion helpers — what a rendered chart is asserted to *be*,
 * rather than what its markup happens to say.
 *
 * `research/30-implementation-plan.md` A4 asks for these **alongside** `@shiftcharts/primitives`,
 * not after it, for a reason worth restating: Recharts runs 315 spec files on this pattern,
 * and every one of them was cheap to write because the vocabulary existed first. Write the
 * vocabulary after the charts multiply and each new chart type arrives with its own
 * hand-rolled `container.querySelector('path')` — at which point the suite asserts markup,
 * not meaning, and a legitimate structural change breaks four hundred tests.
 *
 * ## ⚠ Why jsdom is imported here, by hand, in a Node environment
 *
 * The obvious construction is a DOM test environment and a global `document`. It is
 * rejected, and not on taste.
 *
 * Vitest selects a file's environment by matching its docblock directive with a **regex
 * over the whole file, comments included** — so a test file that merely *mentions* the
 * directive in prose silently switches itself into a DOM. Measured at A1: 776 ms of jsdom
 * setup versus 0 ms, caused by a `//` comment. Gate **G16** (`scripts/check-determinism.mjs`)
 * rejects the directive below the header for exactly that reason.
 *
 * Constructing the DOM inside these helpers means **no test file that uses them ever needs
 * the directive at all**, and a hazard nobody can trip is better than a hazard a gate
 * catches. Every consumer stays at `environment: 'node'`, which also keeps the determinism
 * preconditions in `vitest.config.ts` — the UTC clock, the frames-only fake timers, the
 * absent `ResizeObserver` — in force for free rather than by re-argument.
 *
 * ⚠ Consequently: **do not spell the directive out anywhere in this package**, comment or
 * code. `packages/testing/src/frame-timers.jsdom.test.ts` is the one file permitted to
 * carry it, and it carries it on line 1 so that G16 is proven not to reject legitimate use.
 *
 * ## ⚠ Why these throw plain `Error`s instead of calling `expect()`
 *
 * A Vitest assertion failure reads `expected 4 to be 5`. That is a diff, not a diagnosis.
 * Every throw below names the element it was looking at, what it found instead, and — where
 * one exists — the decision or research section that makes the difference matter. The
 * message *is* the product here, in the same way `scripts/check-determinism.mjs` prints a
 * gate name and a reason rather than a boolean.
 *
 * The side benefit is real: with no `vitest` import, these run from a bare Node script, which
 * is what gate **G14** will need when its element-set snapshot moves out of the test suite.
 *
 * ## What jsdom actually does with this markup — measured, not assumed
 *
 * ⚠ `new JSDOM(html)` parses as **HTML**, and the HTML parser's foreign-content rules are
 * what make this work at all: `<figure>` lands in `<body>` in the XHTML namespace, and
 * `<svg>` plus every descendant lands in the SVG namespace, with `viewBox`'s capital `B` and
 * camel-cased tag names like `clipPath` preserved through the attribute- and tag-adjustment
 * tables. Class selectors, `data-*` attributes and `textContent` on SVG `<text>` all behave.
 *
 * ⚠ **`contentType: 'application/xml'` is the trap, and it fails silently.** Markup with no
 * `xmlns` declaration parses under XML rules into elements with a **null** namespace — so
 * `document.querySelector('path')` still finds something, `getAttribute('d')` still returns
 * the string, and the element is not an SVG path. Assertions written against it pass while
 * testing nothing. Same shape as the happy-dom `0` this project already caught once: a thing
 * that looks like it works and quietly doesn't. Do not "fix" the parse mode.
 *
 * `research/30-implementation-plan.md` A4 · `research/40-chart-plan.md` §1.3.
 */

/* eslint-disable-next-line @typescript-eslint/triple-slash-reference --
   The rule's advice is "use `import` style instead", and there is nothing here to import.
   `./jsdom.d.ts` is an ambient `declare module 'jsdom'` — it exports no value and no named
   type, so `import './jsdom.d.ts'` would emit a runtime import of a file that does not exist
   in `dist`. A path reference is the only mechanism that puts an ambient declaration into a
   consuming program, which is exactly what is needed. Deleted along with the shim. */
/// <reference path="./jsdom.d.ts" />

/**
 * ⚠ **The reference above is what makes the shim travel, and it is not decoration.**
 * `./jsdom.d.ts` declares the `'jsdom'` module ambiently, and an ambient declaration only
 * applies to programs that actually contain the file. `packages/testing/tsconfig.json`
 * includes `src/**\/*`, so it is in scope when *this* package typechecks — but nothing
 * imports a `.d.ts`, so when another package resolves `@shiftcharts/testing` to this source file
 * through its `exports` map, the declaration is left behind and TS7016 comes back in a
 * package that never mentioned jsdom. `@shiftcharts/react` is where that first happened.
 *
 * A triple-slash reference is the mechanism for exactly this: it pulls the declaration into
 * whatever program contains this module. It goes when `jsdom.d.ts` does.
 */
import { JSDOM } from 'jsdom'

/** The namespace the HTML parser puts `<svg>` and its descendants into. */
const SVG_NS = 'http://www.w3.org/2000/svg'

/** Which axis a helper is talking about. Matches the `--x` / `--y` class modifier. */
export type ChartAxis = 'x' | 'y'

// --- parseChart ---------------------------------------------------------------------------

/**
 * A parsed chart, reduced to the four operations every helper below needs.
 *
 * Deliberately not the raw `Document`. Handing one back invites `chart.querySelectorAll(…)`
 * at every call site, and `querySelectorAll` returns a live-ish `NodeList` that reads badly
 * in a failure message and cannot be `.map`ped without ceremony. Four methods that return
 * plain arrays and throw useful errors is the whole surface anything here wants.
 */
export interface ParsedChart {
  /** The jsdom document. Escape hatch for an assertion this module has no vocabulary for. */
  readonly document: Document
  /**
   * The outermost element of the markup handed in — normally `figure.shiftcharts-chart`.
   *
   * ⚠ Not `document.documentElement`. jsdom wraps a fragment in a full document, so
   * `<html>`, `<head>` and `<body>` exist whether or not the caller wrote them; walking from
   * the document root would put three elements nobody rendered into `expectElementSet()`'s
   * snapshot.
   */
  readonly root: Element
  /** The `<svg>`. Required — markup without one is not a chart, and every helper needs it. */
  readonly svg: Element
  /** Every match, in document order, as a plain array. */
  all(selector: string): readonly Element[]
  /** The first match, or `null`. */
  first(selector: string): Element | null
  /** The first match, or a throw naming the selector and what the chart does contain. */
  one(selector: string): Element
}

/**
 * Parse chart markup into something queryable. The entry point everything else builds on.
 *
 * ⚠ The `<svg>` requirement is load-bearing rather than defensive. `<Chart>` renders its
 * `<svg>` unconditionally; markup arriving here without one means the component threw, or
 * rendered a fallback, or the caller passed the wrong string — and each of those is a
 * failure that would otherwise surface three assertions later as "expected 3 ticks, found 0",
 * which reads like a tick bug.
 */
export function parseChart(html: string): ParsedChart {
  const document = new JSDOM(html).window.document

  // ⚠ `body.firstElementChild`, with **no fallback to `documentElement`**. The fallback is
  // the obvious defensive move and it is a bug: for markup containing no elements, jsdom's
  // synthesised `<head>` is `documentElement.firstElementChild`, so the fallback promotes an
  // element nobody wrote to the root and every later assertion runs against a document
  // wrapper. Measured — this line had the fallback and `parseChart('   ')` reported a missing
  // `<svg>` inside `<head>` rather than empty markup. Foreign content lands in `<body>` too,
  // so a bare `<svg …>` string still parses correctly here.
  const root = document.body.firstElementChild
  if (root === null) {
    throw new Error(
      `parseChart: the markup contains no elements.\n  given: ${JSON.stringify(html.slice(0, 200))}`,
    )
  }

  const svg = document.querySelector('svg')
  if (svg === null) {
    throw new Error(
      'parseChart: no <svg> in the markup. <Chart> renders one unconditionally, so its ' +
        'absence means the component threw or rendered a fallback — not that the chart is ' +
        `empty.\n  outermost element: <${root.localName} class="${root.getAttribute('class') ?? ''}">`,
    )
  }

  const all = (selector: string): readonly Element[] =>
    Array.from(document.querySelectorAll(selector))

  return {
    document,
    root,
    svg,
    all,
    first: (selector) => document.querySelector(selector),
    one: (selector) => {
      const found = document.querySelector(selector)
      if (found === null) {
        throw new Error(
          `expected one \`${selector}\`, found none.\n  the chart contains: ${describeShape(root)}`,
        )
      }
      return found
    },
  }
}

/**
 * A one-line census of what a chart does contain, for the failure message of a selector that
 * matched nothing.
 *
 * ⚠ "found none" on its own sends a reader to the renderer. "found none; the chart contains
 * `shiftcharts-area`, `shiftcharts-point`" sends them to the plan, which is where the decision that omitted the
 * line actually lives. The distinction is most of this helper's value.
 */
function describeShape(root: Element): string {
  const classes = new Set<string>()
  for (const el of root.querySelectorAll('[class]')) {
    for (const name of el.classList) classes.add(name)
  }
  return classes.size === 0 ? '(no classed elements)' : [...classes].sort().join(', ')
}

// --- expectLine ---------------------------------------------------------------------------

/** What `expectLine()` hands back, for assertions this module has no opinion about. */
export interface ParsedLine {
  readonly element: Element
  readonly d: string
  /**
   * The number of `M` commands — one per contiguous run of defined points.
   *
   * ⚠ Named `segments`, not `points`, and the difference is not pedantry: a twelve-point
   * series with one `null` in the middle has twelve points and **two** segments. Calling this
   * a point count invites `expectLine(html, { points: data.length })`, which is wrong for
   * every series that has a gap — i.e. exactly the series this assertion exists to check.
   */
  readonly segments: number
}

export interface LineExpectation {
  /** `data-series-id`. Omit to take the first `path.shiftcharts-line` anywhere in the chart. */
  readonly series?: string
  /** Expected `M` count — gap count + 1. See `ParsedLine.segments`. */
  readonly segments?: number
}

/**
 * Assert that a series drew a line, and that the path it drew is a path a browser can render.
 *
 * ⚠ **The decimal-places check is the point of this helper.** `packages/core/src/frame.ts`
 * pins `.digits(2)` on every d3-shape generator, and `research/30-implementation-plan.md` A4
 * calls that "a deliberate choice, not an incidental one" — d3 rounds to 3 by default, which
 * is already what makes exact `d`-string assertions viable, and tightening to 2 is free
 * determinism. Nothing in the type system holds it. A generator constructed without
 * `.digits(2)` renders an identical-looking chart and emits `M0,0L1.235,2.346L3,4` where the
 * pinned one emits `M0,0L1.23,2.35L3,4`, so every `d`-string equality test and every gate
 * **G14** element snapshot drifts at once, on a machine-dependent last digit. This check turns
 * that into one failing assertion with a named cause.
 *
 * ⚠ `NaN` / `undefined` / `Infinity` are checked against the **raw** string before tokenising,
 * because tokenising destroys them: `a` and `t` are path commands, so `NaN` and `Infinity`
 * shred into fragments that no longer look wrong. A `d` containing `NaN` is the signature of a
 * scale asked for a value outside its domain, and SVG's response is to drop the entire path —
 * a chart with no line and no error.
 */
export function expectLine(html: string, expected: LineExpectation = {}): ParsedLine {
  const chart = parseChart(html)
  const scope = seriesScope(chart, expected.series)
  const where = expected.series === undefined ? 'the chart' : `series "${expected.series}"`

  const element = scope.querySelector('path.shiftcharts-line')
  if (element === null) {
    throw new Error(
      `expectLine: no \`path.shiftcharts-line\` in ${where}.\n  it contains: ${describeShape(scope)}`,
    )
  }

  const d = element.getAttribute('d')
  if (d === null || d === '') {
    throw new Error(
      `expectLine: \`path.shiftcharts-line\` in ${where} has ${d === null ? 'no' : 'an empty'} \`d\`. ` +
        'A defined series always produces a path; an empty one means the frame resolved no ' +
        'points, which is a data or domain failure rather than a rendering one.',
    )
  }

  assertPathData(d, `path.shiftcharts-line in ${where}`)

  const segments = (d.match(/M/g) ?? []).length
  if (expected.segments !== undefined && segments !== expected.segments) {
    throw new Error(
      `expectLine: ${where} drew ${String(segments)} segment(s), expected ` +
        `${String(expected.segments)}. An \`M\` starts each contiguous run of defined points, ` +
        `so this is gap count + 1.\n  d: ${d}`,
    )
  }

  return { element, d, segments }
}

/**
 * The `d`-string contract, shared by `path.shiftcharts-line` and anything else that grows a check.
 *
 * ⚠ Uppercase `M` only. d3-shape emits absolute commands exclusively, so a lowercase `m`
 * means the path came from somewhere other than the pinned generators — worth failing on
 * rather than quietly accepting, because everything else here assumes d3's output shape.
 */
function assertPathData(d: string, subject: string): void {
  const poison = /NaN|undefined|Infinity/.exec(d)
  if (poison !== null) {
    throw new Error(
      `expectLine: ${subject} has \`${poison[0]}\` in its \`d\`. SVG discards the whole path ` +
        'when it cannot parse a coordinate — the chart renders with no line, no console ' +
        `warning and no error.\n  d: ${d}`,
    )
  }

  if (!d.startsWith('M')) {
    throw new Error(
      `expectLine: ${subject} has a \`d\` that does not start with \`M\`. A path must open ` +
        `with an absolute moveto; d3-shape never emits relative commands.\n  d: ${d}`,
    )
  }

  // `e`/`E` are deliberately absent from this class: exponent notation must survive
  // tokenisation as one token so it fails the coordinate test below, rather than splitting
  // into two innocent-looking integers.
  const tokens = d.replace(/[MmLlHhVvCcSsQqTtAaZz]/g, ' ').split(/[\s,]+/).filter(Boolean)

  for (const token of tokens) {
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(token)) {
      const reason = /^-?\d+\.\d{3,}$/.test(token)
        ? `${String(token.split('.')[1]?.length ?? 0)} decimal places, and \`.digits(2)\` ` +
          'permits at most 2 — see the PATH_DIGITS docblock in packages/core/src/frame.ts'
        : 'not a plain decimal number'
      throw new Error(
        `expectLine: ${subject} has coordinate \`${token}\` — ${reason}.\n  d: ${d}`,
      )
    }
  }
}

// --- expectAxisTicks ----------------------------------------------------------------------

/**
 * One tick as the **markup** describes it — which is not `ComputedTick` from `@shiftcharts/core`, and
 * deliberately so.
 *
 * ⚠ `ComputedTick` has a non-optional `label: string` and `offset: number`. A parsed tick's
 * may be `null`, because a renderer that forgot to emit the label element produces exactly
 * that, and that is the bug this helper exists to catch. Reusing the frame's type would force
 * a cast or a default at the parse boundary and turn a caught failure into a `''` nobody sees.
 */
export interface ParsedTick {
  readonly element: Element
  /** `data-value`, verbatim. `null` when the attribute is absent. */
  readonly value: string | null
  /** The tick label's text, untrimmed. `null` when there is no `text.shiftcharts-axis__tick-label`. */
  readonly label: string | null
  /** Px along the axis. `null` when no source below could supply one. */
  readonly offset: number | null
}

export interface AxisExpectation {
  readonly count?: number
  /** Exact label strings, in document order. Implies the count. */
  readonly labels?: readonly string[]
}

/**
 * Assert an axis's tick count and, when given, its exact labels.
 *
 * Returns the parsed ticks so a caller can go on to assert offsets, `data-value`s, or
 * anything else this module has no vocabulary for.
 *
 * ⚠ Labels are compared **untrimmed**. A renderer that emits `<text> Jan </text>` draws a
 * label with a leading space, so trimming here would make the helper agree with markup a
 * browser renders differently — the assertion's job is to disagree.
 */
export function expectAxisTicks(
  html: string,
  axis: ChartAxis,
  expected: AxisExpectation = {},
): readonly ParsedTick[] {
  if (
    expected.count !== undefined &&
    expected.labels !== undefined &&
    expected.count !== expected.labels.length
  ) {
    throw new Error(
      `expectAxisTicks: called with count ${String(expected.count)} and ${String(
        expected.labels.length,
      )} labels. These cannot both be true — fix the call, not the chart.`,
    )
  }

  const chart = parseChart(html)
  const group = chart.first(`g.shiftcharts-axis--${axis}`)
  if (group === null) {
    const present = chart.all('g.shiftcharts-axis').map((el) => el.getAttribute('data-axis') ?? '?')
    throw new Error(
      `expectAxisTicks: no \`g.shiftcharts-axis--${axis}\` in the chart. Axis groups present: ` +
        `${present.length === 0 ? 'none' : present.join(', ')}. An axis the plan turned off ` +
        'is absent rather than empty — check the rung before the renderer.',
    )
  }

  const ticks = Array.from(group.querySelectorAll('g.shiftcharts-axis__tick'), (element) => ({
    element,
    value: element.getAttribute('data-value'),
    label: element.querySelector('text.shiftcharts-axis__tick-label')?.textContent ?? null,
    offset: readTickOffset(element, axis),
  }))

  const wanted = expected.count ?? expected.labels?.length
  if (wanted !== undefined && ticks.length !== wanted) {
    throw new Error(
      `expectAxisTicks: the ${axis} axis has ${String(ticks.length)} tick(s), expected ` +
        `${String(wanted)}.\n  labels: ${JSON.stringify(ticks.map((t) => t.label))}`,
    )
  }

  if (expected.labels !== undefined) {
    const actual = ticks.map((t) => t.label)
    const mismatch = actual.findIndex((label, i) => label !== expected.labels?.[i])
    if (mismatch !== -1) {
      throw new Error(
        `expectAxisTicks: the ${axis} axis label at index ${String(mismatch)} is ` +
          `${JSON.stringify(actual[mismatch])}, expected ` +
          `${JSON.stringify(expected.labels[mismatch])}.\n` +
          `  actual:   ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected.labels)}`,
      )
    }
  }

  return ticks
}

/**
 * Where a tick's along-axis offset comes from, in order of preference.
 *
 * ⚠ **The DOM contract A4 was handed does not pin this down**, so rather than guess once and
 * fail obscurely, this reads the three places a tick offset can legitimately live and says so.
 * `transform` is first because it is what visx's `AxisBottom` emits and what
 * `research/30-implementation-plan.md` A4 says to steal; the `<rect>` and `<text>` fallbacks
 * cover a renderer that positions children directly. If this list ever needs a fourth entry,
 * the render tree has changed shape and the change should be argued rather than absorbed.
 *
 * ⚠ Parsed off the attribute string, never `element.transform.baseVal`: jsdom implements the
 * SVG DOM's animated-transform list thinly, and reading a `0` out of an unimplemented property
 * is the failure mode this whole package is organised against.
 *
 * ⚠ Ticks are `<rect>`, never `<line>` — `x1`/`y1`/`x2`/`y2` are not CSS-settable in any
 * browser, so a `<line>` tick's length is unreachable from a token. Decision 012; enforced by
 * `expectElementSet()` below.
 */
function readTickOffset(tick: Element, axis: ChartAxis): number | null {
  const translate = /translate\(\s*(-?[\d.]+)\s*(?:[,\s]\s*(-?[\d.]+)\s*)?\)/.exec(
    tick.getAttribute('transform') ?? '',
  )
  if (translate !== null) {
    // A single-argument `translate(n)` means ty = 0, per SVG — so a y axis reading one is
    // correctly told "offset 0", not "no offset".
    const along = axis === 'x' ? translate[1] : (translate[2] ?? '0')
    const value = Number(along)
    if (Number.isFinite(value)) return value
  }

  const attribute = axis === 'x' ? 'x' : 'y'
  for (const selector of ['rect.shiftcharts-axis__tick-mark', 'text.shiftcharts-axis__tick-label']) {
    const raw = tick.querySelector(selector)?.getAttribute(attribute)
    if (raw === null || raw === undefined) continue
    const value = Number(raw)
    if (Number.isFinite(value)) return value
  }

  return null
}

// --- expectPoints -------------------------------------------------------------------------

export interface ParsedPoint {
  readonly element: Element
  /** `data-index` as a number, or `null` when the attribute is absent or unparseable. */
  readonly index: number | null
  readonly cx: number
  readonly cy: number
}

export interface PointsExpectation {
  /** `data-series-id`. Omit to count every point mark in the chart. */
  readonly series?: string
  readonly count?: number
}

/**
 * Assert the point marks a series drew, and that every one of them has a real position.
 *
 * ⚠ **A missing `cx` or `cy` is a failure, not a zero.** SVG defaults both to `0`, and
 * `Number(null)` is also `0`, so a frame that failed to position a point and a renderer that
 * dropped the attribute both produce a circle at the plot origin — visible, plausible, and
 * indistinguishable from a datum whose value really is at the origin. Requiring the attribute
 * to be present is the only way the two stay distinguishable. Same species of silent-zero
 * failure as happy-dom's `getBBox`, which `vitest.config.ts` documents at length.
 *
 * ⚠ The frame carries **every** defined point regardless of what `marks.points.mode` renders
 * (`packages/core/src/frame.ts`, `SeriesFrame.points`), so a count mismatch here is about the
 * renderer's filtering, not the frame's arithmetic. Look at the plan first.
 */
export function expectPoints(html: string, expected: PointsExpectation = {}): readonly ParsedPoint[] {
  const chart = parseChart(html)
  const scope = seriesScope(chart, expected.series)
  const where = expected.series === undefined ? 'the chart' : `series "${expected.series}"`

  const circles = Array.from(scope.querySelectorAll('circle.shiftcharts-point'))

  if (expected.count !== undefined && circles.length !== expected.count) {
    throw new Error(
      `expectPoints: ${where} has ${String(circles.length)} \`circle.shiftcharts-point\`, expected ` +
        `${String(expected.count)}. The frame carries every defined point and <PointMarks> ` +
        'filters — so check `marks.points.mode` on the plan before the geometry.',
    )
  }

  return circles.map((element, i) => {
    const cx = readRequiredCoordinate(element, 'cx', where, i)
    const cy = readRequiredCoordinate(element, 'cy', where, i)
    const rawIndex = element.getAttribute('data-index')
    const index = rawIndex === null ? Number.NaN : Number(rawIndex)
    return { element, index: Number.isFinite(index) ? index : null, cx, cy }
  })
}

function readRequiredCoordinate(
  circle: Element,
  attribute: 'cx' | 'cy',
  where: string,
  position: number,
): number {
  const raw = circle.getAttribute(attribute)
  if (raw === null) {
    throw new Error(
      `expectPoints: \`circle.shiftcharts-point\` #${String(position)} in ${where} has no \`${attribute}\`. ` +
        'SVG defaults it to 0, so an unpositioned point renders at the plot origin and looks ' +
        'like a datum rather than a bug.',
    )
  }
  const value = Number(raw)
  if (!Number.isFinite(value)) {
    throw new Error(
      `expectPoints: \`circle.shiftcharts-point\` #${String(position)} in ${where} has ` +
        `\`${attribute}="${raw}"\`, which is not a finite number. The browser drops the ` +
        'attribute and draws the circle at 0 — silently.',
    )
  }
  return value
}

// --- expectScale --------------------------------------------------------------------------

export interface ScaleBounds {
  readonly min: number
  readonly max: number
}

/** The two offsets `expectScale()` compared, for a caller that wants to go further. */
export interface ParsedScale {
  readonly first: number
  readonly last: number
}

/**
 * Assert that an axis's ticks span the pixel range they should, in the direction they should.
 *
 * ⚠ **The two axes run opposite ways, and this helper does not hide that.** SVG's y grows
 * *downward* from the plot origin, while a value domain ascends *upward*. `resolveFrame()`
 * emits `yTicks` in ascending domain order, so on the y axis the **first** tick in document
 * order carries the **largest** offset and the last carries the smallest. On the x axis the
 * offsets ascend as usual.
 *
 * Normalising that away — sorting the offsets, or comparing `Math.abs` — would make the helper
 * pass on a y axis rendered upside down, which is a bug you can see in a screenshot and cannot
 * see in a test. So the direction is asserted per axis, and stated here instead.
 *
 * `bounds` are inclusive, and are pixel offsets from the plot origin, not domain values —
 * `ComputedTick.offset` in `packages/core/src/frame.ts` is "px along the axis from the plot's
 * origin, not an absolute SVG coordinate".
 */
export function expectScale(html: string, axis: ChartAxis, bounds: ScaleBounds): ParsedScale {
  const ticks = expectAxisTicks(html, axis)

  if (ticks.length < 2) {
    throw new Error(
      `expectScale: the ${axis} axis has ${String(ticks.length)} tick(s). A scale needs two ` +
        'offsets to have a direction at all — assert the tick count first and find out why ' +
        'the ladder collapsed the axis.',
    )
  }

  const first = ticks[0]?.offset
  const last = ticks[ticks.length - 1]?.offset
  if (first === null || first === undefined || last === null || last === undefined) {
    throw new Error(
      `expectScale: the ${axis} axis's ticks carry no readable offset. Looked for a ` +
        '`transform="translate(…)"` on the tick group, then `x`/`y` on its `rect.shiftcharts-axis__tick-mark` ' +
        'and `text.shiftcharts-axis__tick-label`. If the renderer positions ticks some fourth way, that is ' +
        'a change of render-tree shape and belongs in a decision record.',
    )
  }

  for (const [name, offset] of [
    ['first', first],
    ['last', last],
  ] as const) {
    if (offset < bounds.min || offset > bounds.max) {
      throw new Error(
        `expectScale: the ${axis} axis's ${name} tick sits at ${String(offset)} px, outside ` +
          `[${String(bounds.min)}, ${String(bounds.max)}]. An offset past the plot box means ` +
          'the renderer and the resolver disagree about the plot — see the headline invariant ' +
          'in packages/core/src/frame.ts.',
      )
    }
  }

  // x: domain ascends left to right, so offsets ascend.
  // y: domain ascends upward while SVG y grows downward, so offsets descend.
  const ascending = axis === 'x'
  if (ascending ? first > last : first < last) {
    throw new Error(
      `expectScale: the ${axis} axis runs the wrong way — first tick at ${String(first)} px, ` +
        `last at ${String(last)} px, expected ${ascending ? 'ascending' : 'descending'} offsets. ` +
        (ascending
          ? 'The x domain ascends left to right.'
          : 'SVG y grows downward while the value domain ascends upward, so the first tick in ' +
            'document order must carry the largest offset. A y axis that ascends here is ' +
            'rendered upside down.'),
    )
  }

  return { first, last }
}

// --- expectElementSet ---------------------------------------------------------------------

/**
 * The sorted multiset of elements a chart rendered, for gate **G14**'s snapshot — and the
 * hard ban on `<line>` geometry that the snapshot exists to make reviewable.
 *
 * ## The ban
 *
 * ⚠ **Any SVG `<line>` carrying `x1`, `y1`, `x2` or `y2` fails immediately.**
 * `research/decisions/012-no-line-element-for-tokened-geometry.md` establishes why, and the
 * evidence is worth carrying here because the failure it prevents is invisible. SVG2 promotes
 * a specific list of geometry attributes to CSS properties — `cx`/`cy`/`r`/`rx`/`ry`,
 * `x`/`y`/`width`/`height`, and `d` — and those four attributes on `<line>` are the exception:
 * **not settable from CSS in any browser, with no proposal to change it.** So
 * `line { y2: var(--shiftcharts-tick-length) }` parses, passes gate **G7**'s token lint (a `var()` was
 * used), builds, warns about nothing, shows no devtools strikethrough — and does not change the
 * tick's length. A token can ship, be documented, be counted among the tokens, and do nothing.
 *
 * The same decision records an element census that corroborates it from the other direction:
 * **Vega renders 28 `<line>` elements** for ticks and gridlines, so a Vega chart's tick length
 * is structurally unreachable from CSS; **Observable Plot renders 0**, all eight marks being
 * `<path>`. Decision 012's ruling is `<rect>` for ticks and gridlines — `width` is the stroke
 * thickness and `height` the tick length, both plain CSS lengths — and `<path>` where a path
 * already exists.
 *
 * ⚠ **This check is stricter than decision 012's letter, and it has to be.** The decision bans
 * those attributes when *sourced from a `var(--shiftcharts-*)` value*, and leaves `<line>` legal for
 * geometry no token controls. By the time markup exists that provenance is gone: the attribute
 * holds a number, and nothing in the DOM says whether a token was meant to reach it. Decision
 * 012 anticipated this and asked for "the stronger form" — the element-set snapshot — for
 * exactly that reason. A `<line>` with no geometry attributes stays legal, which is the part of
 * the decision that survives intact.
 *
 * ## The snapshot
 *
 * ⚠ Entries are `tag#class`, where `#` is a **separator and not CSS id syntax** —
 * `g#shiftcharts-axis.shiftcharts-axis--x` is a `<g>` carrying two classes, not an element with that id. These
 * lines are read in a diff, not fed back to `querySelector`.
 *
 * ⚠ Tag names come from `localName`, not `tagName`, because the HTML parser hands back mixed
 * case: HTML elements uppercase (`FIGURE`), SVG elements lowercase (`svg`, `path`). A snapshot
 * built from `tagName` sorts the two families apart and turns a `<figure>` → `<div>` change
 * into a diff that moves half the file.
 *
 * ⚠ Sorted with the default comparator, never `localeCompare`, which is locale-dependent — the
 * same class of machine-dependent result that `TZ: 'UTC'` in `vitest.config.ts` exists to
 * prevent for time. A snapshot that reorders itself on a reviewer's laptop is not a gate.
 *
 * ⚠ Counts from `parseChart().root` down, so the `<html>`/`<head>`/`<body>` jsdom synthesises
 * around a fragment never enter the snapshot. It is a **multiset**: three `circle#shiftcharts-point`
 * elements produce three entries, so a dropped point mark is a diff rather than a nothing.
 */
export function expectElementSet(html: string): readonly string[] {
  const chart = parseChart(html)
  const elements = [chart.root, ...chart.root.querySelectorAll('*')]

  const GEOMETRY = ['x1', 'y1', 'x2', 'y2'] as const
  const offenders: string[] = []
  for (const el of elements) {
    if (el.namespaceURI !== SVG_NS || el.localName !== 'line') continue
    const carried = GEOMETRY.filter((name) => el.hasAttribute(name))
    if (carried.length > 0) {
      offenders.push(
        `<line ${carried.map((n) => `${n}="${el.getAttribute(n) ?? ''}"`).join(' ')}` +
          `${el.hasAttribute('class') ? ` class="${el.getAttribute('class') ?? ''}"` : ''}>`,
      )
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      `expectElementSet: ${String(offenders.length)} <line> element(s) carry geometry ` +
        'attributes that are not CSS-settable in any browser, so any token aimed at them ' +
        'parses, passes the token gate, builds, and does nothing. Use <rect> for ticks and ' +
        'gridlines (width = stroke thickness, height = tick length), <path> where a path ' +
        'already exists.\n' +
        offenders.map((o) => `  ${o}`).join('\n') +
        '\n  research/decisions/012-no-line-element-for-tokened-geometry.md',
    )
  }

  return elements
    .map((el) => {
      const classes = Array.from(el.classList).join('.')
      return classes === '' ? el.localName : `${el.localName}#${classes}`
    })
    .sort()
}

// --- shared ---------------------------------------------------------------------------------

/**
 * The element a `series` option scopes an assertion to.
 *
 * ⚠ Matched by reading `data-series-id` rather than by an attribute selector. A series id is
 * consumer-supplied and may contain a quote or a backslash, which would silently break
 * `[data-series-id="…"]` — and a selector that matches nothing is reported here as "no such
 * series", sending a reader to the data instead of to the escaping. It also makes the failure
 * message able to list the ids that do exist, which is the thing the reader actually wants.
 */
function seriesScope(chart: ParsedChart, series: string | undefined): Element {
  if (series === undefined) return chart.svg

  const groups = chart.all('g.shiftcharts-series')
  const match = groups.find((el) => el.getAttribute('data-series-id') === series)
  if (match === undefined) {
    const ids = groups.map((el) => JSON.stringify(el.getAttribute('data-series-id')))
    throw new Error(
      `no \`g.shiftcharts-series\` with \`data-series-id="${series}"\`. Series present: ` +
        `${ids.length === 0 ? 'none' : ids.join(', ')}.`,
    )
  }
  return match
}
