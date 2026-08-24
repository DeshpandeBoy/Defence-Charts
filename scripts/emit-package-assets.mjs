// @ts-check

import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** @typedef {{ exportPath: string | null, source: string, dist: string }} CssAsset */

/**
 * The source-to-dist map is deliberately the one registry used by both tsdown's generated
 * publish exports and the post-build copy step. A CSS export that is not in this table cannot
 * silently point at a file the build never emits.
 *
 * @type {Readonly<Record<string, readonly CssAsset[]>>}
 */
export const CSS_ASSETS = Object.freeze({
  '@gx/grid': Object.freeze([
    { exportPath: './widget-shell.css', source: 'src/widget-shell.css', dist: 'dist/widget-shell.css' },
    { exportPath: './widget-states.css', source: 'src/widget-states.css', dist: 'dist/widget-states.css' },
    { exportPath: './keyboard-grid.css', source: 'src/keyboard-grid.css', dist: 'dist/keyboard-grid.css' },
  ]),
  '@gx/primitives': Object.freeze([
    { exportPath: './chart.css', source: 'src/chart.css', dist: 'dist/chart.css' },
  ]),
  '@gx/react': Object.freeze([
    { exportPath: './auto-chart.css', source: 'src/auto-chart.css', dist: 'dist/auto-chart.css' },
    { exportPath: './interaction-overlay.css', source: 'src/interaction-overlay.css', dist: 'dist/interaction-overlay.css' },
  ]),
  '@gx/tokens': Object.freeze([
    { exportPath: './theme.css', source: 'src/themes/theme.css', dist: 'dist/themes/theme.css' },
    { exportPath: null, source: 'src/themes/typography.css', dist: 'dist/themes/typography.css' },
  ]),
})

/**
 * Add CSS subpaths to both generated export maps. tsdown calls this once for the development
 * map and once for the publish map, supplying `isPublish` so the maps can point at different
 * trees without a post-build package-manifest rewrite.
 *
 * @param {string} packageName
 * @returns {(generated: Record<string, unknown>, context: { isPublish: boolean }) => Record<string, unknown>}
 */
export function cssExportsFor(packageName) {
  const assets = CSS_ASSETS[packageName] ?? []
  return (generated, { isPublish }) => {
    const next = { ...generated }
    for (const asset of assets) {
      if (asset.exportPath === null) continue
      next[asset.exportPath] = isPublish ? `./${asset.dist}` : `./${asset.source}`
    }
    return next
  }
}

/**
 * Copy package CSS sources into the exact paths used by `publishConfig.exports`.
 *
 * @param {string} packageRoot
 * @returns {Promise<readonly CssAsset[]>}
 */
export async function emitPackageAssets(packageRoot) {
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
  /** @type {readonly CssAsset[]} */
  const assets = CSS_ASSETS[manifest.name] ?? []

  for (const asset of assets) {
    const target = join(packageRoot, asset.dist)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(join(packageRoot, asset.source), target)
  }

  return assets
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const packageRoot = resolve(process.argv[2] ?? process.cwd())
  const assets = await emitPackageAssets(packageRoot)
  console.log(
    assets.length === 0
      ? `package assets: ${packageRoot} has no CSS assets`
      : `package assets: emitted ${assets.length} CSS asset(s) for ${packageRoot}`,
  )
}
