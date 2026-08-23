/**
 * The slice of `jsdom` this package uses, declared locally.
 *
 * ⚠ **This exists because jsdom 30 ships no types and `@types/jsdom` is not installed.**
 * `npx tsc --noEmit` reports `TS7016: Could not find a declaration file for module 'jsdom'`
 * without it. The proper fix is `@types/jsdom` as a devDependency of this package; that is a
 * manifest and lockfile change, and this shim is what stands in until someone makes it.
 * Nothing here is a workaround for a type that exists — it is a stand-in for a package that
 * is absent.
 *
 * ⚠ **Two constructor options are deliberately not declared, and their absence is the point.**
 *
 * `contentType` is the one that matters. `new JSDOM(html, { contentType: 'application/xml' })`
 * parses markup that carries no `xmlns` declaration into elements with a **null** namespace —
 * `querySelector('path')` still finds one, `getAttribute('d')` still returns the string, and
 * the element is not an SVG path. Every assertion written against it passes while testing
 * nothing. `./expect.ts` documents that at length; leaving the option off this declaration
 * makes it a type error as well as a documented trap, which is the cheaper of the two to
 * notice.
 *
 * `runScripts` is the second: it executes `<script>` content from the markup under test, which
 * turns a parser into an evaluator. Nothing here wants that.
 *
 * ⚠ When `@types/jsdom` does land, **delete this file** rather than keeping it as a narrower
 * overload — an ambient `declare module` and a real one for the same specifier is a conflict
 * TypeScript resolves by rules nobody remembers. Re-state the `contentType` ban as a lint rule
 * or a comment at the single call site instead.
 *
 * ⚠ Ambient rather than a module augmentation only because this is a `.d.ts`:
 * `moduleDetection: "force"` in `tsconfig.base.json` makes every *non-declaration* file a
 * module, and a `declare module` inside a module augments rather than declares. Renaming this
 * to `.ts` would silently change its meaning and reintroduce TS7016.
 */

declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string)
    readonly window: {
      readonly document: Document
    }
  }
}
