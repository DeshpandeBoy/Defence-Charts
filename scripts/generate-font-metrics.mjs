/**
 * The `FontMetrics` table generator — `research/41-text-metrics.md` §7.
 *
 * Offline, with committed output. NOT a build-time dependency on a font file: `raw/07`
 * requires build inputs to be reproducible, and a font fetched during a build is neither
 * pinned nor auditable. So this script runs by hand, the `.ts` it emits is reviewed and
 * committed, and nothing in `pnpm verify` needs a 1.7 MB TTF on disk to pass.
 *
 * ⚠ **Deliberately NOT wired into `pnpm verify`.** §7 asks for a CI step that regenerates
 * and asserts an empty diff. That step cannot exist without shipping or fetching the font,
 * which is the thing §7 also forbids. The substitute is the SHA-256 pin below plus
 * `generate-font-metrics.test.mjs`, which checks the committed table's invariants without
 * needing a font at all.
 *
 * ## Re-running it
 *
 * ```sh
 * mkdir -p /tmp/shiftcharts-fonts
 * curl -sSLo /tmp/shiftcharts-fonts/RobotoFlex.ttf \
 *   'https://raw.githubusercontent.com/google/fonts/main/ofl/robotoflex/RobotoFlex%5BGRAD%2CXOPQ%2CXTRA%2CYOPQ%2CYTAS%2CYTDE%2CYTFI%2CYTLC%2CYTUC%2Copsz%2Cslnt%2Cwdth%2Cwght%5D.ttf'
 * node scripts/generate-font-metrics.mjs --write
 * ```
 *
 * With no flag it regenerates in memory and fails if the committed file has drifted.
 * `--calibrate` re-derives `safetyFactor` from the fallback stack (see `CALIBRATION`).
 *
 * ## Why it shells out to Python
 *
 * There is no maintained pure-JS variable-font instancer that resolves `HVAR` and `MVAR`,
 * and `opsz` is the entire reason the table is keyed by rank (§5.1). `fontTools` does
 * resolve them, so the measurement lives in the embedded Python payload below and this
 * file owns only the pinning, the rendering, and the reporting. The payload is inline
 * rather than a sibling `.py` so that "the script" is one reviewable artifact.
 *
 * ⚠ Plain JavaScript with JSDoc types, matching `check-tokens.mjs`: a generator that needs
 * the build in order to run cannot regenerate the thing the build consumes.
 */

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const TARGET = fileURLToPath(new URL('../packages/core/src/font-metrics.generated.ts', import.meta.url))

/** Where the fonts are expected to sit. Override with `--fonts <dir>`. */
const DEFAULT_FONT_DIR = '/tmp/shiftcharts-fonts'

/** Override with `--python <path>`. */
const DEFAULT_PYTHON = process.env['SHIFTCHARTS_PYTHON'] ?? 'python3'

/**
 * The reference face, pinned by content hash.
 *
 * ⚠ The pin is the whole reproducibility story. Google Fonts ships new Roboto Flex builds
 * to the same path, so "download the file at this URL" names a moving target; this names
 * the bytes. A hash mismatch stops the run rather than silently regenerating the table
 * against a different face.
 */
const REFERENCE = {
  file: 'RobotoFlex.ttf',
  family: 'Roboto Flex',
  version: 'Version 3.200;gftools[0.9.32]',
  sha256: '9b523f7d82593df0107173849ebb8c817471a1df4b4fb2c3cbf40cfd810c8281',
  url:
    'https://raw.githubusercontent.com/google/fonts/main/ofl/robotoflex/' +
    'RobotoFlex%5BGRAD%2CXOPQ%2CXTRA%2CYOPQ%2CYTAS%2CYTDE%2CYTFI%2CYTLC%2CYTUC%2Copsz%2Cslnt%2Cwdth%2Cwght%5D.ttf',
}

/**
 * `research/42-typography.md` §2.1. Rank pins size and weight together, which is exactly
 * the tuple that determines advances — so it is also exactly the tuple this script varies.
 *
 * @type {ReadonlyArray<readonly [rank: string, fontSize: number, fontWeight: number]>}
 */
const RANKS = [
  ['A', 13, 700],
  ['B', 12, 700],
  ['C', 11, 500],
  ['D', 11, 400],
  ['E', 10, 400],
]

/**
 * The axes held fixed across every rank. `opsz` and `wght` come from the rank; `wdth` 100
 * is `font-stretch: normal`; `GRAD` 0 is the ungraded default, and grading it is safe
 * precisely because it does not move advances (`research/41-text-metrics.md` §3).
 */
const FIXED_AXES = { wdth: 100, slnt: 0, GRAD: 0 }

/**
 * ⚠ **`'tnum' 1` is a request Roboto Flex does not implement, and recording it anyway is
 * the correct call — see `research/41-text-metrics.md` §4.1.**
 *
 * The face ships no `tnum` feature. Its GSUB carries `liga`, `locl`, `pnum`, `rvrn` and
 * nothing else, and the `pnum` lookup substitutes `uni0030 → uni0030.prop` — meaning the
 * DEFAULT figures are the tabular ones and `pnum` is the switch to proportional. So a
 * `tnum` request is inert here and the defaults already satisfy the Tabular Rule.
 *
 * It still belongs in `generatedWith`, because `generatedWith` describes what the CSS
 * applies and the CSS should keep applying `font-variant-numeric: tabular-nums`: the
 * fallback faces DO implement `tnum`, and SF's default figures are proportional (nine
 * distinct digit widths, measured). Dropping the declaration would leave digits jittering
 * on every machine that does not load the reference face.
 *
 * ⚠ The load-bearing rule is the negative one: **`pnum` / `proportional-nums` must never
 * be applied**, because on this face that is the setting that invalidates the table.
 */
const FEATURE_SETTINGS = "'tnum' 1"

/**
 * The calibrated fallback-drift multiplier — `research/41-text-metrics.md` §4.2.
 *
 * Measured, not chosen. Re-derive with `--calibrate`; the run is recorded here so the
 * number can be checked without re-obtaining four fonts.
 *
 * ⚠ `sum(fallback) / sum(reference) <= max_char(fallback / reference)` for any string, so
 * the per-character maximum is a true bound on whole labels and not merely a sample. It is
 * also loose: it is reached only by a string made entirely of the worst character.
 */
const CALIBRATION = {
  safetyFactor: 1.57,
  observedMax: 1.5643,
  face: 'DejaVu Sans 2.35 (Book)',
  rank: 'D',
  character: '+',
  /** Faces actually measured, with the version string read out of each `name` table. */
  measured: [
    'SF / system-ui — /System/Library/Fonts/SFNS.ttf, "System Font" 21.4d2e1, tnum + trak applied',
    'Roboto 3.015 — google/fonts ofl/roboto (variable, wdth+wght)',
    'DejaVu Sans 2.35 Book and Bold — matplotlib mpl-data',
  ],
  /** ⚠ Windows-only; not obtainable on the machine that ran this. Stays unverified. */
  unverified: ['Segoe UI Variable'],
}

/**
 * ⚠ Not measured, and it cannot be measured from this face: Roboto Flex has no CJK
 * coverage at all, so a full-width label falls through to a system CJK face this table
 * never sees. `2 x latin` keeps the existing convention in `text.ts` and errs wide, which
 * is the direction §6.1 mandates. Tier C.
 */
const CJK_BAND_MULTIPLE = 2

/**
 * The embedded measurement pass. Reads one JSON config argument, writes one JSON object.
 *
 * ⚠ Advances are rounded UP to five decimals. Rounding to nearest would let the table
 * under-state an advance by half an ulp, and §6.1 forbids under-statement in any amount:
 * `Math.ceil` keeps every entry a genuine upper bound on the reference face.
 */
const PYTHON_PAYLOAD = `
import hashlib, json, math, sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

cfg = json.loads(sys.argv[1])

def charset():
    """research/41-text-metrics.md 5.2, exactly: ASCII printable, the Latin-1 letters,
    the named currency signs, the typographic punctuation, and the three arrows."""
    cps = list(range(0x20, 0x7F))
    cps += [c for c in range(0xC0, 0x100) if c not in (0xD7, 0xF7)]
    cps += [0xA3, 0xA5, 0x20AC, 0x20B9]
    cps += [0xB7, 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026]
    cps += [0x2191, 0x2192, 0x2193]
    return cps

CPS = charset()

def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

def instantiate(path, loc):
    font = TTFont(path)
    if 'fvar' in font:
        axes = dict((a.axisTag, a) for a in font['fvar'].axes)
        pinned = dict(
            (tag, max(axes[tag].minValue, min(axes[tag].maxValue, v)))
            for tag, v in loc.items() if tag in axes
        )
        font = instancer.instantiateVariableFont(font, pinned, inplace=True, updateFontNames=False)
    return font

def single_substitutions(font, tag):
    """Glyph->glyph map for a feature built from GSUB type-1 lookups. Enough for tnum."""
    out = {}
    if 'GSUB' not in font:
        return out
    table = font['GSUB'].table
    if table.FeatureList is None or table.LookupList is None:
        return out
    indices = set()
    for record in table.FeatureList.FeatureRecord:
        if record.FeatureTag == tag:
            indices.update(record.Feature.LookupListIndex)
    for i in indices:
        lookup = table.LookupList.Lookup[i]
        if lookup.LookupType != 1:
            continue
        for sub in lookup.SubTable:
            out.update(sub.mapping)
    return out

def tracking(font, px):
    """macOS applies the 'trak' table to system-ui. Value is in font units at the normal
    track; linear between the tabulated sizes, clamped outside them."""
    if 'trak' not in font:
        return 0.0
    data = getattr(font['trak'], 'horizData', None)
    if data is None or 0.0 not in data:
        return 0.0
    entry = dict(data[0.0])
    sizes = sorted(entry)
    if not sizes:
        return 0.0
    if px <= sizes[0]:
        value = entry[sizes[0]]
    elif px >= sizes[-1]:
        value = entry[sizes[-1]]
    else:
        lo = max(s for s in sizes if s <= px)
        hi = min(s for s in sizes if s >= px)
        value = entry[lo] if lo == hi else entry[lo] + (entry[hi] - entry[lo]) * (px - lo) / (hi - lo)
    return float(value) / font['head'].unitsPerEm

def advance_reader(font, apply_tnum, px=None):
    upm = font['head'].unitsPerEm
    cmap = font.getBestCmap()
    hmtx = font['hmtx']
    swap = single_substitutions(font, 'tnum') if apply_tnum else {}
    delta = tracking(font, px) if px is not None else 0.0
    def read(cp):
        name = cmap.get(cp)
        if name is None:
            return None
        return hmtx[swap.get(name, name)][0] / upm + delta
    return read

def ceil5(v):
    return math.ceil(v * 100000.0) / 100000.0

def reference_pass(path):
    by_rank = {}
    verticals = []
    features = {'GSUB': [], 'GPOS': []}
    probe = TTFont(path)
    for tag in ('GSUB', 'GPOS'):
        if tag in probe and probe[tag].table.FeatureList is not None:
            features[tag] = sorted(set(
                r.FeatureTag for r in probe[tag].table.FeatureList.FeatureRecord
            ))
    cmap = probe.getBestCmap()
    coverage = dict((hex(c), c in cmap) for c in (0x2191, 0x2192, 0x2193))
    gdef = probe['GDEF'].table.GlyphClassDef.classDefs if 'GDEF' in probe else {}
    marks = [c for c in range(0x300, 0x370) if c in cmap]
    mark_classes = sorted(set(gdef.get(cmap[c]) for c in marks))
    hmtx_probe = probe['hmtx']
    mark_hmtx_max = max([hmtx_probe[cmap[c]][0] for c in marks] or [0]) / probe['head'].unitsPerEm

    for rank, size, weight in cfg['ranks']:
        loc = dict(cfg['fixedAxes'])
        loc['opsz'] = size
        loc['wght'] = weight
        font = instantiate(path, loc)
        read = advance_reader(font, True)
        upm = font['head'].unitsPerEm
        os2 = font['OS/2']
        entries = {}
        widest = 0.0
        missing = []
        for cp in CPS:
            adv = read(cp)
            if adv is None:
                missing.append(hex(cp))
                continue
            entries[cp] = ceil5(adv)
            if adv > widest:
                widest = adv
        by_rank[rank] = {'advances': entries, 'widest': ceil5(widest), 'missing': missing}
        verticals.append({
            'ascent': os2.sTypoAscender / upm,
            'descent': -os2.sTypoDescender / upm,
            'lineGap': os2.sTypoLineGap / upm,
            'capHeight': os2.sCapHeight / upm,
            'xHeight': os2.sxHeight / upm,
        })

    vertical = dict(
        (k, ceil5(max(v[k] for v in verticals))) for k in verticals[0]
    )
    vertical_spread = dict(
        (k, (max(v[k] for v in verticals) - min(v[k] for v in verticals))) for k in verticals[0]
    )

    ranks = [r[0] for r in cfg['ranks']]
    spread = {'combined': 0.0, 'combinedAt': None, 'opsz': 0.0, 'opszAt': None}
    for cp in CPS:
        vals = [by_rank[r]['advances'].get(cp) for r in ranks]
        if any(v is None or v == 0 for v in vals):
            continue
        s = max(vals) / min(vals) - 1.0
        if s > spread['combined']:
            spread['combined'] = s
            spread['combinedAt'] = hex(cp)

    # Pure optical spread: weight held at 400, opsz swept over the scale's extremes.
    sizes = sorted(set(r[1] for r in cfg['ranks']))
    sweeps = []
    for size in (sizes[0], sizes[-1]):
        loc = dict(cfg['fixedAxes'])
        loc['opsz'] = size
        loc['wght'] = 400
        sweeps.append(advance_reader(instantiate(path, loc), True))
    for cp in CPS:
        a, b = sweeps[0](cp), sweeps[-1](cp)
        if not a or b is None:
            continue
        s = abs(b / a - 1.0)
        if s > spread['opsz']:
            spread['opsz'] = s
            spread['opszAt'] = hex(cp)
    spread['opszRange'] = [sizes[0], sizes[-1]]

    return {
        'sha256': sha256(path),
        'family': probe['name'].getDebugName(1),
        'version': probe['name'].getDebugName(5),
        'unitsPerEm': probe['head'].unitsPerEm,
        'features': features,
        'arrowCoverage': coverage,
        'markGdefClasses': mark_classes,
        'markHmtxMaxEm': round(mark_hmtx_max, 5),
        'byRank': by_rank,
        'vertical': vertical,
        'verticalSpread': vertical_spread,
        'spread': spread,
    }

def calibration_pass(reference_path, faces):
    calib = [ord(c) for c in '0123456789.,-+%$ ']
    calib += [0x20AC, 0xA3]
    calib += list(range(0x41, 0x5B)) + list(range(0x61, 0x7B))
    calib += [0x2191, 0x2192, 0x2193]

    ref = {}
    for rank, size, weight in cfg['ranks']:
        loc = dict(cfg['fixedAxes'])
        loc['opsz'] = size
        loc['wght'] = weight
        ref[rank] = advance_reader(instantiate(reference_path, loc), True)

    rows = []
    for face in faces:
        probe = TTFont(face['path'])
        version = probe['name'].getDebugName(5)
        name = probe['name'].getDebugName(1)
        for rank, size, weight in cfg['ranks']:
            if face['weights'] and weight not in face['weights']:
                continue
            loc = dict(cfg['fixedAxes'])
            loc['opsz'] = size
            loc['wght'] = weight
            read = advance_reader(
                instantiate(face['path'], loc), True, px=size if face['trak'] else None
            )
            worst = 0.0
            at = None
            missing = []
            for cp in calib:
                got = read(cp)
                if got is None:
                    missing.append(hex(cp))
                    continue
                base = ref[rank](cp)
                if not base:
                    continue
                ratio = got / base
                if ratio > worst:
                    worst = ratio
                    at = hex(cp)
            rows.append({
                'label': face['label'], 'name': name, 'version': version,
                'rank': rank, 'fontSize': size, 'fontWeight': weight,
                'maxRatio': worst, 'at': at, 'missing': missing,
            })
    return rows

if cfg['mode'] == 'table':
    print(json.dumps(reference_pass(cfg['reference'])))
else:
    print(json.dumps(calibration_pass(cfg['reference'], cfg['faces'])))
`

/**
 * @param {string} python
 * @param {Record<string, unknown>} config
 * @returns {Promise<unknown>}
 */
function runPython(python, config) {
  return new Promise((resolve, reject) => {
    const child = spawn(python, ['-c', PYTHON_PAYLOAD, JSON.stringify(config)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    /** @type {Buffer[]} */
    const out = []
    /** @type {Buffer[]} */
    const err = []
    child.stdout.on('data', (c) => out.push(c))
    child.stderr.on('data', (c) => err.push(c))
    child.on('error', (e) =>
      reject(new Error(`could not run ${python}: ${e.message}\nSet SHIFTCHARTS_PYTHON or pass --python.`)),
    )
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${python} exited ${String(code)}\n${Buffer.concat(err).toString()}`))
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(out).toString()))
      } catch (e) {
        reject(new Error(`unparseable measurement output: ${String(e)}`))
      }
    })
  })
}

/**
 * ASCII-only source, so the committed table diffs cleanly in every terminal and no
 * normalisation form can quietly rewrite a key.
 *
 * @param {number} codePoint
 * @returns {string}
 */
function keyLiteral(codePoint) {
  if (codePoint >= 0x20 && codePoint <= 0x7e) return JSON.stringify(String.fromCodePoint(codePoint))
  return `"\\u${codePoint.toString(16).padStart(4, '0')}"`
}

/**
 * @param {number} value
 * @returns {string}
 */
function num(value) {
  // Five decimals, always written out, so a column of advances lines up when read.
  // Exact zero stays `0` — a zero with a decimal tail reads as a rounded measurement.
  return value === 0 ? '0' : value.toFixed(5)
}

/**
 * Single-quoted where the content allows it, matching the hand-written modules in
 * `packages/core/src`.
 *
 * @param {string} value
 * @returns {string}
 */
function str(value) {
  return value.includes("'") ? JSON.stringify(value) : `'${value}'`
}

/**
 * Render the generated module.
 *
 * @param {{
 *   family: string,
 *   version: string,
 *   sha256: string,
 *   byRank: Record<string, { advances: Record<string, number>, widest: number }>,
 *   vertical: Record<string, number>,
 *   spread: { combined: number, combinedAt: string | null, opsz: number, opszAt: string | null, opszRange: number[] },
 * }} data
 * @returns {string}
 */
export function renderMetricsModule(data) {
  const axes = Object.entries(FIXED_AXES)
    .map(([tag, value]) => `'${tag}' ${String(value)}`)
    .join(', ')

  const lines = []
  lines.push(
    '/**',
    ' * @generated by `scripts/generate-font-metrics.mjs` — do not edit by hand.',
    ' *',
    ' * Regenerate with:',
    ' *',
    ' * ```sh',
    ' * node scripts/generate-font-metrics.mjs --write',
    ' * ```',
    ' *',
    ' * (the script prints the exact `curl` for the pinned font when it cannot find it).',
    ' *',
    ` * Measured from **${data.family}**, \`${data.version}\` — the released OFL`,
    ' * variable TTF in `google/fonts` `ofl/robotoflex`, pinned by content hash:',
    ' *',
    ` * > \`${data.sha256}\``,
    ' *',
    ' * **The font is not vendored and must not be**: `research/41-text-metrics.md` §4.2 is',
    ' * the reason `safetyFactor` exists at all.',
    ' *',
    ' * Provenance, per `research/00-decisions.md` tiers:',
    ' *',
    ' * | Field | Tier | Basis |',
    ' * |---|---|---|',
    ' * | `byRank[*].advances` | **A-impl** | `hmtx` ÷ `head.unitsPerEm`, per-rank variable instance |',
    ' * | `vertical` | **A-impl** | `OS/2` `sTypo*`, `sCapHeight`, `sxHeight`; `fsSelection` bit 7 is set, so these are the metrics a browser uses |',
    ' * | `fallback.latin` | **A-impl** | widest advance in the covered set, at that rank |',
    ' * | `fallback.combining` | **A-impl** | `GDEF` class 3; HarfBuzz zeroes mark advances |',
    ' * | `fallback.cjk` | **C** | ⚠ not measured — see below |',
    ' * | `safetyFactor` | **A-impl** | measured against three fallback faces; ⚠ one face unreachable — see below |',
    ' *',
    ' * ⚠ **`fallback.cjk` is a stated multiple, not a measurement.** Roboto Flex has no CJK',
    ' * coverage, so a full-width label falls through to a system CJK face this table cannot',
    ' * see. It is `2 ×` the latin band, which over-estimates and therefore errs in the',
    ' * direction `research/41-text-metrics.md` §6.1 mandates — but it is an assumption and',
    ' * it is labelled as one.',
    ' *',
    ' * ⚠ **`safetyFactor` covers three of the four faces in the fallback stack.** Segoe UI',
    ' * Variable is Windows-only and was not obtainable, so Windows drift stays **UNVERIFIED**.',
    ' * The number is a bound over SF, Roboto and DejaVu Sans and nothing more.',
    ' *',
    ' * ⚠ **Kerning is ignored on purpose.** The face carries a GPOS `kern` feature that',
    ' * browsers apply by default, and kerning reduces width — so summing bare advances',
    ' * over-estimates, which §6.1 requires.',
    ' */',
    '',
    "import type { FontMetrics, GlyphAdvances } from './text-types.ts'",
    '',
  )

  for (const [rank, fontSize, fontWeight] of RANKS) {
    const entry = data.byRank[rank]
    if (entry === undefined) throw new Error(`measurement missing rank ${rank}`)
    lines.push(
      '/**',
      ` * Rank ${rank} — ${String(fontSize)} px / ${String(fontWeight)}, so \`opsz ${String(fontSize)}\`, \`wght ${String(fontWeight)}\`, ${axes}.`,
      ' */',
      `const RANK_${rank}: GlyphAdvances = Object.freeze({`,
      '  advances: Object.freeze({',
    )
    const codePoints = Object.keys(entry.advances)
      .map(Number)
      .sort((a, b) => a - b)
    for (const cp of codePoints) {
      const value = entry.advances[String(cp)]
      if (value === undefined) continue
      const comment = cp > 0x7e ? `  // ${String.fromCodePoint(cp)}` : ''
      lines.push(`    ${keyLiteral(cp)}: ${num(value)},${comment}`)
    }
    lines.push(
      '  }),',
      '  fallback: Object.freeze({',
      `    latin: ${num(entry.widest)},`,
      `    cjk: ${num(entry.widest * CJK_BAND_MULTIPLE)},`,
      '    combining: 0,',
      '  }),',
      '})',
      '',
    )
  }

  /** @param {number} n */
  const spreadPct = (n) => `${(n * 100).toFixed(2)}%`
  lines.push(
    '/**',
    ' * The generated default table.',
    ' *',
    ' * ⚠ **`generatedWith.featureSettings` records a request this face does not implement,',
    ' * and that is correct.** Roboto Flex ships no `tnum`: its GSUB carries `liga`, `locl`,',
    ' * `pnum`, `rvrn` and nothing else. What that `pnum` lookup does is the finding —',
    ' * `uni0030 → uni0030.prop` — so the **default** figures are the tabular ones and `pnum`',
    ' * is the switch away from them. The Tabular Rule is satisfied by the defaults.',
    ' *',
    ' * The declaration stays because `generatedWith` describes what the CSS applies, and the',
    ' * CSS must keep applying it for the fallback faces: SF ships proportional figures by',
    ' * default (nine distinct digit widths, measured) and a real `tnum` to fix them.',
    ' *',
    ' * ⚠ The load-bearing rule is the negative one. **`proportional-nums` / `pnum` must never',
    ' * be applied to text measured against this table** — on this face that is precisely the',
    ' * setting that invalidates it.',
    ' *',
    ' * ⚠ **`opsz` and `wght` are absent from `variationSettings` on purpose.** They differ per',
    ' * rank, and a single string cannot hold five values; they come from',
    ' * `FittingTypography.byRank` instead, which is the pairing `byRank` exists to enforce.',
    ' *',
    ` * Measured spread across the five ranks: **${spreadPct(data.spread.combined)}** on the widest-moving glyph,`,
    ` * size and weight together — of which **${spreadPct(data.spread.opsz)}** is optical alone, at fixed`,
    ` * weight, over ${String(data.spread.opszRange[0])}–${String(data.spread.opszRange[1])} px. \`research/41-text-metrics.md\` §5.1 asked whether per-rank`,
    ' * keying was necessary on optical grounds as well as weight grounds. It is.',
    ' */',
    'export const ROBOTO_FLEX_METRICS: FontMetrics = Object.freeze({',
    `  family: ${str(data.family)},`,
    '  generatedWith: Object.freeze({',
    `    featureSettings: ${str(FEATURE_SETTINGS)},`,
    `    variationSettings: ${str(axes)},`,
    "    opticalSizing: 'auto',",
    "    stretch: 'normal',",
    '  }),',
    '  byRank: Object.freeze({',
    ...RANKS.map(([rank]) => `    ${rank}: RANK_${rank},`),
    '  }),',
    '  /**',
    '   * Calibrated, not chosen — `research/41-text-metrics.md` §4.2.',
    '   *',
    `   * Observed maximum ratio **${String(CALIBRATION.observedMax)}**, from \`${CALIBRATION.character}\` in`,
    `   * ${CALIBRATION.face} at rank ${CALIBRATION.rank}, rounded up.`,
    '   *',
    '   * ⚠ Rounded UP, not to nearest: rounding a bound down stops it being a bound.',
    '   *',
    '   * ⚠ It is a per-character maximum, which bounds whole labels — since',
    '   * `sum(fallback) / sum(reference) ≤ max(fallback / reference)` — but bounds them',
    '   * loosely, because equality needs a string made entirely of the worst character.',
    '   * Across 36 realistic label strings the worst whole-string ratio observed was 1.33.',
    '   * Consumers who genuinely load the reference face set this to `1.0` and pay none of it.',
    '   */',
    `  safetyFactor: ${String(CALIBRATION.safetyFactor)},`,
    '  vertical: Object.freeze({',
    ...['ascent', 'descent', 'lineGap', 'capHeight', 'xHeight'].map((k) => {
      const v = data.vertical[k]
      if (v === undefined) throw new Error(`measurement missing vertical.${k}`)
      return `    ${k}: ${num(v)},`
    }),
    '  }),',
    '}) satisfies FontMetrics',
    '',
  )

  return lines.join('\n')
}

/**
 * @param {string} python
 * @param {string} fontDir
 * @returns {Promise<{ module: string, report: Record<string, unknown> }>}
 */
async function generate(python, fontDir) {
  const reference = join(fontDir, REFERENCE.file)
  const bytes = await readFile(reference).catch(() => null)
  if (bytes === null) {
    throw new Error(
      `reference face not found at ${reference}\n\n` +
        `  mkdir -p ${fontDir}\n` +
        `  curl -sSLo ${reference} \\\n    '${REFERENCE.url}'\n\n` +
        'The library does not vendor the font. research/41-text-metrics.md §4.2.',
    )
  }
  const digest = createHash('sha256').update(bytes).digest('hex')
  if (digest !== REFERENCE.sha256) {
    throw new Error(
      `${basename(reference)} is not the pinned build.\n` +
        `  expected ${REFERENCE.sha256}\n` +
        `  found    ${digest}\n` +
        'Google Fonts republishes to the same path, so the URL names a moving target and the\n' +
        'hash names the bytes. Re-pin deliberately, with a regenerated table in the same commit.',
    )
  }

  const raw = await runPython(python, {
    mode: 'table',
    reference,
    ranks: RANKS,
    fixedAxes: FIXED_AXES,
  })
  const data = /** @type {Parameters<typeof renderMetricsModule>[0] & Record<string, any>} */ (raw)
  return { module: renderMetricsModule(data), report: data }
}

// --- CLI -----------------------------------------------------------------------------

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href

if (invokedDirectly) {
  /** @param {string} flag @param {string} fallback */
  const arg = (flag, fallback) => {
    const i = process.argv.indexOf(flag)
    return i === -1 ? fallback : (process.argv[i + 1] ?? fallback)
  }
  const python = arg('--python', DEFAULT_PYTHON)
  const fontDir = arg('--fonts', DEFAULT_FONT_DIR)

  try {
    if (process.argv.includes('--calibrate')) {
      const rows = /** @type {Array<Record<string, any>>} */ (
        await runPython(python, {
          mode: 'calibrate',
          reference: join(fontDir, REFERENCE.file),
          ranks: RANKS,
          fixedAxes: FIXED_AXES,
          faces: [
            { label: 'SF (system-ui)', path: '/System/Library/Fonts/SFNS.ttf', weights: null, trak: true },
            { label: 'Roboto', path: join(fontDir, 'Roboto.ttf'), weights: null, trak: false },
            { label: 'DejaVu Sans', path: join(fontDir, 'DejaVuSans.ttf'), weights: [400, 500], trak: false },
            { label: 'DejaVu Sans Bold', path: join(fontDir, 'DejaVuSans-Bold.ttf'), weights: [700], trak: false },
          ],
        })
      )
      let worst = { maxRatio: 0, label: '', rank: '', at: '' }
      for (const row of rows) {
        const missing = row['missing'].length > 0 ? `  missing ${String(row['missing'].length)}` : ''
        console.log(
          `${String(row['label']).padEnd(18)} rank ${String(row['rank'])} ` +
            `${String(row['fontSize'])}px/${String(row['fontWeight'])}  ` +
            `max ${Number(row['maxRatio']).toFixed(4)} at ${String(row['at'])}${missing}`,
        )
        if (Number(row['maxRatio']) > worst.maxRatio) {
          worst = {
            maxRatio: Number(row['maxRatio']),
            label: String(row['label']),
            rank: String(row['rank']),
            at: String(row['at']),
          }
        }
      }
      const derived = Math.ceil(worst.maxRatio * 100) / 100
      console.log(
        `\nobserved maximum ${worst.maxRatio.toFixed(4)} ` +
          `(${worst.label}, rank ${worst.rank}, ${worst.at}) -> safetyFactor ${String(derived)}`,
      )
      console.log('⚠ Segoe UI Variable is Windows-only and was not measured. Windows drift is UNVERIFIED.')
      if (derived !== CALIBRATION.safetyFactor) {
        console.error(
          `\nsafetyFactor drifted: committed ${String(CALIBRATION.safetyFactor)}, re-derived ${String(derived)}.`,
        )
        process.exit(1)
      }
      console.log(`safetyFactor ${String(CALIBRATION.safetyFactor)} confirmed.`)
    } else {
      const { module, report } = await generate(python, fontDir)
      const spread = /** @type {Record<string, any>} */ (report['spread'])
      console.log(`font metrics: ${String(report['family'])} ${String(report['version'])}`)
      console.log(
        `  ranks ${RANKS.map(([r]) => r).join('/')} · ` +
          `${String(Object.keys(/** @type {any} */ (report['byRank'])['A'].advances).length)} code points each`,
      )
      // The §5.1 open question, reported rather than assumed either way.
      console.log(
        `  max advance spread across ranks: ${(Number(spread['combined']) * 100).toFixed(2)}% ` +
          `(at ${String(spread['combinedAt'])}); optical alone: ` +
          `${(Number(spread['opsz']) * 100).toFixed(2)}% (at ${String(spread['opszAt'])})`,
      )
      const features = /** @type {Record<string, string[]>} */ (report['features'])
      console.log(`  GSUB ${features['GSUB']?.join(' ') ?? ''} · GPOS ${features['GPOS']?.join(' ') ?? ''}`)
      const arrows = /** @type {Record<string, boolean>} */ (report['arrowCoverage'])
      console.log(
        `  arrows: ${Object.entries(arrows).map(([k, v]) => `${k} ${v ? 'present' : 'ABSENT'}`).join(' · ')}`,
      )

      if (process.argv.includes('--write')) {
        await writeFile(TARGET, module)
        console.log('font metrics: generated.')
      } else {
        const actual = await readFile(TARGET, 'utf8').catch(() => '')
        if (actual !== module) {
          console.error(
            '\nfont metrics table is stale — run `node scripts/generate-font-metrics.mjs --write`.',
          )
          process.exit(1)
        }
        console.log('font metrics: generated output is current.')
      }
    }
  } catch (error) {
    console.error(`\n${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}
