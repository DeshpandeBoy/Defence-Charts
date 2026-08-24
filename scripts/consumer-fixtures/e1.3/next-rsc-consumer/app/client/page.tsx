import ClientProbe from '../client-probe'

import { DATA } from '../data'

export default function ClientPage() {
  return (
    <main>
      <h1>Packed Next client boundary</h1>
      <ClientProbe data={DATA} />
    </main>
  )
}
