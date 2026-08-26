import type { LayoutSnapshot, WidgetLayoutInput } from '@shiftcharts/core'
import { AutoChart } from '@shiftcharts/react'
import { useMemo, useState, type CSSProperties, type ReactElement } from 'react'

import { WidgetGrid, WidgetShell } from '../../../../packages/grid/src/index.ts'

type Footprint = {
  readonly label: string
  readonly w: number
  readonly h: number
}

type AncestorMode = 'flex' | 'grid'

const FOOTPRINTS: readonly Footprint[] = [
  { label: '1x1', w: 1, h: 1 },
  { label: '2x1', w: 2, h: 1 },
  { label: '3x1', w: 3, h: 1 },
  { label: '3x3', w: 3, h: 3 },
  { label: '6x5', w: 6, h: 5 },
  { label: '9x6', w: 9, h: 6 },
]

const TARGET_ID = 'target'
const IDS = [TARGET_ID, 'anchor', 'right', 'bottom', 'side'] as const
const DEFAULT_FOOTPRINT = FOOTPRINTS[3]!

const DATA = [
  {
    id: 'alpha',
    label: 'Alpha',
    points: Array.from({ length: 18 }, (_, index) => ({ x: index, y: 30 + index * 2 })),
  },
  {
    id: 'bravo',
    label: 'Bravo',
    points: Array.from({ length: 18 }, (_, index) => ({ x: index, y: 46 + (index % 5) * 3 })),
  },
  {
    id: 'gamma',
    label: 'Gamma',
    points: Array.from({ length: 18 }, (_, index) => ({ x: index, y: 62 - (index % 6) * 2 })),
  },
] as const

function layoutFor(footprint: Footprint): readonly WidgetLayoutInput[] {
  return [
    {
      id: TARGET_ID,
      x: 0,
      y: 1,
      w: footprint.w,
      h: footprint.h,
      minW: 1,
      minH: 1,
      maxW: 9,
      maxH: 6,
    },
    { id: 'anchor', x: 0, y: 0, w: 3, h: 1 },
    { id: 'right', x: 9, y: 0, w: 3, h: 1 },
    { id: 'bottom', x: 0, y: 7, w: 3, h: 2 },
    { id: 'side', x: 9, y: 7, w: 3, h: 2 },
  ]
}

function inputsFromSnapshot(snapshot: LayoutSnapshot): readonly WidgetLayoutInput[] {
  return snapshot.items.map((item) => ({
    id: item.id,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: item.minW,
    minH: item.minH,
    maxW: item.maxW,
    maxH: item.maxH,
    draggable: item.draggable,
    resizable: item.resizable,
  }))
}

export function GridFixture(): ReactElement {
  const [footprint, setFootprint] = useState<Footprint>(DEFAULT_FOOTPRINT)
  const [layout, setLayout] = useState<readonly WidgetLayoutInput[]>(layoutFor(DEFAULT_FOOTPRINT))
  const [mode, setMode] = useState<'edit' | 'read-only'>('edit')
  const [ancestor, setAncestor] = useState<AncestorMode>('flex')
  const [hidden, setHidden] = useState(false)
  const [zeroSize, setZeroSize] = useState(false)
  const [overflow, setOverflow] = useState(false)
  const [transform, setTransform] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [rtl, setRtl] = useState(false)
  const [lastEvent, setLastEvent] = useState('ready')
  const [events, setEvents] = useState<readonly string[]>(['ready'])

  const gridStyle = useMemo<CSSProperties>(
    () => ({
      width: '960px',
      ...(zeroSize ? { blockSize: 0, overflow: 'hidden' } : {}),
    }),
    [zeroSize],
  )

  function acceptSnapshot(event: string, snapshot: LayoutSnapshot): void {
    setLayout(inputsFromSnapshot(snapshot))
    setLastEvent(event)
    setEvents((current) => [...current.slice(-99), event])
  }

  function recordEvent(event: string): void {
    setLastEvent(event)
    setEvents((current) => [...current.slice(-99), event])
  }

  function chooseFootprint(next: Footprint): void {
    setFootprint(next)
    setLayout(layoutFor(next))
    recordEvent(`footprint:${next.label}`)
  }

  const ancestorStyle: CSSProperties = {
    display: ancestor,
    inlineSize: '100%',
    ...(ancestor === 'flex' ? { alignItems: 'stretch' } : { gridTemplateColumns: 'minmax(0, 1fr)' }),
    ...(zeroSize ? { blockSize: 0, minBlockSize: 0, padding: 0, overflow: 'hidden' } : {}),
  }

  return (
    <main
      className={`grid-fixture grid-fixture--${ancestor}`}
      dir={rtl ? 'rtl' : 'ltr'}
      data-shiftcharts-fixture="grid"
      data-shiftcharts-mode={mode}
      data-shiftcharts-ancestor={ancestor}
      data-shiftcharts-hidden={hidden ? 'true' : 'false'}
      data-shiftcharts-zero-size={zeroSize ? 'true' : 'false'}
      data-shiftcharts-overflow={overflow ? 'true' : 'false'}
      data-shiftcharts-transform={transform ? 'true' : 'false'}
      data-shiftcharts-zoom={zoom ? 'true' : 'false'}
      data-shiftcharts-direction={rtl ? 'rtl' : 'ltr'}
      data-shiftcharts-last-event={lastEvent}
      data-shiftcharts-events={events.join(',')}
    >
      <header className="grid-fixture__header">
        <h1>Grid browser fixture</h1>
        <p>
          Complete <code>WidgetGrid → WidgetShell → AutoChart</code> composition. The gate owns the
          input matrix; this page only exposes deterministic controls and observations.
        </p>
      </header>

      <nav className="grid-fixture__controls" aria-label="Grid fixture controls">
        <fieldset>
          <legend>Footprint</legend>
          {FOOTPRINTS.map((option) => (
            <button
              key={option.label}
              type="button"
              data-shiftcharts-footprint={option.label}
              aria-pressed={footprint.label === option.label}
              onClick={() => chooseFootprint(option)}
            >
              {option.label}
            </button>
          ))}
        </fieldset>
        <div className="grid-fixture__button-row">
          <button type="button" data-shiftcharts-mode-toggle onClick={() => setMode((current) => current === 'edit' ? 'read-only' : 'edit')}>
            mode:{mode}
          </button>
          <button type="button" data-shiftcharts-ancestor-toggle onClick={() => setAncestor((current) => current === 'flex' ? 'grid' : 'flex')}>
            ancestor:{ancestor}
          </button>
          <button type="button" data-shiftcharts-hidden-toggle onClick={() => setHidden((current) => !current)}>
            hidden:{hidden ? 'on' : 'off'}
          </button>
          <button type="button" data-shiftcharts-zero-toggle onClick={() => setZeroSize((current) => !current)}>
            zero:{zeroSize ? 'on' : 'off'}
          </button>
          <button type="button" data-shiftcharts-overflow-toggle onClick={() => setOverflow((current) => !current)}>
            overflow:{overflow ? 'on' : 'off'}
          </button>
          <button type="button" data-shiftcharts-transform-toggle onClick={() => setTransform((current) => !current)}>
            transform:{transform ? 'on' : 'off'}
          </button>
          <button type="button" data-shiftcharts-zoom-toggle onClick={() => setZoom((current) => !current)}>
            zoom:{zoom ? 'on' : 'off'}
          </button>
          <button type="button" data-shiftcharts-rtl-toggle onClick={() => setRtl((current) => !current)}>
            rtl:{rtl ? 'on' : 'off'}
          </button>
        </div>
      </nav>

      <section
        className={`grid-fixture__tab ${hidden ? 'grid-fixture__tab--hidden' : ''}`}
        hidden={hidden}
        aria-label="Visible grid tab"
        data-shiftcharts-tab="visible"
      >
        <div
          className={`grid-fixture__ancestor grid-fixture__ancestor--${ancestor}`}
          style={{ ...ancestorStyle, ...(overflow ? { overflow: 'auto' } : {}) }}
          data-shiftcharts-ancestor-box
        >
          <div
            className="grid-fixture__grid-host"
            style={{
              ...(transform ? { transform: 'scale(0.85)', transformOrigin: 'top left' } : {}),
              ...(zoom ? { zoom: 1.25 } : {}),
            }}
            data-shiftcharts-grid-host
          >
            <WidgetGrid
              layout={layout}
              width={960}
              rowHeight={64}
              margin={[12, 12]}
              mode={mode}
              style={gridStyle}
              renderItem={(item) => (
                <div className="grid-fixture__slot" data-shiftcharts-slot={item.id} data-shiftcharts-footprint={`${item.w}x${item.h}`}>
                  <WidgetShell
                    widgetId={item.id}
                    title={`${item.id} widget`}
                    context={`${item.w}×${item.h} footprint`}
                    actions={<span data-shiftcharts-grid-cancel="true">fixture</span>}
                    footer={`stable id: ${item.id}`}
                  >
                    <AutoChart
                      type="line"
                      data={DATA}
                      title={`${item.id} chart`}
                      description="Deterministic browser-gate chart."
                      gridSize={{ cols: item.w, rows: item.h }}
                      id={`fixture-${item.id}`}
                    />
                  </WidgetShell>
                  {item.id === TARGET_ID ? (
                    <div
                      className="grid-fixture__pointer-handle"
                      data-shiftcharts-drag-handle="fixture"
                      data-shiftcharts-pointer-handle
                      aria-hidden="true"
                    >
                      drag
                    </div>
                  ) : null}
                </div>
              )}
              onLayoutChange={(snapshot) => acceptSnapshot('layout-change', snapshot)}
              onLayoutCommit={(snapshot) => acceptSnapshot('layout-commit', snapshot)}
              onLayoutCancel={(snapshot) => acceptSnapshot('layout-cancel', snapshot)}
              onDragStart={() => recordEvent('drag-start')}
              onDragStop={() => recordEvent('drag-stop')}
              onResizeStart={() => recordEvent('resize-start')}
              onResizeStop={() => recordEvent('resize-stop')}
            />
          </div>
        </div>
      </section>

      <section className="grid-fixture__tab grid-fixture__tab--hidden" hidden={!hidden} aria-label="Hidden grid tab" data-shiftcharts-tab="hidden">
        <p>Hidden grid tab. Toggle the hidden control to mount the dashboard again.</p>
      </section>

      <output className="grid-fixture__status" data-shiftcharts-status>
        event:{lastEvent} · footprint:{footprint.label} · ids:{IDS.join(',')}
      </output>
    </main>
  )
}
