'use client';

import type { Series } from '@shiftcharts/core';
import { describeShape, planChart, sizeContextFromPixels } from '@shiftcharts/core';
import { AutoChart, useElementSize } from '@shiftcharts/react';
import { faUpRightAndDownLeftFromCenter } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useRef, useState } from 'react';

const DAY = 86_400_000;
const START = Date.UTC(2025, 0, 1);

const demo: readonly Series[] = [
  {
    id: 'actual',
    label: 'Actual',
    points: Array.from({ length: 36 }, (_, index) => ({
      x: new Date(START + index * DAY),
      y: 42 + Math.sin(index / 4) * 11 + index * 0.45,
    })),
  },
  {
    id: 'forecast',
    label: 'Forecast',
    points: Array.from({ length: 36 }, (_, index) => ({
      x: new Date(START + index * DAY),
      y: index === 11 ? null : 36 + Math.sin(index / 5 + 1.5) * 8 + index * 0.6,
    })),
  },
];

type InstrumentSize = { readonly width: number; readonly height: number };

type DragState = {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly startWidth: number;
  readonly startHeight: number;
};

export function ResizeLab() {
  const [instrument, setInstrument] = useState<InstrumentSize>({ width: 680, height: 320 });
  const [measureRef, measured] = useElementSize<HTMLDivElement>({ initialSize: instrument });
  const drag = useRef<DragState | null>(null);
  const ctx = sizeContextFromPixels(measured.width, measured.height);
  const plan = planChart('line', ctx, describeShape(demo));

  function startDrag(event: React.PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: measured.width,
      startHeight: measured.height,
    };
  }

  function moveDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;

    const parentWidth = event.currentTarget.parentElement?.parentElement?.clientWidth ?? 760;
    setInstrument({
      width: clamp(drag.current.startWidth + event.clientX - drag.current.startX, 240, parentWidth),
      height: clamp(drag.current.startHeight + event.clientY - drag.current.startY, 160, 440),
    });
  }

  function stopDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag.current = null;
  }

  return (
    <section className="resize-lab" aria-labelledby="resize-lab-title">
      <header className="resize-lab__header">
        <div>
          <h2 id="resize-lab-title">Resize the same data</h2>
          <p>Drag the lower-right handle. ShiftCharts changes the information contract, not just the pixels.</p>
        </div>
        <output className="resize-lab__size" aria-live="polite">
          <strong>{plan.sizeClass}</strong>
          <span>{Math.round(measured.width)} × {Math.round(measured.height)} px</span>
        </output>
      </header>

      <div className="resize-lab__track">
        <div
          ref={measureRef}
          className="resize-lab__instrument"
          style={{ inlineSize: instrument.width, blockSize: instrument.height }}
        >
          <AutoChart
            type="line"
            data={demo}
            title="Actual and forecast revenue"
            description="Illustrative deterministic data with one deliberate missing forecast reading."
            initialSize={instrument}
            id="docs-resize-lab"
          />
          <button
            type="button"
            className="resize-lab__handle"
            aria-label="Resize chart"
            title="Resize chart"
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
          >
            <FontAwesomeIcon icon={faUpRightAndDownLeftFromCenter} aria-hidden="true" />
          </button>
        </div>
      </div>

      <dl className="resize-lab__readout">
        <PlanValue label="mark" value={plan.marks.primary.kind} />
        <PlanValue label="y-axis" value={plan.axes.y.visible ? 'visible' : 'absent'} />
        <PlanValue label="legend" value={plan.legend.placement} />
        <PlanValue label="table" value={plan.dataTable.present ? 'present' : 'absent'} />
      </dl>
    </section>
  );
}

function PlanValue({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}