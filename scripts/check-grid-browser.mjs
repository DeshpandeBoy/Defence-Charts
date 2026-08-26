/**
 * Gate C4.1 — the complete WidgetGrid/WidgetShell/AutoChart browser matrix.
 *
 * This gate intentionally lives beside G11 rather than replacing it. G11 drives the existing
 * free-resize playground and focuses on the AutoChart measurement loop; C4.1 drives the actual
 * RGL grid, shell chrome, keyboard layer, and dashboard environment matrix.
 *
 * Browser acquisition is delegated to G11's `openChromium()`. That keeps package resolution,
 * Chromium launch diagnosis, `SHIFTCHARTS_REQUIRE_BROWSER=1`, and the local skip policy in one place.
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { openChromium } from './check-containment.mjs'

/* eslint-disable no-undef -- DOM globals below are serialized into Playwright page callbacks. */

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const ORIGIN = process.env.SHIFTCHARTS_GRID_ORIGIN ?? 'http://127.0.0.1:5184/'
const VIEWPORT = { width: 1400, height: 1100 }
const EXPECTED_IDS = ['target', 'anchor', 'right', 'bottom', 'side']
const EXPECTED_FOOTPRINTS = ['1x1', '2x1', '3x1', '3x3', '6x5', '9x6']
const TOLERANCE = 3

function rectInside(inner, outer, label) {
  if (inner === null || outer === null) {
    throw new Error(`${label}: missing rectangle`)
  }
  if (
    inner.left < outer.left - TOLERANCE ||
    inner.top < outer.top - TOLERANCE ||
    inner.right > outer.right + TOLERANCE ||
    inner.bottom > outer.bottom + TOLERANCE
  ) {
    throw new Error(
      `${label}: ${JSON.stringify(inner)} is outside ${JSON.stringify(outer)}`,
    )
  }
}

function intersects(a, b) {
  return (
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > TOLERANCE &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > TOLERANCE
  )
}

/**
 * The same checker is used for real samples and the planted negative assertion below.
 * `outer-box-growth` is the containment defect that G11 previously proved could be missed by
 * looking only for a ResizeObserver console warning.
 */
export function judgeGeometry(before, after) {
  const failures = []
  const beforeById = new Map(before.items.map((item) => [item.id, item]))
  for (const item of after.items) {
    const previous = beforeById.get(item.id)
    if (previous === undefined) continue
    if (
      Math.abs(previous.outer.width - item.outer.width) > TOLERANCE ||
      Math.abs(previous.outer.height - item.outer.height) > TOLERANCE
    ) {
      failures.push({
        kind: 'outer-box-growth',
        id: item.id,
        detail: `${item.id} outer box changed ${previous.outer.width}×${previous.outer.height} → ${item.outer.width}×${item.outer.height} without input`,
      })
    }
  }
  for (const item of after.items) {
    if (item.shell !== null && item.outer !== null) {
      try {
        rectInside(item.shell, item.outer, `${item.id} shell containment`)
      } catch (error) {
        failures.push({ kind: 'shell-outside-item', id: item.id, detail: String(error) })
      }
    }
    if (item.auto !== null && item.content !== null) {
      try {
        rectInside(item.auto, item.content, `${item.id} AutoChart containment`)
      } catch (error) {
        failures.push({ kind: 'chart-outside-content', id: item.id, detail: String(error) })
      }
    }
  }
  return failures
}

function runPlantedNegativeAssertion() {
  const before = {
    items: [{ id: 'planted', outer: { width: 100, height: 100 } }],
  }
  const after = {
    items: [{ id: 'planted', outer: { width: 100, height: 140 }, shell: null, auto: null, content: null }],
  }
  const failures = judgeGeometry(before, after)
  if (!failures.some((failure) => failure.kind === 'outer-box-growth')) {
    throw new Error('negative assertion failed: planted outer-box growth was not detected')
  }
  console.log('grid gate negative assertion: planted outer-box growth detected')
}

async function answers(origin) {
  try {
    const response = await fetch(origin, { signal: AbortSignal.timeout(1500) })
    return response.ok
  } catch {
    return false
  }
}

async function ensureGridServer() {
  if (await answers(ORIGIN)) return { spawned: false, stop: () => {} }

  const child = spawn(
    'npx',
    [
      '--yes',
      'pnpm@10.34.5',
      '--filter',
      '@shiftcharts/playground',
      'exec',
      'vite',
      '--config',
      'src/grid-fixture.vite.ts',
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
  throw new Error(`the grid fixture never answered on ${ORIGIN} within 60s`)
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  }))
}

async function readFixture(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-shiftcharts-fixture="grid"]')
    if (root === null) throw new Error('grid fixture root is missing')
    const items = Array.from(root.querySelectorAll('[data-shiftcharts-slot]')).map((slot) => {
      const gridItem = slot.closest('.react-grid-item')
      const shell = slot.querySelector('.shiftcharts-widget-shell')
      const content = slot.querySelector('[data-shiftcharts-widget-content]')
      const auto = slot.querySelector('.shiftcharts-auto-chart')
      const rectOf = (element) => element === null ? null : (() => {
        const value = element.getBoundingClientRect()
        return {
          x: value.x,
          y: value.y,
          left: value.left,
          top: value.top,
          right: value.right,
          bottom: value.bottom,
          width: value.width,
          height: value.height,
        }
      })()
      return {
        id: slot.getAttribute('data-shiftcharts-slot'),
        footprint: slot.getAttribute('data-shiftcharts-footprint'),
        outer: rectOf(gridItem),
        shell: rectOf(shell),
        content: rectOf(content),
        auto: rectOf(auto),
        visible: gridItem !== null && rectOf(gridItem)?.width > 0 && rectOf(gridItem)?.height > 0,
      }
    })
    const ancestor = document.querySelector('[data-shiftcharts-ancestor-box]')
    return {
      mode: root.getAttribute('data-shiftcharts-mode'),
      ancestor: root.getAttribute('data-shiftcharts-ancestor'),
      hidden: root.getAttribute('data-shiftcharts-hidden'),
      zeroSize: root.getAttribute('data-shiftcharts-zero-size'),
      overflow: root.getAttribute('data-shiftcharts-overflow'),
      transform: root.getAttribute('data-shiftcharts-transform'),
      zoom: root.getAttribute('data-shiftcharts-zoom'),
      direction: root.getAttribute('data-shiftcharts-direction'),
      events: root.getAttribute('data-shiftcharts-events') ?? '',
      items,
      ancestorScrollWidth: ancestor?.scrollWidth ?? 0,
      ancestorClientWidth: ancestor?.clientWidth ?? 0,
      ancestorScrollHeight: ancestor?.scrollHeight ?? 0,
      ancestorClientHeight: ancestor?.clientHeight ?? 0,
      resizeHandles: Array.from(document.querySelector('[data-shiftcharts-slot="target"]')?.closest('.react-grid-item')?.querySelectorAll('.react-resizable-handle') ?? []).map((element) => element.className),
      keyboardControls: Array.from(document.querySelector('.shiftcharts-keyboard-grid:has([data-shiftcharts-slot="target"])')?.querySelectorAll('[data-shiftcharts-keyboard-control]') ?? []).map((element) => element.getAttribute('data-shiftcharts-keyboard-control')),
      activeElement: document.activeElement instanceof HTMLElement
        ? { tag: document.activeElement.tagName, keyboard: document.activeElement.getAttribute('data-shiftcharts-keyboard-control') }
        : null,
    }
  })
}

function assertIdsAndNoOverlap(sample) {
  const ids = sample.items.map((item) => item.id)
  if (JSON.stringify([...ids].sort()) !== JSON.stringify([...EXPECTED_IDS].sort())) {
    throw new Error(`lost or duplicate widget IDs: ${JSON.stringify(ids)}`)
  }
  for (const item of sample.items) {
    if (!item.visible) throw new Error(`${item.id} has no visible outer grid rectangle`)
  }
  for (let index = 0; index < sample.items.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < sample.items.length; otherIndex += 1) {
      const left = sample.items[index]
      const right = sample.items[otherIndex]
      if (left.outer !== null && right.outer !== null && intersects(left.outer, right.outer)) {
        throw new Error(`overlap between ${left.id} and ${right.id}`)
      }
    }
  }
}

function assertNoScrollGrowth(sample) {
  const horizontal = sample.ancestorScrollWidth - sample.ancestorClientWidth
  const vertical = sample.ancestorScrollHeight - sample.ancestorClientHeight
  if (horizontal > TOLERANCE || vertical > TOLERANCE) {
    throw new Error(`ancestor overflow grew by ${horizontal}×${vertical} px; root:${sample.ancestor}/${sample.transform}/${sample.zoom}; items:${sample.items.map((item) => `${item.id}@${item.outer?.x},${item.outer?.y},${item.outer?.width}×${item.outer?.height}`).join('|')}`)
  }
}

function assertStable(before, after, reason) {
  const failures = judgeGeometry(before, after)
  if (failures.length > 0) {
    throw new Error(`${reason}: ${failures.map((failure) => failure.detail).join('; ')}`)
  }
  for (const previous of before.items) {
    const current = after.items.find((item) => item.id === previous.id)
    if (current === undefined || previous.outer === null || current.outer === null) continue
    const changed = ['x', 'y', 'width', 'height'].some((key) => Math.abs(previous.outer[key] - current.outer[key]) > TOLERANCE)
    if (changed) throw new Error(`${reason}: ${previous.id} moved or resized without input`)
  }
}

async function settleAndCheck(page, reason, options = {}) {
  const before = await readFixture(page)
  await settle(page)
  const after = await readFixture(page)
  assertIdsAndNoOverlap(after)
  if (!options.allowAncestorOverflow) assertNoScrollGrowth(after)
  assertStable(before, after, reason)
  return after
}

async function clickFootprint(page, label) {
  await page.locator(`button[data-shiftcharts-footprint="${label}"]`).click()
  await page.waitForFunction((expected) => (
    document.querySelector('[data-shiftcharts-slot="target"]')?.getAttribute('data-shiftcharts-footprint') === expected
  ), label)
  await settle(page)
  const sample = await readFixture(page)
  const target = sample.items.find((item) => item.id === 'target')
  if (target?.footprint !== label) throw new Error(`requested ${label}, observed ${target?.footprint}`)
  assertIdsAndNoOverlap(sample)
  assertNoScrollGrowth(sample)
  return sample
}

function hasEvent(sample, event) {
  return sample.events.split(',').includes(event)
}

async function drag(page, selector, dx, dy) {
  const handle = page.locator(selector)
  const box = await handle.boundingBox()
  if (box === null) throw new Error(`${selector} has no bounding box`)
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 8 })
  await page.mouse.up()
  await settle(page)
}

async function runPointerMatrix(page) {
  const initial = await readFixture(page)
  if (initial.mode !== 'edit') await page.locator('[data-shiftcharts-mode-toggle]').click()
  const mode = (await readFixture(page)).mode
  if (mode !== 'edit') throw new Error(`pointer matrix requires edit mode, got ${mode}`)

  const directions = [
    ['right', 82, 0],
    ['left', -82, 0],
    ['down', 0, 78],
    ['up', 0, -78],
  ]
  for (const [direction, dx, dy] of directions) {
    await clickFootprint(page, '3x3')
    await drag(page, '[data-shiftcharts-pointer-handle]', dx, dy)
    const sample = await readFixture(page)
    if (!hasEvent(sample, 'drag-start') || !hasEvent(sample, 'drag-stop')) {
      throw new Error(`pointer drag ${direction} did not reach WidgetGrid callbacks: ${sample.events}`)
    }
    assertIdsAndNoOverlap(sample)
    await settleAndCheck(page, `pointer drag ${direction}`)
  }

  const handles = (await readFixture(page)).resizeHandles
  if (handles.length === 0) throw new Error('no RGL resize handle rendered')
  const supported = handles.map((value) => String(value).match(/react-resizable-handle-([a-z]+)/)?.[1]).filter(Boolean)
  if (supported.length !== 1 || supported[0] !== 'se') {
    throw new Error(`unexpected RGL resize handles: ${JSON.stringify(handles)}`)
  }

  for (const [direction, dx, dy] of [['east-south', 82, 78], ['west-north', -82, -78]]) {
    await clickFootprint(page, '3x3')
    await drag(page, '.react-grid-item:has([data-shiftcharts-slot="target"]) .react-resizable-handle-se', dx, dy)
    const sample = await readFixture(page)
    if (!hasEvent(sample, 'resize-start') || !hasEvent(sample, 'resize-stop')) {
      throw new Error(`pointer resize ${direction} did not reach WidgetGrid callbacks: ${sample.events}`)
    }
    assertIdsAndNoOverlap(sample)
    await settleAndCheck(page, `pointer resize ${direction}`)
  }

  return { dragDirections: directions.map(([direction]) => direction), resizeHandle: 'se', resizeDirections: ['east-south', 'west-north'] }
}

async function runKeyboardMatrix(page) {
  await clickFootprint(page, '3x3')
  const target = page.locator('.shiftcharts-keyboard-grid:has([data-shiftcharts-slot="target"])')
  const move = target.locator('[data-shiftcharts-keyboard-control="move"]')
  const resize = target.locator('[data-shiftcharts-keyboard-control="resize"]')
  if (await move.count() !== 1 || await resize.count() !== 1) throw new Error('edit mode keyboard controls are missing')

  await move.focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  if ((await move.getAttribute('aria-pressed')) !== 'true') throw new Error('move mode did not activate')
  await page.keyboard.press('Enter')
  const committed = await readFixture(page)
  if (!hasEvent(committed, 'layout-commit') || committed.activeElement?.keyboard !== 'move') {
    throw new Error(`keyboard move commit/focus failed: ${JSON.stringify(committed)}`)
  }

  await resize.focus()
  const beforeCancel = await readFixture(page)
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Escape')
  const cancelled = await readFixture(page)
  const targetAfterCancel = cancelled.items.find((item) => item.id === 'target')
  const targetBeforeCancel = beforeCancel.items.find((item) => item.id === 'target')
  if (targetAfterCancel?.footprint !== targetBeforeCancel?.footprint || cancelled.activeElement?.keyboard !== 'resize') {
    throw new Error(`keyboard resize cancel/focus failed: ${JSON.stringify({ beforeCancel, cancelled })}`)
  }

  await resize.focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  const resizeCommitted = await readFixture(page)
  if (!hasEvent(resizeCommitted, 'layout-commit') || resizeCommitted.activeElement?.keyboard !== 'resize') {
    throw new Error(`keyboard resize commit/focus failed: ${JSON.stringify(resizeCommitted)}`)
  }

  await page.locator('[data-shiftcharts-mode-toggle]').click()
  const readOnly = await readFixture(page)
  if (readOnly.mode !== 'read-only' || readOnly.keyboardControls.length !== 0) {
    throw new Error(`read-only mode still exposes editing controls: ${JSON.stringify(readOnly.keyboardControls)}`)
  }
  await page.locator('[data-shiftcharts-mode-toggle]').click()
  return { move: 'commit', resize: 'commit+cancel', readOnly: 'controls-hidden' }
}

async function runEnvironmentMatrix(page) {
  const results = []

  await page.locator('[data-shiftcharts-hidden-toggle]').click()
  await page.waitForFunction(() => document.querySelector('[data-shiftcharts-fixture="grid"]')?.getAttribute('data-shiftcharts-hidden') === 'true')
  const hidden = await readFixture(page)
  if (hidden.items.some((item) => item.visible)) throw new Error('hidden tab retained visible grid items')
  await page.locator('[data-shiftcharts-hidden-toggle]').click()
  await page.waitForSelector('[data-shiftcharts-slot="target"] .shiftcharts-auto-chart')
  await settleAndCheck(page, 'hidden tab restore')
  results.push('hidden-tab:pass')

  await page.locator('[data-shiftcharts-zero-toggle]').click()
  await page.waitForFunction(() => document.querySelector('[data-shiftcharts-fixture="grid"]')?.getAttribute('data-shiftcharts-zero-size') === 'true')
  const zero = await readFixture(page)
  if (zero.ancestorClientHeight > TOLERANCE) throw new Error(`zero-size parent retained ${zero.ancestorClientHeight}px block size`)
  await page.locator('[data-shiftcharts-zero-toggle]').click()
  await page.waitForSelector('[data-shiftcharts-slot="target"] .shiftcharts-auto-chart')
  await settleAndCheck(page, 'zero-size parent restore')
  results.push('zero-size-parent:pass')

  for (const ancestor of ['grid', 'flex']) {
    const sample = await readFixture(page)
    if (sample.ancestor !== ancestor) await page.locator('[data-shiftcharts-ancestor-toggle]').click()
    await page.waitForFunction((expected) => document.querySelector('[data-shiftcharts-fixture="grid"]')?.getAttribute('data-shiftcharts-ancestor') === expected, ancestor)
    await settleAndCheck(page, `${ancestor} ancestor`)
    results.push(`${ancestor}-ancestor:pass`)
  }

  await page.locator('[data-shiftcharts-overflow-toggle]').click()
  await page.waitForFunction(() => document.querySelector('[data-shiftcharts-fixture="grid"]')?.getAttribute('data-shiftcharts-overflow') === 'true')
  const overflow = await settleAndCheck(page, 'overflow ancestor')
  assertNoScrollGrowth(overflow)
  await page.locator('[data-shiftcharts-overflow-toggle]').click()
  results.push('overflow:pass')

  for (const mode of ['transform', 'zoom']) {
    await page.locator(`[data-shiftcharts-${mode}-toggle]`).click()
    await page.waitForFunction((key) => document.querySelector('[data-shiftcharts-fixture="grid"]')?.getAttribute(`data-shiftcharts-${key}`) === 'true', mode)
    const sample = await settleAndCheck(page, `${mode} ancestor`, { allowAncestorOverflow: mode === 'zoom' })
    await page.locator(`[data-shiftcharts-${mode}-toggle]`).click()
    results.push(mode === 'zoom'
      ? `zoom:pass-fixed-width-overflow:${sample.ancestorScrollWidth - sample.ancestorClientWidth}px`
      : `${mode}:pass`)
  }

  await page.locator('[data-shiftcharts-rtl-toggle]').click()
  await page.waitForFunction(() => document.querySelector('[data-shiftcharts-fixture="grid"]')?.getAttribute('data-shiftcharts-direction') === 'rtl')
  await settleAndCheck(page, 'rtl')
  await page.locator('[data-shiftcharts-rtl-toggle]').click()
  results.push('rtl:pass')
  return results
}

async function runContextMatrix(browser) {
  const results = []
  const cases = [
    ['reduced-motion', { reducedMotion: 'reduce' }, async (page) => {
      const matches = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      if (!matches) throw new Error('reduced-motion context did not reach matchMedia')
      await settleAndCheck(page, 'reduced motion')
    }],
    ['forced-colors', { forcedColors: 'active' }, async (page) => {
      const matches = await page.evaluate(() => window.matchMedia('(forced-colors: active)').matches)
      if (!matches) throw new Error('forced-colors context did not reach matchMedia')
      await settleAndCheck(page, 'forced colors')
    }],
    ['touch', { hasTouch: true, isMobile: true }, async (page) => {
      const before = await readFixture(page)
      const handle = page.locator('[data-shiftcharts-pointer-handle]')
      const box = await handle.boundingBox()
      if (box === null) throw new Error('touch probe handle has no box')
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
      await settle(page)
      const after = await readFixture(page)
      if (hasEvent(after, 'drag-start') && !hasEvent(before, 'drag-start')) {
        throw new Error('a touch tap unexpectedly started a grid drag')
      }
      assertIdsAndNoOverlap(after)
    }],
  ]

  for (const [name, options, test] of cases) {
    let context
    try {
      context = await browser.newContext({ viewport: VIEWPORT, ...options })
      const page = await context.newPage()
      await page.goto(ORIGIN, { waitUntil: 'load' })
      await page.waitForSelector('[data-shiftcharts-slot="target"] .shiftcharts-auto-chart', { timeout: 20_000 })
      await test(page)
      results.push(`${name}:pass`)
    } catch (error) {
      if (name === 'forced-colors' && /forcedColors|unknown option|not supported/i.test(String(error))) {
        results.push(`${name}:environment-limit:${String(error).split('\n')[0]}`)
      } else {
        throw error
      }
    } finally {
      await context?.close().catch(() => {})
    }
  }
  return results
}

async function runGate() {
  runPlantedNegativeAssertion()
  if (process.env.SHIFTCHARTS_GRID_NEGATIVE_ONLY === '1') return { negativeOnly: true }

  const { browser, from } = await openChromium('grid gate (C4.1)')
  const server = await ensureGridServer().catch(async (error) => {
    await browser.close().catch(() => {})
    throw error
  })

  const loopErrors = []
  try {
    const page = await browser.newPage({ viewport: VIEWPORT })
    page.on('console', (message) => {
      if (/resizeobserver loop/i.test(message.text())) loopErrors.push(message.text())
    })
    page.on('pageerror', (error) => {
      if (/resizeobserver loop/i.test(String(error))) loopErrors.push(String(error))
    })
    await page.goto(ORIGIN, { waitUntil: 'load' })
    await page.waitForSelector('[data-shiftcharts-fixture="grid"] [data-shiftcharts-slot="target"] .shiftcharts-auto-chart', { timeout: 20_000 })

    const footprints = []
    for (const label of EXPECTED_FOOTPRINTS) {
      const sample = await clickFootprint(page, label)
      footprints.push(sample.items.find((item) => item.id === 'target')?.footprint)
    }
    const pointer = await runPointerMatrix(page)
    const keyboard = await runKeyboardMatrix(page)
    const environments = await runEnvironmentMatrix(page)
    const contextEnvironments = await runContextMatrix(browser)

    if (loopErrors.length > 0) throw new Error(`ResizeObserver loop errors: ${loopErrors.join('; ')}`)
    if (JSON.stringify(footprints) !== JSON.stringify(EXPECTED_FOOTPRINTS)) {
      throw new Error(`footprint sweep mismatch: ${JSON.stringify(footprints)}`)
    }
    return { from, footprints, pointer, keyboard, environments, contextEnvironments, loopErrors }
  } finally {
    await browser.close().catch(() => {})
    server.stop()
  }
}

try {
  const result = await runGate()
  if (result.negativeOnly) {
    console.log('grid gate (C4.1): negative-only probe passed')
  } else {
    console.log(
      `grid gate (C4.1): Chromium run passed — footprints ${result.footprints.join(', ')}; ` +
        `pointer ${result.pointer.dragDirections.join('/')} + resize ${result.pointer.resizeHandle}; ` +
        `keyboard move ${result.keyboard.move}, resize ${result.keyboard.resize}; ` +
        `environment ${result.environments.concat(result.contextEnvironments).join(', ')}; ` +
        `0 ResizeObserver loop errors; playwright from ${result.from}.`,
    )
  }
} catch (error) {
  console.error(`grid gate (C4.1): FAILED — ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
