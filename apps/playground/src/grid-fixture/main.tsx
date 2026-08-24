import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { GridFixture } from './GridFixture.tsx'
import './grid-fixture.css'

// The fixture imports the real package styles by source path so the browser gate exercises the
// same CSS seams as the workspace consumer. The package export/tarball resolution remains E1.1.
import '../../../../packages/grid/src/keyboard-grid.css'
import '../../../../packages/grid/src/widget-shell.css'
import '../../../../packages/primitives/src/chart.css'
import '../../../../packages/react/src/auto-chart.css'
import '../../../../packages/tokens/src/themes/theme.css'

const root = document.querySelector('#root')
if (root === null) throw new Error('#root is missing from the grid fixture')

createRoot(root).render(
  <StrictMode>
    <GridFixture />
  </StrictMode>,
)
