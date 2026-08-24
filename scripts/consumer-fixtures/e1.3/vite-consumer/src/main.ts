import { describeShape, planChart, sizeContextFromPixels } from '@gx/core'
import { GRID_COLUMNS } from '@gx/grid'
import { Chart } from '@gx/primitives'
import { AutoChart } from '@gx/react'
import { parseChart } from '@gx/testing'
import * as tokens from '@gx/tokens'
import '@gx/grid/keyboard-grid.css'
import '@gx/grid/widget-shell.css'
import '@gx/grid/widget-states.css'
import '@gx/primitives/chart.css'
import '@gx/react/auto-chart.css'
import '@gx/tokens/theme.css'

const chartType = 'line'
const context = sizeContextFromPixels(640, 360)
const shape = describeShape([
  {
    id: 'vite-series',
    points: [
      { x: 1, y: 3 },
      { x: 2, y: 8 },
    ],
  },
])
const plan = planChart(chartType, context, shape)
const rootExports = [Chart, AutoChart, parseChart, GRID_COLUMNS, Object.keys(tokens).length]

const status = document.querySelector('#status')
if (status === null) throw new Error('Vite consumer status node is missing')
status.textContent =
  'Vite consumer: ' + rootExports.length + ' roots, ' + plan.type + ', ' + chartType
