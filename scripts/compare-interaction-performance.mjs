/**
 * Compare the captured UX-PERF-01 interaction evidence.
 *
 * The geometry-read count is the deterministic regression signal. Wall-clock timing is reported
 * for context only: one browser run cannot establish a universal FPS guarantee or statistical
 * significance.
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const BASELINE_PATH = fileURLToPath(new URL('./results/ux-perf-01-interaction-baseline.json', import.meta.url))
const LATEST_PATH = fileURLToPath(new URL('./results/ux-perf-01-interaction.latest.json', import.meta.url))

async function readResult(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function metric(result) {
  return result.result
}

const [baseline, latest] = await Promise.all([readResult(BASELINE_PATH), readResult(LATEST_PATH)])
const before = metric(baseline)
const after = metric(latest)
const boundsReadReduction = before.boundsReads > 0
  ? ((before.boundsReads - after.boundsReads) / before.boundsReads) * 100
  : 0
const elapsedDeltaMs = after.elapsedMs - before.elapsedMs
const elapsedChangePercent = before.elapsedMs > 0 ? (elapsedDeltaMs / before.elapsedMs) * 100 : 0
const structuralPass = after.boundsReads < before.boundsReads && after.boundsReads <= 1
const runtimePass = (latest.runtimeErrors?.console?.length ?? 0) === 0 && (latest.runtimeErrors?.page?.length ?? 0) === 0

const comparison = {
  status: structuralPass && runtimePass ? 'pass' : 'fail',
  browser: { baseline: baseline.browser, latest: latest.browser },
  sampleCount: { baseline: before.sampleCount, latest: after.sampleCount },
  boundsReads: { baseline: before.boundsReads, latest: after.boundsReads, reductionPercent: boundsReadReduction },
  elapsedMs: { baseline: before.elapsedMs, latest: after.elapsedMs, deltaMs: elapsedDeltaMs, changePercent: elapsedChangePercent },
  distinctResolvedDatums: { baseline: before.distinctResolvedDatums, latest: after.distinctResolvedDatums },
  runtimeErrors: latest.runtimeErrors,
  gate: {
    structuralPass,
    runtimePass,
    timingIsInformational: true,
  },
}

console.log(JSON.stringify(comparison, null, 2))
if (comparison.status !== 'pass') process.exitCode = 1
