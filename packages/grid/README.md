# @gx/grid

Client-side dashboard placement for a 12-column widget grid. The package owns drag/resize
mechanics, keyboard movement and resizing, interaction lifecycle callbacks, widget shell regions,
stable layout adapters, and loading/empty/error/stale states. It does not decide what a widget
renders.

~~~tsx
import { WidgetGrid, WidgetShell } from '@gx/grid'
import '@gx/grid/widget-shell.css'
import '@gx/grid/widget-states.css'
import '@gx/grid/keyboard-grid.css'
~~~

React and React DOM are peer dependencies. The package wraps react-grid-layout 2.2.4 behind
project-owned serialisable layout types.

## License

MIT. See the bundled LICENSE file.
