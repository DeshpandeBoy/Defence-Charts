import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * ⚠ Flat config, and that is why ESLint 9 was chosen over staying on 8: gate **G2** has
 * to apply to `packages/core` and to nothing else. Under eslintrc that means a second
 * config file inside the package, which is a rule that travels with the directory and
 * quietly stops applying the moment a file moves. Here the scope is one `files` glob in
 * one file, visible to anyone reading the config.
 */

/**
 * The four measurement APIs `@gx/core` may not call — gate **G2**.
 *
 * ⚠ Not a style rule. `planChart()` is pure and runs on the server, where none of these
 * exist; a call to any of them is the difference between a library that renders in an RSC
 * tree and one that throws on import. `research/20-architecture.md` §2.
 *
 * ⚠ The ban is enforced here *and* by the environment: `vitest.config.ts` gives core's
 * tests no DOM, and `check-determinism.mjs` keeps happy-dom out of the graph so the call
 * cannot silently return `0` instead of throwing. Three mechanisms, because the failure
 * this prevents is invisible in output — a chart laid out as though every label were
 * empty still renders, still snapshots, and still passes.
 */
const BANNED_MEASUREMENT_APIS = [
  'getComputedTextLength',
  'getBBox',
  'getTotalLength',
  'getBoundingClientRect',
  'getSubStringLength',
  'getExtentOfChar',
]

const G2_MESSAGE =
  'G2: @gx/core may not measure the DOM. planChart() is pure and runs on the server. ' +
  'Text width comes from the fontMetrics plan-input token — see research/41-text-metrics.md.'

export default tseslint.config(
  {
    /**
     * ⚠ Flat config does not ignore dot-directories, and it does not read `.gitignore`.
     * Nine near-identical vendored copies of the agent tooling live in dot-directories
     * here; left unignored they contributed **16,129** errors and buried the six that
     * belong to this repo. The list mirrors `.gitignore` — if one grows an entry, so does
     * the other.
     */
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.turbo/**',
      'research/**',
      '.agent/**',
      '.agents/**',
      '.claude/**',
      '.codex/**',
      '.cursor/**',
      '.gemini/**',
      '.kiro/**',
      '.pi/**',
      '.impeccable/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // The library ships types as its contract; an implicit `any` is a hole in it.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  /**
   * Gate **G2**, scoped to exactly one package.
   */
  {
    files: ['packages/core/**/*.ts'],
    languageOptions: {
      // ⚠ No browser globals here at all. `document.querySelector(…)` never reaches the
      // member-expression rule below if `document` itself is already undefined.
      globals: {},
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        ...BANNED_MEASUREMENT_APIS.map((name) => ({
          selector: `MemberExpression[property.name='${name}']`,
          message: `${G2_MESSAGE} (${name})`,
        })),
        {
          selector: "MemberExpression[property.name='offsetWidth']",
          message: `${G2_MESSAGE} (offsetWidth)`,
        },
        {
          selector: "CallExpression[callee.name='getComputedStyle']",
          message: `${G2_MESSAGE} (getComputedStyle)`,
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'document', message: G2_MESSAGE },
        { name: 'window', message: G2_MESSAGE },
        { name: 'navigator', message: G2_MESSAGE },
        { name: 'ResizeObserver', message: G2_MESSAGE },
      ],
      // Belt for gate G1's braces. dependency-cruiser owns that rule; this catches the
      // same mistake at the keystroke instead of at the end of the pipeline.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'G1: @gx/core is framework-agnostic.' },
            { name: 'react-dom', message: 'G1: @gx/core is framework-agnostic.' },
          ],
          patterns: ['@gx/react*', '@gx/primitives*', '@gx/grid*'],
        },
      ],
    },
  },

  {
    files: ['packages/{primitives,react,grid}/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },

  /**
   * ⚠ `apps/` is in scope because the root `lint` script runs `eslint .` — not because
   * the playground is product surface. It is a development tool and it is *allowed* to do
   * the things the library may not: measure the DOM, hold state, touch `window`. That is
   * the point of it. Gate **G2** is scoped to `packages/core` precisely so this asymmetry
   * is legible rather than accidental.
   */
  {
    files: ['apps/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },

  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'scripts/**/*.test.mjs'],
    languageOptions: { globals: globals.node },
    rules: {
      // Fixtures and planted violations are the point of these files.
      'no-restricted-syntax': 'off',
    },
  },

  {
    files: ['scripts/**/*.mjs', '*.config.ts', '*.config.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },

  {
    // dependency-cruiser loads its config with `require`, so this one file is CommonJS
    // inside a `"type": "module"` repo — and needs the globals to match.
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.commonjs },
    },
  },
)
