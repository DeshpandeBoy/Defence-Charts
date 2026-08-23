# Map 02 — Implementation flow

Source: `../30-implementation-plan.md` (all milestones + the sequencing-risks table); `../README.md`
"Open" list. Arrows read **"must land before"**.

---

## The milestone DAG

```mermaid
flowchart TD
    A1["<b>A1</b> Repo foundation<br/><i>pnpm · Turborepo · tsdown unbundle<br/>TS 6.0.3 · dependency-cruiser</i>"]
    A2["<b>A2</b> @gx/core types<br/><i>ChartPlan · SizeContext<br/>resolveSizeClass · measureText</i>"]
    A3["<b>A3</b> planChart&#40;&#41; — line + area<br/><i>all six rungs</i>"]
    A4["<b>A4</b> @gx/primitives<br/><i>&lt;Chart&gt; · RSC fixture build</i>"]
    A5["<b>A5</b> @gx/react &lt;AutoChart&gt;<br/><i>useElementSize · ResizeObserver</i>"]
    A6["<b>A6</b> Transitions<br/><i>rescale ~300ms · replace ~1000ms</i>"]

    B1["<b>B1</b> Token tree<br/><i>183 tokens · generated CSS + TS</i>"]
    B2["<b>B2</b> Prove-we-exceed<br/><i>the restyle demo</i>"]
    B3["<b>B3</b> Threshold tokens<br/><i>provenance tiers A-lit/A-impl/B/C</i>"]

    C1["<b>C1</b> @gx/grid<br/><i>react-grid-layout@2/core</i>"]
    C2["<b>C2</b> Widget chrome<br/><i>header · menu · empty · error</i>"]

    D["<b>D</b> Chart breadth<br/><i>bar → donut → KPI → scatter<br/>→ heatmap → funnel/progress/sparkline</i>"]

    E1["<b>E1</b> Fumadocs site"]
    E2["<b>E2</b> Responsive-semantics page<br/><i>the ladder, live</i>"]
    E3["<b>E3</b> Release<br/><i>Changesets · OIDC · pkg.pr.new</i>"]

    A1 --> A2 --> A3 --> A4 --> A5 --> A6
    A1 --> B1 --> B3
    B1 --> B2
    A4 --> B2
    A3 --> B3
    A5 --> C1 --> C2
    A6 --> D
    B3 --> D
    D --> E2
    A4 --> E1 --> E2 --> E3
    C2 --> E3

    classDef a fill:#0b3d4a,stroke:#22d3ee,color:#e6fbff
    classDef b fill:#123a2a,stroke:#4ade80,color:#eafff3
    classDef c fill:#3d2a0b,stroke:#fbbf24,color:#fff8e6
    classDef d fill:#2f1b3d,stroke:#c084fc,color:#f6ecff
    classDef e fill:#2a2a33,stroke:#8b8b9e,color:#e8e8f0
    class A1,A2,A3,A4,A5,A6 a
    class B1,B2,B3 b
    class C1,C2 c
    class D d
    class E1,E2,E3 e
```

**The A-spine is strictly serial and the B-track is not.** B1 forks off A1, not off A6 — the token
tree needs a repo and a build, nothing more. Anyone who waits for the charts before starting tokens
has invented a dependency that does not exist and lost several days to it.

---

## What is actually blocked, and by what

The four remaining open items are **not** a wall in front of A1. Each blocks a different, later,
specific thing. Drawn honestly:

```mermaid
flowchart LR
    o1["<b>Open 1</b><br/>Project name + npm scope"] --> t1["blocks <b>E3 publish only</b><br/><i>one regex + one generator constant<br/>+ one template-literal type</i>"]
    o4["<b>Open 4</b><br/>Roboto Flex tnum?<br/>safetyFactor calibration"] --> t4["blocks <b>generating the A2<br/>metrics table</b> — not A1, not the types"]
    o2["<b>Open 2</b><br/>43 unspecified --gx-* names"] --> t2["blocks <b>B1</b>"]
    o3["<b>Open 3</b><br/>6 UNVERIFIED defaults"] --> t2
    o5["<b>Open 5</b><br/>6 neutral-theme hexes<br/>+ 5 unguaranteed pairs"] --> t2

    classDef q fill:#3d2a0b,stroke:#fbbf24,color:#fff8e6
    classDef r fill:#123a2a,stroke:#4ade80,color:#eafff3
    class o1,o2,o3,o4,o5 q
    class t1,t2,t4 r
```

Nothing points at A1. **Start A1** (`../30-implementation-plan.md`, immediate next actions, item 5:
*"Nothing is blocked any more."*).

Open 2, 3 and 5 all land on B1 and are all the same kind of work — filling rows in a table whose
shape is already fixed — so they resolve together in one sitting rather than three.

---

## The order inside A3, and why it is that order

A3 is the milestone most likely to be attempted in the wrong order, because the tempting order is
"easy rungs first". The correct order is **most-constrained first**:

```mermaid
flowchart LR
    r1["<b>Micro</b> 1×1<br/><i>valueLegibility: 'shape-only'<br/>no axes · horizon floor</i>"]
    r2["<b>Tile</b> 2×1–2×2"]
    r3["<b>Strip</b> 3×1–4×2"]
    r4["<b>Panel</b> 3×3–6×4"]
    r5["<b>Canvas</b> 6×5–8×6"]
    r6["<b>Stage</b> 9×6–12×8+<br/><i>everything visible</i>"]
    r1 --> r2 --> r3 --> r4 --> r5 --> r6

    classDef s fill:#0b3d4a,stroke:#22d3ee,color:#e6fbff
    class r1,r2,r3,r4,r5,r6 s
```

Build **Micro first, Stage last.** Stage is the rung where every field is present and nothing has to
be given up, so it teaches nothing about the resolver. Micro is where the plot-height thresholds, the
`valueLegibility` honesty field, and the substitute-the-mark behaviour all fire at once. If Micro
works, the rest are subtractions from Stage toward a target that already exists.

Two non-obvious behaviours that must be in A3 and not deferred:

| Behaviour | Why it cannot wait |
|---|---|
| **Below the 24px plot-height floor, substitute the mark** — a `replace`, not a `rescale` | It is the one transition that changes what is drawn, so it decides the A6 animation contract. Discovering it at A6 means reopening A3. |
| **Legend is non-monotonic** — externalise going *up*, internalise-or-add going *down* | `LegendPlan` is a discriminated union precisely because of this. Model it as a boolean at A3 and every rung above Panel is wrong. |

---

## Sequencing risks, as a decision aid

`../30-implementation-plan.md` carries nine of these in a table. The three that change *what you do
this week*, rather than what you watch for:

| Risk | The tell | The move |
|---|---|---|
| `"use client"` stripped by the bundler | A5 builds fine, and the directive is missing from `dist/` | Grep built output in CI **at A1**, not at A5. `unbundle: true` is the only config where it survives on a non-entry file — verify it the day the build exists. |
| Test harness lies about text width | Collision tests pass at every rung, including ones that visibly collide | happy-dom returns `0` from every SVG measurement API. **Banned, in `A1`'s config, before a single test is written.** |
| Token gate never fires | Green CI, drifting values | Gate must be tested **in both directions** — a job that has never failed is indistinguishable from a job that exits 0 unconditionally. |

---

## Where each CI gate first lands

Full detail in [`04-ci-gate-map.md`](04-ci-gate-map.md). The point of this column is that gates are
milestone deliverables, not a cleanup pass before release:

| Milestone | Gate that first appears |
|---|---|
| A1 | dependency direction · `"use client"` survival · no-DOM-API lint · happy-dom ban |
| A3 | ladder snapshots · `valueLegibility !== 'values' → !axes.y.visible` |
| A4 | RSC fixture builds · tree-shaking size assertion |
| A5 | `FakeResizeObserver` rung transitions |
| B1 | token lint, **both directions** |
| B3 | every threshold carries a provenance tier |
| E3 | provenance published · OIDC publish · pkg.pr.new preview |
