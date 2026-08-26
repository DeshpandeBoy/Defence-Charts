# D0.2 family matrix fixture

This fixture is the reusable acceptance surface for chart families. It is intentionally outside
the published packages and does not register a family or add runtime behavior.

The shared matrix definition in matrix.ts is consumed by:

- scripts/check-family-matrix.test.mjs for deterministic plan, serialisation, static markup,
  state, boundary, and stable-identity assertions;
- scripts/check-family-matrix.mjs for real Chromium theme, media, resize, accessibility, and
  screenshot evidence;
- FamilyMatrixApp.tsx for the visual gallery.

The ladder cards reuse `@shiftcharts/react`'s `useElementSize` with the direct `Chart` path. The measured
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

## Visual comprehension checks

Dimensions 1–7 above prove a family's *markup* is well-formed. They do not prove a viewer can read
what it says. `CR-VT01`'s cross-family audit
(`research/agent-work/claude/CR-VT01-visual-family-audit.md`) found nine comprehension defects
invisible to dimensions 1–7 across families that already passed them — a fabricated aggregate value,
an unlabelled number, a negative value rendering identical to zero, colliding labels, a legend
implying colour-coding a chart doesn't have, and a category identity that fell back to a raw point
index. Each was found only by checking what the rendered numbers, labels, and colours actually
claim, not that markup merely exists — and each had shipped silently across a full family+rung
matrix before the audit caught it.

A new family's acceptance pass must also check, wherever the family's marks make it applicable:

8. Every compact/aggregate value at the smallest rung is the true value, not zero because that
   rung's mark geometry wasn't built (`VT-001`).
9. Every summary number carries its unit/label, not a bare digit that could be mistaken for a raw
   count or index (`VT-002`).
10. A value's sign is never lost to bucketing/rounding — a negative reading must not resolve to the
    same visual treatment as a true zero (`VT-004`).
11. Direct/in-plot labels do not silently overlap; when there is no room for every label, the family
    degrades explicitly (an occlusion marker, a shorter text tier) rather than painting a collision
    (`VT-005`/`VT-006`).
12. Composed or adjacent text respects the width it is actually given, at every rung including the
    narrowest — not just the ones a fixture happened to test with short strings
    (`VT-007`, and this project's own `VT-003` fallout: see `research/handoffs/VT-003.md`).
13. Colour a legend/key implies is coded to the mark is the same colour source the mark itself uses
    — never two independently-cycling palettes for the same categories (`VT-008`).
14. A category/stage identity is a real name when the data supplies one, not a fallback to raw point
    index or position (`VT-003`).

Add the regression check for each new instance directly to `scripts/check-family-matrix.mjs`
alongside the family's own assertions, in the same pass that adds the family — not as a follow-up
audit. `CR-VT01` found these because they had accumulated silently across every existing family;
a new family joining the matrix should not add another one for a future audit to rediscover.
