# @shiftcharts/react

The adaptive client boundary for ShiftCharts. It exports `AutoChart`, which measures its container
and hands the resulting plan to `@shiftcharts/primitives`; `useElementSize`, the ResizeObserver-backed
measurement hook; `InteractionOverlay` for tooltip/crosshair behavior; and `LegendControl` for
controlled series visibility.

~~~tsx
import { AutoChart, LegendControl, useElementSize } from '@shiftcharts/react'
import '@shiftcharts/react/auto-chart.css'
import '@shiftcharts/react/interaction-overlay.css'
~~~

Import @shiftcharts/tokens/theme.css and @shiftcharts/primitives/chart.css separately when using the chart
renderer. Import @shiftcharts/react/interaction-overlay.css when using InteractionOverlay or AutoChart
plans with tooltip/crosshair behavior.

## License

MIT. See the bundled LICENSE file.
