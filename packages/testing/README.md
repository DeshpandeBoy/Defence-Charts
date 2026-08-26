# @shiftcharts/testing

Dev-facing helpers for testing ShiftCharts output. It exports semantic markup assertions for
lines, axes, points, scales, and element sets, plus an injected FakeResizeObserver with a
deterministic emit() driver.

~~~ts
import { FakeResizeObserver, expectLine } from '@shiftcharts/testing'
~~~

jsdom is a runtime dependency because the exported markup parsers construct a DOM to inspect
rendered output. The fake never patches globalThis.

## License

MIT. See the bundled LICENSE file.
