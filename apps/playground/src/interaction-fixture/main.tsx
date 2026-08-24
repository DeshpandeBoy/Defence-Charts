import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { InteractionFixture } from './InteractionFixture.tsx'
import './interaction-fixture.css'

import '../../../../packages/primitives/src/chart.css'
import '../../../../packages/react/src/auto-chart.css'
import '../../../../packages/react/src/interaction-overlay.css'
import '../../../../packages/tokens/src/themes/theme.css'

const root = document.querySelector('#root')
if (root === null) throw new Error('#root is missing from the interaction fixture')

createRoot(root).render(
  <StrictMode>
    <InteractionFixture />
  </StrictMode>,
)
