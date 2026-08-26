# @shiftcharts/core

Pure, serialisable contracts for the ShiftCharts responsive planner. The package contains data and
frame contracts for the Free-v1 chart catalogue, interaction identity/state, tooltip placement, text
metrics, and widget-layout values. It has no React or DOM dependency.

~~~ts
import { planChart, resolveFrame, type Series } from '@shiftcharts/core'
~~~

`planChart` supports line, area, bar/timebar, donut, KPI, progress, scatter, heatmap, and funnel.
Unsupported future chart families fail explicitly.

## License

MIT. See the bundled LICENSE file.
