'use client'

import type { Series } from '@shiftcharts/core'
import { AutoChart } from '@shiftcharts/react'

export default function ClientProbe({ data }: { data: readonly Series[] }) {
  return (
    <AutoChart
      type="line"
      data={data}
      title="Packed Next adaptive chart"
      description="The explicit client boundary uses the packed React entry."
      initialSize={{ width: 900, height: 620 }}
    />
  )
}
