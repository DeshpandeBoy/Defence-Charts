/**
 * Gate **G8 / B3** — the policy-threshold provenance and composition gate.
 *
 * `PlanPolicy` is a TypeScript input to the pure planner, not a CSS token tree. This gate
 * keeps the two contracts honest without maintaining a second list of thresholds:
 *
 *   1. numeric members are derived from the `PlanPolicy` type;
 *   2. every member has a value in `DEFAULT_POLICY`;
 *   3. the complete default object round-trips through JSON without loss;
 *   4. every threshold has an explicit B3 tier marker in its JSDoc; and
 *   5. every live threshold is read by non-test planner source through `policy.<name>` (or
 *      the equivalent string-literal access). A field marked `@future` may be unconsumed until
 *      its future resolver lands, but it must still carry the same provenance tier.
 *
 * The source walk is deliberately AST-based. A comment saying `policy.pointBudget`, a test
 * fixture, or a dead string must not count as planner consumption. The repository runner is
 * deterministic and sorted, so adding a field produces a stable, reviewable failure.
 */

import { readdir, readFile } from 'node:fs/promises'
import { extname, relative, resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import ts from 'typescript'

/** @typedef {'A-lit' | 'A-impl' | 'B' | 'C'} PolicyTier */

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url))
const POLICY_PATH = join(REPO_ROOT, 'packages/core/src/policy.ts')
const CORE_SOURCE_ROOT = join(REPO_ROOT, 'packages/core/src')
const TIER_PATTERN = /\*\*(A-lit|A-impl|B|C)\*\*/
const THRESHOLD_TIER_SET = new Set(['A-lit', 'A-impl', 'B', 'C'])
const FUTURE_MARKER = /@future\b/i

/**
 * @typedef {object} PolicyField
 * @property {string} name
 * @property {string} typeText
 * @property {boolean} threshold
 * @property {string} documentation
 * @property {PolicyTier | undefined} tier
 * @property {boolean} future
 * @property {number} line
 */

/**
 * @typedef {object} PolicySchema
 * @property {PolicyField[]} fields
 * @property {PolicyField[]} thresholds
 * @property {string[]} parseIssues
 */

/**
 * @typedef {object} PlannerSource
 * @property {string} path
 * @property {string} source
 */

/**
 * @typedef {object} PolicyIssue
 * @property {string} code
 * @property {string} subject
 * @property {string} detail
 * @property {string} [path]
 */

/**
 * @typedef {object} PolicyAuditReport
 * @property {PolicyIssue[]} issues
 * @property {PolicyField[]} fields
 * @property {PolicyField[]} thresholds
 * @property {Map<string, string[]>} uses
 */

/**
 * Read the JSDoc immediately preceding a TypeScript node.
 *
 * @param {string} source
 * @param {ts.Node} node
 * @returns {string}
 */
function leadingDocumentation(source, node) {
  const ranges = ts.getLeadingCommentRanges(source, node.getFullStart()) ?? []
  return ranges
    .filter((range) => range.kind === ts.SyntaxKind.MultiLineCommentTrivia)
    .map((range) => source.slice(range.pos, range.end))
    .join('\n')
}

/**
 * A future reservation is a source-level contract, not a script allowlist. Only an explicit
 * `@future` tag opts a threshold out of the live planner-consumption requirement.
 *
 * @param {string} documentation
 * @returns {boolean}
 */
function hasFutureMarker(documentation) {
  return FUTURE_MARKER.test(documentation)
}

/**
 * Numeric literal unions, such as `1 | 2 | 3`, are thresholds too. Other union shapes are
 * intentionally excluded: a future discriminated policy field needs an explicit rule rather
 * than being accidentally treated as a number because one member happens to be numeric.
 *
 * @param {ts.TypeNode | undefined} node
 * @returns {boolean}
 */
function isNumericThresholdType(node) {
  if (node === undefined) return false
  if (node.kind === ts.SyntaxKind.NumberKeyword) return true
  if (ts.isLiteralTypeNode(node) && ts.isNumericLiteral(node.literal)) return true
  return ts.isUnionTypeNode(node) && node.types.length > 0 && node.types.every(isNumericThresholdType)
}

/**
 * Extract the policy schema from source, without importing or executing it.
 *
 * @param {string} source
 * @param {string} [fileName='packages/core/src/policy.ts']
 * @returns {PolicySchema}
 */
export function collectPlanPolicySchema(source, fileName = 'packages/core/src/policy.ts') {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const alias = file.statements.find(
    (statement) => ts.isTypeAliasDeclaration(statement) && statement.name.text === 'PlanPolicy',
  )

  if (alias === undefined || !ts.isTypeAliasDeclaration(alias) || !ts.isTypeLiteralNode(alias.type)) {
    return {
      fields: [],
      thresholds: [],
      parseIssues: [`${fileName}: could not find a type-literal PlanPolicy declaration`],
    }
  }

  /** @type {PolicyField[]} */
  const fields = []
  for (const member of alias.type.members) {
    if (!ts.isPropertySignature(member) || member.name === undefined) continue
    const name = member.name.getText(file).replace(/^['"]|['"]$/g, '')
    const typeText = member.type?.getText(file) ?? ''
    const documentation = leadingDocumentation(source, member)
    const tierMatch = documentation.match(TIER_PATTERN)
    const tier = tierMatch?.[1]
    const start = file.getLineAndCharacterOfPosition(member.getStart(file)).line + 1
    fields.push({
      name,
      typeText,
      threshold: isNumericThresholdType(member.type),
      documentation,
      tier: tier !== undefined && THRESHOLD_TIER_SET.has(tier) ? tier : undefined,
      future: hasFutureMarker(documentation),
      line: start,
    })
  }

  return {
    fields,
    thresholds: fields.filter((field) => field.threshold),
    parseIssues: [],
  }
}

/**
 * Return explicit policy reads from one source file. The returned paths are relative to the
 * caller-provided source path and are stable for reporting.
 *
 * @param {string} source
 * @param {string} fileName
 * @param {ReadonlySet<string>} thresholdNames
 * @returns {Map<string, number[]>}
 */
export function collectPlannerUses(source, fileName, thresholdNames) {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  /** @type {Map<string, number[]>} */
  const uses = new Map()

  const record = (name, node) => {
    if (!thresholdNames.has(name)) return
    const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
    const lines = uses.get(name) ?? []
    lines.push(line)
    uses.set(name, lines)
  }

  const visit = (node) => {
    if (ts.isPropertyAccessExpression(node) && node.expression.getText(file) === 'policy') {
      record(node.name.text, node)
    } else if (
      ts.isElementAccessExpression(node) &&
      node.expression.getText(file) === 'policy' &&
      node.argumentExpression !== undefined &&
      ts.isStringLiteralLike(node.argumentExpression)
    ) {
      record(node.argumentExpression.text, node)
    }
    ts.forEachChild(node, visit)
  }

  visit(file)
  for (const lines of uses.values()) lines.sort((a, b) => a - b)
  return uses
}

/**
 * Find the non-test TypeScript sources that can consume a resolved policy.
 *
 * @param {string} root
 * @returns {Promise<PlannerSource[]>}
 */
export async function collectPlannerSources(root = CORE_SOURCE_ROOT) {
  /** @type {string[]} */
  const files = []

  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        await walk(path)
        continue
      }
      if (!entry.isFile()) continue
      if (!['.ts', '.tsx'].includes(extname(entry.name))) continue
      if (/\.test\.(?:ts|tsx)$/.test(entry.name)) continue
      if (resolve(path) === resolve(POLICY_PATH)) continue
      files.push(path)
    }
  }

  await walk(resolve(root))
  const sources = []
  for (const path of files.sort()) {
    sources.push({
      path: relative(REPO_ROOT, path).split('\\').join('/'),
      source: await readFile(path, 'utf8'),
    })
  }
  return sources
}

/**
 * Find the first serialisability violation. JSON.stringify silently drops `undefined` object
 * properties, so the recursive walk rejects values before JSON gets the chance to hide them.
 *
 * @param {unknown} value
 * @param {string} [path='$']
 * @param {WeakSet<object>} [seen]
 * @returns {{ path: string, detail: string } | undefined}
 */
function serialisabilityViolation(value, path = '$', seen = new WeakSet()) {
  if (value === null) return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? undefined : { path, detail: 'non-finite number' }
  if (['string', 'boolean'].includes(typeof value)) return undefined
  if (['undefined', 'function', 'symbol', 'bigint'].includes(typeof value)) {
    return { path, detail: `unsupported ${typeof value}` }
  }
  if (typeof value !== 'object') return { path, detail: `unsupported ${typeof value}` }
  if (seen.has(value)) return { path, detail: 'cyclic reference' }
  seen.add(value)

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const violation = serialisabilityViolation(value[index], `${path}[${index}]`, seen)
      if (violation !== undefined) return violation
    }
    seen.delete(value)
    return undefined
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    return { path, detail: 'non-plain object' }
  }
  for (const key of Object.keys(value).sort()) {
    const violation = serialisabilityViolation(value[key], `${path}.${key}`, seen)
    if (violation !== undefined) return violation
  }
  seen.delete(value)
  return undefined
}

/**
 * Stable JSON for comparing a value with its parsed JSON representation.
 *
 * @param {unknown} value
 * @returns {string}
 */
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/**
 * Audit a policy schema and its planner sources.
 *
 * This function is intentionally data-in/data-out so tests can plant one failure at a time
 * without mutating `packages/core`. The repository runner below supplies the real schema,
 * defaults, and source files.
 *
 * @param {object} input
 * @param {PolicySchema} input.schema
 * @param {Record<string, unknown>} input.defaults
 * @param {PlannerSource[]} input.plannerSources
 * @returns {PolicyAuditReport}
 */
export function auditPolicyThresholds({ schema, defaults, plannerSources }) {
  /** @type {PolicyIssue[]} */
  const issues = []
  const fields = schema?.fields ?? []
  const thresholds = schema?.thresholds ?? []
  const fieldNames = new Set(fields.map((field) => field.name))
  const thresholdNames = new Set(thresholds.map((field) => field.name))

  for (const parseIssue of schema?.parseIssues ?? []) {
    issues.push({ code: 'schema', subject: 'PlanPolicy', detail: parseIssue })
  }

  const duplicateFields = fields
    .map((field) => field.name)
    .filter((name, index, names) => names.indexOf(name) !== index)
  for (const name of [...new Set(duplicateFields)].sort()) {
    issues.push({ code: 'duplicate-field', subject: name, detail: 'declared more than once' })
  }

  for (const field of thresholds) {
    if (!Object.prototype.hasOwnProperty.call(defaults, field.name)) {
      issues.push({ code: 'missing-default', subject: field.name, detail: 'no DEFAULT_POLICY value' })
    } else {
      const value = defaults[field.name]
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        issues.push({
          code: 'invalid-default',
          subject: field.name,
          detail: `expected a finite number, received ${typeof value}`,
        })
      }
    }
    if (field.tier === undefined) {
      issues.push({
        code: 'missing-tier',
        subject: field.name,
        detail: 'JSDoc must carry **A-lit**, **A-impl**, **B**, or **C**',
      })
    }
    if (field.documentation.trim() === '') {
      issues.push({
        code: 'missing-provenance',
        subject: field.name,
        detail: 'threshold has no JSDoc provenance record',
      })
    }
  }

  for (const fieldName of [...fieldNames].sort()) {
    if (!Object.prototype.hasOwnProperty.call(defaults, fieldName)) {
      issues.push({ code: 'missing-policy-field', subject: fieldName, detail: 'DEFAULT_POLICY is not total' })
    }
  }
  for (const defaultName of Object.keys(defaults).sort()) {
    if (!fieldNames.has(defaultName)) {
      issues.push({ code: 'extra-default', subject: defaultName, detail: 'not declared by PlanPolicy' })
    }
  }

  const serialisation = serialisabilityViolation(defaults)
  if (serialisation !== undefined) {
    issues.push({
      code: 'not-serialisable',
      subject: 'DEFAULT_POLICY',
      path: serialisation.path,
      detail: serialisation.detail,
    })
  } else {
    try {
      const encoded = JSON.stringify(defaults)
      const revived = JSON.parse(encoded)
      if (stableJson(defaults) !== stableJson(revived)) {
        issues.push({
          code: 'not-serialisable',
          subject: 'DEFAULT_POLICY',
          detail: 'JSON round-trip changed the policy value',
        })
      }
    } catch (error) {
      issues.push({
        code: 'not-serialisable',
        subject: 'DEFAULT_POLICY',
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /** @type {Map<string, string[]>} */
  const uses = new Map()
  for (const plannerSource of [...(plannerSources ?? [])].sort((a, b) => a.path.localeCompare(b.path))) {
    const sourceUses = collectPlannerUses(plannerSource.source, plannerSource.path, thresholdNames)
    for (const [name, lines] of sourceUses) {
      const locations = uses.get(name) ?? []
      locations.push(`${plannerSource.path}:${lines.join(',')}`)
      uses.set(name, locations)
    }
  }
  for (const field of thresholds) {
    if (!uses.has(field.name) && !field.future) {
      issues.push({
        code: 'unconsumed',
        subject: field.name,
        detail: 'no non-test planner source reads policy.' + field.name,
      })
    }
  }

  issues.sort((a, b) =>
    `${a.code}\u0000${a.subject}\u0000${a.path ?? ''}\u0000${a.detail}`.localeCompare(
      `${b.code}\u0000${b.subject}\u0000${b.path ?? ''}\u0000${b.detail}`,
    ),
  )
  for (const locations of uses.values()) locations.sort()

  return { issues, fields, thresholds, uses }
}

/**
 * @param {PolicyAuditReport} report
 * @returns {string}
 */
export function formatPolicyThresholdReport(report) {
  if (report.issues.length === 0) {
    return `B3 policy threshold gate: PASS (${report.thresholds.length} thresholds; defaults are serialisable, tiered, and planner-consumed)`
  }
  const lines = [
    `B3 policy threshold gate: FAIL (${report.issues.length} issue${report.issues.length === 1 ? '' : 's'})`,
  ]
  for (const issue of report.issues) {
    const location = issue.path === undefined ? '' : ` [${issue.path}]`
    lines.push(`- ${issue.code}: ${issue.subject}${location} — ${issue.detail}`)
  }
  return lines.join('\n')
}

/**
 * Load and audit the repository's real PlanPolicy.
 *
 * @param {string} [repoRoot=REPO_ROOT]
 * @returns {Promise<PolicyAuditReport>}
 */
export async function auditRepositoryPolicyThresholds(repoRoot = REPO_ROOT) {
  const policyPath = join(resolve(repoRoot), 'packages/core/src/policy.ts')
  const source = await readFile(policyPath, 'utf8')
  const schema = collectPlanPolicySchema(source, relative(repoRoot, policyPath).split('\\').join('/'))
  const module = await import(pathToFileURL(policyPath).href)
  const plannerSources = await collectPlannerSources(join(resolve(repoRoot), 'packages/core/src'))
  return auditPolicyThresholds({ schema, defaults: module.DEFAULT_POLICY, plannerSources })
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    const report = await auditRepositoryPolicyThresholds()
    console.log(formatPolicyThresholdReport(report))
    process.exitCode = report.issues.length === 0 ? 0 : 1
  } catch (error) {
    console.error(`B3 policy threshold gate: ERROR — ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
