# `maps/` — flow maps

Five diagrams of the same system seen from different angles. Every map is **derived**, not authored:
each node traces to a line in `10`–`43` or `raw/`, and where a map states something the corpus does
not, it is marked ⚠ **new** and carries its evidence inline.

| Map | Answers |
|---|---|
| [`00-system-map.md`](00-system-map.md) | What are the packages, which way do dependencies point, and which rules does the graph enforce? |
| [`01-runtime-flow.md`](01-runtime-flow.md) | What happens between a container size and a rendered SVG — on the server and on the client? |
| [`02-implementation-flow.md`](02-implementation-flow.md) | What gets built in what order, what blocks what, and where are the gates? |
| [`03-token-flow.md`](03-token-flow.md) | How does an authored token value reach the screen, and which path is forbidden? |
| [`04-ci-gate-map.md`](04-ci-gate-map.md) | Which gate protects which decision, and when does it land? |

## How to read these

**Arrows mean "depends on" in the system map and "flows into" everywhere else.** They are not the
same relation and the two maps should not be mentally merged.

**A dashed red edge is a path the architecture forbids.** It appears in `01` and `03`. Each one has a
specific failure it prevents, named on the edge — these are the mistakes most likely to be made by
someone who understands the system *almost* well enough.

**Provenance is named inline, not marked on boxes.** Where a map touches a value with a citable
source — the ~1000 ms transition bound in `01`, for instance, which is A-lit and A-impl at once — the
tier is stated in the prose beside the diagram, using the scheme in `../30-implementation-plan.md` B3.
Boxes stay unmarked because the maps are structural; the numbers live in the documents that own them.

## What these maps are for

The corpus is ~9,200 lines across 18 files, and the relationships between them are currently carried
in prose cross-references. That works for a reader going front to back once. It does not work for
someone at A3 asking *"if I change the tick formula, what else moves?"*

These maps are the index for that second question. **They are not a second source of truth for any
value.** Where a number appears — a rung's cell dimensions, the ~1000 ms transition bound, the tick
formula — it is quoted to make the structure legible, and the document that owns it stays
authoritative. No map defines a threshold, a hex code, or a duration; nothing here should ever be the
place you go to look one up. That is the discipline the corpus keeps asking for
(`../30-implementation-plan.md` B1: *"generate `06`'s table from `05` rather than maintaining a
second copy"*), and the maps are only worth keeping for as long as they hold to it.

⚠ The honest risk: quoted numbers still drift. If one of these maps contradicts the document it cites,
**the document wins** — file a fix against the map, never the other way round.

## Related

Decision records live in [`../decisions/`](../decisions/). The maps show *what the structure is*;
the decision records say *why it is that and not something else*.
