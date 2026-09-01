/**
 * Capture the durable old/new visual fixtures used by the resize-motion handoff.
 * The sandbox server must already be running, so this command never starts or stops a user's
 * development server.
 */

import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { openChromium } from './check-containment.mjs'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const ARTIFACT_DIR = `${REPO_ROOT}/research/assets/motion`
const ORIGIN = process.env.SHIFTCHARTS_MOTION_ORIGIN ?? 'http://localhost:5176/motion'

await mkdir(ARTIFACT_DIR, { recursive: true })
const { browser } = await openChromium('motion comparison screenshots')
const context = await browser.newContext({ viewport: { width: 1680, height: 1200 }, colorScheme: 'dark' })
const page = await context.newPage()

try {
  const response = await page.goto(ORIGIN, { waitUntil: 'load' })
  if (response?.status() !== 200) throw new Error(`motion route answered ${response?.status() ?? 'no response'}`)
  await page.waitForSelector('.motion-comparison__card--new-behavior', { timeout: 20_000 })

  for (const family of ['timebar', 'line', 'donut']) {
    await page.getByRole('combobox', { name: 'Chart family' }).selectOption(family)
    await page.waitForTimeout(350)
    await page.locator('.motion-comparison__card--current-behavior').screenshot({
      path: `${ARTIFACT_DIR}/${family}-current.png`,
    })
    await page.locator('.motion-comparison__card--new-behavior').screenshot({
      path: `${ARTIFACT_DIR}/${family}-cinematic.png`,
    })
  }
} finally {
  await context.close()
  await browser.close()
}

console.log(`motion comparison screenshots: saved timebar, line, and donut old/new cards under ${ARTIFACT_DIR}`)
