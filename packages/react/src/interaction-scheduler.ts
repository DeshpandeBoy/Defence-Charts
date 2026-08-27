/**
 * A tiny client-side seam for pointer work that should run at most once per paint.
 *
 * Pointer events can arrive more often than the browser can paint. React event handlers
 * should therefore publish the latest sample and let the next animation frame consume it,
 * instead of doing chart hit-testing once for every event. This module deliberately owns no
 * React or DOM state: callers decide what a sample contains and what consuming it means.
 *
 * The frame driver is injectable so tests and consumers with a different scheduler can drive
 * it deterministically. The default driver uses `requestAnimationFrame` when available and a
 * cancellable timer otherwise; merely importing or constructing the scheduler is safe during
 * SSR and in non-browser test environments.
 */

export type ScheduledFrame = {
  readonly cancel: () => void
}

/** A request for one future paint, with an explicit cancellation seam. */
export type RequestFrame = (callback: () => void) => ScheduledFrame

export type PointerFrameScheduler<T> = {
  /** Publish the newest sample. Multiple calls before a frame are coalesced. */
  readonly schedule: (sample: T) => void
  /** Drop a pending sample and cancel its future frame. */
  readonly cancel: () => void
  /** Consume the pending sample immediately, if any. */
  readonly flush: () => void
  /** Whether a sample is waiting for the scheduled frame. */
  readonly pending: () => boolean
}

/**
 * Coalesces samples to one callback per scheduled frame.
 *
 * The latest sample wins. `flush` is useful for unmount/blur paths that must finish or discard
 * work synchronously, while `cancel` is the safe choice when the consumer is going away.
 */
export function createPointerFrameScheduler<T>(
  consume: (sample: T) => void,
  requestFrame: RequestFrame = requestAnimationFrameFrame,
): PointerFrameScheduler<T> {
  let latest: T | undefined
  let hasLatest = false
  let scheduled: ScheduledFrame | null = null

  const consumeLatest = (): void => {
    scheduled = null
    if (!hasLatest) return

    // `hasLatest` distinguishes an explicitly scheduled `undefined` from no sample. Keeping
    // the state separate makes this utility safe for any sample type, not only object samples.
    const sample = latest as T
    latest = undefined
    hasLatest = false
    consume(sample)
  }

  const schedule = (sample: T): void => {
    latest = sample
    hasLatest = true
    if (scheduled !== null) return
    scheduled = requestFrame(consumeLatest)
  }

  const cancel = (): void => {
    scheduled?.cancel()
    scheduled = null
    latest = undefined
    hasLatest = false
  }

  const flush = (): void => {
    // A scheduled callback must not consume the same sample a second time after this method
    // returns. Cancelling first also keeps the browser from retaining the latest event until
    // the next paint when a caller deliberately asks for synchronous delivery.
    scheduled?.cancel()
    scheduled = null
    consumeLatest()
  }

  return {
    schedule,
    cancel,
    flush,
    pending: () => hasLatest,
  }
}

/**
 * Browser-safe default frame driver.
 *
 * `globalThis` feature detection matters here: a bare `requestAnimationFrame` reference throws
 * while a server module is being evaluated. The timer fallback is intentionally cancellable so
 * the lifecycle guarantees are the same in a browser, SSR test, or worker-like environment.
 */
function requestAnimationFrameFrame(callback: () => void): ScheduledFrame {
  const request = globalThis.requestAnimationFrame
  if (typeof request === 'function') {
    const id = request(callback)
    return {
      cancel: () => globalThis.cancelAnimationFrame?.(id),
    }
  }

  const schedule = globalThis.setTimeout
  if (typeof schedule === 'function') {
    const id = schedule(callback, 16)
    return {
      cancel: () => globalThis.clearTimeout?.(id),
    }
  }

  // A host without either browser primitive is exceptionally unusual, but invoking the
  // callback synchronously is safer than silently dropping the latest interaction sample.
  callback()
  return { cancel: () => undefined }
}
