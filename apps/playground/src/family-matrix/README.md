# D0.2 family matrix fixture

This fixture is the reusable acceptance surface for chart families. It is intentionally outside
the published packages and does not register a family or add runtime behavior.

The shared matrix definition in matrix.ts is consumed by:

- scripts/check-family-matrix.test.mjs for deterministic plan, serialisation, static markup,
  state, boundary, and stable-identity assertions;
- scripts/check-family-matrix.mjs for real Chromium theme, media, resize, accessibility, and
  screenshot evidence;
- FamilyMatrixApp.tsx for the visual gallery.

The ladder cards reuse `@gx/react`'s `useElementSize` with the direct `Chart` path. The measured
pixel context drives the SVG frame while the row's `cols`/`rows` drive the semantic information
budget (`Micro` through `Stage`). `AutoChart` is intentionally not used for these cards: its
client interaction overlay would change this static/RSC-safe matrix's markup on interactive rungs.
The normal and empty state fixtures also continue to use direct `Chart` output.

Future family work should add family-local rows to the same matrix shape and keep the acceptance
dimensions intact:

1. Micro, Tile, Strip, Panel, Canvas, and Stage.
2. Exact one-pixel resize boundaries in both directions.
3. Plan metadata and JSON round-trip.
4. Normal, empty, and host-owned error states.
5. Static accessible output without interaction-only markup.
6. Stable series and datum identity.
7. Dark/light themes, forced colors, and reduced motion.

The error state is a host fixture because the chart library is presentational. A family must not
add fetching, retry, persistence, or an error store to make this matrix pass.
