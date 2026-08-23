# 015 — The token gate parses CSS; it does not grep it

**Status:** ✅ **applied** 2026-08-23 · verified by execution 2026-08-23
**Affects:** `../43-theming.md` §6, `../30-implementation-plan.md` A1, `../20-architecture.md` §2, gate **G7**
**Supersedes:** the description of the gate as a *port* of `check-css-module-tokens.mjs`
**Does not affect:** the allowlist rule itself (`43-theming.md` §6.1), which is unchanged and correct

---

## Context

Three documents describe the token gate identically — *"rejects raw hex/rgb/hsl colours, raw `px`
values, and gradients; requires `var(--...)`"* — and `20-architecture.md` calls it **the ported token
lint gate**. `43-theming.md` §6 opens by saying the gate *"is specified consistently in three places
and its scope is unambiguous."*

Nobody had asked *ported from where*. `raw/04:353` names it in passing:
`check-css-module-tokens.mjs`. That file exists, and it was read and **executed** against the rule
`43-theming.md` §6.1 specifies rather than reasoned about.

The scope turns out to be unambiguous and **wrong in both directions**.

---

## Evidence

All three probes ran the real `inspectCssModule()` export against real input.

### Probe 1 — false positives

Input is a theme file as §6.1 describes one. Verdicts per §6.1–6.2 on the left, what the script
actually returns on the right:

| Declaration | Specified verdict | Script |
|---|---|---|
| `--gx-series-1: #b4e4fd` | ✅ allow — a token definition | ❌ `raw-color` |
| `--gx-label-font-size: 11px` | ✅ allow — a token definition | ❌ `raw-pixel` |
| `--gx-corner-radius: 0` | ✅ allow — unitless `0` | ✅ allow |
| `color: #b4e4fd` | ❌ reject — normal declaration | ❌ `raw-color` |
| `--gx-plot-bg: linear-gradient(…)` | ❌ reject — no allowlist | ❌ `gradient` |
| `padding: calc(var(--gx-gap) * 2)` | ✅ allow — multiplier is not a length | ✅ allow |
| `background: url("data:…base64,AA#ffffffBB")` | ✅ allow — **inside a data URI** | ❌ `raw-color` |
| `content: "#ff0000"` | ✅ allow — **inside a string** | ❌ `raw-color` |

**Six rejections, two of them right.** Two false positives are the known positional gap. The other two
are not: `#ffffffBB` is base64 payload and `#ff0000` is string content. Neither is a colour. Regexes
over CSS text cannot know that, and a gate that fails on a data URI is a gate someone disables.

### Probe 2 — false negatives, which nobody had looked for

Every one of these **passes** the gate today:

| Input | Why it matters |
|---|---|
| `color: red` · `color: white` | Named colours are not in the rule at all |
| `color: oklch(0.7 0.15 200)` | ⚠ **`DESIGN.md` derives the palette in a perceptual space.** `oklch()` is the notation someone would naturally reach for, and it is invisible to the gate |
| `color: lab(…)` · `hwb(…)` · `color(display-p3 …)` | Same hole, four more ways in |
| `width: 2rem` · `12pt` · `3em` | The rule says `px`; the intent is *raw length* |

`stroke: currentColor` also passes, which is **correct** — §3.1 mandates it.

### What that separates

Two different faults, and only one is the script's:

- **The script fails to implement the spec** — the positional rule, the data URI, the string. Fixable.
- **The spec itself is under-specified.** `hex/rgb/hsl` + `px` is not the rule anyone means. Three
  documents agreeing on an incomplete rule read as consensus, which is why it survived four passes.

---

## Decision

**Build the gate on PostCSS. Do not port the regexes.**

Verified by execution — `postcss.parse(…).walkDecls()` yields `prop` and `value` as separate fields,
and custom properties arrive as ordinary declarations with `prop` beginning `--`:

| `prop` | custom | `value` |
|---|---|---|
| `--gx-series-1` | `true` | `#b4e4fd` |
| `color` | `false` | `#b4e4fd` |
| `background` | `false` | `url("data:image/svg+xml;base64,AA#ffffffBB")` |

The positional rule then **is not a rule** — it is `decl.prop.startsWith('--gx-')`, evaluated on a
value the parser has already separated from its property. Strings and URLs are token types the parser
hands back distinctly, so both false positives disappear without a special case.

⚠ **On the dependency, stated precisely rather than hand-waved.** `@tsdown/css@0.22.14` depends on
`lightningcss` and `postcss-load-config` — so the build's CSS *engine* is lightningcss, and PostCSS is
present only as an optional plugin pipeline tsdown will load if configured. PostCSS is therefore a
**new** direct dependency of the lint script, not something already in the graph.

Taken anyway, for two reasons:

- **`postcss` is three small pure-JS dependencies** (`nanoid`, `picocolors`, `source-map-js`).
  `lightningcss` is a native binary with per-platform optional packages — a heavier and more
  failure-prone thing to require of a CI lint step that runs on one file set.
- **The gate is a standalone check, not a build plugin.** It runs before and independently of
  bundling, so coupling it to the bundler's engine buys nothing and costs a rebuild every time the
  bundler changes. Its dependency is its own.

If the token tree later needs the same rule enforced *during* the build, lightningcss's visitor API is
the place to revisit this — but that is a second enforcement point, not a replacement.

### The rule set, widened

What the gate rejects outside an allowlisted position:

| Class | Covers |
|---|---|
| Colour literals | `#hex`, `rgb()`/`rgba()`, `hsl()`/`hsla()`, **`oklch()`, `oklab()`, `lab()`, `lch()`, `hwb()`, `color()`**, and **named colours** |
| Length literals | `px`, **`rem`, `em`, `pt`, `pc`, `in`, `cm`, `mm`, `q`, `ex`, `ch`** — unitless `0` stays legal, viewport and container units stay legal |
| Gradients | `linear-`/`radial-`/`conic-`, repeating variants — **no allowlist, anywhere** |

⚠ **`currentColor`, `transparent`, `inherit` and the other CSS-wide keywords are not literals** and
must stay permitted; `currentColor` is *mandated* for chrome by `43-theming.md` §3.1. A colour-name
list that swallows them turns a mandate into a violation.

---

## Consequences

- **A1's estimate changes, and this is the point of the record.** "Port a 137-line script" and "write
  a PostCSS plugin implementing a positional allowlist over a widened rule set" are different tasks.
  Nothing was unspecified — the estimate was wrong, which is a different failure and an easier one to
  miss.
- **G7's planted-violation test needs a second planted case.** One raw hex in a non-allowlisted
  package proves the reject path. It does **not** prove the *allow* path — and four of the six
  rejections above were false positives, so the allow path is where this gate actually breaks. Plant
  both: a violation asserted to fail, and a valid theme file asserted to pass clean.
- **`43-theming.md` §6's opening claim is retired.** The scope was not unambiguous; it was
  consistently incomplete. Three documents restating a rule is not three sources.
- **The `oklch()` hole is the one to remember.** `DESIGN.md` derives its palette perceptually, so the
  notation the gate is blindest to is the notation the design system most invites.

---

## Amendments required elsewhere

| File | Change | Status |
|---|---|---|
| `../43-theming.md` §6 | Replace "ported"; widen the rule set; retire "unambiguous"; add the allow-path assertion | ✅ applied |
| `../30-implementation-plan.md` A1 | Replace the port delta table with the PostCSS decision | ✅ applied |
| `../20-architecture.md` §2 | Invariant row: name the widened classes, not "hex, rgb, hsl, or `px`" | ✅ applied |
| `../maps/04-ci-gate-map.md` | G7 row: both directions means reject-fails **and** allow-passes | ✅ applied |

---

## What would overturn this

A measured build-time cost that matters — PostCSS parses the whole tree where a regex scans lines. It
will not: the token tree is a handful of files, and this runs once per CI job.

⚠ **The dependency argument is the softer half and is worth re-testing at B1.** If the token tree ends
up needing this rule enforced *inside* the build as well, `lightningcss` is already a hard dependency of
`@tsdown/css` and its visitor API would do the job — at which point running two parsers to enforce one
rule is the thing to justify, not the extra package.

The narrower thing worth re-checking at B1: whether the named-colour list should be the full CSS set
or a short deny-list of the ones that actually get typed (`red`, `white`, `black`, `grey`/`gray`,
`blue`). The full set is more correct and risks colliding with future keywords; the short list is
honest about what it catches. Decide it with the token tree, not before.
