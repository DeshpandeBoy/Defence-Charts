/**
 * UX-PERF-01 — interaction hot-path evidence.
 *
 * This is deliberately an evidence runner, not a pass/fail FPS gate. It uses a real Chromium
 * page and counts the expensive SVG client-rect reads made while the pointer crosses a dense,
 * still-supported SVG line chart. Wall-clock values remain machine-dependent; the structural
 * count is the reproducible regression signal.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { openChromium } from './check-containment.mjs'

/* eslint-disable no-undef -- DOM globals below run inside Playwright page callbacks. */

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const ORIGIN = process.env.SHIFTCHARTS_INTERACTION_PERFORMANCE_ORIGIN ?? 'http://127.0.0.1:5185/'
const RESULT_PATH = fileURLToPath(new URL('./results/ux-perf-01-interaction.latest.json', import.meta.url))
const VIEWPORT = { width: 1500, height: 1400 }
const SAMPLE_COUNT = 24

async function answers(origin) {
  try {
    const response = await fetch(origin, { signal: AbortSignal.timeout(1500) })
    return response.ok
  } catch {
    return false
  }
}

async function ensureServer() {
  if (await answers(ORIGIN)) return { spawned: false, stop: () => {} }

  const child = spawn(
    'pnpm',
    ['--filter', '@shiftcharts/playground', 'exec', 'vite', '--config', 'src/interaction-fixture.vite.ts'],
    { cwd: REPO_ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    try {
      if (child.pid !== undefined) process.kill(-child.pid, 'SIGTERM')
    } catch {
      // The process already exited.
    }
  }

  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (await answers(ORIGIN)) return { spawned: true, stop }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  stop()
  throw new Error('interaction performance fixture never answered on ' + ORIGIN + ' within 60s')
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  }))
}

async function probe(page) {
  return page.evaluate(async ({ sampleCount }) => {
    const root = document.querySelector('[data-shiftcharts-performance-chart]')
    const target = root?.querySelector('.shiftcharts-interaction__target')
    const svg = root?.querySelector('.shiftcharts-interaction__svg')
    if (!(target instanceof SVGRectElement) || !(svg instanceof SVGSVGElement)) {
      throw new Error('performance chart interaction surface is missing')
    }

    const original = svg.getBoundingClientRect.bind(svg)
    let boundsReads = 0
    svg.getBoundingClientRect = () => {
      boundsReads += 1
      return original()
    }

    const rect = target.getBoundingClientRect()
    const startedAt = performance.now()
    const datumSequence = []
    for (let index = 0; index < sampleCount; index += 1) {
      const ratio = index / (sampleCount - 1)
      target.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + rect.width * ratio,
        clientY: rect.top + rect.height * (0.5 + Math.sin(index) * 0.2),
      }))
      await new Promise((resolve) => requestAnimationFrame(resolve))
      const tooltip = root.querySelector('[role="tooltip"]')
      datumSequence.push(tooltip?.getAttribute('data-point-index') ?? null)
    }
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const elapsedMs = performance.now() - startedAt
    svg.getBoundingClientRect = original

    return {
      sampleCount,
      boundsReads,
      elapsedMs,
      meanEventToNextFrameMs: elapsedMs / sampleCount,
      distinctResolvedDatums: new Set(datumSequence.filter((value) => value !== null)).size,
      finalDatum: datumSequence.at(-1),
    }
  }, { sampleCount: SAMPLE_COUNT })
}

async function run() {
  const { browser, from } = await openChromium('interaction performance evidence (UX-PERF-01)')
  const server = await ensureServer().catch(async (error) => {
    await browser.close().catch(() => {})
    throw error
  })
  const page = await browser.newPage({ viewport: VIEWPORT })
  const errors = { console: [], page: [] }
  page.on('console', (message) => {
    if (message.type() === 'error') errors.console.push(message.text())
  })
  page.on('pageerror', (error) => errors.page.push(String(error)))

  try {
    await page.goto(ORIGIN, { waitUntil: 'load' })
    await page.waitForSelector('[data-shiftcharts-performance-chart] .shiftcharts-interaction__target', { timeout: 20_000 })
    await settle(page)
    const result = await probe(page)
    if (result.distinctResolvedDatums < 2 || result.finalDatum === null) {
      throw new Error('hover probe did not resolve multiple stable datums: ' + JSON.stringify(result))
    }
    if (errors.console.length > 0 || errors.page.length > 0) {
      throw new Error('interaction performance fixture emitted runtime errors: ' + JSON.stringify(errors))
    }
    return {
      status: 'pass',
      fixture: 'apps/playground/src/interaction-fixture/',
      browser: browser.version(),
      playwrightFrom: from,
      viewport: VIEWPORT,
      result,
      runtimeErrors: errors,
      notes: [
        'Timing includes one requestAnimationFrame per synthetic pointer sample and is evidence from this machine, not a universal FPS claim.',
        'boundsReads is the portable structural metric: before caching it should equal sampleCount; after caching it should be one for an unchanged frame.',
      ],
    }
  } finally {
    await browser.close().catch(() => {})
    server.stop()
  }
}

try {
  const result = await run()
  await mkdir(new URL('./results/', import.meta.url), { recursive: true })
  await writeFile(RESULT_PATH, JSON.stringify(result, null, 2) + '\n')
  console.log('interaction performance evidence (UX-PERF-01): passed; evidence ' + RESULT_PATH)
} catch (error) {
  console.error('interaction performance evidence (UX-PERF-01): FAILED — ' + (error instanceof Error ? error.message : String(error)))
  process.exitCode = 1
}
