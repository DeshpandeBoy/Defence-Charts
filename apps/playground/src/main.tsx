import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App.tsx'
// ⚠ A separate import, and it has to be. `chart.css` is a **side effect** — nothing in
// `Chart.tsx` references it, so importing the component pulls in no styles at all and the
// chart renders correct, unstyled, and invisible: every stroke `none`, every fill the SVG
// default black. `@shiftcharts/primitives`'s own docblock warns about exactly this, and the warning
// is only useful if the consumer that reads it does the other half. This is that half.
import '@shiftcharts/primitives/chart.css'
// ⚠ The same half again, one package up. `auto-chart.css` carries `<AutoChart>`'s three
// containment declarations — `display: block` and `overflow: hidden` on the wrapper — and
// nothing in `AutoChart.tsx` references it. Skip this import and the widget still draws, but
// the wrapper is inline-level and scrollable, which are the two doors the containment loop
// walks through. It is a side-effect import for a reason that is not cosmetic.
import '@shiftcharts/react/auto-chart.css'
import './playground.css'

const root = document.querySelector('#root')
if (root === null) throw new Error('#root is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
