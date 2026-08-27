/**
 * C4.2 — real-browser WidgetGrid stress evidence.
 *
 * This is an evidence runner, not a performance gate. It renders the actual WidgetGrid,
 * WidgetShell, and AutoChart path at every requested widget count, records repeated transitions
 * from an empty layout to the same deterministic layout, and writes the observations without
 * turning any measured number into an unapproved budget.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { openChromium } from './check-containment.mjs'

/* eslint-disable no-undef -- these globals are serialized into Playwright page callbacks. */

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const ORIGIN = process.env.SHIFTCHARTS_GRID_STRESS_ORIGIN ?? 'http://127.0.0.1:5185/'
const VIEWPORT = { width: 1440, height: 900 }
const COUNTS = [1, 10, 50, 100, 200]
const WARMUP_ITERATIONS = 2
const MEASURED_SAMPLES = 5
const RESULT_PATH = fileURLToPath(new URL('./results/c4.2-grid-stress.latest.json', import.meta.url))

async function answers(origin) {
  try {
    const response = await fetch(origin, { signal: AbortSignal.timeout(1500) })
    return response.ok
  } catch {
    return false
  }
}

async function ensureStressServer() {
  if (await answers(ORIGIN)) return { stop: () => {}, spawned: false }

  const child = spawn(
    'pnpm',
    [
      '--filter',
      '@shiftcharts/playground',
      'exec',
      'vite',
      '--config',
      'src/grid-stress-fixture.vite.ts',
    ],
    { cwd: REPO_ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
  )

  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    try {
      if (child.pid !== undefined) process.kill(-child.pid, 'SIGTERM')
    } catch {
      // The process group may already have exited.
    }
  }

  process.once('exit', stop)
  process.once('SIGINT', () => { stop(); process.exit(130) })
  process.once('SIGTERM', () => { stop(); process.exit(143) })

  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (await answers(ORIGIN)) return { stop, spawned: true }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  stop()
  throw new Error(`the grid stress fixture never answered on ${ORIGIN} within 60s`)
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  }))
}

async function waitForFixture(page) {
  await page.waitForSelector('[data-shiftcharts-stress="grid"][data-shiftcharts-stress-ready="true"]', { timeout: 20_000 })
  await page.waitForFunction(() => typeof window.__shiftchartsStress?.setWidgetCount === 'function', null, { timeout: 20_000 })
}

async function setWidgetCount(page, count) {
  return page.evaluate(async (nextCount) => {
    const api = window.__shiftchartsStress
    if (api === undefined) throw new Error('grid stress API is not ready')
    return api.setWidgetCount(nextCount)
  }, count)
}

async function resetMetrics(page) {
  await page.evaluate(() => {
    const api = window.__shiftchartsStress
    if (api === undefined) throw new Error('grid stress API is not ready')
    api.resetMetrics()
  })
}

async function readMetrics(page) {
  return page.evaluate(() => {
    const api = window.__shiftchartsStress
    if (api === undefined) throw new Error('grid stress API is not ready')
    return api.readMetrics()
  })
}

async function readFixtureState(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-shiftcharts-stress="grid"]')
    if (root === null) throw new Error('grid stress root is missing')
    const slots = Array.from(root.querySelectorAll('[data-shiftcharts-stress-slot]'))
    return {
      count: Number(root.getAttribute('data-shiftcharts-stress-count')),
      inputFingerprint: root.getAttribute('data-shiftcharts-stress-input-fingerprint'),
      supportedCounts: root.getAttribute('data-shiftcharts-stress-supported-counts'),
      domItemCount: slots.length,
      ids: slots.map((slot) => slot.getAttribute('data-shiftcharts-stress-slot')),
      rootScrollHeight: root.scrollHeight,
    }
  })
}

async function readRuntimeContext(page) {
  return page.evaluate(() => ({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    crossOriginIsolated: window.crossOriginIsolated,
    devicePixelRatio: window.devicePixelRatio,
    performanceMemory: performance.memory === undefined
      ? null
      : {
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          usedJSHeapSize: performance.memory.usedJSHeapSize,
        },
  }))
}

async function createPerformanceProbe(page) {
  try {
    const session = await page.context().newCDPSession(page)
    await session.send('Performance.enable')
    return { session, limitation: null }
  } catch (error) {
    return {
      session: null,
      limitation: `Chromium Performance domain unavailable: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

async function readMemoryTrend(page, session) {
  if (session !== null) {
    try {
      const response = await session.send('Performance.getMetrics')
      const values = new Map(response.metrics.map((metric) => [metric.name, metric.value]))
      const jsHeapUsedBytes = values.get('JSHeapUsedSize')
      const jsHeapTotalBytes = values.get('JSHeapTotalSize')
      const nodes = values.get('Nodes')
      const layoutCount = values.get('LayoutCount')
      const recalcStyleCount = values.get('RecalcStyleCount')
      if (jsHeapUsedBytes !== undefined || jsHeapTotalBytes !== undefined) {
        return {
          available: true,
          source: 'Chromium DevTools Performance.getMetrics',
          jsHeapUsedBytes: jsHeapUsedBytes ?? null,
          jsHeapTotalBytes: jsHeapTotalBytes ?? null,
          nodes: nodes ?? null,
          layoutCount: layoutCount ?? null,
          recalcStyleCount: recalcStyleCount ?? null,
        }
      }
    } catch {
      // Try the page API below. The result will carry its source and limitations.
    }
  }

  const fallback = await page.evaluate(() => {
    if (performance.memory === undefined) return null
    return {
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      usedJSHeapSize: performance.memory.usedJSHeapSize,
    }
  })
  if (fallback !== null) {
    return {
      available: true,
      source: 'window.performance.memory',
      jsHeapUsedBytes: fallback.usedJSHeapSize,
      jsHeapTotalBytes: fallback.totalJSHeapSize,
      jsHeapSizeLimitBytes: fallback.jsHeapSizeLimit,
      nodes: null,
      layoutCount: null,
      recalcStyleCount: null,
    }
  }
  return {
    available: false,
    source: null,
    jsHeapUsedBytes: null,
    jsHeapTotalBytes: null,
    nodes: null,
    layoutCount: null,
    recalcStyleCount: null,
  }
}

function expectedIds(count) {
  return Array.from({ length: count }, (_, index) => `stress-${String(index).padStart(4, '0')}`)
}

function assertStableIds(state, count) {
  const ids = state.ids
  const expected = expectedIds(count)
  const unique = new Set(ids)
  if (state.count !== count || state.domItemCount !== count) {
    throw new Error(`widget count mismatch: expected ${count}, observed ${JSON.stringify({ count: state.count, domItemCount: state.domItemCount })}`)
  }
  if (unique.size !== count || ids.some((id, index) => id !== expected[index])) {
    throw new Error(`stable widget IDs failed at ${count}: ${JSON.stringify(ids.slice(0, 12))}`)
  }
}

function metricDelta(before, after) {
  return {
    layoutChangeCount: after.layoutChangeCount - before.layoutChangeCount,
    layoutCommitCount: after.layoutCommitCount - before.layoutCommitCount,
    identityFailureCount: after.identityFailureCount - before.identityFailureCount,
    callbackItemCounts: after.callbackItemCounts.slice(before.callbackItemCounts.length),
  }
}

function sameMetrics(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

async function runCase(browser, count) {
  const context = await browser.newContext({ viewport: VIEWPORT })
  const page = await context.newPage()
  const resizeObserverLoopErrors = []
  const pageErrors = []
  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text()
      consoleErrors.push(text)
      if (/resizeobserver loop/i.test(text)) resizeObserverLoopErrors.push(text)
    }
  })
  page.on('pageerror', (error) => {
    const text = String(error)
    pageErrors.push(text)
    if (/resizeobserver loop/i.test(text)) resizeObserverLoopErrors.push(text)
  })

  try {
    await page.goto(ORIGIN, { waitUntil: 'load' })
    await waitForFixture(page)
    const runtime = await readRuntimeContext(page)
    const probe = await createPerformanceProbe(page)
    const fingerprints = new Set()
    const warmups = []

    for (let index = 0; index < WARMUP_ITERATIONS; index += 1) {
      await setWidgetCount(page, 0)
      const measurement = await setWidgetCount(page, count)
      const state = await readFixtureState(page)
      assertStableIds(state, count)
      fingerprints.add(state.inputFingerprint)
      warmups.push({
        index: index + 1,
        measurement,
        memory: await readMemoryTrend(page, probe.session),
      })
      // The next measured transition starts from the empty layout; every sample therefore uses
      // the same controlled input transition.
      await setWidgetCount(page, 0)
    }

    await resetMetrics(page)
    resizeObserverLoopErrors.length = 0
    pageErrors.length = 0
    consoleErrors.length = 0

    const samples = []
    for (let index = 0; index < MEASURED_SAMPLES; index += 1) {
      await setWidgetCount(page, 0)
      await settle(page)
      const beforeMetrics = await readMetrics(page)
      resizeObserverLoopErrors.length = 0
      const measurement = await setWidgetCount(page, count)
      const stateAtLayout = await readFixtureState(page)
      assertStableIds(stateAtLayout, count)
      fingerprints.add(stateAtLayout.inputFingerprint)
      const metricsAtLayout = await readMetrics(page)
      const memoryAtLayout = await readMemoryTrend(page, probe.session)

      await settle(page)
      const metricsAfterQuiet = await readMetrics(page)
      const memoryAfterQuiet = await readMemoryTrend(page, probe.session)
      const delta = metricDelta(beforeMetrics, metricsAtLayout)
      const callbackStableAfterQuiet = sameMetrics(metricsAtLayout, metricsAfterQuiet)

      samples.push({
        index: index + 1,
        measurement,
        callbackDelta: delta,
        callbackStableAfterQuiet,
        memoryAtLayout,
        memoryAfterQuiet,
        resizeObserverLoopErrors: [...resizeObserverLoopErrors],
      })
    }

    const memoryValues = samples
      .map((sample) => sample.memoryAfterQuiet.jsHeapUsedBytes)
      .filter((value) => typeof value === 'number')
    const memoryTrend = {
      available: memoryValues.length > 0,
      source: samples[0]?.memoryAfterQuiet.source ?? null,
      firstUsedBytes: memoryValues[0] ?? null,
      lastUsedBytes: memoryValues.at(-1) ?? null,
      deltaBytes: memoryValues.length > 1 ? memoryValues.at(-1) - memoryValues[0] : null,
      samples: samples.map((sample) => sample.memoryAfterQuiet),
    }

    const callbackStable = samples.every((sample) => sample.callbackStableAfterQuiet)
    const identityStable = samples.every((sample) => sample.callbackDelta.identityFailureCount === 0)
    const loopFree = resizeObserverLoopErrors.length === 0 && samples.every((sample) => sample.resizeObserverLoopErrors.length === 0)
    const hasUnexpectedRuntimeErrors = pageErrors.length > 0 || consoleErrors.length > 0
    if (fingerprints.size !== 1) throw new Error(`layout input fingerprint changed across ${count}-widget samples: ${JSON.stringify([...fingerprints])}`)
    if (!identityStable) throw new Error(`identity retention failed in ${count}-widget samples`)
    if (!loopFree) throw new Error(`ResizeObserver loop errors in ${count}-widget samples: ${resizeObserverLoopErrors.join('; ')}`)
    if (hasUnexpectedRuntimeErrors) throw new Error(`browser runtime errors in ${count}-widget samples: ${[...pageErrors, ...consoleErrors].join('; ')}`)

    return {
      count,
      inputFingerprint: [...fingerprints][0] ?? null,
      warmupIterations: WARMUP_ITERATIONS,
      measuredSamples: MEASURED_SAMPLES,
      warmups,
      samples,
      callbackStability: {
        stableAfterQuiet: callbackStable,
        identityRetention: identityStable,
        layoutChangeCounts: samples.map((sample) => sample.callbackDelta.layoutChangeCount),
        layoutCommitCounts: samples.map((sample) => sample.callbackDelta.layoutCommitCount),
      },
      resizeObserverLoopErrors: [],
      memoryTrend,
      browserRuntime: {
        pageErrors: [],
        consoleErrors: [],
      },
      runtime,
      limitations: [
        'Memory readings are Chromium JavaScript heap metrics, not operating-system available RAM.',
        'The measured transition is an empty controlled layout to the deterministic target layout; it is not a drag or resize benchmark.',
      ],
    }
  } finally {
    await context.close().catch(() => {})
  }
}

async function runStress() {
  const { browser, from } = await openChromium('grid stress evidence (C4.2)')
  const server = await ensureStressServer().catch(async (error) => {
    await browser.close().catch(() => {})
    throw error
  })
  try {
    const cases = []
    for (const count of COUNTS) {
      console.log(`grid stress (C4.2): measuring ${count} widgets (${WARMUP_ITERATIONS} warmups, ${MEASURED_SAMPLES} samples)`)
      cases.push(await runCase(browser, count))
    }
    return {
      schema: 'c4.2-grid-stress/v1',
      task: 'C4.2',
      generatedAt: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        browser: browser.version(),
        playwrightFrom: from,
        origin: ORIGIN,
        viewport: VIEWPORT,
      },
      method: {
        requestedWidgetCounts: COUNTS,
        warmupIterations: WARMUP_ITERATIONS,
        measuredSamples: MEASURED_SAMPLES,
        transition: '0 widgets -> requested count',
        identicalLayoutInput: true,
        performanceBudget: null,
      },
      cases,
      limitations: [
        'Chromium exposes JavaScript heap metrics through the DevTools Performance domain; operating-system available memory is not exposed by this runner and is not fabricated.',
        'The runner records evidence only. No performance threshold or pass/fail budget is inferred from the observed timings.',
        'C4.1 owns pointer, resize, keyboard, and environment interaction coverage; C4.2 uses read-only mode to isolate repeated grid/layout population from input gesture cost.',
      ],
    }
  } finally {
    await browser.close().catch(() => {})
    server.stop()
  }
}

try {
  const result = await runStress()
  await mkdir(dirname(RESULT_PATH), { recursive: true })
  await writeFile(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  const summary = result.cases.map((item) => {
    const timings = item.samples.map((sample) => sample.measurement.totalLatencyMs)
    const min = Math.min(...timings)
    const max = Math.max(...timings)
    const mean = timings.reduce((total, value) => total + value, 0) / timings.length
    return `${item.count}: min/mean/max ${min.toFixed(3)}/${mean.toFixed(3)}/${max.toFixed(3)}ms; ` +
      `callbacks ${item.callbackStability.layoutChangeCounts.join('/')} changes + ` +
      `${item.callbackStability.layoutCommitCounts.join('/')} commits; ` +
      `heap ${item.memoryTrend.available ? `${item.memoryTrend.firstUsedBytes}→${item.memoryTrend.lastUsedBytes} bytes` : 'unavailable'}`
  })
  console.log(`grid stress (C4.2): Chromium run passed; evidence written to ${RESULT_PATH}`)
  for (const line of summary) console.log(`  ${line}`)
} catch (error) {
  console.error(`grid stress (C4.2): FAILED — ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
