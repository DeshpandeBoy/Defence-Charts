/**
 * I1.5 — real-browser tooltip, crosshair, touch, keyboard, and legend matrix.
 *
 * This is deliberately a fixture gate rather than a package unit test. It drives Chromium
 * through the same DOM a consumer receives and records the result as committed evidence.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { openChromium } from './check-containment.mjs'

/* eslint-disable no-undef -- DOM globals below are serialized into Playwright page callbacks. */

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const ORIGIN = process.env.GX_INTERACTION_ORIGIN ?? 'http://127.0.0.1:5185/'
const RESULT_PATH = fileURLToPath(new URL('./results/i1.5-interaction-browser.latest.json', import.meta.url))
const VIEWPORT = { width: 1500, height: 1400 }
const TOLERANCE = 3

function rectInside(inner, outer, label) {
  if (inner === null || outer === null) throw new Error(label + ': missing rectangle')
  if (
    inner.left < outer.left - TOLERANCE ||
    inner.top < outer.top - TOLERANCE ||
    inner.right > outer.right + TOLERANCE ||
    inner.bottom > outer.bottom + TOLERANCE
  ) {
    throw new Error(label + ': ' + JSON.stringify(inner) + ' is outside ' + JSON.stringify(outer))
  }
}

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
    'npx',
    [
      '--yes',
      'pnpm@10.34.5',
      '--filter',
      '@gx/playground',
      'exec',
      'vite',
      '--config',
      'src/interaction-fixture.vite.ts',
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
      // The child already exited; there is no process group left to clean up.
    }
  }

  process.once('exit', stop)
  process.once('SIGINT', () => { stop(); process.exit(130) })
  process.once('SIGTERM', () => { stop(); process.exit(143) })

  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (await answers(ORIGIN)) return { spawned: true, stop }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  stop()
  throw new Error('interaction fixture never answered on ' + ORIGIN + ' within 60s')
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  }))
}

async function waitForChart(page, selector) {
  await page.goto(ORIGIN, { waitUntil: 'load' })
  await page.waitForSelector(selector + ' .gx-auto-chart .gx-interaction__target', { timeout: 20_000 })
  await settle(page)
}

function tooltipData(page, selector) {
  return page.locator(selector + ' [role="tooltip"]')
}

async function openAtCenter(page, selector) {
  const target = page.locator(selector + ' .gx-interaction__target')
  const box = await target.boundingBox()
  if (box === null) throw new Error(selector + ': interaction target has no box')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForSelector(selector + ' [role="tooltip"]', { timeout: 5_000 })
  return target
}

async function assertTooltipContained(page, selector, label) {
  const frame = await page.locator(selector).boundingBox()
  const tooltip = await tooltipData(page, selector).boundingBox()
  rectInside(tooltip, frame, label + ' tooltip containment')
}

async function runStaticContract(page) {
  const observed = await page.locator('[data-gx-static-chart]').evaluate((root) => ({
    interaction: root.querySelector('.gx-interaction') !== null,
    controlLegend: root.querySelector('.gx-legend--control') !== null,
    pressedNodes: root.querySelectorAll('[aria-pressed]').length,
    staticLegend: root.querySelector('.gx-legend') !== null,
    svg: root.querySelector('svg[role="graphics-document"]') !== null,
  }))
  if (observed.interaction || observed.controlLegend || observed.pressedNodes !== 0) {
    throw new Error('static Chart contains interaction-only markup: ' + JSON.stringify(observed))
  }
  if (!observed.staticLegend || !observed.svg) {
    throw new Error('static Chart did not render its server-safe chart surface: ' + JSON.stringify(observed))
  }
  return observed
}

async function runPanelKeyboardAndHover(page) {
  const selector = '[data-gx-resizable-chart]'
  const target = page.locator(selector + ' .gx-interaction__target')
  await target.focus()
  await page.keyboard.press('Enter')
  await page.waitForSelector(selector + ' [role="tooltip"]')

  const first = await tooltipData(page, selector).evaluate((node) => ({
    mode: node.getAttribute('data-tooltip-mode'),
    seriesId: node.getAttribute('data-series-id'),
    pointIndex: node.getAttribute('data-point-index'),
  }))
  if (first.mode !== 'fixed' || first.seriesId !== 'alpha' || first.pointIndex !== '0') {
    throw new Error('keyboard accessible equivalent did not open the first stable datum: ' + JSON.stringify(first))
  }
  const focusAfterOpen = await page.evaluate(() => document.activeElement?.classList.contains('gx-interaction__target'))
  if (!focusAfterOpen) throw new Error('focus left the datum interaction target after keyboard open')

  await page.keyboard.press('ArrowRight')
  const secondIndex = await tooltipData(page, selector).getAttribute('data-point-index')
  if (secondIndex !== '1') throw new Error('ArrowRight did not move to explicit point index 1')

  await page.keyboard.press('End')
  const end = await tooltipData(page, selector).evaluate((node) => ({
    seriesId: node.getAttribute('data-series-id'),
    pointIndex: node.getAttribute('data-point-index'),
  }))
  if (end.seriesId !== 'echo' || end.pointIndex !== '7') {
    throw new Error('End did not preserve series identity and reach the final defined datum: ' + JSON.stringify(end))
  }

  await page.keyboard.press('Home')
  const homeIndex = await tooltipData(page, selector).getAttribute('data-point-index')
  if (homeIndex !== '0') throw new Error('Home did not return to the first datum')

  await page.keyboard.press('Escape')
  await page.locator(selector + ' [role="tooltip"]').waitFor({ state: 'detached' })
  const focusAfterEscape = await page.evaluate(() => document.activeElement?.classList.contains('gx-interaction__target'))
  if (!focusAfterEscape) throw new Error('Escape dismissed the tooltip but did not retain focus on the target')

  await openAtCenter(page, selector)
  const hover = await tooltipData(page, selector).evaluate((node) => ({
    mode: node.getAttribute('data-tooltip-mode'),
    seriesId: node.getAttribute('data-series-id'),
    pointIndex: node.getAttribute('data-point-index'),
  }))
  if (hover.mode !== 'fixed' || hover.seriesId === null || hover.pointIndex === null) {
    throw new Error('Panel hover did not open a fixed tooltip with datum identity: ' + JSON.stringify(hover))
  }
  await assertTooltipContained(page, selector, 'Panel')
  await page.mouse.move(1, 1)
  await page.locator(selector + ' [role="tooltip"]').waitFor({ state: 'detached' })

  return {
    keyboard: 'Enter + ArrowRight + Home/End + Escape',
    focusRetention: 'target retained after Escape',
    hover: 'fixed + leave dismissal',
    stableEnd: end,
  }
}

async function runResizeWithOpenOverlay(page) {
  const selector = '[data-gx-resizable-chart]'
  const target = page.locator(selector + ' .gx-interaction__target')
  await target.focus()
  await page.keyboard.press('Enter')
  await page.waitForSelector(selector + ' [role="tooltip"]')
  const before = await tooltipData(page, selector).evaluate((node) => ({
    mode: node.getAttribute('data-tooltip-mode'),
    seriesId: node.getAttribute('data-series-id'),
    pointIndex: node.getAttribute('data-point-index'),
  }))
  if (before.mode !== 'fixed') throw new Error('resize scenario did not begin in Panel/fixed mode')

  await page.locator('[data-gx-resize-toggle]').click()
  await page.waitForFunction(() => document.querySelector('[data-gx-resizable-chart]')?.getAttribute('data-gx-size-class') === 'canvas')
  await page.waitForFunction(() => document.querySelector('[data-gx-resizable-chart] [role="tooltip"]')?.getAttribute('data-tooltip-mode') === 'fluid')
  const after = await tooltipData(page, selector).evaluate((node) => ({
    mode: node.getAttribute('data-tooltip-mode'),
    seriesId: node.getAttribute('data-series-id'),
    pointIndex: node.getAttribute('data-point-index'),
  }))
  if (after.seriesId !== before.seriesId || after.pointIndex !== before.pointIndex) {
    throw new Error('open overlay lost stable identity during resize: ' + JSON.stringify({ before, after }))
  }
  await assertTooltipContained(page, selector, 'resized Canvas')
  await page.locator(selector + ' .gx-interaction__target').focus()
  await page.keyboard.press('Escape')
  await page.locator(selector + ' [role="tooltip"]').waitFor({ state: 'detached' })
  await page.locator('[data-gx-resize-toggle]').click()
  await page.waitForFunction(() => document.querySelector('[data-gx-resizable-chart]')?.getAttribute('data-gx-size-class') === 'panel')

  return { before, after, modeAfterResize: after.mode, identityPreserved: true }
}

async function runLegendKeyboard(page) {
  const root = page.locator('[data-gx-legend-control]')
  const buttons = root.locator('button.gx-legend__control')
  if (await buttons.count() !== 5) throw new Error('controlled legend did not expose all stable series entries')

  const ids = await root.locator('.gx-legend__item').evaluateAll((items) => (
    items.map((item) => item.getAttribute('data-series-id'))
  ))
  if (JSON.stringify(ids) !== JSON.stringify(['alpha', 'bravo', 'charlie', 'delta', 'echo'])) {
    throw new Error('legend series order changed: ' + JSON.stringify(ids))
  }

  const bravo = root.locator('[data-series-id="bravo"] .gx-legend__control')
  await bravo.focus()
  await page.keyboard.press('Space')
  await page.waitForFunction(() => document.querySelector('[data-gx-legend-control] [data-series-id="bravo"] button')?.getAttribute('aria-pressed') === 'false')
  const hidden = await root.locator('[data-series-id="bravo"] .gx-legend__control').getAttribute('aria-pressed')
  const focused = await page.evaluate(() => document.activeElement?.closest('[data-series-id]')?.getAttribute('data-series-id'))
  const state = await page.locator('[data-gx-interaction-state]').textContent()
  if (hidden !== 'false' || focused !== 'bravo' || !state?.includes('hidden-series:bravo')) {
    throw new Error('legend keyboard toggle did not preserve visible entry/focus/local state: ' + JSON.stringify({ hidden, focused, state }))
  }

  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.querySelector('[data-gx-legend-control] [data-series-id="bravo"] button')?.getAttribute('aria-pressed') === 'true')
  return { entries: ids, toggledSeriesId: 'bravo', hiddenEntryRetained: true, focusRetained: true }
}

async function runTouch(browser) {
  const context = await browser.newContext({ viewport: VIEWPORT, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  const errors = captureErrors(page)
  try {
    await waitForChart(page, '[data-gx-tap-chart]')
    const target = page.locator('[data-gx-tap-chart] .gx-interaction__target')
    const box = await target.boundingBox()
    if (box === null) throw new Error('touch target has no box')
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    await page.touchscreen.tap(point.x, point.y)
    await page.waitForSelector('[data-gx-tap-chart] [role="tooltip"]')
    const opened = await tooltipData(page, '[data-gx-tap-chart]').evaluate((node) => ({
      mode: node.getAttribute('data-tooltip-mode'),
      seriesId: node.getAttribute('data-series-id'),
      pointIndex: node.getAttribute('data-point-index'),
    }))
    if (opened.mode !== 'fixed' || opened.seriesId === null || opened.pointIndex === null) {
      throw new Error('touch tap did not lock a fixed tooltip: ' + JSON.stringify(opened))
    }
    await page.touchscreen.tap(point.x, point.y)
    await page.locator('[data-gx-tap-chart] [role="tooltip"]').waitFor({ state: 'detached' })
    if (errors.console.length > 0 || errors.page.length > 0) {
      throw new Error('touch context runtime errors: ' + JSON.stringify(errors))
    }
    return { firstTap: 'locked', secondTap: 'closed', opened }
  } finally {
    await context.close().catch(() => {})
  }
}

async function runMediaContract(browser, label, options) {
  const context = await browser.newContext({ viewport: VIEWPORT, ...options })
  const page = await context.newPage()
  const errors = captureErrors(page)
  try {
    await waitForChart(page, '[data-gx-resizable-chart]')
    const target = page.locator('[data-gx-resizable-chart] .gx-interaction__target')
    await target.focus()
    await page.keyboard.press('Enter')
    await page.waitForSelector('[data-gx-resizable-chart] [role="tooltip"]')
    const observed = await page.evaluate(() => {
      const tooltip = document.querySelector('[data-gx-resizable-chart] [role="tooltip"]')
      const legend = document.querySelector('[data-gx-legend-control] .gx-legend__control')
      const tooltipStyle = tooltip === null ? null : getComputedStyle(tooltip)
      const legendStyle = legend === null ? null : getComputedStyle(legend)
      return {
        media:
          window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        forced:
          window.matchMedia('(forced-colors: active)').matches,
        tooltipTransition: tooltipStyle?.transitionDuration ?? null,
        tooltipBorderStyle: tooltipStyle?.borderStyle ?? null,
        tooltipBoxShadow: tooltipStyle?.boxShadow ?? null,
        legendColor: legendStyle?.color ?? null,
        legendBackground: legendStyle?.backgroundColor ?? null,
      }
    })
    if (label === 'reduced-motion') {
      if (!observed.media || observed.tooltipTransition !== '0s') {
        throw new Error('reduced-motion CSS contract failed: ' + JSON.stringify(observed))
      }
    } else {
      if (!observed.forced || observed.tooltipBorderStyle !== 'solid' || observed.tooltipBoxShadow !== 'none') {
        throw new Error('forced-colors CSS contract failed: ' + JSON.stringify(observed))
      }
      if (observed.legendColor === '' || observed.legendBackground === '') {
        throw new Error('forced-colors legend color contract was empty: ' + JSON.stringify(observed))
      }
    }
    if (errors.console.length > 0 || errors.page.length > 0) {
      throw new Error(label + ' context runtime errors: ' + JSON.stringify(errors))
    }
    return observed
  } finally {
    await context.close().catch(() => {})
  }
}

function captureErrors(page) {
  const errors = { console: [], page: [] }
  page.on('console', (message) => {
    if (message.type() === 'error') errors.console.push(message.text())
  })
  page.on('pageerror', (error) => errors.page.push(String(error)))
  return errors
}

async function runGate() {
  const { browser, from } = await openChromium('interaction browser matrix (I1.5)')
  const server = await ensureServer().catch(async (error) => {
    await browser.close().catch(() => {})
    throw error
  })
  const page = await browser.newPage({ viewport: VIEWPORT })
  const errors = captureErrors(page)
  const resizeObserverErrors = []
  page.on('console', (message) => {
    if (/resizeobserver loop/i.test(message.text())) resizeObserverErrors.push(message.text())
  })
  page.on('pageerror', (error) => {
    if (/resizeobserver loop/i.test(String(error))) resizeObserverErrors.push(String(error))
  })

  try {
    await waitForChart(page, '[data-gx-resizable-chart]')
    const staticContract = await runStaticContract(page)
    const panel = await runPanelKeyboardAndHover(page)
    const resize = await runResizeWithOpenOverlay(page)
    const legend = await runLegendKeyboard(page)
    const touch = await runTouch(browser)
    const reducedMotion = await runMediaContract(browser, 'reduced-motion', { reducedMotion: 'reduce' })
    const forcedColors = await runMediaContract(browser, 'forced-colors', { forcedColors: 'active' })

    if (errors.console.length > 0 || errors.page.length > 0) {
      throw new Error('browser runtime errors: ' + JSON.stringify(errors))
    }
    if (resizeObserverErrors.length > 0) {
      throw new Error('ResizeObserver loop errors: ' + JSON.stringify(resizeObserverErrors))
    }

    return {
      status: 'pass',
      fixture: 'apps/playground/src/interaction-fixture/',
      origin: ORIGIN,
      browser: browser.version(),
      playwrightFrom: from,
      static: staticContract,
      panel,
      resize,
      legend,
      touch,
      reducedMotion,
      forcedColors,
      runtimeErrors: { console: errors.console, page: errors.page, resizeObserver: resizeObserverErrors },
    }
  } finally {
    await browser.close().catch(() => {})
    server.stop()
  }
}

try {
  const result = await runGate()
  await mkdir(new URL('./results/', import.meta.url), { recursive: true })
  await writeFile(RESULT_PATH, JSON.stringify(result, null, 2) + '\n')
  console.log(
    'interaction browser matrix (I1.5): Chromium run passed — ' +
      'touch lock/close, keyboard datum navigation, legend toggles, resize identity, ' +
      'static contract, reduced-motion, forced-colors, and 0 runtime/ResizeObserver errors; ' +
      'evidence ' + RESULT_PATH,
  )
} catch (error) {
  console.error('interaction browser matrix (I1.5): FAILED — ' + (error instanceof Error ? error.message : String(error)))
  process.exitCode = 1
}
