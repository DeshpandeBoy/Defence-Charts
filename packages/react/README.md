# @gx/react

The client boundary for responsive line and area charts. It exports AutoChart, which measures
its container and hands the resulting plan to @gx/primitives; useElementSize, the
ResizeObserver-backed measurement hook; InteractionOverlay for planned tooltip/crosshair
behavior; and LegendControl for controlled series visibility.

~~~tsx
import { AutoChart, LegendControl, useElementSize } from '@gx/react'
import '@gx/react/auto-chart.css'
import '@gx/react/interaction-overlay.css'
~~~

Import @gx/tokens/theme.css and @gx/primitives/chart.css separately when using the chart
renderer. Import @gx/react/interaction-overlay.css when using InteractionOverlay or AutoChart
plans with tooltip/crosshair behavior.

## License

MIT. See the bundled LICENSE file.
