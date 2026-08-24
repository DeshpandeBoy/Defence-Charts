# @gx/core

Pure, serialisable contracts for the Defence-Charts line and area path. The package contains the
responsive planner, data and frame contracts, interaction identity/state, tooltip placement, text
metrics, and widget-layout values. It has no React or DOM dependency.

~~~ts
import { planChart, resolveFrame, type Series } from '@gx/core'
~~~

planChart currently supports line and area; unsupported chart families fail explicitly until their
roadmap milestone ships.

## License

MIT. See the bundled LICENSE file.
