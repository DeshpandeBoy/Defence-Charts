# @shiftcharts/grid

Client-side dashboard placement for a 12-column widget grid. The package owns drag/resize
mechanics, keyboard movement and resizing, interaction lifecycle callbacks, widget shell regions,
stable layout adapters, and loading/empty/error/stale states. It does not decide what a widget
renders.

~~~tsx
import { WidgetGrid, WidgetShell } from '@shiftcharts/grid'
import '@shiftcharts/grid/widget-shell.css'
import '@shiftcharts/grid/widget-states.css'
import '@shiftcharts/grid/keyboard-grid.css'
~~~

React and React DOM are peer dependencies. The package wraps react-grid-layout 2.2.4 behind
project-owned serialisable layout types.

## Host-owned persistence

`WidgetGrid` emits immutable `LayoutSnapshot` values through its commit callbacks. Store that JSON
wherever your application owns persistence, then parse and reconcile it when loading:

~~~ts
import { parseLayoutSnapshot, serializeLayoutSnapshot } from '@shiftcharts/core'
import { reconcileGridLayoutSnapshot } from '@shiftcharts/grid'

const saved = parseLayoutSnapshot(json, { migrations })
const current = reconcileGridLayoutSnapshot(saved, [
  { id: 'sales', minW: 2, minH: 1 },
  { id: 'new-kpi', defaultPlacement: { x: 0, y: 4, w: 2, h: 1 } },
])

await save(serializeLayoutSnapshot(current))
~~~

ShiftCharts owns schema validation, migration, changed-widget reconciliation, and collision
settlement. Your application owns storage, retries, conflicts, and stable widget IDs.

## License

MIT. See the bundled LICENSE file.
