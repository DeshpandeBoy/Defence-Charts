# Dashboard grid / drag-resize landscape

> workflow agent `a511a427e2667961b` - 33,298 chars

---

# Draggable/Resizable 12-Column Dashboard Grid — React 19 / Next.js 16 (research, 2026-08-22)

All version/download/star figures verified this session against `registry.npmjs.org`, `api.github.com`, `api.npmjs.org/downloads`, `bundlephobia.com`. Weekly downloads = 2026-08-15 → 2026-08-21.

---

## 0. Headline finding that changes the default answer

**react-grid-layout is no longer the abandoned Flow codebase everyone remembers.** It was moved to the `react-grid-layout/react-grid-layout` org and completely rewritten in TypeScript.

| | |
|---|---|
| v2.0.0 | 2025-12-09 — full TS rewrite, hooks API, tsup ESM+CJS, Enzyme → RTL |
| v2.1.0 | 2025-12-14 — pluggable constraints, O(n log n) compactors, `wrapCompactor` |
| v2.2.0 | 2025-12-29 — **"contains a critical layout bug. Use 2.2.1 or later"** (do not pin) |
| v2.2.4 | 2026-07-29 — current `latest` |
| `legacy` dist-tag | `1.5.4` (2026-07-29) — v1 API preserved at `react-grid-layout/legacy` |
| repo | 22,389 stars, 62 open issues, pushed 2026-08-07, MIT |

Critically for you: **v2 splits into subpath exports** — `.`, `./core`, `./react`, `./legacy`, `./extras`, `./css/styles.css`. `./core` is **pure framework-agnostic TypeScript** (collision, compaction, calculate, constraints, responsive, sort) with no React import. `sideEffects: ["*.css"]`.

---

## 1. Library matrix

Legend for keyboard column: **None** = no `tabIndex`/`role`/key handler anywhere in the interaction path.

### 1.1 Grid/dashboard engines

| Library | Latest (date) | License | Weekly DL | Bundle (min / min+gz) | React 19 | Keyboard move/resize | SSR/RSC |
|---|---|---|---|---|---|---|---|
| **react-grid-layout** | 2.2.4 (2026-07-29) | MIT | 3,683,378 | 73,474 B / 22,825 B | **Yes, de facto** (see §2) | **None** — verified in source | Client-only component; `useContainerWidth({measureBeforeMount:true})` is the documented SSR path |
| **gridstack** | 13.2.0 (2026-08-20) | MIT | 610,873 | 86,946 B / 23,837 B | Unstated (UNVERIFIED) | **None**. Issue #830 "Accessibility Review Required" closed `status:wontfix` (2020-02-17). PR #3092 "Move items with keyboard controls" open + tagged `status:invalid` since 2025-07-10 | Not documented anywhere; measures DOM directly, needs `window` |
| **@snapgridjs/react** | 0.10.0 (2026-08-01) | MIT | 49,560 | ~38 kB brotli *claimed by vendor* | peer `react >=18` | **Claims full keyboard DnD** (see §3) | Has a dedicated SSR guide |
| **muuri** | 0.9.5 (**2021-07-09**) | MIT | 46,027 | — | n/a (vanilla) | None | **DEAD** — last commit 2022-09-14, 117 open issues |

### 1.2 DnD primitives (no resize)

| Library | Latest (date) | License | Weekly DL | Bundle | React 19 peer | Keyboard |
|---|---|---|---|---|---|---|
| **@dnd-kit/core** (legacy line) | 6.3.1 | MIT | 23,533,529 | 43,700 B / 14,237 B | `>=16.8.0` | **Best-in-class for MOVE.** `KeyboardSensor`; defaults `start:['Space','Enter']`, `cancel:['Escape']`, `end:['Space','Enter']`; arrows move 25 px/press; `getNextCoordinates` override; `screenReaderInstructions` on `<DndContext>`. **Zero resize support** |
| **@dnd-kit/sortable** | 10.0.0 | MIT | — | — | peer `@dnd-kit/core ^6.3.0` | `sortableKeyboardCoordinates` maps arrows → index changes |
| **@dnd-kit/react** + **@dnd-kit/dom** (new line) | 0.5.0 (2026-06-11) | MIT | 1,162,149 | ESM-only, `sideEffects:false` | `^18.0.0 \|\| ^19.0.0` | KeyboardSensor now matches on `event.key` not `event.code` (commit 2026-06-30, PR #2094 2026-07-13). Still 0.x |
| **@atlaskit/pragmatic-drag-and-drop** | 3.0.0 | **Apache-2.0** | 1,254,655 | deps: `raf-schd`, `bind-event-listener`, `@babel/runtime` | `^18.2.0 \|\| ^19.0.0` (on react add-ons) | **Deliberately none.** Verbatim: *"The core package... does not enable accessible controls automatically, as there is no one pattern that works well for all situations"* and *"For most experiences, we recommend not leveraging directional controls (arrow keys)."* Prescribes a "More (…)" menu button + `announce()` live region instead |
| **@hello-pangea/dnd** | 18.0.1 | **Apache-2.0** | 3,028,473 | redux + react-redux runtime deps | `^18 \|\| ^19` | Excellent list keyboard DnD (rbd heritage). 1-D lists only, no resize |
| **interact.js** | 1.10.28 (2026-08-01; prior 1.10.27 was 2024-03-28) | MIT | 725,043 | 1.4 MB unpacked | n/a | None. `next` dist-tag stuck at **1.8.3**. Near-dormant, one release in 2.4 yrs |
| **react-moveable** | 0.56.0 (**2023-12-03**) | MIT | 590,400 | **13 runtime deps** | no peer declared | None. Stale on npm |
| **swapy** | 1.0.5 (2025-01-19) | **GPL-3.0** | 16,857 | — | — | **License disqualifies it** for an MIT library |

### 1.3 Panel / tiling managers (wrong shape for 12-col, but the a11y reference implementation)

| Library | Latest (date) | License | Weekly DL | React 19 | Keyboard |
|---|---|---|---|---|---|
| **react-resizable-panels** | 4.12.3 (2026-08-16) | MIT | **38,093,012** | `^18.0.0 \|\| ^19.0.0`, **zero runtime deps** | **The gold standard — copy this.** See §4 |
| **react-mosaic-component** | 7.0.0 (2026-07-13) | **Apache-2.0** | 71,497 | peer `react: "16 - 19"` | Weak. 11 runtime deps incl. `react-dnd@16`, `lodash-es`, `redux`-free but heavy |
| **dockview** | 8.2.0 (2026-08-19) | MIT | 215,205 | — | UNVERIFIED. Very actively released (8.0.0 → 8.2.0 in 9 days) |
| **flexlayout-react** | 0.10.5 | MIT | 96,147 | `^18.0.0 \|\| ^19.0.0`, zero deps, `engines.node >=20` | UNVERIFIED |
| **golden-layout** | 2.6.0 (**2022-09-26**) | MIT | 16,396 | n/a | None. npm dormant ~4 yrs (repo pushed 2026-01-25 but nothing published) |

### 1.4 Also-rans found by npm search (2025/2026)

- `react-resizable-layout@0.7.3` (2025-09-19, MIT, zero deps) — "Lightweight, **accessible** headless React component and hook". Splitter-shaped, not grid.
- `re-resizable@6.11.2` (2025-02-24, MIT, zero deps, peer includes `^19.0.0`) — single-element resize only.
- `grid-layout-plus@1.1.1` (2025-10-13) — Vue only.
- `@katoid/angular-grid-layout@3.1.0` — Angular only.
- `react-draggable@4.7.1` (2026-07-29) and `react-resizable@4.0.2` (2026-06-18) — both alive; RGL 2.2.4 still pins `react-resizable ^3.1.3`, master pins `^3.2.0` (**not** the 4.x line).

---

## 2. React 19 compatibility — the `findDOMNode` question, answered

React 19 removed `ReactDOM.findDOMNode`. RGL's transitive dep chain (`react-resizable` → `react-draggable`) is where this historically bit.

**Verified in `src/react/components/GridItem.tsx` on master: RGL passes `nodeRef`, and `findDOMNode` appears zero times.**

```
<DraggableCore
  disabled={!isDraggable} onStart={onDragStart} onDrag={onDrag} onStop={onDragStop}
  handle={handle} cancel={".react-resizable-handle" + (cancel ? "," + cancel : "")}
  scale={transformScale} allowMobileScroll={allowMobileScroll}
  nodeRef={elementRef}
/>
```

CHANGELOG corroborates: **v1.2.3** — "usage of `ReactDOM` was removed via `React.createRef()` plus react-draggable's `nodeRef` prop, enabling full `<React.StrictMode>` compatibility."

Supporting evidence:
- `react-draggable@4.7.1` devDeps pin `react: "19"`, `react-dom: "19"`, `@types/react ^19.2.7`, plus an alias `"@types/react-18": "npm:@types/react@^18.3.27"` for dual type-checking.
- RGL's own peerDeps are the open-ended `>= 16.3.0` / `>= 16.3.0`, so npm won't warn.

**Caveats (be explicit in the planning doc):**
1. RGL's `package.json` devDeps pin `react: "^18.3.1"` / `react-dom: "^18.3.1"` — **the test matrix runs on React 18, not 19.** `@types/react` is `^19.2.14` so typecheck is 19. React 19 is *permitted and structurally sound but not CI-exercised*. Mark as **works-in-practice, not certified**.
2. No release note or CHANGELOG line anywhere in RGL mentions "React 19". Zero hits.
3. `resize-observer-polyfill@^1.5.1` is dead weight in 2026 (ResizeObserver is universal since Safari 13.1) — ~4 kB you'll ship for nothing.
4. `prop-types@^15.8.1` still shipped despite the TS rewrite.

---

## 3. @snapgridjs — the 2026 newcomer, and why to treat it as a design reference not a dependency

`@snapgridjs/react@0.10.0`, MIT, author Edmond Leung (`eleung/snapgrid`, `packages/grid-react`), site `snapgrid.dev`. **First published 2026-05-31** — 12 versions in ~9 weeks. 49,560 weekly DL.

Self-description: *"React grid-layout components built on dnd-kit — a react-grid-layout v2 alternative."* Depends on `@snapgridjs/core` + `@snapgridjs/dnd`; peers `react >=18`, `@dnd-kit/react ^0.4.0`, `@dnd-kit/dom ^0.4.0`.

**Its keyboard claim is exactly the gap in every other grid lib:**
> "Every tile is keyboard-draggable: focus, pick up with Enter, move with the arrow keys, drop or cancel with Escape." — "No extra wiring."

Also claims pluggable packing ("Vertical, horizontal, or free. Plus masonry, gravity, and shelf packers"), controlled-only layout ("You own the layout array... No hidden internal state"), a per-framework SSR guide, and "≈ 38 kB brotli (snapgrid ~8 kB + dnd-kit ~30 kB)".

**Do not depend on it yet:**
- 0.x, three months old, single maintainer, no independent verification of any claim (all figures above are vendor marketing copy).
- **Peer-dep skew:** pins `@dnd-kit/react ^0.4.0` while `@dnd-kit/react` latest is `0.5.0` — you'd be forced onto a superseded dnd-kit minor, or into peer conflicts.
- Its own docs say the keyboard story covers **drag only** — resize keyboard is not claimed.
- It ships **no CSS** and uses its own class names ("Not a literal drop-in" from RGL).

Value: it is proof the "dnd-kit + RGL core math" composition works, and its API shape is a good template.

---

## 4. Keyboard accessibility — the decisive axis

**Nothing in the 12-column-grid category ships keyboard move or resize.** Verified:

- **RGL**: `GridItem.tsx` has no `onKeyDown`/`onKeyUp`, no `tabIndex`, no `role`, no `aria-*`. Only `ref`, `className`, `style` are applied to the cloned child. Issue **#1907** ("Resizable handle... not keyboard-accessible") **open since 2023-07-11**, last touched 2026-08-04, labelled `enhancement` + `ready-for-human`. #936 (11 👍, "resizable-handle has no tabIndex") closed as stale. #1795 closed 2025-12-30 without an implementation. #340 flags that DOM order follows item IDs, not visual position → non-sequential tab order.
- **GridStack**: only shipped a11y work is `sortDom()` (PR #3331, merged 2026-07-21, released in v13.1.0) which "re-orders the HTML DOM nodes to match the visual layout for accessibility (Tab navigation) and printing." Tab *order* only. No keyboard move/resize.
- **Pragmatic DnD**: deliberate non-goal, with a documented alternative pattern.

### 4.1 WAI-ARIA APG: what exists and what does not

**There is no drag-and-drop pattern in the APG.** The full index is 28 patterns; none mentions dragging, dropping, or reordering. The two applicable patterns:

**Window Splitter** — the only APG pattern for keyboard resizing.

| Attribute | Requirement |
|---|---|
| `role="separator"` | on the focusable splitter |
| `aria-valuenow` | current position, decimal |
| `aria-valuemin` | "typically `0`" |
| `aria-valuemax` | "typically `100`" |
| `aria-labelledby` | primary pane's visible label |
| `aria-label` | fallback when no visible label |
| `aria-controls` | points to the primary pane |

Note: **`aria-orientation` is NOT in the APG's required list** for this pattern (7 items only), despite being valid on `role="separator"` in ARIA itself. Keys: Left/Right move a vertical splitter, Up/Down move a horizontal one, **Enter** collapses an expanded primary pane or restores it to its previous position, **Home**/**End** (optional) jump to min/max, **F6** (optional) cycles panes. A fixed-size splitter omits arrow keys. APG caveat: the pattern is still pending task-force review (issues 129/130) and **has no reference example implementation**.

**Grid (Interactive Tabular Data and Layout Containers)** — "a container that enables users to navigate the information or interactive elements it contains using directional navigation keys, such as arrow keys, Home, and End." This is your model for *focus roaming* across widgets (roving tabindex), separate from move/resize.

### 4.2 react-resizable-panels 4.x — the reference implementation to copy

Verified from source. `lib/components/separator/Separator.tsx` renders:

```
role="separator"  aria-controls={aria.valueControls}
aria-valuemin={aria.valueMin}  aria-valuemax={aria.valueMax}
aria-valuenow={aria.valueNow}  aria-orientation={orientation}
aria-disabled={disabled || undefined}
tabIndex={disabled ? undefined : 0}
data-separator={"disabled" | "active" | "focus" | drag-state}
```

Values come from `calculateSeparatorAriaValues({layout, panelConstraints, panelId, panelIndex})`. Orientation is deliberately the inverse of the parent group's.

Key handling lives in `lib/global/event-handlers/onDocumentKeyDown.ts` — a **document-level** handler, not a per-component one. Eight cases, each calling `event.preventDefault()` first, with early exit on `event.defaultPrevented` or `group.disabled`:

| Key | Delta | Notes |
|---|---|---|
| ArrowRight / ArrowLeft | `+5` / `-5` | horizontal groups only |
| ArrowDown / ArrowUp | `+5` / `-5` | vertical groups only |
| End / Home | `+100` / `-100` | max/min primary pane size |
| Enter | `nextSize - prevSize` | toggles collapse; restores to `expandedPanelSizes[id] ?? constraints.minSize` |
| F6 / Shift+F6 | — | cycles separators forward/back with wraparound; `focus({preventScroll:true})` |

**No acceleration, no Shift-scaling on arrows** — Shift is only consulted for F6.

`resizeTargetMinimumSize` governs hit-target size: docs cite Apple HIG **20 pt (27 px) desktop / 28 pt (37 px) touch**.

### 4.3 The keyboard design you'll have to build (no library gives it to you)

Two-mode model, because a widget needs both move and resize from one focus point:

1. **Roam** — roving `tabindex` across widgets in visual (row-major) order. Requires DOM order == visual order (RGL does *not* do this; GridStack's `sortDom()` does). Arrows move focus between widgets. `role="application"` is a trap — prefer a labelled `role="grid"`-ish container plus explicit instructions in a `aria-describedby` block.
2. **Grab** — Enter/Space enters *move mode*; arrows translate by 1 grid unit; Enter/Space commits, Escape reverts to the pre-grab layout snapshot. `Shift`+arrows enters *resize mode* (±1 grid unit on w/h). Announce each step through an `aria-live="assertive"` (or `polite`) region: "Revenue chart moved to column 4, row 2. 3 columns wide, 2 rows tall."

State to expose on the item: `aria-roledescription="dashboard widget"`, `aria-grabbed` is **deprecated in ARIA 1.1+** — use `data-*` + live-region announcements instead. Because your grid is 12 × unbounded, `aria-colindex` / `aria-rowindex` / `aria-colspan` / `aria-rowspan` on the item are the honest way to convey position without inventing attributes.

---

## 5. Library-independent algorithms

### 5.1 Collision detection (verified verbatim from `src/core/collision.ts`)

```
collides(l1, l2):
  if (l1.i === l2.i) return false;              // same element
  if (l1.x + l1.w <= l2.x) return false;        // l1 completely left of l2
  if (l1.x >= l2.x + l2.w) return false;        // l1 completely right of l2
  if (l1.y + l1.h <= l2.y) return false;        // l1 completely above l2
  if (l1.y >= l2.y + l2.h) return false;        // l1 completely below l2
  return true;
```

Plain integer AABB with four early exits. `getFirstCollision(layout, item)` is an indexed loop with a hole guard returning `LayoutItem | undefined`. `getAllCollisions` is `layout.filter((l): l is LayoutItem => collides(l, layoutItem))`.

At 12 columns × N widgets this is O(n) per probe, O(n²) per compaction pass — fine to ~100 widgets. RGL's `/extras` ships O(n log n) variants; published benchmarks claim **~6× at 50 items, ~45× at 500 items (vertical), up to ~74× at 500 items (horizontal)** with identical output layouts.

### 5.2 Vertical compaction (verified from `src/core/compactors.ts`)

The `Compactor` interface: `{ type, allowOverlap, preventCollision?, compact(layout, cols): Layout }`.

`compactItemVertical(compareWith, l, ...)`:
1. Clamp negative coords to 0; cap `y` at the running bottom.
2. Float up: `while (l.y > 0 && !getFirstCollision(compareWith, l)) { l.y--; }`
3. Push down past what it hit: `resolveCompactionCollision(fullLayout, l, collision.y + collision.h, "y")`

`resolveCompactionCollision(layout, item, moveToCoord, axis)` — axis-generic (`"x"`→`w`, `"y"`→`h`), recursive:
1. Nudge the item one unit forward on the axis to probe.
2. Find its index; scan only *later* entries in the sorted layout.
3. Skip statics; recurse into each colliding neighbour, pushing it to `moveToCoord + item[sizeProp]`.
4. Assign the item its real target coordinate.

Early-exit optimisation, **only valid when the layout has no statics**:
```
if (!layoutHasStatics && otherItem.y > item.y + item.h) break;
```
Rationale in-source: statics "can be scattered throughout the layout," so sort order alone can't rule out later collisions.

Outer loop (`verticalCompactor`): statics seed `compareWith`; `maxY` tracks the frontier; items are processed **sorted row-then-column**, cloned, compacted, appended to `compareWith`, and written back **at their original index** (`out[layout.indexOf(sortedItem)] = l`) so input ordering is preserved. `horizontalCompactor` mirrors it column-then-row without `maxY`, and adds row wrapping: `if (l.x + l.w > cols) { l.x = cols - l.w; l.y++; }`.

`noCompactor` / overlap variants return `cloneLayout(layout)` — immutability holds even when nothing moves. `'wrap'` intentionally falls through to `noCompactor`; `wrapCompactor` is import-from-`/extras` to stay tree-shakeable.

**Two properties to preserve if you reimplement:** (a) compaction must be a pure `(layout, cols) => layout` so it's testable and replayable; (b) output must preserve input array order, or React keys thrash.

### 5.3 Grid ↔ pixel math (verified from `src/core/calculate.ts`)

```
colWidth   = (containerWidth - margin[0]*(cols-1) - containerPadding[0]*2) / cols
sizePx     = Math.round(colOrRowSize * gridUnits + Math.max(0, gridUnits-1) * marginPx)
left       = Math.round((colWidth  + margin[0]) * x + containerPadding[0])
top        = Math.round((rowHeight + margin[1]) * y + containerPadding[1])

x = Math.round((left - containerPadding[0]) / (colWidth  + margin[0]))
y = Math.round((top  - containerPadding[1]) / (rowHeight + margin[1]))
w = Math.round((width  + margin[0]) / (colWidth  + margin[0]))
h = Math.round((height + margin[1]) / (rowHeight + margin[1]))
clamp(n, lo, hi) = Math.max(Math.min(n, hi), lo)
```

Two subtleties worth stealing:
- `calcGridItemWHPx` returns non-finite `gridUnits` unchanged because `0 * Infinity === NaN` breaks resize constraints (`maxW: Infinity` is the default).
- A **rounding-correction pass** (static items only): compute where the sibling would start, derive the real gap as `siblingLeft - left - width`, and if it differs from the expected margin, add the difference to width — otherwise independent `Math.round` calls yield 0 px or 2 px gaps where you asked for 1 px. **This is the bug that makes hand-rolled grids look subtly broken; budget for it.**
- Resize clamping is handle-aware: west handles (`sw`,`w`,`nw`) allow up to `cols` and north handles (`nw`,`n`,`ne`) up to `maxRows`, because those handles move the origin rather than the far edge. Naive `clamp(w, 0, cols - x)` breaks NW-corner resize.

### 5.4 CSS Grid vs absolute positioning for 12-col / variable-row-height

| | **CSS Grid** (`grid-column: span w`, `grid-auto-rows: <rowHeight>`) | **Absolute + `transform: translate()`** (RGL/GridStack) |
|---|---|---|
| Idle DOM | Semantic, DOM order == visual order if you don't use explicit placement → **tab order free** | DOM order arbitrary; **must sort DOM to fix tab order** (GridStack `sortDom()` exists precisely for this) |
| Explicit placement | `grid-row-start`/`grid-column-start` reintroduces the ordering problem | n/a |
| Drag animation | `grid-row-start` is **not animatable on the compositor** — every frame is layout + paint | `transform` is compositor-only |
| Auto-height rows | `grid-auto-rows: minmax(Xpx, auto)` gives free variable rows | You must compute `containerHeight` yourself (`bottom(layout)` × pitch) |
| Overlap during drag | Grid can't overlap a dragged item over settled ones without `position:absolute` escape anyway | Native |
| Print | Flows naturally (GridStack v13.1+ built print support **on top of** DOM reordering) | Needs special handling |
| Zoom / `transformScale` | Robust | RGL threads a `transformScale` prop through every calc for this reason |

**Recommended hybrid (what to put in the planning doc):**
- **At rest / SSR / print / no-JS:** render CSS Grid with `grid-column: span {w}` and `grid-row: span {h}` over `grid-auto-rows: var(--grid-row-height)` and `gap: var(--grid-gutter)`. This is RSC-renderable, correct in tab order, correct in print, and zero JS.
- **During an active drag/resize only:** promote the interacting item (and only it) to `position:absolute; transform: translate3d(...)`, animate the *placeholder* in grid flow. Demote on drop.

This is the only way to get compositor-smooth drag *and* a server-renderable, keyboard-ordered, printable grid. It is also the only structure in which container queries work reliably (see §6), because grid tracks establish real box sizes on the server.

### 5.5 Smooth drag/resize without layout thrash

Verified from web.dev's animation guide:
- **Only `transform` (translate/rotate/scale) and `opacity` stay on the compositor.** Everything else re-enters the pipeline.
- Measured comparison of the same motion: `top`/`left` version = **37 ms rendering + 79 ms painting, 50% dropped frames**; `transform` version = **0 ms rendering/painting, 1% dropped frames**.
- `will-change` is a layer hint, not an animatable property: "use sparingly, and only if you encounter a performance issue." Legacy fallback `transform: translateZ(0)`.

Rules for this grid:
1. Dragging moves only `transform`; **never** `left/top/width/height` mid-gesture. RGL defaults `useCSSTransforms: true` for exactly this.
2. Resize is the hard case — `width`/`height` are unavoidably layout-triggering. Two mitigations: (a) animate a **1×1 px scaled proxy** during the gesture and apply real `width`/`height` once on `resizeStop`; (b) if you must live-resize, `contain: layout paint` (or `content`) on the widget shell so the layout invalidation cannot escape the card.
3. Batch all reads before all writes. Never `getBoundingClientRect()` inside a pointermove after a style write.
4. **Never** hold live drag position in React state. RGL 2.x explicitly keeps live positions in refs (`dragPositionRef`, `resizePositionRef`) and only uses `useState` for the two boolean class flags (`dragging`, `resizing`) — an intentional post-React-18-batching design. Note v1.5.1 had to wrap state calls in `flushSync` to fix cursor desync under React 18; v2.0.0 removed `flushSync` by switching to refs. Adopt the ref design directly.
5. `onDragStart` should fire only after a movement threshold — RGL v2 uses **3 px** (this is a documented v2 breaking change). Without it, clicks inside widget content get eaten.
6. Apply `transition` to non-interacting siblings only (`.item:not(.dragging) { transition: transform 150ms }`), and gate the whole thing behind `@media (prefers-reduced-motion: reduce)`.

### 5.6 ResizeObserver loop errors — the trap for a size-adaptive widget library

Your USP *is* a resize→render feedback loop, so this is a first-class risk, not an edge case.

- Chrome/Edge: `ResizeObserver loop limit exceeded`. Firefox: `ResizeObserver loop completed with undelivered notifications`. Cause: the RO callback mutates layout in a way that resizes an observed element.
- **RGL hit this twice and both fixes are worth copying** (from `useContainerWidth.ts`):
  - **rAF coalescing** — each notification cancels the pending frame and schedules a new one, so a burst collapses to one update (added for issue **#1959**).
  - **Round + bail out** — `const newWidth = Math.round(entry.contentRect.width)` then `setWidth(prev => (prev === newWidth ? prev : newWidth))`. In-source rationale for issue **#2271**: at fractional `devicePixelRatio`, unrounded widths mean "every notification is a new value, so React never bails out," producing re-render → height change → new notification → loop.
  - It also measures the **content box** deliberately: `getContentWidth` uses `parseFloat(getComputedStyle(el).width)` because `offsetWidth` reports the border box and "over-measures," and `getBoundingClientRect()` is polluted by CSS transforms. Fallback is `clientWidth` minus horizontal padding, flagged in-source as "approximate" since `clientWidth` is already whole-pixel-rounded.
- `observe(target, {box})` accepts `content-box` (default), `border-box`, `device-pixel-content-box`. **All four entry properties are populated regardless of the `box` option** — `box` only controls *which change fires a notification*. Use `borderBoxSize[0].inlineSize` for card-shell decisions and `devicePixelContentBoxSize` if you ever back a chart with `<canvas>`.
- Options: `measureBeforeMount` (default `false`), `initialWidth` (default **1280**); with `measureBeforeMount:true`, `mounted` starts `false` and flips only after the first real measurement. That is the documented SSR path — it costs you a blank first paint.

---

## 6. Making "content changes with size" work — the architectural decision

Three signal sources, in increasing cost:

| Tier | Signal | SSR/RSC | Cost | Can it change *what data is computed*? |
|---|---|---|---|---|
| **A** | **Grid units `(w,h)`** — already in your layout array | **Yes, fully** | Zero | **Yes** |
| **B** | CSS `@container (inline-size > …)` | Yes (pure CSS) | Zero JS | **No** — show/hide only |
| **C** | `ResizeObserver` → px → size class | No (client-only) | RO loop risk | Yes |

**Design the contract on Tier A, use B for polish, use C only as an escape hatch.**

Tier A is the insight your competitor analysis already surfaced: Basedash's grid is `{x, y, width, height}` in integer grid units. The donut's three transformations you documented — **reposition** (centre → right), **reveal** (legend appears), **aggregate** ("Other" bucket) — are all decidable from `(w, h)` alone, on the server, deterministically, in a unit test with no DOM. Aggregation especially *cannot* be a container query; it's a data transform.

Concretely:
```ts
// resolved on the server, from layout, before any measurement
type SizeClass = 'micro' | 'compact' | 'standard' | 'wide' | 'full';
// derived from (w, h) + aspect = w/h, NOT from pixels
```
Pass `sizeClass`, `w`, `h`, and `aspect` down as props. Every widget's render is then a pure function of `(data, sizeClass, tokens)` — snapshot-testable across the whole size ladder, and correct in RSC.

**The one thing (w,h) can't tell you:** a 4-column widget is 188 px wide on a 1212 px grid but ~140 px on a squeezed one (Basedash clamps `columnWidth` to a 140 px floor before the page scrolls). So add **one** Tier-B guard: `container-type: inline-size` on the widget shell plus a small number of `@container` rules that *demote* a tier when the real inline-size falls below the tier's px floor. That is CSS-only, needs no RO, and cannot loop.

**Container query support (verified):** MDN BCD `css.properties.container-type` → Chrome **105**, Firefox **110**, Safari **16** (Edge/iOS Safari/Chrome Android/Firefox Android all `mirror`). caniuse reports *full* support at Chrome **106**, Edge **106**, Safari **16.0**, Firefox **110**, Opera **94**, Samsung Internet **20**, global **94.05%** (93.96% full + 0.09% partial). MDN Baseline: **Widely available since February 2023**.

Two gotchas: (1) `container-type: size` applies size containment on **both** axes, so the element must have a determinate block size — inside a fixed `grid-auto-rows` cell it does, which is another argument for the CSS Grid rest-state in §5.4; (2) if no eligible container exists, `cq*` units silently fall back to small-viewport units (`sv*`) — a silent-wrong-answer failure mode, so never rely on `cqw` without asserting the container.

---

## 7. RECOMMENDATION

### Use `react-grid-layout@2.2.4` — but consume it as two separate things.

**7.1 Take `react-grid-layout/core` as a hard dependency (or vendor it).**
It is pure TypeScript with no React import: `collision.ts`, `compactors.ts`, `calculate.ts`, `constraints.ts`, `responsive.ts`, `sort.ts`, `layout.ts`, `position.ts`. MIT. This is a decade of battle-tested integer-grid geometry — including the rounding-correction pass and the handle-aware resize clamping in §5.3, both of which you *will* get wrong by hand and both of which produce subtle 1-px ugliness that a "granular visual control" library cannot afford. It is tree-shakeable (`sideEffects: ["*.css"]`) and RSC-safe because it touches no DOM.

**7.2 Take `react-grid-layout` (the `./react` entry) as the pointer-interaction layer for v1 of your grid package.**
It is the only 12-col engine that is simultaneously MIT, actively released (four releases since 2025-12), TypeScript-native (no `@types/react-grid-layout` needed), React-19-structurally-safe (`nodeRef`, no `findDOMNode`), controlled (`layout` + `onLayoutChange`), and pluggable at exactly the seams you need (`Compactor`, `PositionStrategy`, `constraints`).

**7.3 Why it wins specifically for a size-adaptive widget library.**
`GridItem` applies **only** `ref`, `className`, and a merged `style` to the cloned child — and that style carries the computed pixel `width`/`height`. That is the minimum-interference contract you want: RGL owns geometry, you own everything inside the box. There is no wrapper div fighting your `container-type`, no injected padding, no opinion about your content. Meanwhile `useGridLayout` returns pure grid units (`onResizeStop: (itemId, w, h) => void`, `containerHeight` in *rows*), so your Tier-A `sizeClass` derivation reads straight off the same numbers you serialise — no measurement round-trip, no hydration mismatch.

**7.4 What you must build yourself, and budget for.**

1. **The entire keyboard layer.** Non-negotiable and unavoidable — no library in this category ships it. Build it as a *sibling* package (`@scope/grid-a11y`) that drives the same controlled `layout` array RGL does: roving tabindex for roam, Enter/Space→arrows→Enter/Escape for move, Shift+arrows for resize, `aria-live` announcements, `aria-colindex`/`aria-rowindex`/`aria-colspan`/`aria-rowspan` on items. **Model the key table on `react-resizable-panels@4`'s `onDocumentKeyDown.ts`** (document-level handler, `preventDefault()` first, `defaultPrevented` early-exit, F6/Shift+F6 cycling) and the ARIA surface on APG Window Splitter. Because you drive a controlled array, this layer never touches RGL internals — it just calls `setLayout` with a compacted result from `/core`. **This is your second differentiator after size-adaptive content, and it is genuinely uncontested in 2026.**
2. **DOM order == visual order.** RGL does not sort (issue #340, open since 2016). Sort children row-major before render; GridStack's `sortDom()` (v13.1.0) is the prior art. This also fixes print.
3. **Your own CSS.** Do not ship `react-grid-layout/css/styles.css` or `react-resizable/css/styles.css` — they contain raw px and a base64 SVG handle, which your existing token lint gate (raw hex/rgb/hsl/px/gradients rejected, from `check-css-module-tokens.mjs`) will correctly reject. Supply custom handles via RGL's `handle` prop and style everything through `var(--...)`.
4. **The Tier-A `sizeClass` resolver**, in `@scope/core`, as a pure function — the actual product.

**7.5 Guardrails to write into the doc.**
- Pin `>=2.2.1`. **2.2.0 is explicitly unusable** ("contains a critical layout bug").
- Declare peers as `react: "^19.0.0"` yourself; do not inherit RGL's `>= 16.3.0`.
- Add a CI job running your grid tests against React 19 — RGL's own matrix is React 18.
- Wrap the RGL import behind your own `@scope/grid` façade with a `'use client'` boundary, so a future swap (to `@dnd-kit/react` + your own `/core`-driven interaction layer) is a one-package change. Given `@snapgridjs` proved that composition in ~9 weeks, keep the option open.
- Expect ~23 kB gzipped for the grid engine (RGL 22,825 B + your a11y layer). Ship it as `@scope/grid`, separate from `@scope/charts-*`, so consumers who bring their own layout pay nothing.

**7.6 Rejected, with reasons.**
`gridstack` (a11y closed `wontfix`; React 19 unstated; imperative DOM-owning API fights RSC and fights your "widget owns its content" model) · `@dnd-kit/*` alone (no resize, at all — you'd build half a grid engine) · `pragmatic-drag-and-drop` (Apache-2.0; and its documented a11y stance is the *opposite* of what you want to build) · `muuri` (dead since 2021-07-09) · `golden-layout` / `interact.js` / `react-moveable` (dormant on npm) · `swapy` (GPL-3.0 — poisons an MIT library) · `react-mosaic` / `dockview` / `flexlayout-react` (tiling/docking topology, not 12-col × unbounded-row) · `react-resizable-panels` (splitter topology, not a grid — but **read its source**, it is the best keyboard-resize implementation shipping today) · `@snapgridjs` (three months old, 0.x, single maintainer, dnd-kit peer skew — revisit at 1.0).
