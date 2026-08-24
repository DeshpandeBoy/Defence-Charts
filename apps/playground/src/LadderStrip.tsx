import type { SizeClass } from '@gx/core'

/**
 * The six rungs, in the resolver's order, with the line/area ladder's own words for what
 * each one renders.
 *
 * ⚠ These strings are transcribed from `research/10-responsive-ladder.md` §4 "Line / area"
 * and describe what the resolver will draw, not what this playground draws. Nothing here is
 * computed — it is a legend for the highlight, so that a rung change reads as a change of
 * *content* rather than a change of label.
 */
const RUNGS: readonly { readonly sizeClass: SizeClass; readonly renders: string }[] = [
  {
    sizeClass: 'micro',
    renders: 'Single latest value, plus a summary phrase — the small-size-only add.',
  },
  {
    sizeClass: 'tile',
    renders:
      'Value + delta + sparkline. No axes, ticks, or gridlines. Under 24 px of plot: a 1-band horizon instead of a shrunken line.',
  },
  {
    sizeClass: 'strip',
    renders:
      'Line, x-axis endpoints only. No y-axis. Does not claim value legibility — plot height is under 40 px.',
  },
  {
    sizeClass: 'panel',
    renders:
      'y-axis 3–4 ticks, horizontal gridlines only, x-axis ticks by width, direct end-of-line series labels.',
  },
  {
    sizeClass: 'canvas',
    renders: 'y-axis title, point markers, legend if > 4 series, crosshair + tooltip.',
  },
  {
    sizeClass: 'stage',
    renders:
      'Annotations, min/max/last call-outs, threshold shading, optional secondary axis, small multiples if series > 4.',
  },
]

export function LadderStrip({ current }: { readonly current: SizeClass }) {
  return (
    <section>
      <h2>The ladder</h2>
      <ol className="ladder">
        {RUNGS.map((rung) => {
          const active = rung.sizeClass === current
          return (
            <li
              key={rung.sizeClass}
              className={active ? 'rung rung--active' : 'rung'}
              aria-current={active ? 'true' : undefined}
            >
              <span className="rung__name">{rung.sizeClass}</span>
              <span className="rung__renders">{rung.renders}</span>
            </li>
          )
        })}
      </ol>
      <p className="note">
        Complete specs, not diffs. Micro carries a summary phrase that Canvas does not — the
        ladder is not a sequence of things being taken away, which is why a plan states
        every field at every rung.
      </p>
      <p className="note">
        ⚠ <strong>Tile’s horizon cannot be reached by dragging this handle</strong>, and the
        reason is worth knowing rather than working around. The playground derives cells from
        pixels, so a 2-cell-wide box is at least 100 px tall, and Tile gives the plot half of
        that — a floor of 50 px, twice the 24 px the substitution needs. The state is real
        and asserted in <code>rungs/line.snapshot.test.ts</code>; it belongs to a{' '}
        <em>grid</em> widget, whose columns and rows come from its layout footprint instead
        of from its height. A 2×1 cell in a dense grid is 200×40 px, and nothing you can do
        to a standalone box reproduces it. That independence is why{' '}
        <code>SizeContext</code> carries both cells and raw pixels.
      </p>
    </section>
  )
}
