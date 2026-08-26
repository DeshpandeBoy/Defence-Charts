import { describe, expect, it } from 'vitest'

import {
  CSS_SPECIFIERS,
  FIXTURE_NAMES,
  JS_SPECIFIERS,
  PACKAGE_NAMES,
  assertFixtureSourceContract,
} from './check-consumers.mjs'

describe('E1.3 packed consumer source contract', () => {
  it('commits three clean fixture templates with every package root and CSS subpath', async () => {
    const report = await assertFixtureSourceContract()
    expect(FIXTURE_NAMES).toEqual(['react-consumer', 'next-rsc-consumer', 'vite-consumer'])
    expect(PACKAGE_NAMES).toHaveLength(6)
    expect(JS_SPECIFIERS).toEqual([
      ...PACKAGE_NAMES,
      '@shiftcharts/primitives/line',
      '@shiftcharts/primitives/bar',
      '@shiftcharts/primitives/donut',
    ])
    expect(CSS_SPECIFIERS).toHaveLength(7)
    expect(report.files.length).toBeGreaterThanOrEqual(15)
    expect(report.packages).toBe(6)
    expect(report.javascript).toBe(9)
    expect(report.css).toBe(7)
  })
})
