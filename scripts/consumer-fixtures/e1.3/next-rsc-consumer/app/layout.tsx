import type { ReactNode } from 'react'

import '@shiftcharts/grid/keyboard-grid.css'
import '@shiftcharts/grid/widget-shell.css'
import '@shiftcharts/grid/widget-states.css'
import '@shiftcharts/primitives/chart.css'
import '@shiftcharts/react/auto-chart.css'
import '@shiftcharts/react/interaction-overlay.css'
import '@shiftcharts/tokens/theme.css'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
