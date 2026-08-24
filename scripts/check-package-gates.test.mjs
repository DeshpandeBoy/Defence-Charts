import { describe, expect, it } from 'vitest'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'

import { noNetworkEnvironment } from './check-package-gates.mjs'

const execFileAsync = promisify(execFile)

describe('E1.4 package reliability gates', () => {
  it('constructs an offline environment with an explicit network guard', () => {
    const environment = noNetworkEnvironment()
    expect(environment.NPM_CONFIG_OFFLINE).toBe('true')
    expect(environment.COREPACK_ENABLE_NETWORK).toBe('0')
    expect(environment.NODE_OPTIONS).toContain('deny-network.cjs')
  })

  it('fails a network probe under the gate environment', async () => {
    await expect(
      execFileAsync(process.execPath, ['-e', "fetch('https://example.com')"], {
        env: noNetworkEnvironment(),
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('network access is disabled'),
    })
  })
})
