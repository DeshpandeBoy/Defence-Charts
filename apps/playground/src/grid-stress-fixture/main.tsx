import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { GridStressFixture } from './GridStressFixture.tsx'
import './grid-stress-fixture.css'

import '../../../../packages/grid/src/keyboard-grid.css'
import '../../../../packages/grid/src/widget-shell.css'
import '../../../../packages/primitives/src/chart.css'
import '../../../../packages/react/src/auto-chart.css'
import '../../../../packages/tokens/src/themes/theme.css'

const root = document.querySelector('#root')
if (root === null) throw new Error('#root is missing from the grid stress fixture')

createRoot(root).render(
  <StrictMode>
    <GridStressFixture />
  </StrictMode>,
)
