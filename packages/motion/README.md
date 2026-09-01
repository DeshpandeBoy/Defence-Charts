# @shiftcharts/motion

Opt-in client-side motion orchestration for ShiftCharts. The package preserves the core chart
rendering boundary and only coordinates already-rendered SVG marks.

```tsx
import { MotionBoundary } from '@shiftcharts/motion'
import '@shiftcharts/motion/motion.css'

<MotionBoundary preset="cinematic" quality="auto">
  <AutoChart {...props} />
</MotionBoundary>
```

`cinematic` is intentionally opt-in. It interpolates compatible geometry, crossfades incompatible
paths, and removes visual exit ghosts after they finish. `prefers-reduced-motion: reduce` always
disables imperative motion and leaves the chart at its normal final state.

## License

MIT. See the bundled LICENSE file.
