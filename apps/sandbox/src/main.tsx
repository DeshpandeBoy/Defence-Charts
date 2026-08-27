import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { SandboxApp } from './SandboxApp.tsx'
import '@shiftcharts/primitives/chart.css'
import './sandbox.css'

const root = document.querySelector('#root')
if (root === null) throw new Error('#root is missing from the ShiftCharts sandbox.')

document.title = 'ShiftCharts Sandbox'

createRoot(root).render(
  <StrictMode>
    <SandboxApp />
  </StrictMode>,
)
