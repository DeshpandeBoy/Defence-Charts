import { mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/* eslint-disable no-undef -- DOM globals below are serialized into Playwright page callbacks. */

import { openChromium } from './check-containment.mjs'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const ORIGIN = process.env.GX_FAMILY_MATRIX_ORIGIN ?? 'http://127.0.0.1:5186/'
const RESULT_PATH = fileURLToPath(new URL('./results/d0.2-family-matrix.latest.json', import.meta.url))
const SCREENSHOT_PATH = fileURLToPath(new URL('./results/d0.2-family-matrix.latest.png', import.meta.url))
const EXPECTED_RUNGS = ['micro', 'tile', 'strip', 'panel', 'canvas', 'stage']
const EXPECTED_IDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot']

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
      'src/family-matrix-fixture.vite.ts',
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
      // The child already exited; no process group remains to stop.
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
  throw new Error('family matrix fixture never answered on ' + ORIGIN + ' within 60s')
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  }))
}

function captureErrors(page) {
  const errors = { console: [], page: [], resizeObserver: [] }
  page.on('console', (message) => {
    if (message.type() === 'error') errors.console.push(message.text())
    if (/resizeobserver loop/i.test(message.text())) errors.resizeObserver.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.page.push(String(error))
    if (/resizeobserver loop/i.test(String(error))) errors.resizeObserver.push(String(error))
  })
  return errors
}

async function openFixture(page) {
  await page.goto(ORIGIN, { waitUntil: 'load' })
  await page.waitForSelector('[data-family-matrix]')
  await page.waitForSelector('[data-family-case="line-stage"] svg[role="graphics-document"]')
  await page.waitForSelector('[data-family-case="bar-stage"] .gx-bar')
  await page.waitForSelector('[data-family-case="scatter-stage"] .gx-scatter-point')
  await page.waitForSelector('[data-family-case="donut-stage"] .gx-arc')
  await page.waitForSelector('[data-family-case="kpi-stage"] .gx-value')
  await page.waitForSelector('[data-family-case="progress-stage"] .gx-progress')
  await page.waitForSelector('[data-family-case="heatmap-stage"] .gx-heatmap-cell')
  await page.waitForSelector('[data-family-case="funnel-stage"] .gx-funnel-stage')
  await page.waitForSelector('[data-family-resize-probe] .gx-auto-chart .gx-chart')
  await settle(page)
}

async function runStaticMatrix(page) {
  const observed = await page.locator('[data-family-case]').evaluateAll((cards) => cards.map((card) => ({
    caseId: card.getAttribute('data-family-case'),
    type: card.getAttribute('data-family-type'),
    rung: card.getAttribute('data-family-rung'),
    sizeClass: card.getAttribute('data-plan-size-class'),
    mark: card.getAttribute('data-plan-mark'),
    area: card.getAttribute('data-plan-area'),
    interaction: card.getAttribute('data-plan-interaction'),
    tooltip: card.getAttribute('data-plan-tooltip'),
    legend: card.getAttribute('data-plan-legend'),
    legendToggle: card.getAttribute('data-plan-legend-toggle'),
    motionStages: card.getAttribute('data-plan-motion-stages'),
    persistGridlines: card.getAttribute('data-plan-persist-gridlines'),
    y2: card.getAttribute('data-plan-y2'),
    facet: card.getAttribute('data-plan-facet'),
    svg: card.querySelector('svg[role="graphics-document"]') !== null,
    title: card.querySelector('svg title') !== null,
    interactionMarkup: card.querySelector('.gx-interaction') !== null,
    bars: card.querySelectorAll('.gx-bar').length,
    scatterPoints: card.querySelectorAll('.gx-scatter-point').length,
    arcs: card.querySelectorAll('.gx-arc').length,
    otherArcs: card.querySelectorAll('.gx-arc--other').length,
    progress: card.querySelectorAll('.gx-progress').length,
    progressFills: card.querySelectorAll('.gx-progress__fill').length,
    progressStates: card.querySelectorAll('.gx-progress__state').length,
    progressValue: card.querySelectorAll('.gx-progress__value').length,
    progressValueText: card.querySelector('.gx-progress__value')?.textContent?.trim() ?? null,
    progressOrientation: card.querySelector('.gx-progress')?.getAttribute('data-progress-orientation') ?? null,
    heatmapCells: card.querySelectorAll('.gx-heatmap-cell').length,
    heatmapMissing: card.querySelectorAll('.gx-heatmap-cell[data-heatmap-state="missing"]').length,
    heatmapIntensity: card.querySelectorAll('.gx-heatmap-cell[data-heatmap-intensity]').length,
    heatmapLegendItems: card.querySelectorAll('[data-legend-family="heatmap"] [data-heatmap-intensity]').length,
    heatmapLegendText: card.querySelector('[data-legend-family="heatmap"]')?.textContent?.trim() ?? null,
    yAxisLabels: [...card.querySelectorAll('.gx-axis--y .gx-axis__tick-label')].map((label) => label.textContent?.trim() ?? ''),
    funnelStages: card.querySelectorAll('.gx-funnel-stage').length,
    funnelLabels: card.querySelectorAll('.gx-funnel-stage__text').length,
    funnelValues: card.querySelectorAll('[data-funnel-stage-value]').length,
    funnelDropoffs: card.querySelectorAll('[data-funnel-stage-dropoff]').length,
    funnelSummary: card.querySelectorAll('[data-funnel-part="summary"]').length,
    valueUnits: card.querySelectorAll('.gx-value__unit').length,
    valueTargets: card.querySelectorAll('.gx-value__target').length,
    valueStatuses: card.querySelectorAll('.gx-value__status').length,
    valueProgress: card.querySelectorAll('.gx-value__progress').length,
    valueText: card.querySelector('.gx-value')?.textContent?.trim() ?? null,
    compactKeyLabels: [...card.querySelectorAll('.gx-compact-key__label')].map((label) => label.textContent?.trim() ?? ''),
    legendFamily: card.querySelector('[data-legend-family]')?.getAttribute('data-legend-family') ?? null,
    legendLabels: [...card.querySelectorAll('[data-legend-family] .gx-legend__label')].map((label) => label.textContent?.trim() ?? ''),
    tableMetricHeaders: card.querySelectorAll('.gx-data-table__table th').length,
    tableHasProgressSemantics: [...card.querySelectorAll('.gx-data-table__table th')].some((header) =>
      ['Remaining', 'Over target', 'Progress state'].includes(header.textContent?.trim() ?? '')),
    seriesIds: [...card.querySelectorAll('.gx-series[data-series-id]')].map((series) => series.getAttribute('data-series-id')),
  })))

  if (observed.length !== 60) throw new Error('expected 60 line/area/bar/timebar/scatter/donut/kpi/progress/heatmap/funnel cards, got ' + observed.length)
  for (const type of ['line', 'area', 'bar', 'timebar', 'scatter', 'donut', 'kpi', 'progress', 'heatmap', 'funnel']) {
    const rows = observed.filter((card) => card.type === type)
    if (JSON.stringify(rows.map((card) => card.rung)) !== JSON.stringify(EXPECTED_RUNGS)) {
      throw new Error(type + ' ladder order changed: ' + JSON.stringify(rows.map((card) => card.rung)))
    }
  }
  for (const card of observed) {
    if (!card.svg || !card.title || card.interactionMarkup) {
      throw new Error('static accessibility/interaction contract failed: ' + JSON.stringify(card))
    }
    const expectedSeriesIds = card.type === 'donut' ? ['donut'] : card.type === 'kpi' ? ['kpi'] : card.type === 'progress' ? ['progress'] : card.type === 'heatmap' ? ['heatmap-maintenance', 'heatmap-inspection'] : card.type === 'funnel' ? ['funnel'] : EXPECTED_IDS
    if (JSON.stringify(card.seriesIds) !== JSON.stringify(expectedSeriesIds)) {
      throw new Error('static series identity changed for ' + card.caseId + ': ' + JSON.stringify(card.seriesIds))
    }
    if (card.type === 'area' && card.rung !== 'micro' && card.area !== 'true') {
      throw new Error('area mark metadata missing for ' + card.caseId)
    }
    if ((card.type === 'bar' || card.type === 'timebar') && card.rung !== 'micro') {
      if (card.mark !== 'bar' || card.bars === 0) {
        throw new Error('bar geometry missing for ' + card.caseId + ': ' + JSON.stringify(card))
      }
    }
    if (card.type === 'scatter' && card.rung !== 'micro') {
      if (card.mark !== 'point' || card.scatterPoints === 0) {
        throw new Error('scatter geometry missing for ' + card.caseId + ': ' + JSON.stringify(card))
      }
    }
    if (card.type === 'donut' && card.rung !== 'micro') {
      if (card.mark !== 'arc' || card.arcs === 0) {
        throw new Error('donut geometry missing for ' + card.caseId + ': ' + JSON.stringify(card))
      }
      if ((card.rung === 'canvas' || card.rung === 'stage') && card.otherArcs === 0) {
        throw new Error('donut Other bucket missing for ' + card.caseId + ': ' + JSON.stringify(card))
      }
      if ((card.rung === 'micro' || card.rung === 'tile') && !card.valueText?.includes('107 total')) {
        throw new Error('donut aggregate value is not readable for ' + card.caseId + ': ' + JSON.stringify(card))
      }
      if (card.rung === 'panel' &&
        (card.compactKeyLabels.length === 0 || card.compactKeyLabels.includes('Program mix'))) {
        throw new Error('donut panel key lost slice identity for ' + card.caseId + ': ' + JSON.stringify(card))
      }
      if ((card.rung === 'canvas' || card.rung === 'stage') &&
        (card.legendFamily !== 'donut' || card.legendLabels.length === 0 || !card.legendLabels.includes('Other'))) {
        throw new Error('donut external slice legend missing for ' + card.caseId + ': ' + JSON.stringify(card))
      }
    }
    if (card.type === 'kpi') {
      if (card.rung === 'micro' && card.mark !== 'none') {
        throw new Error('KPI Micro did not replace the plot with its value: ' + JSON.stringify(card))
      }
      if (card.rung !== 'micro' && (card.mark !== 'line' || card.valueUnits === 0 || card.valueTargets === 0 || card.valueStatuses === 0)) {
        throw new Error('KPI metadata or line composition missing for ' + card.caseId + ': ' + JSON.stringify(card))
      }
    }
    if (card.type === 'progress') {
      if (card.mark !== 'progress' || card.progress !== 1 || card.progressFills !== 1) {
        throw new Error('progress geometry missing for ' + card.caseId + ': ' + JSON.stringify(card))
      }
      const radial = card.rung === 'micro' || card.rung === 'tile'
      if (card.progressOrientation !== (radial ? 'radial' : 'horizontal')) {
        throw new Error('Progress orientation missing for ' + card.caseId + ': ' + JSON.stringify(card))
      }
      if (card.rung === 'micro' && (card.progressValue !== 1 || card.progressValueText !== '74%')) {
        throw new Error('Progress Micro value is not readable inside the ring: ' + JSON.stringify(card))
      }
      if (card.rung !== 'micro' && card.valueProgress === 0) {
        throw new Error('Progress value semantics missing for ' + card.caseId + ': ' + JSON.stringify(card))
      }
      if (!card.tableHasProgressSemantics) {
        throw new Error('Progress table semantics missing for ' + card.caseId + ': ' + JSON.stringify(card))
      }
      if (radial && card.progressStates !== 0) {
        throw new Error('Progress normal radial fixture unexpectedly emitted state text: ' + JSON.stringify(card))
      }
    }
    if (card.type === 'heatmap') {
      const compact = card.rung === 'micro' || card.rung === 'tile'
      if (card.mark !== (compact ? 'none' : 'cell')) {
        throw new Error('heatmap mark substitution missing for ' + card.caseId + ': ' + JSON.stringify(card))
      }
      if (compact && card.heatmapCells !== 0) {
        throw new Error('heatmap compact rung should replace cells with a total: ' + JSON.stringify(card))
      }
      if (!compact && (card.heatmapCells === 0 || card.heatmapIntensity === 0)) {
        throw new Error('heatmap cell/intensity geometry missing for ' + card.caseId + ': ' + JSON.stringify(card))
      }
      if (['panel', 'canvas', 'stage'].includes(card.rung) &&
        (!card.yAxisLabels.includes('Maintenance') || !card.yAxisLabels.includes('Inspection'))) {
        throw new Error('heatmap row labels are not readable for ' + card.caseId + ': ' + JSON.stringify(card))
      }
      if ((card.rung === 'canvas' || card.rung === 'stage') &&
        (card.heatmapLegendItems !== 5 || card.legendFamily !== 'heatmap' ||
          !card.heatmapLegendText?.includes('Low') || !card.heatmapLegendText.includes('High'))) {
        throw new Error('heatmap intensity legend missing for ' + card.caseId + ': ' + JSON.stringify(card))
      }
      if (card.rung === 'panel' && card.heatmapMissing === 0) {
        throw new Error('heatmap missing-cell semantics missing for ' + card.caseId + ': ' + JSON.stringify(card))
      }
    }
    if (card.type === 'funnel') {
      const compact = card.rung === 'micro' || card.rung === 'tile'
      if (card.mark !== (card.rung === 'micro' ? 'none' : 'funnel')) {
        throw new Error('funnel mark substitution missing for ' + card.caseId + ': ' + JSON.stringify(card))
      }
      if (compact && card.funnelStages !== 0) {
        throw new Error('funnel Micro should replace the plot with a summary: ' + JSON.stringify(card))
      }
      if (card.rung === 'tile' && card.funnelSummary !== 1) {
        throw new Error('funnel Tile summary missing: ' + JSON.stringify(card))
      }
      if (!compact && (card.funnelStages === 0 || card.funnelLabels === 0 || card.funnelValues === 0)) {
        throw new Error('funnel stage/value semantics missing for ' + card.caseId + ': ' + JSON.stringify(card))
      }
      if (card.rung === 'canvas' && card.funnelDropoffs === 0) {
        throw new Error('funnel Canvas drop-off semantics missing for ' + card.caseId + ': ' + JSON.stringify(card))
      }
      if (card.rung === 'stage' && card.funnelDropoffs === 0) {
        throw new Error('funnel Stage conversion semantics missing for ' + card.caseId + ': ' + JSON.stringify(card))
      }
    }
  }
  return observed
}

async function runVisualInformation(browser, label, viewport) {
  // Capture the settled geometry. Motion has its own browser/media gate; this report is about
  // the resting information surface, so transitions must not make a transient frame look like
  // a clipping defect.
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = captureErrors(page)
  try {
    await openFixture(page)
    const report = await page.locator('[data-family-case]').evaluateAll((cards) => {
      const epsilon = 8
      const visible = (element) => {
        const style = getComputedStyle(element)
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
        const rect = element.getBoundingClientRect()
        return rect.width > 0 || rect.height > 0
      }
      const snapshot = (rect) => ({
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      })
      const overlap = (a, b) =>
        Math.min(a.right, b.right) - Math.max(a.left, b.left) > epsilon &&
        Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > epsilon
      const nodes = 'svg text, svg path, svg rect, svg circle, svg line, svg polygon'

      return cards.map((card) => {
        const cardRect = card.getBoundingClientRect()
        const summary = card.querySelector('.gx-data-table__summary')
        const summaryRect = summary !== null && visible(summary) ? summary.getBoundingClientRect() : null
        const chartNodes = [...card.querySelectorAll(nodes)].filter(visible)
        const outOfCard = chartNodes
          .map((element) => ({ element, rect: element.getBoundingClientRect() }))
          .filter(({ rect }) =>
            rect.left < cardRect.left - epsilon ||
            rect.right > cardRect.right + epsilon ||
            rect.top < cardRect.top - epsilon ||
            rect.bottom > cardRect.bottom + epsilon)
          .map(({ element, rect }) => ({
            tag: element.tagName.toLowerCase(),
            className: element.getAttribute('class') ?? '',
            text: element.textContent?.trim() ?? '',
            rect: snapshot(rect),
          }))
        const summaryNodes = [...card.querySelectorAll('svg text')].filter(visible)
        const summaryOverlaps = summaryRect === null
          ? []
          : summaryNodes
            .map((element) => ({ element, rect: element.getBoundingClientRect() }))
            .filter(({ rect }) => overlap(rect, summaryRect))
            .map(({ element, rect }) => ({
              tag: element.tagName.toLowerCase(),
              className: element.getAttribute('class') ?? '',
              text: element.textContent?.trim() ?? '',
              rect: snapshot(rect),
            }))
        return {
          caseId: card.getAttribute('data-family-case'),
          type: card.getAttribute('data-family-type'),
          rung: card.getAttribute('data-family-rung'),
          card: snapshot(cardRect),
          chartTextCount: card.querySelectorAll('svg text').length,
          outOfCard,
          summaryOverlaps,
        }
      })
    })
    const outOfCard = report.flatMap((card) => card.outOfCard.length > 0 ? [
      { caseId: card.caseId, nodes: card.outOfCard },
    ] : [])
    const summaryOverlaps = report.flatMap((card) => card.summaryOverlaps.length > 0 ? [
      { caseId: card.caseId, nodes: card.summaryOverlaps },
    ] : [])
    if (outOfCard.length > 0 || summaryOverlaps.length > 0) {
      throw new Error(label + ' chart information containment failed: ' + JSON.stringify({ outOfCard, summaryOverlaps }))
    }
    // Shape-only Strip cards intentionally carry their readable legend outside the SVG. The
    // static matrix above verifies those HTML channels, so this gate requires complete card
    // geometry rather than incorrectly requiring every SVG to contain text.
    if (report.length !== 60 || report.some((card) =>
      card.card.width <= 0 ||
      card.card.height <= 0 ||
      !Number.isFinite(card.card.left) ||
      !Number.isFinite(card.card.top))) {
      throw new Error(label + ' chart information report is incomplete: ' + JSON.stringify(report))
    }
    if (errors.console.length > 0 || errors.page.length > 0 || errors.resizeObserver.length > 0) {
      throw new Error(label + ' visual information runtime errors: ' + JSON.stringify(errors))
    }
    return {
      viewport,
      cards: report.length,
      textBearingCards: report.filter((card) => card.chartTextCount > 0).length,
      outOfCard,
      summaryOverlaps,
    }
  } finally {
    await context.close().catch(() => {})
  }
}

async function runStates(page) {
  const observed = await page.locator('[data-family-state]').evaluateAll((states) => states.map((state) => ({
    state: state.getAttribute('data-family-state'),
    chart: state.querySelector('svg[role="graphics-document"]') !== null,
    seriesCount: state.querySelectorAll('.gx-series[data-series-id]').length,
    alert: state.querySelector('[role="alert"]') !== null,
    text: state.textContent?.trim() ?? '',
  })))

  const byState = new Map(observed.map((state) => [state.state, state]))
  if (!byState.get('normal')?.chart) throw new Error('normal state lost its static chart')
  if (!byState.get('empty')?.chart || byState.get('empty')?.seriesCount !== 0) {
    throw new Error('empty state did not render an accessible empty chart')
  }
  if (!byState.get('error')?.alert) throw new Error('error state lost its host-owned alert')
  return observed
}

async function runTheme(page) {
  const before = await page.evaluate(() => {
    const root = document.querySelector('[data-family-matrix]')
    return {
      theme: root?.getAttribute('data-gx-theme'),
      surface: root === null ? '' : getComputedStyle(root).backgroundColor,
      text: root === null ? '' : getComputedStyle(root).color,
    }
  })
  await page.locator('[data-family-theme-toggle]').click()
  await page.waitForFunction(() => document.querySelector('[data-family-matrix]')?.getAttribute('data-gx-theme') === 'neutral-light')
  const light = await page.evaluate(() => {
    const root = document.querySelector('[data-family-matrix]')
    return {
      theme: root?.getAttribute('data-gx-theme'),
      surface: root === null ? '' : getComputedStyle(root).backgroundColor,
      text: root === null ? '' : getComputedStyle(root).color,
    }
  })
  if (before.theme !== 'neutral' || light.theme !== 'neutral-light' || before.surface === light.surface) {
    throw new Error('dark/light theme contract failed: ' + JSON.stringify({ before, light }))
  }
  await page.locator('[data-family-theme-toggle]').click()
  return { before, light }
}

async function probe(page) {
  return page.locator('[data-family-resize-probe]').evaluate((probe) => ({
    width: Math.round(probe.getBoundingClientRect().width),
    height: Math.round(probe.getBoundingClientRect().height),
    sizeClass: probe.querySelector('.gx-chart')?.getAttribute('data-size-class') ?? null,
    seriesIds: [...probe.querySelectorAll('.gx-series[data-series-id]')].map((series) => series.getAttribute('data-series-id')),
  }))
}

async function setProbe(page, width, height, expectedClass) {
  await page.evaluate(({ nextWidth, nextHeight }) => {
    const probe = document.querySelector('[data-family-resize-probe]')
    if (probe === null) throw new Error('resize probe missing')
    probe.style.width = nextWidth + 'px'
    probe.style.height = nextHeight + 'px'
  }, { nextWidth: width, nextHeight: height })
  await page.waitForFunction((sizeClass) => document.querySelector('[data-family-resize-probe] .gx-chart')?.getAttribute('data-size-class') === sizeClass, expectedClass)
  await settle(page)
  return probe(page)
}

async function runResize(page) {
  const samples = []
  let previous = await probe(page)
  if (previous.sizeClass !== 'panel') throw new Error('resize probe did not start at Panel: ' + JSON.stringify(previous))

  for (const sample of [
    { width: 610, height: 510, sizeClass: 'canvas' },
    { width: 930, height: 630, sizeClass: 'stage' },
    { width: 890, height: 590, sizeClass: 'canvas' },
    { width: 590, height: 490, sizeClass: 'panel' },
    { width: 390, height: 290, sizeClass: 'strip' },
    { width: 290, height: 90, sizeClass: 'tile' },
    { width: 190, height: 90, sizeClass: 'micro' },
    { width: 610, height: 510, sizeClass: 'canvas' },
  ]) {
    const next = await setProbe(page, sample.width, sample.height, sample.sizeClass)
    if (next.sizeClass !== sample.sizeClass) {
      throw new Error('resize boundary class mismatch: ' + JSON.stringify({ sample, next }))
    }
    if (JSON.stringify(next.seriesIds) !== JSON.stringify(previous.seriesIds)) {
      throw new Error('resize changed stable series identity: ' + JSON.stringify({ previous, next }))
    }
    samples.push({ requested: sample, observed: next })
    previous = next
  }
  return { start: samples[0]?.observed ?? null, samples }
}

async function runMedia(browser, label, options) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1100 }, ...options })
  const page = await context.newPage()
  const errors = captureErrors(page)
  try {
    await openFixture(page)
    const observed = await page.evaluate(() => {
      const chart = document.querySelector('[data-family-case="line-stage"]')
      const root = document.querySelector('[data-family-matrix]')
      const line = chart?.querySelector('.gx-line')
      const card = chart
      return {
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        forcedColors: window.matchMedia('(forced-colors: active)').matches,
        transitionDuration: line === null ? '' : getComputedStyle(line).transitionDuration,
        background: card === null ? '' : getComputedStyle(card).backgroundColor,
        border: card === null ? '' : getComputedStyle(card).borderTopColor,
        rootBackground: root === null ? '' : getComputedStyle(root).backgroundColor,
      }
    })
    if (label === 'reduced-motion' && (!observed.reducedMotion || observed.transitionDuration !== '0s')) {
      throw new Error('reduced-motion contract failed: ' + JSON.stringify(observed))
    }
    if (label === 'forced-colors' && (!observed.forcedColors || observed.background === '' || observed.border === '')) {
      throw new Error('forced-colors contract failed: ' + JSON.stringify(observed))
    }
    if (errors.console.length > 0 || errors.page.length > 0) {
      throw new Error(label + ' runtime errors: ' + JSON.stringify(errors))
    }
    return observed
  } finally {
    await context.close().catch(() => {})
  }
}

async function runGate() {
  const { browser, from } = await openChromium('D0.2 family matrix browser')
  const server = await ensureServer().catch(async (error) => {
    await browser.close().catch(() => {})
    throw error
  })
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } })
  const errors = captureErrors(page)
  try {
    await openFixture(page)
    const staticMatrix = await runStaticMatrix(page)
    const visualDesktop = await runVisualInformation(browser, 'desktop', { width: 1440, height: 1100 })
    const visualNarrow = await runVisualInformation(browser, 'narrow', { width: 390, height: 844 })
    const states = await runStates(page)
    const theme = await runTheme(page)
    const resize = await runResize(page)
    const screenshot = await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true })
    void screenshot
    const reducedMotion = await runMedia(browser, 'reduced-motion', { reducedMotion: 'reduce' })
    const forcedColors = await runMedia(browser, 'forced-colors', { forcedColors: 'active' })
    if (errors.console.length > 0 || errors.page.length > 0 || errors.resizeObserver.length > 0) {
      throw new Error('family matrix runtime errors: ' + JSON.stringify(errors))
    }
    return {
      status: 'pass',
      fixture: 'apps/playground/src/family-matrix-fixture/',
      origin: ORIGIN,
      browser: browser.version(),
      playwrightFrom: from,
      cards: staticMatrix.length,
      visualInformation: { desktop: visualDesktop, narrow: visualNarrow },
      states,
      theme,
      resize,
      reducedMotion,
      forcedColors,
      screenshot: SCREENSHOT_PATH,
      runtimeErrors: errors,
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
  console.log('D7.1 complete family matrix: Chromium passed — ten family rungs, static a11y, states, themes, media, resize identity, and screenshot evidence ' + RESULT_PATH)
} catch (error) {
  console.error('D0.2 family matrix: FAILED — ' + (error instanceof Error ? error.message : String(error)))
  process.exitCode = 1
}
