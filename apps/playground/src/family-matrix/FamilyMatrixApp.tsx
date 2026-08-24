import { Chart } from '@gx/primitives'
import { AutoChart } from '@gx/react'
import { useState, type ReactNode } from 'react'
import type { Series } from '@gx/core'

import {
  EMPTY_DATA,
  ERROR_MESSAGE,
  FAMILY_MATRIX,
  FAMILY_TYPES,
  MATRIX_DATA,
  dataForType,
  metadataForPlan,
  planForRow,
  type FamilyState,
  type FamilyMatrixRow,
  type FamilyType,
} from './matrix.ts'

export function FamilyMatrixApp() {
  const [light, setLight] = useState(false)

  return (
    <main
      className={light ? 'family-matrix gx-theme-neutral-light' : 'family-matrix gx-theme-neutral'}
      data-family-matrix=""
      data-gx-theme={light ? 'neutral-light' : 'neutral'}
    >
      <header className="family-matrix__header">
        <div>
          <p className="family-matrix__eyebrow">D0.2 · shared family acceptance</p>
          <h1>Line / area / bar / timebar / scatter / donut / KPI / progress / heatmap family matrix</h1>
          <p>
            One fixture exercises the nine registered families across six information budgets, the static accessibility surface,
            the host-owned states, and the measured resize boundary contract.
          </p>
        </div>
        <button
          type="button"
          data-family-theme-toggle=""
          aria-pressed={light}
          onClick={() => setLight((current) => !current)}
        >
          {light ? 'Use dark theme' : 'Use light theme'}
        </button>
      </header>

      <section aria-labelledby="family-matrix-ladder">
        <div className="family-matrix__section-heading">
          <div>
            <p className="family-matrix__eyebrow">Static / RSC-safe surface</p>
            <h2 id="family-matrix-ladder">Micro → Stage</h2>
          </div>
          <p>
            Each card receives the same serialisable plan contract as a server consumer. The
            fixture attributes expose the plan metadata for the browser gate without adding
            runtime chart behavior.
          </p>
        </div>
        <div className="family-matrix__grid">
          {FAMILY_TYPES.flatMap((type) =>
            FAMILY_MATRIX.map((row) => <StaticMatrixCard key={type + '-' + row.id} type={type} row={row} />),
          )}
        </div>
      </section>

      <section aria-labelledby="family-matrix-states">
        <div className="family-matrix__section-heading">
          <div>
            <p className="family-matrix__eyebrow">Host-owned state composition</p>
            <h2 id="family-matrix-states">Normal · Empty · Error</h2>
          </div>
          <p>
            Normal and empty use the static chart. Error is an explicit host state with an
            accessible alert; no data fetching or retry behavior is introduced by the chart.
          </p>
        </div>
        <div className="family-matrix__states">
          <StateCard state="normal">
            <StaticChart type="line" row={FAMILY_MATRIX[3]!} data={MATRIX_DATA} id="state-normal" />
          </StateCard>
          <StateCard state="empty">
            <StaticChart type="area" row={FAMILY_MATRIX[3]!} data={EMPTY_DATA} id="state-empty" />
          </StateCard>
          <StateCard state="error">
            <div className="family-matrix__error" role="alert">
              <strong>Unable to render this widget</strong>
              <span>{ERROR_MESSAGE}</span>
            </div>
          </StateCard>
        </div>
      </section>

      <section aria-labelledby="family-matrix-resize">
        <div className="family-matrix__section-heading">
          <div>
            <p className="family-matrix__eyebrow">Measured browser path</p>
            <h2 id="family-matrix-resize">Resize boundaries</h2>
          </div>
          <p>
            The probe starts just below the Panel → Canvas boundary. The browser gate changes its
            owning box through every one-pixel boundary and checks class, metadata, and series IDs.
          </p>
        </div>
        <div
          className="family-matrix__resize-probe"
          data-family-resize-probe=""
          data-probe-width="599"
          data-probe-height="499"
          style={{ inlineSize: '599px', blockSize: '499px' }}
        >
          <AutoChart
            type="scatter"
            data={MATRIX_DATA}
            title="Resizable family matrix scatter chart"
            description="The same stable six-series data is observed while the box crosses the ladder boundaries."
            id="resize-probe"
          />
        </div>
        <p className="family-matrix__probe-note">
          Probe class: <output data-family-probe-class="">waiting for measurement</output>
        </p>
      </section>

      <section className="family-matrix__coverage" aria-labelledby="family-matrix-coverage">
        <p className="family-matrix__eyebrow">Reusable extension contract</p>
        <h2 id="family-matrix-coverage">Future family checklist</h2>
        <ul>
          <li>Register one row per size family and preserve the same six boundary probes.</li>
          <li>Provide normal, empty, and host-owned error fixtures with static accessible output.</li>
          <li>Record light/dark, forced-colors, reduced-motion, metadata, and stable-ID evidence.</li>
          <li>Keep visual differences in the fixture and evidence; do not add runtime family behavior here.</li>
        </ul>
      </section>
    </main>
  )
}

function StaticMatrixCard({ type, row }: { readonly type: FamilyType; readonly row: FamilyMatrixRow }) {
  const plan = planForRow(type, row)
  const metadata = metadataForPlan(plan)
  return (
    <article
      className="family-matrix__card"
      data-family-case={type + '-' + row.id}
      data-family-type={type}
      data-family-rung={row.id}
      data-plan-size-class={metadata.sizeClass}
      data-plan-mark={metadata.primary}
      data-plan-area={metadata.area === null ? 'none' : String(metadata.area)}
      data-plan-interaction={metadata.interaction}
      data-plan-tooltip={metadata.tooltip}
      data-plan-legend={metadata.legend}
      data-plan-legend-toggle={String(metadata.legendToggle)}
      data-plan-motion-stages={String(metadata.motionStages)}
      data-plan-persist-gridlines={String(metadata.persistGridlines)}
      data-plan-y2={String(metadata.y2)}
      data-plan-facet={metadata.facet}
    >
      <header className="family-matrix__card-header">
        <div>
          <h3>{type} · {row.id}</h3>
          <p>{row.label}</p>
        </div>
        <code>{metadata.primary}{metadata.area === true ? ' + fill' : ''}</code>
      </header>
      <div className="family-matrix__chart-frame">
        <StaticChart type={type} row={row} data={dataForType(type)} id={'matrix-' + type + '-' + row.id} />
      </div>
    </article>
  )
}

function StaticChart({
  type,
  row,
  data,
  id,
}: {
  readonly type: FamilyType
  readonly row: FamilyMatrixRow
  readonly data: readonly Series[]
  readonly id: string
}) {
  const plan = planForRow(type, row, data)
  return <Chart plan={plan} data={data} ctx={row.ctx} title={type + ' ' + row.id + ' family fixture'} id={id} />
}

function StateCard({
  state,
  children,
}: {
  readonly state: FamilyState
  readonly children: ReactNode
}) {
  return (
    <article className="family-matrix__state" data-family-state={state}>
      <h3>{state}</h3>
      <div className="family-matrix__state-body">{children}</div>
    </article>
  )
}
