// @ts-check

import { access, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { CSS_ASSETS } from './emit-package-assets.mjs'

const execFileAsync = promisify(execFile)
const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url))
const PACKAGES_ROOT = join(REPO_ROOT, 'packages')
const DENY_NETWORK = join(REPO_ROOT, 'scripts', 'deny-network.cjs')
const CONSUMER_CHECK = join(REPO_ROOT, 'scripts', 'check-consumers.mjs')

export const PACKAGE_NAMES = Object.freeze([
  '@shiftcharts/core',
  '@shiftcharts/grid',
  '@shiftcharts/primitives',
  '@shiftcharts/react',
  '@shiftcharts/testing',
  '@shiftcharts/tokens',
])

const OFFLINE_ENV = Object.freeze({
  ...process.env,
  CI: '1',
  COREPACK_ENABLE_NETWORK: '0',
  NPM_CONFIG_AUDIT: 'false',
  NPM_CONFIG_FUND: 'false',
  NPM_CONFIG_OFFLINE: 'true',
  npm_config_audit: 'false',
  npm_config_fund: 'false',
  npm_config_offline: 'true',
})

/** @param {string} packageName */
function packageDirectory(packageName) {
  return join(PACKAGES_ROOT, packageName.slice(packageName.indexOf('/') + 1))
}

/** @param {unknown} condition @param {string} message */
function assert(condition, message) {
  if (!condition) throw new Error(message)
}

/**
 * @param {unknown} value
 * @param {string} subpath
 * @returns {Array<{ subpath: string, target: string }>} 
 */
function exportTargets(value, subpath) {
  if (typeof value === 'string') return [{ subpath, target: value }]
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value).flatMap(([key, child]) =>
    exportTargets(child, subpath === '<root>' ? key : `${subpath}.${key}`),
  )
}

/** @param {string} file */
async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

/** @param {string} command @param {string[]} args @param {string} cwd @param {string} label @param {NodeJS.ProcessEnv} [env] */
async function run(command, args, cwd, label, env = OFFLINE_ENV) {
  try {
    const result = await execFileAsync(command, args, { cwd, env, maxBuffer: 20_000_000 })
    return (result.stdout + result.stderr).trim()
  } catch (error) {
    const details =
      error && typeof error === 'object' && 'stdout' in error && 'stderr' in error
        ? String(error.stdout) + String(error.stderr)
        : String(error)
    throw new Error(label + ' failed:\n' + details)
  }
}

export function noNetworkEnvironment() {
  const nodeOptions = [process.env.NODE_OPTIONS, `--require=${DENY_NETWORK}`]
    .filter(Boolean)
    .join(' ')
  return {
    ...OFFLINE_ENV,
    NODE_OPTIONS: nodeOptions,
    SHIFTCHARTS_PACKAGE_GATES_NO_NETWORK: '1',
  }
}

async function assertBuiltInputs() {
  for (const packageName of PACKAGE_NAMES) {
    const root = packageDirectory(packageName)
    await access(join(root, 'dist', 'index.js'))
    await access(join(root, 'dist', 'index.d.ts'))
  }
  for (const [packageName, assets] of Object.entries(CSS_ASSETS)) {
    for (const asset of assets) await access(join(packageDirectory(packageName), asset.dist))
  }
}

/** @param {string} packageName @param {string} packRoot */
async function packPackage(packageName, packRoot) {
  await run(
    'pnpm',
    ['pack', '--pack-destination', packRoot],
    packageDirectory(packageName),
    packageName + ' pack',
  )
}

/** @param {string} packageName @param {string[]} tarballs */
function tarballFor(packageName, tarballs) {
  const shortName = packageName.slice(packageName.indexOf('/') + 1)
  const match = tarballs.find((file) => file.startsWith('shiftcharts-' + shortName + '-'))
  if (match === undefined) throw new Error(packageName + ': missing local packed tarball')
 return match
}

/** @param {string} packRoot */
async function packAll(packRoot) {
  await mkdir(packRoot, { recursive: true })
  for (const packageName of PACKAGE_NAMES) await packPackage(packageName, packRoot)
  const tarballs = (await readdir(packRoot)).filter((file) => file.endsWith('.tgz')).sort()
  assert(tarballs.length === PACKAGE_NAMES.length, 'package gates: expected six local tarballs')
  return tarballs
}

/** @param {string} packageRoot */
async function tarballEntries(packageRoot) {
  const output = await run('tar', ['-tzf', packageRoot], REPO_ROOT, 'tarball content listing')
  return output.split('\n').map((line) => line.trim()).filter(Boolean).map((line) =>
    line.replace(/^package\//, '').replace(/\/$/, ''),
  )
}

/** @param {string} packageRoot @param {string} destination */
async function extractTarball(packageRoot, destination) {
  await mkdir(destination, { recursive: true })
  await run(
    'tar',
    ['-xzf', packageRoot, '-C', destination, '--strip-components=1'],
    REPO_ROOT,
    'tarball extraction',
  )
}

/** @param {string} packageName @param {string} tarball @param {string} extractedRoot */
async function assertPackageContent(packageName, tarball, extractedRoot) {
  const entries = await tarballEntries(tarball)
  const manifest = await readJson(join(extractedRoot, 'package.json'))
  const prefix = packageName + ': package-content'
  const required = ['package.json', 'README.md', 'LICENSE', 'dist/index.js', 'dist/index.d.ts']
  for (const file of required) assert(entries.includes(file), prefix + ' missing ' + file)
  assert(entries.some((file) => file.startsWith('dist/') && file.endsWith('.js')), prefix + ' missing JS dist files')
  assert(entries.some((file) => file.startsWith('dist/') && file.endsWith('.d.ts')), prefix + ' missing declaration dist files')
  assert(!entries.some((file) => file.startsWith('src/')), prefix + ' must not publish src/')
  assert(!entries.some((file) => file.startsWith('node_modules/')), prefix + ' must not publish node_modules/')
  assert(!entries.some((file) => file.startsWith('.turbo/')), prefix + ' must not publish .turbo/')
  assert(manifest.license === 'MIT', prefix + ' packed manifest lost MIT')
  assert(manifest.exports && manifest.exports['.'] === './dist/index.js', prefix + ' root export is not dist/index.js')
  for (const { subpath, target } of exportTargets(manifest.exports, '<root>')) {
    if (target === './package.json') {
      assert(subpath === './package.json', prefix + ' package.json export changed unexpectedly')
      continue
    }
    assert(target.startsWith('./dist/'), prefix + ' ' + subpath + ' escapes dist')
    assert(entries.includes(target.slice(2)), prefix + ' ' + subpath + ' points at missing ' + target)
    if (target.endsWith('.js')) {
      assert(entries.includes(target.slice(2, -3) + '.d.ts'), prefix + ' missing declaration for ' + target)
    }
  }
  return entries.length
}

/** @param {string} packageName @param {string} extractedRoot @param {string} consumerRoot */
async function linkPackedPackage(packageName, extractedRoot, consumerRoot) {
  const shortName = packageName.slice(packageName.indexOf('/') + 1)
  const packageLink = join(consumerRoot, 'node_modules', '@shiftcharts', shortName)
  await mkdir(dirname(packageLink), { recursive: true })
  try {
    await symlink(extractedRoot, packageLink, 'dir')
  } catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EEXIST') throw error
  }
}

/** @param {string} packageName @param {string} extractedRoot @param {string} consumerRoot */
async function assertPublishedResolution(packageName, extractedRoot, consumerRoot) {
  await linkPackedPackage(packageName, extractedRoot, consumerRoot)
  const require = createRequire(join(consumerRoot, 'package.json'))
  const packageRoot = await realpath(extractedRoot)
  const manifest = await readJson(join(extractedRoot, 'package.json'))
  const resolved = []
  for (const { subpath } of exportTargets(manifest.exports, '<root>')) {
    const specifier = subpath === '.' ? packageName : packageName + subpath.slice(1)
    const target = await realpath(require.resolve(specifier))
    assert(target.startsWith(packageRoot), specifier + ' resolved outside packed package')
    resolved.push(specifier + ' -> ' + relative(extractedRoot, target))
  }
  return resolved
}

/** @param {string} packageName @param {string} extractedRoot @param {string} consumerRoot */
async function assertCssResolution(packageName, extractedRoot, consumerRoot) {
  await linkPackedPackage(packageName, extractedRoot, consumerRoot)
  const require = createRequire(join(consumerRoot, 'package.json'))
  const packageRoot = await realpath(extractedRoot)
  const resolved = []
  for (const asset of CSS_ASSETS[packageName] ?? []) {
    if (asset.exportPath === null) continue
    const specifier = packageName + asset.exportPath.slice(1)
    const cssPath = await realpath(require.resolve(specifier))
    assert(cssPath.startsWith(packageRoot), specifier + ' resolved outside packed package')
    assert(cssPath.includes('/dist/') && cssPath.endsWith('.css'), specifier + ' did not resolve to packed dist CSS')
    resolved.push(specifier)
  }
  return resolved
}

/** @param {string} packageName @param {string} tarball @param {string} gatesRoot */
async function runAnalyzers(packageName, tarball, gatesRoot) {
  const cssEntrypoints = (CSS_ASSETS[packageName] ?? [])
    .flatMap((asset) => asset.exportPath === null ? [] : [asset.exportPath])
  const publint = await run(
    'pnpm',
    ['exec', 'publint', 'run', '--strict', join(gatesRoot, tarball)],
    REPO_ROOT,
    packageName + ' publint',
    noNetworkEnvironment(),
  )
  const attwArgs = [
    'exec',
    'attw',
    join(gatesRoot, tarball),
    '--profile',
    'esm-only',
    '--format',
    'table',
    '--no-summary',
  ]
  if (cssEntrypoints.length > 0) attwArgs.push('--exclude-entrypoints', ...cssEntrypoints)
  const attw = await run(
    'pnpm',
    attwArgs,
    REPO_ROOT,
    packageName + ' are-the-types-wrong',
    noNetworkEnvironment(),
  )
  assert(publint.includes('All good!'), packageName + ': publint did not report a clean package')
  assert(attw.includes(packageName), packageName + ': attw did not inspect the package')
}

/** @returns {Promise<{ packages: number, contentFiles: number, css: number, consumerOutput: string, analyzerOutput: number }>} */
export async function runPackageGates() {
  await assertBuiltInputs()
  const gatesRoot = await mkdtemp(join(tmpdir(), 'shiftcharts-e1-4-package-gates-'))
  const extractedRoot = join(gatesRoot, 'extracted')
  const consumerRoot = join(gatesRoot, 'css-consumer')
  await mkdir(extractedRoot, { recursive: true })
  await mkdir(consumerRoot, { recursive: true })
  await writeFile(join(consumerRoot, 'package.json'), JSON.stringify({ type: 'module' }) + '\n', 'utf8')
  let succeeded = false
  try {
    const tarballs = await packAll(gatesRoot)
    let contentFiles = 0
    let cssCount = 0
    let analyzerOutput = 0
    for (const packageName of PACKAGE_NAMES) {
      const tarball = tarballFor(packageName, tarballs)
      const packageRoot = join(extractedRoot, packageName.slice(packageName.indexOf('/') + 1))
      const tarballPath = join(gatesRoot, tarball)
      await extractTarball(tarballPath, packageRoot)
      contentFiles += await assertPackageContent(packageName, tarballPath, packageRoot)
     await assertPublishedResolution(packageName, packageRoot, consumerRoot)
     cssCount += (await assertCssResolution(packageName, packageRoot, consumerRoot)).length
     await runAnalyzers(packageName, tarball, gatesRoot)
      analyzerOutput += 1
    }
    const consumerOutput = await run(
      process.execPath,
      [CONSUMER_CHECK],
      REPO_ROOT,
      'packed consumer build and no-network',
      noNetworkEnvironment(),
    )
    assert(consumerOutput.includes('packed tarballs: 6'), 'consumer-build: E1.3 did not pack six tarballs')
    for (const fixture of ['react-consumer', 'next-rsc-consumer', 'vite-consumer']) {
      assert(consumerOutput.includes(fixture + ': install, typecheck, build'), 'consumer-build: missing ' + fixture)
    }
    succeeded = true
    return {
      packages: PACKAGE_NAMES.length,
      contentFiles,
      css: cssCount,
      consumerOutput,
      analyzerOutput,
    }
  } finally {
    if (succeeded) await rm(gatesRoot, { recursive: true, force: true })
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]

if (invokedDirectly) {
  const result = await runPackageGates()
  console.log(
    'E1.4 package gates passed: ' +
      result.packages +
      ' packages; ' +
      result.analyzerOutput +
      ' publint/attw pairs; ' +
      result.contentFiles +
      ' packed files checked; ' +
      result.css +
      ' CSS subpaths resolved; consumer-build/no-network passed',
  )
}
