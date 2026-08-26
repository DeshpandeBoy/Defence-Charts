import { describeShape, planChart, sizeContextFromPixels } from '@shiftcharts/core'
import { GRID_COLUMNS } from '@shiftcharts/grid'
import { Chart } from '@shiftcharts/primitives'
import { AutoChart } from '@shiftcharts/react'
import { parseChart } from '@shiftcharts/testing'
import * as tokens from '@shiftcharts/tokens'
import '@shiftcharts/grid/keyboard-grid.css'
import '@shiftcharts/grid/widget-shell.css'
import '@shiftcharts/grid/widget-states.css'
import '@shiftcharts/primitives/chart.css'
import '@shiftcharts/react/auto-chart.css'
import '@shiftcharts/react/interaction-overlay.css'
import '@shiftcharts/tokens/theme.css'

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
