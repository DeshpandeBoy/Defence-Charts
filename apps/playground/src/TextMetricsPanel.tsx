import type { TypeRank } from '@gx/core'
import { measureText, PROVISIONAL_FONT_METRICS, RANK_FONT_SIZE } from '@gx/core'
import { useLayoutEffect, useRef, useState } from 'react'

const RANKS: readonly TypeRank[] = ['A', 'B', 'C', 'D', 'E']

/**
 * `measureText()`, and how wrong it currently is.
 *
 * ⚠ This panel exists to make a **known, documented hole** visible rather than to
 * demonstrate a working feature. `PROVISIONAL_FONT_METRICS` ships zero per-character
 * coverage and a ~1 em latin fallback band, so every measurement is a deliberate
 * over-estimate — an honest upper bound, not an average dressed up as one. It is blocked on
 * `research/41-text-metrics.md` §4.1 (does the reference face ship `tnum`?) and §4.2
 * (calibrating `safetyFactor` against the four real fallback stacks).
 *
 * The consequence, stated so it is not discovered later: labels degrade **earlier** than
 * they should, and any A3 snapshot involving `maxChars` or `axisLabelDegrade` is
 * provisional and must be regenerated once a real table exists.
 */
export function TextMetricsPanel() {
  const [label, setLabel] = useState('Revenue, Q3 2026')
  const [rank, setRank] = useState<TypeRank>('B')
  const textRef = useRef<SVGTextElement | null>(null)
  const [browserWidth, setBrowserWidth] = useState<number | null>(null)

  const fontSize = RANK_FONT_SIZE[rank]
  const planned = measureText(label, rank, PROVISIONAL_FONT_METRICS)

  useLayoutEffect(() => {
    const element = textRef.current
    if (element === null) return
    // ⚠ `getComputedTextLength()` is banned inside `@gx/core` by gate **G2** and is fine
    // here. That asymmetry is the whole architecture: the app may measure, the resolver may
    // not. The number below is what the browser actually painted; the number above is what
    // a server with no browser would have predicted from the same string.
    setBrowserWidth(element.getComputedTextLength())
  }, [label, rank])

  const ratio = browserWidth !== null && browserWidth > 0 ? planned / browserWidth : null

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
        >
          {label}
        </text>
      </svg>

      <dl className="kv">
        <dt>measureText()</dt>
        <dd>{planned.toFixed(1)} px</dd>
        <dt>this browser</dt>
        <dd>{browserWidth === null ? '—' : `${browserWidth.toFixed(1)} px`}</dd>
        <dt>over-estimate</dt>
        <dd>{ratio === null ? '—' : `${ratio.toFixed(2)}×`}</dd>
      </dl>

      <p className="warn">
        The bar is the prediction; the glyphs are the truth. The gap between them is{' '}
        <code>PROVISIONAL_FONT_METRICS</code> — a fallback band with no per-character table
        behind it. It is wide on purpose: a measurement that is too <em>small</em> collides
        labels in production, and a measurement that is too <em>large</em> only degrades
        them early. Erring wide is the recoverable direction.
      </p>
      <p className="note">
        ⚠ The right-hand number is one browser on one machine with one set of installed
        fonts. It is an illustration, not the calibration — §4.2 needs a controlled
        measurement across SF, Segoe UI Variable, Roboto and DejaVu Sans before{' '}
        <code>safetyFactor</code> can move off 1.0.
      </p>
    </section>
  )
}
