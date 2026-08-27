import { expect, test } from 'vitest'

import docsConfig from '../docs/next.config.mjs'
import playgroundConfig from '../apps/playground/vite.config.ts'
import rscConfig from '../apps/rsc-fixture/next.config.ts'

const expectedHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
}

async function nextHeaders(config) {
  const rules = await config.headers()
  const globalRule = rules.find((rule) => rule.source === '/:path*')

  expect(globalRule).toBeDefined()
  expect(globalRule.headers).toMatchObject(
    Object.entries(expectedHeaders).map(([key, value]) => ({ key, value })),
  )

  for (const { value } of globalRule.headers) {
    expect(value).not.toMatch(/\*/)
  }
}

test('Next applications expose the baseline headers on every route', async () => {
  await nextHeaders(docsConfig)
  await nextHeaders(rscConfig)
  expect(docsConfig.poweredByHeader).toBe(false)
  expect(rscConfig.poweredByHeader).toBe(false)
})

test('Vite dev and preview servers expose the baseline headers', () => {
  for (const headers of [playgroundConfig.server?.headers, playgroundConfig.preview?.headers]) {
    expect(headers).toEqual(expectedHeaders)

    for (const value of Object.values(headers)) {
      expect(value).not.toMatch(/\*/)
    }
  }
})
