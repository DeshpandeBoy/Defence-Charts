# Decision 019 — Accept the measured typography bound for Free v1

Status: applied to the Free-v1 release audit
Date: 2026-08-26

## Context

The generated text model has a conservative `safetyFactor` of `1.57`, measured against Roboto,
DejaVu Sans, and SF-family fallbacks. Segoe UI Variable is the fourth reachable face in the fallback
stack, but its actual width contribution cannot be measured on this macOS release machine. CR-TY01
also confirmed from Microsoft's published typography documentation that Segoe UI Variable has
weight and optical-size axes, but no `GRAD` axis.

## Evidence

- `packages/core/src/font-metrics.generated.ts` carries the generated reference metrics and the
  measured `1.57` bound, while explicitly labelling Segoe UI Variable unverified.
- `pnpm lint:typography` verifies that generated CSS and the committed metric source agree.
- CR-TY01 re-verified the U+2212 and line-height implementation and found no shipped consumer of
  `--shiftcharts-label-landmark-grade`.
- The release audit does not have a licensed Segoe UI Variable font file or a Windows runner. A
  Selawik measurement would be a proxy, not evidence about Segoe UI Variable itself.

## Decision

Free v1 accepts the existing `1.57` safety factor as a conservative, explicitly bounded launch
default. Public documentation must continue to say that Segoe UI Variable is unmeasured; the release
must not describe the bound as covering every fallback face.

The landmark-grade token remains available but unused. If a future component consumes it, a face
without `GRAD` receives no typographic emphasis; ShiftCharts will not substitute `font-weight`,
because changing weight would invalidate the advance-width model. Any non-GRAD visual fallback must
be designed and tested as a separate feature.

## Consequences

- The missing Windows measurement is a documented limitation, not a Free-v1 publication blocker.
- A real Windows run of the existing generator can tighten or raise the bound in a later patch.
- No perceptual claim is made for `GRAD: 150` at 11px until a real element consumes the token and a
  screenshot/legibility study exists.

## What would overturn this

A reproducible Segoe UI Variable measurement above `1.57`, or evidence of clipping in a supported
Windows consumer, requires regenerating the metrics and releasing the corrected bound before making
broader fitting claims.
