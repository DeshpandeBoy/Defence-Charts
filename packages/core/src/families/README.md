# Chart-family seam

This directory is the family-local home for pure planners. The matching hook-free renderers live
under packages/primitives/src/families/.

## Add-a-family checklist

1. Add packages/core/src/families/<family>/planner.ts with an explicit chart-type list and a
   planner satisfying FamilyPlanner.
2. Add deterministic planner tests beside that module. Test the serializable plan, boundary and
   unsupported inputs; do not add a second resolver or read the DOM.
3. Add packages/primitives/src/families/<family>/renderer.tsx with
   MarkRendererRegistration entries. Keep it hook-free, RSC-safe, and local to the family.
4. Add renderer tests beside that module. Test the element contract and the explicit failure path
   for marks the family does not own.
5. Add one deterministic fixture per package at
   packages/{core,primitives}/src/families/<family>/<family>.fixture.ts. Fixtures are plain
   inputs/expected outputs used by tests only; they do not register anything and do not claim
   behavior for an unimplemented family.
6. Request the coordinator's one literal entry in planner-registry.ts and
   renderer-registry.ts. Do not edit those central integration files from a family branch.
7. Run the family tests, package typechecks, API/boundary/tree-shake/RSC gates, build, and
   git diff --check before handoff.

The registry functions are implementation details. Only ChartPlan and the frame data cross the
core-to-renderer boundary, so a family registration must never place functions, DOM objects, or
mutable state in either serializable value.
