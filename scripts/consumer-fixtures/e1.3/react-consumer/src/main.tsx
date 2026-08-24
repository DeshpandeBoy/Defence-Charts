import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { describeShape, planChart, sizeContextFromPixels, type Series } from '@gx/core'
import { GRID_COLUMNS } from '@gx/grid'
import { Chart } from '@gx/primitives'
import { AutoChart } from '@gx/react'
import { FakeResizeObserver } from '@gx/testing'
import '@gx/grid/keyboard-grid.css'
import '@gx/grid/widget-shell.css'
import '@gx/grid/widget-states.css'
import '@gx/primitives/chart.css'
import '@gx/react/auto-chart.css'
import '@gx/react/interaction-overlay.css'
import '@gx/tokens/theme.css'

const DATA: readonly Series[] = [
  {
    id: 'react-series',
    label: 'React series',
    points: [
      { x: 1, y: 12 },
      { x: 2, y: 19 },
      { x: 3, y: 16 },
    ],
  },
]

const ctx = sizeContextFromPixels(900, 620)
const plan = planChart('line', ctx, describeShape(DATA))
const fakeObserver = new FakeResizeObserver(() => undefined)

function App() {
  return (
    <main>
      <p id="consumer-status">
        React consumer: {GRID_COLUMNS} columns, observer {fakeObserver.constructor.name}
      </p>
      <Chart
        plan={plan}
        data={DATA}
        ctx={ctx}
        title="Packed React chart"
        description="Rendered from local package tarballs."
      />
      <AutoChart
        type="line"
        data={DATA}
        title="Packed adaptive React chart"
        description="Client boundary resolved from a packed package."
        initialSize={{ width: 900, height: 620 }}
      />
    </main>
  )
}

const root = document.querySelector('#root')
if (root === null) throw new Error('React consumer root is missing')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
