import type { LayoutSnapshot, WidgetLayoutInput } from '@gx/core'
import { AutoChart } from '@gx/react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react'

import { WidgetGrid, WidgetShell } from '../../../../packages/grid/src/index.ts'

const STRESS_COUNTS = [1, 10, 50, 100, 200] as const
const GRID_WIDTH = 1200
const GRID_COLUMNS = 12
const COLUMNS_PER_WIDGET = 3
const WIDGET_ROWS = 2
const WIDGETS_PER_ROW = GRID_COLUMNS / COLUMNS_PER_WIDGET

const DATA = [
  {
    id: 'stress-series',
    label: 'Stress',
    points: [
      { x: 0, y: 18 },
      { x: 1, y: 24 },
      { x: 2, y: 21 },
      { x: 3, y: 29 },
    ],
  },
] as const

type PendingMeasurement = {
  readonly count: number
  readonly requestedAt: number
  readonly resolve: (measurement: StressMeasurement) => void
  readonly reject: (error: Error) => void
}

export type StressMeasurement = {
  readonly count: number
  readonly requestedAt: number
  readonly committedAt: number
  readonly layoutAt: number
  readonly commitLatencyMs: number
  readonly layoutLatencyMs: number
  readonly totalLatencyMs: number
  readonly domItemCount: number
  readonly rootScrollHeight: number
}

type StressMetrics = {
  layoutChangeCount: number
  layoutCommitCount: number
  identityFailureCount: number
  callbackItemCounts: number[]
}

export type StressMetricsSnapshot = {
  readonly layoutChangeCount: number
  readonly layoutCommitCount: number
  readonly identityFailureCount: number
  readonly callbackItemCounts: readonly number[]
}

export type GridStressApi = {
  readonly setWidgetCount: (count: number) => Promise<StressMeasurement>
  readonly resetMetrics: () => void
  readonly readMetrics: () => StressMetricsSnapshot
}

declare global {
  interface Window {
    __gxStress?: GridStressApi
  }
}

function widgetId(index: number): string {
  return `stress-${String(index).padStart(4, '0')}`
}

function layoutFor(count: number): readonly WidgetLayoutInput[] {
  return Array.from({ length: count }, (_, index) => ({
    id: widgetId(index),
    x: (index % WIDGETS_PER_ROW) * COLUMNS_PER_WIDGET,
    y: Math.floor(index / WIDGETS_PER_ROW) * WIDGET_ROWS,
    w: COLUMNS_PER_WIDGET,
    h: WIDGET_ROWS,
    minW: COLUMNS_PER_WIDGET,
    minH: WIDGET_ROWS,
    maxW: COLUMNS_PER_WIDGET,
    maxH: WIDGET_ROWS,
  }))
}

function layoutFingerprint(layout: readonly WidgetLayoutInput[]): string {
  let hash = 2_166_136_261
  const source = layout.map((item) => `${item.id}:${item.x},${item.y},${item.w},${item.h}`).join('|')
  for (const character of source) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16_777_619)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}-${layout.length}`
}

function emptyMetrics(): StressMetrics {
  return {
    layoutChangeCount: 0,
    layoutCommitCount: 0,
    identityFailureCount: 0,
    callbackItemCounts: [],
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

function snapshotIsStable(snapshot: LayoutSnapshot, count: number): boolean {
  if (snapshot.items.length !== count) return false
  const expected = new Set(Array.from({ length: count }, (_, index) => widgetId(index)))
  const actual = new Set(snapshot.items.map((item) => item.id))
  return actual.size === expected.size && snapshot.items.every((item) => expected.has(item.id))
}

export function GridStressFixture(): ReactElement {
  const [count, setCount] = useState(0)
  const [revision, setRevision] = useState(0)
  const countRef = useRef(count)
  countRef.current = count
  const metricsRef = useRef<StressMetrics>(emptyMetrics())
  const pendingRef = useRef<PendingMeasurement | null>(null)
  const layout = useMemo(() => layoutFor(count), [count])
  const fingerprint = useMemo(() => layoutFingerprint(layout), [layout])

  const recordSnapshot = useCallback((kind: 'change' | 'commit', snapshot: LayoutSnapshot) => {
    const metrics = metricsRef.current
    if (kind === 'change') metrics.layoutChangeCount += 1
    if (kind === 'commit') metrics.layoutCommitCount += 1
    metrics.callbackItemCounts.push(snapshot.items.length)
    if (!snapshotIsStable(snapshot, countRef.current)) metrics.identityFailureCount += 1
  }, [])

  const resetMetrics = useCallback(() => {
    metricsRef.current = emptyMetrics()
  }, [])

  const readMetrics = useCallback((): StressMetricsSnapshot => {
    const metrics = metricsRef.current
    return {
      layoutChangeCount: metrics.layoutChangeCount,
      layoutCommitCount: metrics.layoutCommitCount,
      identityFailureCount: metrics.identityFailureCount,
      callbackItemCounts: [...metrics.callbackItemCounts],
    }
  }, [])

  const setWidgetCount = useCallback((nextCount: number): Promise<StressMeasurement> => {
    if (!Number.isInteger(nextCount) || nextCount < 0 || nextCount > 200) {
      return Promise.reject(new Error(`widget count must be an integer from 0 to 200, got ${nextCount}`))
    }
    if (pendingRef.current !== null) {
      return Promise.reject(new Error('a widget-count measurement is already pending'))
    }
    return new Promise((resolve, reject) => {
      pendingRef.current = { count: nextCount, requestedAt: performance.now(), resolve, reject }
      setCount(nextCount)
      if (countRef.current === nextCount) setRevision((current) => current + 1)
    })
  }, [])

  useLayoutEffect(() => {
    const pending = pendingRef.current
    if (pending === null || pending.count !== count) return
    const committedAt = performance.now()
    let frames = 0

    const finish = () => {
      frames += 1
      if (frames < 3) {
        requestAnimationFrame(finish)
        return
      }
      try {
        const root = document.querySelector('[data-gx-stress="grid"]')
        if (root === null) throw new Error('stress fixture root is missing')
        const items = Array.from(root.querySelectorAll('[data-gx-stress-slot]'))
        let rootScrollHeight = root.scrollHeight
        for (const item of items) {
          // Reading every border box makes this a layout-complete sample rather than a React
          // commit timestamp that could precede the browser's actual grid positioning pass.
          item.getBoundingClientRect()
        }
        rootScrollHeight = root.scrollHeight
        const layoutAt = performance.now()
        const measurement: StressMeasurement = {
          count,
          requestedAt: round(pending.requestedAt),
          committedAt: round(committedAt),
          layoutAt: round(layoutAt),
          commitLatencyMs: round(committedAt - pending.requestedAt),
          layoutLatencyMs: round(layoutAt - committedAt),
          totalLatencyMs: round(layoutAt - pending.requestedAt),
          domItemCount: items.length,
          rootScrollHeight,
        }
        pendingRef.current = null
        pending.resolve(measurement)
      } catch (error) {
        pendingRef.current = null
        pending.reject(error instanceof Error ? error : new Error(String(error)))
      }
    }

    requestAnimationFrame(finish)
  }, [count, revision])

  useEffect(() => {
    const api: GridStressApi = { setWidgetCount, resetMetrics, readMetrics }
    window.__gxStress = api
    return () => {
      if (window.__gxStress === api) delete window.__gxStress
    }
  }, [readMetrics, resetMetrics, setWidgetCount])

  const rootStyle = useMemo<CSSProperties>(() => ({ inlineSize: `${GRID_WIDTH}px` }), [])

  return (
    <main
      data-gx-stress="grid"
      data-gx-stress-count={count}
      data-gx-stress-ready="true"
      data-gx-stress-input-fingerprint={fingerprint}
      data-gx-stress-supported-counts={STRESS_COUNTS.join(',')}
      style={rootStyle}
    >
      <WidgetGrid
        layout={layout}
        width={GRID_WIDTH}
        rowHeight={48}
        margin={[8, 8]}
        mode="read-only"
        className="gx-grid-stress__grid"
        renderItem={(item) => (
          <div className="gx-grid-stress__slot" data-gx-stress-slot={item.id}>
            <WidgetShell
              widgetId={item.id}
              title={item.id}
              context={`${item.w}×${item.h}`}
              footer="C4.2 stress fixture"
            >
              <AutoChart
                type="line"
                data={DATA}
                title={`${item.id} stress chart`}
                description="Deterministic grid stress chart."
                gridSize={{ cols: item.w, rows: item.h }}
                id={`stress-${item.id}`}
              />
            </WidgetShell>
          </div>
        )}
        onLayoutChange={(snapshot) => recordSnapshot('change', snapshot)}
        onLayoutCommit={(snapshot) => recordSnapshot('commit', snapshot)}
      />
    </main>
  )
}
