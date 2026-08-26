import { describeShape, planChart, sizeContextFromPixels } from '@shiftcharts/core'
import { Chart } from '@shiftcharts/primitives'

import { DATA } from './data'

const ctx = sizeContextFromPixels(900, 620)
const plan = planChart('line', ctx, describeShape(DATA))

export default function Page() {
  return (
    <main>
      <h1>Packed Next server chart</h1>
      <Chart
        plan={plan}
        data={DATA}
        ctx={ctx}
        title="Packed Next RSC chart"
        description="A server component rendered from local package tarballs."
      />
    </main>
  )
}
