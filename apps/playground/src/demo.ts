import type { Series } from '@gx/core'

/**
 * The playground's demo data.
 *
 * ⚠ **Deterministic, and deliberately not random.** A seeded generator is still a generator:
 * the chart would change shape on every reload, and a reviewer comparing two runs of the
 * resize lab would be comparing two different datasets. Everything below is a pure function
 * of its index, so the same drag produces the same picture every time.
 *
 * ⚠ **Six labels, all exactly five characters.** `resolveForPlayground()` used to assert
 * `labelMaxChars: 5` in a synthetic shape, with a comment explaining that short labels hold
 * the horizontal chain's degrade step still so that *one variable moves at a time* while you
 * drag. That intent is worth keeping, so the names preserve the number rather than the
 * assertion — `describeShape()` now measures 5 because the labels really are 5.
 *
 * ⚠ **No negatives**, for the same reason: the old synthetic shape said `hasNegative: false`,
 * and a resolver decision that turned on the presence of a negative would otherwise start
 * moving for reasons the size handle does not explain.
 */
const NAMES = ['Alpha', 'Bravo', 'Gamma', 'Delta', 'Sigma', 'Omega'] as const

const DAY = 86_400_000
/** A fixed UTC epoch. `TZ=UTC` is pinned in the test config; this keeps the app agreeing. */
const START = Date.UTC(2024, 0, 1)

/**
 * `count` series of `points` daily observations.
 *
 * ⚠ **One deliberate gap.** The fourth point of the last series is `null`, which is a *gap*
 * and not a zero — `frame.ts` feeds it to d3-shape's `.defined()` and the line breaks rather
 * than diving to the axis. It is here because a gap that is never rendered is a code path
 * that is never seen, and the difference between a break and a dive is the difference
 * between "no reading was taken" and "the reading was nothing".
 */
export function demoSeries(count: number, points = 60): readonly Series[] {
  const n = Math.max(0, Math.min(NAMES.length, Math.floor(count)))

  return Array.from({ length: n }, (_, s) => {
    const name = NAMES[s] ?? `S${s + 1}`
    const isLast = s === n - 1

    return {
      id: name.toLowerCase(),
      label: name,
      points: Array.from({ length: points }, (_, i) => ({
        x: new Date(START + i * DAY),
        y: isLast && i === 3 ? null : value(s, i),
      })),
    }
  })
}

/**
 * A slow swell plus a faster ripple, offset per series and floored above zero.
 *
 * The two frequencies are what make the line worth looking at while resizing: the swell
 * survives every rung, the ripple is the first thing a Tile-sized plot loses. That is the
 * ladder's whole argument, drawn rather than described.
 */
function value(seriesIndex: number, i: number): number {
  const phase = seriesIndex * 1.7
  const swell = Math.sin(i / 9 + phase) * 18
  const ripple = Math.sin(i / 2.5 + phase) * 4
  const base = 40 + seriesIndex * 12
  return Math.round((base + swell + ripple) * 100) / 100
}
