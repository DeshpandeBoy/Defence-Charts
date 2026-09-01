/**
 * Horizon bands — the mark a Tile falls back to when the plot is too short for a line to be
 * read as a shape.
 *
 * The ladder's floor: Heer 2009 puts the horizon chart's usable minimum at **6 px** of plot
 * height, against **24 px** for an optimally-read line. Between those, folding the series into
 * two or three mirrored, increasingly opaque bands buys back vertical resolution that simply
 * is not there.
 *
 * ⚠ **`band` and `sign` are attributes, and the opacity that reads off them is CSS.** The
 * whole visual mechanism of a horizon chart is that band *n* is more opaque than band *n−1*,
 * which is exactly the kind of thing a theme must be able to restate — a light theme and a
 * dark theme cannot share one opacity ramp. `fill-opacity` in an attribute would be invisible
 * to the token gate, so the components emit the ordinal and the stylesheet does the ramp.
 *
 * Negative bands carry `data-sign="-1"`. `frame.ts` mirrors them through a clamped scale, so
 * their geometry is already correct; the sign is here so a theme can colour a deficit
 * differently, which is conventional and which no amount of geometry can express.
 */

import type { HorizonBand } from '@shiftcharts/core'

import { classes } from './svg.ts'

export type HorizonBandsProps = {
  readonly bands: readonly HorizonBand[]
  readonly seriesId?: string
  readonly className?: string
}

export function HorizonBands({ bands, seriesId, className }: HorizonBandsProps) {
  return (
    <>
      {bands.map((b) =>
        b.d === '' ? null : (
          <path
            className={classes('shiftcharts-band', className)}
            key={`${b.sign}-${b.band}`}
            d={b.d}
            data-band={b.band}
            data-shiftcharts-mark-id={seriesId === undefined ? `band:${b.sign}:${b.band}` : `${seriesId}:band:${b.sign}:${b.band}`}
            data-sign={b.sign}
          />
        ),
      )}
    </>
  )
}
