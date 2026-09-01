// @ts-check

import { access, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url))
const PACKAGES_ROOT = join(REPO_ROOT, 'packages')
const REPOSITORY_URL = 'git+https://github.com/DeshpandeBoy/Defence-Charts.git'
const HOMEPAGE = 'https://github.com/DeshpandeBoy/Defence-Charts'
const BUGS_URL = HOMEPAGE + '/issues'
const NODE_ENGINE = '>=22.18'

/** @typedef {'@shiftcharts/core' | '@shiftcharts/grid' | '@shiftcharts/motion' | '@shiftcharts/primitives' | '@shiftcharts/react' | '@shiftcharts/testing' | '@shiftcharts/tokens'} PackageName */
/** @typedef {{ dependencies: readonly string[], peers: readonly string[], css: boolean }} PackageExpectation */

/** @type {readonly PackageName[]} */
export const PACKAGE_NAMES = Object.freeze([
  '@shiftcharts/core',
  '@shiftcharts/grid',
  '@shiftcharts/motion',
  '@shiftcharts/primitives',
  '@shiftcharts/react',
  '@shiftcharts/testing',
  '@shiftcharts/tokens',
])

/** @type {Readonly<Record<PackageName, PackageExpectation>>} */
const EXPECTED = Object.freeze({
  '@shiftcharts/core': {
    dependencies: ['d3-array', 'd3-format', 'd3-scale', 'd3-shape', 'd3-time-format'],
    peers: [],
    css: false,
  },
  '@shiftcharts/grid': {
    dependencies: ['@shiftcharts/core', 'react-grid-layout'],
    peers: ['react', 'react-dom'],
    css: true,
  },
  '@shiftcharts/motion': {
    dependencies: [],
    peers: ['react'],
    css: true,
  },
  '@shiftcharts/primitives': {
    dependencies: ['@shiftcharts/core'],
    peers: ['react'],
    css: true,
  },
  '@shiftcharts/react': {
    dependencies: ['@shiftcharts/core', '@shiftcharts/primitives'],
    peers: ['react', 'react-dom'],
    css: true,
  },
  '@shiftcharts/testing': {
    dependencies: ['jsdom'],
    peers: [],
    css: false,
  },
  '@shiftcharts/tokens': {
    dependencies: [],
    peers: [],
    css: true,
  },
})

/** @param {unknown} condition @param {string} message */
function assert(condition, message) {
  if (!condition) throw new Error(message)
}

/** @param {PackageName} packageName */
function packageDirectory(packageName) {
  return join(PACKAGES_ROOT, packageName.slice(packageName.indexOf('/') + 1))
}

/** @param {PackageName} packageName */
async function readManifest(packageName) {
  return JSON.parse(await readFile(join(packageDirectory(packageName), 'package.json'), 'utf8'))
}

/** @param {string} file */
async function assertReadable(file) {
  await access(file)
}

/** @param {Record<string, unknown> | null | undefined} value */
function sortedKeys(value) {
  return Object.keys(value || {}).sort()
}

export async function assertPackageMetadata() {
  const reports = []

  for (const packageName of PACKAGE_NAMES) {
    const manifest = await readManifest(packageName)
    const expected = EXPECTED[packageName]
    const root = packageDirectory(packageName)
    const packageShortName = packageName.slice(packageName.indexOf('/') + 1)

    assert(manifest.private !== true, packageName + ': publishable package must not be private')
    assert(manifest.license === 'MIT', packageName + ': license must be MIT')
    assert(typeof manifest.description === 'string' && manifest.description.length > 20,
      packageName + ': description must describe the exported surface')
    assert(manifest.repository && manifest.repository.type === 'git',
      packageName + ': missing git repository metadata')
    assert(manifest.repository.url === REPOSITORY_URL, packageName + ': incorrect repository URL')
    assert(manifest.repository.directory === 'packages/' + packageShortName,
      packageName + ': repository directory must point at the package')
    assert(manifest.homepage === HOMEPAGE, packageName + ': incorrect homepage')
    assert(manifest.bugs && manifest.bugs.url === BUGS_URL, packageName + ': incorrect bugs URL')
    assert(manifest.engines && manifest.engines.node === NODE_ENGINE,
      packageName + ': Node engine must be ' + NODE_ENGINE)
    assert(manifest.publishConfig && manifest.publishConfig.access === 'public',
      packageName + ': publishConfig.access must be public')

    for (const file of ['README.md', 'LICENSE']) {
      await assertReadable(join(root, file))
      assert((manifest.files || []).includes(file), packageName + ': files must include ' + file)
    }
    assert((manifest.files || []).includes('dist'), packageName + ': files must include dist')

    assert(
      JSON.stringify(sortedKeys(manifest.dependencies)) === JSON.stringify(expected.dependencies),
      packageName + ': runtime dependency keys do not match actual imports',
    )
    assert(
      JSON.stringify(sortedKeys(manifest.peerDependencies)) === JSON.stringify(expected.peers),
      packageName + ': peer dependency keys do not match the client/runtime boundary',
    )

    if (expected.css) {
      assert(Array.isArray(manifest.sideEffects),
        packageName + ': CSS package needs sideEffects patterns')
      const sideEffects = /** @type {readonly unknown[]} */ (manifest.sideEffects)
      assert(
        sideEffects.some((pattern) => pattern === '*.css' || pattern === '**/*.css'),
        packageName + ': sideEffects must cover package CSS',
      )
    } else {
      assert(manifest.sideEffects === false, packageName + ': non-CSS package must use sideEffects:false')
    }

    const publishExports = manifest.publishConfig && manifest.publishConfig.exports
    assert(publishExports && publishExports['.'] === './dist/index.js',
      packageName + ': published root must be dist/index.js')
    reports.push(packageName + ': metadata, dependencies, and publish files are correct')
  }

  return reports
}

export async function assertPackedMetadata() {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'shiftcharts-package-metadata-'))
  const packRoot = join(temporaryRoot, 'packs')
  const extractedRoot = join(temporaryRoot, 'extracted')
  const rootLicense = await readFile(join(REPO_ROOT, 'LICENSE'), 'utf8')
  const reports = []

  try {
    for (const packageName of PACKAGE_NAMES) {
      await execFileAsync('pnpm', ['pack', '--pack-destination', packRoot], {
        cwd: packageDirectory(packageName),
        env: { ...process.env, NPM_CONFIG_OFFLINE: 'true', npm_config_offline: 'true' },
        maxBuffer: 2_000_000,
      })
    }

    const tarballs = (await readdir(packRoot)).filter((file) => file.endsWith('.tgz')).sort()
    assert(tarballs.length === PACKAGE_NAMES.length,
      'packed metadata: expected ' + PACKAGE_NAMES.length + ' tarballs, found ' + tarballs.length)

    for (const packageName of PACKAGE_NAMES) {
      const shortName = packageName.slice(packageName.indexOf('/') + 1)
      const tarball = tarballs.find((file) => file.includes(shortName))
      if (tarball === undefined) {
        throw new Error('packed metadata: missing tarball for ' + packageName)
      }

      const packageRoot = join(extractedRoot, shortName)
      await mkdir(packageRoot, { recursive: true })
      await execFileAsync('tar', [
        '-xzf',
        join(packRoot, tarball),
        '-C',
        packageRoot,
        '--strip-components=1',
      ])

      const packedManifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
      const packedLicense = await readFile(join(packageRoot, 'LICENSE'), 'utf8')
      const packedReadme = await readFile(join(packageRoot, 'README.md'), 'utf8')
      const sourceReadme = await readFile(join(packageDirectory(packageName), 'README.md'), 'utf8')

      assert(packedManifest.private !== true, packageName + ': packed manifest is private')
      assert(packedManifest.license === 'MIT', packageName + ': packed manifest lost MIT license')
      assert(packedManifest.publishConfig && packedManifest.publishConfig.access === 'public',
        packageName + ': packed manifest lost public access')
      assert(!JSON.stringify(packedManifest).includes('workspace:'),
        packageName + ': packed manifest contains a workspace dependency')
      assert(packedLicense === rootLicense, packageName + ': tarball LICENSE differs from root LICENSE')
      assert(packedLicense.includes('MIT License') &&
        packedLicense.includes('Copyright (c) 2026 Dhanya Rao'),
        packageName + ': tarball LICENSE misses the required notice')
      assert(packedReadme === sourceReadme, packageName + ': tarball README differs from source README')
      await assertReadable(join(packageRoot, 'dist', 'index.js'))
      await assertReadable(join(packageRoot, 'dist', 'index.d.ts'))

      reports.push(packageName + ': packed README, LICENSE, dist, and dependency metadata are correct')
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }

  return reports
}

const invokedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]

if (invokedDirectly) {
  const metadataReports = await assertPackageMetadata()
  const packedReports = await assertPackedMetadata()
  console.log(metadataReports.concat(packedReports).join('\n'))
}
