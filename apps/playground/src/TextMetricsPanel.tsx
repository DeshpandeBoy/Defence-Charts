import type { TypeRank } from '@shiftcharts/core'
import { DEFAULT_TYPOGRAPHY, measureText, RANK_FONT_SIZE, ROBOTO_FLEX_METRICS } from '@shiftcharts/core'
import { useLayoutEffect, useRef, useState } from 'react'

const RANKS: readonly TypeRank[] = ['A', 'B', 'C', 'D', 'E']

/**
 * `measureText()` against the glyphs the browser actually paints.
 *
 * This is the verification instrument for `research/41-text-metrics.md` §6.1 — *"where
 * `measureText()` is inexact, it must err **wide**."* The bar is the prediction, computed with
 * no DOM at all; the glyphs are the truth. The bar must never be shorter than the text.
 *
 * ⚠ **The rendered text is styled from `DEFAULT_TYPOGRAPHY`, not from the stylesheet, and
 * that is load-bearing.** `ROBOTO_FLEX_METRICS` is keyed by rank, and a rank pins size,
 * weight, feature settings, stretch and optical sizing together because all five move
 * advances. Paint this string at the CSS default weight while measuring it against a
 * 700-weight table and the ratio below becomes a number about nothing — an instrument that
 * looks calibrated and is not, which is the failure species this repo keeps naming. Every
 * value here is read from the same object the table was generated under.
 */
export function TextMetricsPanel() {
  const [label, setLabel] = useState('Revenue, Q3 2026')
  const [rank, setRank] = useState<TypeRank>('B')
  const textRef = useRef<SVGTextElement | null>(null)
  const [browserWidth, setBrowserWidth] = useState<number | null>(null)
  const [hasReferenceFace, setHasReferenceFace] = useState(false)

  const style = DEFAULT_TYPOGRAPHY.byRank[rank]
  const fontSize = RANK_FONT_SIZE[rank]
  const planned = measureText(label, rank, DEFAULT_TYPOGRAPHY.metrics)

  useLayoutEffect(() => {
    const element = textRef.current
    if (element === null) return
    // ⚠ `getComputedTextLength()` is banned inside `@shiftcharts/core` by gate **G2** and is fine
    // here. That asymmetry is the whole architecture: the app may measure, the resolver may
    // not. The number below is what this browser painted; the number above is what a server
    // with no browser predicted from the same string.
    setBrowserWidth(element.getComputedTextLength())
    // Which face was used cannot be read back off the element, but whether the reference
    // face is *installed* can — and that is what decides how to read the ratio.
    setHasReferenceFace(
      isFaceInstalled(DEFAULT_TYPOGRAPHY.metrics.family, fontSize, style.fontWeight),
    )
  }, [label, rank, fontSize, style.fontWeight])

  const measured = browserWidth !== null && browserWidth > 0 ? browserWidth : null
  // The guarantee: ≥ 1 always. Below 1 is a collision waiting to happen in production.
  const ratio = measured === null ? null : planned / measured
  // The same number with the deliberate margin divided out — how closely the *table* tracks
  // the face this browser actually used.
  const calibrated = ratio === null ? null : ratio / ROBOTO_FLEX_METRICS.safetyFactor

  return (
    <section>
      <h2>measureText()</h2>

      <label className="control">
        <span className="control__label">Label</span>
        <input
          type="text"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value)
          }}
        />
      </label>

      <div className="control control--ranks" role="group" aria-label="Type rank">
        {RANKS.map((r) => (
          <button
            key={r}
            type="button"
            className={r === rank ? 'rank rank--active' : 'rank'}
            aria-pressed={r === rank}
            onClick={() => {
              setRank(r)
            }}
          >
            {r} · {RANK_FONT_SIZE[r]}px
          </button>
        ))}
      </div>

      <svg className="measure" viewBox={`0 0 420 ${String(fontSize * 2.4)}`} role="img">
        <title>
          Predicted width drawn as a bar behind the same string as the browser lays it out
        </title>
        <rect
          className="measure__predicted"
          x={0}
          y={0}
          width={planned}
          height={fontSize * 2.4}
        />
        <text
          ref={textRef}
          className="measure__text"
          x={0}
          y={fontSize * 1.6}
          fontSize={fontSize}
          fontWeight={style.fontWeight}
          style={{
            fontFamily: DEFAULT_TYPOGRAPHY.family,
            fontFeatureSettings: DEFAULT_TYPOGRAPHY.featureSettings,
            fontStretch: DEFAULT_TYPOGRAPHY.stretch,
            fontOpticalSizing: DEFAULT_TYPOGRAPHY.opticalSizing,
            letterSpacing: `${String(style.letterSpacing)}px`,
          }}
        >
          {label}
        </text>
      </svg>

      <dl className="kv">
        <dt>measureText()</dt>
        <dd>{planned.toFixed(1)} px</dd>
        <dt>this browser</dt>
        <dd>{measured === null ? '—' : `${measured.toFixed(1)} px`}</dd>
        <dt>over-estimate</dt>
        <dd>{ratio === null ? '—' : `${ratio.toFixed(2)}×`}</dd>
        <dt>margin divided out</dt>
        <dd>{calibrated === null ? '—' : `${calibrated.toFixed(2)}×`}</dd>
        <dt>reference face</dt>
        <dd>
          {hasReferenceFace
            ? `${DEFAULT_TYPOGRAPHY.metrics.family} — installed`
            : 'absent; painting a fallback'}
        </dd>
      </dl>

      <p className="warn">
        <strong>The bar must not be shorter than the glyphs.</strong> That is the whole claim,
        and it is the one thing to watch while typing. A prediction that is too{' '}
        <em>small</em> collides labels in production; one that is too <em>large</em> only
        degrades them a rung early. Erring wide is the recoverable direction, so{' '}
        <code>over-estimate</code> dropping below <code>1.00×</code> is a bug and nothing else
        here is.
      </p>
      <p className="note">
        ⚠ <strong>Two ratios, because they answer different questions.</strong>{' '}
        <code>over-estimate</code> includes <code>safetyFactor</code>, which is{' '}
        <code>{ROBOTO_FLEX_METRICS.safetyFactor}</code> — the widest advance ratio observed
        across the reachable fallback faces (§4.2). <code>margin divided out</code> removes it,
        leaving how closely the table tracks the face actually painted. At <code>1.00×</code>{' '}
        the two agree and the whole margin is still in hand. <em>Above</em> it this face is
        narrower than Roboto Flex and the prediction would have held with no margin at all;{' '}
        <em>below</em> it the face is wider and the margin is being spent as designed. It runs
        out at <code>{(1 / ROBOTO_FLEX_METRICS.safetyFactor).toFixed(2)}×</code> — the same
        bug as <code>over-estimate</code> reaching <code>1.00×</code>, one threshold stated on
        both scales.
      </p>
      <p className="note">
        ⚠ The playground does not bundle the reference face — it is measured offline by{' '}
        <code>scripts/generate-font-metrics.mjs</code>, and{' '}
        <code>research/41-text-metrics.md</code> §7 keeps font files out of the build. So on
        most machines this reads a fallback, which is a fair test of the safety factor and{' '}
        <em>not</em> a test of the table. One browser on one machine with one set of installed
        fonts is an illustration; §4.2&apos;s controlled <code>fonttools</code> pass is the
        calibration. ⚠ Segoe UI Variable stays UNVERIFIED — Windows-only, and never estimated.
      </p>
    </section>
  )
}

/**
 * Whether `family` is installed, decided by measuring rather than by asking.
 *
 * ⚠ **`document.fonts.check()` cannot answer this, and the way it fails is silent.** It
 * reports whether the faces the `FontFaceSet` already knows about for that family have
 * finished loading. A family with no `@font-face` rule contributes no faces, so there is
 * nothing outstanding and it answers `true` — for an installed face, for an absent one, and
 * for a family name that could not exist. It was this row&apos;s source until it was caught
 * reporting the reference face present on a machine painting `system-ui`: an instrument that
 * looks calibrated and is not, inside the panel whose entire job is to catch those.
 *
 * The stacked-generic comparison does answer it. Paint a probe with `family` ahead of a
 * generic, then with the generic alone: an installed face changes the advance, and an absent
 * one falls through to the same generic and returns a bit-identical width.
 *
 * ⚠ **Three generics, and the third is not belt-and-braces.** A browser resolves each generic
 * to some real installed face, so a probe can collide with the very thing it is testing.
 * Measured in headless Chromium on macOS: `Helvetica` is byte-identical to `sans-serif` and
 * `Courier New` is byte-identical to `monospace` — each invisible to a one-generic probe, and
 * each caught by the other two. An absent family differs from none of them, which is the
 * signature being looked for.
 *
 * ⚠ Canvas measurement here, `getComputedTextLength()` above, and neither is available to
 * `@shiftcharts/core` — gate **G2** bans both from the resolver. The app may measure; the thing whose
 * output must be identical on a server and in a browser may not.
 */
function isFaceInstalled(family: string, fontSize: number, weight: number): boolean {
  const context = document.createElement('canvas').getContext('2d')
  if (context === null) return false

  // Mixed-width glyphs and digits, so a face differing from the generic anywhere differs here.
  const probe = 'MWmwil0123'
  const widthOf = (stack: string): number => {
    context.font = `${String(weight)} ${String(fontSize)}px ${stack}`
    return context.measureText(probe).width
  }

  return (['monospace', 'serif', 'sans-serif'] as const).some(
    (generic) => widthOf(`"${family}", ${generic}`) !== widthOf(generic),
  )
}
