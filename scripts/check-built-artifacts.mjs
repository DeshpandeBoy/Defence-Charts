// @ts-check

import { access, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { CSS_ASSETS } from './emit-package-assets.mjs'

const execFileAsync = promisify(execFile)
const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url))
const PACKAGES_ROOT = join(REPO_ROOT, 'packages')

export const PACKAGE_NAMES = Object.freeze([
  '@shiftcharts/core',
  '@shiftcharts/grid',
  '@shiftcharts/motion',
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

const RUNTIME_DEPENDENCIES = Object.freeze([
  'd3-array',
  'd3-format',
  'd3-scale',
  'd3-shape',
  'd3-time-format',
  'jsdom',
  'react',
  'react-dom',
  'react-grid-layout',
])

/** @param {string} packageName */
function packageDirectory(packageName) {
  return join(PACKAGES_ROOT, packageName.slice(packageName.indexOf('/') + 1))
}

/** @param {string} file */
async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
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

/** @param {string} packageName */
async function packageManifest(packageName) {
  return readJson(join(packageDirectory(packageName), 'package.json'))
}

/**
 * Check the source-development map, publish-time dist map, declarations, and emitted CSS for
 * every package. This intentionally reads the manifests as a consumer would, rather than
 * trusting the tsdown config that produced them.
 */
export async function assertBuiltArtifacts() {
  const reports = []

  for (const packageName of PACKAGE_NAMES) {
    const root = packageDirectory(packageName)
    const manifest = await packageManifest(packageName)
    const development = manifest.exports
    const publish = manifest.publishConfig?.exports
    assert(development !== undefined, `${packageName}: missing development exports`)
    assert(publish !== undefined, `${packageName}: missing publishConfig.exports`)

    const developmentRoot = development['.']
    assert(developmentRoot === './src/index.ts', `${packageName}: workspace root is not src/index.ts`)
    assert(publish['.'] === './dist/index.js', `${packageName}: published root is not dist/index.js`)

    const developmentTargets = exportTargets(development, '<root>')
    for (const { subpath, target } of developmentTargets) {
      if (target === './package.json') continue
      assert(!target.startsWith('./dist/'), `${packageName}: development export ${subpath} points at dist`)
      await access(join(root, target.slice(2)))
    }

    const publishTargets = exportTargets(publish, '<root>')
    for (const { subpath, target } of publishTargets) {
      if (target === './package.json') continue
      assert(target.startsWith('./dist/'), `${packageName}: published export ${subpath} points outside dist`)
      const absolute = join(root, target.slice(2))
      await access(absolute)
      if (target.endsWith('.js')) await access(absolute.slice(0, -3) + '.d.ts')
    }

    const assets = CSS_ASSETS[packageName] ?? []
    const sideEffects = manifest.sideEffects
    if (assets.length > 0) {
      assert(Array.isArray(sideEffects), `${packageName}: CSS package must declare sideEffects`)
      /** @type {readonly unknown[]} */
      const sideEffectPatterns = sideEffects
      assert(
        sideEffectPatterns.some((pattern) => pattern === '*.css' || pattern === '**/*.css'),
        `${packageName}: CSS sideEffects pattern does not cover emitted CSS`,
      )
    } else {
      assert(sideEffects === false, `${packageName}: non-CSS package must remain sideEffects:false`)
    }

    for (const asset of assets) {
      await access(join(root, asset.dist))
      if (asset.exportPath !== null) {
        assert(
          publish[asset.exportPath] === `./${asset.dist}`,
          `${packageName}: ${asset.exportPath} does not publish ${asset.dist}`,
        )
      }
    }

    reports.push(`${packageName}: ${publishTargets.length} published export(s), ${assets.length} CSS asset(s)`)
  }

  return reports
}

/**
 * Resolve the built package maps from extracted tarballs. Only local `pnpm pack` is used; no
 * install, registry lookup, or network access is part of this proof.
 */
export async function assertPackedConsumer() {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'shiftcharts-packed-consumer-'))
  const packRoot = join(temporaryRoot, 'packs')
  const consumerRoot = join(temporaryRoot, 'consumer')
  const consumerModules = join(consumerRoot, 'node_modules')

  try {
    await mkdir(packRoot, { recursive: true })
    await mkdir(join(consumerModules, '@shiftcharts'), { recursive: true })

    for (const packageName of PACKAGE_NAMES) {
      await execFileAsync('pnpm', ['pack', '--pack-destination', packRoot], {
        cwd: packageDirectory(packageName),
        env: { ...process.env, NPM_CONFIG_OFFLINE: 'true', npm_config_offline: 'true' },
        maxBuffer: 2_000_000,
      })
    }

    const tarballs = (await readdir(packRoot)).filter((file) => file.endsWith('.tgz'))
    assert(
      tarballs.length === PACKAGE_NAMES.length,
      `packed consumer: expected ${PACKAGE_NAMES.length} tarballs, found ${tarballs.length}`,
    )

    for (const packageName of PACKAGE_NAMES) {
      const packageRoot = join(consumerModules, packageName)
      await mkdir(packageRoot, { recursive: true })
      const shortName = packageName.slice(packageName.indexOf('/') + 1)
      const tarball = tarballs.find((file) => file.includes(shortName))
      if (tarball === undefined) throw new Error(`packed consumer: no tarball found for ${packageName}`)
      await execFileAsync('tar', [
        '-xzf',
        join(packRoot, tarball),
        '-C',
        packageRoot,
        '--strip-components=1',
      ])
    }

    for (const dependency of RUNTIME_DEPENDENCIES) {
      const installed = resolveInstalledPackage(dependency)
      const destination = join(consumerModules, dependency)
      await mkdir(dirname(destination), { recursive: true })
      try {
        await symlink(installed, destination, 'dir')
      } catch (error) {
        if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EEXIST') throw error
      }
    }

    const probe = join(consumerRoot, 'probe.mjs')
    const cssSpecifiers = Object.entries(CSS_ASSETS).flatMap(([packageName, assets]) =>
      assets.flatMap((asset) =>
        asset.exportPath === null ? [] : [`${packageName}${asset.exportPath.slice(1)}`],
      ),
    )
    await writeFile(
      probe,
      `import { access, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const js = ${JSON.stringify(JS_SPECIFIERS)}
const css = ${JSON.stringify(cssSpecifiers)}

for (const specifier of js) {
  const resolved = require.resolve(specifier)
  if (!resolved.includes('/dist/')) throw new Error(specifier + ' resolved outside dist: ' + resolved)
  await access(resolved.slice(0, -3) + '.d.ts')
  await readFile(resolved.slice(0, -3) + '.d.ts', 'utf8')
}
for (const specifier of css) {
  const resolved = require.resolve(specifier)
  if (!resolved.includes('/dist/')) throw new Error(specifier + ' resolved outside dist: ' + resolved)
  await access(resolved)
}

for (const specifier of ${JSON.stringify(JS_SPECIFIERS.filter((specifier) => specifier !== '@shiftcharts/testing'))}) {
  await import(specifier)
}

console.log('packed consumer: resolved ' + js.length + ' JS/declaration entrypoints and ' + css.length + ' CSS subpaths')
`,
      'utf8',
    )

    const { stdout } = await execFileAsync(process.execPath, [probe], {
      cwd: consumerRoot,
      env: { ...process.env, NPM_CONFIG_OFFLINE: 'true', npm_config_offline: 'true' },
      maxBuffer: 2_000_000,
    })
    return stdout.trim()
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

/** @param {string} dependency */
function resolveInstalledPackage(dependency) {
  const require = createRequire(import.meta.url)
  const entry = require.resolve(dependency, {
    paths: [REPO_ROOT, ...PACKAGE_NAMES.map((packageName) => packageDirectory(packageName))],
  })
  let current = dirname(entry)
  while (current !== dirname(current)) {
    const manifest = join(current, 'package.json')
    try {
      const parsed = JSON.parse(require('node:fs').readFileSync(manifest, 'utf8'))
      if (parsed.name === dependency) return current
    } catch {
      // Walk upward until the package root is found.
    }
    current = dirname(current)
  }
  throw new Error(`packed consumer: could not locate installed ${dependency}`)
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const built = await assertBuiltArtifacts()
  console.log(`built artifact contract: ${built.length} package(s) clean`)
  console.log(await assertPackedConsumer())
}
