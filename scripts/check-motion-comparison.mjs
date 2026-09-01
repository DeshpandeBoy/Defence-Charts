/**
 * Chromium gate for the sandbox's old/new resize comparison.
 *
 * This is intentionally separate from G19's playground motion gate. G19 proves the existing
 * line/area resize contract; this gate proves the product-facing comparison fixture that makes
 * the bar/arc defect visible and exercises the opt-in client boundary.
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { openChromium } from './check-containment.mjs'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const ORIGIN = process.env.SHIFTCHARTS_MOTION_ORIGIN ?? 'http://localhost:5176/motion'
const PORT = new URL(ORIGIN).port || '5176'
const VIEWPORT = { width: 1680, height: 1200 }

async function answers(origin, timeoutMs = 2000) {
  try {
    const response = await fetch(origin, { signal: AbortSignal.timeout(timeoutMs) })
    return response.ok
  } catch {
    return false
  }
}

async function ensureSandboxServer() {
  if (await answers(ORIGIN)) return { stop: () => {}, spawned: false }

  const child = spawn(
    'pnpm',
    ['--filter', '@shiftcharts/sandbox', 'dev', '--', '--host', '127.0.0.1', '--port', PORT],
    { cwd: REPO_ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    try {
      if (child.pid !== undefined) process.kill(-child.pid, 'SIGTERM')
    } catch {
      // The process already exited; the desired state is still reached.
    }
  }
  process.once('exit', stop)
  process.once('SIGINT', () => { stop(); process.exit(130) })
  process.once('SIGTERM', () => { stop(); process.exit(143) })

  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (await answers(ORIGIN, 1000)) return { stop, spawned: true }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  stop()
  throw new Error(`the sandbox never answered on ${ORIGIN} within 60s`)
}

async function readState(page) {
  return page.evaluate(() => {
    const cards = [...globalThis.document.querySelectorAll('.motion-comparison__card')]
    const readCard = (card) => {
      const chart = card.querySelector('.shiftcharts-chart')
      const bar = card.querySelector('.shiftcharts-bar')
      const arc = card.querySelector('.shiftcharts-arc')
      const phase = card.getAttribute('data-shiftcharts-interaction-phase')
      const style = chart === null ? null : globalThis.getComputedStyle(chart)
      return {
        phase,
        duration: style?.getPropertyValue('--shiftcharts-motion-duration').trim() ?? '',
        bars: card.querySelectorAll('.shiftcharts-bar').length,
        arcs: card.querySelectorAll('.shiftcharts-arc').length,
        marks: card.querySelectorAll('[data-shiftcharts-mark-id]').length,
        barGeometry: bar === null ? null : [bar.getAttribute('x'), bar.getAttribute('y'), bar.getAttribute('width'), bar.getAttribute('height')],
        barTransition: bar === null ? '' : globalThis.getComputedStyle(bar).transition,
        barTransitionDuration: bar === null ? '' : globalThis.getComputedStyle(bar).transitionDuration,
        arcTransition: arc === null ? '' : globalThis.getComputedStyle(arc).transition,
        arcTransitionDuration: arc === null ? '' : globalThis.getComputedStyle(arc).transitionDuration,
      }
    }
    return {
      cards: cards.map(readCard),
      readout: globalThis.document.querySelector('.motion-comparison__readout')?.textContent?.trim() ?? '',
      overflow: Math.max(globalThis.document.documentElement.scrollWidth - globalThis.document.documentElement.clientWidth, 0),
      ghosts: globalThis.document.querySelectorAll('[data-shiftcharts-motion-ghost]').length,
      title: globalThis.document.querySelector('h1')?.textContent?.trim() ?? '',
    }
  })
}

async function setRange(page, index, value) {
  await page.locator('input[type="range"]').nth(index).evaluate((element, nextValue) => {
    const setter = Object.getOwnPropertyDescriptor(globalThis.HTMLInputElement.prototype, 'value')?.set
    setter?.call(element, String(nextValue))
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

async function assertPage(page, reducedMotion = false) {
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })

  const response = await page.goto(ORIGIN, { waitUntil: 'load' })
  if (response?.status() !== 200) errors.push(`motion route answered ${response?.status() ?? 'no response'}`)
  await page.waitForSelector('.motion-comparison__card--new-behavior', { timeout: 20_000 })
  await page.waitForTimeout(250)

  const initial = await readState(page)
  if (!initial.title.includes('Make the resize feel') || !initial.title.includes('connected to the handle.')) errors.push('motion heading is missing')
  if (initial.cards.length !== 2) errors.push(`expected 2 comparison cards, found ${initial.cards.length}`)
  if ((initial.cards[0]?.bars ?? 0) === 0 || (initial.cards[1]?.bars ?? 0) === 0) errors.push('timebar comparison has no bar geometry')
  if (initial.overflow !== 0) errors.push(`initial horizontal overflow is ${initial.overflow}px`)

  const initialGeometry = initial.cards[1]?.barGeometry
  await setRange(page, 0, 260)
  await setRange(page, 1, 180)
  await page.waitForTimeout(35)
  const preview = await readState(page)
  if (!reducedMotion && preview.cards[1]?.phase !== 'preview') errors.push('new card did not expose preview phase during resize')
  if (!reducedMotion && preview.cards[1]?.duration !== '0ms') errors.push(`preview duration was '${preview.cards[1]?.duration}', expected 0ms`)
  if (!reducedMotion && JSON.stringify(preview.cards[1]?.barGeometry) === JSON.stringify(initialGeometry)) {
    errors.push('new bar geometry did not respond during the resize preview')
  }

  await setRange(page, 0, 760)
  await setRange(page, 0, 260)
  await setRange(page, 0, 760)
  await page.waitForTimeout(reducedMotion ? 80 : 650)
  const settled = await readState(page)
  if (settled.readout.includes('260 ×')) errors.push(`latest resize was lost: ${settled.readout}`)
  if (settled.ghosts !== 0) errors.push(`${settled.ghosts} motion ghosts remained after settling`)
  if (settled.overflow !== 0) errors.push(`settled horizontal overflow is ${settled.overflow}px`)
  if (!reducedMotion && settled.cards[1]?.duration !== '460ms') errors.push(`settle duration was '${settled.cards[1]?.duration}', expected 460ms`)

  const family = page.getByRole('combobox', { name: 'Chart family' })
  await family.selectOption('line')
  await page.waitForTimeout(250)
  const line = await readState(page)
  if ((line.cards[1]?.marks ?? 0) === 0) errors.push('line comparison has no stable marks')
  await family.selectOption('donut')
  await page.waitForTimeout(250)
  const donut = await readState(page)
  if ((donut.cards[0]?.arcs ?? 0) === 0 || (donut.cards[1]?.arcs ?? 0) === 0) errors.push('donut comparison has no arc geometry')
  if (!reducedMotion) {
    await page.getByRole('button', { name: 'core', exact: true }).click()
    await page.waitForTimeout(100)
    const coreDonut = await readState(page)
    if (!coreDonut.cards[1]?.arcTransition.includes('transform')) errors.push('donut arc transform is not transition-enabled in the core path')
  }

  if (reducedMotion) {
    const animations = await page.evaluate(() => globalThis.document.getAnimations().length)
    if (animations !== 0) errors.push(`reduced-motion page has ${animations} active animations`)
    if (donut.cards[1]?.arcTransitionDuration !== '0s') {
      errors.push('reduced-motion path still reports mark transitions')
    }
  }
  return errors
}

const { browser, from } = await openChromium('motion comparison gate (sandbox)')
const server = await ensureSandboxServer().catch(async (error) => {
  await browser.close().catch(() => {})
  throw error
})
const failures = []

try {
  const movingContext = await browser.newContext({ viewport: VIEWPORT, colorScheme: 'dark' })
  const movingPage = await movingContext.newPage()
  failures.push(...(await assertPage(movingPage)))
  await movingContext.close()

  const reducedContext = await browser.newContext({ viewport: VIEWPORT, colorScheme: 'dark', reducedMotion: 'reduce' })
  const reducedPage = await reducedContext.newPage()
  failures.push(...(await assertPage(reducedPage, true)))
  await reducedContext.close()
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error))
} finally {
  server.stop()
  await browser.close()
}

if (failures.length > 0) {
  console.error(`motion comparison gate: FAILED — ${failures.length} finding(s)`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log(`motion comparison gate: PASS — ${ORIGIN} via ${from}; resize, reversal, family, fallback, and reduced-motion checks passed.`)
