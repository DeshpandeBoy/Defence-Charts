/**
 * Gate **G6** — the public API surface.
 *
 * A prop whose type is not exported is a prop a consumer can pass and cannot **name**.
 * They cannot write a wrapper component, cannot type a variable that holds the props,
 * cannot re-export the shape. Inside this repo it typechecks perfectly, because every file
 * here can reach every other file by relative path. From outside the package it is broken.
 * That is this project's recurring failure species — a thing that looks like it works and
 * quietly doesn't — and it is why the check is a gate rather than a review habit.
 *
 * `research/maps/04-ci-gate-map.md` G6: *"`ts-morph` walk from `src/index.ts` collecting
 * `missingExports` + `forbiddenExports`."*
 *
 * ⚠ REACHABILITY IS THE WHOLE DESIGN, AND THE OBVIOUS DEFINITION IS WRONG.
 *
 * The obvious implementation — api-extractor's `ae-forgotten-export`: flag every
 * declaration reachable from a public one — was written and run against this tree first.
 * It produced four reports of which one was a bug:
 *
 *   `Callback`      @gx/testing  → real. It is `FakeResizeObserver`'s constructor
 *                                 parameter type. A consumer cannot spell it.
 *   `AxisScale`     @gx/core     → false. It is a `const` annotation inside
 *                                 `resolveFrame`'s **body**. Function bodies are not API.
 *   `DeepPartialOf` @gx/core     → false. It exists only as an operand of the conditional
 *   `IsUnion`       @gx/core       type `DeepPartial<T>`. The `.d.ts` rollup emits both
 *                                 in-file, so `DeepPartial<ChartPlan>` resolves for a
 *                                 consumer exactly as it does here — and no consumer is
 *                                 ever in a position to write either name.
 *
 * Three false positives out of four is not a gate, it is a source of exports added to
 * silence a gate — which is the precise opposite of a public API. So the rule narrowed to
 * the **type surface**: the positions a consumer has to be able to spell.
 *
 * Excluded, for one reason stated twice:
 *   - runtime code — function and method bodies, variable initialisers, type assertions;
 *   - type-level computation — anything under a conditional or mapped type.
 * Neither is something a consumer writes. What a consumer writes is a parameter type, a
 * return type, a property type, a heritage clause, a type argument.
 *
 * ⚠ THE ORIGIN RULE. `@gx/primitives` exports `ChartProps`, whose every field is a
 * `@gx/core` type. Those are not primitives' to re-export, and demanding it would produce
 * thirty-five bogus reports on that package alone. A referenced type is fine when it comes
 * from:
 *
 *   1. `node_modules` — React's `ReactNode`, d3's scale types. Someone else's contract.
 *   2. TypeScript's own `lib.*.d.ts` — `ReadonlyArray`, `Date`, `Record`. Nobody's to export.
 *   3. a **sibling workspace package that this package declares as a dependency**, and
 *      that exports the type from its own barrel.
 *
 * Origin is decided by the declaring file's path, not by the import specifier — a
 * specifier can be relative, aliased, or a subpath, and all three resolve to the same file.
 * Clause 3 is deliberately two conditions: a declared dependency whose barrel does *not*
 * carry the type is still unreachable, and the fix then lives in the other package. The
 * fixture pair `deny-api` + `deny-api-consumer` plants exactly that case.
 *
 * ⚠ Plain JavaScript with JSDoc types, deliberately, matching `check-tokens.mjs`. It runs
 * on the `engines.node` floor with no build step and no loader — a lint gate that needs the
 * build to work cannot check the build. ts-morph is the one dependency, and it carries its
 * own TypeScript, so this gate does not go red when the repo's compiler moves.
 */

import { readFile, readdir } from 'node:fs/promises'
import { basename, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Node, Project, SyntaxKind, ts } from 'ts-morph'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

/**
 * The forbidden rules, small and data-driven on purpose.
 *
 * ⚠ Two rules, not a policy. Every additional rule here is a thing a future author has to
 * discover by being rejected, so the bar for a third is that someone actually shipped the
 * mistake.
 */
const GENERATED_ALLOWLIST = new Set(['ROBOTO_FLEX_METRICS'])

/**
 * @typedef {{ pkg: string, symbol: string, file: string }} ExportSubject
 * @typedef {{ id: string, why: string, test: (subject: ExportSubject) => boolean }} ForbiddenRule
 */

/** @type {readonly ForbiddenRule[]} */
const FORBIDDEN_RULES = [
  {
    id: 'internal-suffix',
    why: 'the name is the author saying it is not public; the barrel says it is',
    test: (s) => s.symbol.endsWith('Internal'),
  },
  {
    id: 'generated-module',
    why: 'a generated module is rewritten wholesale, so its exports are a contract nobody wrote',
    test: (s) => s.file.endsWith('.generated.ts') && !GENERATED_ALLOWLIST.has(s.symbol),
  },
]

/** `lib.es2022.d.ts`, `lib.dom.d.ts`, and the rest of TypeScript's own declarations. */
const LIB_DTS = /^lib\.[a-z0-9.]*d\.ts$/

/**
 * ⚠ Type-level computation. A reference under one of these is an operand that TypeScript
 * evaluates away; it never survives into a position a consumer writes. Skipping the whole
 * subtree is what makes `DeepPartial<T>`'s two private helpers stop being reported.
 */
const COMPUTED_KINDS = new Set([SyntaxKind.ConditionalType, SyntaxKind.MappedType])

/**
 * @typedef {{ name: string, dir: string, barrel: string, deps: Set<string> }} Pkg
 * @typedef {{ pkg: string, via: string, type: string, file: string, reason: string }} MissingExport
 * @typedef {{ pkg: string, symbol: string, file: string, rule: string, why: string }} ForbiddenExport
 * @typedef {{ missingExports: MissingExport[], forbiddenExports: ForbiddenExport[] }} ApiReport
 */

/**
 * Find every package under `root` that has a barrel.
 *
 * ⚠ `resolve` first. ts-morph reports absolute paths, and the origin rule compares a
 * declaring file against `pkg.dir` with `startsWith`. A relative `root` off the command
 * line makes every comparison miss, every type look like it comes from nowhere, and the
 * gate fail with a real exit code for an entirely fictional reason — observed, not
 * theorised, the first time this was run against a fixture.
 *
 * @param {string} root Directory whose immediate children are package directories.
 * @returns {Promise<Pkg[]>}
 */
export async function discoverPackages(root) {
  const base = resolve(root)
  /** @type {Pkg[]} */
  const found = []
  let entries
  try {
    entries = await readdir(base, { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = join(base, entry.name)
    const barrel = join(dir, 'src', 'index.ts')
    const manifest = await readFile(join(dir, 'package.json'), 'utf8').catch(() => null)
    if (manifest === null) continue
    const source = await readFile(barrel, 'utf8').catch(() => null)
    if (source === null) continue
    /** @type {{ name?: string, dependencies?: Record<string, string>, peerDependencies?: Record<string, string> }} */
    const parsed = JSON.parse(manifest)
    found.push({
      name: parsed.name ?? entry.name,
      dir,
      barrel,
      deps: new Set([
        ...Object.keys(parsed.dependencies ?? {}),
        ...Object.keys(parsed.peerDependencies ?? {}),
      ]),
    })
  }
  return found.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * A stable identity for a declaration node, so "is this the thing the barrel exports?" is
 * a set lookup rather than an object comparison across two ts-morph queries.
 *
 * @param {Node} node
 * @returns {string}
 */
function declKey(node) {
  return `${node.getSourceFile().getFilePath()}#${node.getPos()}`
}

/**
 * @param {Node} member
 * @returns {boolean}
 */
function isHidden(member) {
  const named = /** @type {{ getName?: () => string }} */ (/** @type {unknown} */ (member))
  const name = named.getName?.()
  if (typeof name === 'string' && name.startsWith('#')) return true
  const modifiered = /** @type {{ hasModifier?: (k: ts.SyntaxKind) => boolean }} */ (
    /** @type {unknown} */ (member)
  )
  return modifiered.hasModifier?.(SyntaxKind.PrivateKeyword) === true
}

/**
 * The **type surface** of a declaration: the nodes a consumer has to be able to spell.
 *
 * ⚠ This is the narrowing, expressed once. Note what each branch does *not* return — a
 * variable's initialiser, a function's body, a private class member. The alternative,
 * `getDescendantsOfKind(TypeReference)` on the whole declaration, is what produced the
 * `AxisScale` false positive: a `const` annotation forty lines inside `resolveFrame`.
 *
 * @param {Node} decl
 * @returns {Node[]}
 */
export function typeSurface(decl) {
  /** @type {Node[]} */
  const out = []
  /** @param {Node | undefined} node */
  const push = (node) => {
    if (node !== undefined) out.push(node)
  }

  if (Node.isVariableDeclaration(decl)) {
    push(decl.getTypeNode())
    return out
  }

  if (
    Node.isFunctionDeclaration(decl) ||
    Node.isFunctionExpression(decl) ||
    Node.isArrowFunction(decl) ||
    Node.isMethodDeclaration(decl) ||
    Node.isMethodSignature(decl) ||
    Node.isConstructorDeclaration(decl)
  ) {
    for (const parameter of decl.getParameters()) push(parameter.getTypeNode())
    for (const typeParameter of decl.getTypeParameters()) push(typeParameter)
    push(decl.getReturnTypeNode())
    return out
  }

  if (Node.isClassDeclaration(decl) || Node.isClassExpression(decl)) {
    for (const typeParameter of decl.getTypeParameters()) push(typeParameter)
    push(decl.getExtends())
    for (const implemented of decl.getImplements()) push(implemented)
    for (const member of decl.getMembers()) {
      if (!isHidden(member)) out.push(...typeSurface(member))
    }
    return out
  }

  if (Node.isPropertyDeclaration(decl) || Node.isPropertySignature(decl)) {
    push(decl.getTypeNode())
    return out
  }

  if (Node.isGetAccessorDeclaration(decl)) {
    push(decl.getReturnTypeNode())
    return out
  }

  if (Node.isTypeAliasDeclaration(decl)) {
    push(decl.getTypeNode())
    for (const typeParameter of decl.getTypeParameters()) push(typeParameter)
    return out
  }

  // An interface, an enum, a module declaration: the declaration *is* its surface.
  out.push(decl)
  return out
}

/**
 * ⚠ `traversal.skip()`, and the explicit test on `root` before the walk. `forEachDescendant`
 * starts at the children, so a type alias whose whole body is a conditional type would have
 * had its operands collected before the skip could fire. That single missing line is the
 * difference between reporting `DeepPartialOf` and not.
 *
 * @param {Node} root
 * @returns {import('ts-morph').TypeReferenceNode[]}
 */
function typeReferencesIn(root) {
  if (COMPUTED_KINDS.has(root.getKind())) return []
  /** @type {import('ts-morph').TypeReferenceNode[]} */
  const found = []
  if (Node.isTypeReference(root)) found.push(root)
  root.forEachDescendant((node, traversal) => {
    if (COMPUTED_KINDS.has(node.getKind())) {
      traversal.skip()
      return
    }
    if (Node.isTypeReference(node)) found.push(node)
  })
  return found
}

/**
 * Resolve a type reference to the declarations it names, following import aliases.
 *
 * @param {import('ts-morph').TypeReferenceNode} reference
 * @returns {{ name: string, decls: Node[] }}
 */
function resolveReference(reference) {
  const typeName = reference.getTypeName()
  // `ts.Foo` — the right-hand identifier is the one carrying the symbol.
  const identifier = Node.isQualifiedName(typeName) ? typeName.getRight() : typeName
  let symbol = identifier.getSymbol()
  if (symbol === undefined) return { name: identifier.getText(), decls: [] }
  const aliased = symbol.getAliasedSymbol()
  if (aliased !== undefined) symbol = aliased
  return { name: identifier.getText(), decls: symbol.getDeclarations() }
}

/**
 * Run the gate over one world — a set of packages that may legally depend on each other.
 *
 * ⚠ One `Project` for the whole world, not one per package. Cross-package resolution has to
 * see the sibling's source files to answer "is this type on *their* barrel?", and two
 * Projects would produce two distinct node identities for the same declaration, which makes
 * the set lookup in `declKey` silently always miss.
 *
 * @param {readonly Pkg[]} world
 * @returns {ApiReport}
 */
export function checkWorld(world) {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.Preserve,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      allowImportingTsExtensions: true,
      strict: true,
      skipLibCheck: true,
      noEmit: true,
    },
  })

  /** @type {Map<string, { pkg: Pkg, exported: ReadonlyMap<string, import('ts-morph').ExportedDeclarations[]> }>} */
  const barrels = new Map()
  for (const pkg of world) {
    const sourceFile = project.addSourceFileAtPath(pkg.barrel)
    barrels.set(pkg.name, { pkg, exported: sourceFile.getExportedDeclarations() })
  }
  project.resolveSourceFileDependencies()

  /** @type {Map<string, Set<string>>} */
  const barrelKeys = new Map()
  for (const [name, { exported }] of barrels) {
    const keys = new Set()
    for (const decls of exported.values()) for (const decl of decls) keys.add(declKey(decl))
    barrelKeys.set(name, keys)
  }

  /** @type {MissingExport[]} */
  const missingExports = []
  /** @type {ForbiddenExport[]} */
  const forbiddenExports = []

  for (const [pkgName, { pkg, exported }] of barrels) {
    const own = barrelKeys.get(pkgName) ?? new Set()

    for (const [symbol, decls] of exported) {
      for (const decl of decls) {
        const file = relative(REPO_ROOT, decl.getSourceFile().getFilePath())
        /** @type {ExportSubject} */
        const subject = { pkg: pkgName, symbol, file }
        for (const rule of FORBIDDEN_RULES) {
          if (rule.test(subject)) {
            forbiddenExports.push({ pkg: pkgName, symbol, file, rule: rule.id, why: rule.why })
          }
        }
      }
    }

    /** @type {Set<string>} */
    const visited = new Set()
    /** @type {{ via: string, node: Node }[]} */
    const queue = []
    for (const [symbol, decls] of exported) for (const decl of decls) queue.push({ via: symbol, node: decl })

    /** @type {Set<string>} */
    const reported = new Set()

    while (queue.length > 0) {
      // ⚠ FIFO, not `pop()`. `via` is the export a reader will be sent to fix, so it has to
      // be the *first* barrel entry that reaches the type, not whichever one the stack
      // happened to surface last.
      const item = queue.shift()
      if (item === undefined) break
      const { via, node } = item
      const nodeKey = declKey(node)
      if (visited.has(nodeKey)) continue
      visited.add(nodeKey)

      for (const part of typeSurface(node)) {
        for (const reference of typeReferencesIn(part)) {
          const { name, decls } = resolveReference(reference)
          for (const target of decls) {
            if (Node.isTypeParameterDeclaration(target)) continue
            const targetPath = target.getSourceFile().getFilePath()
            if (targetPath.includes('/node_modules/')) continue
            if (LIB_DTS.test(basename(targetPath))) continue

            const home = world.find((candidate) => targetPath.startsWith(`${candidate.dir}/`))
            const reason = classify({ pkg, home, target, own, barrelKeys })
            if (reason !== null && !reported.has(declKey(target))) {
              reported.add(declKey(target))
              missingExports.push({
                pkg: pkgName,
                via,
                type: name,
                file: relative(REPO_ROOT, targetPath),
                reason,
              })
            }
            queue.push({ via, node: target })
          }
        }
      }
    }
  }

  missingExports.sort((a, b) => `${a.pkg}${a.type}`.localeCompare(`${b.pkg}${b.type}`))
  forbiddenExports.sort((a, b) => `${a.pkg}${a.symbol}`.localeCompare(`${b.pkg}${b.symbol}`))
  return { missingExports, forbiddenExports }
}

/**
 * The origin rule, in one function so there is one place to read it.
 *
 * @param {{ pkg: Pkg, home: Pkg | undefined, target: Node, own: Set<string>, barrelKeys: Map<string, Set<string>> }} input
 * @returns {string | null} Why it is unreachable, or `null` if it is fine.
 */
function classify({ pkg, home, target, own, barrelKeys }) {
  const key = declKey(target)
  if (home === undefined) {
    return 'declared outside every package in the workspace'
  }
  if (home.name === pkg.name) {
    return own.has(key) ? null : `not exported from ${pkg.name}'s own barrel`
  }
  if (!pkg.deps.has(home.name)) {
    return `declared in ${home.name}, which ${pkg.name} does not depend on`
  }
  const sibling = barrelKeys.get(home.name)
  if (sibling === undefined) {
    return `declared in ${home.name}, whose barrel was not read`
  }
  return sibling.has(key) ? null : `declared in ${home.name} but not on its barrel`
}

/**
 * @param {ApiReport} report
 * @returns {string}
 */
export function formatReport(report) {
  const lines = []
  for (const m of report.missingExports) {
    lines.push(`  missing    ${m.pkg}  ${m.type}  (${m.file}, reached via ${m.via}) — ${m.reason}`)
  }
  for (const f of report.forbiddenExports) {
    lines.push(`  forbidden  ${f.pkg}  ${f.symbol}  (${f.file}) — ${f.rule}: ${f.why}`)
  }
  return lines.join('\n')
}

// --- CLI ---------------------------------------------------------------------------

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href

if (invokedDirectly) {
  const root = process.argv[2] ?? join(REPO_ROOT, 'packages')
  const world = await discoverPackages(root)

  // ⚠ Zero packages is this gate's silent failure, identical in shape to the token gate's.
  // A walk that opens no barrel finds no missing export and exits 0.
  if (world.length === 0) {
    console.error(`api gate (G6): found 0 packages with a src/index.ts under ${root} — refusing to pass.`)
    process.exit(1)
  }

  const report = checkWorld(world)
  const total = report.missingExports.length + report.forbiddenExports.length

  if (total > 0) {
    console.error(`api gate (G6): ${report.missingExports.length} missing, ${report.forbiddenExports.length} forbidden\n`)
    console.error(formatReport(report))
    console.error('\nA type reachable from a public signature must be nameable from outside.')
    console.error('See research/maps/04-ci-gate-map.md G6.')
    process.exit(1)
  }

  console.log(`api gate (G6): ${world.length} package(s) clean — ${world.map((p) => p.name).join(', ')}.`)
}
