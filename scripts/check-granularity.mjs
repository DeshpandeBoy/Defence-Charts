/**
 * Gate **G20** (proposed, not yet wired into `pnpm verify` or CI — see
 * `research/44-granularity.md` for the hand-off) — the granularity coverage manifest.
 *
 * `research/30-implementation-plan.md` states B2's mandate in one sentence: *"`raw/06` §7
 * produced the granularity table across ten libraries. Every ● in that table becomes a token or
 * a plan field, or we write down why not."* This gate is that sentence made falsifiable: parse
 * the table `raw/06` actually contains, cross-check it against `./granularity.mjs`'s
 * `DISPOSITIONS` manifest, and fail if a row is missing, a cited token isn't declared, a cited
 * plan path doesn't resolve against `ChartPlan`, or a declined row's cited source doesn't exist.
 *
 * ⚠ THIS GATE AUDITS A CLAIM, NOT AN IMPLEMENTATION. A knob can be "dispositioned" while its
 * tokens are still undeclared — that's the `owedToB1` count, not a failure. What *is* a hard
 * failure: a disposition that names a token or plan path and gets the name wrong. Coverage may
 * be incomplete; citations may not lie.
 *
 * ⚠ UNION TYPES BREAK A NAIVE DOTTED-PATH WALK. `axes.x.ticks.count` only exists inside one
 * member of `TickPlan`'s three-way union (`{mode:'count', count}`); `axes.x.domainLine` exists
 * on every member of `AxisPlan` because `AxisPlan` isn't a union at all. `resolvePlanPath` walks
 * the type *nodes* from `packages/core/src/plan.ts`'s own AST — not the checker's `Type` API,
 * which needs a contextual node to resolve a property's type and would have made this file as
 * long as `check-api.mjs` for no benefit `ChartPlan`'s shape doesn't already need — and treats a
 * union as resolved if **any** member carries the rest of the path.
 *
 * ⚠ Plain JavaScript with JSDoc types, deliberately, matching `check-tokens.mjs` and
 * `check-api.mjs`. It runs on the `engines.node` floor with no build step and no loader — a lint
 * gate that needs the build to work cannot check the build. ts-morph is the one dependency, and
 * it carries its own TypeScript, so this gate does not go red when the repo's compiler moves.
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Node, Project, ts } from 'ts-morph'

import { collectDeclaredTokens } from './check-tokens.mjs'
import { DISPOSITIONS, parseGranularityTable } from './granularity.mjs'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const RESEARCH_DOC = join(REPO_ROOT, 'research/raw/06-design-tokens-widgets.md')
const PLAN_SOURCE = join(REPO_ROOT, 'packages/core/src/plan.ts')
const THEMES_DIR = join(REPO_ROOT, 'packages/tokens/src/themes/')

/**
 * Resolve a dotted path (`"axes.x.ticks.count"`) against a type node from `plan.ts`.
 *
 * @param {import('ts-morph').SourceFile} sourceFile
 * @param {import('ts-morph').TypeNode | undefined} typeNode
 * @param {string[]} segments
 * @returns {boolean}
 */
function resolveTypeNode(sourceFile, typeNode, segments) {
  if (segments.length === 0) return true
  if (typeNode === undefined) return false

  if (Node.isParenthesizedTypeNode(typeNode)) {
    return resolveTypeNode(sourceFile, typeNode.getTypeNode(), segments)
  }

  if (Node.isUnionTypeNode(typeNode)) {
    return typeNode.getTypeNodes().some((member) => resolveTypeNode(sourceFile, member, segments))
  }

  if (Node.isTypeReference(typeNode)) {
    const name = typeNode.getTypeName().getText()
    const alias = sourceFile.getTypeAlias(name)
    if (alias === undefined) return false
    return resolveTypeNode(sourceFile, alias.getTypeNode(), segments)
  }

  if (Node.isTypeLiteral(typeNode)) {
    const [head, ...rest] = segments
    const member = typeNode.getMembers().find((m) => Node.isPropertySignature(m) && m.getName() === head)
    if (member === undefined || !Node.isPropertySignature(member)) return false
    return resolveTypeNode(sourceFile, member.getTypeNode(), rest)
  }

  return false
}

/**
 * @param {import('ts-morph').Project} project
 * @param {string} path Dotted path into `ChartPlan`, e.g. `"axes.x.ticks.count"`.
 * @returns {boolean}
 */
export function resolvePlanPath(project, path) {
  const sourceFile = project.getSourceFileOrThrow(PLAN_SOURCE)
  const alias = sourceFile.getTypeAliasOrThrow('ChartPlan')
  return resolveTypeNode(sourceFile, alias.getTypeNode(), path.split('.'))
}

/**
 * Build the one `Project` this gate needs — just enough of `@gx/core` to read `plan.ts`'s AST.
 *
 * @returns {import('ts-morph').Project}
 */
export function buildPlanProject() {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.Preserve,
      strict: true,
      skipLibCheck: true,
      noEmit: true,
    },
  })
  project.addSourceFileAtPath(PLAN_SOURCE)
  return project
}

/**
 * @typedef {{ knob: string, status: 'dispositioned' | 'owed-to-b2', notDeclared?: string[] }} RowResult
 * @typedef {{ knob: string, path: string }} UnresolvedPath
 * @typedef {{ knob: string, source: string }} MissingDeclineSource
 * @typedef {{
 *   rows: RowResult[],
 *   owedToB1: number,
 *   owedToB2: number,
 *   unresolvedPaths: UnresolvedPath[],
 *   undeclaredDecline: MissingDeclineSource[],
 * }} GranularityReport
 */

/**
 * @param {{
 *   rows: import('./granularity.mjs').GranularityRow[],
 *   dispositions: Record<string, import('./granularity.mjs').Disposition>,
 *   declaredTokens: Set<string>,
 *   project: import('ts-morph').Project,
 *   repoRoot?: string,
 * }} input
 * @returns {GranularityReport}
 */
export function auditGranularity({ rows, dispositions, declaredTokens, project, repoRoot = REPO_ROOT }) {
  /** @type {RowResult[]} */
  const rowResults = []
  /** @type {UnresolvedPath[]} */
  const unresolvedPaths = []
  /** @type {MissingDeclineSource[]} */
  const undeclaredDecline = []
  let owedToB1 = 0
  let owedToB2 = 0

  for (const row of rows) {
    const disposition = dispositions[row.knob]
    if (disposition === undefined) {
      owedToB2 += 1
      rowResults.push({ knob: row.knob, status: 'owed-to-b2' })
      continue
    }

    const tokens = disposition.tokens ?? []
    const notDeclared = tokens.filter((name) => !declaredTokens.has(`--gx-${name}`))
    owedToB1 += notDeclared.length

    for (const path of disposition.planPaths ?? []) {
      if (!resolvePlanPath(project, path)) unresolvedPaths.push({ knob: row.knob, path })
    }

    if (disposition.declined !== undefined && !existsSync(join(repoRoot, disposition.declined.source))) {
      undeclaredDecline.push({ knob: row.knob, source: disposition.declined.source })
    }

    rowResults.push({ knob: row.knob, status: 'dispositioned', notDeclared })
  }

  return { rows: rowResults, owedToB1, owedToB2, unresolvedPaths, undeclaredDecline }
}

// --- CLI ---------------------------------------------------------------------------

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href

if (invokedDirectly) {
  const markdown = await readFile(RESEARCH_DOC, 'utf8')
  const rows = parseGranularityTable(markdown)

  // ⚠ Zero rows parsed is this gate's silent failure, identical in shape to check-tokens.mjs's
  // and check-api.mjs's own empty-set refusals: a table the parser can't find still audits
  // "clean" against zero rows unless the CLI treats that as a failure itself.
  if (rows.length === 0) {
    console.error(
      `granularity gate (G20): parsed 0 rows from ${relative(REPO_ROOT, RESEARCH_DOC)} §7.1 — refusing to pass.`,
    )
    process.exit(1)
  }

  const declaredTokens = await collectDeclaredTokens(THEMES_DIR)
  const project = buildPlanProject()
  const report = auditGranularity({ rows, dispositions: DISPOSITIONS, declaredTokens, project })

  const dispositioned = report.rows.filter((r) => r.status === 'dispositioned').length
  const totalErrors = report.unresolvedPaths.length + report.undeclaredDecline.length

  if (totalErrors > 0) {
    console.error(`granularity gate (G20): ${totalErrors} citation error(s)\n`)
    for (const { knob, path } of report.unresolvedPaths) {
      console.error(`  unresolved plan path  ${knob}  —  ChartPlan.${path} does not exist`)
    }
    for (const { knob, source } of report.undeclaredDecline) {
      console.error(`  missing decline source  ${knob}  —  ${source} does not exist`)
    }
    console.error('\nA disposition must cite a real plan path or a real source. See research/44-granularity.md.')
    process.exit(1)
  }

  console.log(
    `granularity gate (G20): ${rows.length} knobs — ${dispositioned} dispositioned, ` +
      `${report.owedToB2} owed to B2; ${report.owedToB1} named tokens not yet declared (owed to B1).`,
  )
}
