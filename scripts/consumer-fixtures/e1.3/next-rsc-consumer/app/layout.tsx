import type { ReactNode } from 'react'

import '@gx/grid/keyboard-grid.css'
import '@gx/grid/widget-shell.css'
import '@gx/grid/widget-states.css'
import '@gx/primitives/chart.css'
import '@gx/react/auto-chart.css'
import '@gx/tokens/theme.css'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
