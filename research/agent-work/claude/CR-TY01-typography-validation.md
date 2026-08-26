# CR-TY01 — Typography validation: Segoe UI Variable, GRAD at 11px, U+2212, line-height

Status: proposal for coordinator review
Date/access window: 2026-08-26, single session; web retrieval via direct fetch, dated per source below
Repository baseline: branch `Anti-gravity-and-other-Agent-changes`, commit `9443cfb`

## Exact question and exclusions

Per `92-claude-research-workstream.md`'s `CR-TY01` brief: validate Segoe UI Variable/Windows metric
drift, whether `GRAD: 150` is a legible landmark at 11px, a screenshot baseline, line-height, and
`U+2212` metrics — labelling unavailable platforms rather than guessing at them. Excluded: re-deriving
`safetyFactor` for the three already-measured fallback faces (SF, Roboto, DejaVu Sans; settled per
`41-text-metrics.md` §4.2 at **1.57**) — this task is scoped to what remains open within that number,
not to re-litigating it.

## Current repository evidence

- `packages/core/src/font-metrics.generated.ts:31-33` — states plainly, as of generation:
  **"Segoe UI Variable is Windows-only and was not obtainable. The number is a bound over SF, Roboto
  and DejaVu Sans and nothing more."** `safetyFactor: 1.57` covers three of the four faces in the
  documented fallback stack; Windows drift is explicitly labelled `UNVERIFIED`, not silently assumed
  safe.
- `research/41-text-metrics.md` §9 item 2 — same finding, same label, recorded as open rather than
  invented shut.
- `research/42-typography.md:308` — same Windows-unavailability note, plus the open perceptual
  question (§3, line 152): *"Whether `GRAD: 150` is perceptually sufficient to read as a landmark at
  11px is UNVERIFIED."*
- `packages/tokens/src/themes/theme.css:242-250` — `--gx-label-landmark-grade: 150` is **declared**
  as a token, with the same UNVERIFIED comment carried into shipped source (not just research prose).
- `packages/core/src/format.ts:132-146` — the `U+2212` MINUS SIGN finding from `41-text-metrics.md`
  §9 item 7 is **currently, accurately** carried into shipped source: both `formatXLabel()` and
  `formatYLabel()` emit `U+2212` for negatives (matching `Intl.NumberFormat`'s locale behavior, not
  ASCII `U+002D` HYPHEN-MINUS), and the comment correctly states this is safe today because the glyph
  falls to the over-estimating banded fallback rather than the covered, tightly-measured set. This is
  **verified current**, not stale — the code and the research doc agree, and neither has drifted from
  the other since `41-text-metrics.md` was written.
- **New this session**: `grep` across `packages/*/src/*.css` and `packages/*/src/*.tsx` for
  `landmark-grade` and `font-variation-settings` found **zero consuming rules** — `--gx-label-landmark-grade`
  is declared but not yet applied by any shipped CSS rule to any shipped element. This changes the shape
  of the "screenshot baseline" sub-question: there is currently **no rendered element** that uses GRAD
  landmark emphasis, so no screenshot of it can exist yet. This is a sequencing fact, not an access
  failure — the perceptual-legibility question cannot usefully be tested against nothing, on any
  platform, until a `D`-family or `I1` task actually wires `font-variation-settings: 'GRAD' var(--gx-label-landmark-grade)`
  onto a real label.

## External evidence

| Claim | Class | Source/version/date | What it supports | What it does not support |
|---|---|---|---|---|
| Segoe UI Variable supports exactly two variable axes: weight (`wght`, Thin 100 → Bold 700) and optical size (`opsz`, automatic, 8pt→36pt) | Official implementation | [Microsoft Learn, "Typography in Windows"](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/typography), fetched 2026-08-26 | **Directly actionable**: Segoe UI Variable has **no grade (`GRAD`) axis**. Per this project's own documented fallback rule (`42-typography.md:149`: *"On a face with no GRAD axis, the token degrades to no emphasis at all — not to a wght bump"*), the landmark-emphasis token, once wired to a real element, will render with **zero visual effect on Windows** — not a smaller effect, none. This does not require Windows access to establish; it follows from Microsoft's own published axis list plus this project's own already-decided degrade rule. | Does not establish whether "no emphasis" is an acceptable outcome on Windows specifically, or whether Windows needs an explicit non-GRAD fallback (e.g., a subtle color/opacity change) the way `41-text-metrics.md` §3's Inter case already anticipates for GRAD-less faces generally |
| Microsoft publishes **Selawik**, an OFL-1.1-licensed, open-source font stated to be "metrically compatible with Segoe UI, intended for apps on other platforms that don't want to bundle Segoe UI" | Official implementation | Same Microsoft Learn page (fonts table) and [github.com/microsoft/Selawik](https://github.com/microsoft/Selawik), fetched 2026-08-26 | A **legitimate, freely obtainable, redistributable** (same OFL license family as the pinned Roboto Flex) proxy for a future `safetyFactor` calibration pass against Segoe metrics, without needing a licensed Windows machine | **Not a substitute for Segoe UI Variable itself, and this report does not treat it as one.** Selawik's own README lists known gaps ("Selawik is missing kerning to match Segoe UI") and is a **static** font family, not a variable one — it cannot exercise the `opsz` axis Segoe UI Variable actually uses, and it models classic Segoe UI, not the newer Variable revision specifically. Running it through this project's `safetyFactor` calibration would produce a **bounded proxy measurement**, not a Segoe UI Variable measurement, and must be labelled that precisely if attempted |

## Retrieval log

| Source sought | Result | Limitation |
|---|---|---|
| A real Windows machine or VM with Segoe UI Variable installed, to run `scripts/generate-font-metrics.mjs`'s underlying `hmtx`/`OS/2` extraction against it directly | **Not available in this session's environment** (macOS, no Windows access) | This is the same limitation every prior pass recorded (`font-metrics.generated.ts`, `41-text-metrics.md` §9, `42-typography.md:308`) — confirmed still true, not re-guessed |
| Microsoft Learn Windows typography documentation | Fetched successfully, 2026-08-26 | Confirms the axis list (weight, optical size) but is a design-guidance page, not a font-binary specimen; does not itself supply `hmtx` advance-width numbers |
| `github.com/microsoft/Selawik` | Fetched successfully (README-level), 2026-08-26 | Confirms licensing and availability; did not attempt to download and measure the actual font file this session — see Recommendation below for why, and the exact next step if the coordinator wants it done |
| Real screen rendering of `GRAD: 150` at 11px, any platform | **Not attempted** | No shipped element currently applies the token (see Current repository evidence) — there is nothing to screenshot yet, on macOS or Windows; this is newly discovered in this pass, not previously recorded |

## Alternatives

- **Download Selawik and run it through the `safetyFactor` calibration this session, presenting a number for "Windows drift."** Rejected for this pass: Selawik is static (no `opsz` axis) and has documented kerning gaps versus Segoe UI, and the pinned reference target is specifically Segoe UI **Variable**, not classic Segoe UI. A number produced this way would need very careful, explicit labelling as "Selawik proxy, not Segoe UI Variable," and reproducing the *exact* calibration methodology behind the existing 1.57 figure correctly, in one pass, without the ability to cross-check the result against a real Segoe UI Variable rendering, risks quietly overstating confidence in a number that only bounds a proxy. This is exactly the "do not invent numeric thresholds when evidence does not supply one" rule in this project's own Claude workstream checklist. Recorded as the concrete next step instead (see Recommendation).
- **Screenshot the closest existing element and call it a GRAD baseline anyway.** Rejected: no shipped element uses `font-variation-settings` with the landmark-grade token; a screenshot of unrelated text would not test the actual question and would misrepresent what was checked.
- **Treat "Windows unavailable" as unchanged and simply restate the existing UNVERIFIED labels without new investigation.** Rejected: the GRAD-axis-absence finding and the Selawik lead are both new, actionable information this pass adds; restating only the old label would under-deliver against `CR-TY01`'s brief.

## Recommendation and confidence

1. **Segoe UI Variable has no `GRAD` axis — confidence: high**, directly sourced from Microsoft's own
   published documentation. **Actionable now, without Windows access**: whoever wires
   `--gx-label-landmark-grade` to a real `font-variation-settings` rule should explicitly decide
   Windows's fallback behavior (accept "no emphasis," per this project's own documented default; or
   design an explicit non-GRAD fallback, e.g., a colour/opacity shift, the way `41-text-metrics.md` §3
   already discusses for GRAD-less faces in general) **before** shipping the feature, not discover it
   post-hoc on a Windows user's screen.
2. **The GRAD:150 perceptual-legibility screenshot baseline cannot be produced yet, on any
   platform — confidence: high**, because no shipped element consumes the token. Recommend
   sequencing this specific sub-question to whichever task first wires landmark emphasis to a real
   label (likely a `D`-family axis/annotation feature), not treating it as a standing blocker on
   unrelated work.
3. **`U+2212` and line-height findings are unchanged and verified current — confidence: high.** Code
   and research agree; no drift, no action needed beyond what `41-text-metrics.md` §9 already
   recorded (tightening the character set remains optional, deferred work, not a defect).
4. **Segoe UI Variable's actual `safetyFactor` contribution remains genuinely unverified — no
   confidence rating possible without either real Windows access or a carefully-labelled Selawik
   proxy pass.** Recommend the coordinator choose one of two concrete unblocks, in order of
   preference: (a) run `scripts/generate-font-metrics.mjs`'s underlying extraction logic against a
   real Segoe UI Variable file on any Windows 11 machine (the font ships with the OS at
   `C:\Windows\Fonts\SegUIVar.ttf`) — likely under an hour of work for someone with that access,
   producing genuine A-impl-tier evidence; or (b) explicitly commission a Selawik-proxy calibration
   pass as its own small, precisely-scoped task, with the static/variable and kerning-gap caveats
   above written into its acceptance criteria from the start so the result cannot be mistaken for
   Segoe UI Variable data.

## Conflicts with locked/current decisions

None. This report does not challenge `safetyFactor: 1.57` or any locked typography decision; it
narrows what remains open within the already-labelled Windows gap and adds one new, actionable
finding (the GRAD-axis absence) that no prior pass had surfaced.

## Unknowns

- The real magnitude of Segoe UI Variable's advance-width drift from Roboto Flex — still unmeasured;
  see Recommendation item 4 for the two concrete paths to close it.
- Whether "no emphasis at all" (this project's documented default for GRAD-less faces) is an
  acceptable Windows experience for the landmark-emphasis feature specifically, or whether product
  judgment wants an explicit fallback treatment — this is a design decision, not a research question
  this report can settle.
- Whether Segoe UI Variable's `opsz` behavior at 11px (automatic, per Microsoft's docs) interacts with
  this project's own per-rank `opsz` keying (`41-text-metrics.md` §5.1) in a way that changes advance
  widths beyond what `safetyFactor` bounds — not evaluated in this pass; would fall out naturally from
  Recommendation item 4(a) if performed with the variable font's full axis range exercised.

## Affected APIs, files, tests and docs

- `packages/core/src/font-metrics.generated.ts:31-33`, `research/41-text-metrics.md` §9 item 2 — no
  change needed; both already carry the correct UNVERIFIED label and need no correction, only the
  eventual real measurement.
- `packages/tokens/src/themes/theme.css:242-250` — the GRAD-axis-absence finding should be added as an
  explicit note here (or wherever `font-variation-settings` first consumes this token) when that
  feature is implemented, so the Windows "no emphasis" outcome is a documented decision rather than a
  discovered surprise.
- No runtime code requires a change from this report alone.

## Implementation acceptance checklist

- [ ] Whichever task first wires `--gx-label-landmark-grade` to a real `font-variation-settings` rule
      explicitly decides and documents Windows/Segoe UI Variable's fallback behavior (no emphasis, or
      an explicit non-GRAD alternative) as part of its own acceptance criteria.
- [ ] That same task is the one that produces the GRAD:150 screenshot baseline this report could not
      — there being no element to screenshot before then, not a Windows-access limitation.
- [ ] If the coordinator commissions a Segoe UI Variable measurement (real Windows or a labelled
      Selawik proxy), the result updates `font-metrics.generated.ts`'s `safetyFactor` provenance table
      and its own doc comment, following the same regeneration process (`generate-font-metrics.mjs`)
      already documented there — not a hand-edited number.

## Proposed promotion

**Clarification** for `font-metrics.generated.ts` / `41-text-metrics.md` §9 / `42-typography.md`: the
Windows/Segoe gap is confirmed still open and still correctly labelled — no document needs correcting.
**New finding, no decision required yet**: Segoe UI Variable's absence of a `GRAD` axis is new,
actionable information for whichever task implements landmark emphasis. **Genuine evidence gap,
deferred**: the actual Segoe UI Variable `safetyFactor` measurement, with two concrete unblock paths
recorded above rather than left as an unowned "someday."
