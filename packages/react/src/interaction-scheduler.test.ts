import { afterEach, describe, expect, it, vi } from 'vitest'

import { createPointerFrameScheduler, type RequestFrame } from './interaction-scheduler.ts'

type ManualDriver = {
  readonly request: RequestFrame
  readonly flush: () => void
  readonly requests: () => number
  readonly cancellations: () => number
}

function manualDriver(): ManualDriver {
  let callback: (() => void) | null = null
  let requestCount = 0
  let cancellationCount = 0

  return {
    request: (next) => {
      requestCount += 1
      callback = next
      return {
        cancel: () => {
          cancellationCount += 1
          callback = null
        },
      }
    },
    flush: () => {
      const next = callback
      callback = null
      next?.()
    },
    requests: () => requestCount,
    cancellations: () => cancellationCount,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('createPointerFrameScheduler', () => {
  it('coalesces a burst and consumes only the latest pointer sample', () => {
    const driver = manualDriver()
    const consumed: string[] = []
    const scheduler = createPointerFrameScheduler((sample: string) => consumed.push(sample), driver.request)

    scheduler.schedule('first')
    scheduler.schedule('middle')
    scheduler.schedule('latest')

    expect(driver.requests()).toBe(1)
    expect(scheduler.pending()).toBe(true)
    expect(consumed).toEqual([])

    driver.flush()

    expect(consumed).toEqual(['latest'])
    expect(scheduler.pending()).toBe(false)
    scheduler.schedule('next-frame')
    expect(driver.requests()).toBe(2)
  })

  it('cancels pending work without consuming a stale sample', () => {
    const driver = manualDriver()
    const consumed: number[] = []
    const scheduler = createPointerFrameScheduler((sample: number) => consumed.push(sample), driver.request)

    scheduler.schedule(42)
    scheduler.cancel()
    driver.flush()

    expect(driver.cancellations()).toBe(1)
    expect(scheduler.pending()).toBe(false)
    expect(consumed).toEqual([])
  })

  it('flushes immediately and does not consume again on the old frame', () => {
    const driver = manualDriver()
    const consumed: string[] = []
    const scheduler = createPointerFrameScheduler((sample: string) => consumed.push(sample), driver.request)

    scheduler.schedule('synchronous')
    scheduler.flush()
    driver.flush()

    expect(driver.cancellations()).toBe(1)
    expect(scheduler.pending()).toBe(false)
    expect(consumed).toEqual(['synchronous'])
  })

  it('supports an explicit undefined sample without treating it as empty', () => {
    const driver = manualDriver()
    const consumed: Array<string | undefined> = []
    const scheduler = createPointerFrameScheduler<string | undefined>(
      (sample) => consumed.push(sample),
      driver.request,
    )

    scheduler.schedule(undefined)
    driver.flush()

    expect(consumed).toEqual([undefined])
  })

  it('falls back to a cancellable timer when animation frames are unavailable', () => {
    vi.stubGlobal('requestAnimationFrame', undefined)
    vi.stubGlobal('cancelAnimationFrame', undefined)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    const consumed: string[] = []
    const scheduler = createPointerFrameScheduler((sample: string) => consumed.push(sample))

    scheduler.schedule('timer-sample')
    expect(consumed).toEqual([])
    vi.advanceTimersByTime(15)
    expect(consumed).toEqual([])
    vi.advanceTimersByTime(1)
    expect(consumed).toEqual(['timer-sample'])
  })
})
