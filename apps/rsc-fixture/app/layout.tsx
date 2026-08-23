import type { ReactNode } from 'react'

/**
 * The root layout, and deliberately the least interesting file in this app.
 *
 * ⚠ **No `"use client"`, here or anywhere under `app/`.** A client directive on a layout
 * would make every page it wraps a client tree, and gate **G4** would then be asserting
 * something about SSR-plus-hydration while claiming to assert something about RSC. The
 * absence is the load-bearing part, which is why it is stated rather than left to be noticed.
 *
 * ⚠ **No stylesheet import, no font, no metadata, no `<head>` content.** Everything this
 * fixture renders should be attributable to `page.tsx` or to `@gx/primitives`. A layout that
 * pulled in a font would put a `<link>` and a preload chunk into the HTML that G4's client-
 * bundle half would then have to learn to ignore — and a gate with an exception list is a
 * gate that grows exceptions.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
