# @gx/react

The client boundary for responsive line and area charts. It exports AutoChart, which measures
its container and hands the resulting plan to @gx/primitives, and useElementSize, the
ResizeObserver-backed measurement hook.

~~~tsx
import { AutoChart, useElementSize } from '@gx/react'
import '@gx/react/auto-chart.css'
~~~

Import @gx/tokens/theme.css and @gx/primitives/chart.css separately when using the chart
renderer. This package does not export tooltip, crosshair, brush, or legend interaction yet.

## License

MIT. See the bundled LICENSE file.
