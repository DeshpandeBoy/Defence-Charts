/* eslint-disable @typescript-eslint/no-require-imports */
'use strict'

const NETWORK_ERROR = '[ShiftCharts package gates] network access is disabled'

function denyNetwork() {
  throw new Error(NETWORK_ERROR)
}

function replace(module, names) {
  for (const name of names) {
    try {
      module[name] = denyNetwork
    } catch {
      // Some Node built-in exports are read-only in a particular module format.
    }
  }
}

const http = require('node:http')
const https = require('node:https')
const net = require('node:net')
const tls = require('node:tls')
const dns = require('node:dns')

replace(http, ['request', 'get'])
replace(https, ['request', 'get'])
replace(net, ['connect', 'createConnection'])
replace(tls, ['connect'])
replace(dns, ['lookup'])
if (dns.promises) replace(dns.promises, ['lookup', 'resolve', 'resolve4', 'resolve6'])
if (typeof globalThis.fetch === 'function') globalThis.fetch = denyNetwork
process.env.SHIFTCHARTS_NETWORK_GUARD_ACTIVE = '1'
