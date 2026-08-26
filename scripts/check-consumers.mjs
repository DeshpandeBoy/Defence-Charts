// @ts-check

import { access, cp, mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { CSS_ASSETS } from './emit-package-assets.mjs'

const execFileAsync = promisify(execFile)
const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url))
const FIXTURE_SOURCE_ROOT = join(REPO_ROOT, 'scripts', 'consumer-fixtures', 'e1.3')
const PACKAGES_ROOT = join(REPO_ROOT, 'packages')

export const PACKAGE_NAMES = Object.freeze([
  '@shiftcharts/core',
  '@shiftcharts/grid',
  '@shiftcharts/primitives',
  '@shiftcharts/react',
  '@shiftcharts/testing',
  '@shiftcharts/tokens',
])

export const JS_SPECIFIERS = Object.freeze([
  ...PACKAGE_NAMES,
  '@shiftcharts/primitives/line',
  '@shiftcharts/primitives/bar',
  '@shiftcharts/primitives/donut',
])

export const FIXTURE_NAMES = Object.freeze([
  'react-consumer',
  'next-rsc-consumer',
  'vite-consumer',
])

export const CSS_SPECIFIERS = Object.freeze(
  Object.entries(CSS_ASSETS).flatMap(([packageName, assets]) =>
    assets.flatMap((asset) =>
      asset.exportPath === null ? [] : [packageName + asset.exportPath.slice(1)],
    ),
  ),
)

const PACKAGE_BUILD_ORDER = Object.freeze([
  '@shiftcharts/core',
  '@shiftcharts/primitives',
  '@shiftcharts/react',
  '@shiftcharts/grid',
  '@shiftcharts/testing',
  '@shiftcharts/tokens',
])

const EXTERNAL_PACKAGES = Object.freeze([
  'd3-array',
  'd3-format',
  'd3-scale',
  'd3-shape',
  'd3-time-format',
  'jsdom',
  'react',
  'react-dom',
  'react-grid-layout',
  'next',
  'vite',
  '@vitejs/plugin-react',
  'typescript',
  '@types/node',
  '@types/react',
  '@types/react-dom',
])

const PACKAGE_SHORT_NAMES = Object.freeze(
  Object.fromEntries(PACKAGE_NAMES.map((name) => [name, name.slice(name.indexOf('/') + 1)])),
)

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

/** @param {unknown} condition @param {string} message */
function assert(condition, message) {
  if (!condition) throw new Error(message)
}

/**
 * @param {string} root
 * @returns {Promise<string[]>}
 */
async function textFiles(root) {
  /** @type {string[]} */
  const files = []
  /** @type {string[]} */
  const pending = [root]
  while (pending.length > 0) {
    const current = pending.pop()
    if (current === undefined) break
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) pending.push(full)
      else if (/\.(json|mjs|ts|tsx|html)$/.test(entry.name)) files.push(full)
    }
  }
  files.sort()
  return files
}

/**
 * Check the committed fixture templates before creating a temporary consumer. This is kept
 * separate from package resolution so a source import or workspace protocol cannot hide behind
 * a successful local install.
 */
export async function assertFixtureSourceContract() {
  const files = await textFiles(FIXTURE_SOURCE_ROOT)
  const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n')

  for (const packageName of PACKAGE_NAMES) {
    assert(source.includes(packageName), 'fixture source does not cover ' + packageName)
  }
  for (const specifier of JS_SPECIFIERS) {
    assert(source.includes(specifier), 'fixture source does not cover ' + specifier)
  }
  for (const specifier of CSS_SPECIFIERS) {
    assert(source.includes(specifier), 'fixture source does not cover ' + specifier)
  }

  assert(!source.includes('workspace:'), 'fixture source contains a workspace protocol')
  assert(!source.includes('/packages/'), 'fixture source contains a repository package path')
  assert(!source.includes('/src/index.ts'), 'fixture source imports a package source entry')
  assert(!source.includes('node_modules/@shiftcharts'), 'fixture source reaches into node_modules')

  return {
    files: files.map((file) => relative(FIXTURE_SOURCE_ROOT, file)),
    packages: PACKAGE_NAMES.length,
    javascript: JS_SPECIFIERS.length,
    css: CSS_SPECIFIERS.length,
  }
}

/** @param {string} packageName */
function packageDirectory(packageName) {
  const shortName = PACKAGE_SHORT_NAMES[packageName]
  if (shortName === undefined) throw new Error('unknown package: ' + packageName)
  return join(PACKAGES_ROOT, shortName)
}

/**
 * @param {string} label
 * @param {string[]} args
 * @param {string} cwd
 * @returns {Promise<string>}
 */
async function runPnpm(label, args, cwd) {
  try {
    const result = await execFileAsync('pnpm', args, {
      cwd,
      env: OFFLINE_ENV,
      maxBuffer: 20_000_000,
    })
    return (result.stdout + result.stderr).trim()
  } catch (error) {
    const details =
      error && typeof error === 'object' && 'stdout' in error && 'stderr' in error
        ? String(error.stdout) + String(error.stderr)
        : String(error)
    throw new Error(label + ' failed:\n' + details)
  }
}

/** @param {string} root */
async function packPackages(root) {
  await Promise.all(
    PACKAGE_BUILD_ORDER.map((packageName) =>
      runPnpm(
        packageName + ' pack',
        ['pack', '--pack-destination', root],
        packageDirectory(packageName),
      ),
    ),
  )

  const files = (await readdir(root)).filter((file) => file.endsWith('.tgz')).sort()
  assert(files.length === PACKAGE_NAMES.length, 'expected six package tarballs, found ' + files.length)
  for (const packageName of PACKAGE_NAMES) {
    const shortName = PACKAGE_SHORT_NAMES[packageName]
    assert(
      files.some((file) => file.startsWith('shiftcharts-' + shortName + '-')),
      'missing tarball for ' + packageName,
    )
  }
  return files
}

async function assertBuiltInputs() {
  for (const packageName of PACKAGE_NAMES) {
    await access(join(packageDirectory(packageName), 'dist', 'index.js'))
  }
  for (const [packageName, assets] of Object.entries(CSS_ASSETS)) {
    for (const asset of assets) {
      await access(join(packageDirectory(packageName), asset.dist))
    }
  }
}

/**
 * Resolve an already-installed tool/runtime package without following any workspace package.
 * The returned directory is a pnpm store package from the repository's existing install.
 *
 * @param {string} packageName
 */
function resolveInstalledPackage(packageName) {
  const require = createRequire(import.meta.url)
  const searchPaths = [
    REPO_ROOT,
    join(REPO_ROOT, 'apps', 'playground'),
    join(REPO_ROOT, 'apps', 'rsc-fixture'),
    ...PACKAGE_NAMES.map((name) => packageDirectory(name)),
  ]
  let entry
  try {
    const manifestPath = require.resolve(packageName + '/package.json', { paths: searchPaths })
    return dirname(manifestPath)
  } catch {
    entry = require.resolve(packageName, { paths: searchPaths })
  }
  let current = dirname(entry)
  while (current !== dirname(current)) {
    const manifestPath = join(current, 'package.json')
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      if (manifest.name === packageName) return current
    } catch {
      // Walk upward until the package root is found.
    }
    current = dirname(current)
  }
  throw new Error('could not locate installed ' + packageName)
}

/**
 * Next is copied into the temporary root so Turbopack can identify its own package boundary.
 * Its pnpm peer/dependency links live beside the package in the store; expose those links at
 * the consumer root as well, preserving the same local, offline dependency graph.
 *
 * @param {string} sourceNodeModules
 * @param {string} destinationNodeModules
 */
async function linkPackageDependencies(sourceNodeModules, destinationNodeModules) {
  for (const entry of await readdir(sourceNodeModules, { withFileTypes: true })) {
    if (entry.name === 'next') continue
    if (entry.name.startsWith('@') && entry.isDirectory()) {
      const scopeSource = join(sourceNodeModules, entry.name)
      const scopeDestination = join(destinationNodeModules, entry.name)
      await mkdir(scopeDestination, { recursive: true })
      for (const child of await readdir(scopeSource, { withFileTypes: true })) {
        const destination = join(scopeDestination, child.name)
        try {
          await symlink(join(scopeSource, child.name), destination, 'dir')
        } catch (error) {
          if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EEXIST') {
            throw error
          }
        }
      }
      continue
    }
    const destination = join(destinationNodeModules, entry.name)
    try {
      await symlink(join(sourceNodeModules, entry.name), destination, 'dir')
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EEXIST') {
        throw error
      }
    }
  }
}

/**
 * @param {string} source
 * @param {string} destination
 * @param {string} packRoot
 */
async function stageFixture(source, destination, packRoot) {
  await cp(source, destination, { recursive: true })
  const manifestPath = join(destination, 'package.json')
  const manifest = (await readFile(manifestPath, 'utf8')).replaceAll(
    '__SHIFTCHARTS_TARBALL_ROOT__',
    packRoot,
  )
  await writeFile(manifestPath, manifest, 'utf8')
}

/**
 * @param {string} fixtureRoot
 * @param {string} packageSpecifier
 * @returns {Promise<{ entry: string, manifest: Record<string, unknown> }>}
 */
async function assertPackageResolution(fixtureRoot, packageSpecifier) {
  const require = createRequire(join(fixtureRoot, 'package.json'))
  const realFixtureRoot = await realpath(fixtureRoot)
  const packageName = PACKAGE_NAMES.find(
    (candidate) => packageSpecifier === candidate || packageSpecifier.startsWith(candidate + '/'),
  )
  if (packageName === undefined) throw new Error('unknown package specifier: ' + packageSpecifier)
  const entry = await realpath(require.resolve(packageSpecifier))
  const manifestPath = await realpath(require.resolve(packageName + '/package.json'))
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

  assert(entry.startsWith(realFixtureRoot), packageSpecifier + ' resolved outside the fixture')
  assert(
    entry.includes(join('node_modules', '@shiftcharts', packageName.slice(packageName.indexOf('/') + 1))),
    packageSpecifier + ' is not an extracted packed install',
  )
  assert(entry.includes('/dist/'), packageSpecifier + ' did not resolve to dist')
  assert(!entry.includes(join('packages', packageName.slice(packageName.indexOf('/') + 1))), packageSpecifier + ' resolved to the repository package')
  assert(!entry.includes(join('src', 'index.ts')), packageSpecifier + ' resolved to a source entry')
  assert(manifest.name === packageName, packageSpecifier + ' manifest name mismatch')
  assert(manifest.license === 'MIT', packageSpecifier + ' manifest is missing MIT metadata')
  assert(manifest.type === 'module', packageSpecifier + ' manifest is not ESM')
  assert(!JSON.stringify(manifest).includes('workspace:'), packageSpecifier + ' tarball retained workspace metadata')

  const declaration = entry.replace(/\.js$/, '.d.ts')
  await access(declaration)
  return { entry, manifest }
}

/**
 * @param {string} fixtureRoot
 * @returns {Promise<string[]>}
 */
async function assertInstalledPackageMaps(fixtureRoot) {
  const require = createRequire(join(fixtureRoot, 'package.json'))
  const realFixtureRoot = await realpath(fixtureRoot)
  const resolved = []
  for (const packageSpecifier of JS_SPECIFIERS) {
    const result = await assertPackageResolution(fixtureRoot, packageSpecifier)
    resolved.push(packageSpecifier + ' -> ' + result.entry)
    await import(pathToFileURL(result.entry).href)
  }
  for (const specifier of CSS_SPECIFIERS) {
    const css = await realpath(require.resolve(specifier))
    assert(css.startsWith(realFixtureRoot), specifier + ' resolved outside the fixture')
    assert(css.includes('/dist/'), specifier + ' did not resolve to dist')
    assert(!css.includes('/packages/'), specifier + ' resolved to a repository package')
    await access(css)
  }
  return resolved
}

/**
 * Extract the six library tarballs into a clean temporary node_modules tree. Tool and peer
 * dependencies are linked from the existing pnpm store package roots, never from a workspace
 * package or source directory. This keeps the proof offline while making the library install
 * itself the exact tarball contents a consumer receives.
 *
 * @param {string} fixtureRoot
 * @param {string} packRoot
 */
async function installPackedFixture(fixtureRoot, packRoot) {
  const nodeModules = join(fixtureRoot, 'node_modules')
  const shiftchartsModules = join(nodeModules, '@shiftcharts')
  await mkdir(shiftchartsModules, { recursive: true })
  const tarballs = (await readdir(packRoot)).filter((file) => file.endsWith('.tgz'))

  for (const packageName of PACKAGE_NAMES) {
    const shortName = PACKAGE_SHORT_NAMES[packageName]
    if (shortName === undefined) throw new Error('unknown package: ' + packageName)
    const tarball = tarballs.find((file) => file.startsWith('shiftcharts-' + shortName + '-'))
    if (tarball === undefined) throw new Error('missing tarball for ' + packageName)
    const destination = join(shiftchartsModules, shortName)
    await mkdir(destination, { recursive: true })
    await execFileAsync('tar', [
      '-xzf',
      join(packRoot, tarball),
      '-C',
      destination,
      '--strip-components=1',
    ])
  }

  for (const packageName of EXTERNAL_PACKAGES) {
    const destination = join(nodeModules, ...packageName.split('/'))
    await mkdir(dirname(destination), { recursive: true })
    const source = resolveInstalledPackage(packageName)
    if (packageName === 'next') {
      const fixtureManifest = JSON.parse(await readFile(join(fixtureRoot, 'package.json'), 'utf8'))
      const declaredVersion = fixtureManifest.dependencies?.next
      const installedManifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'))
      if (declaredVersion !== undefined) {
        assert(
          declaredVersion === installedManifest.version,
          'next-rsc-consumer declares next ' + String(declaredVersion) + ' but resolved ' + String(installedManifest.version),
        )
      }
      await cp(source, destination, { recursive: true })
      await linkPackageDependencies(dirname(source), nodeModules)
    } else {
      await symlink(source, destination, 'dir')
    }
  }

  const binDirectory = join(nodeModules, '.bin')
  await mkdir(binDirectory, { recursive: true })
  const binaries = {
    tsc: ['typescript', 'bin/tsc'],
    vite: ['vite', 'bin/vite.js'],
    next: ['next', 'dist/bin/next'],
  }
  for (const [name, [packageName, entry]] of Object.entries(binaries)) {
    await symlink(join(resolveInstalledPackage(packageName), entry), join(binDirectory, name))
  }
}

/**
 * @param {string} label
 * @param {string[]} args
 * @param {string} cwd
 */
async function runNode(label, args, cwd) {
  try {
    const result = await execFileAsync(process.execPath, args, {
      cwd,
      env: OFFLINE_ENV,
      maxBuffer: 20_000_000,
    })
    return (result.stdout + result.stderr).trim()
  } catch (error) {
    const details =
      error && typeof error === 'object' && 'stdout' in error && 'stderr' in error
        ? String(error.stdout) + String(error.stderr)
        : String(error)
    throw new Error(label + ' failed:\n' + details)
  }
}

/**
 * @param {string} root
 * @returns {Promise<string[]>}
 */
async function allFiles(root) {
  /** @type {string[]} */
  const files = []
  /** @type {string[]} */
  const pending = [root]
  while (pending.length > 0) {
    const current = pending.pop()
    if (current === undefined) break
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) pending.push(full)
      else files.push(full)
    }
  }
  files.sort()
  return files
}

/**
 * @param {string} fixtureRoot
 * @returns {Promise<{ html: number, clientMarker: boolean }>}
 */
async function assertNextRscOutput(fixtureRoot) {
  const htmlFiles = (await allFiles(join(fixtureRoot, '.next', 'server', 'app'))).filter((file) =>
    file.endsWith('.html'),
  )
  const html = await Promise.all(htmlFiles.map((file) => readFile(file, 'utf8')))
  const serverHtml = html.find((value) => value.includes('Packed Next RSC chart'))
  const clientHtml = html.find((value) => value.includes('Packed Next client boundary'))
  if (serverHtml === undefined) throw new Error('Next server route did not render its RSC chart HTML')
  assert(serverHtml.includes('shiftcharts-chart__svg'), 'Next RSC route has no chart SVG')
  assert(serverHtml.includes('graphics-document'), 'Next RSC route has no graphics role')
  if (clientHtml === undefined) throw new Error('Next client-boundary route was not prerendered')

  const javascript = await Promise.all(
    (await allFiles(join(fixtureRoot, '.next', 'static'))).filter((file) => file.endsWith('.js')).map((file) => readFile(file, 'utf8')),
  )
  const clientBundle = javascript.join('\n')
  assert(clientBundle.includes('shiftcharts-auto-chart'), 'Next client bundle lacks the explicit @shiftcharts/react boundary')
  assert(!clientBundle.includes('workspace:'), 'Next client bundle retained workspace metadata')
  assert(!clientBundle.includes('/packages/core/'), 'Next client bundle contains a source package import')
  assert(!clientBundle.includes('/packages/react/'), 'Next client bundle contains a source client import')
  return { html: htmlFiles.length, clientMarker: true }
}

/**
 * @param {string} fixtureRoot
 * @param {string} fixtureName
 * @returns {Promise<string[]>}
 */
async function installAndBuildFixture(fixtureRoot, fixtureName) {
  const packRoot = join(dirname(dirname(fixtureRoot)), 'tarballs')
  await installPackedFixture(fixtureRoot, packRoot)
  const resolved = await assertInstalledPackageMaps(fixtureRoot)
  await runNode(fixtureName + ' typecheck', ['node_modules/typescript/bin/tsc', '--noEmit'], fixtureRoot)
  if (fixtureName === 'next-rsc-consumer') {
    await runNode(fixtureName + ' build', ['node_modules/next/dist/bin/next', 'build', '--webpack'], fixtureRoot)
  } else {
    await runNode(fixtureName + ' build', ['node_modules/vite/bin/vite.js', 'build'], fixtureRoot)
  }
  if (fixtureName === 'next-rsc-consumer') {
    const next = await assertNextRscOutput(fixtureRoot)
    resolved.push('Next RSC: ' + next.html + ' HTML route(s), explicit client marker')
  }
  return resolved
}

/**
 * Run the full E1.3 proof. The only package inputs are local pnpm packs and every consumer
 * install is performed outside the repository workspace by extracting local packs and linking
 * only non-library tools from the existing pnpm store.
 */
export async function runConsumerProof() {
  const source = await assertFixtureSourceContract()
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'shiftcharts-e1-3-consumers-'))
  const packRoot = join(temporaryRoot, 'tarballs')
  const consumerRoot = join(temporaryRoot, 'consumers')
  let succeeded = false

  try {
    await assertBuiltInputs()
    await mkdir(packRoot, { recursive: true })
    await mkdir(consumerRoot, { recursive: true })
    await packPackages(packRoot)

    /** @type {Record<string, string[]>} */
    const reports = {}
    for (const fixtureName of FIXTURE_NAMES) {
      const fixtureRoot = join(consumerRoot, fixtureName)
      await stageFixture(join(FIXTURE_SOURCE_ROOT, fixtureName), fixtureRoot, packRoot)
      reports[fixtureName] = await installAndBuildFixture(fixtureRoot, fixtureName)
    }
    succeeded = true
    return {
      source,
      tarballs: PACKAGE_NAMES.length,
      reports,
    }
  } catch (error) {
    throw new Error(
      String(error) + '\nTemporary consumer root preserved for inspection: ' + temporaryRoot,
    )
  } finally {
    if (succeeded) await rm(temporaryRoot, { recursive: true, force: true })
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const result = await runConsumerProof()
  console.log(
    'E1.3 fixture source: ' +
      result.source.files.length +
      ' files, ' +
      result.source.packages +
      ' package roots, ' +
      result.source.css +
      ' CSS subpaths',
  )
  console.log('E1.3 packed tarballs: ' + result.tarballs)
  for (const [fixture, entries] of Object.entries(result.reports)) {
    console.log(fixture + ': install, typecheck, build, packed-map checks passed')
    console.log('  ' + entries.length + ' runtime/map assertions')
  }
}
