# ShiftCharts sandbox chart analysis

This note records the implementation analysis behind the sandbox workbench. It is intentionally
specific to the shipped ShiftCharts source and does not treat the sandbox as a second chart engine.

## 1. Styling provenance

The chart is not rendered by a third-party chart component with a hidden default skin. ShiftCharts
uses d3's scale, array, time, and shape primitives in `packages/core/src/frame.ts`, while the SVG
render tree is owned by `packages/primitives/src/Chart.tsx` and its child components.

The visible result comes from three layers:

1. `@shiftcharts/core` resolves serialisable geometry and information decisions in
   `planChart()`, `resolvePlotBox()`, and `resolveFrame()`.
2. `@shiftcharts/primitives` emits the SVG/HTML structure. `packages/primitives/src/chart.css`
   applies token-backed marks, axes, labels, legends, and value-display styles.
3. `apps/sandbox/src/sandbox.css` supplies the workbench layout and scopes the theme/token
   overrides. The sandbox's inline width and height define the requested preview host size;
   they are not chart styling defaults.

`@shiftcharts/tokens/theme.css` supplies theme values and `SandboxApp` applies user-entered token
values as scoped `--shiftcharts-*` custom properties. The chart's `viewBox`, mark coordinates,
and inline geometry attributes are calculated output, not external visual styling. Tooltip
placement is calculated by `packages/core/src/tooltip-placement.ts` and rendered by the client
overlay in `packages/react/src/InteractionOverlay.tsx`.

## 2. Spacing diagnosis

The original sandbox passed a 760px `SizeContext` to static `<Chart>` while its preview column
was approximately 596px wide at the inspected viewport. The frame also used `overflow: hidden`.
The SVG therefore retained `viewBox="0 0 760 480"` and the right-side direct labels were outside
the visible frame. The observed label rectangles were approximately 787–842px while the frame
ended near 683px. This is a host measurement mismatch, not evidence that the core plot needs
arbitrary right padding.

The correct fix is to use the existing measured `AutoChart` boundary. It observes the chart-only
content wrapper, derives a fresh `SizeContext` from the real content box, re-runs the pure planner,
and renders a matching frame. Direct labels remain end-anchored inward from the final point by
the existing `regionGap` contract. `resolvePlotBox()` and `resolveFrame()` remain the sole geometry
authorities; no new outer margin or right-rail field is added.

## 3. Legend decision

The current resolver already represents legend intent in the plan:

- direct end labels are appropriate when the series count and size allow them;
- internal or external legends reserve their own bands through `legendBands()`;
- `LegendControl` provides a controlled client surface when future visibility/filtering is needed.

The sandbox keeps this responsive hybrid as the default and exposes legend placement through the
existing `PlanOverrides` control. A five-series controlled legend study uses the shipped
`LegendControl`; its parent owns `hiddenSeriesIds` and displays the resulting state. This proves
the future filtering seam without duplicating a chart-specific legend implementation or coupling
visibility state into core.

## 4. Tooltip and hover decision

Tooltip support already exists in `@shiftcharts/react`; d3 does not need a tooltip plugin. The
existing `InteractionOverlay` provides:

- shared rows for all series at the active X value;
- X/category header, series labels, and formatted values;
- hover, tap/touch lock, and keyboard focus/arrow navigation;
- fixed/fluid placement through the pure core placement function;
- viewport-safe clamping and hidden-row reporting;
- an optional vertical crosshair and an accessible status/tooltip surface.

The sandbox now mounts this layer through `AutoChart` and controls trigger, tooltip enabled state,
placement, crosshair, and active-point highlighting. Active points are rendered in the React
interaction layer with the existing point and series tokens, so core remains serialisable and
DOM-free. The existing tooltip safe padding and offset stay as library defaults until a visual
study proves that new policy fields are needed.

## 5. Reusable architecture answer

The implementation keeps the existing boundaries:

```text
AutoChart (measure)
  -> planChart (pure information/layout decision)
  -> Chart (RSC-safe SVG/HTML renderer)
  -> InteractionOverlay (client tooltip, focus, crosshair, active points)
  -> LegendControl (optional controlled consumer state)
```

This makes spacing, labels, legend bands, typography tokens, tooltip placement, and interaction
behavior reusable across every registered family. The sandbox promotes no one-off CSS patch into
core and does not modify `apps/playground`.

## 6. Requested analysis questions answered

| Question | Answer |
|---|---|
| What comes from the core chart library? | d3 supplies low-level scales and paths; ShiftCharts core owns plan and frame geometry. |
| What is styled externally? | Primitive chart CSS, token themes, and sandbox-scoped layout/token overrides. |
| Where are styles/configuration located? | `packages/primitives/src/chart.css`, `packages/tokens/src/themes/theme.css`, `apps/sandbox/src/sandbox.css`, and the plan/policy/override modules. |
| Why was left spacing larger? | The left y-axis gutter was part of a 760px plan; the right side was clipped when that plan was placed in a narrower host. |
| Was the right side overflowing? | Yes: direct-label rectangles extended beyond the approximately 596px visible frame. The fixed SVG was being clipped. |
| What balances spacing? | Measure the actual chart-only host and resolve plan/frame from that same box; keep the existing inward direct-label anchor. |
| How should legends work? | Responsive hybrid: direct labels where they fit, reserved Strip/Panel legends when required, and controlled legend state for future filtering. |
| Is tooltip functionality available? | Yes, through `@shiftcharts/react` and the pure core placement helper. |
| How is it initialized? | Render `AutoChart`, import its two CSS files, and set existing interaction plan overrides. |
| What becomes reusable? | The measured React boundary, shared overlay behavior, active-point presentation, legend control, and existing token/plan contracts. |
| Which files change? | Sandbox app/stylesheet/README, sandbox dependency metadata/lockfile, and the React overlay/AutoChart client boundary only. |
